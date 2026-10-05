import { useState } from 'react';
import type { ProjectInvitationVO } from '@/api/iam/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { epoch } from './shared-utils';
import { Status } from './shared';
export function InvitationDetailsAction({ invitation, roleName }: { invitation: ProjectInvitationVO; roleName?: string }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" onClick={() => setOpen(true)}>查看邀请</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>邀请详情</DialogTitle><DialogDescription>已生成的项目邀请。邀请令牌仅在生成时展示。</DialogDescription></DialogHeader><dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 text-sm"><dt>受邀对象</dt><dd className="break-all">{invitation.inviteeEmail ?? invitation.inviteeAccountId}</dd><dt>项目角色</dt><dd>{roleName ?? invitation.roleId}</dd><dt>状态</dt><dd><Status value={invitation.status} /></dd><dt>创建时间</dt><dd>{epoch(invitation.createTime)}</dd><dt>有效期至</dt><dd>{epoch(invitation.expiresAt)}</dd></dl><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>关闭</Button></DialogFooter></DialogContent></Dialog></>;
}
