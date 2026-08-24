import { useMemo, useState, type FormEvent } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  ArrowLeft,
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CategoryDetails } from '@/components/open-platform/category-details';
import { CategoryTree } from '@/components/open-platform/category-tree';
import { ProductBootstrapModeField } from '@/components/open-platform/product-bootstrap-mode-field';
import {
  ParserProfileSelect,
  ParserProfileVersionSelect,
} from '@/components/open-platform/parser-profile-selector';
import { ProjectStatusBadge } from '@/components/open-platform/project-status-badge';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  OpenPlatformApiError,
  openPlatformPost,
  openPlatformGetFetcher,
  useProjectDetail,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import {
  PRODUCT_AUTH_MODE_LABEL,
  PRODUCT_DATA_MODE_LABEL,
  PRODUCT_NODE_TYPE_LABEL,
  PRODUCT_TRANSPORT_LABEL,
  labelOf,
} from '@/lib/open-platform-labels';
import { categoryLabel } from '@/lib/open-platform-category';
import { cn } from '@/lib/utils';
import type {
  CategoryVersionView,
  CategoryView,
  CursorResult,
  ParserProfileVersionView,
  ParserProfileView,
  ProductCreateRequest,
  ProductListItem,
} from '@/types/apps/open-platform';

type ProductForm = {
  productName: string;
  productModel: string;
  categoryCode: string;
  nodeType: string;
  transport: string;
  authModes: string[];
  dataMode: string;
  bootstrapMode: string;
  profileId: string;
  profileVersion: string;
};
type CategoryMode = 'STANDARD' | 'CUSTOM';
type ProductField = keyof ProductForm;
type FieldErrors = Partial<Record<ProductField, string>>;
type CreateStep = 1 | 2;

const initialForm: ProductForm = {
  productName: '',
  productModel: '',
  categoryCode: '',
  nodeType: '',
  transport: '',
  authModes: ['DEVICE_SECRET'],
  dataMode: 'STANDARD_MODEL',
  bootstrapMode: 'OPEN',
  profileId: '',
  profileVersion: '',
};

const AUTH_MODE_OPTIONS = Object.entries(PRODUCT_AUTH_MODE_LABEL).filter(
  ([code]) => ['DEVICE_SECRET', 'PRODUCT_SECRET', 'CUSTOM'].includes(code),
);

const productListKey = (projectId: string) =>
  `/api/v1/projects/${projectId}/products?pageSize=100`;

function validateProduct(
  form: ProductForm,
  selectedCategory?: CategoryView,
  categoryMode: CategoryMode = 'STANDARD',
): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.productName.trim();
  const model = form.productModel.trim();
  const category = form.categoryCode.trim();

  if (!name) errors.productName = '请输入产品名称。';
  else if (name.length > 128) errors.productName = '产品名称不能超过 128 个字符。';

  if (model.length > 128) errors.productModel = '产品型号不能超过 128 个字符。';
  if (categoryMode === 'STANDARD') {
    if (!category) errors.categoryCode = '请选择品类。';
    else if (!selectedCategory) errors.categoryCode = '请选择有效的品类。';
    else if (!selectedCategory.leaf) errors.categoryCode = '请选择叶子品类。';
  }

  return errors;
}

function validateConnection(form: ProductForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.nodeType) errors.nodeType = '请选择节点类型。';
  if (!form.transport) errors.transport = '请选择传输协议。';
  if (form.authModes.length === 0) errors.authModes = '至少选择一种认证方式。';
  if (!form.dataMode) errors.dataMode = '请选择消息数据模式。';
  if (!form.bootstrapMode) {
    errors.bootstrapMode = form.authModes.includes('PRODUCT_SECRET')
      ? '请选择动态注册或预注册。'
      : '请选择注册模式。';
  }
  if (form.dataMode === 'CUSTOM_PAYLOAD') {
    if (!form.profileId.trim()) errors.profileId = '请选择已发布的 Parser Profile。';
    if (!form.profileVersion.trim()) errors.profileVersion = '请选择可用的 Profile 版本。';
  }
  return errors;
}

const CreateProductPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { mutate: mutateCache } = useSWRConfig();
  const { data: project } = useProjectDetail(projectId);
  const {
    data: categories,
    error: categoriesError,
    isLoading: categoriesLoading,
    mutate: mutateCategories,
  } = useSWR<CategoryView[]>('/api/v1/categories', openPlatformGetFetcher, {
    revalidateOnFocus: false,
  });
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('STANDARD');
  const [step, setStep] = useState<CreateStep>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = project?.status === 'ACTIVE';
  const apiError = submitError as OpenPlatformApiError | null;
  const categoryApiError = categoriesError as OpenPlatformApiError | undefined;
  const selectedCategory = useMemo(
    () => categories?.find((category) => category.categoryCode === form.categoryCode),
    [categories, form.categoryCode],
  );
  const selectedCategoryVersionsKey = selectedCategory
    ? '/api/v1/categories/' + encodeURIComponent(selectedCategory.categoryCode) + '/versions'
    : null;
  const {
    data: selectedCategoryVersions,
    error: selectedCategoryVersionsError,
  } = useSWR<CategoryVersionView[]>(
    selectedCategoryVersionsKey,
    openPlatformGetFetcher,
    { revalidateOnFocus: false },
  );
  const selectedVersionsApiError =
    selectedCategoryVersionsError as OpenPlatformApiError | undefined;
  const parserProfilesKey = form.dataMode === 'CUSTOM_PAYLOAD'
    ? '/api/v1/parser-profiles?pageSize=100'
    : null;
  const {
    data: parserProfilesData,
    error: parserProfilesError,
    isLoading: parserProfilesLoading,
  } = useSWR<CursorResult<ParserProfileView>>(
    parserProfilesKey,
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
  const parserProfileVersionsKey = selectedParserProfile
    ? `/api/v1/parser-profiles/${encodeURIComponent(selectedParserProfile.profileId)}/versions`
    : null;
  const {
    data: parserProfileVersions,
    error: parserProfileVersionsError,
    isLoading: parserProfileVersionsLoading,
  } = useSWR<ParserProfileVersionView[]>(
    parserProfileVersionsKey,
    openPlatformGetFetcher,
    { revalidateOnFocus: false },
  );
  const publishedParserProfileVersions = useMemo(
    () => (parserProfileVersions ?? []).filter((version) => version.versionStatus === 'PUBLISHED'),
    [parserProfileVersions],
  );

  const updateField = (field: ProductField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const toggleAuthMode = (code: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      authModes: checked
        ? [...new Set([...current.authModes, code])]
        : current.authModes.filter((item) => item !== code),
    }));
    setErrors((current) => ({ ...current, authModes: undefined }));
    setSubmitError(null);
  };

  const selectParserProfile = (profileId: string | null) => {
    setForm((current) => ({
      ...current,
      profileId: profileId ?? '',
      profileVersion: '',
    }));
    setErrors((current) => ({
      ...current,
      profileId: undefined,
      profileVersion: undefined,
    }));
    setSubmitError(null);
  };

  const goToConnectionStep = () => {
    const nextErrors = validateProduct(form, selectedCategory, categoryMode);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0 || !canCreate) return;
    setStep(2);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) {
      goToConnectionStep();
      return;
    }

    const nextErrors = {
      ...validateProduct(form, selectedCategory, categoryMode),
      ...validateConnection(form),
    };
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0 || !projectId || !canCreate) return;

    setSubmitting(true);
    try {
      const created = await openPlatformPost<ProductListItem>(
        `/api/v1/projects/${projectId}/products`,
        {
          productName: form.productName.trim(),
          productModel: form.productModel.trim() || undefined,
          categoryType: categoryMode,
          nodeType: form.nodeType,
          transport: form.transport,
          authModes: form.authModes,
          dataMode: form.dataMode,
          bootstrapMode: form.bootstrapMode,
          protocolProfile:
            form.dataMode === 'CUSTOM_PAYLOAD'
              ? {
                  profileId: form.profileId.trim(),
                  profileVersion: form.profileVersion.trim(),
                }
              : null,
          ...(categoryMode === 'STANDARD'
            ? { categoryCode: form.categoryCode.trim() }
            : {}),
        } satisfies ProductCreateRequest,
      );

      await mutateCache(productListKey(projectId));
      toast.success(`产品“${created.productName}”已创建，下一步配置物模型。`);
      navigate(`/projects/${projectId}/products/${created.productId}/model`, {
        replace: true,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error : new Error('创建产品失败。'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectCategoryMode = (nextMode: CategoryMode) => {
    setCategoryMode(nextMode);
    setForm((current) => ({ ...current, categoryCode: '' }));
    setErrors((current) => ({ ...current, categoryCode: undefined }));
    setSubmitError(null);
  };

  const breadcrumbItems = [
    { to: '/projects', title: '项目' },
    { to: `/projects/${projectId}/products`, title: '产品' },
    { title: '创建产品' },
  ];

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col gap-px bg-border p-px"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="创建产品" items={breadcrumbItems} />
      <ProjectWorkspaceShell activePrimary="products">
        <Card className="!gap-0 !py-0">
          <CardHeader className="border-b py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit gap-1 px-2 text-muted-foreground"
              nativeButton={false}
              render={<Link to={`/projects/${projectId}/products`} />}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              返回产品列表
            </Button>
            <CardTitle className="flex items-center gap-2 pt-1">
              <PackagePlus className="size-4" aria-hidden />
              创建产品
            </CardTitle>
            <CardDescription>
              按步骤填写产品信息、品类和连接契约，全部完成后一次性创建产品草稿。
            </CardDescription>
            {project ? (
              <div className="flex flex-wrap items-center gap-2 pt-2 text-sm">
                <span className="text-muted-foreground">当前 Project</span>
                <span className="font-medium">{project.projectName}</span>
                <code className="font-mono text-xs text-muted-foreground">
                  {project.projectId}
                </code>
                <ProjectStatusBadge status={project.status} />
              </div>
            ) : null}
          </CardHeader>

          <form
            data-create-product-form="true"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <CardContent className="space-y-4 py-5">
              {!canCreate && project ? (
                <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  当前 Project 不是“启用”状态，不能创建产品。请先恢复 Project 后再试。
                </div>
              ) : null}

              {submitError ? (
                <ApiErrorAlert
                  code={apiError?.code}
                  message={submitError.message}
                  onRetry={() => {
                    const formElement = document.querySelector<HTMLFormElement>(
                      'form[data-create-product-form="true"]',
                    );
                    formElement?.requestSubmit();
                  }}
                />
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2" aria-label="创建产品步骤">
                <button
                  type="button"
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    step === 1
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/10 text-muted-foreground'
                  }`}
                  onClick={() => setStep(1)}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step === 1
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-emerald-600 text-white dark:bg-emerald-500'
                    }`}
                  >
                    {step === 1 ? '1' : <Check className="size-3.5" aria-hidden />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">基本信息与品类</span>
                    <span className="block text-xs text-muted-foreground">名称、型号和品类来源</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    step === 2
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/10 text-muted-foreground'
                  }`}
                  onClick={() => {
                    if (step === 1) goToConnectionStep();
                    else setStep(2);
                  }}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step === 2
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    2
                  </span>
                  <span>
                    <span className="block text-sm font-medium">连接契约</span>
                    <span className="block text-xs text-muted-foreground">协议、认证和注册方式</span>
                  </span>
                </button>
              </div>

              <FieldGroup>
                {step === 1 ? (
                  <>
                  <div className="grid gap-5 md:grid-cols-2">
                  <Field data-invalid={Boolean(errors.productName) || undefined}>
                    <FieldLabel htmlFor="create-product-name">
                      产品名称 <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="create-product-name"
                      value={form.productName}
                      onChange={(event) => updateField('productName', event.target.value)}
                      placeholder="例如：智能温控器"
                      autoComplete="off"
                      maxLength={128}
                      aria-invalid={Boolean(errors.productName) || undefined}
                    />
                    {errors.productName ? (
                      <FieldError>{errors.productName}</FieldError>
                    ) : (
                      <FieldDescription>用于项目成员识别产品</FieldDescription>
                    )}
                  </Field>

                  <Field data-invalid={Boolean(errors.productModel) || undefined}>
                    <FieldLabel htmlFor="create-product-model">产品型号</FieldLabel>
                    <Input
                      id="create-product-model"
                      value={form.productModel}
                      onChange={(event) => updateField('productModel', event.target.value)}
                      placeholder="例如：TH-100（可选）"
                      autoComplete="off"
                      maxLength={128}
                      aria-invalid={Boolean(errors.productModel) || undefined}
                    />
                    {errors.productModel ? (
                      <FieldError>{errors.productModel}</FieldError>
                    ) : (
                      <FieldDescription>用于列表展示和产品区分</FieldDescription>
                    )}
                  </Field>
                  </div>

                  <div className="rounded-lg border bg-muted/10 p-4">
                  <p className="text-sm font-medium">品类来源</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    标准品类会带入平台能力；自定义品类不继承任何品类能力，创建后由你自行定义物模型。
                  </p>

                  <Tabs
                    value={categoryMode}
                    onValueChange={(value) => {
                      if (value === 'STANDARD' || value === 'CUSTOM') {
                        selectCategoryMode(value);
                      }
                    }}
                    className="mt-4 flex-col gap-3"
                  >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
                      <TabsList variant="line" className="h-8 w-full justify-start border-b">
                        <TabsTrigger value="STANDARD" className="h-8 px-3 text-xs">
                          标准品类
                        </TabsTrigger>
                        <TabsTrigger value="CUSTOM" className="h-8 px-3 text-xs">
                          自定义品类
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="STANDARD" className="mt-0 min-w-0 flex-col">
                      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
                        <Field data-invalid={Boolean(errors.categoryCode) || undefined}>
                          {categoriesError ? (
                            <ApiErrorAlert
                              code={categoryApiError?.code}
                              message={categoriesError.message}
                              onRetry={() => void mutateCategories()}
                            />
                          ) : categoriesLoading && !categories ? (
                            <div className="space-y-3">
                              <Skeleton className="h-9 w-full" />
                              <Skeleton className="h-9 w-full" />
                              <Skeleton className="h-9 w-11/12" />
                              <Skeleton className="h-9 w-10/12" />
                            </div>
                          ) : (
                            <CategoryTree
                              categories={categories ?? []}
                              selectedCode={form.categoryCode}
                              selectableLeafOnly
                              disabled={!canCreate}
                              onSelect={(category) =>
                                updateField('categoryCode', category.categoryCode)
                              }
                            />
                          )}
                          {errors.categoryCode ? (
                            <FieldError>{errors.categoryCode}</FieldError>
                          ) : null}
                        </Field>

                        <div className="flex h-full min-h-0 min-w-0 flex-col">
                          <div className="min-h-0 flex-1 [&>div]:h-full">
                            {selectedCategoryVersionsError ? (
                              <ApiErrorAlert
                                code={selectedVersionsApiError?.code}
                                message={selectedCategoryVersionsError.message}
                              />
                            ) : (
                              <CategoryDetails
                                category={selectedCategory}
                                versions={selectedCategoryVersions}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="CUSTOM" className="mt-0 min-w-0 flex-col">
                      <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center">
                        <Braces className="size-7 text-muted-foreground" aria-hidden />
                        <p className="mt-3 text-sm font-medium">自定义品类</p>
                        <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                          不绑定平台标准品类，也不会带入任何属性、动作或事件。产品创建后进入空白物模型草稿，由你自行定义全部能力。
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                  </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/10 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        已完成基本信息
                      </div>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-muted-foreground">产品名称</span>
                          <p className="mt-0.5 font-medium">{form.productName}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">产品型号</span>
                          <p className="mt-0.5 font-medium">{form.productModel || '未填写'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">品类来源</span>
                          <p className="mt-0.5 font-medium">
                            {categoryMode === 'CUSTOM'
                              ? '自定义品类'
                              : selectedCategory
                                ? categoryLabel(selectedCategory)
                                : '未选择'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/10 p-4">
                      <div>
                        <p className="text-sm font-medium">连接契约</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          这些配置会随产品一起创建，发布前仍可在产品详情页修改。
                        </p>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field data-invalid={Boolean(errors.nodeType) || undefined}>
                          <FieldLabel>节点类型 <span className="text-destructive">*</span></FieldLabel>
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
                          {errors.nodeType ? <FieldError>{errors.nodeType}</FieldError> : null}
                        </Field>

                        <Field data-invalid={Boolean(errors.transport) || undefined}>
                          <FieldLabel>传输协议 <span className="text-destructive">*</span></FieldLabel>
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
                          {errors.transport ? <FieldError>{errors.transport}</FieldError> : null}
                        </Field>

                        <Field data-invalid={Boolean(errors.dataMode) || undefined}>
                          <FieldLabel>消息数据模式 <span className="text-destructive">*</span></FieldLabel>
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
                          {errors.dataMode ? <FieldError>{errors.dataMode}</FieldError> : null}
                        </Field>

                      </div>

                      <Field className="mt-4" data-invalid={Boolean(errors.authModes) || undefined}>
                        <FieldLabel>认证方式 <span className="text-destructive">*</span></FieldLabel>
                        <FieldDescription>可只使用产品密钥，也可同时启用设备密钥；至少选择一种。</FieldDescription>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {AUTH_MODE_OPTIONS.map(([code, label]) => {
                            return (
                            <label key={code} className={cn(
                              'flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm',
                            )}>
                              <Checkbox
                                checked={form.authModes.includes(code)}
                                onCheckedChange={(checked) => toggleAuthMode(code, checked === true)}
                              />
                              <span>{label}</span>
                            </label>
                          )})}
                        </div>
                        {errors.authModes ? <FieldError>{errors.authModes}</FieldError> : null}
                      </Field>

                      <ProductBootstrapModeField
                        className="mt-4"
                        value={form.bootstrapMode}
                        onValueChange={(value) => updateField('bootstrapMode', value)}
                        productSecretEnabled={form.authModes.includes('PRODUCT_SECRET')}
                        deviceSecretEnabled={form.authModes.includes('DEVICE_SECRET')}
                        error={errors.bootstrapMode}
                      />

                      {form.dataMode === 'CUSTOM_PAYLOAD' ? (
                        <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                          <Field data-invalid={Boolean(errors.profileId) || undefined}>
                            <FieldLabel>Parser Profile <span className="text-destructive">*</span></FieldLabel>
                            <ParserProfileSelect
                              profiles={parserProfiles}
                              value={form.profileId}
                              onValueChange={selectParserProfile}
                              disabled={parserProfilesLoading || parserProfiles.length === 0}
                              invalid={Boolean(errors.profileId)}
                              loading={parserProfilesLoading}
                            />
                            {parserProfilesError ? (
                              <FieldDescription className="text-destructive">
                                Profile 加载失败，请稍后重试。
                              </FieldDescription>
                            ) : null}
                            {errors.profileId ? <FieldError>{errors.profileId}</FieldError> : null}
                          </Field>
                          <Field data-invalid={Boolean(errors.profileVersion) || undefined}>
                            <FieldLabel>Profile 版本 <span className="text-destructive">*</span></FieldLabel>
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
                              invalid={Boolean(errors.profileVersion)}
                              loading={parserProfileVersionsLoading}
                            />
                            {parserProfileVersionsError ? (
                              <FieldDescription className="text-destructive">
                                Profile 版本加载失败，请稍后重试。
                              </FieldDescription>
                            ) : null}
                            {errors.profileVersion ? <FieldError>{errors.profileVersion}</FieldError> : null}
                          </Field>
                          <FieldDescription className="sm:col-span-2">
                            自定义报文必须绑定已发布且可用的 Parser Profile 版本。
                          </FieldDescription>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto justify-start px-0 sm:col-span-2"
                            nativeButton={false}
                            render={<Link to={`/projects/${projectId}/parser-profiles`} />}
                          >
                            没有 Profile？前往管理解析 Profile
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </FieldGroup>
            </CardContent>

            <CardFooter className="justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/products`} />}
                disabled={submitting}
              >
                取消
              </Button>
              <div className="flex gap-2">
                {step === 2 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    <ChevronLeft className="size-3.5" aria-hidden />
                    上一步
                  </Button>
                ) : null}
                {step === 1 ? (
                  <Button
                    type="button"
                    className="gap-1"
                    onClick={goToConnectionStep}
                    disabled={submitting || !canCreate}
                  >
                    下一步：配置连接
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Button>
                ) : (
                  <Button type="submit" disabled={submitting || !canCreate}>
                    {submitting ? (
                      <>
                        <Spinner />
                        创建中…
                      </>
                    ) : (
                      '创建产品'
                    )}
                  </Button>
                )}
              </div>
            </CardFooter>
          </form>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default CreateProductPage;
