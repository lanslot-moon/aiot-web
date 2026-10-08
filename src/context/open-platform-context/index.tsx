import { useCallback, useMemo, useState, type ReactNode } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { OpenPlatformContext, OpenPlatformContextType, openPlatformGetFetcher, openPlatformPost, openPlatformPut, projectDetailKey, ProjectListFilters, projectsListKey } from './project-resources';

import { setSession as saveSession } from '@/api/iam/client';
import type { TokenVO } from '@/api/iam/contracts';
import {
type CreateProjectRequest,
type CreateProjectResult,
type CursorResult,
type ProjectView,
} from 'src/types/apps/open-platform';
import { useIam } from '../iam-context/identity';


export const OpenPlatformProvider = ({ children }: { children: ReactNode }) => {
  const { mutate: globalMutate } = useSWRConfig();
  const { session, authorization } = useIam();
  const accessToken = session?.accessToken ?? null;
  const refreshToken = session?.refreshToken ?? null;
  const [listFilters, setListFilters] = useState<ProjectListFilters>({});

  const listKey = useMemo(() => projectsListKey(listFilters), [listFilters]);

  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate: mutateProjects,
  } = useSWR<CursorResult<ProjectView>>(
    accessToken && authorization.data?.permissionCodes.includes('project:view')
      ? [listKey, session?.sessionId]
      : null,
    ([path]) => openPlatformGetFetcher(path),
    { shouldRetryOnError: false },
  );

  const setSession = useCallback((tokens: TokenVO | null) => {
    saveSession(tokens);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, [setSession]);

  const revalidateProjectQueries = useCallback(
    async (projectId?: string) => {
      await mutateProjects();
      if (projectId) {
        await globalMutate((key) => Array.isArray(key) && key[0] === projectDetailKey(projectId));
      } else {
        await globalMutate((key) => (typeof key === 'string' ? key : Array.isArray(key) ? String(key[0]) : '').startsWith('/api/v1/projects'));
      }
    },
    [globalMutate, mutateProjects],
  );

  const createProject = useCallback(
    async (body: CreateProjectRequest) => {
      const result = await openPlatformPost<CreateProjectResult>('/api/v1/projects', body);
      await revalidateProjectQueries(result.project.projectId);
      return result;
    },
    [revalidateProjectQueries],
  );

  const postLifecycle = useCallback(
    async (projectId: string, action: 'activate' | 'suspend' | 'archive' | 'close') => {
      const status = {
        activate: 'ACTIVE',
        suspend: 'SUSPENDED',
        archive: 'ARCHIVED',
        close: 'CLOSED',
      }[action];
      await openPlatformPut(`/api/v1/projects/${projectId}/lifecycle`, {
        status,
        confirm: action === 'close',
      });
      await revalidateProjectQueries(projectId);
      return true;
    },
    [revalidateProjectQueries],
  );

  const activateProject = useCallback(
    (projectId: string) => postLifecycle(projectId, 'activate'),
    [postLifecycle],
  );
  const suspendProject = useCallback(
    (projectId: string) => postLifecycle(projectId, 'suspend'),
    [postLifecycle],
  );
  const archiveProject = useCallback(
    (projectId: string) => postLifecycle(projectId, 'archive'),
    [postLifecycle],
  );
  const closeProject = useCallback(
    (projectId: string) => postLifecycle(projectId, 'close'),
    [postLifecycle],
  );

  const updateProject = useCallback(
    async (projectId: string, body: { projectName?: string; description?: string }) => {
      await openPlatformPut(`/api/v1/projects/${projectId}`, body);
      await revalidateProjectQueries(projectId);
      return true;
    },
    [revalidateProjectQueries],
  );

  const value: OpenPlatformContextType = {
    accessToken,
    refreshToken,
    setSession,
    clearSession,
    listFilters,
    setListFilters,
    projects: listData?.items ?? [],
    nextCursor: listData?.nextCursor ?? null,
    hasMore: listData?.hasMore ?? false,
    listLoading: listLoading || (!!session && !authorization.data && !authorization.error),
    listError: listError ?? authorization.error ?? null,
    mutateProjects,
    createProject,
    activateProject,
    suspendProject,
    archiveProject,
    closeProject,
    updateProject,
  };

  return <OpenPlatformContext.Provider value={value}>{children}</OpenPlatformContext.Provider>;
};
