import { useState } from 'react';
import { Field, Input, Choice as ProjectSelect } from '@/components/ota/shared';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { Button } from '@/components/ui/button';
import type { Json, JsonObject } from '@/api/rule-engine/client';
import { isObject } from './graph';

type EditorProps = { value: JsonObject; change: (next: JsonObject) => void };
const ops = {
  GE: '大于等于 ≥',
  GT: '大于 >',
  LE: '小于等于 ≤',
  LT: '小于 <',
  EQ: '等于 =',
  NE: '不等于 ≠',
};
const events: Record<string, string> = {
  'deviceMessage.propertyReport': '属性上报',
  'deviceMessage.eventReport': '事件上报',
  'deviceMessage.actionReply': '指令回复',
  'deviceConnection.online': '设备上线',
  'deviceConnection.offline': '设备离线',
  'deviceConnection.activity': '设备活动',
  'deviceMessage.diagnosticReport': '诊断上报',
  'deviceMessage.shadowReport': '影子上报',
  'deviceMessage.firmwareVersionReport': '固件版本上报',
  'deviceMessage.otaProgress': '升级进度',
  'deviceMessage.configurationStatus': '配置状态',
  'deviceMessage.topologyReport': '拓扑上报',
  'deviceMessage.customMessage': '自定义消息',
};
export function TextField({
  label,
  value,
  change,
  numeric = false,
  min,
  required = true,
}: {
  label: string;
  value: Json | undefined;
  change: (v: string | number | null) => void;
  numeric?: boolean;
  min?: number;
  required?: boolean;
}) {
  return (
    <Field title={label} required={required}>
      <Input
        aria-label={label}
        required={required}
        type={numeric ? 'number' : 'text'}
        min={min}
        step={numeric && min === undefined ? 'any' : undefined}
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={(e) =>
          change(numeric ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)
        }
      />
    </Field>
  );
}
export function ListField({
  label,
  value,
  change,
  required = false,
}: {
  label: string;
  value: Json | undefined;
  change: (v: string[]) => void;
  required?: boolean;
}) {
  const [text, setText] = useState(() => (Array.isArray(value) ? value.join(', ') : ''));
  return (
    <Field title={label} required={required}>
      <Input
        aria-label={label}
        required={required}
        value={text}
        placeholder="多个值用逗号分隔"
        onChange={(e) => {
          setText(e.target.value);
          change([
            ...new Set(
              e.target.value
                .split(/[,，\n]/)
                .map((v) => v.trim())
                .filter(Boolean),
            ),
          ]);
        }}
      />
    </Field>
  );
}
export function Choice({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: Json | undefined;
  options: Record<string, string>;
  change: (v: string) => void;
}) {
  return (
    <Field title={label}>
      <ProjectSelect
        label={label}
        value={String(value ?? '')}
        options={Object.entries(options).map(([value, label]) => ({ value, label }))}
        onValueChange={change}
      />
    </Field>
  );
}
export function TriggerFields({ value, change }: EditorProps) {
  const selected = Array.isArray(value.eventTypes) ? value.eventTypes : [];
  return (
    <>
      <Choice
        label="触发方式"
        value={value.type}
        options={{ DOMAIN_EVENT: '设备事件', MANUAL: '手动触发', SCHEDULE: '定时触发' }}
        change={(type) =>
          change(
            type === 'DOMAIN_EVENT'
              ? { type, eventTypes: ['deviceMessage.propertyReport'], eventIdentifiers: [] }
              : type === 'MANUAL'
                ? { type, allowed: true }
                : { type, cron: '0 0 9 * * *', zoneId: 'Asia/Shanghai', misfirePolicy: 'SKIP' },
          )
        }
      />
      {value.type === 'DOMAIN_EVENT' && (
        <>
          <Field title="订阅事件" required>
            <Select
              multiple
              value={selected.filter((key): key is string => typeof key === 'string')}
              onValueChange={(eventTypes) => change({ ...value, eventTypes })}
            >
              <SelectTrigger aria-label="订阅事件" className="w-full min-w-0">
                <SelectValue className="min-w-0">
                  <span className="truncate">
                    {selected.length
                      ? selected.map((key) => events[String(key)] ?? String(key)).join('、')
                      : '选择订阅事件'}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="max-h-64 rounded-md!">
                {Object.entries(events).map(([key, text]) => (
                  <SelectItem key={key} value={key}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <ListField
            label="物模型事件标识（可选）"
            value={value.eventIdentifiers}
            change={(eventIdentifiers) => change({ ...value, eventIdentifiers })}
          />
        </>
      )}
      {value.type === 'MANUAL' && (
        <Label className="flex items-center justify-between gap-3">
          允许手动执行
          <Switch
            checked={value.allowed === true}
            onCheckedChange={(allowed) => change({ ...value, allowed })}
          />
        </Label>
      )}
      {value.type === 'SCHEDULE' && (
        <>
          <TextField
            label="执行计划（六段 Cron）"
            value={value.cron}
            change={(cron) => change({ ...value, cron })}
          />
          <TextField
            label="时区"
            value={value.zoneId}
            change={(zoneId) => change({ ...value, zoneId })}
          />
          <Choice
            label="错过计划时"
            value={value.misfirePolicy}
            options={{ SKIP: '跳过', COALESCE: '合并执行一次' }}
            change={(misfirePolicy) => change({ ...value, misfirePolicy })}
          />
        </>
      )}
    </>
  );
}
export function PredicateFields({ value, change }: EditorProps) {
  const { left, right } = value;
  if (
    !isObject(left) ||
    left.type !== 'field' ||
    !isObject(right) ||
    right.type !== 'constant' ||
    !isObject(right.value) ||
    right.value.type !== 'number' ||
    !Object.prototype.hasOwnProperty.call(ops, String(value.operator))
  )
    return <p className="text-sm text-muted-foreground">此表达式可在高级配置中编辑。</p>;
  const constant = right.value;
  return (
    <>
      <TextField
        label="比较字段"
        value={left.path}
        change={(path) => change({ ...value, left: { ...left, path } })}
      />
      <Choice
        label="比较方式"
        value={value.operator}
        options={ops}
        change={(operator) => change({ ...value, operator })}
      />
      <TextField
        numeric
        label="阈值"
        value={constant.value}
        change={(number) =>
          change({ ...value, right: { ...right, value: { ...constant, value: number } } })
        }
      />
    </>
  );
}
export function MappingFields({ value, change }: EditorProps) {
  return (
    <div className="grid gap-3">
      {Object.entries(value).map(([key, expr]) => {
        const constant =
          isObject(expr) && expr.type === 'constant' && isObject(expr.value) ? expr.value : null;
        return (
          <fieldset key={key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              字段名称
              <Input
                defaultValue={key}
                required
                onChange={(e) => {
                  const v = e.target.value.trim();
                  e.target.setCustomValidity(
                    !v
                      ? '请输入字段名称'
                      : v !== key && Object.prototype.hasOwnProperty.call(value, v)
                        ? '字段名称重复'
                        : '',
                  );
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== key && e.target.validity.valid)
                    change(
                      Object.fromEntries(
                        Object.entries(value).map(([k, x]) => [k === key ? v : k, x]),
                      ),
                    );
                }}
              />
            </label>
            {constant &&
            isObject(expr) &&
            (constant.type === 'text' || constant.type === 'number') ? (
              <>
                <Choice
                  label="值类型"
                  value={constant.type}
                  options={{ text: '文本', number: '数值' }}
                  change={(type) =>
                    change({
                      ...value,
                      [key]: { ...expr, value: { type, value: type === 'number' ? 0 : '' } },
                    })
                  }
                />
                <TextField
                  label="写入值"
                  value={constant.value}
                  numeric={constant.type === 'number'}
                  change={(v) =>
                    change({ ...value, [key]: { ...expr, value: { ...constant, value: v } } })
                  }
                />
              </>
            ) : (
              <span className="text-sm">此表达式可在高级配置中编辑。</span>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-end justify-self-end"
              onClick={() =>
                change(Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)))
              }
            >
              移除字段
            </Button>
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          let i = 1;
          while (Object.prototype.hasOwnProperty.call(value, 'field' + i)) i++;
          change({
            ...value,
            ['field' + i]: { type: 'constant', value: { type: 'text', value: '' } },
          });
        }}
      >
        添加字段
      </Button>
    </div>
  );
}
