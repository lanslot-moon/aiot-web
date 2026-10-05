import { segment } from '@/api/iam/client';
import type { SessionVO } from '@/api/iam/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { ErrorNotice, Loading, Status } from './shared';
import { epoch, useResource } from './shared-utils';

export function SessionDetailsAction({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const detail = useResource<SessionVO>(
    open ? `/api/v1/accounts/current/sessions/${segment(sessionId)}` : null,
    'session:manage',
  );
  const data = detail.data;
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>详情</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>登录设备详情</DialogTitle>
          <DialogDescription>此设备的登录会话信息。</DialogDescription>
        </DialogHeader>
        {detail.isLoading ? <Loading /> : detail.error ? (
          <ErrorNotice error={detail.error} retry={() => detail.mutate()} />
        ) : data && <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2"><dt className="text-muted-foreground">会话 ID</dt><dd className="mt-1 break-all font-mono">{data.sessionId}</dd></div>
          <div><dt className="text-muted-foreground">设备类型</dt><dd className="mt-1">{data.clientType ?? '—'}</dd></div>
          <div><dt className="text-muted-foreground">登录方式</dt><dd className="mt-1">{data.loginMethod ?? '—'}</dd></div>
          <div><dt className="text-muted-foreground">状态</dt><dd className="mt-1"><Status value={data.status} /></dd></div>
          <div><dt className="text-muted-foreground">创建时间</dt><dd className="mt-1">{epoch(data.createTime)}</dd></div>
          <div><dt className="text-muted-foreground">最后活动</dt><dd className="mt-1">{epoch(data.lastSeenAt)}</dd></div>
          <div><dt className="text-muted-foreground">到期时间</dt><dd className="mt-1">{epoch(data.expiresAt)}</dd></div>
        </dl>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>关闭</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
