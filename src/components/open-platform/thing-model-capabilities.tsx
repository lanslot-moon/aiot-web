import { Braces, ChevronRight, Plus, Trash2 } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { labelOf } from '@/lib/open-platform-labels';
import type {
  ThingModelAction,
  ThingModelDefinition,
  ThingModelEvent,
  ThingModelProperty,
} from '@/types/apps/open-platform';

const PROPERTY_ACCESS_LABEL: Record<string, string> = {
  READ_ONLY: '只读',
  WRITE_ONLY: '只写',
  READ_WRITE: '读写',
};

const INVOKE_MODE_LABEL: Record<string, string> = {
  SYNC: '同步',
  ASYNC: '异步',
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  INFO: '信息',
  WARN: '告警',
  FAULT: '故障',
};

type SchemaRecord = Record<string, unknown>;
export type ThingModelCapabilityKind = 'property' | 'action' | 'event';

function schemaRecord(schema: unknown): SchemaRecord | null {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null;
  return schema as SchemaRecord;
}

function schemaProperties(schema: unknown) {
  const properties = schemaRecord(schema)?.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return [] as Array<[string, unknown]>;
  }
  return Object.entries(properties);
}

function schemaRequiredFields(schema: unknown) {
  const required = schemaRecord(schema)?.required;
  return new Set(
    Array.isArray(required)
      ? required.filter((field): field is string => typeof field === 'string')
      : [],
  );
}

function schemaType(schema: unknown) {
  if (schema === true) return 'any';
  if (schema === false) return 'never';
  const type = schemaRecord(schema)?.type;
  return typeof type === 'string' ? type : 'unknown';
}

function schemaConstraintSummary(schema: unknown) {
  if (schema === true) return '任意结构';
  if (schema === false) return '不允许';

  const record = schemaRecord(schema);
  if (!record) return '无额外约束';

  const summary: string[] = [];
  if (typeof record.format === 'string') summary.push(record.format);
  if (typeof record.unit === 'string') summary.push(record.unit);
  if (typeof record.minimum === 'number' || typeof record.maximum === 'number') {
    summary.push(`${record.minimum ?? '—'}–${record.maximum ?? '—'}`);
  }
  if (Array.isArray(record.enum)) {
    summary.push(`枚举 ${record.enum.map((value) => JSON.stringify(value)).join(' / ')}`);
  }
  if (typeof record.minLength === 'number' || typeof record.maxLength === 'number') {
    summary.push(`长度 ${record.minLength ?? 0}–${record.maxLength ?? '不限'}`);
  }
  if (typeof record.minItems === 'number' || typeof record.maxItems === 'number') {
    summary.push(`元素数量 ${record.minItems ?? 0}–${record.maxItems ?? '不限'}`);
  }
  if (record.additionalProperties === false) summary.push('不允许额外字段');
  if (record.uniqueItems === true) summary.push('元素不可重复');
  if (typeof record.pattern === 'string') summary.push(`匹配 ${record.pattern}`);
  if (typeof record.multipleOf === 'number') summary.push(`${record.multipleOf} 的倍数`);
  if (typeof record.exclusiveMinimum === 'number') summary.push(`大于 ${record.exclusiveMinimum}`);
  if (typeof record.exclusiveMaximum === 'number') summary.push(`小于 ${record.exclusiveMaximum}`);
  if ('const' in record) summary.push(`固定值 ${JSON.stringify(record.const)}`);

  return summary.join(' · ') || '无额外约束';
}

function schemaShapeSummary(schema: unknown) {
  if (schema === true) return '任意结构';
  if (schema === false) return '不允许';
  const record = schemaRecord(schema);
  const properties = schemaProperties(schema);
  if (record?.type === 'object') {
    return properties.length > 0 ? `${properties.length} 个顶层参数` : '无参数';
  }
  return schemaType(schema);
}

function EmptyCapabilityList({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
      暂无{label}能力
    </p>
  );
}

