import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createParser } from 'eventsource-parser';
import { OpenPlatformApiError, parseResponse, request, requestResponse } from '@/api/iam/client';
import { commandPath, type CommandRecord } from '@/api/device/commands';
import { query, type CursorPage } from '@/api/device/client';
import { useIam } from '@/context/iam-context/identity';

type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'paused' | 'blocked';
type Store = { scope: string; records: Map<string, CommandRecord>; boundary: string | null; cursor: string | null; hasMore: boolean };
type View = {
  store: Store; records: CommandRecord[]; hasMore: boolean; isLoading: boolean;
  isValidating: boolean; error?: unknown; streamError?: unknown; status: StreamStatus;
};
const subscribeVisibility = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
};
const isVisible = () => document.visibilityState === 'visible';
const visibleOnServer = () => true;
const isRecord = (value: unknown, deviceId: string): value is CommandRecord => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<CommandRecord>;
  return typeof row.requestId === 'string' && row.deviceId === deviceId &&
    typeof row.version === 'number' && Number.isSafeInteger(row.version) && row.version >= 0 &&
    typeof row.createTime === 'number' && Number.isFinite(row.createTime) &&
    (row.commandType === 'PROPERTY' || row.commandType === 'ACTION') &&
    typeof row.deliveryStatus === 'string' && typeof row.executionStatus === 'string';
};

