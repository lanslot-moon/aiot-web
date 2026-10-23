import { useEffect } from 'react';
import { Radio, RefreshCw, ToggleLeft, Gauge } from 'lucide-react';
import type { DeviceDetail } from '@/api/device/client';
import { request } from '@/api/iam/client';
import { latestProperties, type TelemetryPoint } from '@/api/device/telemetry';
import { decodeMap, type ProfileVersion, type SimulationInstance } from '@/api/device/simulation';
import type { ThingModelDefinition, ThingModelProperty } from '@/types/apps/open-platform';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice } from '@/components/iam/shared';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-time';
import { useSimulation } from './use-simulation';
import styles from './device-status.module.css';

function displayValue(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? value ? '开启' : '关闭' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}
function Reading({ value, unit = '' }: { value: unknown; unit?: string }) {
  return <span className={cn(styles.reading, typeof value === 'boolean' && styles.switchValue)}>{typeof value === 'boolean' && <i className={cn(styles.switchDot, value && styles.switchOn)} aria-hidden="true" />}{displayValue(value)}{value !== null && value !== undefined && typeof value === 'number' && unit && <small>{unit}</small>}</span>;
}

export function DeviceStatusPanel({ properties, latest, initial, status, loading, failed, refreshing, onRefresh, available, draftLabel = false }: {
  properties: ThingModelProperty[]; latest?: Record<string, TelemetryPoint>; initial?: Record<string, unknown>; status: string;
  loading: boolean; failed: boolean; refreshing: boolean; onRefresh: () => void; available: boolean; draftLabel?: boolean;
}) {
  const timestamps = Object.values(latest ?? {}).flatMap(point => point.timestamp === null ? [] : [point.timestamp]);
  const lastReport = timestamps.length ? Math.max(...timestamps) : null;
  const recent = lastReport !== null && Date.now() - lastReport < 60_000;
  const caption = failed ? '暂时无法更新，保留上次读数' : loading ? '正在读取设备数据' : !available ? '设备激活后显示平台上报值' : lastReport === null ? '平台尚未收到上报' : recent ? '平台已收到上报' : '超过 1 分钟没有新上报';
  return <section className={styles.card} aria-label="设备当前状态">
    <header className={styles.header}><div className={styles.title}><Radio size={17} aria-hidden="true" /><h3>当前状态</h3></div><span className={styles.badge}>{status}</span></header>
    <div className={styles.signal} role="status"><span className={cn(styles.indicator, recent && !failed && styles.received)} aria-hidden="true" />{caption}<button type="button" className={styles.refresh} aria-label="刷新当前状态" onClick={onRefresh} disabled={refreshing || !available}><RefreshCw size={14} className={cn(refreshing && 'motion-safe:animate-spin')} /></button></div>
    <div className={styles.columnLabels} aria-hidden="true"><span>设备属性</span><span>{draftLabel ? '本地编辑值' : '配置初值'}</span><span>平台最近值</span></div>
    <dl className={styles.properties}>{properties.map(property => {
      const schema = property.schema && typeof property.schema === 'object' ? property.schema as Record<string, unknown> : {};
      const unit = typeof schema.unit === 'string' ? schema.unit : '';
      const reading = latest?.[property.code];
      const hasReading = reading?.timestamp !== null && reading?.timestamp !== undefined;
      return <div className={styles.property} key={property.code}>
        <dt className={styles.propertyName}><span className={styles.propertyIcon}>{schema.type === 'boolean' ? <ToggleLeft size={17} /> : <Gauge size={17} />}</span><span>{property.title}<small>{property.code}</small></span></dt>
        <dd className={styles.initial} aria-label={`${property.title}${draftLabel ? '本地编辑值' : '配置初值'}`}><Reading value={initial?.[property.code]} unit={unit} /></dd>
        <dd className={cn(styles.actual, hasReading && styles.actualReceived)} aria-label={`${property.title}平台最近值`} title={hasReading ? `上报于 ${formatDateTime(reading.timestamp)}` : '尚未收到此属性上报'}><Reading value={hasReading ? reading.value : null} unit={unit} /></dd>
      </div>;
    })}</dl>
    {!properties.length && <p className={styles.empty}>{loading ? '正在加载属性…' : '产品发布物模型后，属性状态将显示在这里。'}</p>}
    <footer className={styles.footer}><span>更新于 {lastReport === null ? '—' : formatDateTime(lastReport)}</span><span>每 5 秒刷新</span></footer>
    {initial && <p className={styles.note}>{draftLabel ? '本地编辑值尚未发送，不代表模拟器当前值。' : '配置初值仅用于对照，不代表模拟器运行中的当前值。'}</p>}
  </section>;
}

export default function DeviceStatus({ projectId, device, instance, status, draft }: { projectId: string; device: DeviceDetail; instance?: SimulationInstance; status: string; draft?: Record<string, unknown> }) {
  const model = useResource<ThingModelDefinition | null>(`/api/v1/products/${encodeURIComponent(device.productId)}/model/published`, 'product:view', path => request(path, 'GET', undefined, { projectId }), `simulation-model:${projectId}`);
  const properties = model.data?.properties ?? [];
  const available = device.lifecycle === 'ACTIVE';
  const latest = useResource(available && properties.length ? JSON.stringify(['simulation-status', device.deviceId, device.virtualDevice, model.data?.modelRevision]) : null, 'device:view', () => latestProperties(projectId, device, properties), `simulation-status:${projectId}`);
  const version = useSimulation<ProfileVersion>(projectId, instance ? `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}` : null);
  const { mutate } = latest;
  useEffect(() => {
    if (!available || !properties.length || latest.error) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void mutate(); }, 5000);
    return () => window.clearInterval(timer);
  }, [available, properties.length, latest.error, mutate]);
  return <div className="min-w-0 space-y-3"><DeviceStatusPanel properties={properties} latest={latest.data} draftLabel={!!draft} initial={draft ?? (version.data && !version.error ? decodeMap({ ...version.data.snapshot.initialProperties, ...instance?.configuration.initialOverrides }) : undefined)} status={status} loading={model.isLoading || latest.isLoading} failed={!!model.error || !!latest.error} refreshing={latest.isValidating} onRefresh={() => void latest.mutate()} available={available} /><ErrorNotice error={model.error} retry={() => model.mutate()} /><ErrorNotice error={latest.error} retry={() => latest.mutate()} /></div>;
}
