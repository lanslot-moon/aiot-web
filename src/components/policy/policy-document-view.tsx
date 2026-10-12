import { useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { mqttActionOptions, standardChannels } from '@/api/policy/channels';
import { policyRequest, type Action, type Document, type PolicyType } from '@/api/policy/client';
import { Failure } from './shared';
import PolicyOverlapNotice from './policy-overlap-notice';
import { cn } from '@/lib/utils';

const operatorLabels: Record<string, string> = {
  STRING_EQUALS: '等于', STRING_NOT_EQUALS: '不等于', STRING_LIKE: '匹配',
  NUMERIC_EQUALS: '等于', NUMERIC_LESS_THAN: '小于', NUMERIC_GREATER_THAN: '大于',
  DATE_BEFORE: '早于', DATE_AFTER: '晚于', BOOL: '为',
};

export default function PolicyDocumentView({ projectId, type, document }: {
  projectId: string; type: PolicyType; document: Document;
}) {
  const [showTopics, setShowTopics] = useState(false);
  const actions = useSWR(type === 'MANAGEMENT' ? [projectId, 'policy-actions', type] : null,
    () => policyRequest<Action[]>(projectId, 'policy-actions?policyType=' + type));
  const labels = new Map(type === 'MQTT_DEVICE'
    ? mqttActionOptions.map(action => [action.value, action.label])
    : (actions.data ?? []).map(action => [action.action, action.description || action.action]));
  return <div className="space-y-4">
    <Failure error={actions.error} retry={() => actions.mutate()} />
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">通道规则</h3>{type === 'MQTT_DEVICE' && <Button variant="ghost" size="sm" aria-pressed={showTopics} onClick={() => setShowTopics(value => !value)}>{showTopics ? '收起通道地址' : '查看通道地址'}</Button>}</div>
    <PolicyOverlapNotice type={type} rules={document.statements} />
    {!document.statements.length && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">此版本没有自定义规则，不额外增加或限制权限。</div>}
    {document.statements.map((rule, index) => {
      const denied = rule.effect === 'DENY';
      const actionsMatchChannels = type === 'MQTT_DEVICE' && rule.actions.length === 1
        && !!rule.operationReferences?.length
        && rule.operationReferences.every(id => standardChannels.some(channel => channel.id === id && channel.action === rule.actions[0]));
      return <section key={index} aria-label={`规则 ${index + 1}`} className="space-y-4">
        {!actionsMatchChannels && <div className="flex flex-wrap gap-2">{rule.actions.map(action => <Badge key={action} variant="outline">{denied ? '禁止' : '允许'} · {labels.get(action) || action}</Badge>)}</div>}
        <div className="space-y-4">
          <div>
            {!!rule.operationReferences?.length && <div className="grid grid-cols-[repeat(auto-fill,minmax(0,min(100%,14.5rem)))] gap-2.5 pt-1">
              {rule.operationReferences.map((id, i) => {
                const channel = standardChannels.find(item => item.id === id);
                const EffectIcon = denied ? X : Check;
                return <div key={i} className={cn(
                  'min-w-0 rounded-lg border p-3',
                  denied ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-emerald-500/20 bg-emerald-500/[0.04]',
                )}>
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md', denied ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}><EffectIcon aria-hidden="true" className="size-3.5" /></span>
                    <p className="min-w-0 flex-1 text-xs font-medium leading-5">{channel?.label || '扩展通信操作'}</p>
                    <span className={cn('shrink-0 text-[11px] font-medium leading-5', denied ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>{denied ? '禁止' : '允许'}</span>
                  </div>
                  <p className="mt-1.5 pl-[1.875rem] break-all font-mono text-[11px] leading-5 text-muted-foreground">{id}</p>
                  {showTopics && channel && <div className="mt-3 border-t border-border/60 pt-3"><p className="text-[11px] text-muted-foreground">Topic</p><p className="mt-1 break-all font-mono text-[11px] leading-5 text-muted-foreground">{channel.topic}</p></div>}
                </div>;
              })}
            </div>}
            {!!rule.resources?.length && <dl className="divide-y">{rule.resources.map((resource, i) => <div key={i} className="grid gap-1 py-2.5 sm:grid-cols-[7rem_minmax(0,1fr)]"><dt className="text-xs text-muted-foreground">{resource.resourceType}</dt><dd className="break-all font-mono text-xs">{resource.resourcePattern}</dd></div>)}</dl>}
            {!rule.operationReferences?.length && !rule.resources?.length && <p className="text-xs text-muted-foreground">{rule.actions.every(action => action === 'mqtt:Connect') ? '设备连接，不涉及具体通信通道。' : '未指定通信通道或资源范围。'}</p>}
          </div>
          {!!rule.conditions?.length && <div className="border-t pt-3 text-xs"><div className="flex flex-wrap gap-x-4 gap-y-2"><h4 className="text-muted-foreground">匹配条件</h4>{!rule.conditions?.length && <span>无附加条件</span>}</div>{!!rule.conditions?.length && <ul className="mt-2 space-y-2">{rule.conditions.map((condition, i) => <li key={i} className="break-words"><span className="break-all font-mono">{condition.key}</span> {operatorLabels[condition.operator] || condition.operator} <span className="break-all">{condition.values.join('、')}</span></li>)}</ul>}</div>}
          {(rule.constraints?.allowedQos !== undefined || rule.constraints?.retainAllowed !== undefined) && <div><h4 className="mb-2 text-xs font-medium text-muted-foreground">消息约束</h4><div className="flex flex-wrap gap-2">{rule.constraints.allowedQos !== undefined && <Badge variant="outline">允许 QoS：{rule.constraints.allowedQos.join('、') || '无'}</Badge>}{rule.constraints.retainAllowed !== undefined && <Badge variant="outline">保留消息：{rule.constraints.retainAllowed ? '允许' : '禁止'}</Badge>}</div></div>}

        </div>
      </section>;
    })}
    <p className="text-xs leading-5 text-muted-foreground">这里只展示此版本的规则。最终权限由平台标准通道与适用策略共同决定，禁止规则优先。</p>
    <Collapsible><CollapsibleTrigger render={<Button variant="ghost" className="group text-xs text-muted-foreground" />}><ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180" />技术详情 · JSON</CollapsibleTrigger><CollapsibleContent className="pt-2"><pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(document, null, 2)}</pre></CollapsibleContent></Collapsible>
  </div>;
}
