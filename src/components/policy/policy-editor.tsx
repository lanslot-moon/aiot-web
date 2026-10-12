import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Plus, Trash2, Code2, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { mqttActionOptions, standardChannels } from '@/api/policy/channels';
import { policyRequest, type Action, type Document, type Statement, type PolicyType } from '@/api/policy/client';
import { Failure, Field, PolicySelect } from './shared';

export default function PolicyEditor({ projectId, type, initial, onSave, onDirtyChange, onCancel, busy }: {
  projectId: string; type: PolicyType; initial: Document; onSave: (document: Document) => Promise<void>; onDirtyChange: (dirty: boolean) => void; onCancel: () => void; busy: boolean;
}) {
  const [document, setDocument] = useState(initial);
  const [raw, setRaw] = useState(JSON.stringify(initial, null, 2));
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  const dirty = advanced ? raw !== JSON.stringify(initial, null, 2) : JSON.stringify(document) !== JSON.stringify(initial);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  const actions = useSWR([projectId, 'policy-actions', type], () => policyRequest<Action[]>(projectId, 'policy-actions?policyType=' + type));
  function patch(index: number, value: Partial<Statement>) {
    setDocument(old => ({ ...old, statements: old.statements.map((rule, i) => i === index ? { ...rule, ...value } : rule) }));
  }
  function parse(): Document {
    const value = JSON.parse(raw);
    if (!value || typeof value.languageVersion !== 'string' || !Array.isArray(value.statements)) throw new Error('请提供 languageVersion 和 statements 数组。');
        for (const rule of value.statements) {
      if (!rule || typeof rule.sid !== 'string' || !['ALLOW', 'DENY'].includes(rule.effect) ||
          !Array.isArray(rule.actions) || !rule.actions.every((item: unknown) => typeof item === 'string') ||
          (rule.operationReferences != null && (!Array.isArray(rule.operationReferences) || !rule.operationReferences.every((item: unknown) => typeof item === 'string'))) ||
          (rule.resources != null && (!Array.isArray(rule.resources) || !rule.resources.every((item: { resourceType?: unknown; resourcePattern?: unknown } | null) => item && typeof item.resourceType === 'string' && typeof item.resourcePattern === 'string')))) {
        throw new Error('规则需要 sid、effect、actions，以及格式正确的通道或资源数组。');
      }
      if (rule.conditions != null && (!Array.isArray(rule.conditions) || !rule.conditions.every((item: { key?: unknown; operator?: unknown; values?: unknown } | null) => item && typeof item.key === 'string' && typeof item.operator === 'string' && Array.isArray(item.values)))) {
        throw new Error('条件需要 key、operator 和 values 数组。');
      }
    }
    return value;
  }
  function switchMode() {
    try {
      if (advanced) setDocument(parse());
      else setRaw(JSON.stringify(document, null, 2));
      setAdvanced(!advanced); setError('');
    } catch (e) { setError(e instanceof SyntaxError ? 'JSON 格式不正确，请检查引号、逗号和括号。' : e instanceof Error ? e.message : 'JSON 格式不正确'); }
  }
  async function submit() {
    try {
      const value = advanced ? parse() : document;
      if (!value.statements.length) throw new Error('请至少添加一条权限规则。');
      setError(''); await onSave(value);
    } catch (e) { setError(e instanceof SyntaxError ? 'JSON 格式不正确，请检查引号、逗号和括号。' : e instanceof Error ? e.message : '保存失败，请重试'); }
  }
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><h3 className="text-sm font-medium leading-8">编辑权限规则</h3><p className="mt-1 text-xs text-muted-foreground">草稿保存不会影响线上权限，校验并发布后才会更新绑定对象的授权。</p></div><div className="flex shrink-0 items-center gap-2"><Button variant="ghost" disabled={busy} onClick={onCancel}>取消编辑</Button><Button variant="outline" onClick={switchMode} disabled={busy}>{advanced ? <ListChecks className="size-4" /> : <Code2 className="size-4" />}{advanced ? '可视化编辑' : '高级 JSON'}</Button></div></div>
    {advanced ? <Field title="策略文档" hint="支持条件、QoS、Retain 和已登记的扩展操作。完整校验由服务端执行。"><Textarea className="min-h-80 font-mono text-xs" spellCheck={false} value={raw} onChange={e => setRaw(e.target.value)} disabled={busy} /></Field> : <>
      {!document.statements.length && <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">只添加需要调整的权限，不必重复定义标准接入权限。</div>}
      {document.statements.map((rule, index) => <section key={index} className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between"><h4 className="text-xs font-medium">规则 {index + 1}</h4><Button variant="ghost" size="icon" aria-label={'删除规则 ' + (index + 1)} disabled={busy} onClick={() => setDocument(old => ({ ...old, statements: old.statements.filter((_, i) => i !== index) }))}><Trash2 className="size-4" /></Button></div>
        <div className="grid items-start gap-4 lg:grid-cols-3"><Field title="规则标识"><Input value={rule.sid} maxLength={64} disabled={busy} onChange={e => patch(index, { sid: e.target.value })} /></Field><Field title="处理方式"><PolicySelect label="处理方式" disabled={busy} value={rule.effect} onValueChange={value => patch(index, { effect: value as Statement['effect'] })} options={[{"value":"DENY","label":"禁止"},{"value":"ALLOW","label":"允许"}]} /></Field><Field title="操作"><PolicySelect label="操作" disabled={busy} value={rule.actions.length === 1 ? rule.actions[0] : '__multiple'} onValueChange={value => patch(index, { actions: [value], operationReferences: [], resources: [] })} options={[
            ...(rule.actions.length !== 1 ? [{ value: '__multiple', label: '多个操作（高级 JSON 编辑）' }] : []),
            ...(type === 'MQTT_DEVICE' ? mqttActionOptions : [              ...(!actions.data?.some(item => item.action === rule.actions[0]) ? [{ value: rule.actions[0] ?? '', label: rule.actions[0] || '请选择操作' }] : []),
              ...(actions.data?.map(item => ({ value: item.action, label: item.description + ' · ' + item.action })) ?? []),
            ]),
          ]} /></Field></div>
        {type === 'MQTT_DEVICE' && !rule.actions.includes('mqtt:Connect') && <fieldset><legend className="mb-2 text-xs font-medium">通信通道</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{standardChannels.filter(channel => rule.actions.includes(channel.action) || rule.actions.includes('mqtt:RetainPublish') && channel.action === 'mqtt:Publish').map(channel => <label key={channel.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-xs hover:bg-muted/30"><Checkbox className="mt-0.5 rounded-sm!" disabled={busy} checked={rule.operationReferences?.includes(channel.id) ?? false} onCheckedChange={checked => patch(index, { operationReferences: checked ? [...(rule.operationReferences ?? []), channel.id] : rule.operationReferences.filter(id => id !== channel.id) })} /><span className="min-w-0 leading-5">{channel.label}<span className="mt-1 block break-all text-xs text-muted-foreground">{channel.id}</span></span></label>)}</div>{rule.operationReferences?.filter(id => !standardChannels.some(channel => channel.id === id)).map(id => <p className="mt-2 text-xs" key={id}>扩展操作：{id}（高级 JSON 编辑）</p>)}</fieldset>}
        {type === 'MQTT_DEVICE' && rule.actions.includes('mqtt:Connect') && <p className="text-xs text-muted-foreground">禁止连接会阻止绑定设备建立 MQTT 连接。已有在线会话的处理取决于接入侧执行。</p>}
        {type === 'MANAGEMENT' && <Field title="资源范围" hint="每行一个资源表达式，例如 aiot:device/*；权限仍限制在当前项目。"><Textarea value={(rule.resources ?? []).map(resource => resource.resourcePattern).join('\n')} onChange={e => patch(index, { resources: e.target.value.split('\n').filter(Boolean).map(resourcePattern => ({ resourceType: resourcePattern.split(':')[1]?.split('/')[0] ?? '', resourcePattern })) })} disabled={busy} /></Field>}
        {!!rule.conditions?.length && <p className="text-xs text-muted-foreground">已保留 {rule.conditions.length} 项生效条件，可在高级 JSON 中调整。</p>}
        {rule.constraints && <p className="text-xs text-muted-foreground">此规则包含 QoS / Retain 约束，可在高级 JSON 中调整。</p>}
      </section>)}
      <Button variant="outline" disabled={busy} onClick={() => setDocument(old => ({ ...old, statements: [...old.statements, { sid: 'Rule_' + crypto.randomUUID().slice(0, 8), effect: type === 'MQTT_DEVICE' ? 'DENY' : 'ALLOW', actions: [type === 'MQTT_DEVICE' ? 'mqtt:Publish' : actions.data?.[0]?.action ?? 'device:Read'], operationReferences: [], resources: [], conditions: [] }] }))}><Plus className="size-4" />添加规则</Button>
    </>}
    {type === 'MANAGEMENT' && <Failure error={actions.error} retry={() => actions.mutate()} />}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex justify-end border-t pt-4"><Button disabled={busy} onClick={() => void submit()}>{busy ? '正在保存…' : '保存草稿'}</Button></div>
  </div>;
}
