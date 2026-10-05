import { createContext, useContext } from 'react';
import type { SWRResponse } from 'swr';
import type { CurrentAuthorizationVO } from '@/api/iam/contracts';
export const ProjectScopeContext = createContext<SWRResponse<CurrentAuthorizationVO> | null>(null);
export function useProjectAuthorization() { return useContext(ProjectScopeContext); }