export function ThingModelCapabilitySummary({
  definition,
}: {
  definition?: ThingModelDefinition | null;
}) {
  const properties = definition?.properties ?? [];
  const actions = definition?.actions ?? [];
  const events = definition?.events ?? [];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>
        <strong className="mr-1 text-sm font-semibold text-foreground">
          {properties.length}
        </strong>
        属性
      </span>
      <span>
        <strong className="mr-1 text-sm font-semibold text-foreground">
          {actions.length}
        </strong>
        动作
      </span>
      <span>
        <strong className="mr-1 text-sm font-semibold text-foreground">
          {events.length}
        </strong>
        事件
      </span>
    </div>
  );
}

function CapabilityJsonDialog({
  capabilityType,
  code,
  value,
}: {
  capabilityType: '属性' | '动作' | '事件';
  code: string;
  value: unknown;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="xs" className="gap-1">
            <Braces className="size-3.5" aria-hidden />
            查看 JSON 配置
          </Button>
        }
      />
      <DialogContent className="grid max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{capabilityType} JSON 配置</DialogTitle>
          <DialogDescription>
            仅展示 {code} 这一项能力的配置，不包含其他能力或版本信息。
          </DialogDescription>
        </DialogHeader>
        <pre className="min-h-0 overflow-auto rounded-lg border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function SchemaNode({ code, schema, required = false }: { code: string; schema: unknown; required?: boolean }) {
  const record = schemaRecord(schema);
  const properties = schemaProperties(schema);
  const requiredFields = schemaRequiredFields(schema);
  const hasItems = record != null && 'items' in record;
  const constraint = schemaConstraintSummary(schema);
  const header = <>
    <code className="break-all font-mono text-[11px] font-medium">{code}</code>
    <code className="font-mono text-[11px] text-muted-foreground">{schemaType(schema)}</code>
    {required && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">必选</Badge>}
    {constraint !== '无额外约束' && <span className="min-w-0 break-words text-[11px] text-muted-foreground">{constraint}</span>}
    {typeof record?.description === 'string' && <span className="w-full text-[11px] text-muted-foreground">{record.description}</span>}
  </>;

  if (!properties.length && !hasItems) {
    return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2">{header}</div>;
  }

  return <details open className="group/schema">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2.5 py-2 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <ChevronRight className="size-3 shrink-0 transition-transform group-open/schema:rotate-90" aria-hidden />
      {header}
    </summary>
    <div className="mb-2 ml-4 min-w-0 border-l pl-2 sm:ml-5">
      {properties.map(([field, fieldSchema]) => <SchemaNode key={field} code={field} schema={fieldSchema} required={requiredFields.has(field)} />)}
      {hasItems && <SchemaNode code="数组元素 []" schema={record.items} />}
    </div>
  </details>;
}

function SchemaDefinition({ title, schema }: { title: string; schema: unknown }) {
  const properties = schemaProperties(schema);
  const requiredFields = schemaRequiredFields(schema);
  const constraint = schemaConstraintSummary(schema);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <p className="font-medium">{title}</p>
        {properties.length > 0 && constraint !== '无额外约束' && <span>{constraint}</span>}
      </div>
      <div className="min-w-0 divide-y rounded-md border bg-background/70">
        {properties.length ? properties.map(([code, propertySchema]) => <SchemaNode key={code} code={code} schema={propertySchema} required={requiredFields.has(code)} />)
          : <SchemaNode code="数据定义" schema={schema} />}
      </div>
    </div>
  );
}

function RemoveCapabilityButton({
  kind,
  code,
  onRemove,
  compact = false,
}: {
  kind: ThingModelCapabilityKind;
  code: string;
  onRemove?: (kind: ThingModelCapabilityKind, code: string) => void;
  compact?: boolean;
}) {
  if (!onRemove) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? 'icon-xs' : 'xs'}
      className={compact ? 'text-muted-foreground hover:text-destructive' : 'gap-1 text-muted-foreground hover:text-destructive'}
      aria-label={compact ? `删除${code}能力` : undefined}
      title={compact ? `删除${code}能力` : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onRemove(kind, code);
      }}
    >
      <Trash2 className="size-3.5" aria-hidden />
      {compact ? null : '移除能力'}
    </Button>
  );
}

