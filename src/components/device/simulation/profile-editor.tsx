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
import { fieldError, schemaObject, schemaType, supportsForm, initialValue } from '../command-schema';
import CommandField from '../command-fields';
import { CommandControlTheme } from '../command-control-theme';
import { newRow, readProfileForm, type Generator, type PropertyRow } from './profile-form';
import ScriptEditor, { ScriptHelp } from './script-editor';
import { cn } from '@/lib/utils';
import { automaticRuleDraft, mergeAutomaticRule } from './automatic-report';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export default function ProfileEditor({ projectId, device, existing, seed, done, cancel, quickDone, onWorking, quickInstance, onClose, automaticRuleId }: { projectId: string; device: DeviceDetail; existing?: SimulationProfile; seed?: ProfileVersion; done: (profile: SimulationProfile, version: ProfileVersion) => void; cancel: () => void; quickDone?: (instance: SimulationInstance) => void; onWorking?: (working: boolean) => void; quickInstance?: SimulationInstance; onClose?: () => void; automaticRuleId?: string | null }) {
  const [profileId] = useState(() => existing?.profileId ?? `sim-${crypto.randomUUID()}`);
  const nextVersion = (existing?.latestVersion ?? 0) + 1;
  const [newRuleId] = useState(() => `periodic-${crypto.randomUUID()}`);
  const [initialDraft] = useState(() => {
    const body: ProfileBody | null = automaticRuleId === null ? null : seed && automaticRuleId !== undefined ? automaticRuleDraft(seed, automaticRuleId, nextVersion)
      : seed ? { version: nextVersion, parameters: seed.snapshot.parameters, initialProperties: seed.snapshot.initialProperties, rules: seed.snapshot.rules, scripts: seed.snapshot.scripts } : null;
    try { return { body, form: body ? readProfileForm(body) : null }; } catch { return { body, form: null }; }
  });
  const [name, setName] = useState(existing?.name ?? `${device.deviceName} 模拟行为`);
  const [profile, setProfile] = useState<SimulationProfile | null>(existing ?? null);
  const [rows, setRows] = useState<PropertyRow[]>(initialDraft.form?.rows ?? [newRow()]);
  const [interval, setInterval] = useState(initialDraft.form?.interval ?? '5');
  const [formRuleId, setFormRuleId] = useState(initialDraft.form?.ruleId ?? newRuleId);
  const [advanced, setAdvanced] = useState(!!initialDraft.body && (!quickDone || !initialDraft.form));
  const [preservedForm, setPreservedForm] = useState(false);
  const [json, setJson] = useState(initialDraft.body ? pretty(initialDraft.body) : '');
  const [ruleIndex, setRuleIndex] = useState('0');
  const [args, setArgs] = useState('{}');
  const [elapsed, setElapsed] = useState('0');
  const [preview, setPreview] = useState<{ result: BehaviorPreview; fingerprint: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>();
  const [modeNotice, setModeNotice] = useState('');
  const [scriptEditing, setScriptEditing] = useState(false);
  const lock = useRef(false);
  const [instanceId] = useState(() => quickInstance?.instanceId ?? `sim-${crypto.randomUUID()}`);
  const checkpoint = useRef<{ draft: ProfileBody; published: boolean } | null>(null);
  const [resuming, setResuming] = useState(false);
  const frozen = !!busy || resuming;
  const model = useResource<ThingModelDefinition | null>(`/api/v1/products/${encodeURIComponent(device.productId)}/model/published`, 'product:view', path => request(path, 'GET', undefined, { projectId }), `simulation-model:${projectId}`);
  const properties = model.data?.properties ?? [];
  function compile(): ProfileBody {
    if (advanced || preservedForm) {
      let body: ProfileBody;
      try { body = JSON.parse(json); } catch { throw new Error('行为 JSON 格式不正确。'); }
      if (!body || body.version !== nextVersion || !body.parameters || !body.initialProperties || !body.scripts || !Array.isArray(body.rules) || !body.rules.length || body.rules.length > 128 || body.rules.some(rule => !rule?.ruleId || !rule.trigger?.type || !Array.isArray(rule.actions) || !rule.actions.length)) throw new Error(`请提供完整的版本 ${nextVersion} 行为定义和至少一条有效规则。`);
      if ([body.parameters, body.initialProperties, body.scripts].some(value => schemaObject(value) !== value)) throw new Error('parameters、initialProperties 和 scripts 必须是 JSON 对象。');
      if (Object.keys(body.scripts).length > 32 || Object.entries(body.scripts).some(([id, script]) => !script || script.scriptId !== id || typeof script.source !== 'string' || !script.source.trim() || script.source.length > 65536)) throw new Error('脚本标识须与 scripts 的键一致，源码不能为空且不能超过 65536 个字符，最多 32 个脚本。');
      if (body.rules.some(rule => rule.actions.some(action => action.type === 'script' && (typeof action.scriptId !== 'string' || !Object.prototype.hasOwnProperty.call(body.scripts, action.scriptId))))) throw new Error('规则引用的脚本不存在，请补全脚本或移除对应动作。');
      if (!advanced && preservedForm) {
        // 表单只修改定时器，保留无法由属性控件表达的脚本、参数和动作顺序。
        const intervalMs = Number(interval) * 1000;
        if (!interval.trim() || !Number.isSafeInteger(intervalMs) || intervalMs <= 0) throw new Error('请输入大于 0 的上报周期，精度为毫秒。');
        return { ...body, rules: body.rules.map(rule => ({ ...rule, trigger: { ...rule.trigger, intervalMs } })) };
      }
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
      if (row.generator === 'current') {
        if (row.value.trim()) {
          try { initial = JSON.parse(row.value); } catch { throw new Error(`${property.title}：初始值须为有效 JSON。`); }
          const issue = fieldError(property.schema, initial);
          if (issue) throw new Error(`${property.title}：${issue}`);
          initialProperties[row.code] = encodeValue(initial);
        }
        continue;
      } else if (row.generator === 'constant') {
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
    return { version: nextVersion, parameters: {}, initialProperties, scripts: {}, rules: [{ ruleId: formRuleId, trigger: { type: 'periodic', intervalMs }, actions: [...(Object.keys(sources).length ? [{ type: 'setProperties', properties: sources }] : []), { type: 'reportProperties', properties: rows.map(row => row.code) }] }] };
  }
  function changeMode(next: boolean) {
    if (frozen || next === advanced) return;
    setModeNotice('');
    try {
      if (next) {
        if (preservedForm) {
          setJson(pretty(compile()));
        } else if (rows.every(row => !row.code)) {
          const intervalMs = Number(interval) * 1000;
          if (!interval.trim() || !Number.isSafeInteger(intervalMs) || intervalMs <= 0) throw new Error('请先填写有效的上报间隔。');
          setJson(pretty({ version: nextVersion, parameters: {}, initialProperties: {}, scripts: {}, rules: [{ ruleId: formRuleId, trigger: { type: 'periodic', intervalMs }, actions: [{ type: 'setProperties', properties: {} }, { type: 'reportProperties', properties: [] }] }] }));
        } else setJson(pretty(compile()));
      } else {
        const draft = compile();
        try {
          const form = readProfileForm(draft);
          setRows(form.rows); setInterval(form.interval); setFormRuleId(form.ruleId);
          setPreservedForm(false);
        } catch {
          const rule = draft.rules[0];
          if (draft.rules.length !== 1 || rule.trigger.type !== 'periodic' || !Number.isSafeInteger(rule.trigger.intervalMs) || Number(rule.trigger.intervalMs) <= 0) {
            setModeNotice('表单仅支持单条定时规则；多条规则或其他触发方式请使用 JSON 编辑，当前内容已保留。');
            setError(undefined); return;
          }
          setPreservedForm(true);
          setInterval(String(Number(rule.trigger.intervalMs) / 1000));
        }
      }
      setAdvanced(next); setScriptEditing(false); setError(undefined);
    } catch (cause) { setError(cause); }
  }
  let body: ProfileBody | null = null;
  try { body = compile(); } catch { /* Show validation when the user submits, preserving their draft. */ }
  let scriptBody: ProfileBody | null = null;
  try { const parsed = JSON.parse(json); if (parsed && schemaObject(parsed.scripts) === parsed.scripts && Object.values(parsed.scripts).every(script => { const value = schemaObject(script); return typeof value.scriptId === 'string' && typeof value.source === 'string'; }) && Array.isArray(parsed.rules) && parsed.rules.every((rule: ProfileBody['rules'][number]) => rule && typeof rule.ruleId === 'string' && rule.trigger && typeof rule.trigger.type === 'string' && Array.isArray(rule.actions) && rule.actions.every(action => schemaObject(action) === action))) scriptBody = parsed; } catch { /* JSON view retains incomplete drafts. */ }
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
      const edited = compile();
      const draft = checkpoint.current?.draft ?? (automaticRuleId !== undefined ? mergeAutomaticRule(edited, seed, automaticRuleId) : edited);
      const periodicRule = edited.rules.find(rule => rule.trigger.type === 'periodic');
      if (!periodicRule) throw new Error('请为本次编辑提供定时规则；不需要自动上报时，请返回列表使用“移除”。');
      if (!profile) {
        const saved = await simulationRequest<SimulationProfile>(projectId, 'profiles', 'POST', { profileId, productId: device.productId, name: name.trim(), description: null });
        setProfile(saved);
      }
      // Freeze the checked version before publication; retries reuse the same IDs and payload.
      if (!checkpoint.current) {
        const result = await simulationRequest<BehaviorPreview>(projectId, 'behavior-previews', 'POST', {
          profile: { ...draft, profileId: { value: profileId } },
          instance: { instanceId: { value: instanceId }, deviceId: { value: device.deviceId }, profileId: { value: profileId }, profileVersion: nextVersion, parameterOverrides: quickInstance?.configuration.parameterOverrides ?? {}, initialOverrides: quickInstance?.configuration.initialOverrides ?? {} },
          input: previewInput(periodicRule, '{}', 0),
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
      const binding = { deviceId: device.deviceId, profileId, profileVersion: nextVersion, parameterOverrides: quickInstance?.configuration.parameterOverrides ?? {}, initialOverrides: quickInstance?.configuration.initialOverrides ?? {} };
      const saved = await simulationRequest<SimulationInstance>(projectId, quickInstance ? `instances/${encodeURIComponent(instanceId)}` : 'instances', quickInstance ? 'PUT' : 'POST', quickInstance ? { ...binding, revision: quickInstance.revision } : { ...binding, instanceId, productId: device.productId });
      checkpoint.current = null; setResuming(false);
      quickDone(saved);
    } catch (cause) { setError(cause); } finally { lock.current = false; setBusy(''); onWorking?.(!!checkpoint.current); }
  }
  return <div className="space-y-3">
    <DeviceSection title={quickDone ? '自动上报规则' : existing?.latestVersion ? `发布模板新版本 · 版本 ${nextVersion}` : '创建行为模板'} description={quickDone ? undefined : "先验证设备如何产生数据，再发布为可复用的固定版本。"} actions={quickDone ? <div className="flex gap-1" role="group" aria-label="规则编辑方式"><Button size="sm" variant={advanced ? 'ghost' : 'secondary'} aria-pressed={!advanced} disabled={frozen} onClick={() => changeMode(false)}>表单</Button><Button size="sm" variant={advanced && !scriptEditing ? 'secondary' : 'ghost'} aria-pressed={advanced && !scriptEditing} disabled={frozen} onClick={() => { changeMode(true); setScriptEditing(false); }}>JSON</Button><Button size="sm" variant={advanced && scriptEditing ? 'secondary' : 'ghost'} aria-pressed={advanced && scriptEditing} disabled={frozen} onClick={() => { changeMode(true); setScriptEditing(true); }}>脚本</Button></div> : <Button variant="ghost" disabled={frozen} onClick={cancel}>返回选择模板</Button>}>
      {quickDone ? !advanced && <label className="flex items-center gap-3 text-xs"><span className="font-medium">上报间隔</span><DeviceInput aria-label="多久上报一次（秒）" className="w-24" type="number" min="0.001" step="0.001" value={interval} disabled={frozen} onChange={e => setInterval(e.target.value)} /><span className="text-muted-foreground">秒</span></label> : <div className="grid gap-4 sm:grid-cols-2"><Field title="模板名称"><DeviceInput maxLength={128} value={name} disabled={frozen || !!profile} onChange={e => setName(e.target.value)} /></Field><Field title="多久上报一次（秒）" hint="例如填 5，设备就会每 5 秒上报一次所选数据。"><DeviceInput aria-label="多久上报一次（秒）" type="number" min="0.001" step="0.001" value={interval} disabled={frozen || advanced} onChange={e => setInterval(e.target.value)} /></Field></div>}
      {profile && !quickDone && <p className="text-xs text-muted-foreground">{profile.latestVersion ? '新版本发布后不会修改已有版本，也不会自动升级设备绑定。' : '模板名称已保存，行为尚未发布。离开编辑器会丢弃未发布的行为配置。'}</p>}
    </DeviceSection>
    <ErrorNotice error={model.error} retry={() => model.mutate()} />{model.isLoading && <Loading />}
    {!model.isLoading && !model.error && !model.data && <p role="status" className="rounded-lg border p-4 text-sm">产品尚未发布物模型，请先到产品管理发布，再配置模拟行为。</p>}
    {modeNotice && <p role="status" className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">{modeNotice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-1 text-xs font-medium">{advanced ? scriptEditing ? '上报脚本' : automaticRuleId !== undefined ? '当前规则定义' : '完整行为定义' : preservedForm ? '上报行为' : `上报属性 · ${rows.length} 项`}{advanced && scriptEditing && <ScriptHelp />}</h4>{advanced && !scriptEditing ? <Button variant="ghost" size="sm" disabled={frozen} onClick={() => { try { setJson(pretty(JSON.parse(json))); setError(undefined); } catch { setError(new Error('JSON 格式不正确，请先修正后再格式化。')); } }}>格式化 JSON</Button> : !quickDone && <Button variant="outline" size="sm" disabled={frozen} onClick={() => changeMode(true)}>转为高级 JSON</Button>}</div>
    {automaticRuleId !== undefined && <p className="text-xs leading-5 text-muted-foreground">这里只编辑本次选择或新增的规则，保存时会与当前设备的其他规则合并。</p>}
    {advanced && scriptEditing ? scriptBody ? <ScriptEditor body={scriptBody} disabled={frozen} onChange={draft => { setJson(pretty(draft)); setError(undefined); setModeNotice(''); }} /> : <p role="status" className="text-xs text-muted-foreground">请先在 JSON 中补全有效的规则与 scripts 对象，再编辑脚本。</p> : advanced ? <div className="space-y-2"><Textarea aria-label="行为 JSON" spellCheck={false} className="h-72 resize-y font-mono text-xs leading-5" value={json} disabled={frozen} onChange={e => { setJson(e.target.value); setError(undefined); }} /><p className="text-xs leading-5 text-muted-foreground">直接编辑上报间隔、属性取值和动作规则，保存后重新开启模拟生效。</p>{quickInstance && (Object.keys(quickInstance.configuration.parameterOverrides).length > 0 || Object.keys(quickInstance.configuration.initialOverrides).length > 0) && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">查看设备覆盖值（预演与运行时优先使用）</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">{pretty({ parameterOverrides: quickInstance.configuration.parameterOverrides, initialOverrides: quickInstance.configuration.initialOverrides })}</pre></details>}</div> : preservedForm ? <div className="space-y-2 rounded-md border bg-muted/10 p-3 text-xs leading-5"><p>当前规则包含脚本或自定义动作，可在上方修改上报间隔。</p><p className="text-muted-foreground">脚本、参数及动作顺序均会保留。修改具体上报逻辑，请切换到“脚本”或“JSON”。</p></div> : <CommandControlTheme><div className="space-y-2">{rows.map((row, index) => {
      const property = properties.find(item => item.code === row.code);
      const numeric = ['number', 'integer'].includes(schemaType(property?.schema));
      const valueFieldClass = cn('w-full [&>[data-slot=field][data-orientation=horizontal]]:grid-cols-[4rem_minmax(0,1fr)]', numeric ? 'max-w-64' : !['object', 'array'].includes(schemaType(property?.schema)) && 'max-w-80');
      let fixed: unknown = '';
      try { fixed = JSON.parse(row.value); } catch { /* Preserve an unfinished generator input when switching modes. */ }
      return <div key={row.key} className="space-y-2 rounded-md border bg-muted/10 p-2.5"><div className="flex items-center gap-2"><div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2"><Select label={`属性 ${index + 1}`} value={row.code} disabled={frozen} options={[{ value: '', label: '选择上报属性' }, ...properties.map(item => ({ value: item.code, label: `${item.title} · ${item.code}` }))]} onValueChange={code => update(row.key, { code, generator: 'constant', value: JSON.stringify(initialValue(properties.find(item => item.code === code)?.schema)) })} /><Select label={`生成方式 ${index + 1}`} value={row.generator} disabled={frozen} options={[{ value: 'current', label: '当前设备值' }, { value: 'constant', label: '固定值' }, ...numeric ? [{ value: 'random', label: '范围内随机' }, { value: 'ramp', label: '逐渐增加或减少' }, { value: 'wave', label: '周期性起伏' }] : []]} onValueChange={generator => update(row.key, { generator: generator as Generator, ...(['ramp', 'wave'].includes(generator) ? { value: typeof fixed === 'number' && Number.isFinite(fixed) ? String(fixed) : '' } : {}) })} /></div><Button size="icon" className="size-9! shrink-0 text-muted-foreground" variant="ghost" disabled={frozen} aria-label={`移除属性 ${index + 1}`} onClick={() => setRows(value => value.filter(item => item.key !== row.key))}><Trash2 className="size-3.5" /></Button></div>
        {row.generator === 'current' ? <div className="space-y-1"><p className="text-xs leading-5 text-muted-foreground">上报时读取当前设备属性，不覆盖设备的变化值。</p>{property && supportsForm(property.schema) && row.value !== '' ? <div className={valueFieldClass}><CommandField inline controlPanel schema={property.schema} label="初始值" value={fixed} disabled={frozen} onChange={value => update(row.key, { value: JSON.stringify(value) })} /></div> : <label className="grid w-full max-w-80 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2 text-xs font-medium"><span>初始值</span><DeviceInput aria-label={`属性 ${index + 1} 初始值（JSON，可选）`} placeholder="未设置（可选）" value={row.value} disabled={frozen} onChange={event => update(row.key, { value: event.target.value })} /></label>}</div> : row.generator === 'constant' && property && supportsForm(property.schema) ? <div className={valueFieldClass}><CommandField inline controlPanel schema={property.schema} label="上报值" value={fixed} disabled={frozen} onChange={value => update(row.key, { value: JSON.stringify(value) })} /></div> : <div className="grid grid-cols-2 gap-2">
        {row.code && row.generator !== 'random' && <div className={row.generator === 'constant' ? 'col-span-2' : undefined}><Field title={row.generator === 'constant' ? '固定值（JSON）' : row.generator === 'wave' ? '中心值（数字）' : '初始值（数字）'}><DeviceInput type={row.generator === 'constant' ? 'text' : 'number'} step={schemaType(property?.schema) === 'integer' ? 1 : 'any'} placeholder={row.generator === 'constant' ? undefined : '请输入数字'} value={row.value} disabled={frozen} onChange={e => update(row.key, { value: e.target.value })} /></Field></div>}
        {(['random', 'ramp'] as Generator[]).includes(row.generator) && <><Field title="下限"><DeviceInput aria-label={`属性 ${index + 1} 下限`} type="number" value={row.minimum} disabled={frozen} onChange={e => update(row.key, { minimum: e.target.value })} /></Field><Field title="上限"><DeviceInput aria-label={`属性 ${index + 1} 上限`} type="number" value={row.maximum} disabled={frozen} onChange={e => update(row.key, { maximum: e.target.value })} /></Field></>}
        {row.generator === 'ramp' && <Field title="每秒变化量"><DeviceInput type="number" value={row.rate} disabled={frozen} onChange={e => update(row.key, { rate: e.target.value })} /></Field>}
        {row.generator === 'wave' && <><Field title="振幅"><DeviceInput type="number" min={0} value={row.amplitude} disabled={frozen} onChange={e => update(row.key, { amplitude: e.target.value })} /></Field><div className="col-span-2"><Field title="波形周期（秒）"><DeviceInput type="number" min="0.001" value={row.period} disabled={frozen} onChange={e => update(row.key, { period: e.target.value })} /></Field></div></>}
      </div>}
      </div>;
    })}<Button size="sm" variant="outline" disabled={frozen || rows.length >= 256 || !model.data} onClick={() => setRows(value => [...value, newRow()])}><Plus className="size-3.5" />添加属性</Button></div></CommandControlTheme>}
    {!quickDone && <DeviceSection title="行为预演" description="只计算预计结果，不连接设备，也不发送消息。发布前至少预演一条规则；其他规则仍需自行验证。">
      <div className="grid gap-3 sm:grid-cols-2"><Field title="预演规则"><Select label="预演规则" value={body ? ruleIndex : ''} disabled={frozen || !body} options={body ? body.rules.map((rule, index) => ({ value: String(index), label: rule.ruleId })) : [{ value: '', label: '请先补全有效的行为配置' }]} onValueChange={setRuleIndex} /></Field><Field title="模拟已运行时间（秒）"><DeviceInput type="number" min={0} value={elapsed} disabled={frozen} onChange={e => setElapsed(e.target.value)} /></Field></div>
      {advanced && <Field title="触发参数（JSON）"><Textarea value={args} disabled={frozen} onChange={e => setArgs(e.target.value)} className="font-mono text-xs" /></Field>}
      <ErrorNotice error={error} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={frozen || !model.data} onClick={() => void act('preview')}><FlaskConical className="size-4" />{busy === 'preview' ? '预演中…' : '预演当前规则'}</Button><Button disabled={frozen || !previewCurrent || !model.data} onClick={() => void act('publish')}><Check className="size-4" />{busy === 'publish' ? '发布中…' : '发布版本并选用'}</Button></div>
      {preview && <div role="status" className="space-y-3 rounded-lg border bg-muted/20 p-4"><p className="text-sm font-medium">{previewCurrent ? '预演完成 · 尚未发送消息' : '配置已修改 · 请重新预演'}</p><p className="text-xs text-muted-foreground">预计属性变化</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{pretty(decodeMap(preview.result.propertyChanges))}</pre><details><summary className="cursor-pointer text-xs">查看 {preview.result.effects.length} 个预计效果</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{pretty(preview.result.effects)}</pre></details></div>}
    </DeviceSection>}
    {quickDone && <div className="space-y-3 border-t pt-3">
      {!advanced && !preservedForm && <p className="text-xs leading-6 text-muted-foreground">{body ? `每 ${interval} 秒上报 ${rows.length} 项数据：${rows.map(row => properties.find(item => item.code === row.code)?.title ?? row.code).join('、')}。` : '请先选择上报属性并填写数值。'}保存后，重新开启模拟时生效。</p>}
      <ErrorNotice error={error} />
      {resuming && !busy && <p role="status" className="text-sm">保存尚未完成，已保留本次设置。请点击“继续保存”，完成前暂不能修改。</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span role="status" className="text-xs text-muted-foreground">{busy ? '正在保存，请稍候…' : '配置仅保存到当前设备'}</span><div className="flex justify-end gap-2">{onClose && <Button size="sm" className="min-w-16" variant="outline" onClick={onClose}>关闭</Button>}<Button size="sm" className="w-44" disabled={!!busy || !model.data || !!model.error} onClick={() => void saveQuick()}><Check className="size-4" />{busy || (resuming ? '继续保存' : '保存自动上报设置')}</Button></div></div>
    </div>}
  </div>;
}
