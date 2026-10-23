import { formatDateTime } from '@/lib/date-time';
import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { type DeviceDetail } from '@/api/device/client';
import { reportStreamPage, reportTimestamp, reportMessageId, type ReportRow, type ReportStreamCursor, type ReportStreamQuery, type ReportStreamPage } from '@/api/device/telemetry';
import type { ThingModelDefinition } from '@/types/apps/open-platform';
import { telemetryProperties } from '@/api/device/telemetry-model';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommandSelect } from './command-select';
import { PropertyReportChart } from './property-report-chart';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return `${value.length} 项数组`;
  if (typeof value === 'object') return `${Object.keys(value).length} 个字段`;
  return String(value);
}

function reportFields(value: unknown, schema: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return formatReportValue(value);
  const properties = schema && typeof schema === 'object' && 'properties' in schema ? schema.properties : null;
  const entries = Object.entries(value);
  if (!entries.length) return <span className="text-muted-foreground">暂无上报内容</span>;
  return <p className="min-w-0 flex-1 truncate text-xs leading-5">{entries.map(([key, item], index) => {
    const field = properties && typeof properties === 'object' ? (properties as Record<string, unknown>)[key] : null;
    const label = field && typeof field === 'object' && 'title' in field && typeof field.title === 'string' ? field.title : key;
    return <span key={key}>{index > 0 && <span className="mx-2 text-muted-foreground">·</span>}<span className="text-muted-foreground">{label}：</span><span className="font-medium tabular-nums">{formatReportValue(item)}</span></span>;
  })}</p>;
}

const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

function localDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function ReportRecords({ projectId, device, model }: { projectId: string; device: DeviceDetail; model: ThingModelDefinition }) {
  const properties = telemetryProperties(model.properties);
  const [initialRange] = useState(() => { const to = Math.floor(Date.now() / 1000) * 1000; return { from: to - 3600000, to }; });
  const [kind, setKind] = useState<ReportStreamQuery['kind']>('all');
  const [propertyCode, setPropertyCode] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [chartPropertyCode, setChartPropertyCode] = useState('');
  const [chartExpanded, setChartExpanded] = useState(false);
  const [chartOriginalRange, setChartOriginalRange] = useState<{ from: number; to: number } | null>(null);
  const [preset, setPreset] = useState('1');
  const [appliedPreset, setAppliedPreset] = useState('1');
  const [start, setStart] = useState(() => localDateTime(initialRange.from));
  const [end, setEnd] = useState(() => localDateTime(initialRange.to));
  const [validation, setValidation] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [query, setQuery] = useState<ReportStreamQuery>(() => ({ kind: 'all', propertyCodes: properties.slice(0, 10).map(item => item.code), eventCodes: [], ...initialRange }));
  const [page, setPage] = useState<{ cursor: ReportStreamCursor | null; previous: (ReportStreamCursor | null)[]; revision: number }>({ cursor: null, previous: [], revision: 0 });
  const data = useResource<ReportStreamPage>(JSON.stringify([device.deviceId, query, page.cursor, page.revision]), 'device:view',
    () => reportStreamPage(projectId, device, query, page.cursor), `device-reports:${projectId}`);
  const propertySchema = { properties: Object.fromEntries(properties.map(item => [item.code, { title: item.title }])) };
  function resetPage() { setPage(previous => ({ cursor: null, previous: [], revision: previous.revision + 1 })); }
  function applyQuery() {
    const to = preset === 'custom' ? new Date(end).getTime() : Math.floor(Date.now() / 1000) * 1000;
    const from = preset === 'custom' ? new Date(start).getTime() : to - Number(preset) * 3600000;
    if (!start || !end || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from) {
      setValidation('请选择有效的开始和结束时间，结束时间须晚于开始时间。'); return;
    }
    if (to - from > MAX_RANGE_MS) { setValidation('查询跨度最多七天，请缩小时间范围。'); return; }
    setValidation(''); setAppliedPreset(preset); setStart(localDateTime(from)); setEnd(localDateTime(to));
    setChartExpanded(false); setChartOriginalRange(null);
    setChartPropertyCode(kind !== 'event' ? propertyCode : '');
    setQuery({ kind, propertyCodes: propertyCode ? [propertyCode] : properties.slice(0, 10).map(item => item.code), eventCodes: eventCode ? [eventCode] : [], from, to });
    resetPage();
  }
  function resetFilters() {
    const to = Math.floor(Date.now() / 1000) * 1000;
    const from = to - 3600000;
    setKind('all'); setPropertyCode(''); setEventCode('');
    setPreset('1'); setAppliedPreset('1'); setStart(localDateTime(from)); setEnd(localDateTime(to));
    setValidation(''); setChartPropertyCode(''); setChartExpanded(false); setChartOriginalRange(null); setSelectedReport(null);
    setQuery({ kind: 'all', propertyCodes: properties.slice(0, 10).map(item => item.code), eventCodes: [], from, to });
    resetPage();
  }
  function refreshQuery() {
    if (appliedPreset !== 'custom') {
      const to = Math.floor(Date.now() / 1000) * 1000;
      const from = to - Number(appliedPreset) * 3600000;
      setQuery(previous => ({ ...previous, from, to }));
      if (start === localDateTime(query.from) && end === localDateTime(query.to)) { setStart(localDateTime(from)); setEnd(localDateTime(to)); }
    }
    resetPage();
  }
  function filterChartRange(from: number, to: number) {
    if (!chartOriginalRange) setChartOriginalRange({ from: query.from, to: query.to });
    setQuery(previous => ({ ...previous, from, to }));
    setStart(localDateTime(from)); setEnd(localDateTime(to)); setPreset('custom'); setAppliedPreset('custom'); setValidation('');
    resetPage();
  }
  function restoreChartRange() {
    if (!chartOriginalRange) return;
    const { from, to } = chartOriginalRange;
    setQuery(previous => ({ ...previous, from, to }));
    setStart(localDateTime(from)); setEnd(localDateTime(to)); setPreset('custom'); setAppliedPreset('custom');
    setChartOriginalRange(null); resetPage();
  }
  const chartProperty = chartPropertyCode && query.kind !== 'event' && query.propertyCodes.length === 1 ? properties.find(item => item.code === chartPropertyCode) : undefined;
  const defaultPropertyLabel = properties.length > 10 ? '默认属性（前 10 项）' : '全部属性';
  return <section className="min-w-0 rounded-lg border" aria-label="设备上报记录">
    <header className="space-y-3 border-b p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">设备上报记录</h3><p className="mt-1 text-xs text-muted-foreground">属性与事件按上报时间倒序展示，与指令 ACK 独立。筛选单个属性可查看图表，调整筛选后点击查询。</p></div><Button variant="outline" size="sm" disabled={data.isValidating} onClick={refreshQuery}><RefreshCw className="size-3.5" />刷新记录</Button></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label className="text-xs">上报类型</Label><CommandSelect label="上报类型" className="w-32" value={kind} onValueChange={value => setKind(value as ReportStreamQuery['kind'])} options={[{ value: 'all', label: '全部上报' }, { value: 'property', label: '属性上报' }, { value: 'event', label: '事件上报' }]} placeholder="上报类型" /></div>
        {kind !== 'event' && <div className="space-y-1"><Label className="text-xs">属性筛选</Label><CommandSelect label="属性筛选" className="w-48" value={propertyCode || 'ALL'} onValueChange={value => setPropertyCode(value === 'ALL' ? '' : value)} options={[{ value: 'ALL', label: defaultPropertyLabel }, ...properties.map(item => ({ value: item.code, label: `${item.title} · ${item.code}` }))]} placeholder="选择属性" /></div>}
        {kind !== 'property' && <div className="space-y-1"><Label className="text-xs">事件筛选</Label><CommandSelect label="事件筛选" className="w-48" value={eventCode || 'ALL'} onValueChange={value => setEventCode(value === 'ALL' ? '' : value)} options={[{ value: 'ALL', label: '全部事件' }, ...model.events.map(item => ({ value: item.code, label: `${item.title} · ${item.code}` }))]} placeholder="选择事件" /></div>}
        <div className="space-y-1"><Label className="text-xs">快捷时间</Label><CommandSelect label="快捷时间" className="w-32" value={preset} onValueChange={value => {
          setPreset(value); setValidation('');
          if (value !== 'custom') { const to = Math.floor(Date.now() / 1000) * 1000; setStart(localDateTime(to - Number(value) * 3600000)); setEnd(localDateTime(to)); }
        }} options={[{ value: '1', label: '最近 1 小时' }, { value: '24', label: '最近 24 小时' }, { value: '168', label: '最近七天' }, { value: 'custom', label: '自定义时间' }]} placeholder="时间范围" /></div>
        <div className="space-y-1"><Label htmlFor="report-start" className="text-xs">开始时间</Label><Input id="report-start" className="h-9 w-56" type="datetime-local" step="1" value={start} onInput={event => { setStart(event.currentTarget.value); setPreset('custom'); setValidation(''); }} aria-invalid={!!validation} /></div>
        <div className="space-y-1"><Label htmlFor="report-end" className="text-xs">结束时间</Label><Input id="report-end" className="h-9 w-56" type="datetime-local" step="1" value={end} onInput={event => { setEnd(event.currentTarget.value); setPreset('custom'); setValidation(''); }} aria-invalid={!!validation} /></div>
        <Button size="sm" disabled={data.isValidating} onClick={applyQuery}>查询</Button>
        <Button size="sm" variant="outline" disabled={data.isValidating} onClick={resetFilters}>重置</Button>
      </div>
      {validation && <p role="alert" className="text-xs text-destructive">{validation}</p>}
    </header>
    <div className="space-y-3 p-4">
      {query.kind !== 'event' && query.propertyCodes.length === Math.min(10, properties.length) && properties.length > 10 && <p role="status" className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">此设备共 {properties.length} 个遥测字段，默认仅查询前 10 个字段。其余字段请通过「属性筛选」单独查看。</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">当前结果：{query.kind === 'all' ? '全部上报' : query.kind === 'property' ? '属性上报' : '事件上报'} · {formatDateTime(query.from)} — {formatDateTime(query.to)}</p>
        {chartProperty && <div className="flex shrink-0 items-center gap-2">{chartOriginalRange && <Button size="sm" variant="ghost" onClick={restoreChartRange}>返回原时间范围</Button>}<Button size="sm" variant="outline" aria-expanded={chartExpanded} aria-controls="property-report-chart" onClick={() => setChartExpanded(previous => !previous)}>{chartExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}{chartExpanded ? '收起属性图表' : '展开属性图表'}</Button></div>}
      </div>
      {chartProperty && chartExpanded && <div id="property-report-chart"><PropertyReportChart key={`${chartProperty.code}:${query.from}:${query.to}:${page.revision}`} projectId={projectId} device={device} property={chartProperty} from={query.from} to={query.to} revision={page.revision} onSelectRange={filterChartRange} /></div>}
      {data.isLoading && <Loading />}<ErrorNotice error={data.error} retry={() => data.mutate()} />
      {!data.isLoading && !data.error && !data.data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">此范围内暂无上报记录，请调整筛选或在设备上报后刷新。</p>}
      {!data.error && !!data.data?.items.length && <div className="[&_table]:min-w-[60rem] [&_table]:table-fixed [&_th:nth-child(1)]:w-44 [&_th:nth-child(2)]:w-24 [&_th:nth-child(3)]:w-76"><GatewayDataTable<ReportRow> rows={data.data.items} columns={[
        { label: '上报时间', render: row => <time className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(reportTimestamp(row))}</time> },
        { label: '类型', render: row => <Badge variant="outline" className={row.kind === 'property' ? 'border-blue-200 bg-blue-50 text-blue-700! dark:border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-300!' : 'border-amber-200 bg-amber-50 text-amber-800! dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-300!'}>{row.kind === 'property' ? '属性上报' : '事件上报'}</Badge> },
        { label: 'Message ID', render: row => { const messageId = reportMessageId(row); return <div className="flex items-center gap-1"><code className="whitespace-nowrap font-mono text-xs">{messageId}</code><CopyIdButton value={messageId} label="Message ID" /></div>; } },
        { label: '上报内容', render: row => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0 flex-1 overflow-hidden text-xs leading-5">{row.kind === 'property' ? reportFields(row.data.properties, propertySchema) : <div className="flex min-w-0 items-center gap-2 text-xs leading-5"><p className="max-w-1/2 shrink-0 truncate text-xs font-medium">{model.events.find(item => item.code === row.data.eventCode)?.title ?? row.data.eventCode}<span className="ml-2 font-normal text-muted-foreground">{row.data.eventCode} · {({ INFO: '信息', WARN: '告警', ERROR: '故障' }[row.data.eventType] ?? row.data.eventType)}</span></p>{reportFields(row.data.output, model.events.find(item => item.code === row.data.eventCode)?.outputSchema)}</div>}</div><Button variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" aria-label={`查看${row.kind === 'property' ? '属性' : '事件'}上报 JSON ${reportMessageId(row)}`} onClick={() => setSelectedReport(row)}>查看 JSON</Button></div> },
      ]} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">第 {page.previous.length + 1} 页 · 每页最多 20 条上报</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={data.isValidating || !page.previous.length} onClick={() => setPage(previous => ({ ...previous, cursor: previous.previous[previous.previous.length - 1] ?? null, previous: previous.previous.slice(0, -1) }))}>上一页</Button><Button size="sm" variant="outline" disabled={data.isValidating || !!data.error || !data.data?.hasMore} onClick={() => { const next = data.data?.next; if (next) setPage(previous => ({ ...previous, cursor: next, previous: [...previous.previous, previous.cursor] })); }}>下一页</Button></div></div>
    </div>
    <Dialog open={!!selectedReport} onOpenChange={open => { if (!open) setSelectedReport(null); }}>
      <DialogContent className="flex! max-h-[85dvh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader><DialogTitle>{selectedReport?.kind === 'property' ? '属性上报详情' : '事件上报详情'}</DialogTitle><DialogDescription>该条上报记录的接口返回 JSON。</DialogDescription></DialogHeader>
        {selectedReport && <><div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground"><span>{formatDateTime(reportTimestamp(selectedReport))}</span><CopyIdButton value={JSON.stringify(selectedReport.data, null, 2)} label="JSON" /></div><pre tabIndex={0} aria-label="上报记录 JSON" className="min-h-0 overflow-auto rounded-md border bg-muted/20 p-4 font-mono text-xs leading-relaxed">{JSON.stringify(selectedReport.data, null, 2)}</pre></>}
      </DialogContent>
    </Dialog>
  </section>;
}
