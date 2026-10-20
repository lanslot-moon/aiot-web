import { useEffect, useRef, useState } from 'react';
import { Braces, History, RefreshCw, Send, Terminal, Trash2, Search, X, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { request } from '@/api/iam/client';
import { type DeviceDetail, formatTime } from '@/api/device/client';
import { commandPath, commandRequest, deliveryLabels, executionLabels, parseCommandInput, type CommandRecord, type CommandSubmission } from '@/api/device/commands';
import type { ThingModelDefinition } from '@/types/apps/open-platform';
import { usePermission } from '@/context/iam-context/identity';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { CommandSelect } from './command-select';
import { CommandExchange } from './command-exchange';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeviceInput, DeviceTable } from './layout';
import { cn } from '@/lib/utils';
import CommandField from './command-fields';
import { CommandControlTheme } from './command-control-theme';
import { canRepresent, fieldError, initialValue, schemaObject, supportsForm } from './command-schema';
import { latestProperties } from '@/api/device/telemetry';
import { ActionControl } from './action-control';
import { ReportRecords } from './report-records';
import { useCommandRecords } from '@/hooks/use-command-records';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);
function JsonBlock({ text }: { text: string | null }) {
  let value = text ?? '—';
  try { value = pretty(JSON.parse(value)); } catch { /* Preserve non-JSON device responses. */ }
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 text-xs font-mono">{value}</pre>;
}

