import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useIam } from '@/context/iam-context/identity';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

import { Button } from '@/components/ui/button';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { DeviceInput as Input, DeviceTabsNav, DeviceTable as DataTable } from '@/components/device/layout';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { CursorList, DeviceSelect, LifecycleBadge } from '@/components/device/shared';
import DeviceDetails from '@/components/device/detail';
import { GroupList, GroupDetails, CreateGroup } from '@/components/device/groups';
import CreateVirtualDevice from '@/components/device/create-virtual';
import { query, formatTime, lifecycleLabels, nodeLabels, type DeviceSummary } from '@/api/device/client';

function Workspace({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') === 'groups' ? 'groups' : 'devices';
  const deviceId = params.get('device');
  const groupId = params.get('group');
  const requestedSearchBy = params.get('searchBy') ?? 'keyword';
  const searchBy = ['keyword', 'deviceId', 'productId', 'hardwareUuid'].includes(requestedSearchBy) ? requestedSearchBy : 'keyword';
  const search = params.get('search') ?? '';
  const [draft, setDraft] = useState(search);
  const productScope = params.get('productScope') ?? '';
  const [draftProduct, setDraftProduct] = useState(productScope);
  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => { setDraftProduct(productScope); }, [productScope]);
  const lifecycle = params.get('lifecycle') ?? '';
  const virtual = params.get('virtualDevice') ?? '';
  const nodeType = params.get('nodeType') ?? '';
  function update(name: string, value: string) {
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(name, value); else next.delete(name); return next; });
  }
  function openDevice(id: string) { setParams(previous => { const next = new URLSearchParams(previous); const origin = next.get('group'); next.delete('group'); next.set('device', id); if (origin) next.set('fromGroup', origin); return next; }); }
  function openGroup(id: string) { setParams(previous => { const next = new URLSearchParams(previous); next.delete('device'); next.set('section', 'groups'); next.set('group', id); return next; }); }
  const path = 'devices' + query({ [searchBy]: search, lifecycle, virtualDevice: virtual, nodeType, ...(searchBy === 'hardwareUuid' ? { productId: productScope } : {}) });
  if (deviceId) return <DeviceDetails key={deviceId} projectId={projectId} id={deviceId} backLabel={params.get('fromGroup') ? '返回分组成员' : '返回设备列表'} back={() => setParams(previous => { const next = new URLSearchParams(previous); next.delete('device'); const origin = next.get('fromGroup'); if (origin) next.set('group', origin); next.delete('fromGroup'); return next; })} openGroup={openGroup} />;
  if (groupId) return <GroupDetails key={groupId} projectId={projectId} id={groupId} back={() => update('group', '')} openGroup={openGroup} openDevice={openDevice} />;
  return <Tabs value={section} onValueChange={v => update('section', v === 'groups' ? 'groups' : '')} className="flex-col! gap-4">
    <DeviceTabsNav label="设备管理" items={[{ value: 'devices', label: '设备列表' }, { value: 'groups', label: '静态分组' }]} actions={section === 'devices' ? <CreateVirtualDevice projectId={projectId} done={openDevice} /> : <CreateGroup projectId={projectId} done={openGroup} />} />
    <TabsContent value="devices"><div className="space-y-4">
      <form className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 xl:grid-cols-[7rem_7rem_7rem_minmax(0,1fr)]" aria-label="设备筛选" onSubmit={e => {
        e.preventDefault();
        setParams(previous => {
          const next = new URLSearchParams(previous);
          const value = draft.trim();
          if (value) next.set('search', value); else next.delete('search');
          if (searchBy === 'hardwareUuid' && draftProduct.trim()) next.set('productScope', draftProduct.trim());
          else next.delete('productScope');
          return next;
        });
      }}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <DeviceSelect label="管理状态" value={lifecycle} onChange={v => update('lifecycle', v)} options={[{ value: '', label: '全部状态' }, ...Object.entries(lifecycleLabels).map(([value, label]) => ({ value, label }))]} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <DeviceSelect label="设备类型" value={virtual} onChange={v => update('virtualDevice', v)} options={[{ value: '', label: '全部类型' }, { value: 'false', label: '实体设备' }, { value: 'true', label: '虚拟设备' }]} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <DeviceSelect label="节点类型" value={nodeType} onChange={v => update('nodeType', v)} options={[{ value: '', label: '全部节点' }, ...Object.entries(nodeLabels).map(([value, label]) => ({ value, label }))]} />
        </div>
        <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-3 xl:col-span-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center justify-start gap-2 sm:grid-cols-[9rem_minmax(8rem,14rem)_auto_auto]">
            <div className="col-span-3 min-w-0 sm:col-span-1"><DeviceSelect label="查询字段" value={searchBy} options={[{ value: 'keyword', label: '设备名称前缀' }, { value: 'deviceId', label: '设备 ID' }, { value: 'productId', label: '产品 ID' }, { value: 'hardwareUuid', label: '硬件标识' }]} onChange={v => {
            setDraft(''); setDraftProduct('');
            setParams(previous => { const next = new URLSearchParams(previous); next.set('searchBy', v); next.delete('search'); next.delete('productScope'); return next; });
          }} /></div>
          <Input className="w-full" aria-label="设备查询内容" placeholder={searchBy === 'keyword' ? '输入设备名称前缀' : '输入完整标识，精确查询'} value={draft} maxLength={128} onChange={e => setDraft(e.target.value)} />
          <Button type="submit" variant="outline">查询</Button>
          <Button type="button" variant="ghost" onClick={() => { setDraft(''); setDraftProduct(''); setParams(previous => { const next = new URLSearchParams(previous); ['search', 'searchBy', 'productScope', 'lifecycle', 'virtualDevice', 'nodeType'].forEach(key => next.delete(key)); return next; }); }}>重置</Button>
          </div>
        </div>
        {searchBy === 'hardwareUuid' && <label className="col-span-2 sm:col-span-3 xl:col-span-4 flex max-w-lg min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium">所属产品 ID</span>
          <Input aria-label="硬件标识所属产品 ID" placeholder="输入所属产品的完整 ID" required value={draftProduct} maxLength={128} onChange={e => setDraftProduct(e.target.value)} />
        </label>}
      </form>
      <CursorList<DeviceSummary> key={path} projectId={projectId} path={path} emptyTitle={search || lifecycle || virtual || nodeType ? '没有符合条件的设备' : '当前项目尚无设备'} emptyDescription={search || lifecycle || virtual || nodeType ? '调整筛选条件后重新查询。' : '实体设备完成预配登记后会出现在这里，也可以创建虚拟设备档案。'}>{items => <DataTable stickyActions rows={items} columns={[
        { label: '设备名称', render: d => <Button variant="link" className="h-auto! max-w-48 p-0! font-medium" onClick={() => openDevice(d.deviceId)}><span className="min-w-0 truncate py-1 underline-offset-4 group-hover/button:underline group-focus-visible/button:underline" title={d.deviceName}>{d.deviceName}</span></Button> },
        { label: '设备 ID', render: d => <div className="flex max-w-44 items-center gap-0.5"><code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={d.deviceId}>{d.deviceId}</code><CopyIdButton value={d.deviceId} label="Device ID" /></div> },
        { label: '产品 ID', render: d => <Button variant="link" className="h-auto! max-w-40 p-0! font-mono text-xs text-muted-foreground" nativeButton={false} render={<Link to={'/projects/' + encodeURIComponent(projectId) + '/products/' + encodeURIComponent(d.productId)} />}><span className="min-w-0 truncate py-1 underline-offset-4 group-hover/button:underline group-focus-visible/button:underline" title={d.productId}>{d.productId}</span></Button> },
        { label: '管理状态', render: d => <LifecycleBadge value={d.lifecycle} /> },
        { label: '设备类型', render: d => d.virtualDevice ? '虚拟设备' : '实体设备' },
        { label: '节点类型', render: d => nodeLabels[d.nodeType] },
        { label: '激活时间', render: d => <span className="whitespace-nowrap text-xs text-muted-foreground">{d.activation ? formatTime(d.activation.activatedAt) : '尚无激活记录'}</span> },
        { label: '创建时间', render: d => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatTime(d.createTime)}</span> },
        { label: '操作', render: d => <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openDevice(d.deviceId)}>{d.lifecycle === 'DELETING' ? '查看并继续处理' : '查看详情'}</Button> },
      ]} />}</CursorList>
    </div></TabsContent>
    <TabsContent value="groups">{section === 'groups' && <GroupList projectId={projectId} openGroup={openGroup} showCreate={false} />}</TabsContent>
  </Tabs>;
}

export default function ProjectDevicesPage() {
  const { projectId = '' } = useParams();
  const { session } = useIam();
  useEffect(() => { document.title = '设备 · AIoT'; }, []);
  return <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4"><BreadcrumbComp title="设备" items={[{ to: '/projects', title: '项目' }]} /><ProjectWorkspaceShell activePrimary="devices"><Workspace key={`${projectId}:${session?.sessionId ?? ''}`} projectId={projectId} /></ProjectWorkspaceShell></StyleAwareWrapper>;
}
