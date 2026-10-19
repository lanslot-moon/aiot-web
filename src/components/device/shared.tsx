import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { lifecycleLabels, type Lifecycle, type CursorPage } from '@/api/device/client';
import { useDeviceResource } from './use-device-resource';
import { cn } from '@/lib/utils';

export function LifecycleBadge({ value }: { value: Lifecycle }) {
  return <Badge variant="outline" className={cn('whitespace-nowrap', value === 'ACTIVE' && 'border-transparent bg-chart-2/12 text-chart-2')}>{lifecycleLabels[value] ?? value}</Badge>;
}
export function DeviceSelect({ id, label, value, options, onChange }: {
  id?: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  return <Select value={value} onValueChange={v => onChange(v ?? '')}>
    <SelectTrigger id={id} aria-label={label} className="h-9! w-full min-w-0"><SelectValue>{options.find(o => o.value === value)?.label ?? value}</SelectValue></SelectTrigger>
    <SelectContent alignItemWithTrigger={false}>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
  </Select>;
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return <Empty className="rounded-lg border border-dashed"><EmptyHeader><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty>;
}
export function CursorList<T>({ projectId, path, children, emptyTitle = '暂无数据', emptyDescription = '成功查询后没有返回记录。' }: {
  projectId: string; path: string; children: (items: T[], refresh: () => void) => ReactNode;
  emptyTitle?: string; emptyDescription?: string;
}) {
  const [cursors, setCursors] = useState<string[]>(['']);
  const cursor = cursors[cursors.length - 1];
  const resource = useDeviceResource<CursorPage<T>>(projectId, `${path}${path.includes('?') ? '&' : '?'}pageSize=20${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
  return <div className="space-y-3">

    <ErrorNotice error={resource.error} retry={() => resource.mutate()} />
    {resource.isLoading && <Loading />}
    {resource.data && <div aria-busy={resource.isValidating} className="space-y-3">
      {resource.data.items.length ? children(resource.data.items, () => { void resource.mutate(); }) : !resource.error && <EmptyState title={emptyTitle} description={emptyDescription} />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><span className="text-sm text-muted-foreground">第 {cursors.length} 页 · 本页 {resource.data.items.length} 条</span><div className="flex items-center gap-2"><Button size="sm" variant="ghost" disabled={resource.isValidating} onClick={() => void resource.mutate()}><RefreshCw className="size-3.5" />刷新</Button><Button size="sm" variant="outline" disabled={resource.isValidating || cursors.length === 1} onClick={() => setCursors(c => c.slice(0, -1))}>上一页</Button><Button size="sm" variant="outline" disabled={resource.isValidating || !!resource.error || !resource.data.hasMore || !resource.data.nextCursor} onClick={() => setCursors(c => [...c, resource.data!.nextCursor!])}>下一页</Button></div></div>
    </div>}
  </div>;
}
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 border-b py-3 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)]"><dt className="text-xs leading-5 text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-sm leading-5 [overflow-wrap:anywhere]">{children ?? '—'}</dd></div>;
}
