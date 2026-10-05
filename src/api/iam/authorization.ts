import { get, post, remove, request, segment } from './client';
import type { CurrentAuthorizationVO, CursorResult, PermissionCheckRequest, RoleBindingCreateRequest, RoleBindingListRequest, RoleBindingVO, RoleCreateRequest, RoleVO } from './contracts';

export const ownerMenusPath = (ownerAccountId: string) =>
  `/api/v1/authorization-owners/${segment(ownerAccountId)}/menus`;

/** Global capabilities are supplied by IAM; only project responses carry roles. */
export async function getCurrentAuthorization(projectId?: string): Promise<CurrentAuthorizationVO> {
  if (projectId !== undefined && !/^\S{1,64}$/.test(projectId)) throw new Error('项目标识不能为空或包含空格。');
  const path = projectId === undefined ? '/api/v1/current-authorization' : `/api/v1/projects/${segment(projectId)}/current-authorization`;
  const data = await request<CurrentAuthorizationVO>(path, 'GET', undefined, { projectId });
  if (data.projectId !== (projectId ?? null)) throw new Error('授权上下文不匹配，请重新加载。');
  return data;
}

export function createRole(ownerAccountId: string, body: RoleCreateRequest) {
  return post<RoleVO>(`/api/v1/authorization-owners/${segment(ownerAccountId)}/roles`, body);
}

export function listRoleBindings(ownerAccountId: string, query: RoleBindingListRequest) {
  const params = new URLSearchParams({ projectId: query.projectId });
  if (query.status) params.set('status', query.status);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  return get<CursorResult<RoleBindingVO>>(`/api/v1/authorization-owners/${segment(ownerAccountId)}/role-bindings?${params}`);
}

export function createRoleBinding(ownerAccountId: string, body: RoleBindingCreateRequest) {
  return post<RoleBindingVO>(`/api/v1/authorization-owners/${segment(ownerAccountId)}/role-bindings`, body);
}

/** Backend serializes the Long primary key as a string; never coerce it to Number. */
export function revokeRoleBinding(ownerAccountId: string, id: string) {
  return remove<void>(`/api/v1/authorization-owners/${segment(ownerAccountId)}/role-bindings/${segment(id)}`);
}

// The public request still declares scope fields, but the service only consumes
// permissionCode and tenantId. Project IDs must never be substituted for tenant IDs.
export function checkPermission(body: PermissionCheckRequest) {
  return post<boolean>('/api/v1/permissions/checks', body);
}

/** Role-template changes can affect every project using that template. */
export function isProjectRoleCacheKey(key: unknown): boolean {
  const path = Array.isArray(key) ? key[0] : key;
  return typeof path === 'string' && /^\/api\/v1\/projects\/[^/?]+\/(current-authorization|available-roles|members)(?:[/?]|$)/.test(path);
}
