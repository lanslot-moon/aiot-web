import { useRef, useState } from 'react';
import { Plus, Trash2, FlaskConical, Check } from 'lucide-react';
import { request } from '@/api/iam/client';
import { simulationRequest, encodeValue, decodeMap, previewInput, type ProfileBody, type SimulationProfile, type ProfileVersion, type BehaviorPreview, type SimulationInstance } from '@/api/device/simulation';
import type { DeviceDetail } from '@/api/device/client';
import type { ThingModelDefinition } from '@/types/apps/open-platform';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DeviceInput, DeviceSection } from '../layout';
import { PolicySelect as Select, Field } from '@/components/policy/shared';
import { fieldError, schemaType, supportsForm, initialValue } from '../command-schema';
import CommandField from '../command-fields';

type Generator = 'constant' | 'random' | 'ramp' | 'wave';
interface PropertyRow { key: string; code: string; generator: Generator; value: string; minimum: string; maximum: string; rate: string; amplitude: string; period: string }
const newRow = (): PropertyRow => ({ key: crypto.randomUUID(), code: '', generator: 'constant', value: '0', minimum: '0', maximum: '100', rate: '1', amplitude: '10', period: '60' });
const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export default function ProfileEditor({ projectId, device, existing, seed, done, cancel, quickDone, onWorking, quickInstance }: { projectId: string; device: DeviceDetail; existing?: SimulationProfile; seed?: ProfileVersion; done: (profile: SimulationProfile, version: ProfileVersion) => void; cancel: () => void; quickDone?: (instance: SimulationInstance) => void; onWorking?: (working: boolean) => void; quickInstance?: SimulationInstance }) {
  const [profileId] = useState(() => existing?.profileId ?? `sim-${crypto.randomUUID()}`);
  const nextVersion = (existing?.latestVersion ?? 0) + 1;
  const [name, setName] = useState(existing?.name ?? `${device.deviceName} 模拟行为`);
  const [profile, setProfile] = useState<SimulationProfile | null>(existing ?? null);
  const [rows, setRows] = useState<PropertyRow[]>([newRow()]);
  const [interval, setInterval] = useState('5');
  const [advanced, setAdvanced] = useState(!!seed);
  const [json, setJson] = useState(seed ? pretty({ version: nextVersion, parameters: seed.snapshot.parameters, initialProperties: seed.snapshot.initialProperties, rules: seed.snapshot.rules, scripts: seed.snapshot.scripts }) : '');
  const [ruleIndex, setRuleIndex] = useState('0');
  const [args, setArgs] = useState('{}');
  const [elapsed, setElapsed] = useState('0');
  const [preview, setPreview] = useState<{ result: BehaviorPreview; fingerprint: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>();
  const lock = useRef(false);
  const [instanceId] = useState(() => quickInstance?.instanceId ?? `sim-${crypto.randomUUID()}`);
  const checkpoint = useRef<{ draft: ProfileBody; published: boolean } | null>(null);
  const [resuming, setResuming] = useState(false);
  const frozen = !!busy || resuming;
  const model = useResource<ThingModelDefinition | null>(`/api/v1/products/${encodeURIComponent(device.productId)}/model/published`, 'product:view', path => request(path, 'GET', undefined, { projectId }), `simulation-model:${projectId}`);
  const properties = model.data?.properties ?? [];
  function compile(): ProfileBody {
    if (advanced) {
      let body: ProfileBody;
      try { body = JSON.parse(json); } catch { throw new Error('行为 JSON 格式不正确。'); }
      if (!body || body.version !== nextVersion || !body.parameters || !body.initialProperties || !body.scripts || !Array.isArray(body.rules) || !body.rules.length || body.rules.length > 128 || body.rules.some(rule => !rule?.ruleId || !rule.trigger?.type || !Array.isArray(rule.actions) || !rule.actions.length)) throw new Error(`请提供完整的版本 ${nextVersion} 行为定义和至少一条有效规则。`);
      if (Object.keys(body.scripts).length) throw new Error('本编辑器不提交脚本，请使用平台审核后的模板。');
      return body;
    }
    const intervalMs = Number(interval) * 1000;
    if (!interval.trim() || !Number.isSafeInteger(intervalMs) || intervalMs <= 0) throw new Error('请输入大于 0 的上报周期，精度为毫秒。');
    if (!rows.length || rows.some(row => !row.code)) throw new Error('请至少选择一个上报属性。');
    if (new Set(rows.map(row => row.code)).size !== rows.length) throw new Error('每个属性只能配置一次。');
    const sources: Record<string, unknown> = {};
    const initialProperties: ProfileBody['initialProperties'] = {};
    for (const row of rows) {
      const property = properties.find(item => item.code === row.code);
      if (!property) throw new Error('所选属性已不在物模型中，请重新选择。');
      const number = (text: string) => { const result = Number(text); if (!text.trim() || !Number.isFinite(result)) throw new Error(`${property.title}：请补全有效数字。`); return result; };
      let initial: unknown;
      if (row.generator === 'constant') {
        try { initial = JSON.parse(row.value); } catch { throw new Error(`${property.title}：固定值须为 JSON，文本请加双引号。`); }
        sources[row.code] = { type: 'constant', value: encodeValue(initial) };
      } else if (row.generator === 'wave') {
        const center = number(row.value), amplitude = number(row.amplitude), periodMs = number(row.period) * 1000;
        if (amplitude < 0 || !Number.isSafeInteger(periodMs) || periodMs <= 0) throw new Error('振幅不能为负，波形周期须大于 0。');
        initial = center; sources[row.code] = { type: 'wave', center, amplitude, periodMs };
      } else {
        const minimum = number(row.minimum), maximum = number(row.maximum);
        if (minimum > maximum) throw new Error('下限不能大于上限。');
        initial = row.generator === 'ramp' ? number(row.value) : minimum;
        sources[row.code] = { type: row.generator, minimum, maximum, ...(row.generator === 'ramp' ? { initial, perSecond: number(row.rate) } : {}) };
      }
      const issue = fieldError(property.schema, initial);
      if (issue) throw new Error(`${property.title}：${issue}`);
      initialProperties[row.code] = encodeValue(initial);
    }
    return { version: nextVersion, parameters: {}, initialProperties, scripts: {}, rules: [{ ruleId: 'periodic-report', trigger: { type: 'periodic', intervalMs }, actions: [{ type: 'setProperties', properties: sources }, { type: 'reportProperties', properties: rows.map(row => row.code) }] }] };
  }
  let body: ProfileBody | null = null;
  try { body = compile(); } catch { /* Show validation when the user submits, preserving their draft. */ }
  const fingerprint = body ? pretty({ body, ruleIndex, args, elapsed }) : '';
  const previewCurrent = !!preview && preview.fingerprint === fingerprint;
  function update(key: string, change: Partial<PropertyRow>) { setError(undefined); setRows(value => value.map(row => row.key === key ? { ...row, ...change } : row)); }
  async function act(action: 'preview' | 'publish') {
    if (lock.current) return;
    lock.current = true; setBusy(action); setError(undefined);
    try {
      const draft = compile();
      if (!name.trim()) throw new Error('请输入模板名称。');
      const rule = draft.rules[Number(ruleIndex)];
      if (!rule) throw new Error('请选择要预演的规则。');
      const input = previewInput(rule, args, Number(elapsed) * 1000);
      const saved = profile ?? await simulationRequest<SimulationProfile>(projectId, 'profiles', 'POST', { profileId, productId: device.productId, name: name.trim(), description: null });
      setProfile(saved);
      if (action === 'preview') {
        const result = await simulationRequest<BehaviorPreview>(projectId, 'behavior-previews', 'POST', {
          profile: { ...draft, profileId: { value: profileId } },
          instance: { instanceId: { value: `preview-${device.deviceId}`.slice(0, 64) }, deviceId: { value: device.deviceId }, profileId: { value: profileId }, profileVersion: nextVersion, parameterOverrides: {}, initialOverrides: {} }, input,
        });
        setPreview({ result, fingerprint: pretty({ body: draft, ruleIndex, args, elapsed }) });
      } else {
        if (!previewCurrent) throw new Error('配置已变化，请重新预演后发布。');
        const version = await simulationRequest<ProfileVersion>(projectId, `profiles/${encodeURIComponent(profileId)}/versions`, 'POST', draft);
        done({ ...saved, latestVersion: nextVersion }, version);
      }
    } catch (cause) { setError(cause); } finally { lock.current = false; setBusy(''); }
  }
  async function saveQuick() {
    if (lock.current || !quickDone) return;
    lock.current = true; onWorking?.(true); setBusy('正在检查上报设置…'); setError(undefined);
    try {
      const draft = checkpoint.current?.draft ?? compile();
      if (!profile) {
        const saved = await simulationRequest<SimulationProfile>(projectId, 'profiles', 'POST', { profileId, productId: device.productId, name: name.trim(), description: null });
        setProfile(saved);
      }
      // Freeze the checked version before publication; retries reuse the same IDs and payload.
      if (!checkpoint.current) {
        const result = await simulationRequest<BehaviorPreview>(projectId, 'behavior-previews', 'POST', {
          profile: { ...draft, profileId: { value: profileId } },
          instance: { instanceId: { value: instanceId }, deviceId: { value: device.deviceId }, profileId: { value: profileId }, profileVersion: nextVersion, parameterOverrides: {}, initialOverrides: {} },
          input: previewInput(draft.rules[0], '{}', 0),
        });
        setPreview({ result, fingerprint: pretty({ body: draft, ruleIndex, args, elapsed }) });
        checkpoint.current = { draft, published: false }; setResuming(true);
      }
      setBusy('正在保存上报设置…');
      if (!checkpoint.current.published) {
        await simulationRequest<ProfileVersion>(projectId, `profiles/${encodeURIComponent(profileId)}/versions`, 'POST', draft);
        checkpoint.current.published = true;
      }
      setBusy('正在应用到当前设备…');
      const binding = { deviceId: device.deviceId, profileId, profileVersion: nextVersion, parameterOverrides: {}, initialOverrides: {} };
      const saved = await simulationRequest<SimulationInstance>(projectId, quickInstance ? `instances/${encodeURIComponent(instanceId)}` : 'instances', quickInstance ? 'PUT' : 'POST', quickInstance ? { ...binding, revision: quickInstance.revision } : { ...binding, instanceId, productId: device.productId });
      quickDone(saved);
    } catch (cause) { setError(cause); } finally { lock.current = false; setBusy(''); onWorking?.(!!checkpoint.current); }
  }
  return <div className="space-y-5">
    <DeviceSection title={quickDone ? '设置设备要上报的数据' : existing?.latestVersion ? `发布模板新版本 · 版本 ${nextVersion}` : '创建行为模板'} description={quickDone ? "选好属性、数值和上报频率。保存后，再点击开始模拟。" : "先验证设备如何产生数据，再发布为可复用的固定版本。"} actions={!quickDone && <Button variant="ghost" disabled={frozen} onClick={cancel}>返回选择模板</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">{!quickDone && <Field title="模板名称"><DeviceInput maxLength={128} value={name} disabled={frozen || !!profile} onChange={e => setName(e.target.value)} /></Field>}<Field title="多久上报一次（秒）" hint="例如填 5，设备就会每 5 秒上报一次所选数据。"><DeviceInput aria-label="多久上报一次（秒）" type="number" min="0.001" step="0.001" value={interval} disabled={frozen || advanced} onChange={e => setInterval(e.target.value)} /></Field></div>
      {profile && !quickDone && <p className="text-xs text-muted-foreground">{profile.latestVersion ? '新版本发布后不会修改已有版本，也不会自动升级设备绑定。' : '模板名称已保存，行为尚未发布。离开编辑器会丢弃未发布的行为配置。'}</p>}
    </DeviceSection>
    <ErrorNotice error={model.error} retry={() => model.mutate()} />{model.isLoading && <Loading />}
    {!model.isLoading && !model.error && !model.data && <p role="status" className="rounded-lg border p-4 text-sm">产品尚未发布物模型，请先到产品管理发布，再配置模拟行为。</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">{advanced ? '完整行为定义' : '属性上报规则'}</h4>{!quickDone && <Button variant="outline" size="sm" disabled={frozen || advanced} onClick={() => { try { setJson(pretty(compile())); setAdvanced(true); setError(undefined); } catch (cause) { setError(cause); } }}>转为高级 JSON</Button>}</div>
    {advanced ? <Field title="行为 JSON" hint="支持条件、事件、属性设置与服务回复规则。当前版本不提交脚本；切换后保留完整 JSON，不回写简化表单。"><Textarea className="min-h-72 font-mono text-xs" value={json} disabled={frozen} onChange={e => setJson(e.target.value)} /></Field> : <div className="space-y-3">{rows.map((row, index) => {
      const property = properties.find(item => item.code === row.code);
      const numeric = schemaType(property?.schema) === 'number';
      let fixed: unknown = '';
      try { fixed = JSON.parse(row.value); } catch { /* Preserve an unfinished generator input when switching modes. */ }
      return <div key={row.key} className="space-y-3 rounded-lg border p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">属性 {index + 1}</span><Button size="icon" variant="ghost" disabled={frozen} aria-label={`移除属性 ${index + 1}`} onClick={() => setRows(value => value.filter(item => item.key !== row.key))}><Trash2 className="size-4" /></Button></div><div className="grid gap-3 sm:grid-cols-2"><Field title="上报什么数据"><Select label={`属性 ${index + 1}`} value={row.code} disabled={frozen} options={[{ value: '', label: '选择需要上报的属性' }, ...properties.map(item => ({ value: item.code, label: `${item.title} · ${item.code}` }))]} onValueChange={code => update(row.key, { code, generator: 'constant', value: JSON.stringify(initialValue(properties.find(item => item.code === code)?.schema)) })} /></Field><Field title="数据如何变化"><Select label={`生成方式 ${index + 1}`} value={row.generator} disabled={frozen} options={[{ value: 'constant', label: '固定值' }, ...numeric ? [{ value: 'random', label: '范围内随机' }, { value: 'ramp', label: '逐渐增加或减少' }, { value: 'wave', label: '周期性起伏' }] : []]} onValueChange={generator => update(row.key, { generator: generator as Generator })} /></Field>
        {row.generator === 'constant' && property && supportsForm(property.schema) ? <CommandField schema={property.schema} label="固定值" value={fixed} disabled={frozen} onChange={value => update(row.key, { value: JSON.stringify(value) })} /> : row.code && row.generator !== 'random' && <Field title={row.generator === 'constant' ? '固定值（JSON）' : row.generator === 'wave' ? '中心值' : '初始值'}><DeviceInput value={row.value} disabled={frozen} onChange={e => update(row.key, { value: e.target.value })} /></Field>}
        {(['random', 'ramp'] as Generator[]).includes(row.generator) && <><Field title="下限"><DeviceInput aria-label={`属性 ${index + 1} 下限`} type="number" value={row.minimum} disabled={frozen} onChange={e => update(row.key, { minimum: e.target.value })} /></Field><Field title="上限"><DeviceInput aria-label={`属性 ${index + 1} 上限`} type="number" value={row.maximum} disabled={frozen} onChange={e => update(row.key, { maximum: e.target.value })} /></Field></>}
        {row.generator === 'ramp' && <Field title="每秒变化量"><DeviceInput type="number" value={row.rate} disabled={frozen} onChange={e => update(row.key, { rate: e.target.value })} /></Field>}
        {row.generator === 'wave' && <><Field title="振幅"><DeviceInput type="number" min={0} value={row.amplitude} disabled={frozen} onChange={e => update(row.key, { amplitude: e.target.value })} /></Field><Field title="波形周期（秒）"><DeviceInput type="number" min="0.001" value={row.period} disabled={frozen} onChange={e => update(row.key, { period: e.target.value })} /></Field></>}
      </div></div>;
    })}<Button variant="outline" disabled={frozen || rows.length >= 256 || !model.data} onClick={() => setRows(value => [...value, newRow()])}><Plus className="size-4" />添加属性</Button></div>}
    {!quickDone && <DeviceSection title="行为预演" description="只计算预计结果，不连接设备，也不发送消息。发布前至少预演一条规则；其他规则仍需自行验证。">
      <div className="grid gap-3 sm:grid-cols-2"><Field title="预演规则"><Select label="预演规则" value={body ? ruleIndex : ''} disabled={frozen || !body} options={body ? body.rules.map((rule, index) => ({ value: String(index), label: rule.ruleId })) : [{ value: '', label: '请先补全有效的行为配置' }]} onValueChange={setRuleIndex} /></Field><Field title="模拟已运行时间（秒）"><DeviceInput type="number" min={0} value={elapsed} disabled={frozen} onChange={e => setElapsed(e.target.value)} /></Field></div>
      {advanced && <Field title="触发参数（JSON）"><Textarea value={args} disabled={frozen} onChange={e => setArgs(e.target.value)} className="font-mono text-xs" /></Field>}
      <ErrorNotice error={error} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={frozen || !model.data} onClick={() => void act('preview')}><FlaskConical className="size-4" />{busy === 'preview' ? '预演中…' : '预演当前规则'}</Button><Button disabled={frozen || !previewCurrent || !model.data} onClick={() => void act('publish')}><Check className="size-4" />{busy === 'publish' ? '发布中…' : '发布版本并选用'}</Button></div>
      {preview && <div role="status" className="space-y-3 rounded-lg border bg-muted/20 p-4"><p className="text-sm font-medium">{previewCurrent ? '预演完成 · 尚未发送消息' : '配置已修改 · 请重新预演'}</p><p className="text-xs text-muted-foreground">预计属性变化</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{pretty(decodeMap(preview.result.propertyChanges))}</pre><details><summary className="cursor-pointer text-xs">查看 {preview.result.effects.length} 个预计效果</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{pretty(preview.result.effects)}</pre></details></div>}
    </DeviceSection>}
    {quickDone && <div className="space-y-4 rounded-lg border bg-muted/20 p-4 sm:p-5">
      <div><h4 className="text-sm font-semibold">保存后会怎样？</h4><p className="mt-2 text-sm leading-6 text-muted-foreground">{body ? `设备将每 ${interval} 秒上报 ${rows.length} 项数据：${rows.map(row => properties.find(item => item.code === row.code)?.title ?? row.code).join('、')}。` : '选择需要上报的数据，并填写数值。'}设置会自动检查并保存到当前设备。点击“开始模拟”后才会发送数据。</p></div>
      <ErrorNotice error={error} />
      {resuming && !busy && <p role="status" className="text-sm">保存尚未完成，已保留本次设置。请点击“继续保存”，完成前暂不能修改。</p>}
      <div className="flex flex-wrap items-center gap-3"><Button disabled={!!busy || !model.data || !!model.error} onClick={() => void saveQuick()}><Check className="size-4" />{busy || (resuming ? '继续保存' : '保存自动上报设置')}</Button><span role="status" className="text-xs text-muted-foreground">{busy ? '请保持页面打开' : '此步骤不会发送设备数据'}</span></div>
    </div>}
  </div>;
}
