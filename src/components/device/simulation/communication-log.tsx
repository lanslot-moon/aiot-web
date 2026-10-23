import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SimulationEvents } from './use-simulation-events';

export default function CommunicationLog({ instanceId, events, visible = true }: { instanceId?: string; events?: SimulationEvents; visible?: boolean }) {
  const [follow, setFollow] = useState(true);
  const viewport = useRef<HTMLPreElement>(null);
  const lines = events?.lines;
  useEffect(() => { if (visible && follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [lines, follow, visible]);
  return <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-label="MQTT通讯终端">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2"><h3 className="text-sm font-medium">通讯日志</h3><div className="flex items-center gap-1"><Button size="sm" variant="ghost" disabled={!instanceId || !events?.allowed} onClick={events?.togglePaused}>{events?.paused ? '继续显示' : '暂停显示'}</Button><Button size="sm" variant="ghost" onClick={events?.clear}>清屏</Button><Button size="sm" variant="ghost" disabled={!instanceId || !events?.allowed} onClick={events?.reconnect}>重连</Button></div></header>
    <pre ref={viewport} tabIndex={0} aria-label="MQTT原始通讯日志" onScroll={event => { const node = event.currentTarget; if (visible && node.scrollHeight - node.scrollTop - node.clientHeight > 40) setFollow(false); }} className="m-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all bg-black p-3 font-mono text-xs leading-5 text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-400">{lines?.length ? lines.join('\n\n') : !instanceId ? '开启设备模拟后，连接状态和 MQTT 原始收发报文将在这里显示。' : !events?.allowed ? '没有查看设备日志的权限。' : '等待设备通讯日志…'}</pre>
    <footer className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground"><span role="status">{!instanceId ? '未启动' : !events?.allowed ? '无权限' : events.paused ? '日志显示已暂停，模拟状态继续同步' : events.status}</span><label className="flex items-center gap-2"><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} />自动滚动</label></footer>
  </section>;
}
