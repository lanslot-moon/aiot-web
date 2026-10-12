import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { policyRequest, policyPath, query, formatTime, principalLabels, type Policy, type Draft, type Version, type Binding, type Usage, type Page, type Document, type Validation, type PrincipalType } from '@/api/policy/client';
import PolicyEditor from './policy-editor';
import { Status, Failure, Field, Loading, Pager, selectClass } from './shared';
import { cn } from '@/lib/utils';

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
  const [tab, setTab] = useState('draft');
  const [editing, setEditing] = useState(initialEdit);
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
  const [principalType, setPrincipalType] = useState<PrincipalType>('DEVICE');
  const [principalId, setPrincipalId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);
  function leave() {
    if (!busy && (!editing || window.confirm('放弃尚未保存的草稿修改并返回？'))) back();
  }
  async function refresh() { await Promise.allSettled([policy.mutate(), draft.mutate(), bindings.mutate(), versions.mutate(), usage.mutate()]); }
  async function save(document: Document) {
    if (!draft.data) return;
    setBusy(true); setError(undefined);
    try {
      const saved = await policyRequest<Draft>(projectId, base + '/draft', 'PUT', { revision: draft.data.revision, document });
      await draft.mutate(saved, false); setValidation(null); setEditing(false); toast.success('草稿已保存，尚未改变生效权限。');
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
    if (operation === 'bind' && !principalId.trim()) { setModalError(new Error('请填写授权对象 ID。')); return; }
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
  const types: PrincipalType[] = p.policyType === 'MQTT_DEVICE' ? ['DEVICE', 'PRODUCT', 'STATIC_GROUP'] : ['ACCOUNT', 'APPLICATION', 'TENANT_ROLE'];
  return <div className="space-y-5">
    <Button variant="ghost" className="-ml-3" disabled={busy} onClick={leave}><ArrowLeft className="size-4" />返回策略列表</Button>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{p.name}</h2><Status value={p.status} /></div><p className="mt-2 text-sm text-muted-foreground">{p.description || '暂无说明'}</p><p className="mt-2 break-all text-xs text-muted-foreground">{p.policyType === 'MQTT_DEVICE' ? '设备通信 · 产品 ' + p.scopeProductId : '资源操作'} · {p.policyId}</p></div><Button variant="outline" disabled={!writable || busy || editing} onClick={() => open('metadata')}><Pencil className="size-4" />编辑信息</Button><Button variant="ghost" disabled={busy || editing} onClick={() => void refresh()}>刷新详情</Button></div>
    <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 px-4 py-3 text-sm"><span>当前生效：{p.currentVersionNo ? 'v' + p.currentVersionNo : '尚未发布'}</span><span>生效绑定：{usage.data ? usage.data.activeBindingCount : '—'}</span>{p.scheduledVersionNo && <span>待生效版本：v{p.scheduledVersionNo}</span>}</div>
    <div className="flex flex-wrap gap-2 border-b pb-3" aria-label="策略详情导航">{[['draft', '草稿与规则'], ['bindings', '授权对象'], ['versions', '版本记录']].map(([key, label]) => <Button key={key} variant={tab === key ? 'secondary' : 'ghost'} aria-pressed={tab === key} disabled={busy || editing} onClick={() => setTab(key)}>{label}</Button>)}</div>
    <Failure error={error} />
    {tab === 'draft' && <><Failure error={draft.error} retry={() => draft.mutate()} />{!draft.data && !draft.error ? <Loading /> : draft.data && <>
      {editing ? <><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm('放弃尚未保存的草稿修改？')) setEditing(false); }}>取消编辑</Button><PolicyEditor key={draft.data.revision} projectId={projectId} type={p.policyType} initial={draft.data.document} onSave={save} busy={busy} /></> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium">草稿 r{draft.data.revision}</h3><p className="mt-1 text-sm text-muted-foreground">发布后更新当前版本；只有绑定的对象会应用这份策略。</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!writable || busy} onClick={() => setEditing(true)}>编辑规则</Button><Button variant="outline" disabled={!writable || busy} onClick={() => void validate()}>校验草稿</Button><Button disabled={!writable || busy || draft.data.validationStatus !== 'VALID' || !!p.scheduledVersionNo} onClick={() => open('publish')}>发布</Button></div></div>
        <p className="text-xs text-muted-foreground">校验状态：<Status value={draft.data.validationStatus} />{p.scheduledVersionNo ? ' · 请先处理待生效版本，再发布新版本。' : ' · 修改后需重新通过服务端校验。'}</p>
        <GatewayDataTable rows={draft.data.document?.statements ?? []} columns={[{ label: '规则', render: r => r.sid }, { label: '处理', render: r => <span className={r.effect === 'DENY' ? 'text-destructive' : ''}>{r.effect === 'DENY' ? '禁止' : '允许'}</span> }, { label: '操作 / 通道', render: r => <div className="max-w-lg break-all text-xs leading-6">{r.actions.join('、')}<br />{r.operationReferences?.join('、') || r.resources?.map(x => x.resourcePattern).join('、')}</div> }, { label: '条件', render: r => r.conditions?.length ? r.conditions.map(c => c.key + ' ' + c.operator + ' ' + c.values.join(', ')).join('；') : '无附加条件' }]} />
        <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">查看完整文档（包含约束）</summary><pre className="mt-3 max-h-80 overflow-auto rounded bg-muted p-4 text-xs">{JSON.stringify(draft.data.document, null, 2)}</pre></details>
      </>}
      {validation && <div aria-live="polite" className="space-y-2 rounded-lg border p-4"><p className="flex items-center gap-2 font-medium">{validation.valid && <CheckCircle2 className="size-4 text-emerald-600" />}{validation.valid ? '校验通过' : '请修正规则后重新校验'}</p>{validation.issues?.map((issue, i) => <p key={i} className="break-all text-sm"><span className={issue.severity === 'ERROR' ? 'text-destructive' : 'text-muted-foreground'}>{issue.message}</span><span className="ml-2 text-xs text-muted-foreground">{issue.path} · {issue.code}</span></p>)}</div>}
    </>}</>}
    {tab === 'bindings' && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">设备、产品或组只有绑定后才应用自定义策略。撤销绑定后，仍保留标准通信及其他策略。</p><Button disabled={!writable || busy || !p.currentVersionNo} onClick={() => open('bind')}><Plus className="size-4" />添加对象</Button></div>{!p.currentVersionNo && <p className="text-sm text-muted-foreground">请先发布策略，再添加授权对象。</p>}<Failure error={bindings.error} retry={() => bindings.mutate()} />{bindings.isLoading ? <Loading /> : !bindings.error && <><GatewayDataTable rows={bindings.data?.items ?? []} columns={[{ label: '对象', render: b => <div>{principalLabels[b.principalType]}<div className="max-w-xs break-all font-mono text-xs text-muted-foreground">{b.principalId}</div></div> }, { label: '状态', render: b => <Status value={b.status} /> }, { label: '有效期', render: b => <div className="whitespace-nowrap text-xs">{formatTime(b.effectiveAt)}<br />至 {b.expiresAt ? formatTime(b.expiresAt) : '长期有效'}</div> }, { label: '操作', render: b => <div className="flex gap-1">{['ACTIVE', 'SCHEDULED'].includes(b.status) && <><Button size="sm" variant="ghost" disabled={busy} onClick={() => open('validity', b)}>有效期</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => open('revoke', b)}>撤销</Button></>}{b.status === 'SCHEDULED' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => open('deleteBinding', b)}>删除</Button>}</div> }]} /><Pager previous={bindingCursors.length > 1 ? () => setBindingCursors(c => c.slice(0, -1)) : undefined} next={bindings.data?.hasMore && bindings.data.nextCursor ? () => setBindingCursors(c => [...c, bindings.data!.nextCursor!]) : undefined} busy={bindings.isValidating} /></>}</div>}
    {tab === 'versions' && <div className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><p className="text-sm text-muted-foreground">已发布版本不可编辑。恢复历史规则会发布一个新版本。</p>{p.scheduledVersionNo && <Button variant="outline" disabled={busy} onClick={() => open('cancel')}>取消定时发布</Button>}</div><Failure error={versions.error} retry={() => versions.mutate()} />{versions.isLoading ? <Loading /> : !versions.error && <><GatewayDataTable rows={versions.data?.items ?? []} columns={[{ label: '版本', render: v => 'v' + v.versionNo }, { label: '状态', render: v => <Status value={v.status} /> }, { label: '生效时间', render: v => formatTime(v.effectiveAt) }, { label: '变更说明', render: v => v.changeReason || '—' }, { label: '操作', render: v => <div className="flex"><Button size="sm" variant="ghost" onClick={() => setInspectVersion(v.versionNo)}>查看内容</Button>{v.status === 'RETIRED' && <Button size="sm" variant="ghost" disabled={!writable || busy || !!p.scheduledVersionNo} onClick={() => open('rollback', undefined, v.versionNo)}>恢复此版本</Button>}</div> }]} /><Pager previous={versionCursors.length > 1 ? () => setVersionCursors(c => c.slice(0, -1)) : undefined} next={versions.data?.hasMore && versions.data.nextCursor ? () => setVersionCursors(c => [...c, versions.data!.nextCursor!]) : undefined} /></>}</div>}
    <details className="border-t pt-4 text-sm"><summary className="cursor-pointer text-muted-foreground">策略维护</summary><div className="mt-4 space-y-3"><Failure error={usage.error} retry={() => usage.mutate()} />{usage.data?.blockingReasons?.map(reason => <p key={reason}>{reason}</p>)}<div className="flex gap-2"><Button variant="outline" disabled={!writable || busy || !usage.data?.canArchive} onClick={() => open('archive')}>归档策略</Button>{p.status === 'DRAFT' && !p.currentVersionNo && !p.scheduledVersionNo && <Button variant="outline" disabled={busy} onClick={() => open('delete')}>删除草稿</Button>}</div></div></details>
    <Dialog open={!!operation} onOpenChange={v => { if (!v && !busy) setOperation(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{operation && titles[operation]}</DialogTitle><DialogDescription>{operation === 'publish' || operation === 'rollback' ? '新版本会影响此策略的已有绑定对象。请确认规则及生效时间。' : operation === 'bind' ? '选择对象类型并填写当前项目内的真实 ID，服务端会校验绑定范围。' : '操作提交到当前项目。修改冲突时请刷新详情后重新操作。'}</DialogDescription></DialogHeader>
      {operation === 'metadata' && <><Field title="名称"><Input value={name} onChange={e => setName(e.target.value)} maxLength={128} disabled={busy} /></Field><Field title="说明"><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={512} disabled={busy} /></Field></>}
      {operation === 'bind' && <><Field title="对象类型"><select className={selectClass} disabled={busy} value={principalType} onChange={e => { setPrincipalType(e.target.value as PrincipalType); setPrincipalId(e.target.value === 'PRODUCT' ? p.scopeProductId ?? '' : ''); }}>{types.map(t => <option key={t} value={t}>{principalLabels[t]}</option>)}</select></Field><Field title={principalLabels[principalType] + ' ID'}><Input value={principalId} disabled={busy} onChange={e => setPrincipalId(e.target.value)} /></Field></>}
      {['publish', 'rollback', 'bind', 'validity'].includes(operation ?? '') && <Field title="生效时间" hint="留空表示立即生效，时间使用当前浏览器时区。"><Input type="datetime-local" value={starts} disabled={busy} onChange={e => setStarts(e.target.value)} /></Field>}
      {['bind', 'validity'].includes(operation ?? '') && <Field title="到期时间" hint="留空表示长期有效。"><Input type="datetime-local" value={ends} disabled={busy} onChange={e => setEnds(e.target.value)} /></Field>}
      {['publish', 'rollback', 'cancel', 'archive', 'revoke'].includes(operation ?? '') && <Field title="变更说明（选填）"><Textarea value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></Field>}
      {operation === 'rollback' && <p className="text-sm">将基于 v{versionNo} 的内容发布新版本。</p>}
      {['delete', 'deleteBinding'].includes(operation ?? '') && <p className="text-sm text-destructive">删除后无法恢复，请确认目标无误。</p>}
      <Failure error={modalError} /><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOperation(null)}>取消</Button><Button disabled={busy} className={cn(['delete', 'deleteBinding', 'revoke'].includes(operation ?? '') && 'bg-destructive text-white')} onClick={() => void commit()}>{busy ? '提交中…' : '确认' + (operation ? titles[operation] : '')}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={inspectVersion !== null} onOpenChange={v => { if (!v) setInspectVersion(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>版本 v{inspectVersion}</DialogTitle><DialogDescription>已发布版本只读。</DialogDescription></DialogHeader><Failure error={inspected.error} retry={() => inspected.mutate()} />{inspected.isLoading ? <Loading /> : inspected.data && <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(inspected.data.document, null, 2)}</pre>}</DialogContent></Dialog>
  </div>;
}
