import { DeviceTable as DataTable } from './layout';
import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, RefreshCw, FlaskConical, Send, LayoutDashboard, Tags, FolderTree, Cpu } from 'lucide-react';
import { ProductIconPreview } from '@/components/open-platform/product-icon-preview';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Action, ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/components/iam/shared-utils';
import { request, OpenPlatformApiError } from '@/api/iam/client';
import type { ProductDetailView } from '@/types/apps/open-platform';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { devicePath, groupPath, deviceRequest, formatTime, nodeLabels, type DeviceDetail, type DeviceMembership, type HardwareProfile, type HardwareObservation } from '@/api/device/client';
import { Fact, CursorList, LifecycleBadge } from './shared';
import { useDeviceResource } from './use-device-resource';
import ResourceTags from './tags';
import DeviceCommands from './commands';
import { DeviceSection as Panel, DeviceTabsNav, DetailField } from './layout';

function useDeviceProduct(projectId: string, productId?: string) {
  return useResource<ProductDetailView>(
    productId ? `/api/v1/products/${encodeURIComponent(productId)}` : null,
    'product:view',
    url => request(url, 'GET', undefined, { projectId }),
    `device-product:${projectId}`,
  );
}

function DeviceProduct({ projectId, productId, product }: { projectId: string; productId: string; product: ReturnType<typeof useDeviceProduct> }) {
  const denied = product.error instanceof OpenPlatformApiError && product.error.status === 403;
  return <div className="min-w-0 space-y-1">
    {product.data ? (
      <Link className="break-words underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        to={`/projects/${encodeURIComponent(projectId)}/products/${encodeURIComponent(productId)}`}>
        {product.data.productName}
      </Link>
    ) : product.error ? (
      <div className="flex flex-wrap items-center gap-2" role="status">
        <span className="text-muted-foreground">{denied ? '暂无权限查看产品信息' : '产品信息加载失败'}</span>
        {!denied && <Button type="button" variant="link" className="h-auto! p-0!" disabled={product.isValidating} onClick={() => void product.mutate()}>重新加载</Button>}
      </div>
    ) : <div role="status"><Skeleton className="h-5 w-36 max-w-full" /><span className="sr-only">正在加载所属产品</span></div>}

  </div>;
}

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
  const product = useDeviceProduct(projectId, device?.productId);
  const refresh = () => { void resource.mutate(); };
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" onClick={back}><ArrowLeft className="size-4" />{backLabel}</Button>
      <Button variant="outline" disabled={resource.isValidating} onClick={refresh}><RefreshCw className="size-4" />刷新设备</Button>
    </div>
    <ErrorNotice error={resource.error} retry={() => resource.mutate()} />
    {resource.isLoading && <Loading />}
    {device && <>
      <header className="rounded-xl border bg-muted/15 p-4 sm:p-5">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
          <div className="flex min-w-0 w-full flex-1 items-start gap-4">
            {product.isLoading ? <Skeleton className="size-14 shrink-0 rounded-lg" /> : <ProductIconPreview key={product.data?.iconUrl ?? device.productId} iconUrl={product.data?.iconUrl} productName={product.data?.productName ?? '所属产品'} />}
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-lg font-semibold tracking-tight">{device.deviceName}</h2><LifecycleBadge value={device.lifecycle} /></div>
              <div className="text-sm text-muted-foreground"><DeviceProduct projectId={projectId} productId={device.productId} product={product} /></div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{device.virtualDevice ? '虚拟设备' : '实体设备'}</span><span aria-hidden className="size-1 rounded-full bg-border" /><span>{nodeLabels[device.nodeType]}</span></div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" aria-label="设备管理操作">
            {device.lifecycle !== 'DELETING' && <Action label="编辑资料" submitLabel="保存更改" permission="device:update" description="设备名称可以修改或重复，设备 ID 和产品归属保持不变。" initial={{ deviceName: device.deviceName ?? '', description: device.description ?? '' }} fields={[{ name: 'deviceName', label: '设备名称', required: true, maxLength: 128 }, { name: 'description', label: '说明', type: 'textarea', maxLength: 512 }]} run={async v => { await deviceRequest(projectId, `${devicePath(id)}/profile`, 'PUT', { deviceName: v.deviceName.trim(), description: v.description.trim() || null, customIconUrl: device.customIconUrl });  }} done={refresh} />}
          {device.lifecycle !== 'DELETING' && <Action label={device.lifecycle === 'DISABLED' ? '启用设备' : '停用设备'} submitLabel={device.lifecycle === 'DISABLED' ? '确认启用' : '确认停用'} permission="device:update" description={device.lifecycle === 'DISABLED' ? '启用后按已有激活事实恢复管理状态，不代表设备立即在线。' : '停用会限制设备接入，保留设备档案和首次激活记录。提交后不等待设备断线确认。'} fields={[{ name: 'reason', label: '操作说明（选填）', type: 'textarea', maxLength: 512 }]} run={async v => { try { await deviceRequest(projectId, `${devicePath(id)}/enabled`, 'PUT', { enabled: device.lifecycle === 'DISABLED', reason: v.reason.trim() || null });  } finally { refresh(); } }} />}
          <Action label={device.lifecycle === 'DELETING' ? '继续删除' : '删除设备'} submitLabel="确认删除" danger permission="device:delete" description={`删除「${device.deviceName}」将清理设备档案、凭证和拓扑关系，无法撤销。失败或超时可能已经进入删除中，请核对当前状态后继续删除同一设备。`} fields={[{ name: 'confirm', label: '输入设备名称确认', required: true, validate: value => value === device.deviceName ? undefined : '请输入完整设备名称' }, { name: 'reason', label: '操作说明（选填）', type: 'textarea', maxLength: 512 }]} run={async v => { try { await deviceRequest(projectId, devicePath(id) + (v.reason.trim() ? '?reason=' + encodeURIComponent(v.reason.trim()) : ''), 'DELETE');  } catch (e) { refresh(); throw e; } }} done={back} />
          </div>
        </div>
        <div className="mt-4 flex min-w-0 flex-col gap-1 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2"><span className="shrink-0">设备 ID</span><div className="flex min-w-0 items-center gap-1"><code className="truncate font-mono" title={id}>{id}</code><CopyIdButton value={id} label="设备 ID" /></div></div>
      </header>
      {device.lifecycle === 'DELETING' && <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">设备正在删除，资料和分类已停止编辑。若清理未完成，可继续删除同一设备。</p>}
      <Tabs value={tab} onValueChange={v => setTab(String(v))} className="min-w-0 flex-col! gap-4">
        <DeviceTabsNav variant="default" label="设备详情" items={[{ value: 'profile', label: '设备概览', icon: LayoutDashboard }, { value: 'tags', label: '标签', icon: Tags }, { value: 'groups', label: '所属分组', icon: FolderTree }, { value: 'hardware', label: '硬件资料', icon: Cpu }, { value: 'simulation', label: '设备模拟', icon: FlaskConical }, { value: 'commands', label: '设备指令', icon: Send }]} />
        <TabsContent value="profile">
          <div className="grid overflow-hidden rounded-xl border xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
            <section className="min-w-0 p-4 sm:p-5">
              <CardTitle className="mb-4 text-base">设备资料</CardTitle>
              <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <DetailField label="设备名称" fullWidth>{device.deviceName}</DetailField>
                <DetailField label="产品 ID" fullWidth><Link className="underline-offset-4 hover:underline" to={'/projects/' + encodeURIComponent(projectId) + '/products/' + encodeURIComponent(device.productId)}>{device.productId}</Link></DetailField>
                <DetailField label="硬件标识" fullWidth>{device.hardwareUuid}</DetailField>
                <DetailField label="设备说明" fullWidth>{device.description || '暂无说明'}</DetailField>
              </dl>
            </section>
            <section className="min-w-0 border-t bg-muted/15 p-4 sm:p-5 xl:border-t-0 xl:border-l">
              <CardTitle className="mb-4 text-base">接入记录</CardTitle>
              <dl className="grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-1">
                <DetailField label="认证方式">{{ DEVICE_SECRET: '设备密钥认证', CUSTOM: '自定义认证', GATEWAY_ASSERTED: '网关代理认证' }[device.authRoute] ?? device.authRoute}</DetailField>
                <DetailField label="首次认证">{device.activation?.activatedAt ? formatTime(device.activation.activatedAt) : '尚无认证记录'}</DetailField>
                <DetailField label="激活记录时间">{formatTime(device.activation?.observedAt)}</DetailField>
                <DetailField label="创建时间">{formatTime(device.createTime)}</DetailField>
                <DetailField label="最近更新">{formatTime(device.updateTime)}</DetailField>
              </dl>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="tags">{tab === 'tags' && <ResourceTags projectId={projectId} path={devicePath(id)} readOnly={device.lifecycle === 'DELETING'} />}</TabsContent>
        <TabsContent value="groups">{tab === 'groups' && <CursorList<DeviceMembership> projectId={projectId} path={`${devicePath(id)}/groups`} emptyTitle="尚未加入分组" emptyDescription="到静态分组的成员页添加设备，这里只显示直接所属组。">{(items, reload) => <DataTable rows={items} columns={[{ label: '分组', render: m => <Button variant="link" onClick={() => openGroup(m.group.groupId)}>{m.group.name}</Button> }, { label: '加入时间', render: m => formatTime(m.joinedAt) }, ...device.lifecycle !== 'DELETING' ? [{ label: '操作', render: (m: DeviceMembership) => <Action label="移出分组" permission="device:update" description={`只移除与「${m.group.name}」的直接关系，不删除设备，也不影响其他组。`} run={async () => { await deviceRequest(projectId, `${groupPath(m.group.groupId)}/devices/${encodeURIComponent(id)}`, 'DELETE');  }} done={reload} /> }] : []]} />}</CursorList>}</TabsContent>
        <TabsContent value="hardware">{tab === 'hardware' && <Hardware projectId={projectId} id={id} />}</TabsContent>
        <TabsContent value="simulation"><Empty className="min-h-64 rounded-lg border border-dashed"><EmptyHeader><EmptyMedia variant="icon"><FlaskConical /></EmptyMedia><EmptyTitle>设备模拟待开放</EmptyTitle><EmptyDescription>后续可在这里配置模拟数据、启动或停止模拟，并查看运行记录。</EmptyDescription></EmptyHeader></Empty></TabsContent>
        <TabsContent value="commands">{tab === 'commands' && <DeviceCommands key={id} projectId={projectId} device={device} />}</TabsContent>
      </Tabs>
    </>}
  </div>;
}
