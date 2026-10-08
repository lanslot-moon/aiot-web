import { get, getSession, request, OpenPlatformApiError } from '@/api/iam/client';
import type { ProjectDetailVO, TokenVO } from '@/api/iam/contracts';
import { createContext, useContext } from 'react';
import {
type CreateProjectRequest,
type CreateProjectResult,
type CursorResult,
type ProjectView,
} from 'src/types/apps/open-platform';
import useSWR from 'swr';
import { useIam } from '../iam-context/identity';


export type ProjectListFilters = {
  cursor?: string;
  pageSize?: number;
  keyword?: string;
  status?: string;
};

export function projectsListKey(filters: ProjectListFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `/api/v1/projects?${qs}` : '/api/v1/projects';
}

export function projectDetailKey(projectId: string): string {
  return `/api/v1/projects/${projectId}`;
}

export { OpenPlatformApiError } from '@/api/iam/client';

export const getStoredAccessToken = () => getSession()?.accessToken ?? null;

function projectRequest<T>(path: string, method: string, body?: unknown) {
  // These resource endpoints have no project path variable. The header selects
  // context only; the gateway still verifies membership and scoped capabilities.
  const domainResource = /^\/api\/v1\/(products|categories|parser-profiles|devices|credentials|credential-batches|credential-distributions|credential-exports|pre-registrations|rotation-tasks)(?:\/|\?|$)/.test(path);
  const projectId = domainResource ? window.location.pathname.match(/^\/projects\/([^/]+)/)?.[1] : undefined;
  return request<T>(path, method, body, { projectId: projectId ? decodeURIComponent(projectId) : undefined });
}
export const openPlatformGetFetcher = <T>(path: string) => projectRequest<T>(path, 'GET');
export const openPlatformPost = <T>(path: string, body?: unknown) => projectRequest<T>(path, 'POST', body);
export const openPlatformPut = <T>(path: string, body: unknown) => projectRequest<T>(path, 'PUT', body);
export const openPlatformDelete = <T>(path: string, body?: unknown) => projectRequest<T>(path, 'DELETE', body);

export interface OpenPlatformContextType {
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (tokens: TokenVO | null) => void;
  clearSession: () => void;

  listFilters: ProjectListFilters;
  setListFilters: (
    next: ProjectListFilters | ((prev: ProjectListFilters) => ProjectListFilters),
  ) => void;
  projects: ProjectView[];
  nextCursor: string | null;
  hasMore: boolean;
  listLoading: boolean;
  listError: Error | null;
  mutateProjects: () => Promise<CursorResult<ProjectView> | undefined>;

  createProject: (body: CreateProjectRequest) => Promise<CreateProjectResult>;
  activateProject: (projectId: string) => Promise<boolean>;
  suspendProject: (projectId: string) => Promise<boolean>;
  archiveProject: (projectId: string) => Promise<boolean>;
  closeProject: (projectId: string) => Promise<boolean>;
  updateProject: (
    projectId: string,
    body: { projectName?: string; description?: string },
  ) => Promise<boolean>;
}

export const OpenPlatformContext = createContext<OpenPlatformContextType | null>(null);

export function useOpenPlatform(): OpenPlatformContextType {
  const ctx = useContext(OpenPlatformContext);
  if (!ctx) {
    throw new Error('useOpenPlatform must be used within an OpenPlatformProvider');
  }
  return ctx;
}

export function useProjectDetail(projectId: string | undefined | null) {
  const { session, platformAuthorization } = useIam();
  const allowed = platformAuthorization.data?.permissionCodes.includes('project:view');
  const resource = useSWR<ProjectDetailVO>(session && allowed && projectId
    ? [projectDetailKey(projectId), session.sessionId, 'resource'] : null,
    ([path]) => get<ProjectDetailVO>(path),
    { shouldRetryOnError: false },
  );
  const project: ProjectView | undefined = resource.data?.project;
  return {
    ...resource,
    data: project,
    isLoading: resource.isLoading || (!!session && !!projectId && !platformAuthorization.data && !platformAuthorization.error),
    error: resource.error ?? platformAuthorization.error ?? (platformAuthorization.data && !allowed
      ? new OpenPlatformApiError('FORBIDDEN', '当前账号没有查看项目的权限。', 403) : undefined),
  };
}
