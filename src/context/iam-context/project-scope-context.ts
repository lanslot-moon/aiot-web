import { createContext, useContext } from 'react';
import type { SWRResponse } from 'swr';
import type { CurrentAuthorizationVO, ProjectDetailVO } from '@/api/iam/contracts';
export const ProjectScopeContext = createContext<SWRResponse<CurrentAuthorizationVO> | null>(null);
export function useProjectAuthorization() { return useContext(ProjectScopeContext); }
export const ProjectDetailContext = createContext<SWRResponse<ProjectDetailVO> | null>(null);
export function useProjectDetail() { return useContext(ProjectDetailContext); }
