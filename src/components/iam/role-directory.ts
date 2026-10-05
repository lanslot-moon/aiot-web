import { get, segment } from '@/api/iam/client';
import type { CursorResult, RoleVO } from '@/api/iam/contracts';
import { useResource } from './shared-utils';

async function fetchDirectory(path: string): Promise<CursorResult<RoleVO>> {
  const items: RoleVO[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page: CursorResult<RoleVO> = await get(`${path}${cursor ? `${path.includes('?') ? '&' : '?'}cursor=${segment(cursor)}` : ''}`);
    items.push(...page.items);
    cursor = page.hasMore ? page.nextCursor : null;
    if (page.hasMore && !cursor) throw new Error('角色目录分页信息缺失，请重试。');
    if (cursor && cursors.has(cursor)) throw new Error('角色目录加载异常，请重试。');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return { items, hasMore: false, nextCursor: null };
}

export function useRoleDirectory(owner: string) {
  return useResource<CursorResult<RoleVO>>(owner ? `/api/v1/authorization-owners/${segment(owner)}/roles` : null, 'platform-role:view', fetchDirectory, 'directory');
}

export function useProjectRoleDirectory(projectId: string) {
  return useResource<CursorResult<RoleVO>>(projectId ? `/api/v1/projects/${segment(projectId)}/available-roles` : null, undefined, fetchDirectory, 'directory');
}
