import { formatDateTime } from '@/lib/date-time';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import useSWR, { SWRConfig } from 'swr';
import { useIam } from '@/context/iam-context/identity';
import ProductPicker from '@/components/policy/product-picker';
import { Plus, RefreshCw, Search, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import { BreadcrumbTrail } from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import PolicyDetail from '@/components/policy/policy-detail';
import Diagnostics from '@/components/policy/diagnostics';
import { Status, Failure, Field, Loading, Pager } from '@/components/policy/shared';
import { policyRequest, query, type Policy, type PolicyType, type Page } from '@/api/policy/client';
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
    <Tabs value={section} onValueChange={value => setParams(value === 'policies' ? {} : { section: String(value) })} className="flex-col! gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b">
      <TabsList variant="line" aria-label="授权功能" className="h-9! shrink-0 justify-start gap-4 p-0!">
        <TabsTrigger value="policies" className="h-9 flex-none px-1! after:inset-x-0 after:-bottom-px after:h-0.5">自定义策略</TabsTrigger>
        <TabsTrigger value="diagnostics" className="h-9 flex-none px-1! after:inset-x-0 after:-bottom-px after:h-0.5">权限排查</TabsTrigger>
        <TabsTrigger value="standard" className="h-9 flex-none px-1! after:inset-x-0 after:-bottom-px after:h-0.5">标准通信</TabsTrigger>
      </TabsList>
      {section === 'policies' && <Button onClick={openCreate}><Plus className="size-4" />新建自定义策略</Button>}
      </div>
      <TabsContent value={section}>
    {section === 'policies' && <div className="space-y-4">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[10rem_9rem_minmax(0,1fr)]">
        <Field title="策略类型">
          <Select value={type} onValueChange={value => { if (value) { setType(value as PolicyType); setCursors(['']); } }}>
            <SelectTrigger className="w-full" aria-label="策略类型"><SelectValue>{type === 'MQTT_DEVICE' ? '设备通信' : '资源操作'}</SelectValue></SelectTrigger>
            <SelectContent className="rounded-md!" alignItemWithTrigger={false}><SelectItem value="MQTT_DEVICE">设备通信</SelectItem><SelectItem value="MANAGEMENT">资源操作</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field title="状态">
          <Select value={status} onValueChange={value => { setStatus(value ?? ''); setCursors(['']); }}>
            <SelectTrigger className="w-full" aria-label="策略状态"><SelectValue>{({ DRAFT: '草稿', ACTIVE: '已生效', ARCHIVED: '已归档' } as Record<string, string>)[status] ?? '全部状态'}</SelectValue></SelectTrigger>
            <SelectContent className="rounded-md!" alignItemWithTrigger={false}><SelectItem value="">全部状态</SelectItem><SelectItem value="DRAFT">草稿</SelectItem><SelectItem value="ACTIVE">已生效</SelectItem><SelectItem value="ARCHIVED">已归档</SelectItem></SelectContent>
          </Select>
        </Field>
        <form className="flex min-w-0 items-end gap-2 sm:col-span-2 lg:col-span-1" onSubmit={e => { e.preventDefault(); setSearch(nameFilter.trim()); setCursors(['']); }}>
          <div className="min-w-0 flex-1"><Field title="策略名称"><Input placeholder="搜索策略名称" value={nameFilter} maxLength={128} onChange={e => setNameFilter(e.target.value)} /></Field></div>
          <Button type="submit" variant="outline" size="icon" aria-label="搜索策略"><Search className="size-4" /></Button>
        <Button type="button" variant="outline" size="icon" aria-label="刷新策略" disabled={list.isValidating} onClick={() => void list.mutate()}><RefreshCw className="size-4" /></Button>
        </form>
      </div>
      {type === 'MANAGEMENT' && <p className="text-sm text-muted-foreground">资源操作策略用于账号、应用和项目角色，不改变设备 MQTT 通道。</p>}
      <Failure error={list.error} retry={() => list.mutate()} />
      {list.isLoading ? <Loading /> : !list.error && list.data && <>
        {!list.data.items.length ? <div className="rounded-lg border border-dashed px-6 py-12 text-center"><ShieldCheck className="mx-auto mb-3 size-7 text-muted-foreground" /><h3 className="font-medium">{search || status ? '没有符合条件的策略' : '还没有自定义策略'}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{search || status ? '调整名称或状态后重新查找。' : '这不会影响标准设备接入。需要禁止某台设备上报、按组调整权限时，再创建策略。'}</p>{!search && !status && <Button variant="outline" className="mt-5" onClick={openCreate}>创建第一条自定义策略<ArrowRight className="size-4" /></Button>}</div> : <GatewayDataTable rows={list.data.items} columns={[{ label: '策略名称', render: p => <Button variant="link" className="h-auto! max-w-64 min-w-0 p-0! font-medium" title={p.name} onClick={() => setParams({ policy: p.policyId })}><span className="truncate">{p.name}</span></Button> }, { label: '描述', render: p => <span className="block max-w-64 truncate text-muted-foreground" title={p.description || undefined}>{p.description || '—'}</span> }, { label: '状态', render: p => <Status value={p.status} /> }, { label: type === 'MQTT_DEVICE' ? '产品 ID' : '所属资源', render: p => p.scopeProductId ? <Link className="text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring" to={`/projects/${encodeURIComponent(projectId)}/products/${encodeURIComponent(p.scopeProductId)}`}>{p.scopeProductId}</Link> : <span>当前项目资源</span> }, { label: '发布版本', render: p => <span className="whitespace-nowrap">{p.currentVersionNo ? 'v' + p.currentVersionNo : '尚未发布'}{p.scheduledVersionNo && <span className="block text-xs text-muted-foreground">v{p.scheduledVersionNo} 待生效</span>}</span> }, { label: '更新时间', render: p => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(p.updateTime)}</span> }, { label: '操作', render: p => <div className="flex items-center gap-1 whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => setParams({ policy: p.policyId })}>查看</Button>{p.status !== 'ARCHIVED' && p.ownershipType !== 'SYSTEM_MANAGED' && <Button size="sm" variant="ghost" onClick={() => setParams({ policy: p.policyId, edit: '1' })}>编辑规则</Button>}</div> }]} />}
        <Pager previous={cursors.length > 1 ? () => setCursors(c => c.slice(0, -1)) : undefined} next={list.data.hasMore && list.data.nextCursor ? () => setCursors(c => [...c, list.data!.nextCursor!]) : undefined} busy={list.isValidating} />
      </>}
    </div>}
    {section === 'diagnostics' && <Diagnostics projectId={projectId} />}
    {section === 'standard' && <div className="space-y-4"><div><h3 className="font-medium">平台协议内置通道</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">以下是协议目录，不是策略记录。产品和设备标识由已认证身份填入；设备只能访问自己的通信资源。属性是否存在及内容是否合法，由物模型校验。</p><p className="mt-2 text-xs text-muted-foreground">实际可用权限可能被自定义策略限制，请到“权限排查”查看服务端结果。</p></div><GatewayDataTable rows={[...standardChannels]} columns={[{ label: '能力', render: c => c.label }, { label: '设备操作', render: c => c.action === 'mqtt:Publish' ? '发布' : '订阅' }, { label: 'Topic 模板', render: c => <span>{c.topic}</span> }]} /></div>}
      </TabsContent>
    </Tabs>
    <Dialog open={create} onOpenChange={v => { if (!busy) setCreate(v); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(calc(100%-2rem),36rem)]! grid-rows-[auto_minmax(0,1fr)_auto] gap-0! overflow-hidden p-0!" showCloseButton={!busy}>
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>新建自定义策略</DialogTitle>
          <DialogDescription className="leading-6">创建草稿后继续配置规则，发布后生效。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
          <Field title="策略类型">
            <Select value={createType} disabled={busy} onValueChange={value => { if (value) setCreateType(value as PolicyType); }}>
              <SelectTrigger className="w-full" aria-label="策略类型"><SelectValue>{createType === 'MQTT_DEVICE' ? '设备通信' : '资源操作'}</SelectValue></SelectTrigger>
              <SelectContent className="rounded-md!" alignItemWithTrigger={false}><SelectItem value="MQTT_DEVICE">设备通信</SelectItem><SelectItem value="MANAGEMENT">资源操作</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field title="策略名称"><Input value={name} maxLength={128} disabled={busy} placeholder="例如：限制诊断消息上报" onChange={e => setName(e.target.value)} /></Field>
          {createType === 'MQTT_DEVICE' && <ProductPicker projectId={projectId} value={productId} disabled={busy} onChange={setProductId} />}
          <Field title="用途说明（选填）"><Textarea className="min-h-24 resize-y" placeholder="说明策略的使用场景，方便后续维护" value={description} disabled={busy} maxLength={512} onChange={e => setDescription(e.target.value)} /></Field>
          <Failure error={error} />
        </div>
        <DialogFooter className="m-0 px-6 py-4">
          <Button variant="outline" disabled={busy} onClick={() => setCreate(false)}>取消</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? '创建中…' : '创建并编辑规则'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
export default function ProjectPolicies() {
  const { projectId = '' } = useParams();
  const { session } = useIam();
  useEffect(() => { document.title = '策略与授权 · AIoT'; }, []);
  return <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4"><ProjectWorkspaceShell navigationMode="sidebar" activePrimary="policies" breadcrumbs={<BreadcrumbTrail title="策略与授权" items={[{ title: '项目', to: '/projects' }]} />}><SWRConfig key={projectId + (session?.sessionId ?? 'anonymous')} value={{ provider: () => new Map() }}><Workspace key={projectId} projectId={projectId} /></SWRConfig></ProjectWorkspaceShell></StyleAwareWrapper>;
}
