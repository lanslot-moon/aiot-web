import type { PermissionDescriptorVO, RoleVO } from '@/api/iam/contracts';
import { segment } from '@/api/iam/client';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { useResource } from './shared-utils';
import { ErrorNotice, Loading } from './shared';
import { permissionResourceName } from './permission-labels';

export function RolePreview({ role }: { role: RoleVO }) {
  const { account } = useIam();
  const readable = usePermission('platform-role:view');
  const own = !!account.data && (role.ownerAccountId === account.data.accountId || role.builtIn);
  const permissions = useResource<string[]>(readable && own && !role.permissionCodes ? `/api/v1/authorization-owners/${segment(account.data?.accountId ?? '')}/roles/${segment(role.roleId)}/permissions` : null, 'platform-role:view');
  const catalog = useResource<PermissionDescriptorVO[]>(readable ? '/api/v1/permission-catalog' : null);
  const codes = role.permissionCodes ?? permissions.data;
  const resources = [...new Set((codes ?? []).map((code) => catalog.data?.find((item) => item.permissionCode === code)?.resourceTypeCode ?? code.split(':')[0].replace(/-/g, '_').toUpperCase()))];
  return <section className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm" aria-label="角色权限预览" aria-live="polite">
    <p className="font-medium">{role.roleName}</p>
    {role.description && <p className="text-muted-foreground">{role.description}</p>}
    <p className="text-xs">生效范围：当前项目。角色模板可在其他项目复用，授权分别生效。</p>
    <ErrorNotice error={permissions.error} retry={() => permissions.mutate()} />
    {permissions.isLoading ? <Loading /> : codes ? <>
      <p className="text-xs text-muted-foreground">包含 {codes.length} 项操作权限</p>
      <div className="flex flex-wrap gap-2">{resources.map((resource) => <span key={resource} className="rounded-md border bg-background px-2 py-1 text-xs">{permissionResourceName(resource)}</span>)}</div>
      <details><summary className="cursor-pointer text-xs focus-visible:outline focus-visible:outline-ring">查看完整权限</summary><ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">{codes.map((code) => <li key={code}>{catalog.data?.find((item) => item.permissionCode === code)?.permissionName ?? code}</li>)}</ul></details>
    </> : !permissions.error && <p className="text-xs text-muted-foreground">角色目录未提供权限明细。可核对角色用途；详细配置由角色所有者管理。</p>}
  </section>;
}
