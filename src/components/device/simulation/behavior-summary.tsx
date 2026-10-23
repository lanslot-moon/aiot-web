import { Clock3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { request } from '@/api/iam/client';
import { decodeMap, decodeValue, type ProfileVersion, type SimulationInstance, type SimulationValue } from '@/api/device/simulation';
import type { ThingModelDefinition } from '@/types/apps/open-platform';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { schemaObject } from '../command-schema';
import { useSimulation } from './use-simulation';

function displayValue(value: unknown): string {
  if (value === undefined) return '未设置';
  if (value === null) return '空值';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function describe(source: unknown): { mode: string; detail: string } {
  const value = schemaObject(source);
  switch (value.type) {
    case 'random': return { mode: '随机变化', detail: `${value.minimum} ～ ${value.maximum}` };
    case 'ramp': return { mode: '线性变化', detail: `从 ${value.initial} 开始，每秒变化 ${value.perSecond}，范围 ${value.minimum} ～ ${value.maximum}` };
    case 'wave': return { mode: '周期波动', detail: `中心 ${value.center}，振幅 ${value.amplitude}，周期 ${Number(value.periodMs) / 1000} 秒` };
    case 'constant': return { mode: '固定值', detail: displayValue(decodeValue(value.value as SimulationValue)) };
    case 'input': return { mode: '使用触发参数', detail: String(value.name) };
    default: return { mode: '当前模拟值', detail: '发送时读取设备属性' };
  }
}

export default function BehaviorSummary({ projectId, instance, actions }: { projectId: string; instance: SimulationInstance; actions?: (ruleId: string) => ReactNode }) {
  const version = useSimulation<ProfileVersion>(projectId, `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}`);
  const model = useResource<ThingModelDefinition | null>(`/api/v1/products/${encodeURIComponent(instance.productId)}/model/published`, 'product:view', path => request(path, 'GET', undefined, { projectId }), `simulation-model:${projectId}`);
  const properties = new Map(model.data?.properties.map(property => [property.code, property]));
  const initial = version.data ? decodeMap({ ...version.data.snapshot.initialProperties, ...instance.configuration.initialOverrides }) : {};
  const rules = version.data?.snapshot.rules.filter(rule => rule.trigger.type === 'periodic') ?? [];

  return <div className="space-y-2">
    <ErrorNotice error={version.error} retry={() => version.mutate()} />
    <ErrorNotice error={model.error} retry={() => model.mutate()} />
    {version.isLoading && <Loading />}
    {version.data && !version.error && rules.map(rule => {
      // 按动作顺序识别每次上报的属性和取值方式，不将初始值冒充实时值。
      const sources = new Map<string, unknown>();
      const reports: { key: string; code: string; source: unknown }[] = [];
      const events: string[] = [];
      rule.actions.forEach((action, index) => {
        if (action.type === 'setProperties') Object.entries(schemaObject(action.properties)).forEach(([code, source]) => sources.set(code, source));
        if (action.type === 'reportProperties' && Array.isArray(action.properties)) {
          action.properties.filter((code): code is string => typeof code === 'string').forEach(code => reports.push({ key: `${index}:${code}`, code, source: sources.get(code) }));
        }
        if (action.type === 'emitEvent' && typeof action.eventId === 'string') events.push(action.eventId);
      });
      return <section key={rule.ruleId} className="overflow-hidden rounded-md border" aria-label="已保存的自动上报配置">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-b bg-muted/20 px-3 py-1" title={`规则标识：${rule.ruleId}`}>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs leading-5">
            <p className="flex items-center gap-2 font-medium"><Clock3 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /><span>每 <span className="tabular-nums">{Number(rule.trigger.intervalMs) / 1000}</span> 秒上报{!!rule.condition && <span className="font-normal text-muted-foreground"> · 满足条件时</span>}</span></p>
            <p className="text-muted-foreground"><span className="tabular-nums">{reports.length}</span> 项属性{events.length > 0 && <> · <span className="tabular-nums">{events.length}</span> 项事件</>}</p>
          </div>
          {actions && <div className="flex items-start justify-end">{actions(rule.ruleId)}</div>}
        </header>
        <dl className="divide-y">
          {reports.map(report => {
            const property = properties.get(report.code);
            const unit = schemaObject(property?.schema).unit;
            const suffix = typeof unit === 'string' ? ` ${unit}` : '';
            const source = describe(report.source);
            const initialText = `初始 ${displayValue(initial[report.code])}${initial[report.code] !== undefined ? suffix : ''}`;
            const detail = source.mode === '当前模拟值' ? initialText : `${source.detail}${source.mode === '固定值' ? suffix : ` · ${initialText}`}`;
            return <div key={report.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-start gap-x-3 px-3 py-1.5 text-xs leading-4">
              <dt className="min-w-0"><span className="block break-words font-medium [overflow-wrap:anywhere]">{property?.title ?? report.code}</span><span className="block break-all font-mono text-[11px] text-muted-foreground">{report.code}</span></dt>
              <dd className="min-w-0 text-left" title={`${source.mode}：${source.detail}；${initialText}`}><span className="block text-muted-foreground">{source.mode}</span><span className="block break-words tabular-nums [overflow-wrap:anywhere]">{detail}</span></dd>
            </div>;
          })}
          {events.map((code, index) => <div key={`${index}:${code}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-start gap-x-3 px-3 py-1.5 text-xs leading-4"><dt className="min-w-0"><span className="block break-words font-medium [overflow-wrap:anywhere]">{model.data?.events.find(event => event.code === code)?.title ?? code}</span><span className="block break-all font-mono text-[11px] text-muted-foreground">{code}</span></dt><dd className="min-w-0 text-muted-foreground">事件上报</dd></div>)}
        </dl>
        {!reports.length && !events.length && <p className="px-3 py-3 text-xs text-muted-foreground">此定时任务没有配置属性或事件上报。</p>}
      </section>;
    })}
    {version.data && !version.error && Object.keys(instance.configuration.parameterOverrides).length > 0 && <p className="text-xs leading-5 text-muted-foreground">此设备另有专属参数；上方展示已保存的数据生成方式和初始值，实际数值以通讯日志中的报文为准。</p>}
  </div>;
}
