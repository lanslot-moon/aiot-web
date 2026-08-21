import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Link, useParams } from 'react-router';
import { Library, MoreHorizontal, PackagePlus, SearchIcon, X } from 'lucide-react';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProductLifecycleBadge } from '@/components/open-platform/product-lifecycle-badge';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import {
  OpenPlatformApiError,
  openPlatformGetFetcher,
  useProjectDetail,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import {
  PRODUCT_LIFECYCLE_LABEL,
  PROJECT_STATUS_LABEL,
  labelOf,
} from '@/lib/open-platform-labels';
import type { CursorResult, ProductListItem } from '@/types/apps/open-platform';

const BCrumb = [
  { to: '/projects', title: '项目' },
  { title: '产品' },
];

const STATUS_ALL = 'ALL';

const ProjectProductsPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState(STATUS_ALL);
  const { data: project } = useProjectDetail(projectId);
  const productsKey = projectId
    ? `/api/v1/projects/${projectId}/products?pageSize=100`
    : null;
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<CursorResult<ProductListItem>>(productsKey, openPlatformGetFetcher);

  const products = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return products.filter((product) => {
      if (status !== STATUS_ALL && product.lifecycleStatus !== status) return false;
      if (!q) return true;
      return [
        product.productName,
        product.productId,
        product.productModel ?? '',
        product.categoryCode,
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [keyword, products, status]);

  const counts = useMemo(
    () => ({
      all: products.length,
      published: products.filter((product) => product.lifecycleStatus === 'PUBLISHED')
        .length,
      draft: products.filter((product) => product.lifecycleStatus === 'DRAFT').length,
    }),
    [products],
  );

  const canCreate = project?.status === 'ACTIVE';
  const productError = error as OpenPlatformApiError | undefined;

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col gap-px bg-border p-px"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="产品" items={BCrumb} />
      <ProjectWorkspaceShell activePrimary="products">
        <div className="flex h-full min-h-[28rem] flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['全部', counts.all],
                  ['已发布', counts.published],
                  ['草稿', counts.draft],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold tabular-nums">
                    {isLoading && !data ? '…' : value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1"
                nativeButton={false}
                render={
                  <Link
                    to={`/projects/${projectId}/categories`}
                    state={{ from: 'products' }}
                  />
                }
              >
                <Library className="size-4" aria-hidden />
                品类
              </Button>
              <Button
                type="button"
                className="shrink-0 gap-1"
                disabled={!canCreate}
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/products/new`} />}
              >
                <PackagePlus className="size-4" aria-hidden />
                创建产品
              </Button>
            </div>
          </div>

          {project && !canCreate ? (
            <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              当前项目为“{labelOf(PROJECT_STATUS_LABEL, project.status)}”状态，暂不能创建产品。
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-72">
              <SearchIcon
                size={16}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索产品名称 / ID"
                aria-label="搜索产品名称或 ID"
                className="pr-8 pl-8"
              />
              {keyword ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                  aria-label="清除产品搜索"
                  onClick={() => setKeyword('')}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value ?? STATUS_ALL)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="生命周期" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>全部状态</SelectItem>
                <SelectItem value="DRAFT">{PRODUCT_LIFECYCLE_LABEL.DRAFT}</SelectItem>
                <SelectItem value="PUBLISHED">
                  {PRODUCT_LIFECYCLE_LABEL.PUBLISHED}
                </SelectItem>
                <SelectItem value="DISABLED">
                  {PRODUCT_LIFECYCLE_LABEL.DISABLED}
                </SelectItem>
                <SelectItem value="DEPRECATED">
                  {PRODUCT_LIFECYCLE_LABEL.DEPRECATED}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品</TableHead>
                  <TableHead>型号</TableHead>
                  <TableHead>品类</TableHead>
                  <TableHead>生命周期</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-end">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 px-6">
                      <ApiErrorAlert
                        code={productError?.code}
                        message={error.message}
                        onRetry={() => void mutate()}
                      />
                    </TableCell>
                  </TableRow>
                ) : isLoading && !data ? (
                  Array.from({ length: 4 }, (_, index) => (
                    <TableRow key={`product-skeleton-${index}`}>
                      <TableCell>
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="mt-1 h-3 w-28" />
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      {products.length === 0
                        ? '当前项目还没有产品，点击“创建产品”开始。'
                        : '没有符合条件的产品'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 font-medium"
                            nativeButton={false}
                            render={
                              <Link
                                to={`/projects/${projectId}/products/${product.productId}`}
                              />
                            }
                          >
                            {product.productName}
                          </Button>
                          <div className="flex items-center gap-0.5">
                            <code className="font-mono text-xs text-muted-foreground">
                              {product.productId}
                            </code>
                            <CopyIdButton value={product.productId} label="Product ID" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{product.productModel || '—'}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {product.categoryName || product.categoryCode || '未分类'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ProductLifecycleBadge status={product.lifecycleStatus} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(product.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(product.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button type="button" variant="ghost" size="icon-sm">
                                <MoreHorizontal aria-hidden />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              render={
                                <Link
                                  to={`/projects/${projectId}/products/${product.productId}`}
                                />
                              }
                            >
                              查看产品
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              render={
                                <Link
                                  to={`/projects/${projectId}/products/${product.productId}/model`}
                                />
                              }
                            >
                              查看物模型
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectProductsPage;
