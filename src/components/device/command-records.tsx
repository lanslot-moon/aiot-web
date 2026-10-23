import { useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { commandPath, commandRequest, deliveryLabels, executionLabels, type CommandRecord } from '@/api/device/commands';
import { query, type CursorPage } from '@/api/device/client';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime } from '@/lib/date-time';
import { CommandSelect } from './command-select';
import { DeviceTable } from './layout';

const statusColors = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
  purple: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  neutral: 'border-border bg-muted text-muted-foreground',
};
type StatusColor = keyof typeof statusColors;
const deliveryColors: Record<string, StatusColor> = { DISPATCHING: 'blue', BROKER_ACCEPTED: 'green', NOT_SENT: 'neutral', UNKNOWN: 'amber' };
const executionColors: Record<string, StatusColor> = { PENDING: 'amber', SUCCEEDED: 'green', FAILED: 'red', REJECTED: 'red', NOT_EXECUTED: 'neutral' };

function RecordBadge({ color, children }: { color: StatusColor; children: React.ReactNode }) {
  return <Badge variant="outline" className={statusColors[color]}>{children}</Badge>;
}

function localTime(value: number) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function recentRange() {
  const createdTo = Math.floor(Date.now() / 1000) * 1000;
  return { createdFrom: createdTo - 86400000, createdTo };
}

