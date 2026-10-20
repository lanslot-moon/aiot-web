import { useEffect, useRef, useState } from 'react';
import { Braces, History, RefreshCw, Send, Terminal, RotateCcw, Search, X, SlidersHorizontal, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { request } from '@/api/iam/client';
import { type DeviceDetail, formatTime } from '@/api/device/client';
import { commandPath, commandRequest, deliveryLabels, executionLabels, parseCommandInput, type CommandRecord } from '@/api/device/commands';
import type { ThingModelDefinition } from '@/types/apps/open-platform';
import { usePermission } from '@/context/iam-context/identity';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CommandSelect } from './command-select';
import { CommandExchange } from './command-exchange';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeviceInput } from './layout';
import { cn } from '@/lib/utils';
import CommandField from './command-fields';
import { canRepresent, fieldError, initialValue, schemaObject, supportsForm } from './command-schema';
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
  const [mode, setMode] = useState('PROPERTY');
  const [functionSearch, setFunctionSearch] = useState('');
  const [code, setCode] = useState('');
  const [text, setText] = useState('{}');
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
  const history = useCommandRecords(projectId, device.deviceId, filter, canView);
  const records = history.records;
  const selectedRecord = selected ? records.find(row => row.requestId === selected.requestId) ?? null : null;
  useEffect(() => {
    const list = responseList.current;
    if (list && followLatest.current) list.scrollTop = list.scrollHeight;
  }, [records]);
  const model = useResource<ThingModelDefinition | null>(
    `/api/v1/products/${encodeURIComponent(device.productId)}/model/published`, 'product:view',
    path => request(path, 'GET', undefined, { projectId }), `command-model:${projectId}`,
  );
  const properties = model.data?.properties.filter(item => ['READ_WRITE', 'WRITE_ONLY', 'RW', 'W'].includes(item.access)) ?? [];
  const actions = model.data?.actions ?? [];
  const capability = mode === 'ACTION' ? actions.find(item => item.code === code) : properties.find(item => item.code === code);
  const inputSchema = mode === 'PROPERTY' ? {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(properties.map(item => [item.code, { ...schemaObject(item.schema), title: `${item.title} · ${item.code}` }])),
  } : actions.find(item => item.code === code)?.inputSchema;
  let formValue: Record<string, unknown> = {};
  try { formValue = schemaObject(JSON.parse(text)); } catch { /* Invalid JSON stays in the advanced editor. */ }
  const formAvailable = !!model.data && (mode === 'PROPERTY' || !!code) && supportsForm(inputSchema);
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
      const value = parseCommandInput(text, mode);
      if (editor === 'visual' && !formAvailable) throw new Error('请选择可用功能，或切换高级模式填写参数。');
      if (model.data && (mode === 'PROPERTY' || capability)) {
        const error = fieldError(inputSchema, value);
        if (error) throw new Error(error);
      }
      if (mode === 'ACTION' && !/^[A-Za-z0-9_:-]{1,128}$/.test(code)) throw new Error('请选择动作或输入有效的动作标识。');
      if (!Number.isFinite(Number(ttl)) || Number(ttl) < 0.001 || Number(ttl) > 30 || !Number.isInteger(Number(ttl) * 1000)) throw new Error('发送有效期须为 0.001 至 30 秒，精确到毫秒。');
      setValidation(''); return value;
    } catch (error) { setValidation(error instanceof Error ? error.message : '请检查输入。'); return null; }
  }
  async function send() {
    if (lock.current || blocked) return;
    const value = validate(); if (!value) return;
    lock.current = true; setBusy(true); setSendError(undefined); setNotice('');
    try {
      const result = await commandRequest<boolean>(projectId, commandPath(device.deviceId) + (mode === 'PROPERTY' ? '/properties/issue' : '/actions'), 'POST', {
        ...(mode === 'PROPERTY' ? { properties: JSON.stringify(value) } : { actionCode: code, inputParams: JSON.stringify(value) }),
        clientToken: crypto.randomUUID(), deliveryTtlMs: Number(ttl) * 1000,
      });
      const message = result === true ? '指令已投递，请在右侧查看设备执行结果。' : '指令未确认投递，请先刷新记录核对结果。';
      if (result === true && mode === 'PROPERTY') setText('{}');
      setNotice(message); toast.message(message); setConfirm(false); followLatest.current = true;
    } catch (error) {
      setSendError(error); setConfirm(false);
      setNotice('本次请求未能确认结果，请先刷新指令记录核对，避免重复执行。'); resetHistory();
    } finally { lock.current = false; setBusy(false); }
  }
  function selectCapability(next: string) {
    setCode(next); setValidation('');
    const item = actions.find(action => action.code === next);
    setText(pretty(initialValue(item?.inputSchema) ?? {}));
  }
  return <div className="min-w-0 space-y-4">
    <div className="grid min-w-0 overflow-hidden rounded-lg border lg:h-[38rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3"><ToggleGroup value={[mode]} multiple={false} disabled={busy} onValueChange={values => { if (!values.length) return; setMode(String(values[0])); setCode(''); setText('{}'); setValidation(''); }} size="sm" spacing={1} className="bg-muted/60 p-0.5" aria-label="指令类型"><ToggleGroupItem value="PROPERTY" className="aria-pressed:bg-background aria-pressed:shadow-sm"><SlidersHorizontal className="size-3.5" />属性控制</ToggleGroupItem><ToggleGroupItem value="ACTION" className="aria-pressed:bg-background aria-pressed:shadow-sm"><Zap className="size-3.5" />服务调用</ToggleGroupItem></ToggleGroup><Button size="sm" variant="ghost" disabled={busy} onClick={() => changeEditor(editor === 'visual' ? 'json' : 'visual')}><Braces className="size-3.5" />{editor === 'visual' ? 'JSON 编辑' : '可视化控制'}</Button></header>
        <ScrollArea className="h-[28rem] min-h-0 min-w-0 flex-1 lg:h-auto"><div className="space-y-3 p-4" role="region" aria-label="设备功能操作区">
          {mode === 'ACTION' && <div className="space-y-2"><Label htmlFor="command-capability">选择服务</Label><CommandSelect id="command-capability" value={code} disabled={busy} onValueChange={selectCapability} placeholder="请选择要调用的服务" options={actions.map(item => ({ value: item.code, label: `${item.title} · ${item.code}` }))} /></div>}
          {model.isLoading && <Loading />}
          {model.error && <ErrorNotice error={model.error} retry={() => model.mutate()} />}
          {editor === 'visual' ? mode === 'PROPERTY' && model.data ? <div className="space-y-1">
            <InputGroup className="mb-2 h-9 bg-muted/20"><InputGroupAddon><Search className="size-3.5" /></InputGroupAddon><InputGroupInput aria-label="搜索设备功能" placeholder="搜索功能名称或标识" value={functionSearch} onChange={event => setFunctionSearch(event.target.value)} />{functionSearch && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="清除功能搜索" onClick={() => setFunctionSearch('')}><X className="size-3" /></InputGroupButton></InputGroupAddon>}</InputGroup>
            <p className="pb-1 text-[11px] text-muted-foreground">仅发送已调整项 · 控件不代表当前设备状态</p>
            {properties.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">此设备没有可写属性。</p>}
            {properties.filter(item => `${item.title} ${item.code}`.toLowerCase().includes(functionSearch.trim().toLowerCase())).map(item => {
              const changed = Object.prototype.hasOwnProperty.call(formValue, item.code);
              return <div key={item.code} className={cn('group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-muted/40', changed && 'border-primary/15 bg-primary/5')}><div className="min-w-0 flex-1"><CommandField controlPanel inline schema={item.schema} label={`${item.title} · ${item.code}`} value={changed ? formValue[item.code] : initialValue(item.schema)} disabled={busy} onChange={value => { setText(pretty({ ...formValue, [item.code]: value })); setValidation(''); }} /></div><div className="flex h-9 w-8 shrink-0 items-center justify-center">{changed && <Tooltip><TooltipTrigger render={<Button size="icon" variant="ghost" className="size-7! text-primary" disabled={busy} aria-label={`撤销${item.title}待发送值`} onClick={() => { const next = { ...formValue }; delete next[item.code]; setText(pretty(next)); }} />}><RotateCcw className="size-3.5" /></TooltipTrigger><TooltipContent>已调整 · 撤销此项</TooltipContent></Tooltip>}</div></div>;

            })}
            {properties.length > 0 && !properties.some(item => `${item.title} ${item.code}`.toLowerCase().includes(functionSearch.trim().toLowerCase())) && <p role="status" className="py-6 text-center text-xs text-muted-foreground">没有匹配的功能，试试其他关键词。</p>}
          </div> : formAvailable ? <CommandField key={code} schema={inputSchema} label="服务参数" value={formValue} disabled={busy} onChange={value => { setText(pretty(value)); setValidation(''); }} /> : <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"><Send className="size-6 opacity-40" /><p>{mode === 'ACTION' && !code ? '选择服务后，在这里填写调用参数' : '暂无可用的可视化控制定义'}</p><Button size="sm" variant="outline" onClick={() => changeEditor('json')}>使用 JSON 编辑</Button></div> : <div className="space-y-2">{mode === 'ACTION' && (!model.data || model.error) && <DeviceInput aria-label="动作标识" value={code} disabled={busy} placeholder="输入服务标识" onChange={event => setCode(event.target.value)} />}<Label htmlFor="command-payload">请求参数</Label><Textarea id="command-payload" className="min-h-64 font-mono text-xs" value={text} disabled={busy} aria-invalid={!!validation} onChange={event => { setText(event.target.value); setValidation(''); }} /><Button size="sm" variant="ghost" disabled={busy} onClick={() => { const value = validate(); if (value) setText(pretty(value)); }}>格式化 JSON</Button></div>}
          {validation && <p role="alert" className="text-xs text-destructive">{validation}</p>}
          {blocked && <p role="status" className="text-xs text-muted-foreground">{blocked}</p>}
        </div></ScrollArea>
        <footer className="shrink-0 space-y-2 border-t bg-muted/10 px-4 py-3"><details><summary className="cursor-pointer text-xs text-muted-foreground">发送选项</summary><div className="mt-3 flex items-center gap-2"><Label htmlFor="command-ttl" className="text-xs">投递有效期</Label><DeviceInput id="command-ttl" type="number" min="0.001" max="30" step="0.001" className="w-20" value={ttl} disabled={busy} onChange={event => setTtl(event.target.value)} /><span className="text-xs text-muted-foreground">秒</span></div></details><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">发送后在右侧查看设备响应</span><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => { setText(pretty(mode === 'ACTION' ? initialValue(inputSchema) ?? {} : {})); setValidation(''); }}><RotateCcw className="size-3.5" />重置</Button><Button disabled={!!blocked || busy} onClick={() => { if (validate()) setConfirm(true); }}><Send className="size-3.5" />发送指令</Button></div></div></footer>
      </section>
      <section className="flex min-h-0 min-w-0 flex-col border-t bg-muted/10 lg:border-t-0 lg:border-l" aria-label="指令响应">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-5 py-3">
          <div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-2 text-sm font-medium"><Terminal className="size-4" />指令响应</h3><span role="status" className="text-xs text-muted-foreground">{history.status === 'live' ? '实时更新中' : history.status === 'paused' ? '后台已暂停' : history.status === 'reconnecting' ? '正在重连' : history.status === 'blocked' ? '实时连接已停止' : '正在连接'}</span></div>
          <div className="flex items-center gap-1">
            <CommandSelect label="响应类型筛选" className="w-28 text-xs" value={filter || 'ALL'} onValueChange={value => { followLatest.current = true; setFilter(value === 'ALL' ? '' : value); setSelected(null); }} placeholder="全部指令" options={[{ value: 'ALL', label: '全部指令' }, { value: 'PROPERTY', label: '属性控制' }, { value: 'ACTION', label: '服务调用' }]} />
            <Button size="icon" variant="ghost" className="size-8!" aria-label="刷新响应" disabled={history.isValidating} onClick={resetHistory}><RefreshCw className="size-3.5" /></Button>
          </div>
        </header>
        <div ref={responseList} onScroll={event => { const list = event.currentTarget; followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64; }} className="max-h-[36rem] min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto p-4 lg:max-h-none">
          {(history.hasMore || history.historyLoaded) && <div className="flex items-center justify-center gap-3 py-1">
            <span aria-hidden className="h-px w-10 bg-border/70" />
            {history.hasMore ? <button type="button" disabled={history.isValidating} title="加载本次打开调试页前 24 小时的指令记录" onClick={() => { followLatest.current = false; history.loadMore(); }} className="inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60">
              {history.isValidating && history.historyLoaded ? <RefreshCw aria-hidden className="size-3 animate-spin" /> : <History aria-hidden className="size-3" />}
              {history.isValidating && history.historyLoaded ? '正在加载历史指令…' : history.historyLoaded ? '加载更早的历史指令' : '加载历史指令'}
            </button> : <span className="text-xs text-muted-foreground">最近 24 小时的历史记录已全部加载</span>}
            <span aria-hidden className="h-px w-10 bg-border/70" />
          </div>}
          {notice && <p role="status" className="rounded border bg-background p-3 text-xs leading-5">{notice}</p>}
          <ErrorNotice error={sendError} /><ErrorNotice error={history.error} retry={history.refresh} />
          {!!history.streamError && <div className="rounded-md border p-3 text-xs text-muted-foreground"><p>{history.streamError instanceof Error ? history.streamError.message : '实时连接暂不可用。'}</p><p>{history.status === 'blocked' ? '请检查登录状态或访问权限后重新连接。' : '已显示的记录会保留，连接恢复后自动补查。'}</p>{history.status === 'blocked' && <Button variant="outline" size="sm" className="mt-2" onClick={history.refresh}>重新连接</Button>}</div>}
          {history.isLoading && <Loading />}
          {!history.isLoading && !history.error && records.length === 0 && <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center"><History className="size-7 text-muted-foreground/40" /><p className="text-sm font-medium">{history.historyLoaded ? '暂无指令记录' : '本次调试暂无指令'}</p><p className="max-w-56 text-xs leading-5 text-muted-foreground">{history.historyLoaded ? '当前筛选下没有本次调试或打开页面前 24 小时的记录。' : '这里只显示本次打开调试页后的指令。之前的记录可按需加载。'}</p></div>}
          {records.map(row => <CommandExchange key={row.requestId} record={row} onDetails={setSelected} />)}

        </div>
      </section>
    </div>
    <Dialog open={confirm} onOpenChange={open => { if (!busy) setConfirm(open); }}><DialogContent className="max-h-[90dvh] overflow-auto" showCloseButton={!busy}><DialogHeader><DialogTitle>确认下发{mode === 'PROPERTY' ? '属性' : '动作'}</DialogTitle><DialogDescription>将立即控制设备「{device.deviceName}」。请核对目标和参数。</DialogDescription></DialogHeader><p className="break-all text-xs text-muted-foreground">设备 ID：{device.deviceId}{mode === 'ACTION' ? ` · 动作：${code}` : ''} · 有效期 {ttl} 秒</p>{editor === 'visual' ? <dl className="space-y-2 rounded-md border bg-muted/20 p-3">{Object.keys(formValue).length ? Object.entries(formValue).map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-2 text-sm"><dt className="text-muted-foreground">{mode === 'PROPERTY' ? properties.find(item => item.code === key)?.title ?? key : String(schemaObject(schemaObject(schemaObject(inputSchema).properties)[key]).title ?? key)}</dt><dd className="max-w-full break-all">{typeof value === 'boolean' ? value ? '开启' : '关闭' : typeof value === 'object' ? pretty(value) : String(value)}</dd></div>) : <p className="text-sm text-muted-foreground">此动作无需输入参数。</p>}</dl> : <JsonBlock text={text} />}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>返回修改</Button><Button disabled={busy || !!blocked} onClick={() => void send()}>{busy ? '正在下发…' : '确认下发'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!selectedRecord} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-auto"><DialogHeader><DialogTitle>指令详情</DialogTitle><DialogDescription>查看原始参数、投递证据与设备回复。</DialogDescription></DialogHeader>{selectedRecord && <div className="space-y-4 text-sm"><p className="break-all font-mono text-xs">{selectedRecord.requestId}</p><p>{deliveryLabels[selectedRecord.deliveryStatus] ?? selectedRecord.deliveryStatus} · {executionLabels[selectedRecord.executionStatus] ?? selectedRecord.executionStatus}</p><p className="text-xs text-muted-foreground">创建：{formatTime(selectedRecord.createTime)}<br />投递截止：{formatTime(selectedRecord.deliveryExpiresAt)}</p><h4 className="font-medium">{selectedRecord.code ? `动作：${selectedRecord.code}` : '属性设置'}</h4><JsonBlock text={selectedRecord.properties ?? selectedRecord.inputParams} /><h4 className="font-medium">设备回复</h4>{selectedRecord.deviceResult ? <><p className="break-all">{selectedRecord.deviceResult.code} · {selectedRecord.deviceResult.message}</p><p className="text-xs text-muted-foreground">接收：{formatTime(selectedRecord.deviceResult.receivedAt)}</p><JsonBlock text={selectedRecord.deviceResult.outputParams} /></> : <p className="text-muted-foreground">尚未收到设备回复，收到后将在此自动更新。</p>}</div>}</DialogContent></Dialog>
  </div>;
}
