import { v4 as uuidv4 } from 'uuid';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Code2, ListChecks, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { mqttActionOptions, standardChannels } from '@/api/policy/channels';
import { getManagementScope, isAtopAction, managementActionScope, managementScopeLabels, managementScopeOptions, platformResourceType, type Document, type ManagementScope, type Statement, type PolicyType } from '@/api/policy/client';
import { Field, PolicySelect } from './shared';
import ManagementActionPicker from './management-action-picker';

function normalizeResources(document: Document): Document {
  return { ...document, statements: document.statements.map(rule => ({
    ...rule,
    resources: (rule.resources ?? []).flatMap(resource => {
      const resourcePattern = resource.resourcePattern.trim();
      return resourcePattern ? [{ ...resource, resourcePattern }] : [];
    }),
  })) };
}

export default function PolicyEditor({ projectId, type, initial, initialScope, publishedScope, onSave, onDirtyChange, onCancel, busy }: {
  projectId: string; type: PolicyType; initial: Document; initialScope: ManagementScope | null; publishedScope: ManagementScope | null;
  onSave: (document: Document) => Promise<void>; onDirtyChange: (dirty: boolean) => void; onCancel: () => void; busy: boolean;
}) {
  const [document, setDocument] = useState(initial);
  const [selectedScope, setSelectedScope] = useState(() => getManagementScope(initial) ? null : initialScope);
  const [raw, setRaw] = useState(JSON.stringify(initial, null, 2));
  const [advanced, setAdvanced] = useState(false);
  const [actionRule, setActionRule] = useState<number | null>(null);
  const [error, setError] = useState('');
  const documentScope = type === 'MANAGEMENT' ? getManagementScope(document) : null;
  const scope = publishedScope ?? selectedScope ?? (documentScope === 'mixed' ? null : documentScope);
  const scopeConflict = documentScope === 'mixed' || (documentScope && scope && documentScope !== scope);
  const dirty = advanced ? raw !== JSON.stringify(initial, null, 2) : JSON.stringify(document) !== JSON.stringify(initial);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
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
      else setRaw(JSON.stringify(normalizeResources(document), null, 2));
      setAdvanced(!advanced); setError('');
    } catch (e) { setError(e instanceof SyntaxError ? 'JSON 格式不正确，请检查引号、逗号和括号。' : e instanceof Error ? e.message : 'JSON 格式不正确'); }
  }
  async function submit() {
    try {
      const value = advanced ? parse() : normalizeResources(document);
      if (!value.statements.length) throw new Error('请至少添加一条权限规则。');
      if (type === 'MANAGEMENT') {
        if (!scope) throw new Error('请先选择授权主体。');
        for (const [index, rule] of value.statements.entries()) {
          const prefix = `规则 ${index + 1}：`;
          if (!rule.actions.length) throw new Error(prefix + '请选择授权操作。');
          if (rule.actions.some(action => action.startsWith('mqtt:') || managementActionScope(action) !== scope)) throw new Error(prefix + `操作与「${managementScopeLabels[scope]}」主体不匹配。请把另一类规则放到单独的策略。`);
          if (scope === 'atop' && rule.resources?.length) throw new Error(prefix + '设备 ATOP 接口不填写平台资源范围。');
          if (rule.operationReferences?.length) throw new Error(prefix + '资源操作策略不支持 MQTT 通道引用。');
          if (rule.resources?.some(({ resourceType, resourcePattern }) => !resourceType || !resourcePattern.startsWith(`aiot:${resourceType}/`) || resourcePattern.length === `aiot:${resourceType}/`.length || /[*?]/.test(resourcePattern.replace(/\/\*$/, '')))) {
            throw new Error(prefix + '资源须使用 aiot:资源类型/资源ID，通配符只能放在末段（/*）。');
          }
        }
      }
      setError(''); await onSave(value);
    } catch (e) { setError(e instanceof SyntaxError ? 'JSON 格式不正确，请检查引号、逗号和括号。' : e instanceof Error ? e.message : '保存失败，请重试'); }
  }
  return <div className="space-y-5">
    <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      {type === 'MANAGEMENT' && <>
        <p className="text-xs font-medium leading-5 sm:col-span-2">授权主体</p>
        <div className="min-w-0 max-w-sm">
          <PolicySelect label="授权主体" placeholder="选择授权主体" value={scope} options={managementScopeOptions}
            disabled={busy || !!publishedScope || (documentScope !== null && documentScope !== 'mixed' && !scopeConflict)}
            onValueChange={value => { setSelectedScope(value as ManagementScope); setError(''); }} />
        </div>
        <p className="text-xs leading-5 text-muted-foreground sm:col-start-1 sm:row-start-3">{publishedScope ? '沿用已发布版本的主体范围。' : '设备使用 ATOP 接口权限；用户和项目角色使用平台权限。'}</p>
      </>}
      <div className={cn('flex flex-wrap items-center justify-end gap-2 sm:col-start-2', type === 'MANAGEMENT' && 'sm:row-start-2')}>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>取消编辑</Button>
        <Button variant="outline" onClick={switchMode} disabled={busy}>
          {advanced ? <ListChecks className="size-4" /> : <Code2 className="size-4" />}{advanced ? '可视化编辑' : '高级 JSON'}
        </Button>
      </div>
    </div>
    {scopeConflict && <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">规则包含其他主体的权限。请检查原规则，将另一类权限放到单独的策略，再保存。</p>}
    {advanced ? <Field title="策略文档" hint={type === 'MQTT_DEVICE' ? '支持条件、QoS、Retain 和已登记的扩展操作。' : '使用与所选主体匹配的目录权限码。'}><Textarea className="min-h-80 font-mono text-xs" spellCheck={false} value={raw} onChange={e => setRaw(e.target.value)} disabled={busy} /></Field> : <>
      {!document.statements.length && <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">{type === 'MQTT_DEVICE' ? '只添加需要调整的权限，不必重复定义标准接入权限。' : scope ? '添加适用于所选主体的权限规则。' : '选择授权主体后，再添加规则。'}</div>}
      {document.statements.map((rule, index) => <section key={index} className="space-y-3 rounded-lg border px-4 py-3">
        <div className="grid items-end gap-x-4 gap-y-2 lg:grid-cols-[auto_repeat(3,minmax(0,1fr))_auto]">
          <h4 className="text-xs font-medium whitespace-nowrap lg:leading-8">规则 {index + 1}</h4>
          <Field title="规则标识"><Input value={rule.sid} maxLength={64} disabled={busy} onChange={e => patch(index, { sid: e.target.value })} /></Field>
          <Field title="处理方式"><PolicySelect label="处理方式" disabled={busy} value={rule.effect} onValueChange={value => patch(index, { effect: value as Statement['effect'] })} options={[{ value: 'DENY', label: '禁止' }, { value: 'ALLOW', label: '允许' }]} /></Field>
          {type === 'MQTT_DEVICE' ? <Field title="操作"><PolicySelect label="操作" disabled={busy} value={rule.actions.length === 1 ? rule.actions[0] : '__multiple'} onValueChange={value => { if (value !== '__multiple') patch(index, { actions: [value], operationReferences: [], resources: [] }); }} options={[
            ...(rule.actions.length !== 1 ? [{ value: '__multiple', label: '多个操作（高级 JSON 编辑）' }] : []),
            ...mqttActionOptions,
          ]} /></Field> : <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium leading-5">授权操作</p>
            <Button
              variant="outline"
              className="h-auto! min-h-8 w-full justify-between py-1 text-left whitespace-normal"
              disabled={busy || !scope}
              aria-haspopup="dialog"
              onClick={() => setActionRule(index)}
            >
              <span className="sr-only">规则 {index + 1} 的授权操作：</span>
              <span className={cn('min-w-0 wrap-anywhere leading-5', rule.actions.length > 0 && 'font-mono')}>
                {rule.actions.length ? rule.actions.join('、') : '从权限目录选择'}
              </span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </div>}
          <Button variant="ghost" size="icon" className="justify-self-end lg:col-start-5 lg:row-start-1" aria-label={`删除规则 ${index + 1}`} disabled={busy} onClick={() => setDocument(old => ({ ...old, statements: old.statements.filter((_, i) => i !== index) }))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
        {type === 'MQTT_DEVICE' && !rule.actions.includes('mqtt:Connect') && <fieldset><legend className="mb-2 text-xs font-medium">通信通道</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{standardChannels.filter(channel => rule.actions.includes(channel.action) || rule.actions.includes('mqtt:RetainPublish') && channel.action === 'mqtt:Publish').map(channel => <label key={channel.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-xs hover:bg-muted/30"><Checkbox className="mt-0.5 rounded-sm!" disabled={busy} checked={rule.operationReferences?.includes(channel.id) ?? false} onCheckedChange={checked => patch(index, { operationReferences: checked ? [...(rule.operationReferences ?? []), channel.id] : rule.operationReferences.filter(id => id !== channel.id) })} /><span className="min-w-0 leading-5">{channel.label}<span className="mt-1 block break-all text-xs text-muted-foreground">{channel.id}</span></span></label>)}</div>{rule.operationReferences?.filter(id => !standardChannels.some(channel => channel.id === id)).map(id => <p className="mt-2 text-xs" key={id}>扩展操作：{id}（高级 JSON 编辑）</p>)}</fieldset>}
        {type === 'MQTT_DEVICE' && rule.actions.includes('mqtt:Connect') && <p className="text-xs text-muted-foreground">禁止连接会阻止绑定设备建立 MQTT 连接。已有在线会话的处理取决于接入侧执行。</p>}
        {type === 'MANAGEMENT' && rule.actions.length > 0 && (rule.actions.some(isAtopAction)
          ? <p className="text-xs text-muted-foreground">设备 ATOP 接口按接口名和版本授权，只对设备绑定生效。已开放接口默认可用，显式禁止优先。</p>
          : <Field title="平台资源范围" hint={`每行填写一个表达式，例如 aiot:${platformResourceType(rule.actions[0])}/资源ID 或 aiot:${platformResourceType(rule.actions[0])}/*。留空只声明动作权限，不授予具体资源权限。`}><Textarea value={(rule.resources ?? []).map(resource => resource.resourcePattern).join('\n')} onChange={e => patch(index, { resources: e.target.value.split('\n').map(resourcePattern => ({ resourceType: /^aiot:([^/]+)\//.exec(resourcePattern.trim())?.[1] ?? '', resourcePattern })) })} disabled={busy} /></Field>)}
        {!!rule.conditions?.length && <p className="text-xs text-muted-foreground">已保留 {rule.conditions.length} 项生效条件，可在高级 JSON 中调整。</p>}
        {rule.constraints && <p className="text-xs text-muted-foreground">此规则包含 QoS / Retain 约束，可在高级 JSON 中调整。</p>}
      </section>)}
      <Button variant="outline" disabled={busy || (type === 'MANAGEMENT' && !scope)} onClick={() => setDocument(old => ({ ...old, statements: [...old.statements, { sid: 'Rule_' + uuidv4().slice(0, 8), effect: type === 'MQTT_DEVICE' ? 'DENY' : 'ALLOW', actions: type === 'MQTT_DEVICE' ? ['mqtt:Publish'] : [], operationReferences: [], resources: [], conditions: [] }] }))}><Plus className="size-4" />添加规则</Button>
    </>}
    {actionRule !== null && scope && <ManagementActionPicker key={scope} projectId={projectId} scope={scope} close={() => setActionRule(null)} onSelect={action => {
      patch(actionRule, { actions: [action], operationReferences: [], ...(isAtopAction(action) ? { resources: [] } : {}) });
      setActionRule(null);
    }} />}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex justify-end border-t pt-4"><Button disabled={busy} onClick={() => void submit()}>{busy ? '正在保存…' : '保存草稿'}</Button></div>
  </div>;
}
