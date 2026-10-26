import { v4 as uuidv4 } from 'uuid';
import { useRef, useState } from 'react';
import { Play, Square, RefreshCw, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DeviceDetail } from '@/api/device/client';
import { simulationDirectory, simulationRequest, sessionLabels, type SimulationInstance, type ProfileVersion, type ProfileBody } from '@/api/device/simulation';
import { usePermission } from '@/context/iam-context/identity';
import { Button } from '@/components/ui/button';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { cn } from '@/lib/utils';
import { useSimulation } from './use-simulation';
import { useSimulationEvents } from './use-simulation-events';
import AutomaticSettings from './automatic-settings';
import SimulationWorkbench from './workbench';
import DeviceCommands from '../commands';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

function SimulationWorkspace({ projectId, device }: { projectId: string; device: DeviceDetail }) {
  const allowed = usePermission('device:update');
  const directory = useSimulation<SimulationInstance[]>(projectId, 'instances', () => simulationDirectory(projectId, 'instances'));
  const found = directory.data?.find(item => item.deviceId === device.deviceId && item.productId === device.productId);
  const events = useSimulationEvents(projectId, found?.instanceId);
  const instance = events.state?.instance ?? found;
  const active = events.state?.session;
  const version = useSimulation<ProfileVersion>(projectId, instance ? `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}` : null);
  const [busy, setBusy] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [operationDetails, setOperationDetails] = useState<{ error: unknown; title: string }>();
  const lock = useRef(false);
  const bootstrap = useRef({ profileId: `sim-${uuidv4()}`, instanceId: `sim-${uuidv4()}`, profileSaved: false, published: false, instance: null as SimulationInstance | null });
  // 期望状态记录用户意图；活动会话才表示仍有一次模拟运行需要停止。
  const running = !!instance?.activeSessionId;
  const unfinishedRunIntent = !running && instance?.desiredState === 'RUNNING';
  const uncertain = !!instance && !events.synced;
  const ready = active?.status === 'RUNNING' && instance?.desiredState === 'RUNNING' && !busy && !uncertain && !directory.error && !directory.isLoading;
  const stopping = instance?.desiredState === 'STOPPED' && !!instance.activeSessionId;
  const commandBlocked = ready ? '' : busy || (directory.error || uncertain ? '模拟状态暂不可确认，请刷新后再发送指令。' : stopping ? '模拟正在停止，无法发送指令。' : active?.status === 'STARTING' ? '模拟正在启动，连接就绪后才能发送指令。' : '请先开启设备模拟，运行后才能发送指令。');
  const state = busy || (directory.error || uncertain ? '状态待确认' : stopping ? '停止中' : active ? sessionLabels[active.status] : running ? '等待启动' : instance?.generation ? '已停止' : '未启动');
  const blocked = !allowed ? '当前账号没有设备管理权限。' : ['DISABLED', 'DELETING'].includes(device.lifecycle) ? '设备已停用或正在解绑。' : '';
  let runActionLabel = '开启模拟';
  if (active?.status === 'FAILED') runActionLabel = '重新开启模拟';
  if (running) runActionLabel = '停止模拟';

  let settingsBlockedReason = blocked;
  if (!settingsBlockedReason) {
    if (busy) settingsBlockedReason = '请等待当前操作完成。';
    else if (uncertain) settingsBlockedReason = '模拟状态暂不可确认，请刷新后再修改自动上报设置。';
    else if (running) settingsBlockedReason = '请先停止模拟，再修改自动上报设置。';
    else if (unfinishedRunIntent) settingsBlockedReason = '上次运行已结束，请先结束本次模拟，再修改自动上报设置。';
  }
  const { mutate: refreshDirectory } = directory;
  async function refresh() {
    events.reconnect();
    await Promise.allSettled([refreshDirectory()]);
  }
  async function run(action: 'start' | 'stop') {
    if (lock.current || !allowed || uncertain || directory.error) return;
    toast.dismiss(`simulation-operation:${projectId}:${device.deviceId}`);
    lock.current = true; setBusy(action === 'start' ? '正在开启…' : '正在停止…'); setOperationDetails(undefined);
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
        void refreshDirectory([...(directory.data ?? []), target], false);
      }
      if (!target) throw new Error('尚未开启设备模拟。');
      await simulationRequest(projectId, `instances/${encodeURIComponent(target.instanceId)}/${action}`, 'POST');
      if (action === 'stop') setStopConfirm(false);
      toast.success(action === 'start' ? '启动请求已受理，运行就绪后可调试。' : '模拟已停止。');
    } catch (cause) {
      const title = action === 'start' ? '开启模拟请求异常' : '停止模拟请求异常';
      toast.error(title, {
        id: `simulation-operation:${projectId}:${device.deviceId}`,
        description: '请先刷新模拟状态，确认操作结果。',
        action: { label: '查看详情', onClick: () => setOperationDetails({ error: cause, title }) },
        duration: 8000,
      });
      void refresh();
    }
    // 成功后的状态由现有事件流更新，不让目录重查和重新订阅延长操作等待。
    finally { lock.current = false; setBusy(''); }
  }
  function configured(value: SimulationInstance, message = '自动上报设置已保存。') {
    void directory.mutate([...(directory.data ?? []).filter(item => item.instanceId !== value.instanceId), value], false);
    events.reconnect();
    toast.success(message);
  }
  return <div className="space-y-3 py-2">
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3', ready ? 'border-emerald-600/20 bg-emerald-500/[0.06]' : 'bg-muted/10')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2.5 text-sm text-foreground/90" role="status">
          <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', ready ? 'bg-emerald-500 ring-4 ring-emerald-500/10' : 'bg-muted-foreground/60')} />
          模拟{state}
        </span>
        <span className="border-l pl-4 text-xs text-muted-foreground">{version.error ? '自动上报状态未知' : version.isLoading ? '正在读取设置' : version.data?.snapshot.rules.some(rule => rule.trigger.type === 'periodic') ? '已配置自动上报' : '自动上报已关闭'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="icon" variant="ghost" aria-label="刷新模拟状态" disabled={!!busy || directory.isValidating} onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-4" />模拟设置
        </Button>
        {unfinishedRunIntent && (
          <Button size="sm" variant="ghost" disabled={configuring || !!busy || !allowed || !!directory.error || uncertain} onClick={() => void run('stop')}>
            结束本次模拟
          </Button>
        )}
        <Button
          size="sm"
          variant={running ? 'outline' : 'default'}
          disabled={configuring || !!busy || !allowed || !!directory.error || directory.isLoading || uncertain || (!running && !!blocked)}
          onClick={() => { if (running) setStopConfirm(true); else void run('start'); }}
        >
          {running ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
          {busy || runActionLabel}
        </Button>
      </div>
    </div>
    <ErrorNotice
      error={directory.error || events.error}
      presentation="toast"
      title={directory.error ? '模拟状态更新失败' : '实时状态连接中断'}
      description="当前模拟状态待确认，历史日志和已填写内容已保留。请刷新状态后再操作。"
      retry={refresh}
      retryLabel="刷新状态"
    />{blocked && <p role="status" className="text-xs text-muted-foreground">{blocked}</p>}
    <DeviceCommands projectId={projectId} device={device} simulation={{ blocked: commandBlocked, instanceId: instance?.instanceId, events }} />
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent keepMounted className="flex! max-h-[calc(100dvh-3rem)] max-w-[min(35rem,calc(100%-2rem))]! flex-col gap-0! overflow-hidden p-0!">
        <DialogHeader className="shrink-0 gap-1! px-4 pt-4 pb-3 pr-10"><DialogTitle>模拟设置</DialogTitle><DialogDescription className="text-xs! leading-5">{device.deviceName} · 设置设备的数据上报和指令回复。</DialogDescription></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {directory.isLoading && <Loading />}
          {directory.data && !directory.error && (
            <SimulationWorkbench
              key={`${projectId}:${device.deviceId}:${instance?.instanceId ?? 'unbound'}`}
              projectId={projectId}
              device={device}
              instance={instance}
              blocked={!!blocked || !!busy}
              reportBlocked={blocked || commandBlocked}
              onClose={() => setSettingsOpen(false)}
              automatic={
                <AutomaticSettings
                  key={`${instance?.instanceId ?? 'new'}:${instance?.revision ?? 0}`}
                  projectId={projectId}
                  device={device}
                  instance={instance}
                  blocked={settingsBlockedReason}
                  done={configured}
                  onWorking={setConfiguring}
                  onClose={() => setSettingsOpen(false)}
                />
              }
            />
          )}
        </div>

      </DialogContent>
    </Dialog>
    <Dialog open={!!operationDetails} onOpenChange={open => { if (!open) setOperationDetails(undefined); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{operationDetails?.title ?? '操作详情'}</DialogTitle><DialogDescription>这是本次请求的错误记录，不代表当前模拟状态。请刷新状态确认结果，避免重复提交。</DialogDescription></DialogHeader>
        <ErrorNotice error={operationDetails?.error} title="请求错误详情" />
        <DialogFooter><Button variant="outline" onClick={() => setOperationDetails(undefined)}>关闭</Button><Button onClick={() => { setOperationDetails(undefined); void refresh(); }}>刷新状态</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={stopConfirm} onOpenChange={open => { if (!busy) setStopConfirm(open); }}>
      <DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>停止设备模拟？</DialogTitle><DialogDescription>将断开「{device.deviceName}」的模拟设备连接，停止自动上报和指令响应。已保存的配置与现有记录会保留，可随时重新开启模拟。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={!!busy} onClick={() => setStopConfirm(false)}>继续运行</Button><Button variant="destructive" disabled={!!busy || !running || !allowed || uncertain || !!directory.error} onClick={() => void run('stop')}>{busy || '确认停止'}</Button></DialogFooter></DialogContent>
    </Dialog>
  </div>;
}

export default function VirtualDeviceDebug(props: { projectId: string; device: DeviceDetail }) {
  if (props.device.nodeType !== 'DIRECT' || props.device.authRoute !== 'DEVICE_SECRET') return <DeviceCommands {...props} simulation={{ blocked: '此虚拟设备不支持独立模拟，无法下发指令。' }} />;
  return <SimulationWorkspace {...props} />;
}