export default function DeviceCommands({ projectId, device }: { projectId: string; device: DeviceDetail }) {
  const allowed = usePermission('device:command');
  const canView = usePermission('device:view');
  const [workspace, setWorkspace] = useState<'control' | 'records' | 'reports'>('control');
  const [mode, setMode] = useState<'properties' | 'actions'>('properties');
  const [functionSearch, setFunctionSearch] = useState('');
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [text, setText] = useState('{}');
  const [retainedValues, setRetainedValues] = useState<Record<string, unknown>>({});
  const [editor, setEditor] = useState<'visual' | 'json'>('visual');
  const [ttl, setTtl] = useState('10');
  const [validation, setValidation] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [sendError, setSendError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<CommandRecord | null>(null);
  const responseList = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const history = useCommandRecords(projectId, device.deviceId, '', canView);
  const records = history.records;
  const liveRecords = records.filter(row => row.createTime >= history.startedAt && (!filter || row.commandType === filter));
  const selectedRecord = selected ? records.find(row => row.requestId === selected.requestId) ?? null : null;
  useEffect(() => {
    const list = responseList.current;
    if (workspace === 'control' && list && followLatest.current) list.scrollTop = list.scrollHeight;
  }, [records, workspace, filter]);
  const model = useResource<ThingModelDefinition | null>(
    `/api/v1/products/${encodeURIComponent(device.productId)}/model/published`, 'product:view',
    path => request(path, 'GET', undefined, { projectId }), `command-model:${projectId}`,
  );
  const properties = model.data?.properties ?? [];
  const writable = properties.filter(item => ['READ_WRITE', 'WRITE_ONLY', 'RW', 'W'].includes(item.access));
  const visibleProperties = showAllProperties ? properties : writable;
  const matchingProperties = visibleProperties.filter(item => `${item.title} ${item.code}`.toLowerCase().includes(functionSearch.trim().toLowerCase()));
  const latest = useResource(model.data && properties.length ? JSON.stringify([device.deviceId, model.data.modelRevision, properties.map(item => item.code)]) : null,
    'device:view', () => latestProperties(projectId, device, properties.map(item => item.code)), `device-latest:${projectId}`);
  function submitted(result: CommandSubmission) {
    if (!result || typeof result.requestId !== 'string' || !result.requestId) throw new Error('提交响应缺少请求编号，请核对指令记录。');
    const message = `已提交 ${result.requestId}，等待设备处理结果。`;
    setNotice(message); toast.message(message); followLatest.current = true;
  }

  const inputSchema = {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(writable.map(item => [item.code, { ...schemaObject(item.schema), title: `${item.title} · ${item.code}` }])),
  };
  let formValue: Record<string, unknown> = {};
  try { formValue = schemaObject(JSON.parse(text)); } catch { /* Invalid JSON stays in the advanced editor. */ }
  const formAvailable = !!model.data && supportsForm(inputSchema);
  function changeEditor(next: 'visual' | 'json') {
    if (next === 'visual') {
      try {
        const value: unknown = JSON.parse(text);
        if (!formAvailable || !canRepresent(inputSchema, value)) throw new Error('当前参数或功能定义无法完整转换为表单，请保留高级模式，避免丢失内容。');
      } catch (error) { setValidation(error instanceof Error ? error.message : '请先修正 JSON。'); return; }
    }
    setValidation(''); setEditor(next);
  }
  const blocked = !allowed ? '当前账号没有下发指令的权限。' : device.lifecycle !== 'ACTIVE' ? '设备已激活且未停用时才能下发指令。' : '';
  const resetHistory = () => { followLatest.current = true; history.refresh(); };
  function validate() {
    try {
      if (editor === 'visual' && Object.keys(formValue).length === 0) throw new Error('请调整属性，或点击属性框选择需要发送的属性。');
      const value = parseCommandInput(text);
      if (editor === 'visual' && !formAvailable) throw new Error('请选择可用功能，或切换高级模式填写参数。');
      if (model.data) {
        const error = fieldError(inputSchema, value);
        if (error) throw new Error(error);
      }
      if (!Number.isFinite(Number(ttl)) || Number(ttl) < 0.001 || Number(ttl) > 30 || !Number.isInteger(Number(ttl) * 1000)) throw new Error('发送有效期须为 0.001 至 30 秒，精确到毫秒。');
      setValidation(''); return value;
    } catch (error) { setValidation(error instanceof Error ? error.message : '请检查输入。'); return null; }
  }
  async function send() {
    if (lock.current || blocked) return;
    const value = validate(); if (!value) return;
    lock.current = true; setBusy(true); setSendError(undefined); setNotice('');
    try {
      const result = await commandRequest<CommandSubmission>(projectId, commandPath(device.deviceId) + '/properties/issue', 'POST', {
        properties: JSON.stringify(value),
        clientToken: crypto.randomUUID(), deliveryTtlMs: Number(ttl) * 1000,
      });
      submitted(result);
      setRetainedValues(previous => ({ ...previous, ...value }));
      setText('{}'); setConfirm(false);
    } catch (error) {
      setSendError(error); setConfirm(false);
      setNotice('本次请求未能确认结果，请先刷新指令记录核对，避免重复执行。'); resetHistory();
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className="min-w-0 space-y-4">
    <nav aria-label="调试工作区" className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 p-1">
      {([{ value: 'control', label: '调试台', icon: SlidersHorizontal }, { value: 'records', label: '指令记录', icon: History }, { value: 'reports', label: '上报记录', icon: History }] as const).map(item => <Button key={item.value} size="sm" variant={workspace === item.value ? 'secondary' : 'ghost'} aria-pressed={workspace === item.value} disabled={busy} onClick={() => { setWorkspace(item.value); if (item.value === 'records' && !history.historyLoaded) history.loadMore(); }}><item.icon className="size-3.5" />{item.label}{item.value === 'records' && records.length > 0 && <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{records.length}</span>}</Button>)}
      <span role="status" className="ml-auto px-2 text-xs text-muted-foreground">{history.status === 'live' ? '设备响应实时连接中' : history.status === 'paused' ? '后台已暂停' : history.status === 'reconnecting' ? '设备响应正在重连' : history.status === 'blocked' ? '实时连接已停止' : '正在连接设备响应'}</span>
    </nav>
    <div hidden={workspace !== 'control'}>
    <div className="grid min-w-0 overflow-hidden rounded-lg border lg:h-[clamp(26rem,calc(100dvh-21rem),46rem)] lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1fr)]">
      <section className="flex min-h-0 min-w-0 flex-col">
        <nav aria-label="物模型调试功能" className="flex gap-1 border-b p-2">
          {([{ value: 'properties', label: '属性调试' }, { value: 'actions', label: '动作调用' }] as const).map(item => <Button key={item.value} size="sm" variant={mode === item.value ? 'secondary' : 'ghost'} aria-pressed={mode === item.value} disabled={busy} onClick={() => setMode(item.value)}>{item.label}</Button>)}
        </nav>
        {mode === 'properties' ? <>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3"><h3 className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal className="size-3.5" />属性控制</h3><Button size="sm" variant="ghost" disabled={busy} onClick={() => changeEditor(editor === 'visual' ? 'json' : 'visual')}><Braces className="size-3.5" />{editor === 'visual' ? 'JSON 编辑' : '可视化控制'}</Button></header>
        <div className="min-h-0 min-w-0 flex-1 lg:overflow-y-auto"><div className="space-y-2 p-3" role="region" aria-label="设备功能操作区">

          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">上报值与本次设置分别显示，不用 ACK 覆盖设备状态。</p><Button size="sm" variant="outline" disabled={latest.isValidating || !properties.length} onClick={() => latest.mutate()}><RefreshCw className="size-3.5" />刷新状态</Button></div>
          <ErrorNotice error={latest.error} retry={() => latest.mutate()} />
          {model.isLoading && <Loading />}
          {model.error && <ErrorNotice error={model.error} retry={() => model.mutate()} />}
          {editor === 'visual' ? model.data ? <CommandControlTheme><div className="grid gap-2 2xl:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2 2xl:col-span-2"><InputGroup className="h-9 min-w-40 flex-1 bg-muted/20"><InputGroupAddon><Search className="size-3.5" /></InputGroupAddon><InputGroupInput aria-label="搜索设备功能" placeholder="搜索功能名称或标识" value={functionSearch} onChange={event => setFunctionSearch(event.target.value)} />{functionSearch && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="清除功能搜索" onClick={() => setFunctionSearch('')}><X className="size-3" /></InputGroupButton></InputGroupAddon>}</InputGroup><Button size="sm" variant={showAllProperties ? 'secondary' : 'outline'} className="shrink-0 text-xs" aria-pressed={showAllProperties} onClick={() => setShowAllProperties(previous => !previous)}>{showAllProperties ? '仅看可下发' : '显示全部属性'}</Button></div>
            {properties.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">此设备尚未定义属性。</p>}
            {matchingProperties.map(item => {
              const changed = Object.prototype.hasOwnProperty.call(formValue, item.code);
              const writableProperty = writable.some(property => property.code === item.code);
              const point = latest.data?.[item.code];
              const recent = <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs leading-5"><div className="flex min-w-0 flex-wrap items-baseline gap-x-2"><span className="text-muted-foreground">最近上报值{!writableProperty ? ' · 只读' : ''}</span><span className="max-w-full break-all font-mono">{latest.error ? '读取失败' : latest.isLoading ? '读取中…' : point?.value === null || point?.value === undefined ? '暂无有效上报值' : typeof point.value === 'object' ? pretty(point.value) : String(point.value)}</span></div><p className="text-muted-foreground">{point?.timestamp ? `上报时间：${formatTime(point.timestamp)}` : '尚无上报时间'}</p></div>;
              if (!writableProperty) return <div key={item.code} className="rounded-md border px-3 py-2"><h4 className="mb-1 break-words text-sm font-medium">{item.title} <span className="font-mono text-xs font-normal text-muted-foreground">{item.code}</span></h4>{recent}</div>;
              const displayedValue = changed ? formValue[item.code] : Object.prototype.hasOwnProperty.call(retainedValues, item.code) ? retainedValues[item.code] : point?.value !== null && point?.value !== undefined && canRepresent(item.schema, point.value) ? point.value : initialValue(item.schema);
              function toggleProperty() {
                if (busy) return;
                const next = { ...formValue };
                if (!changed) next[item.code] = displayedValue;
                else delete next[item.code];
                setText(pretty(next)); setValidation('');
              }
              return <div key={item.code} role="group" aria-label={`${item.title}，${changed ? '已选择下发' : '未选择下发'}`} aria-disabled={busy} tabIndex={busy ? -1 : 0} className={cn('flex flex-col cursor-pointer rounded-md border bg-muted/10 px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring', changed && 'border-blue-500/50')} onClick={event => {
                if ((event.target as Element).closest('[data-slot="field-content"], button, input, textarea, select, label')) return;
                toggleProperty();
              }} onKeyDown={event => {
                if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
                event.preventDefault(); toggleProperty();
              }}>{recent}<p className="mb-1 mt-0.5 text-xs leading-5 text-muted-foreground">{changed ? '本次设置 · 已选择下发' : '本次设置 · 尚未选择下发'}</p><CommandField controlPanel inline schema={item.schema} label={`${item.title} · ${item.code}`} value={displayedValue} disabled={busy} onChange={value => {
                setRetainedValues(previous => ({ ...previous, [item.code]: value }));
                setText(pretty({ ...formValue, [item.code]: value })); setValidation('');
              }} /></div>;

            })}
            {properties.length > 0 && matchingProperties.length === 0 && <p role="status" className="py-6 text-center text-xs text-muted-foreground 2xl:col-span-2">{!showAllProperties && writable.length === 0 ? '此设备没有可下发的属性，点击「显示全部属性」查看只读状态。' : '没有匹配的属性，试试其他关键词或切换显示范围。'}</p>}
          </div></CommandControlTheme> : <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"><Send className="size-6 opacity-40" /><p>暂无可用的可视化控制定义</p><Button size="sm" variant="outline" onClick={() => changeEditor('json')}>使用 JSON 编辑</Button></div> : <div className="space-y-2"><Label htmlFor="command-payload">请求参数</Label><Textarea id="command-payload" className="min-h-64 font-mono text-xs" value={text} disabled={busy} aria-invalid={!!validation} onChange={event => { setText(event.target.value); setValidation(''); }} /><Button size="sm" variant="ghost" disabled={busy} onClick={() => { const value = validate(); if (value) setText(pretty(value)); }}>格式化 JSON</Button></div>}
          {validation && <p role="alert" className="text-xs text-destructive">{validation}</p>}
          {blocked && <p role="status" className="text-xs text-muted-foreground">{blocked}</p>}
        </div></div>
        <footer className="sticky bottom-0 z-10 shrink-0 space-y-2 border-t bg-background px-4 py-3"><details><summary className="cursor-pointer text-xs text-muted-foreground">发送选项</summary><div className="mt-3 flex items-center gap-2"><Label htmlFor="command-ttl" className="text-xs">投递有效期</Label><DeviceInput id="command-ttl" type="number" min="0.001" max="30" step="0.001" className="w-20" value={ttl} disabled={busy} onChange={event => setTtl(event.target.value)} /><span className="text-xs text-muted-foreground">秒</span></div></details><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">在右侧查看设备响应，可继续下发</span><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => { setText('{}'); setRetainedValues({}); setValidation(''); }}><Trash2 className="size-3.5" />清空</Button><Button disabled={!!blocked || busy} onClick={() => { if (validate()) setConfirm(true); }}><Send className="size-3.5" />发送指令</Button></div></div></footer>
        </> : <div className="min-h-0 flex-1 lg:overflow-y-auto">
          {model.isLoading && <Loading />}<ErrorNotice error={model.error} retry={() => model.mutate()} />
          {model.data && <ActionControl projectId={projectId} device={device} actions={model.data.actions} blocked={blocked} onSubmitted={submitted} busy={busy} onBusyChange={setBusy} />}
        </div>}

      </section>
      <section className="flex min-h-0 min-w-0 flex-col border-t bg-muted/10 lg:border-t-0 lg:border-l" aria-label="实时指令响应">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-5 py-3">
          <div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-2 text-sm font-medium"><Terminal className="size-4" />实时指令响应</h3><span role="status" className="text-xs text-muted-foreground">{history.status === 'live' ? '实时更新中' : history.status === 'paused' ? '后台已暂停' : history.status === 'reconnecting' ? '正在重连' : history.status === 'blocked' ? '实时连接已停止' : '正在连接'}</span></div>
          <div className="flex flex-wrap items-center gap-1">
            <CommandSelect label="响应类型筛选" className="w-28 text-xs" value={filter || 'ALL'} onValueChange={value => { followLatest.current = true; setFilter(value === 'ALL' ? '' : value); setSelected(null); }} placeholder="全部指令" options={[{ value: 'ALL', label: '全部指令' }, { value: 'PROPERTY', label: '属性控制' }, { value: 'ACTION', label: '动作调用' }]} />
            <Button size="icon" variant="ghost" className="size-8!" aria-label="刷新响应" disabled={history.isValidating} onClick={resetHistory}><RefreshCw className="size-3.5" /></Button>
          </div>
        </header>
        <div ref={responseList} onScroll={event => { const list = event.currentTarget; followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64; }} className="h-96 min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-4 lg:h-auto">
          {notice && <p role="status" className="rounded border bg-background p-3 text-xs leading-5">{notice}</p>}
          <ErrorNotice error={sendError} /><ErrorNotice error={history.error} retry={history.refresh} />
          {!!history.streamError && <div className="rounded-md border p-3 text-xs text-muted-foreground"><p>{history.streamError instanceof Error ? history.streamError.message : '实时连接暂不可用。'}</p><p>{history.status === 'blocked' ? '请检查登录状态或访问权限后重新连接。' : '已显示的记录会保留，连接恢复后自动补查。'}</p>{history.status === 'blocked' && <Button variant="outline" size="sm" className="mt-2" onClick={history.refresh}>重新连接</Button>}</div>}
          {history.isLoading && <Loading />}
          {!history.isLoading && !history.error && liveRecords.length === 0 && <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center"><Terminal className="size-7 text-muted-foreground/40" /><p className="text-sm font-medium">本次调试暂无指令</p><p className="max-w-64 text-xs leading-5 text-muted-foreground">在左侧下发属性或调用动作，这里实时显示请求和设备回复。历史记录请到「指令记录」查看。</p></div>}
          {liveRecords.map(row => <CommandExchange key={row.requestId} record={row} onDetails={setSelected} />)}

        </div>
      </section>
    </div>
    </div>
    <section hidden={workspace !== 'records'} className="min-w-0 space-y-4 rounded-lg border p-4" aria-label="指令记录">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-sm font-medium">指令记录</h3><p className="mt-1 text-xs text-muted-foreground">本次调试及打开页面前 24 小时的指令，设备回复会持续更新。</p></div>
        <Button size="sm" variant="outline" disabled={history.isValidating} onClick={history.refresh}><RefreshCw className="size-3.5" />刷新记录</Button>
      </header>
      <ErrorNotice error={history.error} retry={history.refresh} />
      {history.isValidating && <Loading />}
      <DeviceTable rows={[...records].reverse()} columns={[
        { label: '下发时间', render: row => <span className="whitespace-nowrap tabular-nums">{formatTime(row.createTime)}</span> },
        { label: '指令', render: row => row.commandType === 'PROPERTY' ? '属性控制' : `动作 · ${row.code ?? '—'}` },
        { label: '请求编号', render: row => <span className="font-mono text-xs">{row.requestId}</span> },
        { label: '投递状态', render: row => deliveryLabels[row.deliveryStatus] ?? row.deliveryStatus },
        { label: '设备结果', render: row => row.responseStatus === 'TIMED_OUT' ? '应答超时 · 结果未确认' : row.responseStatus === 'RECEIVED_LATE' ? `迟到回复 · ${executionLabels[row.executionStatus] ?? row.executionStatus}` : executionLabels[row.executionStatus] ?? row.executionStatus },
        { label: '操作', render: row => <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>查看详情</Button> },
      ]} />
      {history.hasMore && <div className="flex justify-end"><Button size="sm" variant="outline" disabled={history.isValidating} onClick={history.loadMore}>{history.historyLoaded ? '加载更早记录' : '加载历史记录'}</Button></div>}
    </section>
    <div hidden={workspace !== 'reports'}>{model.data ? <ReportRecords key={`${device.deviceId}:${model.data.modelRevision}`} projectId={projectId} device={device} model={model.data} /> : <><ErrorNotice error={model.error} retry={() => model.mutate()} />{model.isLoading && <Loading />}</>}</div>
    <Dialog open={confirm} onOpenChange={open => { if (!busy) setConfirm(open); }}><DialogContent className="max-h-[90dvh] overflow-auto" showCloseButton={!busy}><DialogHeader><DialogTitle>确认下发属性</DialogTitle><DialogDescription>将立即控制设备「{device.deviceName}」。请核对目标和参数。</DialogDescription></DialogHeader><p className="break-all text-xs text-muted-foreground">设备 ID：{device.deviceId} · 有效期 {ttl} 秒</p>{editor === 'visual' ? <dl className="space-y-2 rounded-md border bg-muted/20 p-3">{Object.keys(formValue).length ? Object.entries(formValue).map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-2 text-sm"><dt className="text-muted-foreground">{properties.find(item => item.code === key)?.title ?? key}</dt><dd className="max-w-full break-all">{typeof value === 'boolean' ? value ? '开启' : '关闭' : typeof value === 'object' ? pretty(value) : String(value)}</dd></div>) : <p className="text-sm text-muted-foreground">请先填写需要下发的属性。</p>}</dl> : <JsonBlock text={text} />}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>返回修改</Button><Button disabled={busy || !!blocked} onClick={() => void send()}>{busy ? '正在下发…' : '确认下发'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!selectedRecord} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-auto"><DialogHeader><DialogTitle>指令详情</DialogTitle><DialogDescription>查看原始参数、投递证据与设备回复。</DialogDescription></DialogHeader>{selectedRecord && <div className="space-y-4 text-sm"><p className="break-all font-mono text-xs">{selectedRecord.requestId}</p><p>{deliveryLabels[selectedRecord.deliveryStatus] ?? selectedRecord.deliveryStatus} · {executionLabels[selectedRecord.executionStatus] ?? selectedRecord.executionStatus}</p><p className="text-xs text-muted-foreground">创建：{formatTime(selectedRecord.createTime)}<br />投递截止：{formatTime(selectedRecord.deliveryExpiresAt)}</p><h4 className="font-medium">{selectedRecord.code ? `动作：${selectedRecord.code}` : '属性设置'}</h4><JsonBlock text={selectedRecord.properties ?? selectedRecord.inputParams} /><h4 className="font-medium">设备回复</h4>{selectedRecord.deviceResult ? <><p className="break-all">{selectedRecord.deviceResult.code} · {selectedRecord.deviceResult.message}</p><p className="text-xs text-muted-foreground">接收：{formatTime(selectedRecord.deviceResult.receivedAt)}</p><JsonBlock text={selectedRecord.deviceResult.outputParams} /></> : <p className="text-muted-foreground">尚未收到设备回复，收到后将在此自动更新。</p>}</div>}</DialogContent></Dialog>
  </div>;
}
