import { useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { type DeviceDetail, type CursorPage, query } from '@/api/device/client';
import { commandPath, commandRequest, executionLabels, type CommandRecord } from '@/api/device/commands';
import { reportStreamPage } from '@/api/device/telemetry';
import { telemetryProperties } from '@/api/device/telemetry-model';
import type { ThingModelProperty } from '@/types/apps/open-platform';
import { useResource } from '@/components/iam/shared-utils';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date-time';

interface Exchange { key: string; time: number; title: string; detail: string; direction: 'up' | 'down' }
export default function RecentExchanges({ projectId, device, properties }: { projectId: string; device: DeviceDetail; properties: ThingModelProperty[] }) {
  const codes = telemetryProperties(properties).map(item => item.code);
  const data = useResource<Exchange[]>(device.lifecycle === 'ACTIVE' ? JSON.stringify(['simulation-exchanges', device.deviceId, codes]) : null, 'device:view', async () => {
    const to = Date.now(), from = to - 24 * 60 * 60 * 1000;
    const [commands, reports] = await Promise.all([
      commandRequest<CursorPage<CommandRecord>>(projectId, commandPath(device.deviceId) + '/commands' + query({ pageSize: 5, createdFrom: from, createdTo: to })),
      reportStreamPage(projectId, device, { kind: 'all', propertyCodes: codes.slice(0, 10), eventCodes: [], from, to }, null),
    ]);
    const rows: Exchange[] = commands.items.flatMap(command => [
      { key: `request-${command.requestId}`, time: command.createTime, title: command.commandType === 'PROPERTY' ? '平台下发属性设置' : '平台调用服务', detail: executionLabels[command.executionStatus] ?? command.executionStatus, direction: 'down' as const },
      ...(command.deviceResult ? [{ key: `reply-${command.requestId}`, time: command.deviceResult.receivedAt, title: '设备回复指令', detail: command.deviceResult.message || command.deviceResult.code, direction: 'up' as const }] : []),
    ]);
    rows.push(...reports.items.map(row => row.kind === 'property' ? { key: `property-${row.data.recordKey}`, time: row.data.timestamp, title: '设备上报属性', detail: Object.entries(row.data.properties).map(([code, value]) => `${properties.find(item => item.code === code)?.title ?? code}：${typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' · '), direction: 'up' as const } : { key: `event-${row.data.recordId}`, time: row.data.ts, title: '设备上报事件', detail: row.data.eventCode, direction: 'up' as const }));
    return rows.sort((a, b) => b.time - a.time).slice(0, 5);
  }, `simulation-exchanges:${projectId}`);
  const { mutate } = data;
  useEffect(() => {
    if (device.lifecycle !== 'ACTIVE' || data.error) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void mutate(); }, 5000);
    return () => window.clearInterval(timer);
  }, [device.lifecycle, data.error, mutate]);
  return <section className="overflow-hidden rounded-xl border" aria-label="最近收发"><header className="flex items-center justify-between gap-3 border-b px-5 py-4"><h3 className="text-sm font-semibold">最近收发</h3><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>近 24 小时 · 最近 5 条</span><Button size="icon" variant="ghost" aria-label="刷新收发记录" disabled={data.isValidating || device.lifecycle !== 'ACTIVE'} onClick={() => void mutate()}><RefreshCw className="size-3.5" /></Button></div></header><ErrorNotice error={data.error} retry={() => mutate()} />{data.isLoading && <Loading />}{!data.error && !data.isLoading && !data.data?.length && <div className="px-5 py-10 text-center"><p className="text-sm">还没有收发记录</p><p className="mt-2 text-xs leading-6 text-muted-foreground">平台收到上报或指令后，记录会显示在这里。</p></div>}<ul className="divide-y">{!data.error && data.data?.map(row => <li key={row.key} className="flex gap-3 px-5 py-4">{row.direction === 'up' ? <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-teal-600" /> : <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-blue-500" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-medium">{row.title}</p><time className="text-[10px] text-muted-foreground">{formatDateTime(row.time)}</time></div><p className="mt-2 break-all text-xs leading-5 text-muted-foreground">{row.detail}</p></div></li>)}</ul>{codes.length > 10 && <p className="border-t px-5 py-3 text-xs text-muted-foreground">此摘要仅含前 10 个属性的上报；完整记录请到设备调试查看。</p>}</section>;
}
