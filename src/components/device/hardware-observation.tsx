import type { ReactNode } from 'react';
import { Cpu, FileCode2, Radio, type LucideIcon } from 'lucide-react';
import type { HardwareObservation } from '@/api/device/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { formatDateTime } from '@/lib/date-time';
import { cn } from '@/lib/utils';

function HardwareField({ label, children, fullWidth = false }: { label: string; children: ReactNode; fullWidth?: boolean }) {
  return <div className={cn('grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-border/50 py-2 last:border-b-0', fullWidth && 'col-span-full')}>
    <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-sm leading-5 [overflow-wrap:anywhere]">{children ?? '—'}</dd>
  </div>;
}

function HardwareGroup({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return <Card size="sm" className="min-w-0 gap-0! rounded-lg! border bg-background py-0! shadow-none ring-0">
    <CardHeader className="border-b bg-muted/25 px-3! py-2.5!">
      <CardTitle className="flex items-center gap-2 text-xs! font-medium"><Icon aria-hidden className="size-3.5 text-muted-foreground" />{title}</CardTitle>
    </CardHeader>
    <CardContent className="px-3! py-1!"><dl>{children}</dl></CardContent>
  </Card>;
}

export function HardwareObservationDetails({ title, value }: { title: string; value: HardwareObservation }) {
  return <section aria-label={title} className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] items-start gap-3">
    <HardwareGroup title="硬件与芯片" icon={Cpu}>
      <HardwareField label="硬件型号">{value.hardwareModel}</HardwareField>
      <HardwareField label="序列号">{value.serialNumber}</HardwareField>
      <HardwareField label="硬件版本">{value.hardwareVersion}</HardwareField>
      <HardwareField label="芯片型号">{value.chipModel}</HardwareField>
      <HardwareField label="芯片修订版本">{value.chipRevision}</HardwareField>
      <HardwareField label="芯片核心数">{value.chipCores}</HardwareField>
      <HardwareField label="Flash 容量">{value.flashSizeBytes == null ? null : value.flashSizeBytes.toLocaleString() + ' 字节'}</HardwareField>
    </HardwareGroup>
    <HardwareGroup title="固件与平台" icon={FileCode2}>
      <HardwareField label="SDK 版本">{value.sdkVersion}</HardwareField>
      <HardwareField label="平台版本">{value.platformVersion}</HardwareField>
      <HardwareField label="上报时固件版本">{value.firmwareVersion}</HardwareField>
      <HardwareField label="固件构建标识" fullWidth>{value.firmwareBuild ? <div className="flex items-start gap-1"><code className="min-w-0 flex-1 text-xs leading-5 [overflow-wrap:anywhere]">{value.firmwareBuild}</code><CopyIdButton value={value.firmwareBuild} label="固件构建标识" className="shrink-0" /></div> : '—'}</HardwareField>
    </HardwareGroup>
    <HardwareGroup title="上报信息" icon={Radio}>
      <HardwareField label="设备自报模拟声明">{value.simulated == null ? null : value.simulated ? '是' : '否'}</HardwareField>
      <HardwareField label="来源">{value.source}</HardwareField>
      <HardwareField label="报告时间">{formatDateTime(value.reportedAt)}</HardwareField>
      <HardwareField label="接收时间">{formatDateTime(value.receivedAt)}</HardwareField>
      <HardwareField label="网卡地址" fullWidth>{value.macAddresses?.length ? <div className="flex flex-wrap gap-x-6 gap-y-1">{value.macAddresses.map((item, index) => <span key={index}>{item.interfaceName ?? '未命名网卡'} · {item.address}</span>)}</div> : '—'}</HardwareField>
    </HardwareGroup>
  </section>;
}
