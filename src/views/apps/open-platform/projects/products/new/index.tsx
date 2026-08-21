import { useMemo, useState, type FormEvent } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CategoryDetails } from '@/components/open-platform/category-details';
import { CategoryTree } from '@/components/open-platform/category-tree';
import { ProjectStatusBadge } from '@/components/open-platform/project-status-badge';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  OpenPlatformApiError,
  openPlatformPost,
  openPlatformGetFetcher,
  useProjectDetail,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import type {
  CategoryVersionView,
  CategoryView,
  ProductCreateRequest,
  ProductListItem,
} from '@/types/apps/open-platform';

type ProductForm = {
  productName: string;
  productModel: string;
  categoryCode: string;
};
type ProductField = keyof ProductForm;
type FieldErrors = Partial<Record<ProductField, string>>;

const initialForm: ProductForm = {
  productName: '',
  productModel: '',
  categoryCode: '',
};

const productListKey = (projectId: string) =>
  `/api/v1/projects/${projectId}/products?pageSize=100`;

function validateProduct(
  form: ProductForm,
  selectedCategory?: CategoryView,
): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.productName.trim();
  const model = form.productModel.trim();
  const category = form.categoryCode.trim();

  if (!name) errors.productName = '请输入产品名称。';
  else if (name.length > 128) errors.productName = '产品名称不能超过 128 个字符。';

  if (model.length > 128) errors.productModel = '产品型号不能超过 128 个字符。';
  if (!category) errors.categoryCode = '请选择品类。';
  else if (!selectedCategory) errors.categoryCode = '请选择有效的品类。';
  else if (!selectedCategory.leaf) errors.categoryCode = '请选择叶子品类。';

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

  const updateField = (field: ProductField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateProduct(form, selectedCategory);
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
          categoryCode: form.categoryCode.trim(),
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
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="products">
        <Card className="gap-0 py-0">
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
              产品会创建在当前 Project 下，并以草稿状态进入产品列表。
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

              <FieldGroup>
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        选择品类 <span className="text-destructive">*</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        从平台品类树中选择叶子品类，产品创建后会保留这个品类关联。
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      nativeButton={false}
                      render={
                        <Link
                          to={`/projects/${projectId}/categories`}
                          state={{ from: 'products' }}
                        />
                      }
                    >
                      查看品类
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
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

                    <div className="min-w-0">
                      <p className="mb-2 text-sm font-medium">品类预览</p>
                      {selectedCategoryVersionsError ? (
                        <ApiErrorAlert
                          code={selectedVersionsApiError?.code}
                          message={selectedCategoryVersionsError.message}
                        />
                      ) : (
                        <CategoryDetails
                          category={selectedCategory}
                          versions={selectedCategoryVersions}
                          compact
                        />
                      )}
                    </div>
                  </div>
                </div>

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
            </CardFooter>
          </form>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default CreateProductPage;
