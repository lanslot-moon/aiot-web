import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  ArrowLeft,
  Braces,
  Check,
  GitCompare,
  History,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import {
  ThingModelCapabilitySummary,
  ThingModelCapabilityTabs,
  type ThingModelCapabilityKind,
} from '@/components/open-platform/thing-model-capabilities';
import { ProductLifecycleBadge } from '@/components/open-platform/product-lifecycle-badge';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import {
  OpenPlatformApiError,
  openPlatformDelete,
  openPlatformGetFetcher,
  openPlatformPost,
  openPlatformPut,
  useProjectDetail,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import {
  labelOf,
  MODEL_DRAFT_STATUS_LABEL,
  MODEL_REVISION_STATUS_LABEL,
} from '@/lib/open-platform-labels';
import type {
  CategoryMergeView,
  CategoryVersionView,
  ModelDiffView,
  ModelDraftView,
  ModelVersionView,
  ProductDetailView,
  SchemaValidationView,
  ThingModelDefinition,
  ThingModelAction,
  ThingModelEvent,
  ThingModelProperty,
} from '@/types/apps/open-platform';

type ConfirmAction = 'discard' | 'rollback' | null;
type CapabilityDialogKind = ThingModelCapabilityKind | null;
type CapabilityInputMode = 'form' | 'json';
type CapabilityPropertyType = 'string' | 'integer' | 'number' | 'boolean' | 'object';
type CapabilityAccess = 'READ_ONLY' | 'WRITE_ONLY' | 'READ_WRITE';
type CapabilityInvokeMode = 'SYNC' | 'ASYNC';
type CapabilityEventType = 'INFO' | 'WARN' | 'FAULT';
type NewCapability = ThingModelProperty | ThingModelAction | ThingModelEvent;

type CapabilityFormState = {
  code: string;
  title: string;
  access: CapabilityAccess;
  required: boolean;
  propertyType: CapabilityPropertyType;
  unit: string;
  minimum: string;
  maximum: string;
  invokeMode: CapabilityInvokeMode;
  eventType: CapabilityEventType;
};

function createCapabilityFormState(): CapabilityFormState {
  return {
    code: '',
    title: '',
    access: 'READ_WRITE',
    required: false,
    propertyType: 'string',
    unit: '',
    minimum: '',
    maximum: '',
    invokeMode: 'ASYNC',
    eventType: 'INFO',
  };
}

function capabilityKindLabel(kind: ThingModelCapabilityKind) {
  if (kind === 'property') return '属性';
  if (kind === 'action') return '动作';
  return '事件';
}

function capabilityAccessLabel(access: CapabilityAccess) {
  if (access === 'READ_ONLY') return '只读';
  if (access === 'WRITE_ONLY') return '只写';
  return '读写';
}

function capabilityPropertyTypeLabel(type: CapabilityPropertyType) {
  if (type === 'string') return '字符串';
  if (type === 'integer') return '整数';
  if (type === 'number') return '数字';
  if (type === 'boolean') return '布尔值';
  return '对象';
}

function capabilityInvokeModeLabel(mode: CapabilityInvokeMode) {
  return mode === 'SYNC' ? '同步调用' : '异步调用';
}

function capabilityEventTypeLabel(type: CapabilityEventType) {
  if (type === 'WARN') return '警告';
  if (type === 'FAULT') return '故障';
  return '信息';
}

function parseOptionalNumber(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isJsonSchema(value: unknown): boolean {
  return typeof value === 'boolean' || isJsonRecord(value);
}

function capabilityObjectFromForm(
  kind: ThingModelCapabilityKind,
  form: CapabilityFormState,
): NewCapability {
  const code = form.code.trim();
  const title = form.title.trim();

  if (kind === 'property') {
    const schema: Record<string, unknown> = { type: form.propertyType };
    const minimum = parseOptionalNumber(form.minimum);
    const maximum = parseOptionalNumber(form.maximum);
    if (form.unit.trim()) schema.unit = form.unit.trim();
    if (typeof minimum === 'number') schema.minimum = minimum;
    if (typeof maximum === 'number') schema.maximum = maximum;
    if (form.propertyType === 'object') schema.additionalProperties = false;
    return {
      code,
      title,
      access: form.access,
      schema,
      required: form.required,
    };
  }

  if (kind === 'action') {
    return {
      code,
      title,
      inputSchema: { type: 'object', additionalProperties: false },
      outputSchema: true,
      invokeMode: form.invokeMode,
    };
  }

  return {
    code,
    title,
    outputSchema: true,
    eventType: form.eventType,
  };
}

function capabilityJsonTemplate(kind: ThingModelCapabilityKind) {
  if (kind === 'property') {
    return JSON.stringify(
      {
        code: 'temperature',
        title: '温度',
        access: 'READ_ONLY',
        schema: { type: 'number', unit: '℃', minimum: -40, maximum: 125 },
        required: false,
      },
      null,
      2,
    );
  }

  if (kind === 'action') {
    return JSON.stringify(
      {
        code: 'setTemperature',
        title: '设置温度',
        inputSchema: {
          type: 'object',
          properties: { temperature: { type: 'number', unit: '℃' } },
          required: ['temperature'],
          additionalProperties: false,
        },
        outputSchema: true,
        invokeMode: 'ASYNC',
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      code: 'fault',
      title: '故障告警',
      outputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['code', 'message'],
        additionalProperties: false,
      },
      eventType: 'FAULT',
    },
    null,
    2,
  );
}

function parseCapabilityJson(
  kind: ThingModelCapabilityKind,
  value: string,
): { capability?: NewCapability; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { error: 'JSON 格式不正确，请检查括号、逗号和引号。' };
  }

  if (!isJsonRecord(parsed)) {
    return { error: 'JSON 必须是一个能力对象，不能是数组或基础值。' };
  }

  const code = parsed.code;
  const title = parsed.title;
  if (typeof code !== 'string' || !code.trim()) {
    return { error: 'JSON 中必须提供非空的 code。' };
  }
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(code.trim())) {
    return { error: 'code 需以英文字母开头，只能包含字母、数字、点、下划线或连字符。' };
  }
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'JSON 中必须提供非空的 title。' };
  }

  if (kind === 'property') {
    const access = parsed.access ?? 'READ_WRITE';
    const required = parsed.required ?? false;
    if (!['READ_ONLY', 'WRITE_ONLY', 'READ_WRITE'].includes(String(access))) {
      return { error: '属性 access 只能是 READ_ONLY、WRITE_ONLY 或 READ_WRITE。' };
    }
    if (typeof required !== 'boolean') {
      return { error: '属性 required 必须是 true 或 false。' };
    }
    if (!isJsonSchema(parsed.schema)) {
      return { error: '属性 schema 必须是 JSON Schema 对象或布尔值。' };
    }
    return {
      capability: {
        code: code.trim(),
        title: title.trim(),
        access: String(access),
        schema: parsed.schema,
        required,
      },
    };
  }

  if (kind === 'action') {
    const invokeMode = parsed.invokeMode ?? 'ASYNC';
    if (!isJsonSchema(parsed.inputSchema)) {
      return { error: '动作 inputSchema 必须是 JSON Schema 对象或布尔值。' };
    }
    if (!isJsonSchema(parsed.outputSchema)) {
      return { error: '动作 outputSchema 必须是 JSON Schema 对象或布尔值。' };
    }
    if (!['SYNC', 'ASYNC'].includes(String(invokeMode))) {
      return { error: '动作 invokeMode 只能是 SYNC 或 ASYNC。' };
    }
    return {
      capability: {
        code: code.trim(),
        title: title.trim(),
        inputSchema: parsed.inputSchema,
        outputSchema: parsed.outputSchema,
        invokeMode: String(invokeMode),
      },
    };
  }

  const eventType = parsed.eventType ?? 'INFO';
  if (!isJsonSchema(parsed.outputSchema)) {
    return { error: '事件 outputSchema 必须是 JSON Schema 对象或布尔值。' };
  }
  if (!['INFO', 'WARN', 'FAULT'].includes(String(eventType))) {
    return { error: '事件 eventType 只能是 INFO、WARN 或 FAULT。' };
  }
  return {
    capability: {
      code: code.trim(),
      title: title.trim(),
      outputSchema: parsed.outputSchema,
      eventType: String(eventType),
    },
  };
}

