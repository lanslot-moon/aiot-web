import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Plus, SearchIcon, X } from 'lucide-react';

import { ProjectListTable } from '@/components/open-platform/project-list-table';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  openPlatformGetFetcher,
  projectsListKey,
  useOpenPlatform,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import type { CursorResult, ProjectView } from '@/types/apps/open-platform';

const BCrumb = [
  { to: '/', title: 'Home' },
  { title: 'Projects' },
];

const STATUS_ALL = 'ALL';
const STATUS_OPTIONS = ['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'CLOSED'] as const;

const ProjectsListPage = () => {
  const [searchParams] = useSearchParams();
  const {
    projects,
    nextCursor,
    hasMore,
    listLoading,
    listError,
    listFilters,
    setListFilters,
    mutateProjects,
  } = useOpenPlatform();

  const [keywordDraft, setKeywordDraft] = useState(listFilters.keyword ?? '');
  const [extraItems, setExtraItems] = useState<ProjectView[]>([]);
  const [moreMeta, setMoreMeta] = useState<{
    nextCursor: string | null;
    hasMore: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);

  const filterKey = `${listFilters.keyword ?? ''}|${listFilters.status ?? ''}|${listFilters.pageSize ?? ''}`;

  useEffect(() => {
    setKeywordDraft(listFilters.keyword ?? '');
  }, [listFilters.keyword]);

  useEffect(() => {
    setExtraItems([]);
    setMoreMeta(null);
    setLoadMoreError(null);
  }, [filterKey]);

  // Optional SPA ?pageSize= for QA (formal list query already supports pageSize).
  useEffect(() => {
    const raw = searchParams.get('pageSize');
    if (!raw) return;
    const pageSize = Number(raw);
    if (!Number.isFinite(pageSize) || pageSize < 1) return;
    setListFilters((prev) => {
      if (prev.pageSize === pageSize && !prev.cursor) return prev;
      return { ...prev, pageSize, cursor: undefined };
    });
  }, [searchParams, setListFilters]);

  // Drop stale cursor so first-page SWR key stays filter-only.
  useEffect(() => {
    if (!listFilters.cursor) return;
    setListFilters((prev) => {
      if (!prev.cursor) return prev;
      const { cursor: _cursor, ...rest } = prev;
      return rest;
    });
  }, [listFilters.cursor, setListFilters]);

  const displayProjects = useMemo(
    () => (extraItems.length > 0 ? [...projects, ...extraItems] : projects),
    [projects, extraItems],
  );
  const displayHasMore = moreMeta?.hasMore ?? hasMore;
  const displayNextCursor = moreMeta?.nextCursor ?? nextCursor;

  const hasActiveFilters = Boolean(listFilters.keyword || listFilters.status);

  const applyKeyword = useCallback(
    (raw: string) => {
      const keyword = raw.trim() ? raw.trim() : undefined;
      setListFilters((prev) => ({
        ...prev,
        keyword,
        cursor: undefined,
      }));
    },
    [setListFilters],
  );

  const handleStatusChange = (value: string | null) => {
    const next = value && value !== STATUS_ALL ? value : undefined;
    setListFilters((prev) => ({
      ...prev,
      status: next,
      cursor: undefined,
    }));
  };

  const clearFilters = () => {
    setKeywordDraft('');
    setListFilters((prev) => ({
      pageSize: prev.pageSize ?? 20,
    }));
  };

  const handleRetry = async () => {
    setExtraItems([]);
    setMoreMeta(null);
    setLoadMoreError(null);
    await mutateProjects();
  };

  const handleLoadMore = async () => {
    if (!displayNextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const data = await openPlatformGetFetcher<CursorResult<ProjectView>>(
        projectsListKey({
          pageSize: listFilters.pageSize,
          keyword: listFilters.keyword,
          status: listFilters.status,
          cursor: displayNextCursor,
        }),
      );
      setExtraItems((prev) => [...prev, ...data.items]);
      setMoreMeta({ nextCursor: data.nextCursor, hasMore: data.hasMore });
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err : new Error('Failed to load more'));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Projects" items={BCrumb} />
      <StyleDivider />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                Manage Account projects. Open a workspace to work with members, API
                authorization, and thing models.
              </CardDescription>
            </div>
            <Button
              nativeButton={false}
              render={<Link to="/projects/new" />}
              className="shrink-0 self-start"
            >
              <Plus aria-hidden />
              Create Project
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:max-w-72">
              <SearchIcon
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden
              />
              <Input
                value={keywordDraft}
                onChange={(e) => {
                  const value = e.target.value;
                  setKeywordDraft(value);
                  applyKeyword(value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyKeyword(keywordDraft);
                }}
                placeholder="Search by name or Project ID…"
                className="pl-8"
                aria-label="Filter projects by keyword"
              />
            </div>

            <Select
              value={listFilters.status ?? STATUS_ALL}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>

          <ProjectListTable
            projects={displayProjects}
            loading={listLoading}
            error={listError}
            hasActiveFilters={hasActiveFilters}
            hasMore={displayHasMore}
            loadingMore={loadingMore}
            loadMoreError={loadMoreError}
            onRetry={handleRetry}
            onLoadMore={handleLoadMore}
            onClearFilters={clearFilters}
          />
        </CardContent>
      </Card>
    </StyleAwareWrapper>
  );
};

export default ProjectsListPage;
