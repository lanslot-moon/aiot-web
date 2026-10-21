import type { StreamStatus } from '@/hooks/use-command-records';
import { cn } from '@/lib/utils';

const states: Record<StreamStatus, { label: string; light: string }> = {
  live: {
    label: '设备响应已连接',
    light: 'bg-emerald-500 ring-emerald-500/15 shadow-[0_0_6px_1px_var(--color-emerald-500)]',
  },
  connecting: {
    label: '正在连接设备响应',
    light: 'bg-amber-500 ring-amber-500/15 motion-safe:animate-pulse',
  },
  reconnecting: {
    label: '设备响应正在重连',
    light: 'bg-amber-500 ring-amber-500/15 motion-safe:animate-pulse',
  },
  blocked: {
    label: '实时连接已停止',
    light: 'bg-rose-500 ring-rose-500/15',
  },
  paused: {
    label: '后台已暂停',
    light: 'bg-muted-foreground/60 ring-muted-foreground/10',
  },
};

export function CommandConnectionStatus({ status }: { status: StreamStatus }) {
  const state = states[status];
  return <span role="status" aria-live="polite" className="ml-auto inline-flex items-center gap-2.5 px-2 text-xs text-muted-foreground">
    <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full ring-[3px] transition-colors duration-300', state.light)} />
    {state.label}
  </span>;
}
