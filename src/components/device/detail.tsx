import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Action, DataTable, ErrorNotice, Loading, Panel } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { devicePath, groupPath, deviceRequest, formatTime, nodeLabels, type DeviceDetail, type DeviceMembership, type HardwareProfile, type HardwareObservation } from '@/api/device/client';
import { Fact, CursorList, LifecycleBadge } from './shared';
import { useDeviceResource } from './use-device-resource';
import ResourceTags from './tags';

function Hardware({ projectId, id }: { projectId: string; id: string }) {
  const resource = useDeviceResource<HardwareProfile>(projectId, `${devicePath(id)}/hardware-profile`);
  function observation(label: string, value: HardwareObservation | null) {
    return <Panel title={label}>{value ? <dl><Fact label="序列号">{value.serialNumber}</Fact><Fact label="硬件版本">{value.hardwareVersion}</Fact><Fact label="来源">{value.source}</Fact><Fact label="接收时间">{formatTime(value.receivedAt)}</Fact><Fact label="网卡地址">{value.macAddresses?.length ? value.macAddresses.map((m, i) => <div key={i}>{m.interfaceName ?? '未命名网卡'} · {m.address}</div>) : '—'}</Fact></dl> : <p className="text-sm text-muted-foreground">尚未收到此来源的硬件资料。</p>}</Panel>;
  }
  return <div className="space-y-4"><ErrorNotice error={resource.error} retry={() => resource.mutate()} />{resource.isLoading && <Loading />}{resource.data && <div className="grid gap-4 lg:grid-cols-2">{observation('可信登记资料', resource.data.verified)}{observation('设备自报资料', resource.data.reported)}</div>}</div>;
}

