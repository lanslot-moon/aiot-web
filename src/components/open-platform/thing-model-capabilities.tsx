import { Braces, Plus, Trash2 } from 'lucide-react';

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
    summary.push(`枚举 ${record.enum.map((value) => String(value)).join(' / ')}`);
  }

  return summary.join(' · ') || '无额外约束';
}

function schemaShapeSummary(schema: unknown) {
  if (schema === true) return '任意结构';
  if (schema === false) return '不允许';
  const record = schemaRecord(schema);
  const properties = schemaProperties(schema);
  if (record?.type === 'object') {
    return properties.length > 0 ? `${properties.length} 个参数` : '无参数';
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

function SchemaParameterList({ schema }: { schema: unknown }) {
  const properties = schemaProperties(schema);
  const requiredFields = schemaRequiredFields(schema);

  if (schema === true) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        未限定固定参数结构
      </p>
    );
  }

  if (schema === false) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        不接受此参数结构
      </p>
    );
  }

  if (properties.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {schemaRecord(schema)?.type === 'object' ? '无固定参数' : '无固定参数结构'}
      </p>
    );
  }

  return (
    <div className="divide-y rounded-md border bg-background/70">
      {properties.map(([code, propertySchema]) => {
        const constraint = schemaConstraintSummary(propertySchema);
        return (
          <div
            key={code}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2"
          >
            <code className="font-mono text-[11px] text-muted-foreground">{code}</code>
            <code className="font-mono text-[11px]">{schemaType(propertySchema)}</code>
            {requiredFields.has(code) ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                必选
              </Badge>
            ) : null}
            {constraint !== '无额外约束' ? (
              <span className="text-[11px] text-muted-foreground">{constraint}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SchemaDefinition({ title, schema }: { title: string; schema: unknown }) {
  const record = schemaRecord(schema);
  const isObjectSchema = record?.type === 'object';

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
      {isObjectSchema ? (
        <SchemaParameterList schema={schema} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border bg-background/70 px-2.5 py-2 text-xs">
          <span className="text-muted-foreground">数据类型</span>
          <code className="font-mono text-[11px]">{schemaType(schema)}</code>
          <span className="text-[11px] text-muted-foreground">
            {schemaConstraintSummary(schema)}
          </span>
        </div>
      )}
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
            <div className="flex items-start gap-1">
              <AccordionTrigger className="min-w-0 flex-1 rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
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
          <div className="flex items-start gap-1">
            <AccordionTrigger className="min-w-0 flex-1 rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
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
          <div className="flex items-start gap-1">
            <AccordionTrigger className="min-w-0 flex-1 rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
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
        <TabsTrigger value="properties" className="h-8 px-2 text-xs">
          属性 <span className="text-[11px] text-muted-foreground">{properties.length}</span>
        </TabsTrigger>
        <TabsTrigger value="actions" className="h-8 px-2 text-xs">
          动作 <span className="text-[11px] text-muted-foreground">{actions.length}</span>
        </TabsTrigger>
        <TabsTrigger value="events" className="h-8 px-2 text-xs">
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
