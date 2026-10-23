import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import type { DeviceDetail } from '@/api/device/client';
import { request } from '@/api/iam/client';
import { decodeMap, encodeValue, type ProfileVersion, type SimulationInstance, type ValueMap } from '@/api/device/simulation';
import type { ThingModelDefinition, ThingModelProperty } from '@/types/apps/open-platform';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { useResource } from '@/components/iam/shared-utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import CommandField from '../command-fields';
import { CommandControlTheme } from '../command-control-theme';
import { fieldError, initialValue, supportsForm } from '../command-schema';
import { usePropertyReport } from './use-property-report';
import { useSimulation } from './use-simulation';

interface SingleReportPanelProps {
  projectId: string;
  device: DeviceDetail;
  instance?: SimulationInstance;
  blocked: boolean;
  blockedReason: string;
  onClose: () => void;
}

export default function SingleReportPanel({
  projectId,
  device,
  instance,
  blocked,
  blockedReason,
  onClose,
}: SingleReportPanelProps) {
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [jsonEdits, setJsonEdits] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [formRevision, setFormRevision] = useState(0);
  const [formError, setFormError] = useState<Error | null>(null);
  const report = usePropertyReport(projectId);

  const modelPath = `/api/v1/products/${encodeURIComponent(device.productId)}/model/published`;
  const model = useResource<ThingModelDefinition | null>(
    modelPath,
    'product:view',
    path => request(path, 'GET', undefined, { projectId }),
    `simulation-model:${projectId}`,
  );
  const versionPath = instance
    ? `profiles/${encodeURIComponent(instance.profileId)}/versions/${instance.profileVersion}`
    : null;
  const version = useSimulation<ProfileVersion>(projectId, versionPath);

  const properties = model.data?.properties ?? [];
  const visibleProperties = properties.filter(property => !removed.includes(property.code));
  const initialProperties = version.data
    ? decodeMap({ ...version.data.snapshot.initialProperties, ...instance?.configuration.initialOverrides })
    : {};
  const editingBlocked = blocked || report.working || report.pending;
  const submitBlocked = blocked || !!blockedReason || model.isLoading || !!model.error || !visibleProperties.length;
  let actionLabel = '更新并上报';
  if (report.pending) actionLabel = '查询上报结果';
  if (report.working) actionLabel = '处理中…';

  function propertyValue(property: ThingModelProperty): unknown {
    if (Object.prototype.hasOwnProperty.call(edits, property.code)) return edits[property.code];
    return initialProperties[property.code] ?? initialValue(property.schema);
  }

  function resetForm() {
    setEdits({});
    setJsonEdits({});
    setSelection({});
    setRemoved([]);
    setFormError(null);
    setFormRevision(revision => revision + 1);
    report.clearFeedback();
  }

  function removeProperty(code: string) {
    setRemoved(current => [...current, code]);
    setSelection(current => ({ ...current, [code]: false }));
  }

  function buildPayload(): ValueMap {
    const selected = visibleProperties.filter(property => selection[property.code] !== false);
    if (!selected.length) throw new Error('至少选择一个上报属性。');

    const payload: ValueMap = {};
    for (const property of selected) {
      let value = propertyValue(property);
      const jsonDraft = jsonEdits[property.code];
      if (!supportsForm(property.schema) && jsonDraft !== undefined) {
        try {
          value = JSON.parse(jsonDraft);
        } catch {
          throw new Error(`${property.title}：请输入有效的 JSON。`);
        }
      }

      const validationError = fieldError(property.schema, value);
      if (validationError) throw new Error(`${property.title}：${validationError}`);
      payload[property.code] = encodeValue(value);
    }

    return payload;
  }

  async function handleReport() {
    setFormError(null);
    if (report.pending) {
      await report.queryPending();
      return;
    }

    try {
      if (blocked || blockedReason || !instance?.activeSessionId) {
        throw new Error(blockedReason || '请先开启设备模拟。');
      }
      if (model.isLoading || model.error || !model.data) {
        throw new Error('请先加载已发布物模型。');
      }

      const payload = buildPayload();
      await report.submit(instance, payload);
    } catch (failure) {
      setFormError(failure instanceof Error ? failure : new Error('请检查上报属性。'));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">上报模拟数据</h3>
        <Button
          size="sm"
          variant="ghost"
          disabled={editingBlocked || model.isLoading || !properties.length}
          onClick={resetForm}
          title="恢复全部属性及初始填写值"
        >
          <RotateCcw aria-hidden className="size-3.5" />重置
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        点击卡片选择本次上报属性，蓝框表示已选；可移除不需要的项，重置恢复全部属性和初始值。
      </p>
      <ErrorNotice error={model.error} retry={() => model.mutate()} />
      {model.isLoading && <Loading />}

      <CommandControlTheme key={formRevision}>
        <div className="space-y-2 [&_.ant-input-number]:min-w-28">
          {visibleProperties.map(property => (
            <ReportPropertyCard
              key={property.code}
              property={property}
              value={propertyValue(property)}
              jsonDraft={jsonEdits[property.code]}
              selected={selection[property.code] !== false}
              disabled={editingBlocked}
              onToggle={() => setSelection(current => ({ ...current, [property.code]: current[property.code] === false }))}
              onValueChange={value => setEdits(current => ({ ...current, [property.code]: value }))}
              onJsonChange={value => setJsonEdits(current => ({ ...current, [property.code]: value }))}
              onRemove={() => removeProperty(property.code)}
            />
          ))}
        </div>
      </CommandControlTheme>

      {!model.isLoading && properties.length > 0 && !visibleProperties.length && (
        <p role="status" className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          已移除全部属性，点击右上角“重置”恢复。
        </p>
      )}
      {!model.isLoading && !properties.length && (
        <p className="text-sm text-muted-foreground">产品发布物模型后可配置上报属性。</p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        更新运行中设备的所选属性，并主动上报一次。不会创建周期任务或修改自动上报设置。
      </p>
      {blockedReason && <p role="status" className="text-xs text-muted-foreground">{blockedReason.replace(/发送指令/g, '单次上报')}</p>}
      <ErrorNotice error={formError || report.error} />
      {report.message && <p role="status" className="text-xs leading-5">{report.message}</p>}
      {report.pending && !report.working && (
        <p role="status" className="text-xs text-muted-foreground">操作结果尚未确认，请查询结果或核对通讯日志，避免重复上报。</p>
      )}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onClose}>关闭</Button>
        <Button size="sm" disabled={report.working || (!report.pending && submitBlocked)} onClick={() => void handleReport()}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

interface ReportPropertyCardProps {
  property: ThingModelProperty;
  value: unknown;
  jsonDraft?: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onValueChange: (value: unknown) => void;
  onJsonChange: (value: string) => void;
  onRemove: () => void;
}

function ReportPropertyCard({
  property,
  value,
  jsonDraft,
  selected,
  disabled,
  onToggle,
  onValueChange,
  onJsonChange,
  onRemove,
}: ReportPropertyCardProps) {
  const inputDisabled = disabled || !selected;

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const interactiveElement = (event.target as HTMLElement).closest(
      'input, textarea, select, button, a, [data-slot="field-content"], [role="slider"], [role="switch"], [role="combobox"]',
    );
    if (!disabled && !interactiveElement) onToggle();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onToggle();
  }

  return (
    <div
      role="group"
      aria-label={`${property.title}模拟值`}
      aria-description={selected ? '已选择上报，按回车或空格取消选择' : '未选择上报，按回车或空格选择'}
      tabIndex={disabled ? -1 : 0}
      data-selected={selected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border bg-muted/10 px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        selected && 'border-blue-500/60 bg-blue-500/[0.03] dark:border-blue-400/60 dark:bg-blue-400/5',
      )}
    >
      <div className="min-w-0 flex-1">
        {supportsForm(property.schema) ? (
          <CommandField
            inline
            controlPanel
            schema={property.schema}
            label={`${property.title} · ${property.code}`}
            value={value}
            disabled={inputDisabled}
            onChange={onValueChange}
          />
        ) : (
          <label className="block space-y-1 py-1">
            <span className="text-sm">{property.title} · {property.code}</span>
            <textarea
              aria-label={`${property.title} JSON 值`}
              className="min-h-24 w-full rounded-md border bg-background p-2 font-mono text-xs"
              disabled={inputDisabled}
              value={jsonDraft ?? JSON.stringify(value, null, 2)}
              onChange={event => onJsonChange(event.target.value)}
            />
          </label>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="size-8! shrink-0 text-muted-foreground"
        aria-label={`移除上报属性${property.title}`}
        title={`移除${property.title}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 aria-hidden className="size-3.5" />
      </Button>
    </div>
  );
}
