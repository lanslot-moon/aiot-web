import useSWR from 'swr';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { mqttActionOptions, standardChannels } from '@/api/policy/channels';
import { policyRequest, type Action, type PolicyType, type Statement } from '@/api/policy/client';
import { Failure } from './shared';

export default function PolicyRulesTable({ projectId, type, rules }: { projectId: string; type: PolicyType; rules: Statement[] }) {
  const actions = useSWR(type === 'MANAGEMENT' ? [projectId, 'policy-actions', type] : null, () => policyRequest<Action[]>(projectId, 'policy-actions?policyType=' + type));
  const actionLabels = new Map(type === 'MQTT_DEVICE'
    ? mqttActionOptions.map(item => [item.value, item.label])
    : (actions.data ?? []).map(item => [item.action, item.description || item.action]));
  const channelLabels = new Map<string, string>(standardChannels.map(item => [item.id, item.label]));
  return <div className="space-y-3">
    <Failure error={actions.error} retry={() => actions.mutate()} />
    <GatewayDataTable rows={rules} columns={[
      { label: '规则标识', render: rule => <span className="block max-w-48 break-all">{rule.sid}</span> },
      { label: '处理方式', render: rule => <span className={rule.effect === 'DENY' ? 'text-destructive' : ''}>{rule.effect === 'DENY' ? '禁止' : '允许'}</span> },
      { label: '操作', render: rule => <div className="space-y-1">{rule.actions.map(action => <div key={action} title={action}>{actionLabels.get(action) || action}</div>)}</div> },
      { label: type === 'MQTT_DEVICE' ? '通信通道' : '资源范围', render: rule => <div className="max-w-sm space-y-2">
        {!!rule.operationReferences?.length && <div className="flex flex-wrap gap-1.5">{rule.operationReferences.map(id => <Badge key={id} variant="outline" className="max-w-full whitespace-normal break-all font-normal" title={id}>{channelLabels.get(id) || '扩展操作：' + id}</Badge>)}</div>}
        {!!rule.resources?.length && <div className="space-y-1">{rule.resources.map((resource, index) => <div key={index} className="break-all" title={resource.resourceType}>{resource.resourcePattern}</div>)}</div>}
        {!rule.operationReferences?.length && !rule.resources?.length && <span className="text-muted-foreground">{rule.actions.length === 1 && rule.actions[0] === 'mqtt:Connect' ? '连接操作不涉及通信通道' : '未指定通道或资源'}</span>}
      </div> },
      { label: '条件与约束', render: rule => <div className="max-w-sm space-y-1 whitespace-normal break-words">
        {rule.conditions?.map((condition, index) => <div key={index}>{condition.key} {condition.operator} {condition.values.join('、')}</div>)}
        {rule.constraints?.allowedQos && <div>允许 QoS：{rule.constraints.allowedQos.join('、') || '无'}</div>}
        {rule.constraints?.retainAllowed !== undefined && <div>保留消息：{rule.constraints.retainAllowed ? '允许' : '禁止'}</div>}
        {!rule.conditions?.length && rule.constraints?.allowedQos === undefined && rule.constraints?.retainAllowed === undefined && <span className="text-muted-foreground">无附加条件</span>}
      </div> },
    ]} />
  </div>;
}
