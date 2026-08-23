import { useEffect, useMemo, useState, type FormEvent } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  ArrowLeft,
  Braces,
  Archive,
  Eye,
  Pause,
  Package,
  Pencil,
  Play,
  Radio,
  Rocket,
  Router,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import {
  ParserProfileSelect,
  ParserProfileVersionSelect,
} from '@/components/open-platform/parser-profile-selector';
import { ProductLifecycleBadge } from '@/components/open-platform/product-lifecycle-badge';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
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
  PRODUCT_AUTH_MODE_LABEL,
  PRODUCT_BOOTSTRAP_MODE_LABEL,
  PRODUCT_DATA_MODE_LABEL,
  PRODUCT_NODE_TYPE_LABEL,
  PRODUCT_TRANSPORT_LABEL,
} from '@/lib/open-platform-labels';
import { cn } from '@/lib/utils';
import type {
  CursorResult,
  ParserProfileVersionView,
  ParserProfileView,
  ProductUpdateRequest,
  ProductDetailView,
  ProtocolProfileRefView,
  ThingModelDefinition,
} from '@/types/apps/open-platform';

function productModelKey(productId: string) {
  return `/api/v1/products/${encodeURIComponent(productId)}/model`;
}

function productPublishedModelKey(productId: string) {
  return `${productModelKey(productId)}/published`;
}

function authModesLabel(authModes: string[]) {
  if (authModes.length === 0) return '未配置';
  return authModes
    .map((mode) => labelOf(PRODUCT_AUTH_MODE_LABEL, mode, '其他认证方式'))
    .join('、');
}

function ModelState({
  projectId,
  productId,
  published,
}: {
  projectId: string;
  productId: string;
  published?: ThingModelDefinition | null;
}) {
  if (!published) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm">
        <p className="font-medium">尚未发布物模型</p>
        <p className="mt-1 text-xs text-muted-foreground">
          完成校验并发布后，设备运行时才会使用已发布版本。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">当前已发布模型</span>
        <span>Revision {published.modelRevision}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{published.properties.length} 属性</span>
        <span>{published.actions.length} 动作</span>
        <span>{published.events.length} 事件</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full gap-1"
        nativeButton={false}
        render={
          <Link to={`/projects/${projectId}/products/${productId}/model?view=published`} />
        }
      >
        <Eye className="size-3.5" aria-hidden />
        查看已发布物模型
      </Button>
    </div>
  );
}

type ProductLifecycleAction = 'publish' | 'disable' | 'enable' | 'deprecate' | 'delete';

const PRODUCT_ACTION_COPY: Record<
  ProductLifecycleAction,
  { title: string; description: string; confirm: string }
> = {
  publish: {
    title: '确认发布产品？',
    description: '产品发布后才能注册设备和发放凭证，连接契约也会被锁定。',
    confirm: '发布产品',
  },
  disable: {
    title: '确认停用产品？',
    description: '停用后将禁止新设备注册和凭证发放，之后仍可以恢复启用。',
    confirm: '停用产品',
  },
  enable: {
    title: '确认恢复启用？',
    description: '恢复后产品将重新允许新设备注册和凭证发放。',
    confirm: '恢复启用',
  },
  deprecate: {
    title: '确认废弃产品？',
    description: '废弃是终态操作，产品不能再次恢复；历史设备和数据仍会保留。',
    confirm: '废弃产品',
  },
  delete: {
    title: '确认删除产品？',
    description: '仅草稿产品可以删除，删除后产品及其未发布草稿将不再可访问。',
    confirm: '删除产品',
  },
};

type ProductEditForm = {
  productName: string;
  productModel: string;
  description: string;
  nodeType: string;
  transport: string;
  authModes: string[];
  dataMode: string;
  bootstrapMode: string;
  profileId: string;
  profileVersion: string;
};

const AUTH_MODE_OPTIONS = Object.entries(PRODUCT_AUTH_MODE_LABEL).filter(
  ([code]) => ['DEVICE_SECRET', 'PRODUCT_SECRET', 'CUSTOM'].includes(code),
);

