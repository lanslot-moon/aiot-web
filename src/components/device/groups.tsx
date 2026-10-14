import { DeviceTable as DataTable } from './layout';
import { useState } from 'react';
import { ArrowLeft, Users, FolderTree, LayoutDashboard, Tags } from 'lucide-react';
import { Action, ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { DeviceInput as Input, DetailField, DeviceTabsNav } from './layout';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { deviceRequest, groupPath, query, formatTime, type DeviceGroup, type GroupMember } from '@/api/device/client';
import { CursorList, LifecycleBadge } from './shared';
import { useDeviceResource } from './use-device-resource';
import ResourceTags from './tags';
import MembershipAction from './membership';

export function CreateGroup({ projectId, parentId, done }: { projectId: string; parentId?: string; done: (id: string) => void }) {
  return <Action label={parentId ? '创建子组' : '创建根组'} submitLabel="创建分组" permission="device:create" description="组名在项目内唯一，父组创建后不能移动。" fields={[{ name: 'name', label: '分组名称', required: true, maxLength: 128 }, { name: 'description', label: '说明（选填）', type: 'textarea', maxLength: 512 }]} run={async v => {
    const result = await deviceRequest<DeviceGroup>(projectId, 'device-groups', 'POST', { name: v.name.trim(), description: v.description.trim() || null, parentGroupId: parentId ?? null });
    done(result.groupId);
  }} />;
}

export function GroupList({ projectId, parentId, openGroup, showCreate = true }: { projectId: string; parentId?: string; openGroup: (id: string) => void; showCreate?: boolean }) {
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const path = 'device-groups' + query({ rootsOnly: parentId ? undefined : true, parentGroupId: parentId, keyword });
  return <div className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><form className="flex w-full gap-2 sm:w-auto" onSubmit={e => { e.preventDefault(); setKeyword(draft.trim()); }}><Input className="min-w-0 sm:w-80" aria-label="分组名称前缀" placeholder="分组名称前缀" value={draft} maxLength={128} onChange={e => setDraft(e.target.value)} /><Button type="submit" variant="outline">查询</Button></form>{showCreate && <CreateGroup projectId={projectId} parentId={parentId} done={openGroup} />}</div>
    <CursorList<DeviceGroup> key={path} projectId={projectId} path={path} emptyTitle={keyword ? '没有符合条件的分组' : parentId ? '尚无直接子组' : '尚未创建静态分组'} emptyDescription={keyword ? '调整名称前缀后重新查询。' : '静态分组用于组织设备，设备可以直接加入多个组。'}>{items => <DataTable rows={items} columns={[{ label: '分组名称', render: g => <Button variant="link" className="h-auto! max-w-56 justify-start p-0! font-medium" onClick={() => openGroup(g.groupId)}><span className="truncate" title={g.name}>{g.name}</span></Button> }, { label: '说明', render: g => <span className="block max-w-64 truncate" title={g.description ?? undefined}>{g.description || '—'}</span> }, { label: '分组 ID', render: g => <span className="block max-w-44 truncate font-mono text-xs text-muted-foreground" title={g.groupId}>{g.groupId}</span> }, { label: '层级', render: g => g.depth }, { label: '创建时间', render: g => <span className="text-xs text-muted-foreground">{formatTime(g.createTime)}</span> }, { label: '更新时间', render: g => <span className="text-xs text-muted-foreground">{formatTime(g.updateTime)}</span> }]} />}</CursorList>
  </div>;
}

export function GroupDetails({ projectId, id, back, openGroup, openDevice }: { projectId: string; id: string; back: () => void; openGroup: (id: string) => void; openDevice: (id: string) => void }) {
  const [tab, setTab] = useState('members');
  const [memberRevision, setMemberRevision] = useState(0);
  const resource = useDeviceResource<DeviceGroup>(projectId, groupPath(id) + '?includeCounts=true');
  const group = resource.data;
  const refresh = () => { setMemberRevision(v => v + 1); void resource.mutate(); };
  return <div className="min-w-0 space-y-4"><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={back}><ArrowLeft className="size-4" />返回根组列表</Button>{group?.parentGroupId && <Button variant="outline" onClick={() => openGroup(group.parentGroupId!)}>查看父组</Button>}</div><ErrorNotice error={resource.error} retry={() => resource.mutate()} />{resource.isLoading && <Loading />}
    {group && <><header className="flex flex-col gap-4 border-t pt-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 space-y-2"><h2 className="break-words text-lg font-semibold tracking-tight">{group.name}</h2><div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><span className="shrink-0">分组 ID</span><code className="truncate font-mono" title={id}>{id}</code><CopyIdButton value={id} label="分组 ID" /></div></div><div className="flex shrink-0 flex-wrap gap-2"><Action label="编辑分组" submitLabel="保存更改" permission="device:update" initial={{ name: group.name, description: group.description ?? '' }} fields={[{ name: 'name', label: '分组名称', required: true, maxLength: 128 }, { name: 'description', label: '说明', type: 'textarea', maxLength: 512 }]} run={v => deviceRequest(projectId, groupPath(id), 'PUT', { name: v.name.trim(), description: v.description.trim() || null })} done={() => { void resource.mutate(); }} /><Action label="删除分组" danger permission="device:delete" description={`删除「${group.name}」只清理分类关系和组标签，不删除设备。有子组时必须先处理子组。`} fields={[{ name: 'confirm', label: '输入分组名称确认', required: true, validate: v => v === group.name ? undefined : '请输入完整分组名称' }]} run={() => deviceRequest(projectId, groupPath(id), 'DELETE')} done={back} /></div></header>
      <Tabs value={tab} onValueChange={v => setTab(String(v))} className="flex-col! gap-4"><DeviceTabsNav variant="default" label="静态分组详情" items={[{ value: 'members', label: '直接成员', icon: Users }, { value: 'children', label: '子组', icon: FolderTree }, { value: 'profile', label: '分组资料', icon: LayoutDashboard }, { value: 'tags', label: '组标签', icon: Tags }]} />
        <TabsContent value="members">{tab === 'members' && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{group.counts ? `直接成员 ${group.counts.directDeviceCount} 台。` : ''}不包含子组设备。</p><div className="flex flex-wrap gap-2"><MembershipAction projectId={projectId} groupId={id} done={refresh} /><MembershipAction projectId={projectId} groupId={id} remove done={refresh} /></div></div><CursorList<GroupMember> key={memberRevision} projectId={projectId} path={`${groupPath(id)}/devices`} emptyTitle="尚无直接成员" emptyDescription="通过“添加成员”从当前项目的候选设备中选择。">{(items, reload) => <DataTable stickyActions rows={items} columns={[{ label: '设备名称', render: m => <Button variant="link" className="h-auto! max-w-56 justify-start p-0! font-medium" onClick={() => openDevice(m.device.deviceId)}>{m.device.deviceName}</Button> }, { label: '设备 ID', render: m => <span className="block max-w-44 truncate font-mono text-xs text-muted-foreground" title={m.device.deviceId}>{m.device.deviceId}</span> }, { label: '管理状态', render: m => <LifecycleBadge value={m.device.lifecycle} /> }, { label: '操作', render: m => <Action label="移出分组" permission="device:update" description="只移除当前组的直接成员关系，不删除设备。" run={() => deviceRequest(projectId, `${groupPath(id)}/devices/${encodeURIComponent(m.device.deviceId)}`, 'DELETE')} done={() => { reload(); void resource.mutate(); }} /> }]} />}</CursorList></div>}</TabsContent>
        <TabsContent value="children">{tab === 'children' && <GroupList key={id} projectId={projectId} parentId={id} openGroup={openGroup} />}</TabsContent>
        <TabsContent value="tags">{tab === 'tags' && <ResourceTags projectId={projectId} path={groupPath(id)} />}</TabsContent>
        <TabsContent value="profile"><div className="grid items-start gap-6 xl:grid-cols-2"><section className="min-w-0 rounded-xl border p-4 sm:p-5"><CardTitle className="mb-4 text-base">基本资料</CardTitle><dl className="grid gap-6"><DetailField label="分组名称">{group.name}</DetailField><DetailField label="说明">{group.description}</DetailField><DetailField label="父分组">{group.parentGroupId ? <Button variant="link" className="h-auto! max-w-full justify-start whitespace-normal p-0! text-left text-sm! font-normal" onClick={() => openGroup(group.parentGroupId!)}>{group.parentGroupId}</Button> : '根分组'}</DetailField><DetailField label="层级深度">{group.depth}</DetailField></dl></section><section className="min-w-0 rounded-xl border p-4 sm:p-5"><CardTitle className="mb-4 text-base">成员与记录</CardTitle><dl className="grid gap-6"><DetailField label="直接成员">{group.counts ? group.counts.directDeviceCount + ' 台' : '—'}</DetailField><DetailField label="创建时间">{formatTime(group.createTime)}</DetailField><DetailField label="更新时间">{formatTime(group.updateTime)}</DetailField></dl></section></div></TabsContent>
      </Tabs>
    </>}
  </div>;
}
