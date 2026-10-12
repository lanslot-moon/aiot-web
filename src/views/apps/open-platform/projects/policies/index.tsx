import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import useSWR, { SWRConfig } from 'swr';
import { useIam } from '@/context/iam-context/identity';
import ProductPicker from '@/components/policy/product-picker';
import { Plus, RefreshCw, Search, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import PolicyDetail from '@/components/policy/policy-detail';
import Diagnostics from '@/components/policy/diagnostics';
import { Status, Failure, Field, Loading, Pager, selectClass } from '@/components/policy/shared';
import { policyRequest, query, formatTime, type Policy, type PolicyType, type Page } from '@/api/policy/client';
import { standardChannels } from '@/api/policy/channels';

function Workspace({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') ?? 'policies';
  const id = params.get('policy');
  const [type, setType] = useState<PolicyType>('MQTT_DEVICE');
  const [status, setStatus] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<string[]>(['']);
  const [create, setCreate] = useState(false);
  const [createType, setCreateType] = useState<PolicyType>('MQTT_DEVICE');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const path = 'policies' + query({ policyType: type, status, name: search, pageSize: 20, cursor: cursors[cursors.length - 1] });
  const list = useSWR(section === 'policies' && !id ? [projectId, path] : null, () => policyRequest<Page<Policy>>(projectId, path));
  function openCreate() { setCreateType(type); setName(''); setDescription(''); setProductId(''); setError(undefined); setCreate(true); }
  async function save() {
    if (!name.trim() || createType === 'MQTT_DEVICE' && !productId.trim()) { setError(new Error('请填写策略名称和设备通信策略所属的产品 ID。')); return; }
    setBusy(true); setError(undefined);
    try {
      const result = await policyRequest<Policy>(projectId, 'policies', 'POST', { name: name.trim(), description: description.trim(), policyType: createType, scopeProductId: createType === 'MQTT_DEVICE' ? productId.trim() : null });
      setCreate(false); setParams({ policy: result.policyId, edit: '1' }); toast.success('策略草稿已创建，继续编辑权限规则。');
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  if (id) return <PolicyDetail key={id} projectId={projectId} id={id} initialEdit={params.get('edit') === '1'} back={() => setParams({})} />;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">策略与授权</h2><p className="mt-2 text-sm text-muted-foreground">标准设备接入无需配置。仅在需要限制通道或授予额外权限时创建策略。</p></div>{section === 'policies' && <Button onClick={openCreate}><Plus className="size-4" />新建自定义策略</Button>}</div>
    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 px-4 py-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><div className="text-sm leading-6"><p className="font-medium">标准通信由平台提供</p><p className="text-muted-foreground">不需要为每个产品创建默认策略。自定义规则叠加在标准权限之上，明确禁止优先。</p></div></div>
    <nav aria-label="授权功能" className="flex flex-wrap gap-2 border-b pb-3">{[['policies', '自定义策略'], ['diagnostics', '权限排查'], ['standard', '标准通信']].map(([key, label]) => <Button key={key} variant={section === key ? 'secondary' : 'ghost'} aria-pressed={section === key} onClick={() => setParams(key === 'policies' ? {} : { section: key })}>{label}</Button>)}</nav>
    {section === 'policies' && <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><Field title="策略类型"><select className={selectClass} value={type} onChange={e => { setType(e.target.value as PolicyType); setCursors(['']); }}><option value="MQTT_DEVICE">设备通信</option><option value="MANAGEMENT">资源操作</option></select></Field><Field title="状态"><select className={selectClass} value={status} onChange={e => { setStatus(e.target.value); setCursors(['']); }}><option value="">全部状态</option><option value="DRAFT">草稿</option><option value="ACTIVE">已生效</option><option value="ARCHIVED">已归档</option></select></Field><form className="flex flex-1 items-end gap-2" onSubmit={e => { e.preventDefault(); setSearch(nameFilter.trim()); setCursors(['']); }}><div className="min-w-32 flex-1"><Field title="策略名称"><Input placeholder="按名称查找" value={nameFilter} maxLength={128} onChange={e => setNameFilter(e.target.value)} /></Field></div><Button type="submit" variant="outline" aria-label="搜索策略"><Search className="size-4" /></Button></form><Button variant="outline" aria-label="刷新策略" disabled={list.isValidating} onClick={() => void list.mutate()}><RefreshCw className="size-4" /></Button></div>
      {type === 'MANAGEMENT' && <p className="text-sm text-muted-foreground">资源操作策略用于账号、应用和项目角色，不改变设备 MQTT 通道。</p>}
      <Failure error={list.error} retry={() => list.mutate()} />
      {list.isLoading ? <Loading /> : !list.error && list.data && <>
        {!list.data.items.length ? <div className="rounded-lg border border-dashed px-6 py-12 text-center"><ShieldCheck className="mx-auto mb-3 size-7 text-muted-foreground" /><h3 className="font-medium">{search || status ? '没有符合条件的策略' : '还没有自定义策略'}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{search || status ? '调整名称或状态后重新查找。' : '这不会影响标准设备接入。需要禁止某台设备上报、按组调整权限时，再创建策略。'}</p>{!search && !status && <Button variant="outline" className="mt-5" onClick={openCreate}>创建第一条自定义策略<ArrowRight className="size-4" /></Button>}</div> : <GatewayDataTable rows={list.data.items} columns={[{ label: '策略', render: p => <button className="max-w-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setParams({ policy: p.policyId })}><span className="font-medium text-primary hover:underline">{p.name}</span><span className="mt-1 block text-xs text-muted-foreground">{p.description || p.policyId}</span></button> }, { label: '状态', render: p => <Status value={p.status} /> }, { label: '作用范围', render: p => <span className="block max-w-48 break-all text-xs">{p.scopeProductId || '当前项目资源'}</span> }, { label: '发布版本', render: p => <span className="whitespace-nowrap text-sm">{p.currentVersionNo ? 'v' + p.currentVersionNo : '尚未发布'}{p.scheduledVersionNo && <span className="block text-xs text-muted-foreground">v{p.scheduledVersionNo} 待生效</span>}</span> }, { label: '更新时间', render: p => <span className="whitespace-nowrap text-xs">{formatTime(p.updateTime)}</span> }, { label: '操作', render: p => <Button size="sm" variant="ghost" onClick={() => setParams({ policy: p.policyId })}>查看</Button> }]} />}
        <Pager previous={cursors.length > 1 ? () => setCursors(c => c.slice(0, -1)) : undefined} next={list.data.hasMore && list.data.nextCursor ? () => setCursors(c => [...c, list.data!.nextCursor!]) : undefined} busy={list.isValidating} />
      </>}
    </div>}
    {section === 'diagnostics' && <Diagnostics projectId={projectId} />}
    {section === 'standard' && <div className="space-y-4"><div><h3 className="font-medium">平台协议内置通道</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">以下是协议目录，不是策略记录。产品和设备标识由已认证身份填入；设备只能访问自己的通信资源。属性是否存在及内容是否合法，由物模型校验。</p><p className="mt-2 text-xs text-muted-foreground">实际可用权限可能被自定义策略限制，请到“权限排查”查看服务端结果。</p></div><GatewayDataTable rows={[...standardChannels]} columns={[{ label: '能力', render: c => c.label }, { label: '设备操作', render: c => c.action === 'mqtt:Publish' ? '发布' : '订阅' }, { label: 'Topic 模板', render: c => <code className="text-xs">{c.topic}</code> }]} /></div>}
    <Dialog open={create} onOpenChange={v => { if (!busy) setCreate(v); }}><DialogContent><DialogHeader><DialogTitle>新建自定义策略</DialogTitle><DialogDescription>先创建草稿，再定义规则、校验并发布。创建本身不会改变设备权限。</DialogDescription></DialogHeader><Field title="策略类型"><select value={createType} className={selectClass} disabled={busy} onChange={e => setCreateType(e.target.value as PolicyType)}><option value="MQTT_DEVICE">设备通信</option><option value="MANAGEMENT">资源操作</option></select></Field><Field title="策略名称"><Input value={name} maxLength={128} disabled={busy} placeholder="例如：限制诊断消息上报" onChange={e => setName(e.target.value)} /></Field>{createType === 'MQTT_DEVICE' && <ProductPicker projectId={projectId} value={productId} disabled={busy} onChange={setProductId} />}<Field title="用途说明（选填）"><Textarea value={description} disabled={busy} maxLength={512} onChange={e => setDescription(e.target.value)} /></Field><Failure error={error} /><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setCreate(false)}>取消</Button><Button disabled={busy} onClick={() => void save()}>{busy ? '创建中…' : '创建并编辑规则'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
export default function ProjectPolicies() {
  const { projectId = '' } = useParams();
  const { session } = useIam();
  useEffect(() => { document.title = '策略与授权 · AIoT'; }, []);
  return <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4"><BreadcrumbComp title="策略与授权" items={[{ title: '项目', to: '/projects' }]} /><ProjectWorkspaceShell navigationMode="sidebar" activePrimary="policies"><div className="min-w-0 p-4 sm:p-6"><SWRConfig key={projectId + (session?.sessionId ?? 'anonymous')} value={{ provider: () => new Map() }}><Workspace key={projectId} projectId={projectId} /></SWRConfig></div></ProjectWorkspaceShell></StyleAwareWrapper>;
}