/** Device-scoped live view. Reconnection repairs the entire loaded ID range, not just page one. */
export function useCommandRecords(projectId: string, deviceId: string, filter: string, allowed: boolean) {
  const { session } = useIam();
  const sessionId = session?.sessionId;
  const accessToken = session?.accessToken;
  const visible = useSyncExternalStore(subscribeVisibility, isVisible, visibleOnServer);
  const [epoch, setEpoch] = useState(0);
  const store = useMemo<Store>(() => ({ scope: JSON.stringify([projectId, deviceId, filter, sessionId]), records: new Map(), boundary: null, cursor: null, hasMore: false }),
    [projectId, deviceId, filter, sessionId]);
  const [view, setView] = useState<View>();
  const loadMore = useRef<(() => void) | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let status: StreamStatus = 'connecting';
    let loading = store.records.size === 0;
    let validating = false;
    let error: unknown;
    let streamError: unknown;
    let recovering: Promise<void> | null = null;
    let loadingMore: Promise<void> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let initialSnapshotAttempted = false;
    const base = commandPath(deviceId);
    const publish = () => {
      if (signal.aborted) return;
      setView({ store, records: [...store.records.values()].sort((a, b) =>
        a.createTime - b.createTime || a.requestId.localeCompare(b.requestId)),
      hasMore: store.hasMore, isLoading: loading, isValidating: validating, error, streamError, status });
    };
    const merge = (rows: CommandRecord[]) => {
      for (const row of rows) {
        if (!isRecord(row, deviceId)) throw new Error('指令记录格式异常，无法合并实时版本。');
        if (filter && row.commandType !== filter) continue;
        const current = store.records.get(row.requestId);
        if (!current || row.version > current.version) store.records.set(row.requestId, row);
      }
    };
    const page = (cursor: string | null) => request<CursorPage<CommandRecord>>(
      base + '/commands' + query({ pageSize: 20, commandType: filter, cursor }),
      'GET', undefined, { projectId, signal },
    );
    const recover = (): Promise<void> => {
      if (signal.aborted) return Promise.resolve();
      if (recovering) return recovering;
      if (loadingMore) return loadingMore.then(recover);
      initialSnapshotAttempted = true;
      validating = true; error = undefined; publish();
      // History is ordered by requestId, not time. Walk through the previously
      // loaded lowest ID so updates on every visible page are repaired.
      const boundary = store.boundary;
      recovering = (async () => {
        let cursor: string | null = null;
        do {
          const result = await page(cursor);
          if (signal.aborted) return;
          merge(result.items);
          store.cursor = result.nextCursor;
          store.hasMore = result.hasMore;
          const last = result.items[result.items.length - 1]?.requestId;
          if (last && (!store.boundary || last < store.boundary)) store.boundary = last;
          publish();
          if (!result.hasMore || !result.nextCursor || !last || !boundary || last <= boundary) break;
          if (result.nextCursor === cursor) throw new Error('历史记录游标未前进，请重新连接。');
          cursor = result.nextCursor;
        } while (!signal.aborted);
      })().catch(cause => { if (!signal.aborted) error = cause; }).finally(() => {
        recovering = null; loading = false; validating = false; publish();
      });
      return recovering;
    };
    loadMore.current = () => {
      if (validating || !store.hasMore || !store.cursor || signal.aborted) return;
      validating = true; error = undefined; publish();
      loadingMore = page(store.cursor).then(result => {
        if (signal.aborted) return;
        merge(result.items);
        store.cursor = result.nextCursor; store.hasMore = result.hasMore;
        const last = result.items[result.items.length - 1]?.requestId;
        if (last && (!store.boundary || last < store.boundary)) store.boundary = last;
      }).catch(cause => { if (!signal.aborted) error = cause; }).finally(() => {
        loadingMore = null; validating = false; publish();
      });
    };

    if (!allowed || !accessToken || !visible) {
      if (!allowed || !accessToken) {
        store.records.clear(); store.boundary = null; store.cursor = null; store.hasMore = false;
      }
      status = !visible ? 'paused' : 'blocked'; loading = false; publish();
      loadMore.current = null;
      return () => controller.abort();
    }
    publish();
    const run = async () => {
      let failures = 0;
      let retry = 3000;
      while (!signal.aborted) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
          const response = await requestResponse(base + '/commands/stream', 'GET', undefined,
            { projectId, signal, accept: 'text/event-stream' });
          if (!response.ok) await parseResponse(response);
          if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream') || !response.body) {
            await response.body?.cancel();
            throw new Error('实时记录接口未返回事件流，请检查网关配置。');
          }
          const parser = createParser({
            maxBufferSize: 1024 * 1024,
            onRetry: value => { retry = Math.min(30000, Math.max(1000, value)); },
            onError: cause => { throw cause; },
            onEvent: event => {
              if (signal.aborted) return;
              if (event.event === 'ready') {
                status = 'live'; streamError = undefined; failures = 0; publish();
                void recover();
              } else if (event.event === 'command.updated') {
                const row: unknown = JSON.parse(event.data);
                if (!isRecord(row, deviceId)) throw new Error('实时指令记录格式异常。');
                merge([row]); publish();
              }
            },
          });
          reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (!signal.aborted) {
            const chunk = await reader.read();
            if (chunk.done) break;
            parser.feed(decoder.decode(chunk.value, { stream: true }));
          }
          if (!signal.aborted) throw new Error('实时连接已结束，正在重新连接。');
        } catch (cause) {
          if (signal.aborted) return;
          streamError = cause;
          if (cause instanceof OpenPlatformApiError && [400, 401, 403, 404].includes(cause.status)) {
            status = 'blocked'; loading = false; publish(); return;
          }
          status = 'reconnecting'; publish();
          // When the initial stream cannot open, still show a one-time snapshot.
          // Subsequent history repair is driven by ready, never by polling.
          if (!initialSnapshotAttempted) void recover();
        } finally {
          await reader?.cancel().catch(() => undefined);
          reader?.releaseLock();
        }
        const delay = Math.min(30000, retry * 2 ** Math.min(failures++, 4) + Math.random() * 1000);
        await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(retryTimer); signal.removeEventListener('abort', finish); resolve(); };
          signal.addEventListener('abort', finish, { once: true });
          retryTimer = setTimeout(finish, delay);
          if (signal.aborted) finish();
        });
      }
    };
    void run();
    return () => { controller.abort(); clearTimeout(retryTimer); loadMore.current = null; };
  }, [store, projectId, deviceId, filter, allowed, accessToken, visible, epoch]);

  const current = view?.store === store ? view : undefined;
  return {
    records: allowed && sessionId ? current?.records ?? [] : [], hasMore: allowed && !!sessionId && (current?.hasMore ?? false),
    isLoading: current?.isLoading ?? !!(allowed && sessionId), isValidating: current?.isValidating ?? false,
    error: current?.error, streamError: current?.streamError, status: current?.status ?? 'connecting',
    refresh: () => setEpoch(value => value + 1), loadMore: () => loadMore.current?.(),
  };
}
