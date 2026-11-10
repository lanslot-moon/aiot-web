import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DeviceInput, DeviceSection, DeviceTable, DetailField } from '@/components/device/layout';
import { cn } from '@/lib/utils';
import { initialModules, initialVersions, initialPackages, initialBatches, devices, defaultPolicy, scopeSummary, rateSummary, validatePolicy, type FirmwarePackage, type Policy, type Task, type Batch } from './model';

function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children(id)}{hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}</div>;
}
function Choice({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <Field label={label}>{id => <Select value={value} onValueChange={value => { if (value !== null) onChange(value); }} disabled={disabled}><SelectTrigger id={id} className="h-9! w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>}</Field>;
}
function Check({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return <div className="flex items-center gap-2 py-1"><Checkbox id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} /><Label htmlFor={id} className={cn('text-xs leading-5', disabled && 'text-muted-foreground')}>{label}</Label></div>;
}
function Status({ children }: { children: string }) {
  return <Badge variant="outline" className={cn('whitespace-nowrap', ['验证通过', '成功', '已激活', '已发布'].includes(children) && 'border-emerald-700/20 bg-emerald-700/5 text-emerald-700 dark:text-emerald-400', /失败|超时/.test(children) && 'border-destructive/20 bg-destructive/5 text-destructive')}>{children}</Badge>;
}
const steps = ['选择固件', '升级范围', '升级策略', '检查并提交'];

export default function OtaPrototype() {
  const [modules, setModules] = useState(initialModules);
  const [versions, setVersions] = useState(initialVersions);
  const [packages, setPackages] = useState(initialPackages);
  const [batches, setBatches] = useState(initialBatches);
  const [moduleId, setModuleId] = useState('main');
  const [versionId, setVersionId] = useState('v241');
  const [packageId, setPackageId] = useState('83021');
  const [batchId, setBatchId] = useState('86042');
  const [page, setPage] = useState('firmware');
  const [step, setStep] = useState(0);
  const [policy, setPolicy] = useState(defaultPolicy);
  const [modal, setModal] = useState('');
  const [entityName, setEntityName] = useState('');
  const [entityCode, setEntityCode] = useState('');
  const [channel, setChannel] = useState(1);
  const [kind, setKind] = useState<'全量包' | '差分包'>('全量包');
  const [base, setBase] = useState('2.3.8');
  const [files, setFiles] = useState<string[]>([]);
  const [testDevices, setTestDevices] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState('全部状态');
  const [detailTask, setDetailTask] = useState<string | null>(null);
  const [expand, setExpand] = useState(10);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [pendingOperation, setPendingOperation] = useState('');
  const currentModule = modules.find(item => item.id === moduleId)!;
  const version = versions.find(item => item.id === versionId);
  const pkg = packages.find(item => item.id === packageId);
  const batch = batches.find(item => item.id === batchId)!;
  const task = batch.tasks.find(item => item.id === detailTask);
  const moduleVersions = versions.filter(item => item.moduleId === moduleId);
  const versionPackages = packages.filter(item => item.versionId === versionId);
  const picked = batch.tasks.filter(item => selectedTasks.includes(item.id));
  const isProduct = ['firmware', 'package', 'wizard'].includes(page);
  const setRule = <K extends keyof Policy>(key: K, value: Policy[K]) => setPolicy(previous => ({ ...previous, [key]: value }));
  const updatePackage = (change: Partial<FirmwarePackage>) => setPackages(items => items.map(item => item.id === packageId ? { ...item, ...change } : item));
  const updateBatch = (change: Partial<Batch>) => setBatches(items => items.map(item => item.id === batchId ? { ...item, ...change } : item));
  function navigate(next: string) { setPage(next); setError(''); setSelectedTasks([]); }
  function openModal(next: string) { setError(''); setEntityName(''); setEntityCode(''); setFiles([]); setModal(next); }
  function selectVersion(id: string) { setVersionId(id); setPackageId(packages.find(item => item.versionId === id)?.id || ''); }
  function startWizard() {
    if (!pkg || pkg.stage !== '验证通过' || !version?.published) return;
    setPolicy(defaultPolicy()); setStep(0); navigate('wizard');
  }
  function saveBatch(draft: boolean) {
    if (!pkg || !version) return;
    const validation = validatePolicy(policy, 1) || validatePolicy(policy, 2);
    if (validation) { setError(validation); return; }
    const id = String(86043 + batches.length - 1);
    const next: Batch = { id, packageId: pkg.id, moduleName: currentModule.name, versionName: version.name, state: draft || simulateFailure ? '草稿' : '已激活', policy: structuredClone(policy), tasks: [], activationFailed: !draft && simulateFailure, revision: 1 };
    setBatches(items => [next, ...items]); setBatchId(id); navigate('batch'); setMessage(draft ? '升级草稿已保存。' : '升级批次已创建。');
  }
  function createEntity() {
    if (!entityName.trim()) { setError('请输入名称或版本号。'); return; }
    if (modal === 'module') {
      if (!entityCode.trim() || !Number.isInteger(channel) || channel < 0) { setError('请填写模块标识和非负整数通道。'); return; }
      if (modules.some(item => item.code === entityCode.trim() || item.channel === channel)) { setError('模块标识或固件通道已存在。'); return; }
      const id = `module-${modules.length + 1}`;
      setModules(items => [...items, { id, name: entityName.trim(), code: entityCode.trim(), channel }]); setModuleId(id); setVersionId(''); setPackageId('');
    } else {
      if (moduleVersions.some(item => item.name === entityName.trim())) { setError('该模块已存在此版本。'); return; }
      const id = `version-${versions.length + 1}`;
      setVersions(items => [...items, { id, moduleId, name: entityName.trim(), description: entityCode.trim() || '暂无版本说明', published: false }]); setVersionId(id); setPackageId('');
    }
    setModal(''); setMessage('已创建并选中新资源。');
  }
  function createPackage() {
    if (files.length !== (kind === '差分包' ? 2 : 1)) { setError(kind === '差分包' ? '请选择源固件与目标固件两个文件。' : '请选择目标固件文件。'); return; }
    const id = String(83022 + packages.length - 1);
    const next: FirmwarePackage = { id, versionId, kind, source: kind === '差分包' ? base : '', stage: kind === '差分包' ? '等待构建' : '文件待核验', failed: false, devices: [], results: {}, files };
    setPackages(items => [...items, next]); setPackageId(id); setModal(''); navigate('package');
  }
  function advancePackage() {
    if (!pkg) return;
    if (pkg.failed) { updatePackage({ failed: false }); return; }
    const next: Partial<Record<FirmwarePackage['stage'], FirmwarePackage['stage']>> = { '等待构建': '生成差分', '生成差分': '还原校验', '还原校验': '上传产物', '上传产物': '可封存', '文件待核验': '可封存', '可封存': '已封存' };
    if (next[pkg.stage]) updatePackage({ stage: next[pkg.stage]! });
  }
  function taskOperation(operation: string, ids: string[]) {
    const tasks = batch.tasks.map(item => {
      if (!ids.includes(item.id)) return item;
      if (operation === '重试任务') return { ...item, state: '等待下发', phase: '等待新一轮下发', progress: '—', reason: undefined, history: [...item.history, `第 ${item.history.length + 1} 轮 · 等待下发`] };
      return { ...item, state: operation === '确认下发' ? '等待下发' : '已取消', phase: operation === '确认下发' ? '业务确认完成' : '管理员取消任务' };
    });
    updateBatch({ tasks }); setSelectedTasks([]); setMessage(`${ids.length} 个任务已处理。`); setModal('');
  }
  const operationAllowed = (operation: string, list: Task[]) => batch.state === '已激活' && list.length > 0 && list.length <= 200 && list.every(item => operation === '确认下发' ? item.state === '待业务确认' : operation === '重试任务' ? ['执行超时', '启动超时', '失败'].includes(item.state) : ['待业务确认', '等待下发', '已通知'].includes(item.state));
  const title = page === 'firmware' ? '边缘网关 G2' : page === 'package' ? '升级包详情' : page === 'wizard' ? '新建升级批次' : page === 'batches' ? 'OTA 升级' : `升级批次 ${batch.id}`;
  return <div className="min-w-0 bg-background text-foreground">
    <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3"><strong className="text-base font-semibold tracking-tight">AIoT</strong><span className="text-xs text-muted-foreground">项目空间 / 边缘设备实验室</span><Badge variant="secondary" className="ml-auto">交互原型 · 示例数据</Badge></header>
    <div className="grid min-w-0 md:grid-cols-[156px_minmax(0,1fr)]">
      <aside className="hidden space-y-1 border-r bg-muted/20 p-3 md:block"><p className="px-2 py-2 text-xs text-muted-foreground">开发管理</p><Button variant={isProduct ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => navigate('firmware')}>产品</Button><Button variant={!isProduct ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => navigate('batches')}>OTA 升级</Button></aside>
      <main className="min-w-0 space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><button onClick={() => navigate('firmware')} className="hover:text-foreground">产品</button><span>/</span><span>边缘网关 G2</span><span>/</span><button onClick={() => navigate('batches')} className="hover:text-foreground">固件与 OTA</button></div>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><h1 className="text-xl font-semibold tracking-tight">{title}</h1><p className="text-xs text-muted-foreground">{isProduct ? `${currentModule.name} · ${currentModule.code} · 固件通道 ${currentModule.channel}` : '管理升级范围、下发策略与设备执行结果'}</p></div>{page === 'firmware' ? <Button onClick={() => openModal('version')}>新增固件版本</Button> : <Button variant="outline" onClick={() => navigate(isProduct ? 'firmware' : 'batches')}>{isProduct ? '返回固件' : '返回批次列表'}</Button>}</div>
        {message && <div role="status" className="flex items-center justify-between gap-3 border bg-muted/30 px-3 py-2 text-xs"><span>{message}</span><Button variant="ghost" size="sm" onClick={() => setMessage('')}>收起</Button></div>}

        {page === 'firmware' && <>
          <div className="flex flex-wrap gap-4 border-b pb-3 text-xs"><span className="font-medium">固件与升级</span><button className="text-muted-foreground hover:text-foreground" onClick={() => navigate('batches')}>升级批次</button></div>
          <div className="flex flex-wrap items-end gap-3"><div className="w-64 max-w-full"><Choice label="固件模块" value={currentModule.name} options={modules.map(item => item.name)} onChange={name => { const item = modules.find(item => item.name === name)!; setModuleId(item.id); const first = versions.find(v => v.moduleId === item.id); selectVersion(first?.id || ''); }} /></div><Button variant="outline" onClick={() => openModal('module')}>新增模块</Button></div>
          <DeviceTable rows={moduleVersions} columns={[
            { label: '固件版本', render: item => <div className="space-y-1"><Button variant="link" className="h-auto! px-0! font-mono" onClick={() => selectVersion(item.id)}>{item.name}</Button><p className="text-xs text-muted-foreground">{item.description}</p></div> },
            { label: '版本状态', render: item => <Status>{item.published ? '已发布' : '草稿'}</Status> },
            { label: '升级包', render: item => { const list = packages.filter(p => p.versionId === item.id); return list.length ? list.map(p => <div key={p.id} className="my-1 flex gap-2"><span>{p.kind}</span><Status>{p.stage}</Status></div>) : <span className="text-muted-foreground">待准备</span>; } },
            { label: '操作', render: item => <Button variant="outline" size="sm" onClick={() => { selectVersion(item.id); setKind('全量包'); openModal('package'); }}>准备升级包</Button> },
          ]} />
          {!moduleVersions.length && <p className="py-6 text-center text-sm text-muted-foreground">此模块还没有固件版本，点击右上角新增。</p>}
          {version && <DeviceSection title={`版本 ${version.name} 的升级包`} description="封存固定文件清单，验证结果与当前升级包关联。">
            {versionPackages.length ? <DeviceTable rows={versionPackages} columns={[{ label: '升级包', render: item => <span className="font-mono">{item.id}</span> }, { label: '适用版本', render: item => `${item.source || '由批次限定'} → ${version.name}` }, { label: '类型', render: item => item.kind }, { label: '状态', render: item => <Status>{item.failed ? `${item.stage}失败` : item.stage}</Status> }, { label: '操作', render: item => <Button variant="outline" size="sm" onClick={() => { setPackageId(item.id); navigate('package'); }}>查看升级包</Button> }]} /> : <div className="border border-dashed p-5 text-center text-xs text-muted-foreground">尚无升级包。先准备文件，再封存与验证。</div>}
          </DeviceSection>}
        </>}

        {page === 'package' && pkg && version && <>
          <div className="flex flex-wrap items-center gap-2"><Status>{pkg.failed ? `${pkg.stage}失败` : pkg.stage}</Status><Badge variant="secondary">{pkg.kind}</Badge><span className="text-xs text-muted-foreground">包 {pkg.id} · 目标 {version.name}</span></div>
          <dl className="grid gap-4 border bg-muted/10 p-4 sm:grid-cols-2"><DetailField label="源版本">{pkg.source || '全量包，可在批次限定来源版本'}</DetailField><DetailField label="目标版本">{version.name}</DetailField><DetailField label="固件文件" fullWidth>{pkg.files.join(' → ')}</DetailField><DetailField label="文件校验">{['文件待核验', '等待构建', '生成差分', '还原校验', '上传产物'].includes(pkg.stage) ? '尚未完成' : 'SHA-256 核验通过（示例）'}</DetailField><DetailField label="封存与验证">封存后文件不可修改；替换文件需创建新包。</DetailField></dl>
          <DeviceSection title="包处理进度" description={pkg.kind === '差分包' ? '生成差分 → 还原校验 → 上传产物 → 核验封存 → 样机验证' : '目标文件核验 → 封存 → 样机验证'}>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{pkg.failed ? '当前阶段失败，已保留文件和记录。' : pkg.stage === '验证失败' ? '存在验证失败设备，请查看明细后重新验证。' : pkg.stage}</p><div className="flex flex-wrap gap-2">
              {['文件待核验', '等待构建', '生成差分', '还原校验', '上传产物', '可封存'].includes(pkg.stage) && <Button onClick={advancePackage}>{pkg.failed ? '重试本阶段' : pkg.stage === '可封存' ? '封存升级包' : '模拟完成当前阶段'}</Button>}
              {['已封存', '验证失败', '验证通过'].includes(pkg.stage) && <Button variant={pkg.stage === '验证通过' ? 'outline' : 'default'} onClick={() => { setTestDevices(pkg.devices); openModal('verify'); }}>选择验证设备</Button>}
              {pkg.stage === '验证通过' && !version.published && <Button onClick={() => setVersions(items => items.map(item => item.id === versionId ? { ...item, published: true } : item))}>发布固件版本</Button>}
              {pkg.stage === '验证通过' && version.published && <Button onClick={startWizard}>创建升级批次</Button>}
            </div></div>
          </DeviceSection>
          {pkg.devices.length > 0 && <DeviceSection title="样机验证" description="以设备上报目标版本为成功依据；进度完成不代表验证成功。"><DeviceTable rows={pkg.devices.map(id => devices.find(item => item.id === id)!)} columns={[{ label: '设备', render: item => item.id }, { label: '源版本 / 硬件', render: item => `${item.source} / ${item.hardware}` }, { label: '验证结果', render: item => <Status>{pkg.results[item.id] === true ? '成功' : pkg.results[item.id] === false ? '失败' : '等待版本上报'}</Status> }]} /></DeviceSection>}
          <details className="border-t pt-3 text-xs text-muted-foreground"><summary>演示场景</summary><div className="mt-3 flex flex-wrap gap-2">{['文件待核验', '等待构建', '生成差分', '还原校验', '上传产物'].includes(pkg.stage) && <Button size="sm" variant="outline" onClick={() => updatePackage({ failed: true })}>模拟处理失败</Button>}{pkg.stage === '验证中' && <><Button size="sm" variant="outline" onClick={() => updatePackage({ stage: '验证通过', results: Object.fromEntries(pkg.devices.map(id => [id, true])) })}>模拟全部通过</Button><Button size="sm" variant="outline" onClick={() => updatePackage({ stage: '验证失败', results: Object.fromEntries(pkg.devices.map((id, index) => [id, index > 0])) })}>模拟验证失败</Button></>}<span>仅本地模拟，不上传或下发。</span></div></details>
        </>}

        {page === 'wizard' && pkg && version && <>
          <ol className="grid grid-cols-2 gap-2 border-b pb-4 sm:grid-cols-4">{steps.map((name, index) => <li key={name} aria-current={step === index ? 'step' : undefined} className={cn('flex items-center gap-2 text-xs', step !== index && 'text-muted-foreground')}><span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border', step === index && 'border-primary bg-primary text-primary-foreground')}>{index + 1}</span>{name}</li>)}</ol>
          <h2 className="text-sm font-medium">{steps[step]}</h2>
          {step === 0 && <dl className="grid gap-5 border bg-muted/10 p-4 sm:grid-cols-2"><DetailField label="产品 / 模块">边缘网关 G2 / {currentModule.name}</DetailField><DetailField label="目标版本">{version.name} · 已发布</DetailField><DetailField label="升级包">{pkg.kind} {pkg.id}</DetailField><DetailField label="发布准备">已封存 · 样机验证通过</DetailField><DetailField label="适用源版本">{pkg.source || '下一步配置'}</DetailField><DetailField label="变更说明">{version.description}</DetailField></dl>}
          {step === 1 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Choice label="匹配方式" value={policy.mode} options={['仅本次设备', '持续匹配设备']} onChange={value => setPolicy(previous => ({ ...previous, mode: value, start: value === '持续匹配设备' ? '' : previous.start }))} /><Choice label="设备范围" value={policy.scope} options={['测试线 A', '指定设备', '全部符合条件的设备']} onChange={value => setRule('scope', value)} /><Choice label="源固件版本" value={pkg.source || policy.sources || '不限制'} options={pkg.source ? [pkg.source] : ['不限制', '2.3.8', '2.3.5']} disabled={!!pkg.source} onChange={value => setRule('sources', value === '不限制' ? '' : value)} /><Choice label="硬件版本" value={policy.hardware || '不限制'} options={['不限制', 'HW-1', 'HW-2']} onChange={value => setRule('hardware', value === '不限制' ? '' : value)} /><Field label="灰度比例（%）" hint="灰度在同时满足条件的设备中应用。">{id => <DeviceInput id={id} type="number" min={0} max={100} value={policy.percent} onChange={event => setRule('percent', Number(event.target.value))} />}</Field><div className="grid grid-cols-2 gap-2"><Field label="标签名称">{id => <DeviceInput id={id} placeholder="region" value={policy.tagKey} onChange={event => setRule('tagKey', event.target.value)} />}</Field><Field label="标签值">{id => <DeviceInput id={id} placeholder="shanghai" value={policy.tagValue} onChange={event => setRule('tagValue', event.target.value)} />}</Field></div></div>
            {policy.scope === '指定设备' && <div className="border p-3">{devices.map(item => <Check key={item.id} label={`${item.id} · ${item.source} · ${item.hardware}`} checked={policy.deviceIds.includes(item.id)} onChange={checked => setRule('deviceIds', checked ? [...policy.deviceIds, item.id] : policy.deviceIds.filter(id => id !== item.id))} />)}</div>}
            <div className="space-y-2 border-l-2 border-primary bg-muted/30 p-3 text-xs"><p>{scopeSummary(policy, pkg)}；灰度 {policy.percent}%。</p><p className="text-muted-foreground">{policy.mode === '仅本次设备' ? '静态范围：激活时确定候选设备。分组仅包含直接成员。' : '动态范围：后续新增符合条件的设备也会参与，已有任务独立执行。'} 匹配人数以云端结果为准。</p></div></div>}
          {step === 2 && <div className="space-y-6">
            <DeviceSection title="时间安排" description={`时间按浏览器本地时区展示（${Intl.DateTimeFormat().resolvedOptions().timeZone}）。留空表示立即生效或立即执行。`}><div className="grid gap-4 sm:grid-cols-2"><Field label="批次开始时间" hint={policy.mode === '持续匹配设备' ? '持续匹配即时生效，不支持预约开始。' : '可预约未来 5 分钟至 7 天。'}>{id => <DeviceInput id={id} type="datetime-local" disabled={policy.mode === '持续匹配设备'} value={policy.start} onChange={event => setRule('start', event.target.value)} />}</Field><Field label="批次截止时间">{id => <DeviceInput id={id} type="datetime-local" value={policy.end} onChange={event => setRule('end', event.target.value)} />}</Field><Field label="设备执行时间" hint="设备收到任务后处理执行时间；留空或已过去的时间表示立即执行。">{id => <DeviceInput id={id} type="datetime-local" value={policy.execute} onChange={event => setRule('execute', event.target.value)} />}</Field></div></DeviceSection>
            <DeviceSection title="下发与业务确认" description="云端主动推送；设备接收任务后执行下载、校验与安装。"><Check label="下发前需要管理员业务确认" checked={policy.confirm} onChange={value => setRule('confirm', value)} /><Field label="初始推送速率（台/分钟）">{id => <DeviceInput id={id} className="max-w-xs" type="number" min={1} value={policy.rate} onChange={event => setRule('rate', Number(event.target.value))} />}</Field></DeviceSection>
            <details className="border p-3"><summary className="text-sm font-medium">高级策略</summary><div className="mt-4 space-y-4"><Check label="随成功数量逐步提高推送速率" checked={policy.progressive} onChange={value => setRule('progressive', value)} />{policy.progressive && <div className="grid gap-4 sm:grid-cols-3">{([['threshold', '每累计成功（台）'], ['increment', '增加速率（台/分钟）'], ['ceiling', '速率上限（台/分钟）']] as const).map(([key, label]) => <Field key={key} label={label}>{id => <DeviceInput id={id} type="number" min={1} value={policy[key]} onChange={event => setRule(key, Number(event.target.value))} />}</Field>)}</div>}<Field label="下发优先级（0–100）" hint="数值越大越优先；不抢占已下发任务。">{id => <DeviceInput id={id} className="max-w-xs" type="number" min={0} max={100} value={policy.priority} onChange={event => setRule('priority', Number(event.target.value))} />}</Field><p className="text-xs leading-5 text-muted-foreground">自动重试沿用服务端统一策略；超时后由管理员手动重试，保留历史轮次。</p></div></details>
            <p className="border-l-2 border-primary bg-muted/30 p-3 text-xs">{rateSummary(policy)}</p>
          </div>}
          {step === 3 && <div className="space-y-4"><dl className="grid gap-4 border p-4 sm:grid-cols-2"><DetailField label="目标固件">{currentModule.name} / {version.name} / {pkg.kind} {pkg.id}</DetailField><DetailField label="准备状态">封存完成 · 验证通过</DetailField><DetailField label="升级范围" fullWidth>{scopeSummary(policy, pkg)}；{policy.mode}；灰度 {policy.percent}%。</DetailField><DetailField label="批次时间">{policy.start.replace('T', ' ') || '立即生效'} → {policy.end.replace('T', ' ') || '不设截止'}</DetailField><DetailField label="设备执行">{policy.execute.replace('T', ' ') || '收到任务后立即执行'}</DetailField><DetailField label="下发与确认">云端主动推送 · {policy.confirm ? '需要管理员确认' : '无需业务确认'} · 优先级 {policy.priority}</DetailField><DetailField label="速率策略">{rateSummary(policy)}</DetailField></dl><p className="text-xs text-muted-foreground">提交后云端匹配设备并创建任务；这里只演示配置与状态，不实际下发。</p><details className="text-xs text-muted-foreground"><summary>演示场景</summary><Check label="模拟创建成功、激活失败" checked={simulateFailure} onChange={setSimulateFailure} /></details></div>}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-between gap-3 border-t pt-4"><Button variant="outline" disabled={step === 0} onClick={() => { setStep(step - 1); setError(''); }}>上一步</Button><div className="flex flex-wrap gap-2">{step === 3 && <Button variant="outline" onClick={() => saveBatch(true)}>仅保存草稿</Button>}<Button onClick={() => { const issue = validatePolicy(policy, step); if (issue) { setError(issue); return; } setError(''); if (step < 3) setStep(step + 1); else saveBatch(false); }}>{step === 3 ? '提交升级批次' : '下一步'}</Button></div></div>
        </>}

        {page === 'batches' && <DeviceSection title="升级批次" description="边缘网关 G2 · 按批次查看配置和设备结果" actions={<Button onClick={() => navigate('firmware')}>从固件创建批次</Button>}><DeviceTable rows={batches} columns={[{ label: '批次 / 目标', render: item => <div className="space-y-1"><span className="font-mono">{item.id}</span><p className="text-xs text-muted-foreground">{item.moduleName} · {item.versionName}</p></div> }, { label: '状态', render: item => <Status>{item.state}</Status> }, { label: '发布范围', render: item => `${item.policy.mode} · ${item.policy.percent}%` }, { label: '推送速率', render: item => `${item.policy.rate} 台/分钟` }, { label: '操作', render: item => <Button size="sm" variant="outline" onClick={() => { setBatchId(item.id); setTaskFilter('全部状态'); navigate('batch'); }}>查看批次</Button> }]} /></DeviceSection>}
        {page === 'batch' && <>
          <div className="flex flex-wrap items-center justify-between gap-3 border bg-muted/10 p-4"><div className="space-y-2"><div className="flex gap-2"><Status>{batch.state}</Status><span className="text-xs text-muted-foreground">规则版本 {batch.revision}</span></div><p className="text-sm">{batch.moduleName} / {batch.versionName} · 灰度 {batch.policy.percent}%</p><p className="text-xs text-muted-foreground">{rateSummary(batch.policy)}</p></div><div className="flex flex-wrap gap-2">{batch.state === '草稿' ? <Button onClick={() => { updateBatch({ state: '已激活', activationFailed: false }); setMessage('当前批次已激活，等待匹配设备。'); }}>激活当前批次</Button> : <><Button variant="outline" onClick={() => { setPendingOperation(batch.state === '已暂停' ? '恢复下发' : '暂停下发'); openModal('batch-operation'); }}>{batch.state === '已暂停' ? '恢复下发' : '暂停下发'}</Button><Button disabled={batch.policy.percent === 100} onClick={() => { setExpand(Math.min(100, batch.policy.percent + 10)); openModal('expand'); }}>扩大灰度</Button></>}</div></div>
          {batch.activationFailed && <p role="alert" className="border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">批次已创建，激活失败。请激活当前批次，无需重复创建。</p>}
          {batch.state === '已暂停' && <p className="text-xs text-muted-foreground">后续下发已暂停；已通知或正在执行的设备仍可能继续升级。</p>}
          <details className="border p-3 text-xs"><summary>查看批次配置</summary><dl className="mt-4 grid gap-4 sm:grid-cols-2"><DetailField label="范围">{batch.policy.scope} · {batch.policy.mode} · {batch.policy.sources || '随升级包限定'}</DetailField><DetailField label="硬件与标签">{batch.policy.hardware || '不限制硬件'} · {batch.policy.tagKey ? `${batch.policy.tagKey}=${batch.policy.tagValue}` : '不限制标签'}</DetailField><DetailField label="下发策略">{batch.policy.confirm ? '业务确认后下发' : '无需确认'} · 优先级 {batch.policy.priority}</DetailField><DetailField label="批次时间">{batch.policy.start || '立即生效'} → {batch.policy.end || '不设截止'}</DetailField><DetailField label="设备执行">{batch.policy.execute || '立即执行'}</DetailField></dl></details>
          <div className="flex flex-wrap gap-2">{['全部状态', '成功', '执行中', '待业务确认', '等待下发', '执行超时', '已取消'].map(state => <Button key={state} size="sm" variant={taskFilter === state ? 'secondary' : 'ghost'} onClick={() => { setTaskFilter(state); setSelectedTasks([]); }}>{state} <span className="font-mono text-muted-foreground">{batch.tasks.filter(item => state === '全部状态' || item.state === state).length}</span></Button>)}</div>
          <p className="text-xs text-muted-foreground">当前加载的示例任务统计。点击状态筛选明细。</p>
          <DeviceTable rows={batch.tasks.filter(item => taskFilter === '全部状态' || item.state === taskFilter)} columns={[{ label: '选择', render: item => <Checkbox aria-label={`选择 ${item.device}`} checked={selectedTasks.includes(item.id)} onCheckedChange={checked => setSelectedTasks(ids => checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} /> }, { label: '设备', render: item => <span className="font-mono">{item.device}</span> }, { label: '任务状态', render: item => <Status>{item.state}</Status> }, { label: '执行阶段', render: item => <div>{item.phase}<p className="mt-1 text-xs text-muted-foreground">进度 {item.progress} · 第 {item.history.length} 轮</p></div> }, { label: '操作', render: item => <Button variant="outline" size="sm" onClick={() => setDetailTask(item.id)}>查看详情</Button> }]} />
          {!batch.tasks.length && <p className="border border-dashed p-5 text-center text-sm text-muted-foreground">{batch.state === '草稿' ? '激活后开始匹配设备。' : '等待云端匹配设备并建立任务。'}</p>}
          {selectedTasks.length > 0 && <div className="flex flex-wrap items-center gap-2 border bg-muted/20 p-3"><span className="text-xs">已选 {selectedTasks.length} 台</span>{['确认下发', '取消任务', '重试任务'].map(operation => <Button key={operation} size="sm" variant="outline" disabled={!operationAllowed(operation, picked)} onClick={() => { setPendingOperation(operation); openModal('task-operation'); }}>{operation}</Button>)}<Button size="sm" variant="ghost" onClick={() => setSelectedTasks([])}>清空</Button><p className="w-full text-xs text-muted-foreground">需批次已激活，且全部所选任务支持该操作；单次最多 200 台。</p></div>}
        </>}
      </main>
    </div>

    <Dialog open={!!modal} onOpenChange={open => { if (!open) { setModal(''); setError(''); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{{ module: '新增固件模块', version: '新增固件版本', package: '准备升级包', verify: '选择验证设备', expand: '扩大灰度', 'task-operation': pendingOperation, 'batch-operation': pendingOperation }[modal] || '操作'}</DialogTitle><DialogDescription>{modal === 'expand' ? '结合当前结果扩大覆盖范围，已暂停的批次仍保持暂停。' : modal.includes('operation') ? '请核对本次操作范围。' : `边缘网关 G2 / ${currentModule.name}${version ? ` / ${version.name}` : ''}`}</DialogDescription></DialogHeader>
        {['module', 'version'].includes(modal) && <div className="space-y-4"><Field label={modal === 'module' ? '模块名称' : '版本号'}>{id => <DeviceInput id={id} value={entityName} onChange={event => setEntityName(event.target.value)} placeholder={modal === 'module' ? '例如：传感器' : '例如：2.5.0'} />}</Field><Field label={modal === 'module' ? '模块标识' : '版本说明'}>{id => <DeviceInput id={id} value={entityCode} onChange={event => setEntityCode(event.target.value)} />}</Field>{modal === 'module' && <Field label="固件通道">{id => <DeviceInput id={id} type="number" min={0} value={channel} onChange={event => setChannel(Number(event.target.value))} />}</Field>}</div>}
        {modal === 'package' && <div className="space-y-4"><Choice label="升级包类型" value={kind} options={['全量包', '差分包']} onChange={value => { setKind(value as '全量包' | '差分包'); setFiles([]); }} />{kind === '差分包' && <Choice label="源固件版本" value={base} options={['2.3.8', '2.3.5']} onChange={setBase} />}<div className="space-y-3 border border-dashed bg-muted/10 p-4"><p className="text-sm font-medium">{kind === '差分包' ? '源固件文件 + 目标固件文件' : '目标固件文件'}</p><p className="break-all text-xs text-muted-foreground">{files.join(' → ') || '选择示例文件体验流程；不会上传文件。'}</p><Button variant="outline" onClick={() => setFiles(kind === '差分包' ? [`${currentModule.code}-${base}.bin`, `${currentModule.code}-${version?.name}.bin`] : [`${currentModule.code}-${version?.name}.bin`])}>选择示例文件</Button></div><p className="text-xs text-muted-foreground">{kind === '差分包' ? '后台生成差分并还原校验，成功后上传产物。源固件必须与设备实际固件匹配。' : '完成目标固件文件核验后封存，再选择设备验证。'}</p></div>}
        {modal === 'verify' && pkg && <div className="space-y-3"><p className="text-xs text-muted-foreground">{pkg.source ? `仅可选择当前源版本为 ${pkg.source} 的设备。` : '选择当前产品的验证设备。'}</p>{devices.map(item => { const eligible = !pkg.source || item.source === pkg.source; return <div key={item.id} className="border p-3"><Check label={`${item.id} · ${item.source} · ${item.hardware}`} checked={testDevices.includes(item.id)} disabled={!eligible} onChange={checked => setTestDevices(ids => checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} /><p className="text-xs text-muted-foreground">{!eligible ? '源版本不匹配' : item.online ? '在线' : '离线，任务将等待设备满足条件'}</p></div>; })}</div>}
        {modal === 'expand' && <div className="space-y-4"><p className="border bg-muted/20 p-3 text-xs">当前灰度 {batch.policy.percent}% · 当前加载任务 {batch.tasks.length} 台 · 成功 {batch.tasks.filter(item => item.state === '成功').length} 台 · 失败/超时 {batch.tasks.filter(item => /失败|超时/.test(item.state)).length} 台</p><Field label="目标灰度比例（%）">{id => <DeviceInput id={id} type="number" min={batch.policy.percent + 1} max={100} value={expand} onChange={event => setExpand(Number(event.target.value))} />}</Field><p className="text-xs text-muted-foreground">新增覆盖数量由云端匹配，不根据当前加载任务推算。</p></div>}
        {modal === 'task-operation' && <p className="text-sm">{pendingOperation} · 已选 {picked.length} 个任务。{pendingOperation === '重试任务' ? '进入下一轮执行，并保留此前结果。' : ''}</p>}
        {modal === 'batch-operation' && <p className="text-sm">{pendingOperation === '暂停下发' ? '暂停后续下发，已接收通知或正在安装的设备仍可能继续执行。' : '恢复符合条件设备的后续下发。'}</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setModal('')}>取消</Button><Button onClick={() => {
          if (['module', 'version'].includes(modal)) createEntity();
          else if (modal === 'package') createPackage();
          else if (modal === 'verify') { if (!testDevices.length) { setError('请至少选择一台验证设备。'); return; } updatePackage({ devices: testDevices, results: {}, stage: '验证中' }); setModal(''); }
          else if (modal === 'expand') { if (!Number.isInteger(expand) || expand <= batch.policy.percent || expand > 100) { setError('新比例须为大于当前比例且不超过 100 的整数。'); return; } updateBatch({ policy: { ...batch.policy, percent: expand }, revision: batch.revision + 1 }); setModal(''); }
          else if (modal === 'task-operation') { if (operationAllowed(pendingOperation, picked)) taskOperation(pendingOperation, selectedTasks); }
          else if (modal === 'batch-operation') { updateBatch({ state: pendingOperation === '暂停下发' ? '已暂停' : '已激活' }); setModal(''); }
        }}>{['module', 'version'].includes(modal) ? '创建' : modal === 'package' ? '创建升级包' : modal === 'verify' ? '开始验证' : '确认操作'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Sheet open={!!task} onOpenChange={open => { if (!open) setDetailTask(null); }}><SheetContent className="w-full! overflow-y-auto sm:max-w-md!" showCloseButton><SheetHeader><SheetTitle>设备任务 {task?.id}</SheetTitle><SheetDescription>{task?.device} · 批次 {batch.id}</SheetDescription></SheetHeader>{task && <div className="space-y-6 px-4 pb-6"><div className="space-y-3"><Status>{task.state}</Status><p className="text-sm">{task.phase}</p><p className="text-xs text-muted-foreground">进度 {task.progress}。成功以设备上报目标版本为准。</p>{task.reason && <div className="space-y-2 border border-destructive/20 p-3 text-xs"><p>设备已开始执行，但未按时上报结果。检查设备网络和安装日志后，可手动重试。</p><code className="break-all">{task.reason}</code></div>}</div><DeviceSection title="每轮执行记录">{task.history.map((line, index) => <p key={index} className="border-l-2 pl-3 text-xs leading-6">{line}</p>)}</DeviceSection><div className="flex flex-wrap gap-2">{['确认下发', '取消任务', '重试任务'].filter(operation => operationAllowed(operation, [task])).map(operation => <Button key={operation} variant="outline" onClick={() => { setSelectedTasks([task.id]); setDetailTask(null); setPendingOperation(operation); openModal('task-operation'); }}>{operation}</Button>)}</div></div>}</SheetContent></Sheet>
  </div>;
}
