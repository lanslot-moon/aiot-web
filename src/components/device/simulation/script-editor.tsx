import type { ProfileBody } from '@/api/device/simulation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PolicySelect as Select } from '@/components/policy/shared';
import { CircleHelp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';

export function ScriptHelp() {
  const example = `function evaluate(input) {
  // 示例：PM2.5 每次增加 1，到 100 后回到 0。
  const current = Number(input.properties.pm25 ?? 0);
  const pm25 = current >= 100 ? 0 : current + 1;

  return {
    propertyChanges: { pm25 },
    effects: [
      { type: "REPORT_PROPERTIES", properties: { pm25 } }
    ]
  };
}`;
  return <Popover>
    <PopoverTrigger aria-label="查看脚本使用说明" title="脚本使用说明" className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><CircleHelp aria-hidden className="size-3.5" /></PopoverTrigger>
    <PopoverContent align="start" sideOffset={6} className="max-h-[min(34rem,65vh)] w-[min(30rem,calc(100vw-2rem))] gap-3 overflow-y-auto p-3 text-xs leading-5">
      <PopoverTitle className="text-sm">脚本怎么使用？</PopoverTitle>
      <p className="text-muted-foreground">添加上报脚本后，填写 JavaScript 的 evaluate(input) 函数。关联的规则触发时，模拟服务执行脚本；例如上报间隔设为 10 秒，关联定时规则的脚本就每 10 秒执行一次。</p>
      <div className="space-y-1"><p className="font-medium">示例：更新 PM2.5 并主动上报</p><p className="text-muted-foreground">示例中的 pm25 必须是物模型已有的数值属性；使用时替换为你的属性 code，并遵守属性取值范围。</p><pre className="overflow-x-auto rounded-md border bg-muted/30 p-2.5 font-mono text-xs leading-5"><code>{example}</code></pre></div>
      <div className="space-y-1"><p className="font-medium">读什么、返回什么？</p><p className="text-muted-foreground"><code>input.properties</code> 读取当前属性，<code>input.parameters</code> 读取配置参数，<code>input.elapsedMs</code> 是模拟已运行的毫秒数。输入和返回值都使用普通 JSON 值。</p><p className="text-muted-foreground"><code>propertyChanges</code> 更新模拟设备属性；<code>effects</code> 声明上报等动作。只更新属性不会自动发送 MQTT 消息。</p></div>
      <p className="rounded-md bg-muted/40 px-2.5 py-2 text-muted-foreground">规则后面已有“属性上报”动作时，将示例中的 effects 改成 []，让后续动作负责上报，避免重复发送。动作顺序可在 JSON 中查看和调整。</p>
      <p className="text-muted-foreground">脚本同步返回结果；不支持网络请求、文件访问、Date 或 Math.random()。时间使用输入的 nowEpochMs。保存时由后端预演，保存后重新开启模拟生效。</p>
    </PopoverContent>
  </Popover>;
}

export default function ScriptEditor({ body, disabled, onChange }: { body: ProfileBody; disabled: boolean; onChange: (body: ProfileBody) => void }) {
  const scripts = Object.entries(body.scripts);
  function add() {
    let index = 1;
    while (Object.prototype.hasOwnProperty.call(body.scripts, `report-script-${index}`)) index++;
    const scriptId = `report-script-${index}`;
    const target = body.rules.findIndex(rule => rule.trigger.type === 'periodic');
    if (target < 0) return;
    const actions = body.rules[target].actions.filter(action => !(['setProperties', 'reportProperties'].includes(String(action.type)) && action.properties && Object.keys(action.properties).length === 0));
    const hasReport = actions.some(action => action.type === 'reportProperties');
    const source = `function evaluate(input) {\n  // input.properties 为当前属性；propertyChanges 填本次变化值。\n  return {\n    propertyChanges: {},\n    effects: ${hasReport ? '[] // 后续上报动作会读取变化后的属性。' : '[{ type: "REPORT_PROPERTIES", properties: input.properties }]'}\n  };\n}`;
    const reportIndex = actions.findIndex(action => action.type === 'reportProperties');
    actions.splice(reportIndex < 0 ? actions.length : reportIndex, 0, { type: 'script', scriptId });
    onChange({ ...body, scripts: { ...body.scripts, [scriptId]: { scriptId, source } }, rules: body.rules.map((rule, i) => i === target ? { ...rule, actions } : rule) });
  }
  return <div className="space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">JavaScript · 定义 evaluate(input)，返回属性变化与上报动作。保存前由模拟服务预演，源码不会在浏览器执行。</p>
    {scripts.map(([id, script]) => {
      const linked = body.rules.filter(rule => rule.actions.some(action => action.type === 'script' && action.scriptId === id));
      return <section key={id} className="space-y-2 rounded-md border p-2.5">
        <div className="flex items-center justify-between gap-2"><span className="min-w-0 break-all font-mono text-xs">{id}</span><Button size="sm" variant="ghost" disabled={disabled} onClick={() => {
          const remaining = { ...body.scripts }; delete remaining[id];
          onChange({ ...body, scripts: remaining, rules: body.rules.map(rule => ({ ...rule, actions: rule.actions.filter(action => action.type !== 'script' || action.scriptId !== id) })) });
        }}>移除脚本</Button></div>
        <Textarea aria-label={`脚本 ${id} 源码`} spellCheck={false} className="h-52 resize-y font-mono text-xs leading-5" value={script.source} disabled={disabled} maxLength={65536} onChange={event => onChange({ ...body, scripts: { ...body.scripts, [id]: { ...script, source: event.target.value } } })} />
        <p className="break-all text-xs text-muted-foreground">{linked.length ? `执行规则：${linked.map(rule => rule.ruleId).join('、')}（按动作顺序执行）` : '尚未关联执行规则，此脚本不会自动运行。'}</p>
        {body.rules.some(rule => !linked.includes(rule)) && <Select label={`将脚本 ${id} 添加到规则`} value="" disabled={disabled} options={[{ value: '', label: '添加到执行规则…' }, ...body.rules.flatMap((rule, index) => linked.includes(rule) ? [] : [{ value: String(index), label: rule.ruleId }])]} onValueChange={value => { if (value !== '') onChange({ ...body, rules: body.rules.map((rule, index) => index === Number(value) ? { ...rule, actions: [...rule.actions, { type: 'script', scriptId: id }] } : rule) }); }} />}
      </section>;
    })}
    {!scripts.length && <p className="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">尚未配置脚本，可添加一个定时执行的上报脚本。</p>}
    <Button size="sm" variant="outline" disabled={disabled || scripts.length >= 32 || !body.rules.some(rule => rule.trigger.type === 'periodic')} onClick={add}>添加上报脚本</Button>
  </div>;
}
