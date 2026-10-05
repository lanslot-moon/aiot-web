import { get, put, remove, segment } from '@/api/iam/client';
import type { PermissionDescriptorVO, PermissionModuleVO, RoleVO } from '@/api/iam/contracts';
import { isProjectRoleCacheKey, ownerMenusPath } from '@/api/iam/authorization';
import { SettingsNavigation } from '@/components/iam/settings-navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useIam } from '../../context/iam-context/identity';

import { useDraftRegistration } from '@/components/iam/drafts';
import { Action, CursorTable, DataTable, ErrorNotice, Loading, Page, Panel, Status } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { RoleCreateAction } from '@/components/iam/role-create-action';
import { PermissionPicker, MenuAccessPreview } from '@/components/iam/permission-picker';
import type { MenuVO } from '@/api/iam/contracts';
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';

import { toast } from 'sonner';
import { useResource } from '../../components/iam/shared-utils';
export default function RolesPage() {
  const { account, authorization } = useIam();
  const owner = account.data?.accountId || '';
  const base = `/api/v1/authorization-owners/${segment(owner)}`;
  const catalog = useResource<PermissionDescriptorVO[]>(
    '/api/v1/permission-catalog',
    'platform-role:view',
  );
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const menus = useResource<MenuVO[]>(owner ? ownerMenusPath(owner) : null, 'menu:view');
  const [selected, setSelected] = useState<RoleVO | null>(null);
  const tree = useResource<PermissionModuleVO[]>(selected ? `${base}/roles/${segment(selected.roleId)}/permission-tree` : null, 'platform-role:view');
  const [codes, setCodes] = useState<string[]>([]);
  const [originalCodes, setOriginalCodes] = useState<string[]>([]);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const dirty =
    !!selected && JSON.stringify([...codes].sort()) !== JSON.stringify([...originalCodes].sort());
  useDraftRegistration(dirty && !busy);
  function closePermissions() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else setSelected(null);
  }
  const { mutate } = useSWRConfig();
  const refresh = () => {
    void authorization.mutate();
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(base));
    void mutate(isProjectRoleCacheKey);
  };
  return (
    <Page breadcrumbs={[{ title: '控制台设置' }]} title="角色与权限" description="角色是可复用的权限组合：先定义职责与能力，再在项目邀请中选择角色。同一个角色可以授予多位成员。">
      <SettingsNavigation />

      {owner && (
        <>
          <Panel
            title="项目角色目录"
            description="项目角色可跨项目复用。修改模板会影响所有使用该角色的授权；仅调整某个项目时，请创建独立角色。"
            actions={
              <RoleCreateAction owner={owner} onCreated={refresh} />
            }
          >
            <ErrorNotice error={error} />
            <CursorTable<RoleVO>
              path={`${base}/roles`}
              permission="platform-role:view"
              columns={[
                {
                  label: '角色',
                  render: (row) => (
                    <div>
                      {row.roleName}
                      <p className="text-xs text-muted-foreground">
                        {row.roleCode}
                        {row.builtIn ? ' · 内置角色' : ''}
                      </p>
                    </div>
                  ),
                },
                { label: '适用范围', render: () => '项目 · 可复用' },
                { label: '说明', render: (row) => row.description ?? '—' },
                { label: '状态', render: (row) => <Status value={row.status} /> },
                {
                  label: '操作',
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" disabled={loadingRole !== null} onClick={async () => {
                        setLoadingRole(row.roleId);
                        setError(null);
                        try {
                          const [detail, permissions] = await Promise.all([
                            get<RoleVO>(`${base}/roles/${segment(row.roleId)}`),
                            get<string[]>(`${base}/roles/${segment(row.roleId)}/permissions`),
                          ]);
                          setCodes(permissions);
                          setOriginalCodes(permissions);
                          setSelected(detail);
                        } catch (failure) { setError(failure); }
                        finally { setLoadingRole(null); }
                      }}>{loadingRole === row.roleId ? '正在加载…' : '查看与配置权限'}</Button>
                      {!row.builtIn && (
                        <>
                          <Action
                            label="编辑角色"
                            permission="platform-role:update"
                            fields={[
                              { name: 'roleName', label: '角色名称', required: true },
                              { name: 'description', label: '说明', type: 'textarea' },
                              {
                                name: 'status',
                                label: '状态',
                                options: [
                                  { value: 'ACTIVE', label: '启用' },
                                  { value: 'DISABLED', label: '停用' },
                                ],
                              },
                            ]}
                            initial={{
                              roleName: row.roleName ?? '',
                              description: row.description ?? '',
                              status: row.status ?? 'ACTIVE',
                            }}
                            run={(values) =>
                              put(`${base}/roles/${segment(row.roleId ?? '')}`, values)
                            }
                            done={refresh}
                          />
                          <Action
                            label="删除角色"
                            permission="platform-role:delete"
                            danger
                            description={`删除「${row.roleName}」。仍有有效授权关系的角色无法删除。`}
                            run={() => remove(`${base}/roles/${segment(row.roleId ?? '')}`)}
                            done={refresh}
                          />
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Panel>

        </>
      )}
      <Accordion className="rounded-lg border bg-background">
        <AccordionItem value="permission-catalog">
          <AccordionTrigger className="px-4 py-4">
            <span>权限目录{catalog.data ? `（${catalog.data.length} 项）` : ''}</span>
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div className="max-h-96 overflow-auto">
        <ErrorNotice error={catalog.error} retry={() => catalog.mutate()} />
        {catalog.isLoading ? (
          <Loading />
        ) : (
          <DataTable
            rows={catalog.data ?? []}
            columns={[
              { label: '权限名称', render: (row) => row.permissionName },
              { label: '权限码', render: (row) => <code>{row.permissionCode}</code> },
              { label: '资源', render: (row) => row.resourceTypeCode },
              { label: '说明', render: (row) => row.description },
            ]}
          />
        )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) closePermissions();
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl!">
          <DialogHeader>
            <DialogTitle>{selected?.roleName} · 权限配置</DialogTitle>
            <DialogDescription>
              {selected?.builtIn
                ? '内置角色由平台维护，可查看权限。'
                : '保存会更新所有使用此角色的授权。若只调整某个项目，请取消并创建独立角色。'}
            </DialogDescription>
          </DialogHeader>
          <ErrorNotice error={tree.error} retry={() => tree.mutate()} />
          {!tree.data && !tree.error ? <Loading /> : tree.data && <PermissionPicker tree={tree.data} codes={codes} onChange={setCodes} disabled={!!selected?.builtIn || busy || !authorization.data?.permissionCodes.includes('platform-role:update')} />}
          {menus.data && <MenuAccessPreview codes={codes} menus={menus.data} />}
          <ErrorNotice error={menus.error} retry={() => menus.mutate()} />
          <ErrorNotice error={error} />
          {!selected?.builtIn && <Button type="button" disabled={busy || !dirty || !tree.data || !!tree.error || !authorization.data?.permissionCodes.includes('platform-role:update')} onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError(null);
            try {
              await put(`${base}/roles/${segment(selected?.roleId ?? '')}/permissions`, { permissionCodes: codes });
              setSelected(null);
              refresh();
              toast.success('权限已更新');
            } catch (failure) { setError(failure); }
            finally { setBusy(false); }
          }}>{busy ? '正在保存…' : `保存 ${codes.length} 项权限`}</Button>}
          <Button variant="ghost" disabled={busy} onClick={closePermissions}>
            关闭
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>放弃权限修改？</DialogTitle>
            <DialogDescription>本次勾选的权限尚未保存。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button autoFocus variant="outline" onClick={() => setDiscard(false)}>
              继续编辑
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscard(false);
                setSelected(null);
              }}
            >
              放弃修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
