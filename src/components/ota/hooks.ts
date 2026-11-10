import { useState, useRef } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { otaRequest, query, type Page } from '@/api/ota/client';
export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function run(action: () => Promise<unknown>, success?: string) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
export function usePage<T>(projectId: string, path: string | null, refreshInterval = 0) {
  const [position, setPosition] = useState({ path, cursors: [''] });
  const cursors = position.path === path ? position.cursors : [''];
  const cursor = cursors[cursors.length - 1];
  const url = path
    ? path +
      (path.includes('?') ? '&' : '?') +
      new URLSearchParams({ pageSize: '20', ...(cursor ? { cursor } : {}) })
    : null;
  const resource = useSWR(
    url ? [projectId, 'ota', url] : null,
    () => otaRequest<Page<T>>(projectId, url!),
    { refreshInterval, shouldRetryOnError: false },
  );
  const pagerProps = {
    busy: resource.isValidating,
    previous:
      cursors.length > 1 ? () => setPosition({ path, cursors: cursors.slice(0, -1) }) : undefined,
    next:
      resource.data?.hasMore && resource.data.nextCursor
        ? () => setPosition({ path, cursors: [...cursors, resource.data!.nextCursor!] })
        : undefined,
  };
  return {
    ...resource,
    rows: resource.data?.items ?? [],
    hasPrevious: cursors.length > 1,
    resetPage: () => setPosition({ path, cursors: [''] }),
    pagerProps,
  };
}
export const by = (path: string, values: Record<string, string | number | undefined>) =>
  path + query(values);
