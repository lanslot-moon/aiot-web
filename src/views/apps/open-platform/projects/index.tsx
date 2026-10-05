import { SearchIcon, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useIam } from '../../../../context/iam-context/identity';


import { CreateProjectAction } from '@/components/iam/create-project-action';
import { ProjectListTable } from '@/components/open-platform/project-list-table';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
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
import { openPlatformGetFetcher, projectsListKey, useOpenPlatform } from '../../../../context/open-platform-context/project-resources';

import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { PROJECT_STATUS_LABEL } from '@/lib/open-platform-labels';
import type { CursorResult, ProjectView } from '@/types/apps/open-platform';

const STATUS_ALL = 'ALL';
const STATUS_OPTIONS = ['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'CLOSED'] as const;

const ProjectsListPage = () => {
  const { authorization } = useIam();
  const canCreate = authorization.data?.permissionCodes.includes('project:create') ?? false;
  useEffect(() => { document.title = '全部项目 · AIoT'; }, []);
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

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);
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
      const next = { ...prev };
      delete next.cursor;
      return next;
    });
  }, [listFilters.cursor, setListFilters]);

  const displayProjects = useMemo(
    () => (extraItems.length > 0 ? [...projects, ...extraItems] : projects),
    [projects, extraItems],
  );
  const displayHasMore = moreMeta?.hasMore ?? hasMore;
  const displayNextCursor = moreMeta?.nextCursor ?? nextCursor;

  const hasActiveFilters = Boolean(listFilters.keyword || listFilters.status);

  const commitKeyword = useCallback(
    (raw: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const keyword = raw.trim() ? raw.trim() : undefined;
      setListFilters((prev) => ({
        ...prev,
        keyword,
        cursor: undefined,
      }));
    },
    [setListFilters],
  );

  const applyKeyword = (raw: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => commitKeyword(raw), 300);
  };

  const handleStatusChange = (value: string | null) => {
    const next = value && value !== STATUS_ALL ? value : undefined;
    setListFilters((prev) => ({
      ...prev,
      status: next,
      cursor: undefined,
    }));
  };

  const clearFilters = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
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
      lyraClassName="flex flex-col gap-px bg-border p-px"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="全部项目" items={[]} />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>项目</CardTitle>
              <CardDescription>
                进入项目管理产品、成员与 API 授权；账号设置在平台范围共用。
              </CardDescription>
            </div>
            {canCreate && <CreateProjectAction />}
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
                id="project-list-search"
                value={keywordDraft}
                onChange={(e) => {
                  const value = e.target.value;
                  setKeywordDraft(value);
                  if (!composing.current) applyKeyword(value);
                }}
                onCompositionStart={() => { composing.current = true; if (searchTimer.current) clearTimeout(searchTimer.current); }}
                onCompositionEnd={(event) => { composing.current = false; applyKeyword(event.currentTarget.value); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitKeyword(keywordDraft);
                }}
                placeholder="搜索名称或 Project ID…"
                className="!pr-8 !pl-8"
                aria-label="按关键词筛选项目"
              />
              {keywordDraft && <Button type="button" variant="ghost" size="icon" aria-label="清除项目搜索"
                className="absolute right-0 top-0 size-9" onClick={() => {
                  setKeywordDraft(''); commitKeyword(''); document.getElementById('project-list-search')?.focus();
                }}><X className="size-4" /></Button>}
            </div>

            <Select
              value={listFilters.status ?? STATUS_ALL}
              onValueChange={handleStatusChange}
              items={[{ value: STATUS_ALL, label: '全部状态' }, ...STATUS_OPTIONS.map((value) => ({ value, label: PROJECT_STATUS_LABEL[value] }))]}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="按状态筛选">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>全部状态</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PROJECT_STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X aria-hidden />
                清除筛选
              </Button>
            ) : null}
          </div>

          <ProjectListTable
            projects={displayProjects}
            canCreate={canCreate}
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
