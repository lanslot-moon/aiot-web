import { useEffect, useRef, useState } from 'react';
import { createParser } from 'eventsource-parser';
import { OpenPlatformApiError, parseResponse, requestResponse } from '@/api/iam/client';
import { simulationPath } from '@/api/device/simulation';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date-time';

export default function CommunicationLog({ projectId, instanceId }: { projectId: string; instanceId?: string }) {
  const { session } = useIam();
  const allowed = usePermission('device:view');
  return <TerminalReader key={`${session?.sessionId}:${projectId}:${instanceId}`} projectId={projectId} instanceId={instanceId} allowed={allowed && !!session} />;
}

function TerminalReader({ projectId, instanceId, allowed }: { projectId: string; instanceId?: string; allowed: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [status, setStatus] = useState('等待连接');
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<string | undefined>(undefined);
  const viewport = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (!instanceId || !allowed || paused) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const pending: string[] = [];
    const flush = () => {
      if (!pending.length || controller.signal.aborted) return;
      const batch = pending.splice(0);
      setLines(previous => {
        const next = [...previous, ...batch];
        let length = next.reduce((total, line) => total + line.length, 0);
        while (next.length > 500 || length > 262144) length -= next.shift()!.length;
        return next;
      });
    };
    const flushing = setInterval(flush, 100);
    async function connect() {
      setStatus(failures ? '正在重新连接…' : '正在连接…');
      try {
        const path = simulationPath(`instances/${encodeURIComponent(instanceId!)}/communication-log/stream`) + (cursor.current ? `?after=${encodeURIComponent(cursor.current)}` : '');
        const response = await requestResponse(path, 'GET', undefined, { projectId, signal: controller.signal, accept: 'text/event-stream' });
        if (!response.ok) await parseResponse(response);
        if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('服务未返回通讯日志流');
        setStatus('已连接'); failures = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createParser({ maxBufferSize: 1048576, onEvent: event => {
          if (event.event !== 'log') return;
          if (event.id && event.id === cursor.current) return;
          if (event.id) cursor.current = event.id;
          const match = /^(\d{13}) ([\s\S]*)$/.exec(event.data);
          pending.push(match ? `${formatDateTime(Number(match[1]))} ${match[2]}` : event.data);
          if (pending.length >= 100) flush();
        } });
        try {
          while (!controller.signal.aborted) {
            const chunk = await reader.read();
            if (chunk.done) break;
            parser.feed(decoder.decode(chunk.value, { stream: true }));
          }
          parser.feed(decoder.decode()); flush();
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      } catch (error) {
        if (controller.signal.aborted) return;
        failures++;
        setStatus(error instanceof Error ? error.message : '日志连接失败');
        if (error instanceof OpenPlatformApiError && [401, 403, 404].includes(error.status ?? 0)) return;
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void connect(), Math.min(1000 * 2 ** Math.min(failures, 4), 15000));
    }
    void connect();
    return () => { flush(); controller.abort(); clearInterval(flushing); clearTimeout(timer); };
  }, [projectId, instanceId, allowed, paused, attempt]);
  useEffect(() => { if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [lines, follow]);
  return <section className="min-w-0 overflow-hidden rounded-md border" aria-label="MQTT通讯终端">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2"><h3 className="text-sm font-medium">通讯日志</h3><div className="flex items-center gap-1"><Button size="sm" variant="ghost" disabled={!instanceId || !allowed} onClick={() => setPaused(value => !value)}>{paused ? '继续' : '暂停'}</Button><Button size="sm" variant="ghost" onClick={() => setLines([])}>清屏</Button><Button size="sm" variant="ghost" disabled={!instanceId || !allowed || paused} onClick={() => setAttempt(value => value + 1)}>重连</Button></div></header>
    <pre ref={viewport} tabIndex={0} aria-label="MQTT原始通讯日志" onScroll={event => { const node = event.currentTarget; if (node.scrollHeight - node.scrollTop - node.clientHeight > 40) setFollow(false); }} className="m-0 h-[520px] overflow-auto whitespace-pre-wrap break-all bg-black p-3 font-mono text-xs leading-5 text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-400">{lines.length ? lines.join('\n\n') : !allowed ? '没有查看设备日志的权限。' : !instanceId ? '开启设备模拟后，连接状态和 MQTT 原始收发报文将在这里显示。' : '等待设备通讯日志…'}</pre>
    <footer className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground"><span role="status">{!instanceId ? '未启动' : !allowed ? '无权限' : paused ? '显示已暂停，设备继续运行' : status}</span><label className="flex items-center gap-2"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} />自动滚动</label></footer>
  </section>;
}
