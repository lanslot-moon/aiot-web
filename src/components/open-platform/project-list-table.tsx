import { format } from 'date-fns';
import { EllipsisVertical, FolderKanban, FolderOpen, Loader2, SearchX } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProjectStatusBadge } from '@/components/open-platform/project-status-badge';
import { RoleBadge } from '@/components/open-platform/role-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OpenPlatformApiError } from '@/context/open-platform-context';
import { cn } from '@/lib/utils';
import type { ProjectView } from '@/types/apps/open-platform';

function formatEpoch(ms: number): string {
  return format(new Date(ms), 'MMM d, yyyy HH:mm');
}

function ProjectListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading projects">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      ))}
    </div>
  );
}

export function ProjectListTable({
  projects,
  loading,
  error,
  hasActiveFilters,
  hasMore,
  loadingMore,
  loadMoreError,
  onRetry,
  onLoadMore,
  onClearFilters,
  className,
}: {
  projects: ProjectView[];
  loading: boolean;
  error: Error | null;
  hasActiveFilters: boolean;
  hasMore: boolean;
  loadingMore?: boolean;
  loadMoreError?: Error | null;
  onRetry: () => void;
  onLoadMore: () => void;
  onClearFilters: () => void;
  className?: string;
}) {
  const navigate = useNavigate();

  if (loading && projects.length === 0 && !error) {
    return <ProjectListSkeleton />;
  }

  if (error && projects.length === 0) {
    const apiErr = error instanceof OpenPlatformApiError ? error : null;
    return (
      <ApiErrorAlert
        code={apiErr?.code}
        message={error.message}
        onRetry={onRetry}
      />
    );
  }

  if (!loading && projects.length === 0) {
    if (hasActiveFilters) {
      return (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX aria-hidden />
            </EmptyMedia>
            <EmptyTitle>没有符合筛选条件的项目</EmptyTitle>
            <EmptyDescription>
              换个关键词或状态试试，或清除筛选查看全部项目。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" onClick={onClearFilters}>
              清除筛选
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    return (
      <Empty className="border border-dashed py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderKanban aria-hidden />
          </EmptyMedia>
          <EmptyTitle>还没有项目</EmptyTitle>
          <EmptyDescription>
            创建第一个 Project 开始管理产品，或等待成员邀请加入。
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link to="/projects/new" />}>
            创建项目
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>Project ID</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead className="text-end">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.projectId}>
              <TableCell className="max-w-56 sm:max-w-72">
                <button
                  type="button"
                  className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  onClick={() => navigate(`/projects/${project.projectId}/overview`)}
                >
                  <span className="font-medium line-clamp-1">{project.projectName}</span>
                </button>
                {project.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {project.description}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 max-w-44">
                  <code className="text-xs font-mono truncate" title={project.projectId}>
                    {project.projectId}
                  </code>
                  <CopyIdButton value={project.projectId} label="Project ID" />
                </div>
              </TableCell>
              <TableCell>
                <RoleBadge role={project.myRole} />
              </TableCell>
              <TableCell>
                <ProjectStatusBadge status={project.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                {formatEpoch(project.createTime)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                {formatEpoch(project.updateTime)}
              </TableCell>
              <TableCell className="text-end">
                <div className="inline-flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="hidden sm:inline-flex"
                    onClick={() => navigate(`/projects/${project.projectId}/overview`)}
                  >
                    打开
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${project.projectName}`}
                        >
                          <EllipsisVertical aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-40">
                      <DropdownMenuItem
                        onClick={() => navigate(`/projects/${project.projectId}/overview`)}
                      >
                        <FolderOpen aria-hidden />
                        打开工作区
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {loadMoreError ? (
        <ApiErrorAlert
          code={
            loadMoreError instanceof OpenPlatformApiError ? loadMoreError.code : undefined
          }
          message={loadMoreError.message}
          onRetry={onLoadMore}
        />
      ) : null}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
