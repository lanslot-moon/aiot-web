import { useEffect, useRef, useState } from 'react';
import { FlaskConical, Play, Square, RefreshCw, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { DeviceDetail, CursorPage } from '@/api/device/client';
import { simulationDirectory, simulationRequest, sessionLabels, type SimulationInstance, type SimulationSession, type ProfileVersion, type ProfileBody } from '@/api/device/simulation';
import { usePermission } from '@/context/iam-context/identity';
import { Button } from '@/components/ui/button';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { cn } from '@/lib/utils';
import { useSimulation } from './use-simulation';
import ProfileEditor from './profile-editor';
import BehaviorSummary from './behavior-summary';
import SimulationWorkbench from './workbench';

function AutomaticSettings({ projectId, device, instance, blocked, done, onEditing }: { projectId: string; device: DeviceDetail; instance?: SimulationInstance; blocked: string; done: (value: SimulationInstance) => void; onEditing: (editing: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const version = useSimulation<ProfileVersion>(projectId, instance ? `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}` : null);
  const periodic = version.data?.snapshot.rules.filter(rule => rule.trigger.type === 'periodic') ?? [];
  const custom = version.data && (version.data.snapshot.rules.some(rule => !['periodic', 'manual'].includes(rule.trigger.type)) || Object.keys(version.data.snapshot.parameters).length > 0 || Object.keys(version.data.snapshot.scripts).length > 0);
  const editBlocked = blocked || (custom ? '此设备包含自定义行为，简化表单暂不覆盖这些设置。' : '');
  if (editing) return <div className="space-y-4"><Button variant="ghost" disabled={working} onClick={() => { setEditing(false); onEditing(false); }}>返回自动上报</Button><ProfileEditor projectId={projectId} device={device} quickInstance={instance} quickDone={value => { done(value); setEditing(false); onEditing(false); }} onWorking={setWorking} done={() => undefined} cancel={() => setEditing(false)} /></div>;
  return <div className="space-y-5"><div><h3 className="text-sm font-medium">按固定间隔自动上报</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">配置上报频率和数据变化方式，开启模拟后自动执行。</p></div><ErrorNotice error={version.error} retry={() => version.mutate()} />{version.isLoading ? <Loading /> : <div className="rounded-lg bg-muted/25 p-4"><p className="text-sm font-medium">{version.error ? '自动上报状态暂不可确认' : periodic.length ? '已配置自动上报' : '自动上报已关闭'}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{periodic.length ? '开启模拟后将按已保存的规则上报。' : '可以直接开启设备模拟，按需再设置自动上报。'}</p></div>}{instance && periodic.length > 0 && <BehaviorSummary projectId={projectId} instance={instance} />}<Button variant="outline" disabled={!!editBlocked || !!version.error || version.isLoading || working} onClick={() => { setEditing(true); onEditing(true); }}>{periodic.length ? '修改自动上报设置' : '设置自动上报'}</Button>{editBlocked && <p className="text-xs leading-6 text-muted-foreground">{editBlocked}</p>}</div>;
}

function SimulationWorkspace({ projectId, device, onDebug }: { projectId: string; device: DeviceDetail; onDebug: () => void }) {
  const allowed = usePermission('device:update');
  const directory = useSimulation<SimulationInstance[]>(projectId, 'instances', () => simulationDirectory(projectId, 'instances'));
  const found = directory.data?.find(item => item.deviceId === device.deviceId && item.productId === device.productId);
  const current = useSimulation<SimulationInstance>(projectId, found ? `instances/${encodeURIComponent(found.instanceId)}` : null);
  const instance = current.data ?? found;
  const sessions = useSimulation<CursorPage<SimulationSession>>(projectId, instance ? `instances/${encodeURIComponent(instance.instanceId)}/sessions?pageSize=20` : null);
  const active = sessions.data?.items.find(session => session.sessionId === instance?.activeSessionId);
  const version = useSimulation<ProfileVersion>(projectId, instance ? `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}` : null);
  const [busy, setBusy] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [error, setError] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const bootstrap = useRef({ profileId: `sim-${crypto.randomUUID()}`, instanceId: `sim-${crypto.randomUUID()}`, profileSaved: false, published: false, instance: null as SimulationInstance | null });
  const running = !!instance?.activeSessionId || instance?.desiredState === 'RUNNING';
  const state = current.error || uncertain ? '状态待确认' : active ? sessionLabels[active.status] : instance?.activeSessionId ? '模拟任务已创建' : running ? '等待启动' : instance?.generation ? '模拟已停止' : '未启动';
  const blocked = !allowed ? '当前账号没有设备管理权限。' : ['DISABLED', 'DELETING'].includes(device.lifecycle) ? '设备已停用或正在解绑。' : '';
  const { mutate: refreshDirectory } = directory, { mutate: refreshCurrent } = current, { mutate: refreshSessions } = sessions;
  async function refresh() {
    const results = await Promise.allSettled([refreshDirectory(), ...(instance ? [refreshCurrent(), refreshSessions()] : [])]);
    if (results.every(result => result.status === 'fulfilled' && result.value !== undefined)) setUncertain(false);
  }
  useEffect(() => {
    if (!instance || current.error || sessions.error) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && !lock.current) { void refreshCurrent(); void refreshSessions(); } }, 5000);
    return () => window.clearInterval(timer);
  }, [instance, current.error, sessions.error, refreshCurrent, refreshSessions]);
  async function run(action: 'start' | 'stop') {
    if (lock.current || !allowed || uncertain || directory.error || current.error) return;
    lock.current = true; setBusy(action === 'start' ? '正在开启…' : '正在停止…'); setError(undefined);
    let starting = false;
    try {
      let target = instance ?? bootstrap.current.instance;
      if (!target && action === 'start') {
        const setup = bootstrap.current;
        // Establish a valid idle profile without scheduling automatic reports.
        const body: ProfileBody = { version: 1, parameters: {}, initialProperties: {}, scripts: {}, rules: [{ ruleId: 'idle', trigger: { type: 'manual' }, actions: [{ type: 'setProperties', properties: {} }] }] };
        if (!setup.profileSaved) { await simulationRequest(projectId, 'profiles', 'POST', { profileId: setup.profileId, productId: device.productId, name: `${device.deviceName} 模拟`.slice(0, 128), description: null }); setup.profileSaved = true; }
        if (!setup.published) { await simulationRequest(projectId, `profiles/${encodeURIComponent(setup.profileId)}/versions`, 'POST', body); setup.published = true; }
        target = await simulationRequest<SimulationInstance>(projectId, 'instances', 'POST', { instanceId: setup.instanceId, productId: device.productId, deviceId: device.deviceId, profileId: setup.profileId, profileVersion: 1, parameterOverrides: {}, initialOverrides: {} });
        setup.instance = target;
      }
      if (!target) throw new Error('尚未开启设备模拟。');
      starting = true;
      await simulationRequest(projectId, `instances/${encodeURIComponent(target.instanceId)}/${action}`, 'POST');
      toast.success(action === 'start' ? '模拟已开启，可查看通讯日志。' : '模拟已停止。');
    } catch (cause) { setError(cause); if (starting) setUncertain(true); }
    finally { await refresh(); lock.current = false; setBusy(''); }
  }
  function configured(value: SimulationInstance) {
    void directory.mutate([...(directory.data ?? []).filter(item => item.instanceId !== value.instanceId), value], false);
    if (found?.instanceId === value.instanceId) void current.mutate(value, false);
    toast.success('自动上报设置已保存。');
  }
  return <div className="space-y-5 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm"><span className={cn('size-2 rounded-full', active?.status === 'RUNNING' ? 'bg-emerald-600' : 'bg-muted-foreground/60')} /><span>{state}</span><span className="text-xs text-muted-foreground">· {version.error ? '自动上报状态未知' : version.isLoading ? '正在读取设置' : version.data?.snapshot.rules.some(rule => rule.trigger.type === 'periodic') ? '已配置自动上报' : '自动上报已关闭'}</span></div><p className="mt-2 text-xs text-muted-foreground">开启后保持模拟会话，切换页面不会停止。</p></div><div className="flex gap-2"><Button size="icon" variant="ghost" aria-label="刷新模拟状态" disabled={!!busy || directory.isValidating} onClick={() => void refresh()}><RefreshCw className="size-4" /></Button><Button disabled={configuring || !!busy || !allowed || !!directory.error || directory.isLoading || !!current.error || uncertain || (!running && !!blocked)} onClick={() => void run(running ? 'stop' : 'start')}>{running ? <Square className="size-4" /> : <Play className="size-4" />}{busy || (running ? '停止模拟' : '开启设备模拟')}</Button></div></div>
    <ErrorNotice error={directory.error} retry={() => directory.mutate()} /><ErrorNotice error={current.error} retry={refresh} /><ErrorNotice error={error} />{uncertain && <p role="status" className="text-sm text-muted-foreground">操作结果待确认，请刷新模拟状态后再试。</p>}{blocked && <p role="status" className="text-xs text-muted-foreground">{blocked}</p>}{directory.isLoading && <Loading />}
    {directory.data && !directory.error && <SimulationWorkbench projectId={projectId} device={device} instance={instance} blocked={!!blocked || !!busy} automatic={<AutomaticSettings key={`${instance?.instanceId ?? 'new'}:${instance?.revision ?? 0}`} projectId={projectId} device={device} instance={instance} blocked={blocked || (busy ? '请等待当前操作完成。' : running ? '请先停止模拟，再修改自动上报设置。' : '')} done={configured} onEditing={setConfiguring} />} />}
    <Button variant="link" disabled={device.lifecycle !== 'ACTIVE'} onClick={onDebug}>前往设备调试<ArrowRight className="size-4" /></Button>
  </div>;
}

export default function DeviceSimulation(props: { projectId: string; device: DeviceDetail; onDebug: () => void }) {
  if (!props.device.virtualDevice || props.device.nodeType !== 'DIRECT' || props.device.authRoute !== 'DEVICE_SECRET') return <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center"><FlaskConical className="size-7 text-muted-foreground" /><h3 className="text-base font-medium">此设备不支持独立模拟</h3><p className="max-w-md text-sm leading-6 text-muted-foreground">设备模拟适用于使用设备密钥认证的直连虚拟设备。</p></div>;
  return <SimulationWorkspace {...props} />;
}
