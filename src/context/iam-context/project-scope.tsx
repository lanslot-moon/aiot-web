import { getCurrentAuthorization } from '@/api/iam/authorization';
import type { CurrentAuthorizationVO, ProjectDetailVO } from '@/api/iam/contracts';
import { get, segment } from '@/api/iam/client';
import { projectIdFromPath } from '@/components/iam/menu-navigation';
import { type ReactNode } from 'react';
import { useLocation } from 'react-router';
import useSWR from 'swr';
import { IdentityContext, useIam } from './identity';

import { ProjectDetailContext, ProjectScopeContext } from './project-scope-context';

export function ProjectScopeProvider({ children }: { children: ReactNode }) {
  const identity = useIam();
  const { pathname } = useLocation();
  const projectId = projectIdFromPath(pathname);
  const detail = useSWR<ProjectDetailVO>(
    identity.session && projectId && identity.platformAuthorization.data?.permissionCodes.includes('project:view')
      ? [`/api/v1/projects/${segment(projectId)}`, identity.session.sessionId, 'resource'] : null,
    ([path]) => get<ProjectDetailVO>(path),
    { shouldRetryOnError: false, keepPreviousData: false },
  );
  // 先读取生命周期，非活跃项目不再请求业务权限。
  const authorization = useSWR<CurrentAuthorizationVO>(
    identity.session && projectId && detail.data?.project.status === 'ACTIVE' ? [`/api/v1/projects/${encodeURIComponent(projectId)}/current-authorization`, identity.session.sessionId, 'project-authorization'] : null,
    () => getCurrentAuthorization(projectId),
    { shouldRetryOnError: false, keepPreviousData: false },
  );
  return <ProjectDetailContext.Provider value={projectId ? detail : null}><ProjectScopeContext.Provider value={projectId ? authorization : null}>
    <IdentityContext.Provider value={{ ...identity, authorization: projectId ? authorization : identity.platformAuthorization }}>
      {children}
    </IdentityContext.Provider>
  </ProjectScopeContext.Provider></ProjectDetailContext.Provider>;
}