export default function DeviceDetails({ projectId, id, back, openGroup, backLabel = '返回设备列表' }: { projectId: string; id: string; back: () => void; openGroup: (id: string) => void; backLabel?: string }) {
  const [tab, setTab] = useState('profile');
  const resource = useDeviceResource<DeviceDetail>(projectId, devicePath(id));
  const device = resource.data;
  const refresh = () => { void resource.mutate(); };
  return <div className="space-y-5">
    <Button variant="ghost" onClick={back}><ArrowLeft className="size-4" />{backLabel}</Button>
    <ErrorNotice error={resource.error} retry={() => resource.mutate()} />
    {resource.isLoading && <Loading />}
    {device && <>
      <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-all text-lg font-semibold">{device.nickname || device.deviceName}</h2><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{id}</p></div><LifecycleBadge value={device.lifecycle} /></header>
      <p className="text-sm text-muted-foreground">已激活表示设备凭证至少通过一次正式认证，不代表设备当前在线。</p>
      {device.lifecycle === 'DELETING' && <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">设备正在删除，资料和分类已停止编辑。若清理未完成，可继续删除同一设备。</p>}
      <Tabs value={tab} onValueChange={v => setTab(String(v))} className="flex-col! gap-4"><TabsList variant="line" className="justify-start" aria-label="设备详情"><TabsTrigger value="profile">设备资料</TabsTrigger><TabsTrigger value="tags">标签</TabsTrigger><TabsTrigger value="groups">所属分组</TabsTrigger><TabsTrigger value="hardware">硬件资料</TabsTrigger></TabsList>
        <TabsContent value="profile"><Panel title="设备档案" actions={device.lifecycle !== 'DELETING' && <Action label="编辑资料" permission="device:update" description="设备名称和产品归属固定。昵称和说明可以修改，留空表示清空。" initial={{ nickname: device.nickname ?? '', description: device.description ?? '' }} fields={[{ name: 'nickname', label: '昵称', maxLength: 128 }, { name: 'description', label: '说明', type: 'textarea', maxLength: 512 }]} run={async v => { await deviceRequest(projectId, `${devicePath(id)}/profile`, 'PUT', { nickname: v.nickname.trim() || null, description: v.description.trim() || null, customIconUrl: device.customIconUrl });  }} done={refresh} />}>
          <dl><Fact label="设备名称">{device.deviceName}</Fact><Fact label="昵称">{device.nickname}</Fact><Fact label="产品 ID"><Link className="underline underline-offset-4" to={`/projects/${encodeURIComponent(projectId)}/products/${encodeURIComponent(device.productId)}`}>{device.productId}</Link></Fact><Fact label="设备类型">{device.virtualDevice ? '虚拟设备' : '实体设备'} · {nodeLabels[device.nodeType]}</Fact><Fact label="硬件标识">{device.hardwareUuid}</Fact><Fact label="认证路线">{device.authRoute}</Fact><Fact label="首次认证时间">{formatTime(device.activation?.activatedAt)}</Fact><Fact label="激活观察时间">{formatTime(device.activation?.observedAt)}</Fact><Fact label="创建时间">{formatTime(device.createTime)}</Fact><Fact label="更新时间">{formatTime(device.updateTime)}</Fact><Fact label="说明">{device.description}</Fact></dl>
        </Panel><div className="mt-4 flex flex-wrap gap-2">
          {device.lifecycle !== 'DELETING' && <Action label={device.lifecycle === 'DISABLED' ? '启用设备' : '停用设备'} permission="device:update" description={device.lifecycle === 'DISABLED' ? '启用后按已有激活事实恢复管理状态，不代表设备立即在线。' : '停用会限制设备接入，保留设备档案和首次激活记录。提交后不等待设备断线确认。'} fields={[{ name: 'reason', label: '操作说明（选填）', type: 'textarea', maxLength: 512 }]} run={async v => { try { await deviceRequest(projectId, `${devicePath(id)}/enabled`, 'PUT', { enabled: device.lifecycle === 'DISABLED', reason: v.reason.trim() || null });  } finally { refresh(); } }} />}
          <Action label={device.lifecycle === 'DELETING' ? '继续删除' : '删除设备'} submitLabel="确认删除" danger permission="device:delete" description={`删除「${device.deviceName}」将清理设备档案、凭证和拓扑关系，无法撤销。失败或超时可能已经进入删除中，请核对当前状态后继续删除同一设备。`} fields={[{ name: 'confirm', label: '输入设备名称确认', required: true, validate: value => value === device.deviceName ? undefined : '请输入完整设备名称' }, { name: 'reason', label: '操作说明（选填）', type: 'textarea', maxLength: 512 }]} run={async v => { try { await deviceRequest(projectId, devicePath(id) + (v.reason.trim() ? '?reason=' + encodeURIComponent(v.reason.trim()) : ''), 'DELETE');  } catch (e) { refresh(); throw e; } }} done={back} />
        </div></TabsContent>
        <TabsContent value="tags">{tab === 'tags' && <ResourceTags projectId={projectId} path={devicePath(id)} readOnly={device.lifecycle === 'DELETING'} />}</TabsContent>
        <TabsContent value="groups">{tab === 'groups' && <CursorList<DeviceMembership> projectId={projectId} path={`${devicePath(id)}/groups`} emptyTitle="尚未加入分组" emptyDescription="到静态分组的成员页添加设备，这里只显示直接所属组。">{(items, reload) => <DataTable rows={items} columns={[{ label: '分组', render: m => <Button variant="link" onClick={() => openGroup(m.group.groupId)}>{m.group.name}</Button> }, { label: '加入时间', render: m => formatTime(m.joinedAt) }, ...device.lifecycle !== 'DELETING' ? [{ label: '操作', render: (m: DeviceMembership) => <Action label="移出分组" permission="device:update" description={`只移除与「${m.group.name}」的直接关系，不删除设备，也不影响其他组。`} run={async () => { await deviceRequest(projectId, `${groupPath(m.group.groupId)}/devices/${encodeURIComponent(id)}`, 'DELETE');  }} done={reload} /> }] : []]} />}</CursorList>}</TabsContent>
        <TabsContent value="hardware">{tab === 'hardware' && <Hardware projectId={projectId} id={id} />}</TabsContent>
      </Tabs>
    </>}
  </div>;
}
