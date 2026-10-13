import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useIam } from '@/context/iam-context/identity';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { DataTable } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CursorList, DeviceSelect, LifecycleBadge } from '@/components/device/shared';
import DeviceDetails from '@/components/device/detail';
import { GroupList, GroupDetails } from '@/components/device/groups';
import CreateVirtualDevice from '@/components/device/create-virtual';
import { query, lifecycleLabels, nodeLabels, type DeviceSummary } from '@/api/device/client';

function Workspace({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') === 'groups' ? 'groups' : 'devices';
  const deviceId = params.get('device');
  const groupId = params.get('group');
  const requestedSearchBy = params.get('searchBy') ?? 'keyword';
  const searchBy = ['keyword', 'deviceId', 'productId', 'hardwareUuid'].includes(requestedSearchBy) ? requestedSearchBy : 'keyword';
  const search = params.get('search') ?? '';
  const [draft, setDraft] = useState(search);
  const lifecycle = params.get('lifecycle') ?? '';
  const virtual = params.get('virtualDevice') ?? '';
  const nodeType = params.get('nodeType') ?? '';
  function update(name: string, value: string) {
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(name, value); else next.delete(name); return next; });
  }
  function openDevice(id: string) { setParams(previous => { const next = new URLSearchParams(previous); const origin = next.get('group'); next.delete('group'); next.set('device', id); if (origin) next.set('fromGroup', origin); return next; }); }
  function openGroup(id: string) { setParams(previous => { const next = new URLSearchParams(previous); next.delete('device'); next.set('section', 'groups'); next.set('group', id); return next; }); }
  const path = 'devices' + query({ [searchBy]: search, lifecycle, virtualDevice: virtual, nodeType });
  if (deviceId) return <DeviceDetails key={deviceId} projectId={projectId} id={deviceId} backLabel={params.get('fromGroup') ? '返回分组成员' : '返回设备列表'} back={() => setParams(previous => { const next = new URLSearchParams(previous); next.delete('device'); const origin = next.get('fromGroup'); if (origin) next.set('group', origin); next.delete('fromGroup'); return next; })} openGroup={openGroup} />;
  if (groupId) return <GroupDetails key={groupId} projectId={projectId} id={groupId} back={() => update('group', '')} openGroup={openGroup} openDevice={openDevice} />;
  return <Tabs value={section} onValueChange={v => update('section', v === 'groups' ? 'groups' : '')} className="flex-col! gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b"><TabsList variant="line" aria-label="设备管理" className="justify-start"><TabsTrigger value="devices">设备列表</TabsTrigger><TabsTrigger value="groups">静态分组</TabsTrigger></TabsList>{section === 'devices' && <CreateVirtualDevice projectId={projectId} done={openDevice} />}</div>
    <TabsContent value="devices"><div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3"><DeviceSelect label="管理状态" value={lifecycle} onChange={v => update('lifecycle', v)} options={[{ value: '', label: '全部管理状态' }, ...Object.entries(lifecycleLabels).map(([value, label]) => ({ value, label }))]} /><DeviceSelect label="设备类型" value={virtual} onChange={v => update('virtualDevice', v)} options={[{ value: '', label: '全部设备类型' }, { value: 'false', label: '实体设备' }, { value: 'true', label: '虚拟设备' }]} /><DeviceSelect label="节点类型" value={nodeType} onChange={v => update('nodeType', v)} options={[{ value: '', label: '全部节点类型' }, ...Object.entries(nodeLabels).map(([value, label]) => ({ value, label }))]} /></div>
      <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); update('search', draft.trim()); }}><div className="w-44"><DeviceSelect label="查询字段" value={searchBy} options={[{ value: 'keyword', label: '名称 / 昵称前缀' }, { value: 'deviceId', label: '设备 ID（精确）' }, { value: 'productId', label: '产品 ID（精确）' }, { value: 'hardwareUuid', label: '硬件标识（精确）' }]} onChange={v => { setDraft(''); setParams(previous => { const next = new URLSearchParams(previous); next.set('searchBy', v); next.delete('search'); return next; }); }} /></div><Input className="min-w-40 flex-1" aria-label="设备查询内容" placeholder={searchBy === 'keyword' ? '输入设备名称或昵称前缀' : '输入完整标识'} value={draft} maxLength={128} onChange={e => setDraft(e.target.value)} /><Button type="submit" variant="outline">查询</Button><Button type="button" variant="ghost" onClick={() => { setDraft(''); setParams({}); }}>重置</Button></form>
      <p className="text-xs text-muted-foreground">管理状态不代表实时在线状态。实体设备经预配登记后出现在列表中。</p>
      <CursorList<DeviceSummary> key={path} projectId={projectId} path={path} emptyTitle={search || lifecycle || virtual || nodeType ? '没有符合条件的设备' : '当前项目尚无设备'} emptyDescription={search || lifecycle || virtual || nodeType ? '调整筛选条件后重新查询。' : '实体设备完成预配登记后会出现在这里，也可以创建虚拟设备档案。'}>{items => <DataTable rows={items} columns={[
        { label: '设备名称', render: d => <div><Button variant="link" className="h-auto! max-w-64 p-0!" onClick={() => openDevice(d.deviceId)}><span className="truncate">{d.nickname || d.deviceName}</span></Button>{d.nickname && <span className="block text-xs text-muted-foreground">{d.deviceName}</span>}</div> },
        { label: '设备 ID', render: d => <span className="font-mono text-xs">{d.deviceId}</span> }, { label: '产品 ID', render: d => d.productId },
        { label: '管理状态', render: d => <LifecycleBadge value={d.lifecycle} /> }, { label: '类型', render: d => <span className="whitespace-nowrap">{d.virtualDevice ? '虚拟' : '实体'} · {nodeLabels[d.nodeType]}</span> },
        { label: '操作', render: d => <Button variant="ghost" size="sm" onClick={() => openDevice(d.deviceId)}>{d.lifecycle === 'DELETING' ? '查看并继续删除' : '查看详情'}</Button> },
      ]} />}</CursorList>
    </div></TabsContent>
    <TabsContent value="groups">{section === 'groups' && <GroupList projectId={projectId} openGroup={openGroup} />}</TabsContent>
  </Tabs>;
}

export default function ProjectDevicesPage() {
  const { projectId = '' } = useParams();
  const { session } = useIam();
  useEffect(() => { document.title = '设备 · AIoT'; }, []);
  return <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4"><BreadcrumbComp title="设备" items={[{ to: '/projects', title: '项目' }]} /><ProjectWorkspaceShell activePrimary="devices"><Workspace key={`${projectId}:${session?.sessionId ?? ''}`} projectId={projectId} /></ProjectWorkspaceShell></StyleAwareWrapper>;
}
