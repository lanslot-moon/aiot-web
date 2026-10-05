import { useState } from 'react';
import { segment } from '@/api/iam/client';
import { createRole } from '@/api/iam/authorization';
import type { PermissionModuleVO, RoleVO } from '@/api/iam/contracts';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldsForm, ErrorNotice, Loading } from './shared';
import { useResource } from './shared-utils';
import { PermissionPicker } from './permission-picker';

export function RoleCreateForm({ owner, onCreated, submitLabel = '创建角色', onDirtyChange, onBusyChange }: {
  owner: string; onCreated: (role: RoleVO) => void; submitLabel?: string; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Shared built-in templates expose the authoritative selectable tree before a new role exists.
  const tree = useResource<PermissionModuleVO[]>(owner ? `/api/v1/authorization-owners/${segment(owner)}/roles/PROJECT_OWNER/permission-tree` : null, 'platform-role:view');
  return <FieldsForm fields={[
    { name: 'roleName', label: '角色名称', required: true, maxLength: 128, hint: '例如：设备运维、项目观察员。' },
    { name: 'description', label: '角色用途', type: 'textarea', maxLength: 512 },
  ]} label={submitLabel}
    onDirtyChange={onDirtyChange} onBusyChange={(value) => { setBusy(value); onBusyChange?.(value); }}
    submitDisabled={!tree.data?.length || !!tree.error || !codes.length}
    onSave={async (values) => {
      const role = await createRole(owner, { roleName: values.roleName.trim(), description: values.description.trim() || undefined, roleCode: `role-${crypto.randomUUID()}`, permissionCodes: codes });
      onCreated(role);
    }}>
    <ErrorNotice error={tree.error} retry={() => tree.mutate()} />
    {!tree.data && !tree.error ? <Loading /> : tree.data && <PermissionPicker tree={tree.data} codes={codes} onChange={(next) => { setCodes(next); onDirtyChange?.(true); }} disabled={busy} />}
    {!codes.length && <p className="text-xs text-muted-foreground">至少选择一项权限。</p>}
    <p className="text-xs text-muted-foreground">保存到角色目录后可重复使用。创建角色不会授予任何成员权限；取消后续邀请也会保留已保存的角色。</p>
  </FieldsForm>;
}

export function RoleCreateAction({ owner, onCreated, label = '创建角色', disabled = false }: { disabled?: boolean; owner: string; onCreated: (role: RoleVO) => void; label?: string }) {
  const { account } = useIam();
  const allowed = usePermission('platform-role:create');
  const canRead = usePermission('platform-role:view');
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  function close() { if (!busy) { if (dirty) setDiscard(true); else setOpen(false); } }
  return <>
    <Button type="button" variant="outline" disabled={disabled || !allowed || !canRead || owner !== account.data?.accountId} title={!allowed ? '需要创建角色的权限' : undefined} onClick={() => { setDirty(false); setOpen(true); }}>{label}</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl!">
      <DialogHeader><DialogTitle>创建角色</DialogTitle><DialogDescription>定义职责，按功能树选择能力。项目角色可跨项目复用，每次授权分别绑定项目。</DialogDescription></DialogHeader>
      {open && <RoleCreateForm owner={owner} submitLabel="创建角色" onDirtyChange={setDirty} onBusyChange={setBusy} onCreated={(role) => { setOpen(false); onCreated(role); }} />}
      <DialogFooter><Button variant="ghost" disabled={busy} onClick={close}>取消</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={discard} onOpenChange={setDiscard}><DialogContent><DialogHeader><DialogTitle>放弃角色草稿？</DialogTitle><DialogDescription>本次角色信息与权限选择尚未保存。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscard(false)}>继续编辑</Button><Button variant="destructive" onClick={() => { setDiscard(false); setOpen(false); }}>放弃修改</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
