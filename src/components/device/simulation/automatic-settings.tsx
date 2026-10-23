import { useRef, useState } from 'react';
import { ArrowLeft, Clock3, Info, Plus, Settings2, Trash2 } from 'lucide-react';
import { simulationRequest, type ProfileBody, type ProfileVersion, type SimulationInstance } from '@/api/device/simulation';
import type { DeviceDetail } from '@/api/device/client';
import { Button } from '@/components/ui/button';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { removeAutomaticRules } from './automatic-report';
import { useSimulation } from './use-simulation';
import ProfileEditor from './profile-editor';
import BehaviorSummary from './behavior-summary';

interface RemovalCheckpoint {
  profileId: string;
  instance: SimulationInstance;
  body: ProfileBody;
  created: boolean;
  published: boolean;
}

export default function AutomaticSettings({ projectId, device, instance, blocked, done, onWorking, onClose }: {
  projectId: string; device: DeviceDetail; instance?: SimulationInstance; blocked: string;
  done: (value: SimulationInstance, message?: string) => void; onWorking: (working: boolean) => void; onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null | undefined>();
  const [working, setWorking] = useState(false);
  const [removal, setRemoval] = useState<{ ruleId: string | null }>();
  const [error, setError] = useState<unknown>();
  const lock = useRef(false);
  const checkpoint = useRef<RemovalCheckpoint | null>(null);
  const version = useSimulation<ProfileVersion>(projectId, instance ? `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}` : null);
  const periodic = version.data?.snapshot.rules.filter(rule => rule.trigger.type === 'periodic') ?? [];
  const unavailable = !!blocked || !!version.error || version.isLoading || working || (!!instance && !version.data);

  async function remove() {
    if (lock.current || unavailable || !instance || !version.data || !removal) return;
    lock.current = true; setWorking(true); onWorking(true); setError(undefined);
    try {
      if (!checkpoint.current) {
        checkpoint.current = { profileId: `sim-${crypto.randomUUID()}`, instance,
          body: removeAutomaticRules(version.data, removal.ruleId), created: false, published: false };
      }
      const task = checkpoint.current;
      if (!task.created) {
        await simulationRequest(projectId, 'profiles', 'POST', { profileId: task.profileId, productId: device.productId,
          name: `${device.deviceName} 模拟行为`.slice(0, 128), description: null });
        task.created = true;
      }
      if (!task.published) {
        await simulationRequest(projectId, `profiles/${encodeURIComponent(task.profileId)}/versions`, 'POST', task.body);
        task.published = true;
      }
      // 重试先核对当前绑定，PUT 已提交但响应丢失时直接确认成功，不再次发布或改绑。
      const current = await simulationRequest<SimulationInstance>(projectId, `instances/${encodeURIComponent(task.instance.instanceId)}`);
      let saved = current;
      if (current.profileId !== task.profileId || current.profileVersion !== 1) {
        if (current.revision !== task.instance.revision || current.profileId !== task.instance.profileId || current.profileVersion !== task.instance.profileVersion) {
          throw new Error('实例配置已变化，请取消本次操作，刷新后重新选择要移除的规则。');
        }
        if (current.desiredState !== 'STOPPED' || current.activeSessionId) throw new Error('请先停止模拟，再移除自动上报规则。');
        saved = await simulationRequest<SimulationInstance>(projectId, `instances/${encodeURIComponent(current.instanceId)}`, 'PUT', {
          revision: current.revision, deviceId: current.deviceId, profileId: task.profileId, profileVersion: 1,
          parameterOverrides: task.instance.configuration.parameterOverrides, initialOverrides: task.instance.configuration.initialOverrides,
        });
      }
      checkpoint.current = null; setRemoval(undefined);
      done(saved, removal.ruleId === null || periodic.length === 1 ? '自动上报已移除，仍可开启模拟和单次上报。' : '该条自动上报规则已移除。');
    } catch (cause) { setError(cause); }
    finally { lock.current = false; setWorking(false); onWorking(false); }
  }

  function cancelRemoval() {
    if (lock.current) return;
    checkpoint.current = null; setError(undefined); setRemoval(undefined);
  }

  if (editing !== undefined) return <div className="space-y-3">
    <Button size="sm" variant="ghost" className="-ml-2" disabled={working} onClick={() => setEditing(undefined)}><ArrowLeft className="size-3.5" />返回自动上报</Button>
    <ProfileEditor key={editing ?? 'new'} projectId={projectId} device={device} quickInstance={instance} seed={version.data}
      automaticRuleId={editing} onClose={onClose} quickDone={value => { done(value); setEditing(undefined); }}
      onWorking={value => { setWorking(value); onWorking(value); }} done={() => undefined} cancel={() => setEditing(undefined)} />
  </div>;

  return <div className="space-y-3">
    <div><h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium leading-5">定时上报{periodic.length > 0 && <span className="font-normal tabular-nums text-muted-foreground">{periodic.length} 条规则</span>}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">每条规则可设置不同的上报间隔与属性，按需添加或移除。</p></div>
    <ErrorNotice error={version.error} retry={() => version.mutate()} />
    {version.isLoading ? <Loading /> : instance && periodic.length > 0 ? <BehaviorSummary projectId={projectId} instance={instance} actions={ruleId => <div className="flex shrink-0 gap-1">
      <Button size="sm" className="min-w-16" variant="ghost" disabled={unavailable} onClick={() => setEditing(ruleId)} aria-label={`修改规则 ${ruleId}`}><Settings2 className="size-3.5" />修改</Button>
      <Button size="sm" className="min-w-16" variant="ghost" disabled={unavailable} onClick={() => { setError(undefined); setRemoval({ ruleId }); }} aria-label={`移除规则 ${ruleId}`}><Trash2 className="size-3.5" />移除</Button>
    </div>} /> : !version.error && <div className="flex items-start gap-3 border-y py-4"><Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">尚未设置自动上报</p><p className="mt-1 text-xs leading-5 text-muted-foreground">可以直接开启模拟，接收平台指令或执行单次上报；需要定时发送数据时再添加规则。</p></div></div>}
    {blocked && <p role="status" className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />{blocked}</p>}
    {(version.data?.snapshot.rules.length ?? 0) >= 128 && <p className="text-xs text-muted-foreground">行为模板已达到 128 条规则上限，请先移除不需要的规则再添加。</p>}
    <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div>{periodic.length > 1 && <Button size="sm" variant="ghost" disabled={unavailable} onClick={() => { setError(undefined); setRemoval({ ruleId: null }); }}><Trash2 className="size-3.5" />移除全部自动上报</Button>}</div>
      <div className="flex justify-end gap-2"><Button size="sm" className="min-w-16" variant="outline" disabled={working} onClick={onClose}>关闭</Button><Button size="sm" className="min-w-28" disabled={unavailable || (version.data?.snapshot.rules.length ?? 0) >= 128} onClick={() => setEditing(null)}><Plus className="size-3.5" />{periodic.length ? '添加规则' : '配置自动上报'}</Button></div>
    </div>
    <Dialog open={!!removal} onOpenChange={open => { if (!open) cancelRemoval(); }}>
      <DialogContent showCloseButton={!working}><DialogHeader><DialogTitle>{removal?.ruleId === null ? '移除全部自动上报？' : '移除这条自动上报规则？'}</DialogTitle><DialogDescription>{removal?.ruleId ? `将移除「${removal.ruleId}」的定时行为。` : '将移除当前设备的全部定时行为。'}其他规则、设备和历史记录会保留。移除后仍可开启模拟、接收指令和单次上报，也可重新添加定时规则。</DialogDescription></DialogHeader>
        <ErrorNotice error={error} />{!!error && <p className="text-xs text-muted-foreground">操作未确认完成。重试会核对当前绑定；取消不会回滚已经发布的模板版本。</p>}
        <DialogFooter><Button variant="outline" disabled={working} onClick={cancelRemoval}>取消</Button><Button variant="destructive" disabled={unavailable} onClick={() => void remove()}>{working ? '正在移除…' : error ? '重试移除' : '确认移除'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
