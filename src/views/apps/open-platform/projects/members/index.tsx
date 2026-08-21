import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { RoleBadge } from '@/components/open-platform/role-badge';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  OpenPlatformApiError,
  openPlatformGetFetcher,
  getStoredAccessToken,
  parseOpenPlatformResponse,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import {
  INVITATION_STATUS_LABEL,
  MEMBERSHIP_STATUS_LABEL,
  labelOf,
} from '@/lib/open-platform-labels';
import {
  REST_SUCCESS_CODE,
  type CursorResult,
  type InvitationView,
  type ProjectMemberView,
} from '@/types/apps/open-platform';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const token = getStoredAccessToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await parseOpenPlatformResponse<T>(res);
  if (json.code !== REST_SUCCESS_CODE) {
    throw new OpenPlatformApiError(json.code, json.message);
  }
  return json.data;
}

const ProjectMembersPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const membersKey = `/api/v1/projects/${projectId}/members`;
  const invitationsKey = `/api/v1/projects/${projectId}/invitations`;

  const {
    data: membersData,
    error: membersError,
    isLoading: membersLoading,
    mutate: mutateMembers,
  } = useSWR<CursorResult<ProjectMemberView>>(membersKey, openPlatformGetFetcher);

  const {
    data: invitationsData,
    error: invitationsError,
    isLoading: invitationsLoading,
    mutate: mutateInvitations,
  } = useSWR<CursorResult<InvitationView>>(invitationsKey, openPlatformGetFetcher);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVELOPER');
  const [inviting, setInviting] = useState(false);
  const [tab, setTab] = useState<'members' | 'pending' | 'history'>('members');

  const pending = useMemo(
    () => (invitationsData?.items ?? []).filter((i) => i.status === 'PENDING'),
    [invitationsData],
  );
  const history = useMemo(
    () => (invitationsData?.items ?? []).filter((i) => i.status !== 'PENDING'),
    [invitationsData],
  );

  const submitInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await postJson(`/api/v1/projects/${projectId}/invitations`, {
        inviteeEmail: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success(`已向 ${inviteEmail.trim()} 发出 ${inviteRole} 邀请`);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('DEVELOPER');
      await mutateInvitations();
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '邀请失败');
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (invitationId: string) => {
    try {
      await postJson(`/api/v1/project-invitations/${invitationId}/revoke`, {});
      toast.success('邀请已撤销');
      await mutateInvitations();
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '撤销失败');
    }
  };

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="成员与邀请" />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="settings">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b py-4">
            <div>
              <CardTitle className="text-base">成员与邀请</CardTitle>
            </div>
            <Button type="button" size="sm" className="gap-1" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-3.5" aria-hidden />
              邀请成员
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="flex flex-wrap gap-1 border-b border-border">
              {(
                [
                  ['members', '成员'],
                  ['pending', '待处理邀请'],
                  ['history', '历史邀请'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    tab === id
                      ? 'border-b-2 border-primary px-3 py-2 text-sm font-medium'
                      : 'px-3 py-2 text-sm text-muted-foreground'
                  }
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'members' ? (
              membersError ? (
                <ApiErrorAlert
                  code={(membersError as OpenPlatformApiError).code}
                  message={membersError.message}
                  onRetry={() => void mutateMembers()}
                />
              ) : membersLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>账号</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>加入时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(membersData?.items ?? []).map((m) => (
                      <TableRow key={`${m.projectId}-${m.accountId}`}>
                        <TableCell>{m.username}</TableCell>
                        <TableCell>{m.email ?? '—'}</TableCell>
                        <TableCell>
                          <RoleBadge role={m.role} />
                        </TableCell>
                        <TableCell>
                          {labelOf(MEMBERSHIP_STATUS_LABEL, m.membershipStatus)}
                        </TableCell>
                        <TableCell>{new Date(m.joinedAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : null}

            {tab === 'pending' ? (
              invitationsError ? (
                <ApiErrorAlert
                  code={(invitationsError as OpenPlatformApiError).code}
                  message={invitationsError.message}
                  onRetry={() => void mutateInvitations()}
                />
              ) : invitationsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">没有待处理邀请</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>目标</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>过期</TableHead>
                      <TableHead className="text-end">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((i) => (
                      <TableRow key={i.invitationId}>
                        <TableCell>{i.inviteeEmail ?? i.inviteeAccountId}</TableCell>
                        <TableCell>
                          <RoleBadge role={i.role} />
                        </TableCell>
                        <TableCell>{new Date(i.expiresAt).toLocaleString()}</TableCell>
                        <TableCell className="text-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void revokeInvite(i.invitationId)}
                          >
                            撤销
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : null}

            {tab === 'history' ? (
              history.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无历史邀请</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>目标</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((i) => (
                      <TableRow key={i.invitationId}>
                        <TableCell>{i.inviteeEmail ?? i.inviteeAccountId}</TableCell>
                        <TableCell>
                          <RoleBadge role={i.role} />
                        </TableCell>
                        <TableCell>
                          {labelOf(INVITATION_STATUS_LABEL, i.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : null}
          </CardContent>
        </Card>

        <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
          <SheetContent side="right" className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>邀请成员</SheetTitle>
              <SheetDescription>邮箱为默认邀请方式；角色不含 OWNER。</SheetDescription>
            </SheetHeader>
            <div className="grid gap-3 px-4">
              <div className="grid gap-1.5">
                <Label htmlFor="invite-email">邮箱</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>角色</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v ?? 'DEVELOPER')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="DEVELOPER">DEVELOPER</SelectItem>
                    <SelectItem value="VIEWER">VIEWER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={!inviteEmail.trim() || inviting}
                onClick={() => void submitInvite()}
              >
                {inviting ? <Loader2 className="size-4 animate-spin" /> : null}
                发送邀请
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectMembersPage;