function PropertyDetails({
  property,
}: {
  property: ThingModelProperty;
}) {
  return (
    <div className="space-y-2">
      <SchemaDefinition title="数据定义" schema={property.schema} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {property.required ? (
          <span className="text-[11px] text-muted-foreground">品类必选能力，不可移除</span>
        ) : null}
        <CapabilityJsonDialog capabilityType="属性" code={property.code} value={property} />
      </div>
    </div>
  );
}

function ActionDetails({
  action,
}: {
  action: ThingModelAction;
}) {
  return (
    <div className="space-y-2">
      <SchemaDefinition title="输入参数" schema={action.inputSchema} />
      <SchemaDefinition title="输出参数" schema={action.outputSchema} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CapabilityJsonDialog capabilityType="动作" code={action.code} value={action} />
      </div>
    </div>
  );
}

function EventDetails({
  event,
}: {
  event: ThingModelEvent;
}) {
  return (
    <div className="space-y-2">
      <SchemaDefinition title="输出参数" schema={event.outputSchema} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CapabilityJsonDialog capabilityType="事件" code={event.code} value={event} />
      </div>
    </div>
  );
}

function PropertyList({
  items,
  onRemove,
}: {
  items: ThingModelProperty[];
  onRemove?: (kind: ThingModelCapabilityKind, code: string) => void;
}) {
  if (items.length === 0) return <EmptyCapabilityList label="属性" />;

  return (
    <Accordion aria-label="物模型属性列表" className="rounded-lg border">
      {items.map((property) => {
        const constraint = schemaConstraintSummary(property.schema);
        return (
          <AccordionItem key={property.code} value={property.code} className="px-3">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <AccordionTrigger className="w-full items-center rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-xs font-medium">{property.title}</span>
                      <code className="font-mono text-[11px] text-muted-foreground">
                        {property.code}
                      </code>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {labelOf(PROPERTY_ACCESS_LABEL, property.access)}
                      </Badge>
                      {property.required ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          必选
                        </Badge>
                      ) : null}
                      <code className="font-mono text-[11px] text-muted-foreground">
                        {schemaType(property.schema)}
                      </code>
                      {constraint !== '无额外约束' ? (
                        <span className="text-muted-foreground">· {constraint}</span>
                      ) : null}
                    </div>
                  </div>
                </AccordionTrigger>
              </div>
              {!property.required ? (
                <RemoveCapabilityButton
                  kind="property"
                  code={property.code}
                  onRemove={onRemove}
                  compact
                />
              ) : null}
            </div>
            <AccordionContent className="px-2 pb-3">
              <PropertyDetails property={property} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function ActionList({
  items,
  onRemove,
}: {
  items: ThingModelAction[];
  onRemove?: (kind: ThingModelCapabilityKind, code: string) => void;
}) {
  if (items.length === 0) return <EmptyCapabilityList label="动作" />;

  return (
    <Accordion aria-label="物模型动作列表" className="rounded-lg border">
      {items.map((action) => (
        <AccordionItem key={action.code} value={action.code} className="px-3">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <AccordionTrigger className="w-full items-center rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-xs font-medium">{action.title}</span>
                    <code className="font-mono text-[11px] text-muted-foreground">
                      {action.code}
                    </code>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {labelOf(INVOKE_MODE_LABEL, action.invokeMode)}
                    </Badge>
                    <span className="text-muted-foreground">
                      输入 {schemaShapeSummary(action.inputSchema)}
                    </span>
                    <span className="text-muted-foreground">
                      输出 {schemaShapeSummary(action.outputSchema)}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
            </div>
            <RemoveCapabilityButton kind="action" code={action.code} onRemove={onRemove} compact />
          </div>
          <AccordionContent className="px-2 pb-3">
            <ActionDetails action={action} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function EventList({
  items,
  onRemove,
}: {
  items: ThingModelEvent[];
  onRemove?: (kind: ThingModelCapabilityKind, code: string) => void;
}) {
  if (items.length === 0) return <EmptyCapabilityList label="事件" />;

  return (
    <Accordion aria-label="物模型事件列表" className="rounded-lg border">
      {items.map((event) => (
        <AccordionItem key={event.code} value={event.code} className="px-3">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <AccordionTrigger className="w-full items-center rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-xs font-medium">{event.title}</span>
                    <code className="font-mono text-[11px] text-muted-foreground">
                      {event.code}
                    </code>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <Badge
                      variant={event.eventType === 'FAULT' ? 'destructive' : 'outline'}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {labelOf(EVENT_TYPE_LABEL, event.eventType)}
                    </Badge>
                    <span className="text-muted-foreground">
                      输出 {schemaShapeSummary(event.outputSchema)}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
            </div>
            <RemoveCapabilityButton kind="event" code={event.code} onRemove={onRemove} compact />
          </div>
          <AccordionContent className="px-2 pb-3">
            <EventDetails event={event} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function ThingModelCapabilityTabs({
  definition,
  onRemove,
  onAdd,
}: {
  definition: ThingModelDefinition;
  onRemove?: (kind: ThingModelCapabilityKind, code: string) => void;
  onAdd?: (kind: ThingModelCapabilityKind) => void;
}) {
  const properties = definition.properties ?? [];
  const actions = definition.actions ?? [];
  const events = definition.events ?? [];
  const defaultTab = properties.length ? 'properties' : actions.length ? 'actions' : 'events';

  return (
    <Tabs defaultValue={defaultTab} className="flex-col gap-2">
      <TabsList variant="line" className="h-8 w-full justify-start border-b">
        <TabsTrigger
          value="properties"
          className="h-8 px-2 text-xs data-active:!rounded-md data-active:!bg-muted/70 data-active:!font-semibold data-active:!text-foreground"
        >
          属性 <span className="text-[11px] text-muted-foreground">{properties.length}</span>
        </TabsTrigger>
        <TabsTrigger
          value="actions"
          className="h-8 px-2 text-xs data-active:!rounded-md data-active:!bg-muted/70 data-active:!font-semibold data-active:!text-foreground"
        >
          动作 <span className="text-[11px] text-muted-foreground">{actions.length}</span>
        </TabsTrigger>
        <TabsTrigger
          value="events"
          className="h-8 px-2 text-xs data-active:!rounded-md data-active:!bg-muted/70 data-active:!font-semibold data-active:!text-foreground"
        >
          事件 <span className="text-[11px] text-muted-foreground">{events.length}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="mt-2">
        {onAdd ? (
          <div className="mb-2 flex justify-end">
            <Button type="button" variant="outline" size="xs" className="gap-1" onClick={() => onAdd('property')}>
              <Plus className="size-3.5" aria-hidden />
              新增属性
            </Button>
          </div>
        ) : null}
        <PropertyList items={properties} onRemove={onRemove} />
      </TabsContent>
      <TabsContent value="actions" className="mt-2">
        {onAdd ? (
          <div className="mb-2 flex justify-end">
            <Button type="button" variant="outline" size="xs" className="gap-1" onClick={() => onAdd('action')}>
              <Plus className="size-3.5" aria-hidden />
              新增动作
            </Button>
          </div>
        ) : null}
        <ActionList items={actions} onRemove={onRemove} />
      </TabsContent>
      <TabsContent value="events" className="mt-2">
        {onAdd ? (
          <div className="mb-2 flex justify-end">
            <Button type="button" variant="outline" size="xs" className="gap-1" onClick={() => onAdd('event')}>
              <Plus className="size-3.5" aria-hidden />
              新增事件
            </Button>
          </div>
        ) : null}
        <EventList items={events} onRemove={onRemove} />
      </TabsContent>
    </Tabs>
  );
}
