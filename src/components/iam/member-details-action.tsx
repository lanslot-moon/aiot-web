import { segment } from '@/api/iam/client';
import type { ProjectMemberVO } from '@/api/iam/contracts';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useState } from 'react';
import { ErrorNotice, Loading, Status } from './shared';
import { epoch, useResource } from './shared-utils';

export function MemberDetailsAction({ projectId, accountId }: { projectId: string; accountId: string }) {
  const [open, setOpen] = useState(false);
  const detail = useResource<ProjectMemberVO>(open ? `/api/v1/projects/${segment(projectId)}/members/${segment(accountId)}` : null, 'project-member:view');
  const data = detail.data;
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>成员详情</Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader><SheetTitle>成员详情</SheetTitle><SheetDescription>当前项目中的成员信息。</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {detail.isLoading ? <Loading /> : detail.error ? <ErrorNotice error={detail.error} retry={() => detail.mutate()} /> : data && <dl className="space-y-4 text-sm">
            <div><dt className="text-muted-foreground">用户名</dt><dd className="mt-1 break-all">{data.username || '—'}</dd></div>
            <div><dt className="text-muted-foreground">账号 ID</dt><dd className="mt-1 flex items-start gap-1"><span className="min-w-0 break-all font-mono">{data.accountId}</span><CopyIdButton value={data.accountId} label="账号 ID" /></dd></div>
            <div><dt className="text-muted-foreground">邮箱</dt><dd className="mt-1 break-all">{data.email || '—'}</dd></div>
            <div><dt className="text-muted-foreground">当前项目角色</dt><dd className="mt-1">{data.roles?.map((role) => role.roleName).join('、') || '未分配角色'}</dd></div>
            <div><dt className="text-muted-foreground">成员状态</dt><dd className="mt-1"><Status value={data.membershipStatus} /></dd></div>
            <div><dt className="text-muted-foreground">加入时间</dt><dd className="mt-1">{epoch(data.joinedAt)}</dd></div>
            <div><dt className="text-muted-foreground">创建时间</dt><dd className="mt-1">{epoch(data.createTime)}</dd></div>
            <div><dt className="text-muted-foreground">更新时间</dt><dd className="mt-1">{epoch(data.updateTime)}</dd></div>
          </dl>}
        </div>
        <SheetFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>关闭</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  </>;
}
