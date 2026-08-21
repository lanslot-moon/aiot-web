import { useEffect } from 'react';
import useSWR from 'swr';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CategoryDetails } from '@/components/open-platform/category-details';
import { CategoryTree } from '@/components/open-platform/category-tree';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import {
  OpenPlatformApiError,
  openPlatformGetFetcher,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { categoryLabel } from '@/lib/open-platform-category';
import type { CategoryVersionView, CategoryView } from '@/types/apps/open-platform';

const CategoryCatalogPage = () => {
  const { projectId = '', categoryCode } = useParams<{
    projectId: string;
    categoryCode?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const fromProducts = (location.state as { from?: string } | null)?.from === 'products';
  const {
    data: categories,
    error: categoriesError,
    isLoading: categoriesLoading,
    mutate: mutateCategories,
  } = useSWR<CategoryView[]>('/api/v1/categories', openPlatformGetFetcher, {
    revalidateOnFocus: false,
  });
  const detailKey = categoryCode
    ? `/api/v1/categories/${encodeURIComponent(categoryCode)}`
    : null;
  const {
    data: category,
    error: detailError,
    isLoading: detailLoading,
  } = useSWR<CategoryView>(detailKey, openPlatformGetFetcher, {
    revalidateOnFocus: false,
  });
  const versionsKey = categoryCode
    ? `/api/v1/categories/${encodeURIComponent(categoryCode)}/versions`
    : null;
  const {
    data: versions,
    error: versionsError,
    isLoading: versionsLoading,
    mutate: mutateVersions,
  } = useSWR<CategoryVersionView[]>(versionsKey, openPlatformGetFetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    document.title = category
      ? `${categoryLabel(category)} · 品类 — AIoT 开放平台`
      : '品类 — AIoT 开放平台';
  }, [category]);

  const categoryError = categoriesError as OpenPlatformApiError | undefined;
  const selectedCategoryError = detailError as OpenPlatformApiError | undefined;
  const selectedVersionError = versionsError as OpenPlatformApiError | undefined;
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col gap-px bg-border p-px"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp
        title="品类"
        items={[
          { to: '/projects', title: '项目' },
          { to: `/projects/${projectId}/categories`, title: '品类' },
          ...(category ? [{ title: categoryLabel(category) }] : []),
        ]}
      />
      <ProjectWorkspaceShell activePrimary="categories">
        <div className="min-h-[28rem]">
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
            <Card className="gap-0 py-0">
              <CardContent className="py-4">
                {categoriesError ? (
                  <ApiErrorAlert
                    code={categoryError?.code}
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
                    selectedCode={categoryCode}
                    fillHeight
                    actions={
                      <>
                        {fromProducts ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={<Link to={`/projects/${projectId}/products`} />}
                          >
                            <ArrowLeft className="size-3.5" aria-hidden />
                            返回产品
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          nativeButton={false}
                          render={<Link to={`/projects/${projectId}/products/new`} />}
                        >
                          <PackagePlus className="size-3.5" aria-hidden />
                          创建产品
                        </Button>
                      </>
                    }
                    onSelect={(nextCategory) =>
                      navigate(
                        `/projects/${projectId}/categories/${encodeURIComponent(nextCategory.categoryCode)}`,
                        { state: location.state },
                      )
                    }
                  />
                )}
              </CardContent>
            </Card>

            <div className="min-w-0">
              {detailError ? (
                <ApiErrorAlert
                  code={selectedCategoryError?.code}
                  message={detailError.message}
                />
              ) : versionsError ? (
                <ApiErrorAlert
                  code={selectedVersionError?.code}
                  message={versionsError.message}
                  onRetry={() => void mutateVersions()}
                />
              ) : (detailLoading || versionsLoading) && categoryCode ? (
                <Card className="gap-0 py-0">
                  <CardContent className="space-y-4 py-5">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </CardContent>
                </Card>
              ) : (
                <CategoryDetails category={category} versions={versions} />
              )}
            </div>
          </div>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default CategoryCatalogPage;
