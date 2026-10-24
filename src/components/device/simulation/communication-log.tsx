import { Fragment, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SimulationEvents } from './use-simulation-events';

const logKinds = {
  send: { label: 'TX', color: 'text-cyan-800 dark:text-cyan-300' },
  receive: { label: 'RX', color: 'text-emerald-800 dark:text-emerald-300' },
  acknowledgement: { label: 'ACK', color: 'text-violet-700 dark:text-violet-300' },
  connection: { label: 'CONN', color: 'text-blue-700 dark:text-blue-300' },
  warning: { label: 'WARN', color: 'text-amber-800 dark:text-amber-300' },
  error: { label: 'ERR', color: 'text-red-700 dark:text-red-400' },
  other: { label: 'OTHER', color: 'text-zinc-700 dark:text-zinc-300' },
};

function getLogKind(tag: string): keyof typeof logKinds {
  const tokens = tag.split(/[ _-]+/);
  if (tokens.some(token => ['ERROR', 'FAIL', 'FAILED', 'FAILURE', 'FATAL'].includes(token))) return 'error';
  if (tokens.some(token => ['WARN', 'WARNING', 'DISCONNECT', 'DISCONNECTED', 'CLOSED'].includes(token))) return 'warning';
  if (tokens.some(token => ['ACK', 'CONNACK', 'PUBACK', 'PUBREC', 'PUBREL', 'PUBCOMP', 'SUBACK', 'UNSUBACK'].includes(token))) return 'acknowledgement';
  if (tokens.some(token => ['TX', 'SUBSCRIBE', 'UNSUBSCRIBE'].includes(token))) return 'send';
  if (tokens.includes('RX')) return 'receive';
  if (tokens.some(token => ['CONNECT', 'CONNECTED', 'CONNECTING', 'RECONNECT', 'RECONNECTING'].includes(token))) return 'connection';
  return 'other';
}

function LogEntry({ line }: { line: string }) {
  // Only inspect the header; tags appearing inside a payload must not change its category.
  const header = /^([^\r\n[]*(?:\[session=[^\]\r\n]*\]\s*)?)\[([A-Z][A-Z0-9 _-]*)\]/.exec(line);
  if (!header) return <span className={logKinds.other.color}>{line}</span>;
  const prefix = header[1];
  const tag = `[${header[2]}]`;
  return <span className={logKinds[getLogKind(header[2])].color}><span className="text-zinc-500 dark:text-zinc-400">{prefix}</span><span className="font-semibold">{tag}</span>{line.slice(header[0].length)}</span>;
}

export default function CommunicationLog({ instanceId, events, visible = true }: { instanceId?: string; events?: SimulationEvents; visible?: boolean }) {
  const [follow, setFollow] = useState(true);
  const viewport = useRef<HTMLPreElement>(null);
  const lines = events?.lines;
  useEffect(() => { if (visible && follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [lines, follow, visible]);
  return <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-label="MQTT通讯终端">
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <h3 className="shrink-0 text-sm font-medium">通讯日志</h3>
        <ul aria-label="Log color legend" className="m-0 flex min-w-0 list-none flex-wrap gap-x-2 gap-y-1 rounded bg-muted/50 dark:bg-zinc-950 px-2 py-1 font-mono text-[10px] leading-4">
          {Object.entries(logKinds).map(([kind, { label, color }]) => <li key={kind} className={cn('flex items-center gap-1 whitespace-nowrap', color)}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{label}</li>)}
        </ul>
      </div>
      <div className="ml-auto flex items-center gap-1"><Button size="sm" variant="ghost" disabled={!instanceId || !events?.allowed} onClick={events?.togglePaused}>{events?.paused ? '继续显示' : '暂停显示'}</Button><Button size="sm" variant="ghost" onClick={events?.clear}>清屏</Button><Button size="sm" variant="ghost" disabled={!instanceId || !events?.allowed} onClick={events?.reconnect}>重连</Button></div>
    </header>
    <pre ref={viewport} tabIndex={0} aria-label="MQTT原始通讯日志" onScroll={event => { const node = event.currentTarget; if (visible && node.scrollHeight - node.scrollTop - node.clientHeight > 40) setFollow(false); }} className="m-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all bg-muted/20 dark:bg-black p-3 font-mono text-xs leading-5 text-zinc-700 dark:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">{lines?.length ? lines.map((line, index) => <Fragment key={index}>{index > 0 && '\n\n'}<LogEntry line={line} /></Fragment>) : !instanceId ? '开启设备模拟后，连接状态和 MQTT 原始收发报文将在这里显示。' : !events?.allowed ? '没有查看设备日志的权限。' : '等待设备通讯日志…'}</pre>
    <footer className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground"><span role="status">{!instanceId ? '未启动' : !events?.allowed ? '无权限' : events.paused ? '日志显示已暂停，模拟状态继续同步' : events.status}</span><label className="flex items-center gap-2"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} />自动滚动</label></footer>
  </section>;
}
