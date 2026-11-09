import { useState, type ReactNode } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { mqttActionOptions, standardChannels } from '@/api/policy/channels';
import { isAtopAction, type Document, type PolicyType } from '@/api/policy/client';
import PolicyOverlapNotice from './policy-overlap-notice';
import { cn } from '@/lib/utils';

const operatorLabels: Record<string, string> = {
  STRING_EQUALS: '等于', STRING_NOT_EQUALS: '不等于', STRING_LIKE: '匹配',
  NUMERIC_EQUALS: '等于', NUMERIC_LESS_THAN: '小于', NUMERIC_GREATER_THAN: '大于',
  DATE_BEFORE: '早于', DATE_AFTER: '晚于', BOOL: '为',
};

const atopCardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(0,min(100%,24rem)))] gap-2.5';

function RuleEffectCard({ denied, label, identifier, children }: {
  denied: boolean; label: ReactNode; identifier?: string; children?: ReactNode;
}) {
  const EffectIcon = denied ? X : Check;
  const tone = denied ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400';
  return <div className={cn(
    'min-w-0 rounded-lg border p-3',
    denied ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-emerald-500/20 bg-emerald-500/[0.04]',
  )}>
    <div className="flex items-start gap-2.5">
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md', tone, denied ? 'bg-red-500/10' : 'bg-emerald-500/10')}>
        <EffectIcon aria-hidden="true" className="size-3.5" />
      </span>
      <p className="min-w-0 flex-1 wrap-anywhere text-xs font-medium leading-5">{label}</p>
      <span className={cn('shrink-0 text-[11px] font-medium leading-5', tone)}>{denied ? '禁止' : '允许'}</span>
    </div>
    {identifier && <p className="mt-1.5 pl-[1.875rem] wrap-anywhere font-mono text-[11px] leading-5 text-muted-foreground">{identifier}</p>}
    {children}
  </div>;
}

export default function PolicyDocumentView({ type, document, className }: {
  type: PolicyType; document: Document; className?: string;
}) {
  const [showTopics, setShowTopics] = useState(false);
  const atopOnly = type === 'MANAGEMENT'
    && document.statements.every(rule => rule.actions.length > 0 && rule.actions.every(isAtopAction));
  const labels = new Map(type === 'MQTT_DEVICE' ? mqttActionOptions.map(action => [action.value, action.label]) : []);
  return <div className={cn('flex min-w-0 flex-col gap-4', className)}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{type === 'MQTT_DEVICE' ? '通道规则' : '资源与接口规则'}</h3>{type === 'MQTT_DEVICE' && <Button variant="ghost" size="sm" aria-pressed={showTopics} onClick={() => setShowTopics(value => !value)}>{showTopics ? '收起通道地址' : '查看通道地址'}</Button>}</div>
    <PolicyOverlapNotice type={type} rules={document.statements} />
    {!document.statements.length && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">此版本没有自定义规则，不额外增加或限制权限。</div>}
    {!!document.statements.length && <div className={atopOnly ? atopCardGrid : 'space-y-4'}>
      {document.statements.map((rule, index) => {
        const denied = rule.effect === 'DENY';
        const effect = denied ? '禁止' : '允许';
        const atopActions = type === 'MANAGEMENT' ? rule.actions.filter(isAtopAction) : [];
        const otherActions = type === 'MANAGEMENT' ? rule.actions.filter(action => !isAtopAction(action)) : rule.actions;
        const actionsMatchChannels = type === 'MQTT_DEVICE' && rule.actions.length === 1
          && !!rule.operationReferences?.length
          && rule.operationReferences.every(id => standardChannels.some(channel => channel.id === id && channel.action === rule.actions[0]));
        return <section key={index} aria-label={`规则 ${index + 1}`} className={cn('min-w-0 space-y-4', atopOnly && 'flex flex-col')}>
          {!actionsMatchChannels && otherActions.length > 0 && <div className="flex flex-wrap gap-2">
            {otherActions.map(action => <Badge key={action} variant="outline" className="max-w-full wrap-anywhere whitespace-normal">{effect} · {labels.get(action) || action}</Badge>)}
          </div>}
          {atopActions.length > 0 && <div className={atopOnly ? 'grid flex-1 gap-2.5' : atopCardGrid}>
            {atopActions.map(action => <RuleEffectCard key={action} denied={denied} label={<code>{action}</code>} />)}
          </div>}
          {!!rule.operationReferences?.length && <div className="grid grid-cols-[repeat(auto-fill,minmax(0,min(100%,14.5rem)))] gap-2.5 pt-1">
            {rule.operationReferences.map((id, i) => {
              const channel = standardChannels.find(item => item.id === id);
              return <RuleEffectCard key={i} denied={denied} label={channel?.label || '扩展通信操作'} identifier={id}>
                {showTopics && channel && <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="text-[11px] text-muted-foreground">Topic</p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-5 text-muted-foreground">{channel.topic}</p>
                </div>}
              </RuleEffectCard>;
            })}
          </div>}
          {!!rule.resources?.length && <dl className="divide-y">
            {rule.resources.map((resource, i) => <div key={i} className="grid gap-1 py-2.5 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <dt className="text-xs text-muted-foreground">{resource.resourceType}</dt>
              <dd className="break-all font-mono text-xs">{resource.resourcePattern}</dd>
            </div>)}
          </dl>}
          {!rule.operationReferences?.length && !rule.resources?.length && atopActions.length === 0 &&
            <p className="text-xs text-muted-foreground">{type === 'MANAGEMENT' ? '仅声明动作权限，未授予具体资源权限。' : rule.actions.every(action => action === 'mqtt:Connect') ? '设备连接，不涉及具体通信通道。' : '未指定通信通道。'}</p>}
          {!!rule.conditions?.length && <div className="border-t pt-3 text-xs">
            <h4 className="text-muted-foreground">匹配条件</h4>
            <ul className="mt-2 space-y-2">{rule.conditions.map((condition, i) => <li key={i} className="break-words">
              <span className="break-all font-mono">{condition.key}</span> {operatorLabels[condition.operator] || condition.operator} <span className="break-all">{condition.values.join('、')}</span>
            </li>)}</ul>
          </div>}
          {(rule.constraints?.allowedQos !== undefined || rule.constraints?.retainAllowed !== undefined) && <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">消息约束</h4>
            <div className="flex flex-wrap gap-2">
              {rule.constraints.allowedQos !== undefined && <Badge variant="outline">允许 QoS：{rule.constraints.allowedQos.join('、') || '无'}</Badge>}
              {rule.constraints.retainAllowed !== undefined && <Badge variant="outline">保留消息：{rule.constraints.retainAllowed ? '允许' : '禁止'}</Badge>}
            </div>
          </div>}
        </section>;
      })}
    </div>}
    {type === 'MQTT_DEVICE' && <p className="text-xs leading-5 text-muted-foreground">这里只展示此版本的规则。最终权限由平台标准通道与适用策略共同决定，禁止规则优先。</p>}
    <Collapsible className="mt-auto">
      <CollapsibleTrigger render={<Button variant="ghost" className="group text-xs text-muted-foreground" />}>
        <ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180" />技术详情 · JSON
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(document, null, 2)}</pre>
      </CollapsibleContent>
    </Collapsible>
  </div>;
}