export function CommandRecords({ projectId, deviceId, onDetails }: { projectId: string; deviceId: string; onDetails: (record: CommandRecord) => void }) {
  const [applied, setApplied] = useState(() => ({ ...recentRange(), commandType: '', code: '' }));
  const [commandType, setCommandType] = useState('');
  const [code, setCode] = useState('');
  const [start, setStart] = useState(() => localTime(applied.createdFrom));
  const [end, setEnd] = useState(() => localTime(applied.createdTo));
  const [validation, setValidation] = useState('');
  const [page, setPage] = useState<{ cursor: string | null; previous: (string | null)[] }>({ cursor: null, previous: [] });
  const path = commandPath(deviceId) + '/commands' + query({ ...applied, cursor: page.cursor, pageSize: 20 });
  const data = useResource<CursorPage<CommandRecord>>(path, 'device:view', url => commandRequest(projectId, url), `command-search:${projectId}`);
  function search() {
    const createdFrom = new Date(start).getTime();
    const createdTo = new Date(end).getTime();
    if (!Number.isSafeInteger(createdFrom) || !Number.isSafeInteger(createdTo) || createdFrom < 0 || createdTo <= createdFrom) {
      setValidation('请选择有效的开始和结束时间，结束时间须晚于开始时间。'); return;
    }
    if (createdTo - createdFrom > 7 * 86400000) { setValidation('查询时间跨度最多 7 天。'); return; }
    if (code.trim() && !/^[A-Za-z0-9_:-]{1,128}$/.test(code.trim())) { setValidation('功能编码须为 1 至 128 位字母、数字、下划线、冒号或短横线。'); return; }
    setValidation(''); setPage({ cursor: null, previous: [] });
    const next = { createdFrom, createdTo, commandType, code: code.trim() };
    setApplied(next);
    if (JSON.stringify(next) === JSON.stringify(applied) && page.cursor === null) void data.mutate();
  }
  function reset() {
    const range = recentRange();
    setCommandType(''); setCode(''); setStart(localTime(range.createdFrom)); setEnd(localTime(range.createdTo));
    setValidation(''); setPage({ cursor: null, previous: [] }); setApplied({ ...range, commandType: '', code: '' });
  }
  const nextCursor = data.data?.nextCursor;
  const invalidCursor = !!data.data?.hasMore && (!nextCursor || nextCursor === page.cursor || page.previous.includes(nextCursor));
  return <section className="min-w-0 space-y-4" aria-label="指令记录查询">
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); search(); }}>
      <div className="grid w-32 gap-1.5"><Label htmlFor="command-history-type">指令类型</Label><CommandSelect id="command-history-type" label="指令类型" placeholder="全部指令" className="h-9! w-full" value={commandType || 'ALL'} onValueChange={value => setCommandType(value === 'ALL' ? '' : value)} options={[{ value: 'ALL', label: '全部指令' }, { value: 'PROPERTY', label: '属性控制' }, { value: 'ACTION', label: '动作调用' }]} /></div>
      <div className="grid min-w-36 flex-1 gap-1.5"><Label htmlFor="command-history-code">功能编码</Label><Input className="h-9!" id="command-history-code" placeholder="属性或动作编码" maxLength={128} value={code} onChange={event => setCode(event.target.value)} /></div>
      <div className="grid min-w-0 gap-1.5"><Label htmlFor="command-history-start">开始时间</Label><Input className="h-9!" id="command-history-start" type="datetime-local" step="1" value={start} onChange={event => setStart(event.target.value)} /></div>
      <div className="grid min-w-0 gap-1.5"><Label htmlFor="command-history-end">结束时间</Label><Input className="h-9!" id="command-history-end" type="datetime-local" step="1" value={end} onChange={event => setEnd(event.target.value)} /></div>
      <div className="flex items-center gap-2">
        <Button className="h-9!" type="submit" disabled={data.isValidating}>查询</Button><Button className="h-9!" type="button" variant="outline" disabled={data.isValidating} onClick={reset}>重置</Button>
        <Button className="h-9!" type="button" variant="ghost" disabled={data.isValidating} onClick={() => void data.mutate()}><RefreshCw className="size-3.5" />刷新记录</Button>
      </div>
    </form>
    {validation && <p role="alert" className="text-xs text-destructive">{validation}</p>}
    <p className="text-xs leading-5 text-muted-foreground">当前查询：{formatDateTime(applied.createdFrom)} 至 {formatDateTime(applied.createdTo)}（不含结束时刻） · {applied.commandType === 'PROPERTY' ? '属性控制' : applied.commandType === 'ACTION' ? '动作调用' : '全部指令'}{applied.code && ` · 功能编码 ${applied.code}`}。单次最多 7 天，点击查询应用筛选；刷新可获取最新结果。</p>
    <ErrorNotice error={data.error} retry={() => data.mutate()} />
    {data.isLoading && <Loading />}
    {!data.error && !data.isLoading && <DeviceTable rows={data.data?.items ?? []} columns={[
      { label: '下发时间', render: row => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.createTime)}</span> },
      { label: '指令', render: row => <div className="flex h-8 items-center gap-2"><RecordBadge color={row.commandType === 'PROPERTY' ? 'blue' : 'purple'}>{row.commandType === 'PROPERTY' ? '属性控制' : '动作调用'}</RecordBadge>{row.code && <span className="block max-w-28 truncate font-mono text-xs text-muted-foreground" title={row.code}>{row.code}</span>}</div> },
      { label: '请求编号', render: row => <div className="flex h-8 w-60 items-center gap-2"><span className="block min-w-0 flex-1 truncate font-mono text-xs" title={row.requestId}>{row.requestId}</span><CopyIdButton value={row.requestId} label="请求编号" className="shrink-0 border border-border bg-background hover:bg-muted" /></div> },
      { label: '投递状态', render: row => <RecordBadge color={deliveryColors[row.deliveryStatus] ?? 'neutral'}>{deliveryLabels[row.deliveryStatus] ?? row.deliveryStatus}</RecordBadge> },
      { label: '设备结果', render: row => row.responseStatus === 'TIMED_OUT' ? <RecordBadge color="amber">应答超时 · 结果未确认</RecordBadge> : <div className="flex flex-wrap gap-1.5">{row.responseStatus === 'RECEIVED_LATE' && <RecordBadge color="amber">迟到回复</RecordBadge>}<RecordBadge color={executionColors[row.executionStatus] ?? 'neutral'}>{executionLabels[row.executionStatus] ?? row.executionStatus}</RecordBadge></div> },
      { label: '操作', render: row => <Button type="button" size="sm" variant="outline" className="cursor-pointer whitespace-nowrap" onClick={() => onDetails(row)} aria-label={`查看指令 ${row.requestId} 的详情`}><Eye className="size-3.5" aria-hidden="true" />查看详情</Button> },
    ]} />}
    {invalidCursor && <p role="alert" className="text-xs text-destructive">分页游标异常，请重新查询。</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>第 {page.previous.length + 1} 页 · 每页最多 20 条</span><div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={data.isValidating || !page.previous.length} onClick={() => setPage(previous => ({ cursor: previous.previous[previous.previous.length - 1], previous: previous.previous.slice(0, -1) }))}>上一页</Button>
      <Button size="sm" variant="outline" disabled={data.isValidating || !!data.error || !data.data?.hasMore || invalidCursor} onClick={() => { if (nextCursor) setPage(previous => ({ cursor: nextCursor, previous: [...previous.previous, previous.cursor] })); }}>下一页</Button>
    </div></div>
  </section>;
}