function productEditForm(product: ProductDetailView): ProductEditForm {
  return {
    productName: product.productName,
    productModel: product.productModel ?? '',
    description: product.description ?? '',
    nodeType: product.nodeType ?? '',
    transport: product.transport ?? '',
    authModes: Array.from(new Set(['DEVICE_SECRET', ...(product.authModes ?? [])])),
    dataMode: product.dataMode ?? 'STANDARD_MODEL',
    bootstrapMode: product.bootstrapMode ?? 'OPEN',
    profileId: product.protocolProfile?.profileId ?? '',
    profileVersion: product.protocolProfile?.profileVersion ?? '',
  };
}

function ProductEditDialog({
  projectId,
  open,
  product,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  projectId: string;
  open: boolean;
  product: ProductDetailView;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Omit<ProductUpdateRequest, 'version'>) => void;
}) {
  const [form, setForm] = useState<ProductEditForm>(() => productEditForm(product));

  useEffect(() => {
    if (open) setForm(productEditForm(product));
  }, [open, product]);

  const customPayload = form.dataMode === 'CUSTOM_PAYLOAD';
  const {
    data: parserProfilesData,
    isLoading: parserProfilesLoading,
  } = useSWR<CursorResult<ParserProfileView>>(
    customPayload ? '/api/v1/parser-profiles?pageSize=100' : null,
    openPlatformGetFetcher,
    { revalidateOnFocus: false },
  );
  const parserProfiles = useMemo(
    () => (parserProfilesData?.items ?? []).filter((profile) => profile.currentVersion),
    [parserProfilesData],
  );
  const selectedParserProfile = parserProfiles.find(
    (profile) => profile.profileId === form.profileId,
  );
  const {
    data: parserProfileVersions,
    isLoading: parserProfileVersionsLoading,
  } = useSWR<ParserProfileVersionView[]>(
    selectedParserProfile
      ? `/api/v1/parser-profiles/${encodeURIComponent(selectedParserProfile.profileId)}/versions`
      : null,
    openPlatformGetFetcher,
    { revalidateOnFocus: false },
  );
  const publishedParserProfileVersions = useMemo(
    () => (parserProfileVersions ?? []).filter((version) => version.versionStatus === 'PUBLISHED'),
    [parserProfileVersions],
  );

  const updateField = <K extends keyof ProductEditForm>(field: K, value: ProductEditForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleAuthMode = (code: string, checked: boolean) => {
    if (code === 'DEVICE_SECRET' && !checked) return;
    setForm((current) => ({
      ...current,
      authModes: checked
        ? [...new Set([...current.authModes, code])]
        : current.authModes.filter((item) => item !== code),
    }));
  };

  const selectParserProfile = (profileId: string | null) => {
    setForm((current) => ({
      ...current,
      profileId: profileId ?? '',
      profileVersion: '',
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      productName: form.productName.trim(),
      productModel: form.productModel.trim() || undefined,
      description: form.description.trim() || undefined,
      nodeType: form.nodeType || undefined,
      transport: form.transport || undefined,
      authModes: form.authModes,
      dataMode: form.dataMode || undefined,
      bootstrapMode: form.bootstrapMode || undefined,
      protocolProfile:
        customPayload && form.profileId.trim() && form.profileVersion.trim()
          ? ({
              profileId: form.profileId.trim(),
              profileVersion: form.profileVersion.trim(),
            } satisfies ProtocolProfileRefView)
          : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto !max-w-[min(94vw,768px)]">
        <DialogHeader>
          <DialogTitle>编辑产品</DialogTitle>
          <DialogDescription>
            草稿产品可以修改基本信息和连接契约；发布后连接配置会锁定。
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">产品名称</span>
              <Input
                value={form.productName}
                onChange={(event) => updateField('productName', event.target.value)}
                required
                maxLength={128}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">产品型号</span>
              <Input
                value={form.productModel}
                onChange={(event) => updateField('productModel', event.target.value)}
                maxLength={128}
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">产品描述</span>
            <Textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              maxLength={2048}
              rows={3}
            />
          </label>

          <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium">连接契约</p>
              <p className="mt-1 text-xs text-muted-foreground">
                发布前必须补齐节点类型、传输协议和认证方式。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">节点类型</span>
                <Select value={form.nodeType} onValueChange={(value) => updateField('nodeType', value ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择节点类型">
                      {labelOf(PRODUCT_NODE_TYPE_LABEL, form.nodeType, '选择节点类型')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_NODE_TYPE_LABEL).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">传输协议</span>
                <Select value={form.transport} onValueChange={(value) => updateField('transport', value ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择传输协议">
                      {labelOf(PRODUCT_TRANSPORT_LABEL, form.transport, '选择传输协议')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_TRANSPORT_LABEL).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">消息数据模式</span>
                <Select value={form.dataMode} onValueChange={(value) => updateField('dataMode', value ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择数据模式">
                      {labelOf(PRODUCT_DATA_MODE_LABEL, form.dataMode, '选择数据模式')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_DATA_MODE_LABEL).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">接入模式</span>
                <Select value={form.bootstrapMode} onValueChange={(value) => updateField('bootstrapMode', value ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择接入模式">
                      {labelOf(PRODUCT_BOOTSTRAP_MODE_LABEL, form.bootstrapMode, '选择接入模式')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_BOOTSTRAP_MODE_LABEL).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">认证方式</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {AUTH_MODE_OPTIONS.map(([code, label]) => {
                  const required = code === 'DEVICE_SECRET';
                  return (
                  <label key={code} className={cn(
                    'flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm',
                    required && 'cursor-not-allowed bg-muted/40',
                  )}>
                    <Checkbox
                      checked={required || form.authModes.includes(code)}
                      disabled={required}
                      onCheckedChange={(checked) => toggleAuthMode(code, checked === true)}
                    />
                    <span>{label}</span>
                    {required ? <span className="ml-auto text-xs text-muted-foreground">必选</span> : null}
                  </label>
                )})}
              </div>
            </div>

            {customPayload ? (
              <div className="grid gap-4 border-t pt-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Parser Profile</span>
                  <ParserProfileSelect
                    profiles={parserProfiles}
                    value={form.profileId}
                    onValueChange={selectParserProfile}
                    disabled={parserProfilesLoading || parserProfiles.length === 0}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Profile 版本</span>
                  <ParserProfileVersionSelect
                    versions={publishedParserProfileVersions}
                    value={form.profileVersion}
                    placeholder={form.profileId ? '选择已发布版本' : '先选择 Profile'}
                    onValueChange={(value) => updateField('profileVersion', value ?? '')}
                    disabled={
                      !form.profileId ||
                      parserProfileVersionsLoading ||
                      publishedParserProfileVersions.length === 0
                    }
                  />
                </label>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  自定义报文必须绑定已发布且可用的 Parser Profile，否则产品发布检查不会通过。
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto justify-start px-0 sm:col-span-2"
                  nativeButton={false}
                  render={<Link to={`/projects/${projectId}/parser-profiles`} />}
                >
                  前往管理解析 Profile
                </Button>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting || form.authModes.length === 0}>
              {submitting ? <Spinner /> : null}
              保存产品配置
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ProductDetailPage = () => {
  const { projectId = '', productId = '' } = useParams<{
    projectId: string;
    productId: string;
  }>();
  const navigate = useNavigate();
  const { mutate: mutateCache } = useSWRConfig();
  const { data: project } = useProjectDetail(projectId);
  const productKey = productId
    ? `/api/v1/products/${encodeURIComponent(productId)}`
    : null;
  const {
    data: product,
    error: productError,
    isLoading: productLoading,
    mutate: mutateProduct,
  } = useSWR<ProductDetailView>(productKey, openPlatformGetFetcher);
  const { data: published } = useSWR<ThingModelDefinition>(
    productId ? productPublishedModelKey(productId) : null,
    openPlatformGetFetcher,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<OpenPlatformApiError | null>(null);
  const [confirmAction, setConfirmAction] = useState<ProductLifecycleAction | null>(null);
  const isCustomCategory =
    product?.categoryType === 'CUSTOM' || product?.categoryCode === 'CUSTOM';

  const productListKey = projectId
    ? `/api/v1/projects/${encodeURIComponent(projectId)}/products?pageSize=100`
    : null;

  const refreshProduct = async () => {
    await Promise.all([
      mutateProduct(),
      productListKey ? mutateCache(productListKey) : Promise.resolve(),
    ]);
  };

  const saveProduct = async (body: Omit<ProductUpdateRequest, 'version'>) => {
    if (!product) return;
    setBusyAction('save');
    setActionError(null);
    try {
      await openPlatformPut<boolean>(productKey as string, {
        version: String(product.version),
        ...body,
      });
      setEditOpen(false);
      await refreshProduct();
      toast.success('产品配置已保存。');
    } catch (error) {
      setActionError(error as OpenPlatformApiError);
    } finally {
      setBusyAction(null);
    }
  };

  const checkProductPublish = async () => {
    if (!product) return;
    setBusyAction('publish-check');
    setActionError(null);
    try {
      await openPlatformPost<boolean>(`${productKey}/publish/validate`, {});
      setConfirmAction('publish');
    } catch (error) {
      setActionError(error as OpenPlatformApiError);
    } finally {
      setBusyAction(null);
    }
  };

  const executeLifecycleAction = async () => {
    if (!product || !confirmAction) return;
    const action = confirmAction;
    setBusyAction(action);
    setActionError(null);
    try {
      if (action === 'delete') {
        await openPlatformDelete<boolean>(productKey as string, {
          version: String(product.version),
        });
        setConfirmAction(null);
        toast.success('产品已删除。');
        await mutateCache(productListKey);
        navigate(`/projects/${projectId}/products`, { replace: true });
        return;
      }

      await openPlatformPost<boolean>(`${productKey}/${action}`, {
        version: String(product.version),
      });
      setConfirmAction(null);
      await refreshProduct();
      toast.success(
        action === 'publish'
          ? '产品已发布，连接契约现已锁定。'
          : action === 'disable'
            ? '产品已停用。'
            : action === 'enable'
              ? '产品已恢复启用。'
              : '产品已废弃。',
      );
    } catch (error) {
      setActionError(error as OpenPlatformApiError);
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    document.title = product ? `${product.productName} · 产品 | AIoT 开放平台` : '产品详情 | AIoT 开放平台';
  }, [product]);

  const error = productError as OpenPlatformApiError | undefined;
  const breadcrumbItems = [
    { to: '/projects', title: '项目' },
    { to: `/projects/${projectId}/products`, title: '产品' },
    { title: product?.productName ?? '产品详情' },
  ];

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col gap-px bg-border p-px"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="产品详情" items={breadcrumbItems} />
      <ProjectWorkspaceShell activePrimary="products">
        {actionError ? (
          <ApiErrorAlert
            code={actionError.code}
            message={actionError.message}
            onRetry={() => void refreshProduct()}
          />
        ) : null}
        {productError ? (
          <ApiErrorAlert
            code={error?.code}
            message={productError.message}
            onRetry={() => void mutateProduct()}
          />
        ) : productLoading && !product ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-52 w-full" />
              <Skeleton className="h-52 w-full" />
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
                  <Package className="size-5 shrink-0" aria-hidden />
                  <h1 className="truncate text-lg font-semibold tracking-tight">
                    {product.productName}
                  </h1>
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
              <div className="flex flex-wrap gap-2">
                {product.lifecycleStatus === 'DRAFT' ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setEditOpen(true)}
                      disabled={busyAction != null}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      编辑产品
                    </Button>
                    <Button
                      type="button"
                      className="gap-1"
                      onClick={() => void checkProductPublish()}
                      disabled={busyAction != null}
                    >
                      {busyAction === 'publish-check' ? <Spinner /> : <Rocket className="size-3.5" aria-hidden />}
                      检查并发布
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => setConfirmAction('delete')}
                      disabled={busyAction != null}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      删除
                    </Button>
                  </>
                ) : null}
                {product.lifecycleStatus === 'PUBLISHED' ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setConfirmAction('disable')}
                      disabled={busyAction != null}
                    >
                      <Pause className="size-3.5" aria-hidden />
                      停用产品
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => setConfirmAction('deprecate')}
                      disabled={busyAction != null}
                    >
                      <Archive className="size-3.5" aria-hidden />
                      废弃产品
                    </Button>
                  </>
                ) : null}
                {product.lifecycleStatus === 'DISABLED' ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setConfirmAction('enable')}
                      disabled={busyAction != null}
                    >
                      <Play className="size-3.5" aria-hidden />
                      恢复启用
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => setConfirmAction('deprecate')}
                      disabled={busyAction != null}
                    >
                      <Archive className="size-3.5" aria-hidden />
                      废弃产品
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  className="gap-1"
                  nativeButton={false}
                  render={<Link to={`/projects/${projectId}/products/${product.productId}/model`} />}
                >
                  <Braces className="size-4" aria-hidden />
                  管理物模型
                </Button>
              </div>
            </div>

            <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-1" aria-label="产品功能">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 bg-background shadow-sm"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/products/${product.productId}`} />}
              >
                <Package className="size-3.5" aria-hidden />
                产品概览
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/products/${product.productId}/model`} />}
              >
                <Braces className="size-3.5" aria-hidden />
                物模型
              </Button>
            </nav>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">产品信息</CardTitle>
                  <CardDescription>
                    {isCustomCategory
                      ? '该产品不关联平台标准品类，物模型能力由你自行定义。'
                      : '产品创建后，品类关联保持不变。'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">产品型号</p>
                    <p className="mt-1 text-sm">{product.productModel || '未填写'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">所属品类</p>
                    {isCustomCategory ? (
                      <>
                        <p className="mt-1 text-sm">自定义品类</p>
                        <p className="text-xs text-muted-foreground">不继承平台品类能力</p>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="link"
                          className="mt-0.5 h-auto p-0 text-sm"
                          nativeButton={false}
                          render={<Link to={`/projects/${projectId}/categories/${product.categoryCode}`} />}
                        >
                          {product.categoryName || product.categoryCode}
                        </Button>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {product.categoryCode}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">创建时间</p>
                    <p className="mt-1 text-sm">{new Date(product.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">最近更新</p>
                    <p className="mt-1 text-sm">{new Date(product.updatedAt).toLocaleString('zh-CN')}</p>
                  </div>
                  {product.description ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">产品描述</p>
                      <p className="mt-1 text-sm leading-6">{product.description}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Braces className="size-4" aria-hidden />
                    物模型状态
                  </CardTitle>
                  <CardDescription>能力定义独立于产品生命周期管理。</CardDescription>
                </CardHeader>
                <CardContent>
                  <ModelState
                    projectId={projectId}
                    productId={product.productId}
                    published={published}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full gap-1"
                    nativeButton={false}
                    render={<Link to={`/projects/${projectId}/products/${product.productId}/model`} />}
                  >
                    <Braces className="size-3.5" aria-hidden />
                    进入物模型工作区
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Router className="size-4" aria-hidden />
                      连接契约
                    </CardTitle>
                    <CardDescription>
                      {product.lifecycleStatus === 'DRAFT'
                        ? '请点击右侧“配置连接”填写设备接入方式和消息协议。'
                        : '连接配置需在产品草稿阶段填写，发布后仅支持查看。'}
                    </CardDescription>
                  </div>
                  {product.lifecycleStatus === 'DRAFT' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => setEditOpen(true)}
                    >
                      <Settings2 className="size-3.5" aria-hidden />
                      配置连接
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 rounded-lg border bg-muted/20 p-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-md border bg-background px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Router className="size-3.5" aria-hidden />
                        设备接入
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">节点类型</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {labelOf(PRODUCT_NODE_TYPE_LABEL, product.nodeType, '未配置')}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Radio className="size-3.5" aria-hidden />
                        通信协议
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">传输协议</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {labelOf(PRODUCT_TRANSPORT_LABEL, product.transport, '未配置')}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ShieldCheck className="size-3.5" aria-hidden />
                        身份认证
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">认证方式</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {authModesLabel(product.authModes)}
                      </p>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Settings2 className="size-3.5" aria-hidden />
                        接入策略
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">接入模式</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {labelOf(PRODUCT_BOOTSTRAP_MODE_LABEL, product.bootstrapMode, '未配置')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        ) : null}
      </ProjectWorkspaceShell>

      {product ? (
        <ProductEditDialog
          projectId={projectId}
          open={editOpen}
          product={product}
          submitting={busyAction === 'save'}
          onOpenChange={setEditOpen}
          onSubmit={(body) => void saveProduct(body)}
        />
      ) : null}

      <AlertDialog
        open={confirmAction != null}
        onOpenChange={(open) => {
          if (!open && busyAction == null) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? PRODUCT_ACTION_COPY[confirmAction].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? PRODUCT_ACTION_COPY[confirmAction].description : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction != null}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === 'delete' || confirmAction === 'deprecate' ? 'destructive' : 'default'}
              disabled={busyAction != null || confirmAction == null}
              onClick={(event) => {
                event.preventDefault();
                void executeLifecycleAction();
              }}
            >
              {busyAction ? <Spinner /> : null}
              {confirmAction ? PRODUCT_ACTION_COPY[confirmAction].confirm : '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StyleAwareWrapper>
  );
};

export default ProductDetailPage;
