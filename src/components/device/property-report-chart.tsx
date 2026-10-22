import { formatDateTime } from '@/lib/date-time';
import { useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, Pie, PieChart, ReferenceArea, XAxis, YAxis } from 'recharts';
import { type CursorPage, type DeviceDetail } from '@/api/device/client';
import { propertyChartPage, type PropertyReport } from '@/api/device/telemetry';
import type { ThingModelProperty } from '@/types/apps/open-platform';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { schemaObject, schemaType } from './command-schema';
import { CommandSelect } from './command-select';

const distributionColors = ['#3b82f6', '#f59e0b', '#14b8a6', '#a78bfa', '#f472b6', '#84cc16', '#06b6d4', '#fb923c', '#818cf8', '#f43f5e', '#94a3b8'];
const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 });
const timeLabel = (timestamp: number, withSeconds: boolean) => new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' as const } : {}) });
const stateLabel = (value: unknown) => typeof value === 'boolean' ? value ? '开启 (true)' : '关闭 (false)' : String(value);

export function PropertyReportChart({ projectId, device, property, from, to, revision, onSelectRange }: {
  projectId: string; device: DeviceDetail; property: ThingModelProperty; from: number; to: number; revision: number; onSelectRange: (from: number, to: number) => void;
}) {
  const [view, setView] = useState('auto');
  const dragStart = useRef<number | null>(null);
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null);
  function applyRange(start: number, end: number) {
    // Keep the form and API on the same second boundaries; the exclusive end
    // includes every report in the last selected second, including duplicates.
    const selectedFrom = Math.max(from, Math.floor(Math.min(start, end) / 1000) * 1000);
    const selectedTo = Math.min(to, Math.floor(Math.max(start, end) / 1000) * 1000 + 1000);
    if (selectedTo > selectedFrom && (selectedFrom !== from || selectedTo !== to)) onSelectRange(selectedFrom, selectedTo);
  }
  const schema = schemaObject(property.schema);
  const type = schemaType(property.schema);
  const enumValues = Array.isArray(schema.enum) ? schema.enum : null;
  const categorical = !!enumValues || type === 'boolean' || type === 'string';
  const numeric = !enumValues && ['integer', 'number'].includes(type);
  const supported = numeric || categorical;
  const data = useResource<CursorPage<PropertyReport>>(supported ? JSON.stringify([device.deviceId, property.code, from, to, revision]) : null, 'device:view',
    () => propertyChartPage(projectId, device, property.code, from, to), `device-property-chart:${projectId}`);
  // Keep chart data stable while the highlighted draft selection changes.
  const { validRows, states, points, distribution, displayDistribution } = useMemo(() => {
    const rows = [...(data.data?.items ?? [])].sort((a, b) => a.timestamp - b.timestamp || a.recordKey.localeCompare(b.recordKey));
    const validValue = (value: unknown) => enumValues ? enumValues.some(item => Object.is(item, value)) : numeric ? typeof value === 'number' && Number.isFinite(value) : type === 'boolean' ? typeof value === 'boolean' : typeof value === 'string';
    const validRows = rows.filter(row => validValue(row.properties[property.code]));
    const states: unknown[] = type === 'boolean' && !enumValues ? [false, true] : enumValues ?? [...new Set(validRows.map(row => row.properties[property.code]))];
    const points = rows.map(row => {
      const value = row.properties[property.code];
      return { timestamp: row.timestamp, value: !validValue(value) ? null : numeric ? value as number : states.findIndex(state => Object.is(state, value)) };
    });
    const counts = new Map<unknown, number>();
    validRows.forEach(row => { const value = row.properties[property.code]; counts.set(value, (counts.get(value) ?? 0) + 1); });
    const distribution = [...counts].map(([value, count]) => ({ state: stateLabel(value), count })).sort((a, b) => b.count - a.count);
    const displayDistribution = distribution.length <= 10 ? distribution : [...distribution.slice(0, 10), { state: `其余 ${distribution.length - 10} 种值（合计）`, count: distribution.slice(10).reduce((sum, item) => sum + item.count, 0) }];
    return { validRows, states, points, distribution, displayDistribution: displayDistribution.map((item, index) => ({ ...item, fill: distributionColors[index % distributionColors.length] })) };
  }, [data.data?.items, enumValues, numeric, property.code, type]);
  const unit = typeof schema.unit === 'string' ? schema.unit : '';
  const chartOptions = numeric ? [
    { value: 'line', label: '折线趋势图' }, { value: 'area', label: '面积趋势图' }, { value: 'columns', label: '数值柱状图' },
  ] : [
    ...((type === 'boolean' || !!enumValues) && states.length <= 12 ? [{ value: 'step', label: '状态阶梯图' }] : []),
    { value: 'distribution', label: '次数柱状图' }, { value: 'donut', label: '次数占比环形图' },
  ];
  const selectedView = chartOptions.some(item => item.value === view) ? view : chartOptions[0].value;
  const distributionView = selectedView === 'distribution' || selectedView === 'donut';
  const title = chartOptions.find(item => item.value === selectedView)?.label;
  const TimeChart = selectedView === 'area' ? AreaChart : selectedView === 'columns' ? BarChart : LineChart;
  return <div className="min-w-0 space-y-3 rounded-md border p-3" aria-label="单属性图表">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">{property.title} <span className="font-mono text-xs text-muted-foreground">{property.code}</span> · {supported ? title : '属性详情'}</h4>
      {supported && <CommandSelect label="图表类型" className="w-40" value={selectedView} onValueChange={value => { setView(value); setSelection(null); dragStart.current = null; }} options={chartOptions} placeholder="图表类型" />}
    </div>
    {!supported ? <p className="text-xs text-muted-foreground">对象、数组或复杂类型请在下方表格查看详情与 JSON，不转换成数值绘图。</p> : <>
      {data.isLoading && <Loading />}<ErrorNotice error={data.error} retry={() => data.mutate()} />
      {!data.isLoading && !data.error && !validRows.length && <p className="py-6 text-center text-xs text-muted-foreground">此范围内没有可绘制的有效值，请调整时间或等待设备上报。</p>}
      {!data.error && !!validRows.length && <>
        {data.data?.hasMore && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">当前图表仅含最新 1,000 条，不是整个时间范围的完整统计；请缩小时间范围查看更早的数据。</p>}
        {selectedView === 'donut' ? <div className="grid min-w-0 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ChartContainer config={{ count: { label: '上报次数' } }} className="h-64! w-full aspect-auto" role="img" aria-label={`${property.title}上报次数占比环形图`}>
            <PieChart accessibilityLayer><ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value, _, item) => <div className="flex items-center gap-3"><span>{item.payload.state}</span><span className="font-mono">{Number(value).toLocaleString()} 次 · {(Number(value) / validRows.length * 100).toFixed(1)}%</span></div>} />} /><Pie data={displayDistribution} dataKey="count" nameKey="state" innerRadius="55%" outerRadius="85%" paddingAngle={displayDistribution.length > 1 ? 2 : 0} stroke="var(--color-background)" isAnimationActive={false} /></PieChart>
          </ChartContainer>
          <ul className="max-h-64 min-w-0 space-y-2 overflow-auto text-xs" aria-label="上报次数占比分布">{displayDistribution.map(item => <li key={item.state} className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} /><span className="min-w-0 flex-1 truncate" title={item.state}>{item.state}</span><span className="shrink-0 tabular-nums text-muted-foreground">{item.count} 次 · {(item.count / validRows.length * 100).toFixed(1)}%</span></li>)}</ul>
        </div> : distributionView ? <ChartContainer config={{ count: { label: '上报次数', color: 'var(--color-blue-500)' } }} className="h-64! w-full aspect-auto" role="img" aria-label={`${property.title}上报次数柱状图`}>
          <BarChart data={displayDistribution} layout="vertical" margin={{ left: 4, right: 32 }} accessibilityLayer><CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="state" width={130} tickFormatter={value => String(value).length > 15 ? `${String(value).slice(0, 15)}…` : String(value)} /><ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload?.state} />} /><Bar dataKey="count" fill="var(--color-count)" radius={3} maxBarSize={24} isAnimationActive={false}><LabelList dataKey="count" position="right" className="fill-foreground text-xs" /></Bar></BarChart>
        </ChartContainer> : <ChartContainer config={{ value: { label: `${property.title}${unit ? ` (${unit})` : ''}`, color: 'var(--color-blue-500)' } }} className="h-64! w-full cursor-crosshair select-none aspect-auto" role="img" aria-label={`${property.title}${title}`}>
          <TimeChart data={points} onMouseDown={event => {
            const timestamp = Number(event.activeLabel);
            if (event.activeLabel !== undefined && Number.isFinite(timestamp)) { dragStart.current = timestamp; setSelection({ from: timestamp, to: timestamp }); }
          }} onMouseMove={event => {
            const timestamp = Number(event.activeLabel);
            if (dragStart.current !== null && event.activeLabel !== undefined && Number.isFinite(timestamp)) setSelection({ from: dragStart.current, to: timestamp });
          }} onMouseUp={event => {
            const start = dragStart.current;
            const end = event.activeLabel !== undefined ? Number(event.activeLabel) : selection?.to;
            dragStart.current = null;
            if (start !== null && end !== undefined && Number.isFinite(end) && start !== end) setSelection({ from: Math.min(start, end), to: Math.max(start, end) });
            else setSelection(null);
          }} onMouseLeave={() => { dragStart.current = null; }} margin={{ left: 4, right: 20, top: 8 }} accessibilityLayer><CartesianGrid vertical={false} /><XAxis type="number" dataKey="timestamp" scale="time" padding={{ left: 12, right: 12 }} domain={['dataMin', 'dataMax']} tickFormatter={value => timeLabel(Number(value), to - from <= 3600000)} minTickGap={65} /><YAxis width={70} allowDecimals={numeric && type !== 'integer'} domain={numeric ? selectedView === 'columns' || selectedView === 'area' ? [dataMin => Math.min(0, dataMin), dataMax => Math.max(0, dataMax)] : ['auto', 'auto'] : [0, Math.max(1, states.length - 1)]} ticks={numeric ? undefined : states.map((_, index) => index)} tickFormatter={value => numeric ? numberFormat.format(Number(value)) : stateLabel(states[Number(value)])} /><ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => formatDateTime(Number(payload[0]?.payload?.timestamp))} formatter={value => <span>{numeric ? `${numberFormat.format(Number(value))}${unit}` : stateLabel(states[Number(value)])}</span>} />} />{selectedView === 'area' ? <Area dataKey="value" type="linear" connectNulls={false} stroke="var(--color-value)" strokeWidth={2} fill="var(--color-value)" fillOpacity={0.18} dot={validRows.length <= 30 ? { r: 2.5 } : false} isAnimationActive={false} /> : selectedView === 'columns' ? <Bar dataKey="value" fill="var(--color-value)" maxBarSize={24} radius={[3, 3, 0, 0]} isAnimationActive={false} /> : <Line dataKey="value" type={numeric ? 'linear' : 'stepAfter'} connectNulls={false} stroke="var(--color-value)" strokeWidth={2} dot={validRows.length <= 30 ? { r: 2.5 } : false} activeDot={{ r: 4 }} isAnimationActive={false} />}
            {selection && <ReferenceArea x1={Math.min(selection.from, selection.to)} x2={Math.max(selection.from, selection.to)} fill="var(--color-blue-500)" fillOpacity={0.22} stroke="var(--color-blue-400)" strokeOpacity={0.7} />}
          </TimeChart>
        </ChartContainer>}
        {!distributionView && selection && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-500/25 bg-blue-500/5 px-3 py-2" role="status">
          <p className="text-xs"><span className="font-medium text-blue-700 dark:text-blue-300">待确认选区</span><span className="ml-2 text-muted-foreground">{formatDateTime(Math.max(from, Math.floor(Math.min(selection.from, selection.to) / 1000) * 1000))} — {formatDateTime(Math.min(to, Math.floor(Math.max(selection.from, selection.to) / 1000) * 1000 + 1000))}</span></p>
          <div className="flex shrink-0 gap-2"><Button size="sm" variant="ghost" onClick={() => setSelection(null)}>取消选区</Button><Button size="sm" onClick={() => applyRange(selection.from, selection.to)}>确认筛选</Button></div>
        </div>}
        {distributionView && distribution.length > 10 && <p className="text-xs text-muted-foreground">展示出现次数最多的 10 种值，其余值合并统计；精确内容请查看下方记录。</p>}
      </>}
    </>}
  </div>;
}
