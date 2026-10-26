import { formatDateTime } from '@/lib/date-time';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { policyRequest, policyPath, query, principalLabels, type Policy, type Draft, type Version, type Binding, type Usage, type Page, type Document, type Validation, type PrincipalType } from '@/api/policy/client';
import PolicyEditor from './policy-editor';
import PrincipalPicker from './principal-picker';
import PolicyRulesTable from './policy-rules-table';
import PolicyOverlapNotice from './policy-overlap-notice';
import PolicyDocumentView from './policy-document-view';
import { Status, Failure, Field, Loading, Pager, PolicySelect } from './shared';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

type Operation = 'publish' | 'rollback' | 'cancel' | 'archive' | 'delete' | 'bind' | 'revoke' | 'validity' | 'deleteBinding' | 'metadata';
const titles: Record<Operation, string> = { publish: '发布策略', rollback: '从历史版本发布', cancel: '取消定时发布', archive: '归档策略', delete: '删除草稿', bind: '添加授权对象', revoke: '撤销授权', validity: '调整有效期', deleteBinding: '删除待生效绑定', metadata: '修改名称与说明' };
const toInput = (time?: number | null) => time ? new Date(time - new Date(time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
const epoch = (value: string) => value ? new Date(value).getTime() : null;

export default function PolicyDetail({ projectId, id, back, initialEdit = false }: { projectId: string; id: string; back: () => void; initialEdit?: boolean }) {
  const base = policyPath(id);
  const read = <T,>(path: string) => policyRequest<T>(projectId, path);
  const policy = useSWR([projectId, base], () => read<Policy>(base));
  const draft = useSWR([projectId, base, 'draft'], () => read<Draft>(base + '/draft'), { revalidateOnFocus: false });
  const usage = useSWR([projectId, base, 'usage'], () => read<Usage>(base + '/usage'));
  const [selectedTab, setTab] = useState<string | null>(initialEdit ? 'draft' : null);
  const tab = selectedTab ?? (policy.data?.currentVersionNo ? 'current' : 'draft');
  const currentVersionNo = policy.data?.currentVersionNo;
  const current = useSWR(currentVersionNo ? [projectId, base, currentVersionNo] : null,
    () => read<Version>(base + '/versions/' + currentVersionNo));
  const [editing, setEditing] = useState(initialEdit);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState<'back' | 'cancel' | null>(null);
  const [bindingCursors, setBindingCursors] = useState<string[]>(['']);
  const [versionCursors, setVersionCursors] = useState<string[]>(['']);
  const bindings = useSWR([projectId, base, 'bindings', bindingCursors[bindingCursors.length - 1]], () => read<Page<Binding>>('policy-bindings' + query({ policyId: id, pageSize: 20, cursor: bindingCursors[bindingCursors.length - 1] })));
  const versions = useSWR([projectId, base, 'versions', versionCursors[versionCursors.length - 1]], () => read<Page<Version>>(base + '/versions' + query({ pageSize: 20, cursor: versionCursors[versionCursors.length - 1] })));
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [modalError, setModalError] = useState<unknown>();
  const [operation, setOperation] = useState<Operation | null>(null);
  const [target, setTarget] = useState<Binding | null>(null);
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [inspectVersion, setInspectVersion] = useState<number | null>(null);
  const inspected = useSWR(inspectVersion ? [projectId, base, inspectVersion] : null, () => read<Version>(base + '/versions/' + inspectVersion));
  const [reason, setReason] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [principalType, setPrincipalType] = useState<Exclude<PrincipalType, 'APPLICATION'>>('DEVICE');
  const [principalId, setPrincipalId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (!editing || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing, dirty]);
  function leave() {
    if (busy) return;
    if (editing && dirty) setDiscard('back'); else back();
  }
  async function refresh() { await Promise.allSettled([policy.mutate(), draft.mutate(), bindings.mutate(), versions.mutate(), usage.mutate(), current.mutate()]); }
  async function save(document: Document) {
    if (!draft.data) return;
    setBusy(true); setError(undefined);
    try {
      const saved = await policyRequest<Draft>(projectId, base + '/draft', 'PUT', { revision: draft.data.revision, document });
      await draft.mutate(saved, false); setValidation(null); setDirty(false); setEditing(false); toast.success('草稿已保存，尚未改变生效权限。');
    } finally { setBusy(false); }
  }
  async function validate() {
    if (!draft.data) return;
    setBusy(true); setError(undefined);
    try {
      const result = await policyRequest<Validation>(projectId, base + '/validation', 'POST', { revision: draft.data.revision });
      setValidation(result); await draft.mutate();
      if (result.valid) toast.success('服务端校验通过，可以发布。');
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  function open(op: Operation, binding?: Binding, version?: number) {
    setOperation(op); setTarget(binding ?? null); setVersionNo(version ?? null); setReason(''); setModalError(undefined);
    setStarts(binding ? toInput(binding.effectiveAt) : ''); setEnds(binding ? toInput(binding.expiresAt) : '');
    setPrincipalType(policy.data?.policyType === 'MQTT_DEVICE' ? 'DEVICE' : 'ACCOUNT'); setPrincipalId('');
    setName(policy.data?.name ?? ''); setDescription(policy.data?.description ?? '');
  }
  async function commit() {
    const p = policy.data;
    if (!p || !operation) return;
    const start = operation === 'validity' && target && starts === toInput(target.effectiveAt) ? target.effectiveAt : epoch(starts);
    const end = operation === 'validity' && target && ends === toInput(target.expiresAt) ? target.expiresAt : epoch(ends);
    if ((starts && !Number.isFinite(start)) || (ends && !Number.isFinite(end))) { setModalError(new Error('请输入有效时间。')); return; }
    if (['publish', 'rollback'].includes(operation) && start !== null && start <= Date.now()) { setModalError(new Error('定时发布时间必须晚于现在。')); return; }
    if (['bind', 'validity'].includes(operation) && end !== null && end <= Math.max(start ?? Date.now(), Date.now())) { setModalError(new Error('到期时间必须晚于生效时间。')); return; }
    if (operation === 'bind' && !principalId.trim()) { setModalError(new Error('请选择授权对象。')); return; }
    if (operation === 'metadata' && !name.trim()) { setModalError(new Error('请填写策略名称。')); return; }
    setBusy(true); setModalError(undefined);
    try {
      switch (operation) {
        case 'publish': await policyRequest(projectId, base + '/publication', 'POST', { revision: draft.data?.revision, effectiveAt: start, changeReason: reason }); break;
        case 'rollback': await policyRequest(projectId, base + '/rollback-publication', 'POST', { revision: p.revision, sourceVersionNo: versionNo, effectiveAt: start, changeReason: reason }); break;
        case 'cancel': await policyRequest(projectId, base + '/scheduled-publication/cancellation', 'POST', { revision: p.revision, versionNo: p.scheduledVersionNo, reason }); break;
        case 'archive': await policyRequest(projectId, base + '/archival', 'POST', { revision: p.revision, reason }); break;
        case 'delete': await policyRequest(projectId, base + query({ revision: p.revision }), 'DELETE'); break;
        case 'metadata': await policyRequest(projectId, base, 'PUT', { revision: p.revision, name: name.trim(), description }); break;
        case 'bind': await policyRequest(projectId, 'policy-bindings', 'POST', { policyId: id, principalType, principalId: principalId.trim(), effectiveAt: start, expiresAt: end }); break;
        case 'revoke': if (target) await policyRequest(projectId, 'policy-bindings/' + encodeURIComponent(target.bindingId) + '/revocation', 'POST', { revision: target.revision, reason }); break;
        case 'validity': if (target) await policyRequest(projectId, 'policy-bindings/' + encodeURIComponent(target.bindingId) + '/validity', 'PUT', { revision: target.revision, effectiveAt: start, expiresAt: end }); break;
        case 'deleteBinding': if (target) await policyRequest(projectId, 'policy-bindings/' + encodeURIComponent(target.bindingId) + query({ revision: target.revision }), 'DELETE'); break;
      }
      toast.success(titles[operation] + '成功');
      setOperation(null); setValidation(null);
      if (operation === 'delete') back(); else await refresh();
    } catch (e) { setModalError(e); } finally { setBusy(false); }
  }
  if (policy.error) return <div className="space-y-4"><Button variant="ghost" onClick={back}><ArrowLeft className="size-4" />返回列表</Button><Failure error={policy.error} retry={() => policy.mutate()} /></div>;
  if (!policy.data) return <Loading />;
  const p = policy.data;
  const writable = p.status !== 'ARCHIVED' && p.ownershipType !== 'SYSTEM_MANAGED';
  const types: Exclude<PrincipalType, 'APPLICATION'>[] = p.policyType === 'MQTT_DEVICE' ? ['DEVICE', 'PRODUCT', 'STATIC_GROUP'] : ['ACCOUNT', 'TENANT_ROLE'];
  return <div className="space-y-5 text-xs leading-5">
    <Button variant="ghost" disabled={busy} onClick={leave}><ArrowLeft className="size-4" />返回策略列表</Button>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex min-h-8 flex-wrap items-center gap-3"><h2 className="min-w-0 break-words text-lg font-semibold leading-8">{p.name}</h2>{p.status === 'ACTIVE' ? <span className="rounded-md border px-2 py-0.5 text-xs font-normal text-muted-foreground">已发布</span> : <Status value={p.status} />}</div>
        <p className="mt-2 break-words text-xs leading-6 text-muted-foreground">{p.description || '暂无说明'}</p>
        <Collapsible className="mt-2"><CollapsibleTrigger render={<Button variant="ghost" size="sm" className="group h-auto px-0 text-xs text-muted-foreground" />}><ChevronDown className="size-3 transition-transform group-data-panel-open:rotate-180" />策略标识与产品范围</CollapsibleTrigger><CollapsibleContent><dl className="mt-2 space-y-1 break-all text-xs text-muted-foreground"><div>策略 ID：{p.policyId}</div><div>{p.policyType === 'MQTT_DEVICE' ? '产品 ID：' + p.scopeProductId : '类型：资源操作'}</div></dl></CollapsibleContent></Collapsible>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" disabled={!writable || busy || editing} onClick={() => open('metadata')}><Pencil className="size-4" />编辑信息</Button>
        <Button variant="ghost" disabled={busy || editing} onClick={() => void refresh()}>刷新详情</Button>
      </div>
    </div>
    {p.scheduledVersionNo && <p className="text-xs text-muted-foreground">待生效版本：v{p.scheduledVersionNo}</p>}
    <Tabs value={tab} onValueChange={value => setTab(String(value))} className="flex-col! gap-4">
      <TabsList aria-label="策略详情导航" className="h-auto! min-h-9 shrink-0 self-start flex-wrap rounded-lg!">
        <TabsTrigger value="current" disabled={busy || editing} className="rounded-md! px-3!">已发布规则{p.currentVersionNo ? ` · v${p.currentVersionNo}` : ''}</TabsTrigger>
        <TabsTrigger value="draft" disabled={busy || editing} className="rounded-md! px-3!">草稿编辑</TabsTrigger>
        <TabsTrigger value="bindings" disabled={busy || editing} className="rounded-md! px-3!">授权对象</TabsTrigger>
        <TabsTrigger value="versions" disabled={busy || editing} className="rounded-md! px-3!">版本记录</TabsTrigger>
      </TabsList>
      <TabsContent value={tab} className="space-y-4">
    <Failure error={error} />
    {tab === 'current' && <div className="space-y-4">
      {!p.currentVersionNo ? <div className="rounded-lg border border-dashed p-6 text-center"><h3 className="text-sm font-medium">尚无已发布版本</h3><p className="mt-2 text-muted-foreground">保存草稿不会生效。请先校验并发布，再为需要的对象绑定策略。</p><Button variant="outline" className="mt-4" onClick={() => setTab('draft')}>查看草稿</Button></div> : <>
        <Failure error={usage.error} retry={() => usage.mutate()} />
        {!usage.error && usage.data && <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4 sm:px-5">
          <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{p.status === 'ARCHIVED' ? '此策略已归档' : usage.data.activeBindingCount === 0 ? '已发布，尚未应用到任何对象' : `已有 ${usage.data.activeBindingCount} 条生效授权`}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{p.status === 'ARCHIVED' ? '以下内容仅供查阅。' : usage.data.activeBindingCount === 0 ? '发布只是保存可用版本；绑定授权对象后，才会影响它们的权限。' : '以下规则应用于有效期内的授权对象。'}{usage.data.scheduledBindingCount > 0 ? `另有 ${usage.data.scheduledBindingCount} 条授权等待生效。` : ''}</p></div>
          <Button variant="outline" onClick={() => setTab('bindings')}>{usage.data.activeBindingCount === 0 && writable ? '选择授权对象' : '查看授权对象'}</Button>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">已发布 v{p.currentVersionNo} · 草稿修改不会影响此版本</p>
          <Button variant="ghost" disabled={busy || !writable} onClick={() => setTab('draft')}><Pencil className="size-3.5" />修改草稿</Button>
        </div>
        <Failure error={current.error} retry={() => current.mutate()} />
        {current.isLoading ? <Loading /> : !current.error && current.data && <>
          {current.data.document ? <PolicyDocumentView key={p.currentVersionNo} projectId={projectId} type={p.policyType} document={current.data.document} /> : <p className="text-muted-foreground">未返回此版本的规则内容，请刷新详情后重试。</p>}
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
            <p>版本生效时间 <span className="text-foreground">{formatDateTime(current.data.effectiveAt)}</span></p>
            {current.data.changeReason && <p className="min-w-0 whitespace-pre-wrap break-words">{current.data.changeReason}</p>}
          </div>

        </>}
      </>}
    </div>}
    {tab === 'draft' && <><Failure error={draft.error} retry={() => draft.mutate()} />{!draft.data && !draft.error ? <Loading /> : draft.data && <>
      {editing ? <><PolicyEditor key={draft.data.revision} projectId={projectId} type={p.policyType} initial={draft.data.document} onSave={save} onDirtyChange={setDirty} onCancel={() => { if (dirty) setDiscard('cancel'); else setEditing(false); }} busy={busy} /></> : <>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-8">草稿 r{draft.data.revision}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{p.currentVersionNo ? `此处是待发布草稿，保存不会改变当前生效的 v${p.currentVersionNo}。` : '此处是待发布草稿，校验并发布后才会成为生效版本。'}</p>
          </div>
          <div role="group" aria-label="策略操作" className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button variant="outline" disabled={!writable || busy} onClick={() => setEditing(true)}>编辑规则</Button>
            <Button variant="outline" disabled={!writable || busy} onClick={() => void validate()}>校验草稿</Button>
            <Button variant="outline" disabled={!writable || busy || !usage.data?.canArchive} onClick={() => open('archive')}>归档策略</Button>
            {p.status === 'DRAFT' && !p.currentVersionNo && !p.scheduledVersionNo && <Button variant="outline" className="text-destructive hover:text-destructive" disabled={!writable || busy} onClick={() => open('delete')}>删除草稿</Button>}
            <Button disabled={!writable || busy || draft.data.validationStatus !== 'VALID' || !!p.scheduledVersionNo} onClick={() => open('publish')}>发布</Button>
          </div>
        </div>
        <Failure error={usage.error} retry={() => usage.mutate()} />
        {usage.data?.blockingReasons?.map(reason => <p key={reason} className="text-muted-foreground">{reason}</p>)}
        <p className="flex flex-wrap items-center gap-2 text-xs leading-5 text-muted-foreground">校验状态：<Status value={draft.data.validationStatus} />{p.scheduledVersionNo ? ' · 请先处理待生效版本，再发布新版本。' : ' · 修改后需重新通过服务端校验。'}</p>
        <PolicyOverlapNotice type={p.policyType} rules={draft.data.document?.statements ?? []} />
        <PolicyRulesTable projectId={projectId} type={p.policyType} rules={draft.data.document?.statements ?? []} />
        <Collapsible><CollapsibleTrigger render={<Button variant="ghost" className="group" />}><ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180" />查看完整文档（包含约束）</CollapsibleTrigger><CollapsibleContent className="pt-3"><pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(draft.data.document, null, 2)}</pre></CollapsibleContent></Collapsible>
      </>}
      {validation && <div aria-live="polite" className="space-y-2 rounded-lg border p-4"><p className="flex items-center gap-2 font-medium">{validation.valid && <CheckCircle2 className="size-4 text-emerald-600" />}{validation.valid ? '校验通过' : '请修正规则后重新校验'}</p>{validation.issues?.map((issue, i) => <p key={i} className="break-all text-xs"><span className={issue.severity === 'ERROR' ? 'text-destructive' : 'text-muted-foreground'}>{issue.message}</span><span className="ml-2 text-xs text-muted-foreground">{issue.path} · {issue.code}</span></p>)}</div>}
    </>}</>}
    {tab === 'bindings' && <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><p className="text-xs text-muted-foreground">{p.policyType === 'MQTT_DEVICE' ? '选择设备、产品或静态设备组，绑定后才应用此策略。撤销后仍保留标准通信及其他策略。' : '选择账号或项目角色，绑定后才应用此策略。撤销只移除此策略的授权。'}</p><Button disabled={!writable || busy || !p.currentVersionNo} onClick={() => open('bind')}><Plus className="size-4" />添加对象</Button></div>{!p.currentVersionNo && <p className="text-xs text-muted-foreground">请先发布策略，再添加授权对象。</p>}<Failure error={bindings.error} retry={() => bindings.mutate()} />{bindings.isLoading ? <Loading /> : !bindings.error && <><GatewayDataTable rows={bindings.data?.items ?? []} columns={[{ label: '对象', render: b => <div>{principalLabels[b.principalType]}<div className="mt-1 max-w-xs break-all text-xs text-muted-foreground">{b.principalId}</div></div> }, { label: '状态', render: b => <Status value={b.status} /> }, { label: '有效期', render: b => <div className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(b.effectiveAt)}<br />至 {b.expiresAt ? formatDateTime(b.expiresAt) : '长期有效'}</div> }, { label: '操作', render: b => <div className="flex items-center gap-1">{['ACTIVE', 'SCHEDULED'].includes(b.status) && <><Button size="sm" variant="ghost" disabled={busy} onClick={() => open('validity', b)}>有效期</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => open('revoke', b)}>撤销</Button></>}{b.status === 'SCHEDULED' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => open('deleteBinding', b)}>删除</Button>}</div> }]} /><Pager previous={bindingCursors.length > 1 ? () => setBindingCursors(c => c.slice(0, -1)) : undefined} next={bindings.data?.hasMore && bindings.data.nextCursor ? () => setBindingCursors(c => [...c, bindings.data!.nextCursor!]) : undefined} busy={bindings.isValidating} /></>}</div>}
    {tab === 'versions' && <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><p className="text-xs text-muted-foreground">已发布版本不可编辑。恢复历史规则会发布一个新版本。</p>{p.scheduledVersionNo && <Button variant="outline" disabled={busy} onClick={() => open('cancel')}>取消定时发布</Button>}</div><Failure error={versions.error} retry={() => versions.mutate()} />{versions.isLoading ? <Loading /> : !versions.error && <><GatewayDataTable rows={versions.data?.items ?? []} columns={[{ label: '版本', render: v => 'v' + v.versionNo }, { label: '状态', render: v => <Status value={v.status} /> }, { label: '生效时间', render: v => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(v.effectiveAt)}</span> }, { label: '变更说明', render: v => v.changeReason || '—' }, { label: '操作', render: v => <div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => setInspectVersion(v.versionNo)}>查看内容</Button>{v.status === 'RETIRED' && <Button size="sm" variant="ghost" disabled={!writable || busy || !!p.scheduledVersionNo} onClick={() => open('rollback', undefined, v.versionNo)}>恢复此版本</Button>}</div> }]} /><Pager previous={versionCursors.length > 1 ? () => setVersionCursors(c => c.slice(0, -1)) : undefined} next={versions.data?.hasMore && versions.data.nextCursor ? () => setVersionCursors(c => [...c, versions.data!.nextCursor!]) : undefined} /></>}</div>}
      </TabsContent>
    </Tabs>

    <Dialog open={!!operation} onOpenChange={v => { if (!v && !busy) setOperation(null); }}><DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(calc(100%-2rem),36rem)]! grid-rows-[auto_minmax(0,1fr)_auto] gap-0! overflow-hidden p-0!" showCloseButton={!busy}><DialogHeader className="border-b px-6 py-5 pr-12"><DialogTitle>{operation && titles[operation]}</DialogTitle><DialogDescription>{operation === 'publish' || operation === 'rollback' ? '新版本会影响此策略的已有绑定对象。请确认规则及生效时间。' : operation === 'bind' ? '选择需要应用此策略的对象及有效期，确认后将改变其权限。' : '操作提交到当前项目。修改冲突时请刷新详情后重新操作。'}</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
      {operation === 'metadata' && <><Field title="名称"><Input value={name} onChange={e => setName(e.target.value)} maxLength={128} disabled={busy} /></Field><Field title="说明"><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={512} disabled={busy} /></Field></>}
      {operation === 'bind' && <><Field title="对象类型"><PolicySelect label="对象类型" disabled={busy} value={principalType} onValueChange={value => { setPrincipalType(value as Exclude<PrincipalType, 'APPLICATION'>); setPrincipalId(''); setModalError(undefined); }} options={types.map(value => ({ value, label: principalLabels[value] }))} /></Field><PrincipalPicker key={`${projectId}:${principalType}:${p.scopeProductId ?? ''}`} projectId={projectId} type={principalType} scopeProductId={p.scopeProductId} value={principalId} onChange={value => { setPrincipalId(value); setModalError(undefined); }} disabled={busy} /></>}
      {['publish', 'rollback', 'bind', 'validity'].includes(operation ?? '') && <Field title="生效时间" hint="留空表示立即生效，时间使用当前浏览器时区。"><Input type="datetime-local" value={starts} disabled={busy} onChange={e => setStarts(e.target.value)} /></Field>}
      {['bind', 'validity'].includes(operation ?? '') && <Field title="到期时间" hint="留空表示长期有效。"><Input type="datetime-local" value={ends} disabled={busy} onChange={e => setEnds(e.target.value)} /></Field>}
      {['publish', 'rollback', 'cancel', 'archive', 'revoke'].includes(operation ?? '') && <Field title="变更说明（选填）"><Textarea value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></Field>}
      {operation === 'rollback' && <p className="text-xs">将基于 v{versionNo} 的内容发布新版本。</p>}
      {['delete', 'deleteBinding'].includes(operation ?? '') && <p className="text-xs text-destructive">删除后无法恢复，请确认目标无误。</p>}
      <Failure error={modalError} /></div><DialogFooter className="m-0 px-6 py-4"><Button variant="outline" disabled={busy} onClick={() => setOperation(null)}>取消</Button><Button disabled={busy || operation === 'bind' && !principalId.trim()} variant={['delete', 'deleteBinding', 'revoke'].includes(operation ?? '') ? 'destructive' : 'default'} onClick={() => void commit()}>{busy ? '提交中…' : '确认' + (operation ? titles[operation] : '')}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={inspectVersion !== null} onOpenChange={v => { if (!v) setInspectVersion(null); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(calc(100%-2rem),48rem)]! grid-rows-[auto_minmax(0,1fr)_auto] gap-0! overflow-hidden p-0!">
        <DialogHeader className="border-b px-6 py-5 pr-12"><DialogTitle>版本 v{inspectVersion} · 规则内容</DialogTitle><DialogDescription>此版本为只读快照。查看不会修改当前生效权限。</DialogDescription></DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
          <Failure error={inspected.error} retry={() => inspected.mutate()} />
          {inspected.isLoading ? <Loading /> : !inspected.error && inspected.data && <>
            <dl className="grid gap-4 rounded-lg bg-muted/30 p-4 text-xs sm:grid-cols-2">
              <div><dt className="mb-1 text-muted-foreground">版本状态</dt><dd><Status value={inspected.data.status} /></dd></div>
              <div><dt className="mb-1 text-muted-foreground">生效时间</dt><dd>{formatDateTime(inspected.data.effectiveAt)}</dd></div>
              <div className="sm:col-span-2"><dt className="mb-1 text-muted-foreground">变更说明</dt><dd className="whitespace-pre-wrap break-words">{inspected.data.changeReason || '未填写变更说明'}</dd></div>
            </dl>
            {inspected.data.document ? <PolicyDocumentView key={inspectVersion} projectId={projectId} type={p.policyType} document={inspected.data.document} /> : <p className="text-sm text-muted-foreground">此版本未返回规则内容，请刷新后重试。</p>}
          </>}
        </div>
        <DialogFooter className="m-0 px-6 py-4"><Button variant="outline" onClick={() => setInspectVersion(null)}>关闭</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discard !== null} onOpenChange={open => { if (!open) setDiscard(null); }}>
      <AlertDialogContent className="overflow-hidden rounded-lg!">
        <AlertDialogHeader>
          <AlertDialogTitle>放弃未保存的修改？</AlertDialogTitle>
          <AlertDialogDescription>本次编辑尚未保存。放弃后将恢复到已保存的草稿，已生效的策略不受影响。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => {
            const destination = discard;
            setDiscard(null);
            setDirty(false);
            setEditing(false);
            if (destination === 'back') back();
          }}>放弃修改</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
