import { useEffect, useRef, useState } from 'react';
import { createParser } from 'eventsource-parser';
import { OpenPlatformApiError, parseResponse, requestResponse } from '@/api/iam/client';
import { simulationPath, type SimulationSession, type SimulationState } from '@/api/device/simulation';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { formatDateTime } from '@/lib/date-time';

const phase: Record<SimulationSession['status'], number> = { STARTING: 0, RUNNING: 1, STOPPING: 2, STOPPED: 3, FAILED: 3 };

export function useSimulationEvents(projectId: string, instanceId?: string) {
  const { session } = useIam();
  const allowed = usePermission('device:view') && !!session;
  const key = `${session?.sessionId}:${projectId}:${instanceId}`;
  const [snapshot, setSnapshot] = useState<{ key: string; value: SimulationState }>();
  const [output, setOutput] = useState<{ key: string; lines: string[] }>({ key: '', lines: [] });
  const [connection, setConnection] = useState<{ key: string; synced: boolean; status: string; error?: unknown }>({ key: '', synced: false, status: '等待连接' });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<{ key: string; id?: string }>({ key: '' });

  useEffect(() => {
    if (!instanceId || !allowed) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let hasSnapshot = false;
    const pending: string[] = [];
    const flush = () => {
      if (!pending.length || controller.signal.aborted) return;
      const batch = pending.splice(0);
      setOutput(previous => {
        const lines = [...(previous.key === key ? previous.lines : []), ...batch];
        let length = lines.reduce((total, line) => total + line.length, 0);
        while (lines.length > 500 || length > 262144) length -= lines.shift()!.length;
        return { key, lines };
      });
    };
    const flushing = setInterval(flush, 100);

    async function connect() {
      hasSnapshot = false;
      setConnection(previous => ({ key, synced: false, status: failures ? '正在重新连接…' : '正在连接…', error: previous.key === key ? previous.error : undefined }));
      try {
        const after = cursor.current.key === key ? cursor.current.id : undefined;
        const path = simulationPath(`instances/${encodeURIComponent(instanceId!)}/events/stream`) + (after ? `?after=${encodeURIComponent(after)}` : '');
        const response = await requestResponse(path, 'GET', undefined, { projectId, signal: controller.signal, accept: 'text/event-stream' });
        if (!response.ok) await parseResponse(response);
        if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('服务未返回模拟事件流');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createParser({ maxBufferSize: 1048576, onEvent: event => {
          if (controller.signal.aborted) return;
          if (event.event === 'simulation.state') {
            const value: SimulationState = JSON.parse(event.data);
            if (value?.instance?.instanceId !== instanceId || !Number.isSafeInteger(value.instance.generation) || !Number.isSafeInteger(value.instance.revision)
              || value.instance.generation < 0 || value.instance.revision < 0
              || !['RUNNING', 'STOPPED'].includes(value.instance.desiredState)
              || (value.instance.generation > 0 && !value.session)
              || (value.session && (value.session.instanceId !== instanceId || value.session.generation !== value.instance.generation || !Object.prototype.hasOwnProperty.call(phase, value.session.status)
                || (value.instance.activeSessionId !== null && value.instance.activeSessionId !== value.session.sessionId)))) {
              throw new Error('模拟状态事件与当前实例不匹配');
            }
            setSnapshot(previous => {
              if (previous?.key === key) {
                const before = previous.value;
                // 注册后的初始快照可能比队列中的通知更新，拒绝旧代次、旧修订及阶段倒退。
                if (value.instance.generation < before.instance.generation || value.instance.revision < before.instance.revision
                  || (value.instance.generation === before.instance.generation && value.instance.revision === before.instance.revision
                    && before.session && value.session && phase[value.session.status] < phase[before.session.status])) return previous;
              }
              return { key, value };
            });
            hasSnapshot = true; failures = 0;
            setConnection({ key, synced: true, status: '已连接' });
          } else if (event.event === 'log') {
            if (event.id && cursor.current.key === key && event.id === cursor.current.id) return;
            if (event.id) cursor.current = { key, id: event.id };
            // 暂停只丢弃后续日志显示，状态事件仍然持续消费，不创建第二条连接。
            if (pausedRef.current) return;
            const match = /^(\d{13}) ([\s\S]*)$/.exec(event.data);
            pending.push(match ? `${formatDateTime(Number(match[1]))} ${match[2]}` : event.data);
            if (pending.length >= 100) flush();
          }
        } });
        try {
          while (!controller.signal.aborted) {
            const chunk = await reader.read();
            if (chunk.done) break;
            parser.feed(decoder.decode(chunk.value, { stream: true }));
          }
          parser.feed(decoder.decode()); flush();
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
        if (!hasSnapshot) throw new Error('模拟事件流未返回当前状态');
      } catch (error) {
        if (controller.signal.aborted) return;
        failures++;
        setConnection({ key, synced: false, status: error instanceof Error ? error.message : '模拟事件连接失败', error });
        if (error instanceof OpenPlatformApiError && [401, 403, 404].includes(error.status ?? 0)) return;
      }
      if (!controller.signal.aborted) {
        setConnection(previous => ({ ...previous, synced: false, status: '正在重新连接…' }));
        timer = setTimeout(() => void connect(), Math.min(1000 * 2 ** Math.min(failures, 4), 15000));
      }
    }
    void connect();
    return () => { controller.abort(); clearInterval(flushing); clearTimeout(timer); };
  }, [projectId, instanceId, allowed, key, attempt]);

  return {
    state: snapshot?.key === key ? snapshot.value : undefined,
    lines: output.key === key ? output.lines : [],
    synced: allowed && connection.key === key && connection.synced,
    status: connection.key === key ? connection.status : '等待连接',
    error: connection.key === key ? connection.error : undefined,
    allowed, paused,
    togglePaused: () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); },
    clear: () => setOutput({ key, lines: [] }),
    reconnect: () => { setConnection(previous => ({ key, synced: false, status: '正在重新连接…', error: previous.key === key ? previous.error : undefined })); setAttempt(value => value + 1); },
  };
}

export type SimulationEvents = ReturnType<typeof useSimulationEvents>;
