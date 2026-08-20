import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';

import {
  REST_SUCCESS_CODE,
  type CreateProjectRequest,
  type CreateProjectResult,
  type CursorResult,
  type ProjectView,
  type RestResult,
  type TokenResponse,
} from 'src/types/apps/open-platform';

const ACCESS_TOKEN_KEY = 'open-platform:accessToken';
const REFRESH_TOKEN_KEY = 'open-platform:refreshToken';

export type ProjectListFilters = {
  cursor?: string;
  pageSize?: number;
  keyword?: string;
  status?: string;
};

export function projectsListKey(filters: ProjectListFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.pageSize != null) params.set('pageSize', String(filters.pageSize));
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `/api/v1/projects?${qs}` : '/api/v1/projects';
}

export function projectDetailKey(projectId: string): string {
  return `/api/v1/projects/${projectId}`;
}

function readSessionToken(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionToken(key: string, value: string | null) {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage may be unavailable; in-memory state still works
  }
}

export function getStoredAccessToken(): string | null {
  return readSessionToken(ACCESS_TOKEN_KEY);
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getStoredAccessToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export class OpenPlatformApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OpenPlatformApiError';
    this.code = code;
  }
}

function unwrapRest<T>(payload: RestResult<T>): T {
  if (payload?.code !== REST_SUCCESS_CODE) {
    throw new OpenPlatformApiError(
      payload?.code ?? 'UNKNOWN',
      payload?.message ?? 'Request failed',
    );
  }
  return payload.data;
}

async function parseJson<T>(res: Response): Promise<RestResult<T>> {
  const json = (await res.json()) as RestResult<T>;
  if (!res.ok && json?.code == null) {
    throw new OpenPlatformApiError(String(res.status), res.statusText || 'Request failed');
  }
  return json;
}

/** GET fetcher that attaches Bearer when present and unwraps RestResult. */
export async function openPlatformGetFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: authHeaders(),
  });
  const json = await parseJson<T>(res);
  return unwrapRest(json);
}

async function openPlatformPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  });
  const json = await parseJson<T>(res);
  return unwrapRest(json);
}

async function openPlatformPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  });
  const json = await parseJson<T>(res);
  return unwrapRest(json);
}

export interface OpenPlatformContextType {
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (tokens: TokenResponse | null) => void;
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

const OpenPlatformContext = createContext<OpenPlatformContextType | null>(null);

export const OpenPlatformProvider = ({ children }: { children: ReactNode }) => {
  const { mutate: globalMutate } = useSWRConfig();
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    readSessionToken(ACCESS_TOKEN_KEY),
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    readSessionToken(REFRESH_TOKEN_KEY),
  );
  const [listFilters, setListFilters] = useState<ProjectListFilters>({
    pageSize: 20,
  });

  const listKey = useMemo(() => projectsListKey(listFilters), [listFilters]);

  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate: mutateProjects,
  } = useSWR<CursorResult<ProjectView>>(listKey, openPlatformGetFetcher);

  const setSession = useCallback((tokens: TokenResponse | null) => {
    if (!tokens) {
      writeSessionToken(ACCESS_TOKEN_KEY, null);
      writeSessionToken(REFRESH_TOKEN_KEY, null);
      setAccessToken(null);
      setRefreshToken(null);
      return;
    }
    writeSessionToken(ACCESS_TOKEN_KEY, tokens.accessToken);
    writeSessionToken(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, [setSession]);

  const revalidateProjectQueries = useCallback(
    async (projectId?: string) => {
      await mutateProjects();
      if (projectId) {
        await globalMutate(projectDetailKey(projectId));
      } else {
        await globalMutate(
          (key) => typeof key === 'string' && key.startsWith('/api/v1/projects'),
        );
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
      const ok = await openPlatformPost<boolean>(
        `/api/v1/projects/${projectId}/${action}`,
        {},
      );
      await revalidateProjectQueries(projectId);
      return ok;
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
    async (
      projectId: string,
      body: { projectName?: string; description?: string },
    ) => {
      const ok = await openPlatformPut<boolean>(`/api/v1/projects/${projectId}`, body);
      await revalidateProjectQueries(projectId);
      return ok;
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
    listLoading,
    listError: listError ?? null,
    mutateProjects,
    createProject,
    activateProject,
    suspendProject,
    archiveProject,
    closeProject,
    updateProject,
  };

  return (
    <OpenPlatformContext.Provider value={value}>{children}</OpenPlatformContext.Provider>
  );
};

export function useOpenPlatform(): OpenPlatformContextType {
  const ctx = useContext(OpenPlatformContext);
  if (!ctx) {
    throw new Error('useOpenPlatform must be used within an OpenPlatformProvider');
  }
  return ctx;
}

/** Detail SWR helper — call from project workspace pages. */
export function useProjectDetail(projectId: string | undefined | null) {
  return useSWR<ProjectView>(
    projectId ? projectDetailKey(projectId) : null,
    openPlatformGetFetcher,
  );
}
