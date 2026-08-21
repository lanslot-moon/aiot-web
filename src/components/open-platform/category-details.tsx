import { Braces } from 'lucide-react';

import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  categoryEnglishLabel,
  categoryLabel,
  categoryPath,
} from '@/lib/open-platform-category';
import { labelOf } from '@/lib/open-platform-labels';
import type {
  CategoryTemplateAction,
  CategoryTemplateEvent,
  CategoryTemplateProperty,
  CategoryTemplateView,
  CategoryVersionView,
  CategoryView,
} from '@/types/apps/open-platform';

const CATEGORY_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '启用',
  DISABLED: '已停用',
  DEPRECATED: '已废弃',
};

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

function objectSchemaSummary(schema: SchemaRecord, properties: Array<[string, unknown]>) {
  if (properties.length > 0) return `${properties.length} 个参数`;
  return schema.additionalProperties === false ? '无参数' : '任意结构';
}

function schemaShapeSummary(schema: unknown) {
  if (schema === true) return '任意结构';
  if (schema === false) return '不允许';

  const record = schemaRecord(schema);
  const properties = schemaProperties(schema);
  if (record?.type === 'object') {
    return objectSchemaSummary(record, properties);
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

function CapabilitySummary({ template }: { template: CategoryTemplateView }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>
        <strong className="mr-1 text-sm font-semibold text-foreground">
          {template.properties.length}
        </strong>
        属性
      </span>
      <span>
        <strong className="mr-1 text-sm font-semibold text-foreground">
          {template.actions.length}
        </strong>
        动作
      </span>
      <span>
        <strong className="mr-1 text-sm font-semibold text-foreground">
          {template.events.length}
        </strong>
        事件
      </span>
    </div>
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
    const record = schemaRecord(schema);
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {record?.type === 'object' ? objectSchemaSummary(record, properties) : '无固定参数'}
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

function SchemaDefinition({
  title,
  schema,
}: {
  title: string;
  schema: unknown;
}) {
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

function CapabilityJsonDialog({
  capabilityType,
  code,
  value,
}: {
  capabilityType: '属性' | '动作' | '事件';
  code: string;
  value: unknown;
}) {
  const configJson = JSON.stringify(value, null, 2);

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
          {configJson}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function PropertyDetails({ property }: { property: CategoryTemplateProperty }) {
  return (
    <div className="space-y-2">
      <SchemaDefinition title="数据定义" schema={property.schema} />
      <div className="flex justify-end">
        <CapabilityJsonDialog
          capabilityType="属性"
          code={property.code}
          value={property}
        />
      </div>
    </div>
  );
}

function ActionDetails({ action }: { action: CategoryTemplateAction }) {
  return (
    <div className="space-y-2">
      <SchemaDefinition title="输入参数" schema={action.inputSchema} />
      <SchemaDefinition title="输出参数" schema={action.outputSchema} />
      <div className="flex justify-end">
        <CapabilityJsonDialog capabilityType="动作" code={action.code} value={action} />
      </div>
    </div>
  );
}

function EventDetails({ event }: { event: CategoryTemplateEvent }) {
  return (
    <div className="space-y-2">
      <SchemaDefinition title="输出参数" schema={event.outputSchema} />
      <div className="flex justify-end">
        <CapabilityJsonDialog capabilityType="事件" code={event.code} value={event} />
      </div>
    </div>
  );
}

function PropertyList({ items }: { items: CategoryTemplateProperty[] }) {
  if (items.length === 0) return <EmptyCapabilityList label="属性" />;

  return (
    <Accordion aria-label="属性列表" className="rounded-lg border">
      {items.map((property) => {
        const constraint = schemaConstraintSummary(property.schema);
        return (
          <AccordionItem key={property.code} value={property.code} className="px-3">
            <AccordionTrigger className="rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
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
            <AccordionContent className="px-2 pb-3">
              <PropertyDetails property={property} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function ActionList({ items }: { items: CategoryTemplateAction[] }) {
  if (items.length === 0) return <EmptyCapabilityList label="动作" />;

  return (
    <Accordion aria-label="动作列表" className="rounded-lg border">
      {items.map((action) => (
        <AccordionItem key={action.code} value={action.code} className="px-3">
          <AccordionTrigger className="rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
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
          <AccordionContent className="px-2 pb-3">
            <ActionDetails action={action} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function EventList({ items }: { items: CategoryTemplateEvent[] }) {
  if (items.length === 0) return <EmptyCapabilityList label="事件" />;

  return (
    <Accordion aria-label="事件列表" className="rounded-lg border">
      {items.map((event) => (
        <AccordionItem key={event.code} value={event.code} className="px-3">
          <AccordionTrigger className="rounded-md px-2 py-2.5 font-normal hover:bg-muted/50 hover:no-underline">
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
          <AccordionContent className="px-2 pb-3">
            <EventDetails event={event} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function CapabilityTabs({ template }: { template: CategoryTemplateView }) {
  const defaultTab = template.properties.length
    ? 'properties'
    : template.actions.length
      ? 'actions'
      : 'events';

  return (
    <Tabs defaultValue={defaultTab} className="flex-col gap-2">
      <TabsList variant="line" className="h-8 w-full justify-start border-b">
        <TabsTrigger value="properties" className="h-8 px-2 text-xs">
          属性 <span className="text-[11px] text-muted-foreground">{template.properties.length}</span>
        </TabsTrigger>
        <TabsTrigger value="actions" className="h-8 px-2 text-xs">
          动作 <span className="text-[11px] text-muted-foreground">{template.actions.length}</span>
        </TabsTrigger>
        <TabsTrigger value="events" className="h-8 px-2 text-xs">
          事件 <span className="text-[11px] text-muted-foreground">{template.events.length}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="properties" className="mt-2">
        <PropertyList items={template.properties} />
      </TabsContent>
      <TabsContent value="actions" className="mt-2">
        <ActionList items={template.actions} />
      </TabsContent>
      <TabsContent value="events" className="mt-2">
        <EventList items={template.events} />
      </TabsContent>
    </Tabs>
  );
}

export function CategoryDetails({
  category,
  versions = [],
  compact = false,
}: {
  category?: CategoryView;
  versions?: CategoryVersionView[];
  compact?: boolean;
}) {
  if (!category) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed px-5 text-center text-sm text-muted-foreground">
        选择左侧品类查看详情
      </div>
    );
  }

  const activeVersion =
    versions.find((version) => version.versionStatus === 'PUBLISHED') ?? versions[0];
  const template = activeVersion?.template ?? { properties: [], actions: [], events: [] };
  const name = categoryLabel(category);
  const englishName = categoryEnglishLabel(category);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{name}</CardTitle>
            <CardDescription className="mt-1 break-all text-xs">
              {englishName} · {categoryPath(category)}
            </CardDescription>
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs">
              <span className="shrink-0 text-muted-foreground">品类编码</span>
              <code className="min-w-0 break-all font-mono text-[11px]">
                {category.categoryCode}
              </code>
              <CopyIdButton value={category.categoryCode} label="Category Code" />
            </div>
          </div>
          <Badge variant={category.status === 'ACTIVE' ? 'secondary' : 'outline'}>
            {labelOf(CATEGORY_STATUS_LABEL, category.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-3">
        {category.leaf ? (
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium">标准能力</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {activeVersion
                  ? '当前品类可用于产品的标准属性、动作和事件'
                  : '该叶子品类暂未配置标准能力'}
              </p>
            </div>
            {activeVersion ? (
              <div className="mt-2">
                <CapabilitySummary template={template} />
              </div>
            ) : null}
          </div>
        ) : null}

        {!compact && category.leaf && activeVersion ? (
          <div className="space-y-2 border-t pt-3">
            <div>
              <p className="text-xs font-medium">能力详情</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                点击能力项查看完整的数据约束或输入输出参数。
              </p>
            </div>
            <CapabilityTabs template={template} />
          </div>
        ) : null}

        {compact && category.leaf ? (
          <p className="text-xs text-muted-foreground">
            完整能力定义可在“品类”中查看。
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
