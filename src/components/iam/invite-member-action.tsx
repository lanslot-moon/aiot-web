import { useEffect, useRef, useState } from 'react';
import { post, segment } from '@/api/iam/client';
import type { ProjectInvitationVO, RoleVO } from '@/api/iam/contracts';
import { useIam, usePermission } from '@/context/iam-context/identity';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldsForm, ErrorNotice, Loading } from './shared';
import { useProjectRoleDirectory } from './role-directory';
import { RoleCreateForm } from './role-create-action';
import { useDraftRegistration } from './drafts';
import { RolePreview } from './role-preview';

export function InviteMemberAction({ projectId, onCreated }: { projectId: string; onCreated: (invitation: ProjectInvitationVO) => void }) {
  const allowed = usePermission('project-member:invite');
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" disabled={!allowed} title={!allowed ? '当前账号没有邀请成员权限' : undefined} onClick={() => setOpen(true)}>邀请成员</Button>
    {open && <InviteDialog projectId={projectId} onClose={() => setOpen(false)} onCreated={(invitation) => { setOpen(false); onCreated(invitation); }} />}
  </>;
}

function InviteDialog({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: (invitation: ProjectInvitationVO) => void }) {
  const { account, authorization } = useIam();
  const canCreateRole = usePermission('platform-role:create');
  const canReadRole = usePermission('platform-role:view');
  const ownsProject = authorization.data?.roles.some((role) => role.roleId === 'PROJECT_OWNER');
  const roles = useProjectRoleDirectory(projectId);
  const [createdRoles, setCreatedRoles] = useState<RoleVO[]>([]);
  const [roleId, setRoleId] = useState('');
  const [method, setMethod] = useState<'email' | 'account'>('email');
  const [recipients, setRecipients] = useState({ email: '', account: '' });
  const [dirty, setDirty] = useState(false);
  const [roleDirty, setRoleDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [creating, setCreating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [creating]);
  const [revision, setRevision] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({ invitee: '', roleId: '', ttlHours: '72' });
  useDraftRegistration((dirty || roleDirty) && !busy);
  const available = [...createdRoles, ...(roles.data?.items ?? []).filter((item) => !createdRoles.some((created) => created.roleId === item.roleId))].filter((item) => item.status === 'ACTIVE' && item.roleId !== 'PROJECT_OWNER');
  const selected = available.find((role) => role.roleId === roleId);
  const createAllowed = canCreateRole && canReadRole && ownsProject;
  function close() { if (!busy) { if (dirty || roleDirty) setDiscard(true); else onClose(); } }
  return <>
    <Dialog open onOpenChange={(next) => { if (!next) close(); }}><DialogContent ref={contentRef} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl!">
      <DialogHeader><DialogTitle>{creating ? '新建项目角色' : '邀请成员'}</DialogTitle><DialogDescription>{creating ? '保存为可复用的角色模板，创建后返回邀请并自动选中。' : '指定受邀对象与项目职责。对方接受邀请后才加入项目并获得权限。'}</DialogDescription></DialogHeader>
      {creating ? <>
        <Button variant="ghost" disabled={busy} onClick={() => { if (roleDirty) setDiscard(true); else setCreating(false); }}>← 返回邀请</Button>
        <RoleCreateForm owner={account.data?.accountId ?? ''} submitLabel="创建并选用" onDirtyChange={setRoleDirty} onBusyChange={setBusy} onCreated={(role) => {
          setCreatedRoles((previous) => [...previous, role]); setRoleId(role.roleId); setValues((previous) => ({ ...previous, roleId: role.roleId })); setDirty(true); setRoleDirty(false); setCreating(false); setRevision((previous) => previous + 1); void roles.mutate();
        }} />
      </> : <>
        <div className="flex gap-2" role="group" aria-label="邀请方式">{([{ value: 'email', label: '邮箱' }, { value: 'account', label: '账号 ID' }] as const).map((item) => <Button key={item.value} variant={method === item.value ? 'secondary' : 'ghost'} aria-pressed={method === item.value} disabled={busy} onClick={() => { setRecipients((previous) => ({ ...previous, [method]: values.invitee })); setValues((previous) => ({ ...previous, invitee: recipients[item.value] })); setMethod(item.value); setRevision((previous) => previous + 1); }}>{item.label}</Button>)}</div>
        <ErrorNotice error={roles.error} retry={() => roles.mutate()} />
        {!roles.data && !roles.error && <Loading />}
        {roles.data && !available.length && <p className="rounded-md bg-muted p-3 text-sm">暂无可用项目角色。{createAllowed ? '可以在这里创建角色，再继续邀请。' : '请项目所有者准备项目角色。'}</p>}
        <FieldsForm key={revision} initial={values} label="生成邀请" onDirtyChange={(value) => { if (value) setDirty(true); }} onBusyChange={setBusy}
          onFieldChange={(name, value) => { setValues((previous) => ({ ...previous, [name]: value })); if (name === 'roleId') setRoleId(value); }}
          fields={[
            { name: 'invitee', label: method === 'email' ? '受邀邮箱' : '受邀账号 ID', type: method === 'email' ? 'email' : undefined, required: true, maxLength: 256, hint: method === 'email' ? '对方需使用此邮箱对应的平台账号接受邀请。' : '填写对方已有的平台账号 ID。' },
            { name: 'roleId', label: '项目角色', required: true, options: [{ value: '', label: '请选择角色' }, ...available.map((role) => ({ value: role.roleId, label: role.roleName }))] },
            { name: 'ttlHours', label: '邀请有效期', required: true, options: [{ value: '24', label: '1 天' }, { value: '72', label: '3 天' }, { value: '168', label: '7 天' }] },
          ]} submitDisabled={!!roles.error || !roles.data || !selected}
          onSave={async (form) => {
            if (!available.some((role) => role.roleId === form.roleId)) throw new Error('角色已不可用，请重新选择。');
            const invitation = await post<ProjectInvitationVO>(`/api/v1/projects/${segment(projectId)}/invitations`, { ...(method === 'email' ? { inviteeEmail: form.invitee.trim() } : { inviteeAccountId: form.invitee.trim() }), roleId: form.roleId, ttlMillis: Number(form.ttlHours) * 3600000 });
            onCreated(invitation);
          }}>
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">没有合适的角色？</span><Button variant="outline" disabled={busy || !createAllowed} title={!createAllowed ? '需要项目所有者身份及平台角色创建、查看权限' : undefined} onClick={() => setCreating(true)}>新建角色</Button></div>
          {selected && <RolePreview key={selected.roleId} role={selected} />}
          <p className="text-xs text-muted-foreground">生成后需要分享邀请信息给对方，系统不会自动发送邮件。</p>
        </FieldsForm>
      </>}
      <DialogFooter><Button variant="ghost" disabled={busy} onClick={close}>取消</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={discard} onOpenChange={setDiscard}><DialogContent><DialogHeader><DialogTitle>{creating ? '放弃角色草稿？' : '放弃邀请草稿？'}</DialogTitle><DialogDescription>{creating ? '角色尚未保存。返回邀请后，受邀对象和原角色选择会保留。' : '受邀对象和角色选择尚未提交，已创建的角色会保留。'}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscard(false)}>继续填写</Button><Button variant="destructive" onClick={() => { setDiscard(false); if (creating) { setRoleDirty(false); setCreating(false); } else onClose(); }}>放弃草稿</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
