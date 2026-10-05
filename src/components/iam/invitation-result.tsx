import { Link } from 'react-router';
import { toast } from 'sonner';
import { segment } from '@/api/iam/client';
import type { ProjectInvitationVO } from '@/api/iam/contracts';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SecretInput } from './shared';
import { epoch } from './shared-utils';

export function InvitationResult({ invitation, onClose }: { invitation: ProjectInvitationVO | null; onClose: () => void }) {
  return <Dialog open={!!invitation} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>邀请已创建，等待对方接受</DialogTitle><DialogDescription>未自动发送邮件。请复制邀请地址与令牌，交给指定受邀人；令牌关闭后不再显示。</DialogDescription></DialogHeader>
      {invitation && <InvitationDelivery invitation={invitation} />}
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>完成</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
function InvitationDelivery({ invitation }: { invitation: ProjectInvitationVO }) {
  const url = `${window.location.origin}/project-invitations/${segment(invitation.invitationId)}`;
  return (
    <div className="space-y-4 text-sm">
      {invitation.invitationToken && <Button onClick={async () => { try { await navigator.clipboard.writeText(`邀请你加入项目。\n邀请地址：${url}\n邀请令牌：${invitation.invitationToken}\n有效期至：${epoch(invitation.expiresAt)}\n请使用受邀邮箱或账号登录并接受邀请。`); toast.success('邀请信息已复制'); } catch { toast.error('复制失败，请分别复制地址与令牌。'); } }}>复制完整邀请信息</Button>}
      <p>受邀人：{invitation.inviteeEmail ?? invitation.inviteeAccountId}</p>
      <p>到期时间：{epoch(invitation.expiresAt)}</p>
      <div className="space-y-2"><label htmlFor="invitation-address" className="font-medium">1. 复制邀请地址</label><div className="flex items-center gap-2"><Input id="invitation-address" value={url} readOnly /><CopyIdButton value={url} label="邀请地址" /></div></div>
      {invitation.invitationToken && <div className="space-y-2"><label htmlFor="invitation-secret" className="font-medium">2. 复制邀请令牌</label><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><SecretInput id="invitation-secret" value={invitation.invitationToken} readOnly /></div><CopyIdButton value={invitation.invitationToken} label="邀请令牌" /></div><p className="text-xs text-muted-foreground">仅本次展示，请在关闭前复制并妥善分享给受邀人。</p></div>}
      <Link className="block hover:underline" to={`/projects/${segment(invitation.projectId)}/members?tab=invitations`}>查看邀请状态</Link>
    </div>
  );
}
