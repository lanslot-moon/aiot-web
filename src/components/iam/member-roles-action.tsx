import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { put, segment } from '@/api/iam/client';
import type { ProjectMemberVO } from '@/api/iam/contracts';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProjectRoleDirectory } from './role-directory';
import { ErrorNotice, Loading } from './shared';
import { useDraftRegistration } from './drafts';
import { RolePreview } from './role-preview';

export function MemberRolesAction({ projectId, member, onSaved }: { projectId: string; member: ProjectMemberVO; onSaved: () => void }) {
  const allowed = usePermission('project-member:grant');
  const isOwner = member.roles?.some((role) => role.roleId === 'PROJECT_OWNER');
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" disabled={!allowed || isOwner || member.membershipStatus !== 'ACTIVE'} title={isOwner ? '项目所有者角色通过转移所有权管理' : !allowed ? '没有修改成员角色的权限' : undefined} onClick={() => setOpen(true)}>修改角色</Button>
    {open && <MemberRolesDialog projectId={projectId} member={member} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved(); }} />}
  </>;
}

function MemberRolesDialog({ projectId, member, onClose, onSaved }: { projectId: string; member: ProjectMemberVO; onClose: () => void; onSaved: () => void }) {
  const roles = useProjectRoleDirectory(projectId);
  const [ids, setIds] = useState((member.roles ?? []).map((role) => role.roleId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [discard, setDiscard] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const { authorization } = useIam();
  const { mutate } = useSWRConfig();
  const original = (member.roles ?? []).map((role) => role.roleId).sort().join(',');
  const dirty = [...ids].sort().join(',') !== original;
  useDraftRegistration(dirty && !busy);
  const available = (roles.data?.items ?? []).filter((role) => role.roleId !== 'PROJECT_OWNER');
  const unavailable = ids.filter((id) => !available.some((role) => role.roleId === id));
  function close() { if (!busy) { if (dirty) setDiscard(true); else onClose(); } }
  async function save() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await put(`/api/v1/projects/${segment(projectId)}/members/${segment(member.accountId)}/roles`, { roleIds: ids });
      void authorization.mutate();
      void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(`/api/v1/projects/${segment(projectId)}`));
      toast.success('项目角色已更新'); onSaved();
    } catch (failure) { setError(failure); setConfirmEmpty(false); }
    finally { setBusy(false); }
  }
  return <>
    <Dialog open onOpenChange={(next) => { if (!next) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl!"><DialogHeader><DialogTitle>修改 {member.username || member.accountId} 的角色</DialogTitle><DialogDescription>仅调整当前项目的授权。可选择多个角色，能力合并生效；其他项目保持独立。</DialogDescription></DialogHeader>
      <ErrorNotice error={roles.error} retry={() => roles.mutate()} /><ErrorNotice error={error} />
      {roles.error ? null : !roles.data ? <Loading /> : <div className="space-y-3">{available.map((role) => <div key={role.roleId} className="space-y-2 rounded-lg border p-3"><Label className="flex items-start gap-3"><Checkbox disabled={busy} checked={ids.includes(role.roleId)} onCheckedChange={(checked) => setIds((previous) => checked ? [...new Set([...previous, role.roleId])] : previous.filter((id) => id !== role.roleId))} /><span>{role.roleName}<span className="block text-xs font-normal text-muted-foreground">{role.description}</span></span></Label>{ids.includes(role.roleId) && <RolePreview role={role} />}</div>)}{!available.length && <p className="text-sm text-muted-foreground">暂无可用角色。</p>}
      {!!unavailable.length && <div className="space-y-2 text-sm"><p>以下原角色已不在可用目录中，请移除后重新选择：</p>{unavailable.map((id) => <Button key={id} variant="outline" disabled={busy} onClick={() => setIds((previous) => previous.filter((item) => item !== id))}>移除 {member.roles?.find((role) => role.roleId === id)?.roleName ?? id}</Button>)}</div>}
      </div>}
      {!ids.length && <p className="text-sm text-destructive">保存空选择将撤销此成员在当前项目的全部角色，成员关系仍保留。</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={close}>取消</Button><Button disabled={busy || !dirty || !roles.data || !!roles.error || !!unavailable.length} onClick={() => { if (!ids.length) setConfirmEmpty(true); else void save(); }}>{busy ? '正在保存…' : '保存角色'}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={confirmEmpty} onOpenChange={(next) => { if (!busy) setConfirmEmpty(next); }}><DialogContent><DialogHeader><DialogTitle>撤销全部项目角色？</DialogTitle><DialogDescription>该成员将失去当前项目角色提供的功能权限，成员关系仍保留。</DialogDescription></DialogHeader><DialogFooter><Button disabled={busy} variant="outline" onClick={() => setConfirmEmpty(false)}>返回选择</Button><Button disabled={busy} variant="destructive" onClick={() => void save()}>{busy ? '正在保存…' : '撤销项目角色'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={discard} onOpenChange={setDiscard}><DialogContent><DialogHeader><DialogTitle>放弃角色修改？</DialogTitle><DialogDescription>当前选择尚未保存。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscard(false)}>继续编辑</Button><Button variant="destructive" onClick={onClose}>放弃修改</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
