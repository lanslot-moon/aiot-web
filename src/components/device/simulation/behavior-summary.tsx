import { request } from '@/api/iam/client';
import { decodeMap, type ProfileVersion, type SimulationInstance } from '@/api/device/simulation';
import type { ThingModelDefinition } from '@/types/apps/open-platform';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { useSimulation } from './use-simulation';

function describe(source: unknown): string {
  if (!source || typeof source !== 'object') return '按已保存的规则生成';
  const value = source as Record<string, unknown>;
  if (value.type === 'random') return `在 ${value.minimum} 到 ${value.maximum} 之间随机变化`;
  if (value.type === 'ramp') return `从 ${value.initial} 开始，每秒变化 ${value.perSecond}，范围 ${value.minimum}～${value.maximum}`;
  if (value.type === 'wave') return `围绕 ${value.center} 上下起伏 ${value.amplitude}，每 ${Number(value.periodMs) / 1000} 秒循环`;
  if (value.type === 'constant' && value.value && typeof value.value === 'object') {
    const typed = value.value as { type?: string; value?: unknown };
    if (['number', 'text', 'boolean'].includes(typed.type ?? '')) return `固定为 ${String(typed.value)}`;
  }
  return '按已保存的规则生成';
}

export default function BehaviorSummary({ projectId, instance }: { projectId: string; instance: SimulationInstance }) {
  const version = useSimulation<ProfileVersion>(projectId, `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}`);
  const model = useResource<ThingModelDefinition | null>(`/api/v1/products/${encodeURIComponent(instance.productId)}/model/published`, 'product:view', path => request(path, 'GET', undefined, { projectId }), `simulation-model:${projectId}`);
  return <div className="space-y-3">
    <ErrorNotice error={version.error} retry={() => version.mutate()} />
    {version.isLoading && <Loading />}
    {version.data && !version.error && <div className="space-y-4 rounded-lg border p-4 sm:p-5">
      <h4 className="text-sm font-semibold">当前设备会如何上报？</h4>
      {version.data.snapshot.rules.map(rule => {
        const setter = rule.actions.find(action => action.type === 'setProperties');
        const sources = setter?.properties && typeof setter.properties === 'object' ? Object.entries(setter.properties) : [];
        return <div key={rule.ruleId} className="space-y-2">
          <p className="text-sm font-medium">{rule.trigger.type === 'periodic' ? `每 ${Number(rule.trigger.intervalMs) / 1000} 秒执行一次` : ({ propertySet: '收到属性设置时执行', serviceInvoke: '收到服务调用时执行', manual: '手动触发规则（当前页面不提供运行时触发）' } as Record<string, string>)[rule.trigger.type] ?? '按已保存的触发条件执行'}</p>
          {sources.length > 0 && <ul className="space-y-2">{sources.map(([code, source]) => <li key={code} className="flex flex-wrap justify-between gap-x-6 gap-y-1 rounded-md bg-muted/25 px-3 py-2 text-sm"><span>{model.data?.properties.find(property => property.code === code)?.title ?? code}</span><span className="text-muted-foreground">{describe(source)}</span></li>)}</ul>}
          <p className="text-xs text-muted-foreground">{rule.actions.some(action => action.type === 'reportProperties') ? '包含属性上报' : '此规则不包含属性上报'}{rule.condition ? ' · 满足配置的条件后执行' : ''}</p>
        </div>;
      })}
      {Object.keys(instance.configuration.parameterOverrides).length > 0 && <p className="text-xs text-muted-foreground">此设备设置了专属参数，实际执行会应用这些参数。可在高级配置中查看。</p>}
      <details><summary className="cursor-pointer text-xs text-muted-foreground">查看初始数值</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(decodeMap({ ...version.data.snapshot.initialProperties, ...instance.configuration.initialOverrides }), null, 2)}</pre></details>
    </div>}
  </div>;
}