function productKey(productId: string) {
  return `/api/v1/products/${encodeURIComponent(productId)}`;
}

function modelKey(productId: string) {
  return `${productKey(productId)}/model`;
}

function versionsKey(productId: string) {
  return `${modelKey(productId)}/versions`;
}

function publishedKey(productId: string) {
  return `${modelKey(productId)}/published`;
}

function validationKey(productId: string) {
  return `${modelKey(productId)}/validation`;
}

function categoryVersionsKey(categoryCode: string) {
  return `/api/v1/categories/${encodeURIComponent(categoryCode)}/versions`;
}

function cloneDefinition(definition: ThingModelDefinition): ThingModelDefinition {
  return {
    ...definition,
    properties: definition.properties.map((item) => ({ ...item })),
    actions: definition.actions.map((item) => ({ ...item })),
    events: definition.events.map((item) => ({ ...item })),
  };
}

function modelRevisionLabel(revision: number) {
  return `Revision ${revision}`;
}

function DiffItems({
  label,
  items,
  tone,
}: {
  label: string;
  items: ModelDiffView['added'];
  tone: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass = {
    positive: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30',
    negative: 'border-destructive/30 bg-destructive/5',
    neutral: 'border-border bg-muted/20',
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{label}</p>
        <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {items.map((item) => (
            <div key={`${item.type}-${item.code}`} className="flex flex-wrap items-center gap-2 text-xs">
              <span>{item.title}</span>
              <code className="font-mono text-[11px] text-muted-foreground">{item.code}</code>
              {item.required ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">必选</Badge> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">没有差异</p>
      )}
    </div>
  );
}

function ValidationResult({ result }: { result?: SchemaValidationView | null }) {
  if (!result) return null;
  return result.valid ? (
    <Alert className="border-emerald-200 bg-emerald-50/60 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
      <Check aria-hidden />
      <AlertTitle>草稿校验通过</AlertTitle>
      <AlertDescription>当前定义符合物模型契约，可以发布为新的 Revision。</AlertDescription>
    </Alert>
  ) : (
    <Alert variant="destructive">
      <AlertTitle>草稿校验未通过</AlertTitle>
      <AlertDescription>
        {Array.isArray(result.errors) && result.errors.length > 0
          ? String((result.errors[0] as { message?: string }).message ?? '请检查能力定义。')
          : '请检查能力定义后重新校验。'}
      </AlertDescription>
    </Alert>
  );
}

function ProductModelNav({ projectId, productId }: { projectId: string; productId: string }) {
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-1" aria-label="产品功能">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5"
        nativeButton={false}
        render={<Link to={`/projects/${projectId}/products/${productId}`} />}
      >
        <Package className="size-3.5" aria-hidden />
        产品概览
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 gap-1.5 bg-background shadow-sm"
        nativeButton={false}
        render={<Link to={`/projects/${projectId}/products/${productId}/model`} />}
      >
        <Braces className="size-3.5" aria-hidden />
        物模型
      </Button>
    </nav>
  );
}

const ProductModelPage = () => {
  const { projectId = '', productId = '' } = useParams<{
    projectId: string;
    productId: string;
  }>();
  const [searchParams] = useSearchParams();
  const publishedOnly = searchParams.get('view') === 'published';
  const { data: project } = useProjectDetail(projectId);
  const {
    data: product,
    error: productError,
    isLoading: productLoading,
    mutate: mutateProduct,
  } = useSWR<ProductDetailView>(productId ? productKey(productId) : null, openPlatformGetFetcher);
  const {
    data: draft,
    error: draftError,
    isLoading: draftLoading,
    mutate: mutateDraft,
  } = useSWR<ModelDraftView | null>(productId ? modelKey(productId) : null, openPlatformGetFetcher);
  const {
    data: published,
    isLoading: publishedLoading,
    mutate: mutatePublished,
  } = useSWR<ThingModelDefinition | null>(
    productId ? publishedKey(productId) : null,
    openPlatformGetFetcher,
  );
  const { data: versions, mutate: mutateVersions } = useSWR<ModelVersionView[]>(
    productId ? versionsKey(productId) : null,
    openPlatformGetFetcher,
  );
  const { data: validation, mutate: mutateValidation } = useSWR<SchemaValidationView | null>(
    productId ? validationKey(productId) : null,
    openPlatformGetFetcher,
  );
  const { data: categoryVersions } = useSWR<CategoryVersionView[]>(
    product?.categoryCode ? categoryVersionsKey(product.categoryCode) : null,
    openPlatformGetFetcher,
  );

  const [localDefinition, setLocalDefinition] = useState<ThingModelDefinition | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<OpenPlatformApiError | null>(null);
  const [capabilityDialogKind, setCapabilityDialogKind] = useState<CapabilityDialogKind>(null);
  const [capabilityForm, setCapabilityForm] = useState<CapabilityFormState>(createCapabilityFormState);
  const [capabilityInputMode, setCapabilityInputMode] = useState<CapabilityInputMode>('form');
  const [capabilityJson, setCapabilityJson] = useState('');
  const [capabilityJsonError, setCapabilityJsonError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [targetVersion, setTargetVersion] = useState('');
  const [selectedMergeCodes, setSelectedMergeCodes] = useState<string[]>([]);
  const [viewingRevision, setViewingRevision] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffFrom, setDiffFrom] = useState('');
  const [diffTo, setDiffTo] = useState('');

  useEffect(() => {
    if (!dirty) {
      setLocalDefinition(draft?.definition ? cloneDefinition(draft.definition) : null);
    }
  }, [draft, dirty]);

  useEffect(() => {
    document.title = product
      ? `${product.productName} · 物模型 | AIoT 开放平台`
      : '产品物模型 | AIoT 开放平台';
  }, [product]);

  const currentDefinition = localDefinition ?? draft?.definition ?? null;
  const displayDefinition = publishedOnly
    ? published ?? null
    : currentDefinition ?? published ?? null;
  const readOnlyDefinition = publishedOnly || (!currentDefinition && Boolean(published));
  const publishedVersion = useMemo(
    () => {
      const publishedVersions = (versions ?? []).filter((version) => version.status === 'PUBLISHED');
      return publishedVersions[publishedVersions.length - 1] ?? versions?.[versions.length - 1];
    },
    [versions],
  );
  const latestCategoryVersion = useMemo(
    () =>
      categoryVersions?.find((version) => version.versionStatus === 'PUBLISHED') ??
      categoryVersions?.[categoryVersions.length - 1],
    [categoryVersions],
  );
  const mergeDiffKey =
    mergeOpen && product && targetVersion
      ? `${modelKey(productId)}/category-diff?targetVersion=${encodeURIComponent(targetVersion)}`
      : null;
  const { data: mergeDiff, error: mergeDiffError } = useSWR<CategoryMergeView>(
    mergeDiffKey,
    openPlatformGetFetcher,
  );
  const versionDetailKey =
    viewingRevision != null ? `${modelKey(productId)}/versions/${viewingRevision}` : null;
  const { data: versionDetail, isLoading: versionDetailLoading } = useSWR<ThingModelDefinition>(
    versionDetailKey,
    openPlatformGetFetcher,
  );
  const diffKey =
    diffOpen && diffFrom && diffTo
      ? `${modelKey(productId)}/diff?fromRevision=${diffFrom}&toRevision=${diffTo}`
      : null;
  const { data: diffResult, error: diffError } = useSWR<ModelDiffView>(
    diffKey,
    async () =>
      openPlatformPost<ModelDiffView>(`${modelKey(productId)}/diff`, {
        fromRevision: Number(diffFrom),
        toRevision: Number(diffTo),
      }),
  );

  useEffect(() => {
    if (mergeOpen && !targetVersion && latestCategoryVersion) {
      setTargetVersion(latestCategoryVersion.categoryVersion);
    }
  }, [latestCategoryVersion, mergeOpen, targetVersion]);

  useEffect(() => {
    if (mergeDiff) {
      setSelectedMergeCodes(mergeDiff.diffItems.filter((item) => item.required).map((item) => item.code));
    }
  }, [mergeDiff]);

  const refreshModel = async () => {
    await Promise.all([
      mutateProduct(),
      mutateDraft(),
      mutatePublished(),
      mutateVersions(),
      mutateValidation(),
    ]);
  };

  const runMutation = async (
    key: string,
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    setBusyAction(key);
    setActionError(null);
    try {
      await action();
      await refreshModel();
      toast.success(successMessage);
    } catch (error) {
      const nextError = error as OpenPlatformApiError;
      setActionError(nextError);
    } finally {
      setBusyAction(null);
    }
  };

  const saveDraft = async () => {
    if (!productId || !currentDefinition) return;
    await runMutation(
      'save',
      async () => {
        await openPlatformPut<boolean>(modelKey(productId), {
          version: draft?.version ?? null,
          definition: currentDefinition,
        });
        setDirty(false);
        setLocalDefinition(null);
      },
      '物模型草稿已保存。',
    );
  };

  const validateDraft = async () => {
    if (!productId || !draft || dirty) return;
    await runMutation(
      'validate',
      async () => {
        await openPlatformPost<SchemaValidationView>(`${modelKey(productId)}/validate`, {});
      },
      '物模型草稿校验完成。',
    );
  };

  const publishDraft = async () => {
    if (!productId || !draft || dirty || draft.status !== 'VALIDATED') return;
    await runMutation(
      'publish',
      async () => {
        await openPlatformPost<boolean>(`${modelKey(productId)}/publish`, {
          version: draft.version,
        });
        setDirty(false);
        setLocalDefinition(null);
      },
      '物模型已发布为新 Revision。',
    );
  };

  const discardDraft = async () => {
    if (!productId || !draft) return;
    await runMutation(
      'discard',
      async () => {
        await openPlatformDelete<boolean>(modelKey(productId), { version: draft.version });
        setDirty(false);
        setLocalDefinition(null);
        setConfirmAction(null);
      },
      '物模型草稿已丢弃。',
    );
  };

  const rollbackDraft = async () => {
    if (!productId || rollbackRevision == null) return;
    await runMutation(
      'rollback',
      async () => {
        await openPlatformPost<boolean>(`${modelKey(productId)}/rollback`, {
          fromRevision: rollbackRevision,
          version: draft?.version ?? null,
        });
        setDirty(false);
        setLocalDefinition(null);
        setRollbackRevision(null);
        setConfirmAction(null);
      },
      `已将 ${modelRevisionLabel(rollbackRevision)} 复制为草稿。`,
    );
  };

  const mergeCategoryCapabilities = async () => {
    if (!productId || !targetVersion || !mergeDiff || selectedMergeCodes.length === 0) return;
    await runMutation(
      'merge',
      async () => {
        await openPlatformPost<boolean>(`${modelKey(productId)}/category-merge`, {
          targetVersion,
          selectedCodes: selectedMergeCodes,
          version: draft?.version ?? null,
        });
        setMergeOpen(false);
        setSelectedMergeCodes([]);
        setDirty(false);
        setLocalDefinition(null);
      },
      '已新增选定能力到物模型草稿。',
    );
  };

  const removeCapability = (kind: ThingModelCapabilityKind, code: string) => {
    if (!draft || !currentDefinition) return;
    setLocalDefinition((current) => {
      if (!current) return current;
      if (kind === 'property') {
        return { ...current, properties: current.properties.filter((item) => item.code !== code) };
      }
      if (kind === 'action') {
        return { ...current, actions: current.actions.filter((item) => item.code !== code) };
      }
      return { ...current, events: current.events.filter((item) => item.code !== code) };
    });
    setDirty(true);
    setActionError(null);
    toast.info(`已移除“${code}”，保存草稿后才会生效。`);
  };

  const openCapabilityDialog = (kind: ThingModelCapabilityKind) => {
    setCapabilityForm(createCapabilityFormState());
    setCapabilityInputMode('form');
    setCapabilityJson(capabilityJsonTemplate(kind));
    setCapabilityJsonError(null);
    setCapabilityDialogKind(kind);
    setActionError(null);
  };

  const addCapability = () => {
    const kind = capabilityDialogKind;
    if (!kind || !currentDefinition) return;

    let capability: NewCapability;
    if (capabilityInputMode === 'json') {
      const parsed = parseCapabilityJson(kind, capabilityJson);
      if (!parsed.capability) {
        setCapabilityJsonError(parsed.error ?? '请检查 JSON 能力定义。');
        return;
      }
      capability = parsed.capability;
    } else {
      const code = capabilityForm.code.trim();
      const title = capabilityForm.title.trim();
      if (!code || !title) {
        toast.error('请填写能力编码和能力名称。');
        return;
      }
      if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(code)) {
        toast.error('能力编码需以英文字母开头，只能包含字母、数字、点、下划线或连字符。');
        return;
      }
      if (kind === 'property' && (capabilityForm.propertyType === 'integer' || capabilityForm.propertyType === 'number')) {
        const minimum = parseOptionalNumber(capabilityForm.minimum);
        const maximum = parseOptionalNumber(capabilityForm.maximum);
        if (minimum === null || maximum === null) {
          toast.error('最小值和最大值必须是有效数字。');
          return;
        }
        if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
          toast.error('最小值不能大于最大值。');
          return;
        }
      }
      capability = capabilityObjectFromForm(kind, capabilityForm);
    }

    const existingCodes = [
      ...currentDefinition.properties,
      ...currentDefinition.actions,
      ...currentDefinition.events,
    ].map((item) => item.code);
    const code = capability.code;
    if (existingCodes.includes(code)) {
      const message = `能力编码“${code}”已经存在，请使用其他编码。`;
      if (capabilityInputMode === 'json') {
        setCapabilityJsonError(message);
      } else {
        toast.error(message);
      }
      return;
    }

    const nextDefinition = cloneDefinition(currentDefinition);
    if (kind === 'property') {
      nextDefinition.properties = [
        ...nextDefinition.properties,
        capability as ThingModelProperty,
      ];
    } else if (kind === 'action') {
      nextDefinition.actions = [
        ...nextDefinition.actions,
        capability as ThingModelAction,
      ];
    } else {
      nextDefinition.events = [
        ...nextDefinition.events,
        capability as ThingModelEvent,
      ];
    }

    setLocalDefinition(nextDefinition);
    setDirty(true);
    setActionError(null);
    setCapabilityJsonError(null);
    setCapabilityDialogKind(null);
    toast.success(`已新增${capabilityKindLabel(kind)}“${capability.title}”，请保存草稿后继续校验。`);
  };

  const openMergeDialog = () => {
    setTargetVersion(latestCategoryVersion?.categoryVersion ?? product?.categoryCatalogVersion ?? '');
    setSelectedMergeCodes([]);
    setMergeOpen(true);
  };

  const openDiffDialog = () => {
    if (!versions || versions.length < 2) return;
    setDiffFrom(String(versions[0].modelRevision));
    setDiffTo(String(versions[versions.length - 1]?.modelRevision));
    setDiffOpen(true);
  };

  const error = productError as OpenPlatformApiError | undefined;
  const draftApiError = draftError as OpenPlatformApiError | undefined;
  const actionErrorMessage = actionError?.message;
  const breadcrumbItems = [
    { to: '/projects', title: '项目' },
    { to: `/projects/${projectId}/products`, title: '产品' },
    { title: product?.productName ?? '物模型' },
  ];

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col gap-px bg-border p-px"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="物模型" items={breadcrumbItems} />
      <ProjectWorkspaceShell activePrimary="products">
        {productError ? (
          <ApiErrorAlert
            code={error?.code}
            message={productError.message}
            onRetry={() => void mutateProduct()}
          />
        ) : productLoading && !product ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-72" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <Skeleton className="h-[32rem] w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          </div>
        ) : product ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 mb-1 gap-1 px-2 text-muted-foreground"
                  nativeButton={false}
                  render={<Link to={`/projects/${projectId}/products`} />}
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  返回产品
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Braces className="size-5 shrink-0" aria-hidden />
                  <h1 className="truncate text-lg font-semibold tracking-tight">{product.productName}</h1>
                  <ProductLifecycleBadge status={product.lifecycleStatus} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>Product ID</span>
                  <code className="font-mono">{product.productId}</code>
                  <CopyIdButton value={product.productId} label="Product ID" />
                  <span className="text-border">·</span>
                  <span>{project?.projectName ?? product.projectId}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/products/${product.productId}`} />}
              >
                <Package className="size-4" aria-hidden />
                产品概览
              </Button>
            </div>

            <ProductModelNav projectId={projectId} productId={product.productId} />

            {draftApiError ? (
              <ApiErrorAlert
                code={draftApiError.code}
                message={draftError?.message}
                onRetry={() => void mutateDraft()}
              />
            ) : null}
            {actionErrorMessage ? (
              <ApiErrorAlert code={actionError?.code} message={actionErrorMessage} />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <Card className="min-w-0">
                <CardHeader className="gap-3 border-b">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Braces className="size-4" aria-hidden />
                        {readOnlyDefinition ? '已发布物模型' : '物模型草稿'}
                        {draft && !publishedOnly ? (
                          <Badge variant={draft.status === 'VALIDATED' ? 'secondary' : 'outline'}>
                            {labelOf(MODEL_DRAFT_STATUS_LABEL, draft.status)}
                          </Badge>
                        ) : null}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {publishedOnly
                          ? '当前查看设备运行时使用的已发布 Revision，只读查看能力定义。'
                          : readOnlyDefinition
                          ? '当前没有草稿，以下为已发布 Revision 的只读能力定义。'
                          : '按属性、动作、事件管理产品可用能力；JSON 仅在展开单项能力后查看。'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {publishedOnly ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          nativeButton={false}
                          render={<Link to={`/projects/${projectId}/products/${productId}/model`} />}
                        >
                          <Braces className="size-3.5" aria-hidden />
                          返回物模型工作区
                        </Button>
                      ) : (
                        <>
                          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={openMergeDialog} disabled={busyAction != null || !categoryVersions?.length}>
                            <RefreshCw className="size-3.5" aria-hidden />
                            从品类新增
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void saveDraft()} disabled={!dirty || busyAction != null}>
                            {busyAction === 'save' ? <Spinner /> : <Save className="size-3.5" aria-hidden />}
                            保存草稿
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void validateDraft()} disabled={!draft || dirty || busyAction != null}>
                            {busyAction === 'validate' ? <Spinner /> : <Check className="size-3.5" aria-hidden />}
                            校验草稿
                          </Button>
                          <Button type="button" size="sm" className="gap-1" onClick={() => void publishDraft()} disabled={!draft || dirty || draft.status !== 'VALIDATED' || busyAction != null}>
                            {busyAction === 'publish' ? <Spinner /> : <Upload className="size-3.5" aria-hidden />}
                            发布模型
                          </Button>
                          {draft ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => setConfirmAction('discard')}
                              disabled={busyAction != null}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                              丢弃草稿
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                  {dirty ? (
                    <p className="rounded-md border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                      能力列表有未保存的修改。请先保存草稿，再执行校验或发布。
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4 py-4">
                  {((draftLoading && draft === undefined) ||
                    (publishedLoading && published === undefined)) ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-72 w-full" />
                    </div>
                  ) : displayDefinition ? (
                    <>
                      <ThingModelCapabilityTabs
                        definition={displayDefinition}
                        onRemove={draft && !readOnlyDefinition ? removeCapability : undefined}
                        onAdd={draft && !readOnlyDefinition ? openCapabilityDialog : undefined}
                      />
                      <ValidationResult result={readOnlyDefinition ? null : validation} />
                    </>
                  ) : publishedOnly ? (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center">
                      <Braces className="size-7 text-muted-foreground" aria-hidden />
                      <p className="mt-3 text-sm font-medium">尚未发布物模型</p>
                      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                        当前产品还没有可查看的已发布 Revision。
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-1"
                        nativeButton={false}
                        render={<Link to={`/projects/${projectId}/products/${productId}/model`} />}
                      >
                        <Braces className="size-3.5" aria-hidden />
                        返回物模型工作区
                      </Button>
                    </div>
                  ) : (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center">
                      <Braces className="size-7 text-muted-foreground" aria-hidden />
                      <p className="mt-3 text-sm font-medium">还没有物模型草稿</p>
                      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                        产品已绑定品类，但能力需要复制到产品草稿后才能修改、校验和发布。
                      </p>
                      <Button type="button" className="mt-4 gap-1" onClick={openMergeDialog} disabled={!categoryVersions?.length}>
                        <RefreshCw className="size-3.5" aria-hidden />
                        从品类模板开始
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">当前已发布模型</CardTitle>
                    <CardDescription>设备运行时使用的不可变 Revision。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {published ? (
                      <div className="space-y-3 rounded-lg border bg-muted/20 px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{modelRevisionLabel(published.modelRevision)}</span>
                          <Badge variant="secondary">{labelOf(MODEL_REVISION_STATUS_LABEL, publishedVersion?.status)}</Badge>
                        </div>
                        <ThingModelCapabilitySummary definition={published} />
                        <code className="block break-all text-[11px] text-muted-foreground">{published.modelDigest}</code>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                        尚未发布物模型；校验通过后可以发布第一个 Revision。
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <History className="size-4" aria-hidden />
                          版本历史
                        </CardTitle>
                        <CardDescription>查看、比较或复制历史版本。</CardDescription>
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="比较物模型版本" title="比较物模型版本" onClick={openDiffDialog} disabled={!versions || versions.length < 2}>
                        <GitCompare className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {versions && versions.length > 0 ? (
                      <div className="space-y-2">
                        {versions.slice().reverse().map((version) => (
                          <div key={version.modelRevision} className="rounded-lg border px-3 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{modelRevisionLabel(version.modelRevision)}</p>
                                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{version.modelDigest}</p>
                              </div>
                              <Badge variant={version.status === 'PUBLISHED' ? 'secondary' : 'outline'}>
                                {labelOf(MODEL_REVISION_STATUS_LABEL, version.status)}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="xs" onClick={() => setViewingRevision(version.modelRevision)}>
                                查看定义
                              </Button>
                              <Button type="button" variant="ghost" size="xs" className="gap-1" onClick={() => { setRollbackRevision(version.modelRevision); setConfirmAction('rollback'); }} disabled={busyAction != null}>
                                <RotateCcw className="size-3.5" aria-hidden />
                                复制为草稿
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                        暂无已发布版本
                      </p>
                    )}
                  </CardContent>
                </Card>

              </div>
            </div>

            {viewingRevision != null ? (
              <Card className="border-dashed">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{modelRevisionLabel(viewingRevision)} 定义</CardTitle>
                      <CardDescription>历史版本只读查看，不会改变当前草稿。</CardDescription>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setViewingRevision(null)}>
                      关闭查看
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {versionDetailLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : versionDetail ? (
                    <ThingModelCapabilityTabs definition={versionDetail} />
                  ) : (
                    <p className="text-sm text-muted-foreground">无法加载该版本定义。</p>
                  )}
                </CardContent>
              </Card>
            ) : null}

          </div>
        ) : null}
      </ProjectWorkspaceShell>

      <Dialog
        open={capabilityDialogKind != null}
        onOpenChange={(open) => {
          if (!open) setCapabilityDialogKind(null);
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>新增{capabilityDialogKind ? capabilityKindLabel(capabilityDialogKind) : '能力'}</DialogTitle>
            <DialogDescription>
              新能力会先加入当前物模型草稿；保存草稿后才能校验并发布。编码在属性、动作和事件之间都不能重复。
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={capabilityInputMode}
            onValueChange={(value) => {
              const nextMode = (value ?? 'form') as CapabilityInputMode;
              const formHasChanges = JSON.stringify(capabilityForm) !== JSON.stringify(createCapabilityFormState());
              if (nextMode === 'json' && capabilityDialogKind && formHasChanges) {
                setCapabilityJson(JSON.stringify(capabilityObjectFromForm(capabilityDialogKind, capabilityForm), null, 2));
              }
              setCapabilityInputMode(nextMode);
              setCapabilityJsonError(null);
            }}
            className="flex-col gap-3"
          >
            <TabsList variant="line" className="h-8 w-full justify-start border-b">
              <TabsTrigger value="form" className="h-8 px-2 text-xs">
                表单创建
              </TabsTrigger>
              <TabsTrigger value="json" className="h-8 px-2 text-xs">
                JSON 创建
              </TabsTrigger>
            </TabsList>

            <TabsContent value="form" className="mt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5" htmlFor="capability-code">
                  <span className="text-sm font-medium">能力编码</span>
                  <Input
                    id="capability-code"
                    autoFocus
                    value={capabilityForm.code}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, code: event.target.value }))}
                    placeholder="例如 temperature"
                  />
                  <span className="text-xs text-muted-foreground">用于接口和设备报文，建议使用英文编码。</span>
                </label>
                <label className="grid gap-1.5" htmlFor="capability-title">
                  <span className="text-sm font-medium">能力名称</span>
                  <Input
                    id="capability-title"
                    value={capabilityForm.title}
                    onChange={(event) => setCapabilityForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="例如 温度"
                  />
                  <span className="text-xs text-muted-foreground">面向产品和设备使用者展示。</span>
                </label>
              </div>

              {capabilityDialogKind === 'property' ? (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <span className="text-sm font-medium">访问方式</span>
                      <Select
                        value={capabilityForm.access}
                        onValueChange={(value) => setCapabilityForm((current) => ({ ...current, access: (value ?? 'READ_WRITE') as CapabilityAccess }))}
                      >
                        <SelectTrigger className="w-full"><SelectValue>{capabilityAccessLabel(capabilityForm.access)}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="READ_ONLY">只读</SelectItem>
                          <SelectItem value="WRITE_ONLY">只写</SelectItem>
                          <SelectItem value="READ_WRITE">读写</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <span className="text-sm font-medium">数据类型</span>
                      <Select
                        value={capabilityForm.propertyType}
                        onValueChange={(value) => setCapabilityForm((current) => ({ ...current, propertyType: (value ?? 'string') as CapabilityPropertyType }))}
                      >
                        <SelectTrigger className="w-full"><SelectValue>{capabilityPropertyTypeLabel(capabilityForm.propertyType)}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">字符串 string</SelectItem>
                          <SelectItem value="integer">整数 integer</SelectItem>
                          <SelectItem value="number">数字 number</SelectItem>
                          <SelectItem value="boolean">布尔值 boolean</SelectItem>
                          <SelectItem value="object">对象 object</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(capabilityForm.propertyType === 'integer' || capabilityForm.propertyType === 'number') ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="grid gap-1.5" htmlFor="capability-unit">
                        <span className="text-sm font-medium">单位</span>
                        <Input
                          id="capability-unit"
                          value={capabilityForm.unit}
                          onChange={(event) => setCapabilityForm((current) => ({ ...current, unit: event.target.value }))}
                          placeholder="例如 ℃"
                        />
                      </label>
                      <label className="grid gap-1.5" htmlFor="capability-minimum">
                        <span className="text-sm font-medium">最小值</span>
                        <Input
                          id="capability-minimum"
                          type="number"
                          value={capabilityForm.minimum}
                          onChange={(event) => setCapabilityForm((current) => ({ ...current, minimum: event.target.value }))}
                          placeholder="可选"
                        />
                      </label>
                      <label className="grid gap-1.5" htmlFor="capability-maximum">
                        <span className="text-sm font-medium">最大值</span>
                        <Input
                          id="capability-maximum"
                          type="number"
                          value={capabilityForm.maximum}
                          onChange={(event) => setCapabilityForm((current) => ({ ...current, maximum: event.target.value }))}
                          placeholder="可选"
                        />
                      </label>
                    </div>
                  ) : null}

                  <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2.5">
                    <Checkbox
                      checked={capabilityForm.required}
                      onCheckedChange={(checked) => setCapabilityForm((current) => ({ ...current, required: checked === true }))}
                    />
                    <span className="text-sm">必选属性</span>
                    <span className="text-xs text-muted-foreground">设备上报时必须提供</span>
                  </label>
                </div>
              ) : capabilityDialogKind === 'action' ? (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="grid gap-1.5">
                    <span className="text-sm font-medium">调用方式</span>
                    <Select
                      value={capabilityForm.invokeMode}
                      onValueChange={(value) => setCapabilityForm((current) => ({ ...current, invokeMode: (value ?? 'ASYNC') as CapabilityInvokeMode }))}
                    >
                      <SelectTrigger className="w-full"><SelectValue>{capabilityInvokeModeLabel(capabilityForm.invokeMode)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SYNC">同步调用</SelectItem>
                        <SelectItem value="ASYNC">异步调用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    新动作默认没有输入参数和返回值；需要自定义参数时，可以切换到 JSON 创建。
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="grid gap-1.5">
                    <span className="text-sm font-medium">事件级别</span>
                    <Select
                      value={capabilityForm.eventType}
                      onValueChange={(value) => setCapabilityForm((current) => ({ ...current, eventType: (value ?? 'INFO') as CapabilityEventType }))}
                    >
                      <SelectTrigger className="w-full"><SelectValue>{capabilityEventTypeLabel(capabilityForm.eventType)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INFO">信息</SelectItem>
                        <SelectItem value="WARN">警告</SelectItem>
                        <SelectItem value="FAULT">故障</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    新事件默认没有输出参数；需要自定义输出结构时，可以切换到 JSON 创建。
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="json" className="mt-0 space-y-3">
              <label className="grid gap-1.5" htmlFor="capability-json">
                <span className="text-sm font-medium">单项能力 JSON</span>
                <Textarea
                  id="capability-json"
                  value={capabilityJson}
                  onChange={(event) => {
                    setCapabilityJson(event.target.value);
                    setCapabilityJsonError(null);
                  }}
                  aria-invalid={Boolean(capabilityJsonError)}
                  spellCheck={false}
                  className="min-h-56 max-h-[45vh] resize-y font-mono text-xs leading-5"
                />
              </label>
              <p className="text-xs leading-5 text-muted-foreground">
                只填写一个{capabilityDialogKind ? capabilityKindLabel(capabilityDialogKind) : '能力'}对象，不要粘贴包含 properties、actions、events 的完整物模型。JSON 中的 schema / inputSchema / outputSchema 支持完整 JSON Schema。
              </p>
              {capabilityJsonError ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {capabilityJsonError}
                </p>
              ) : null}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCapabilityDialogKind(null)}>
              取消
            </Button>
            <Button type="button" onClick={addCapability}>
              <Plus className="size-3.5" aria-hidden />
              新增{capabilityDialogKind ? capabilityKindLabel(capabilityDialogKind) : '能力'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={(open) => { if (busyAction !== 'merge') setMergeOpen(open); }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>新增能力</DialogTitle>
            <DialogDescription>
              从当前品类模板中选择要加入产品草稿的能力；必选属性会自动纳入，已有能力不会被覆盖。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">品类模板版本</span>
              <Select value={targetVersion} onValueChange={(value) => setTargetVersion(value ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择品类版本" />
                </SelectTrigger>
                <SelectContent>
                  {(categoryVersions ?? []).map((version) => (
                    <SelectItem key={version.categoryVersion} value={version.categoryVersion}>
                      {version.categoryVersion} · {version.versionStatus === 'PUBLISHED' ? '已发布' : version.versionStatus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mergeDiffError ? (
              <ApiErrorAlert message={(mergeDiffError as Error).message} />
            ) : mergeDiff ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>可新增能力</span>
                  <span>{mergeDiff.diffItems.length} 项</span>
                </div>
                {mergeDiff.diffItems.length > 0 ? (
                  <div className="divide-y rounded-lg border">
                    {mergeDiff.diffItems.map((item) => {
                      const checked = item.required || selectedMergeCodes.includes(item.code);
                      return (
                        <label key={`${item.type}-${item.code}`} className="flex items-start gap-3 px-3 py-2.5">
                          <Checkbox
                            checked={checked}
                            disabled={item.required || busyAction != null}
                            onCheckedChange={(value) => {
                              setSelectedMergeCodes((current) =>
                                value === true
                                  ? [...new Set([...current, item.code])]
                                  : current.filter((code) => code !== item.code),
                              );
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-sm">
                              {item.title}
                              <code className="font-mono text-[11px] text-muted-foreground">{item.code}</code>
                              {item.required ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">必选</Badge> : null}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{item.type === 'PROPERTY' ? '属性' : item.type === 'ACTION' ? '动作' : '事件'}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    当前草稿已经包含该品类版本的全部能力。
                  </p>
                )}
              </div>
            ) : (
              <Skeleton className="h-28 w-full" />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)} disabled={busyAction != null}>
              取消
            </Button>
            <Button type="button" onClick={() => void mergeCategoryCapabilities()} disabled={!mergeDiff || mergeDiff.diffItems.length === 0 || selectedMergeCodes.length === 0 || busyAction != null}>
              {busyAction === 'merge' ? <Spinner /> : null}
              新增到草稿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>比较物模型版本</DialogTitle>
            <DialogDescription>比较两个不可变 Revision 的能力增删和定义变化。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">基线版本</span>
              <Select value={diffFrom} onValueChange={(value) => setDiffFrom(value ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="选择基线版本" /></SelectTrigger>
                <SelectContent>
                  {(versions ?? []).map((version) => <SelectItem key={`from-${version.modelRevision}`} value={String(version.modelRevision)}>{modelRevisionLabel(version.modelRevision)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">目标版本</span>
              <Select value={diffTo} onValueChange={(value) => setDiffTo(value ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="选择目标版本" /></SelectTrigger>
                <SelectContent>
                  {(versions ?? []).map((version) => <SelectItem key={`to-${version.modelRevision}`} value={String(version.modelRevision)}>{modelRevisionLabel(version.modelRevision)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {diffError ? <ApiErrorAlert message={(diffError as Error).message} /> : diffResult ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <DiffItems label="新增能力" items={diffResult.added} tone="positive" />
              <DiffItems label="移除能力" items={diffResult.removed} tone="negative" />
              <DiffItems label="定义变更" items={diffResult.modified} tone="neutral" />
            </div>
          ) : (
            <Skeleton className="h-36 w-full" />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDiffOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmAction != null}
        onOpenChange={(open) => {
          if (!open && busyAction == null) {
            setConfirmAction(null);
            setRollbackRevision(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction === 'discard' ? '丢弃当前草稿？' : `复制 ${modelRevisionLabel(rollbackRevision ?? 0)}？`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'discard'
                ? '当前草稿及未发布修改会被删除，已发布的物模型版本不会受到影响。'
                : '历史版本会覆盖当前草稿内容，之后仍需要重新校验并发布。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction != null}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === 'discard' ? 'destructive' : 'default'}
              disabled={busyAction != null}
              onClick={(event) => {
                event.preventDefault();
                if (confirmAction === 'discard') void discardDraft();
                else void rollbackDraft();
              }}
            >
              {busyAction ? <Spinner /> : null}
              {confirmAction === 'discard' ? '丢弃草稿' : '复制为草稿'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StyleAwareWrapper>
  );
};

export default ProductModelPage;
