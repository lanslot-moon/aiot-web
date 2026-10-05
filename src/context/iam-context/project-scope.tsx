import { getCurrentAuthorization } from '@/api/iam/authorization';
import type { CurrentAuthorizationVO } from '@/api/iam/contracts';
import { projectIdFromPath } from '@/components/iam/menu-navigation';
import { type ReactNode } from 'react';
import { useLocation } from 'react-router';
import useSWR from 'swr';
import { IdentityContext, useIam } from './identity';

import { ProjectScopeContext } from './project-scope-context';

export function ProjectScopeProvider({ children }: { children: ReactNode }) {
  const identity = useIam();
  const { pathname } = useLocation();
  const projectId = projectIdFromPath(pathname);
  const authorization = useSWR<CurrentAuthorizationVO>(
    identity.session && projectId ? [`/api/v1/projects/${encodeURIComponent(projectId)}/current-authorization`, identity.session.sessionId, 'project-authorization'] : null,
    () => getCurrentAuthorization(projectId),
    { shouldRetryOnError: false, keepPreviousData: false },
  );
  return <ProjectScopeContext.Provider value={projectId ? authorization : null}>
    <IdentityContext.Provider value={{ ...identity, authorization: projectId ? authorization : identity.platformAuthorization }}>
      {children}
    </IdentityContext.Provider>
  </ProjectScopeContext.Provider>;
}
