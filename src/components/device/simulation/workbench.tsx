import { useState, type ReactNode } from 'react';
import type { DeviceDetail } from '@/api/device/client';
import { request } from '@/api/iam/client';
import { decodeMap, type ProfileVersion, type SimulationInstance } from '@/api/device/simulation';
import type { ThingModelDefinition } from '@/types/apps/open-platform';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Field, PolicySelect } from '@/components/policy/shared';
import CommandField from '../command-fields';
import { initialValue, supportsForm } from '../command-schema';
import DeviceStatus from './device-status';
import RecentExchanges from './recent-exchanges';
import { useSimulation } from './use-simulation';

export default function SimulationWorkbench({ projectId, device, instance, status, automatic, blocked }: { projectId: string; device: DeviceDetail; instance?: SimulationInstance; status: string; automatic: ReactNode; blocked: boolean }) {
  const [tab, setTab] = useState('report');
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [strategy, setStrategy] = useState('success');
  const [reportChanged, setReportChanged] = useState(true);
  const model = useResource<ThingModelDefinition | null>(`/api/v1/products/${encodeURIComponent(device.productId)}/model/published`, 'product:view', path => request(path, 'GET', undefined, { projectId }), `simulation-model:${projectId}`);
  const version = useSimulation<ProfileVersion>(projectId, instance ? `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}` : null);
  const properties = model.data?.properties ?? [];
  const initial = version.data ? decodeMap({ ...version.data.snapshot.initialProperties, ...instance?.configuration.initialOverrides }) : {};
  const values = Object.fromEntries(properties.map(property => [property.code, Object.prototype.hasOwnProperty.call(edits, property.code) ? edits[property.code] : initial[property.code] ?? initialValue(property.schema)]));
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,1fr)]">
    <div className="min-w-0 space-y-3"><Tabs value={tab} onValueChange={value => setTab(String(value))} className="min-w-0 flex-col! gap-0! overflow-hidden rounded-xl border">
      <TabsList className="grid! h-auto! w-full! grid-cols-3! rounded-none! border-b bg-muted/30! p-2!" aria-label="设备模拟操作">{[['report', '设备上报'], ['automatic', '自动上报'], ['response', '指令响应']].map(([value, label]) => <TabsTrigger key={value} value={value} className="h-10!">{label}</TabsTrigger>)}</TabsList>
      <TabsContent value="report" keepMounted hidden={tab !== 'report'} className="m-0!"><div className="space-y-5 p-5"><div><h3 className="text-sm font-medium">从设备上报属性</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">勾选需要上报的属性，输入本次模拟值。</p></div><ErrorNotice error={model.error} retry={() => model.mutate()} />{model.isLoading && <Loading />}
        <div className="divide-y">{properties.map(property => <div key={property.code} className="grid items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.8fr)]"><label className="flex items-start gap-3"><input className="mt-1 size-4 accent-foreground" type="checkbox" checked={selection[property.code] !== false} disabled={blocked} onChange={event => setSelection(value => ({ ...value, [property.code]: event.target.checked }))} /><span className="text-sm">{property.title}<span className="mt-1 block break-all text-xs text-muted-foreground">{property.code} · {['READ_WRITE', 'WRITE_ONLY', 'RW', 'W'].includes(property.access) ? '云端可写' : '云端只读'}</span></span></label><div className="min-w-0">{supportsForm(property.schema) ? <CommandField schema={property.schema} label={`${property.title}模拟值`} value={values[property.code]} disabled={blocked || selection[property.code] === false} onChange={value => setEdits(current => ({ ...current, [property.code]: value }))} /> : <p className="text-xs text-muted-foreground">复杂属性请使用高级配置。</p>}</div></div>)}</div>{!model.isLoading && !properties.length && <p className="text-sm text-muted-foreground">产品发布物模型后可配置上报属性。</p>}
      </div><footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 p-5"><p className="max-w-sm text-xs leading-5 text-muted-foreground">单次上报接口尚未接通，当前编辑只保存在本页，不会发送数据。</p><Button disabled>更新并上报</Button></footer></TabsContent>
      <TabsContent value="automatic" keepMounted hidden={tab !== 'automatic'} className="m-0! p-5">{automatic}</TabsContent>
      <TabsContent value="response" keepMounted hidden={tab !== 'response'} className="m-0!"><div className="space-y-5 p-5"><div><h3 className="text-sm font-medium">收到属性设置时</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">选择期望的响应方式。此处为未应用的策略草稿。</p></div><Field title="响应策略"><PolicySelect label="响应策略" value={strategy} disabled={blocked} onValueChange={setStrategy} options={[{ value: 'success', label: '执行成功' }, { value: 'failure', label: '执行失败' }, { value: 'silent', label: '不回复（模拟超时）' }]} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-foreground" checked={reportChanged} disabled={blocked || strategy !== 'success'} onChange={event => setReportChanged(event.target.checked)} />成功后上报变化属性</label><div className="space-y-3 border-t pt-4"><p className="text-xs leading-6">{strategy === 'success' ? `预期流程：校验参数 → 更新模拟值 → 回复成功${reportChanged ? ' → 上报变化属性' : ''}` : strategy === 'failure' ? '预期流程：收到指令 → 返回执行失败，不修改属性' : '预期流程：收到指令 → 不回复，由平台判定超时'}</p><p className="text-xs leading-6 text-muted-foreground">{strategy === 'success' && !reportChanged ? '关闭上报后，成功仍会回复，平台属性值不会随之更新。' : '实际响应仍由当前已保存的设置决定。'}</p></div></div><footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 p-5"><p className="max-w-sm text-xs leading-5 text-muted-foreground">运行中应用响应策略的接口尚未接通，草稿不会影响设备。</p><Button disabled>应用响应策略</Button></footer></TabsContent>
    </Tabs><p className="text-xs leading-6 text-muted-foreground">模拟会话独立运行，切换到「设备调试」不会停止。未提交的编辑在离开页面后清除。</p></div>
    <aside className="min-w-0 space-y-4"><DeviceStatus projectId={projectId} device={device} instance={instance} status={status} draft={values} /><RecentExchanges projectId={projectId} device={device} properties={properties} /></aside>
  </div>;
}
