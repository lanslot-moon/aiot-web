import { v4 as uuidv4 } from 'uuid';
import { useRef, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { simulationDirectory, simulationRequest, decodeMap, parseValueMap, type SimulationInstance, type SimulationProfile, type ProfileVersion } from '@/api/device/simulation';
import type { DeviceDetail, CursorPage } from '@/api/device/client';
import { query } from '@/api/device/client';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, PolicySelect as Select, Pager } from '@/components/policy/shared';
import { DeviceSection } from '../layout';
import { useSimulation } from './use-simulation';
import ProfileEditor from './profile-editor';
import VersionPreview from './version-preview';

export default function Configuration({ projectId, device, instance, blocked, done }: { projectId: string; device: DeviceDetail; instance?: SimulationInstance; blocked: string; done: (value: SimulationInstance) => void }) {
  const [instanceId] = useState(() => instance?.instanceId ?? `sim-${uuidv4()}`);
  const [profileId, setProfileId] = useState(instance?.profileId ?? '');
  const [version, setVersion] = useState(instance ? String(instance.profileVersion) : '');
  const [editing, setEditing] = useState(false);
  const [editExisting, setEditExisting] = useState<SimulationProfile>();
  const [created, setCreated] = useState<SimulationProfile[]>([]);
  const [pages, setPages] = useState<(string | null)[]>([null]);
  const [overrides, setOverrides] = useState(JSON.stringify(decodeMap(instance?.configuration.parameterOverrides ?? {}), null, 2));
  const [initial, setInitial] = useState(JSON.stringify(decodeMap(instance?.configuration.initialOverrides ?? {}), null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const lock = useRef(false);
  const profiles = useSimulation<SimulationProfile[]>(projectId, 'profiles', () => simulationDirectory(projectId, 'profiles'));
  const choices = [...new Map([...(profiles.data ?? []), ...created].filter(item => item.productId === device.productId).map(item => [item.profileId, item])).values()];
  const selected = choices.find(item => item.profileId === profileId);
  const versions = useSimulation<CursorPage<ProfileVersion>>(projectId, profileId ? `profiles/${encodeURIComponent(profileId)}/versions${query({ pageSize: 20, cursor: pages[pages.length - 1] })}` : null);
  const detail = useSimulation<ProfileVersion>(projectId, profileId && version ? `profiles/${encodeURIComponent(profileId)}/versions/${encodeURIComponent(version)}` : null);
  async function save() {
    if (lock.current || blocked) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      if (!detail.data || detail.error || !profileId || !version) throw new Error('请选择已发布的模板版本。');
      const parameterOverrides = parseValueMap(overrides), initialOverrides = parseValueMap(initial);
      const definitions = detail.data.snapshot.parameters;
      const invalid = Object.keys(parameterOverrides).find(key => !definitions[key]?.overridable);
      if (invalid) throw new Error(`参数 ${invalid} 不允许覆盖。`);
      const body = { deviceId: device.deviceId, profileId, profileVersion: Number(version), parameterOverrides, initialOverrides };
      const result = await simulationRequest<SimulationInstance>(projectId, instance ? `instances/${encodeURIComponent(instanceId)}` : 'instances', instance ? 'PUT' : 'POST', instance ? { ...body, revision: instance.revision } : { ...body, instanceId, productId: device.productId });
      done(result);
    } catch (cause) { setError(cause); } finally { lock.current = false; setBusy(false); }
  }
  if (editing && !blocked) return <ProfileEditor key={editExisting?.profileId ?? 'new'} projectId={projectId} device={device} existing={editExisting} seed={editExisting && detail.data?.profileId === editExisting.profileId ? detail.data : undefined} cancel={() => { setEditing(false); void profiles.mutate(); }} done={(profile, published) => {
    setCreated(items => [...items.filter(item => item.profileId !== profile.profileId), profile]); setProfileId(profile.profileId); setVersion(String(published.version)); setPages([null]); setOverrides('{}'); setInitial('{}'); setEditing(false); void profiles.mutate();
  }} />;
  return <div className="space-y-5">
    <DeviceSection title={instance ? '模拟配置' : '为设备配置模拟行为'} description="同一产品可复用模板。绑定固定版本后，模板的新版本不会自动影响当前设备。" actions={<Button variant="outline" disabled={busy || !!blocked} onClick={() => { setEditExisting(undefined); setEditing(true); }}><Plus className="size-4" />新建模板</Button>}>
      <ErrorNotice error={profiles.error} retry={() => profiles.mutate()} />{profiles.isLoading && <Loading />}
      {!profiles.isLoading && profiles.data && !choices.length && <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">此产品还没有行为模板。新建模板，设置上报周期和模拟属性即可开始。</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"><div className="space-y-4">
        <Field title="行为模板"><Select label="行为模板" disabled={busy || !!blocked || profiles.isLoading || !!profiles.error} value={profileId} options={[{ value: '', label: '选择同产品的模板' }, ...choices.map(item => ({ value: item.profileId, label: `${item.name}${item.latestVersion === 0 ? '（未发布）' : ''}` }))]} onValueChange={value => { setProfileId(value); setVersion(''); setPages([null]); setOverrides('{}'); setInitial('{}'); }} /></Field>
        {profileId && <><ErrorNotice error={versions.error} retry={() => versions.mutate()} />{versions.isLoading && <Loading />}<Field title="固定版本"><Select label="固定版本" disabled={busy || !!blocked || versions.isLoading || !!versions.error} value={version} options={[{ value: '', label: '选择已发布版本' }, ...(versions.data?.items ?? []).map(item => ({ value: String(item.version), label: `版本 ${item.version} · 物模型修订 ${item.model.modelRevision}` })), ...(version && !versions.data?.items.some(item => String(item.version) === version) ? [{ value: version, label: `已选版本 ${version}` }] : [])]} onValueChange={setVersion} /></Field>{(pages.length > 1 || versions.data?.hasMore) && <Pager busy={versions.isValidating || busy} previous={pages.length > 1 ? () => setPages(value => value.slice(0, -1)) : undefined} next={versions.data?.hasMore && versions.data.nextCursor ? () => setPages(value => [...value, versions.data!.nextCursor]) : undefined} />}
          {selected && <Button variant="link" className="h-auto! px-0!" disabled={busy || !!blocked || !!detail.error || !!version && !detail.data} onClick={() => { setEditExisting(selected); setEditing(true); }}>{selected.latestVersion === 0 ? '配置并发布此模板' : '基于此模板创建新版本'}</Button>}
        </>}
      </div><aside className="space-y-3 rounded-lg bg-muted/30 p-4 text-xs leading-6 text-muted-foreground"><h4 className="text-sm font-medium text-foreground">开始前确认</h4><p>1. 模板属于当前设备的产品。</p><p>2. 预演验证数据生成和触发行为。</p><p>3. 保存配置后，手动启动模拟。</p><p>服务自动使用设备已有凭证建立连接。这里无需填写密钥或连接地址。</p></aside></div>
    </DeviceSection>
    <ErrorNotice error={detail.error} retry={() => detail.mutate()} />{detail.isLoading && <Loading />}
    {detail.data && !detail.error && <DeviceSection title={`版本 ${detail.data.version} · ${detail.data.snapshot.rules.length} 条行为规则`} description={`发布时物模型修订 ${detail.data.model.modelRevision}`}>
      <div className="flex flex-wrap gap-2">{detail.data.snapshot.rules.map(rule => <span className="rounded-md border px-2.5 py-1.5 text-xs" key={rule.ruleId}>{rule.ruleId} · {({ periodic: '周期触发', propertySet: '属性设置', serviceInvoke: '服务调用', manual: '手动触发' } as Record<string, string>)[rule.trigger.type] ?? rule.trigger.type}</span>)}</div>
      <details><summary className="cursor-pointer text-xs text-muted-foreground">查看完整行为定义</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/30 p-3 text-xs">{JSON.stringify(detail.data.snapshot, null, 2)}</pre></details>
      <div className="grid gap-4 lg:grid-cols-2"><Field title="参数覆盖（JSON）" hint={`可覆盖：${Object.entries(detail.data.snapshot.parameters).filter(([, item]) => item.overridable).map(([key]) => key).join('、') || '无；请保留 {}'}`}><Textarea value={overrides} disabled={busy || !!blocked} onChange={e => setOverrides(e.target.value)} className="min-h-28 font-mono text-xs" /></Field><Field title="初始属性覆盖（JSON）" hint="留空对象使用模板初始值。服务端按物模型验证字段与值。"><Textarea value={initial} disabled={busy || !!blocked} onChange={e => setInitial(e.target.value)} className="min-h-28 font-mono text-xs" /></Field></div>
    </DeviceSection>}
    {detail.data && !detail.error && !blocked && <VersionPreview key={`${profileId}:${version}`} projectId={projectId} deviceId={device.deviceId} version={detail.data} parameters={overrides} initial={initial} />}
    {blocked && <p role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{blocked}</p>}<ErrorNotice error={error} />
    <div className="flex flex-wrap items-center gap-3 border-t pt-4"><Button disabled={busy || !!blocked || !detail.data || !!detail.error || !!profiles.error} onClick={() => void save()}><Save className="size-4" />{busy ? '保存中…' : instance ? '保存配置' : '保存并绑定设备'}</Button><p className="text-xs text-muted-foreground">保存不会启动模拟或发送消息。</p></div>
  </div>;
}
