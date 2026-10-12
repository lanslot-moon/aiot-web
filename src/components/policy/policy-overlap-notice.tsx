import { TriangleAlert } from 'lucide-react';
import { mqttActionOptions, standardChannels } from '@/api/policy/channels';
import type { PolicyType, Statement } from '@/api/policy/client';

export default function PolicyOverlapNotice({ type, rules }: { type: PolicyType; rules: Statement[] }) {
  if (type !== 'MQTT_DEVICE') return null;
  const overlaps: { allow: string; deny: string; action: string; channels: string[] }[] = [];
  for (const allow of rules.filter(rule => rule.effect === 'ALLOW')) {
    for (const deny of rules.filter(rule => rule.effect === 'DENY')) {
      const channels = [...new Set(allow.operationReferences ?? [])]
        .filter(id => deny.operationReferences?.includes(id));
      for (const action of new Set(allow.actions)) {
        if (deny.actions.includes(action) && (channels.length > 0 || action === 'mqtt:Connect')) {
          overlaps.push({ allow: allow.sid, deny: deny.sid, action, channels: action === 'mqtt:Connect' ? [] : channels });
        }
      }
    }
  }
  if (!overlaps.length) return null;
  return <div role="status" className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-xs leading-5">
    <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300"><TriangleAlert aria-hidden="true" className="size-4 shrink-0" />允许与禁止存在重叠</div>
    <p className="mt-1 text-muted-foreground">不影响校验和发布。两条规则同时适用时，按禁止处理；允许规则不能覆盖禁止规则。</p>
    <ul className="mt-3 space-y-2">{overlaps.map((overlap, index) => <li key={index}>
      <p>{mqttActionOptions.find(action => action.value === overlap.action)?.label || overlap.action}{overlap.channels.length > 0 && '：' + overlap.channels.map(id => standardChannels.find(channel => channel.id === id)?.label || id).join('、')}</p>
      <p className="break-all text-muted-foreground">允许：{overlap.allow} · 禁止：{overlap.deny}</p>
    </li>)}</ul>
  </div>;
}
