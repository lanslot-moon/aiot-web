import { useState, type ReactNode } from 'react';
import type { DeviceDetail } from '@/api/device/client';
import type { SimulationInstance } from '@/api/device/simulation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import SingleReportPanel from './single-report-panel';

interface SimulationWorkbenchProps {
  projectId: string;
  device: DeviceDetail;
  instance?: SimulationInstance;
  automatic: ReactNode;
  blocked: boolean;
  reportBlocked: string;
  onClose: () => void;
}

const SETTING_TABS = [
  { value: 'automatic', label: '自动上报' },
  { value: 'response', label: '指令响应' },
  { value: 'report', label: '单次上报' },
];

export default function SimulationWorkbench({
  projectId,
  device,
  instance,
  automatic,
  blocked,
  reportBlocked,
  onClose,
}: SimulationWorkbenchProps) {
  const [tab, setTab] = useState('automatic');

  return (
    <Tabs value={tab} onValueChange={value => setTab(String(value))} className="min-w-0 flex-col! gap-0!">
      <TabsList
        variant="line"
        className="sticky top-0 z-10 grid! h-auto! w-full! grid-cols-3! rounded-none! border-b bg-muted/15! px-4! py-0!"
        aria-label="设备模拟操作"
      >
        {SETTING_TABS.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-9! rounded-none! text-xs! after:hidden! data-active:border-b-2! data-active:border-b-foreground!"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="report" keepMounted hidden={tab !== 'report'} className="m-0! px-4 py-4">
        <SingleReportPanel
          projectId={projectId}
          device={device}
          instance={instance}
          blocked={blocked}
          blockedReason={reportBlocked}
          onClose={onClose}
        />
      </TabsContent>
      <TabsContent value="automatic" keepMounted hidden={tab !== 'automatic'} className="m-0! px-4 py-4">
        {automatic}
      </TabsContent>
      <TabsContent value="response" keepMounted hidden={tab !== 'response'} className="m-0! px-4 py-4">
        <ResponseSettings blocked={blocked} onClose={onClose} />
      </TabsContent>
    </Tabs>
  );
}

const RESPONSE_OPTIONS = [
  { value: 'success', title: '执行成功', description: '更新模拟属性，并回复成功。' },
  { value: 'failure', title: '执行失败', description: '回复失败，保持属性值不变。' },
  { value: 'silent', title: '不回复', description: '保持静默，验证平台的超时处理。' },
];

function ResponseSettings({ blocked, onClose }: { blocked: boolean; onClose: () => void }) {
  const [strategy, setStrategy] = useState('success');
  const [reportChanged, setReportChanged] = useState(true);
  const canReportChanges = strategy === 'success';

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">指令回复方式</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">收到属性设置指令时，设备按以下方式处理。</p>
      </div>
      <RadioGroup
        aria-label="响应策略"
        value={strategy}
        onValueChange={value => setStrategy(String(value))}
        disabled={blocked}
        className="gap-2"
      >
        {RESPONSE_OPTIONS.map(option => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/20',
              strategy === option.value && 'border-foreground/45 bg-muted/20',
              blocked && 'cursor-not-allowed opacity-60',
            )}
          >
            <RadioGroupItem value={option.value} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{option.description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <div className="border-t pt-3">
        <label className={cn('flex items-start gap-3 text-sm', !canReportChanges && 'opacity-50')}>
          <input
            type="checkbox"
            className="mt-1 size-4 accent-foreground"
            checked={reportChanged}
            disabled={blocked || !canReportChanges}
            onChange={event => setReportChanged(event.target.checked)}
          />
          <span>
            成功后上报变化属性
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">让平台同步设备执行后的属性值。</span>
          </span>
        </label>
      </div>
      <UnavailableNotice>
        运行中应用响应策略尚未接通。这里是未应用的草稿，设备仍按已保存的规则响应。
      </UnavailableNotice>
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onClose}>关闭</Button>
        <Button size="sm" disabled>应用响应策略</Button>
      </div>
    </div>
  );
}

function UnavailableNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
