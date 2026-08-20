import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  OpenPlatformApiError,
  getStoredAccessToken,
  useOpenPlatform,
} from '@/context/open-platform-context';
import {
  REST_SUCCESS_CODE,
  type InvitationView,
  type ProjectMemberView,
  type RestResult,
} from '@/types/apps/open-platform';

const ProjectInvitationPage = () => {
  const { invitationId = '' } = useParams<{ invitationId: string }>();
  const { accessToken } = useOpenPlatform();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    invitation: InvitationView;
    member: ProjectMemberView;
  } | null>(null);

  const loggedIn = Boolean(accessToken || getStoredAccessToken());

  const accept = async () => {
    setBusy(true);
    try {
      const token = getStoredAccessToken();
      const res = await fetch(`/api/v1/project-invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Mock accepts any non-empty token string; real token never logged.
        body: JSON.stringify({ token: `invite_token_${invitationId}` }),
      });
      const json = (await res.json()) as RestResult<{
        invitation: InvitationView;
        member: ProjectMemberView;
      }>;
      if (json.code !== REST_SUCCESS_CODE) {
        throw new OpenPlatformApiError(json.code, json.message);
      }
      setResult(json.data);
      toast.success('已加入 Project');
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '接受邀请失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Project 邀请</CardTitle>
          <CardDescription>
            未接受前不猜测 Project 名称或角色；以接受接口返回为准。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loggedIn ? (
            <>
              <p className="text-sm text-muted-foreground">
                请先登录或注册，再继续接受 Project 邀请。
              </p>
              <div className="flex gap-2">
                <Button nativeButton={false} render={<Link to="/auth/auth2/login" />}>
                  登录
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link to="/auth/auth2/register" />}
                >
                  注册
                </Button>
              </div>
            </>
          ) : result ? (
            <>
              <p className="text-sm">
                已加入 Project <code className="font-mono">{result.member.projectId}</code>
                ，角色 {result.member.role}。
              </p>
              <Button
                nativeButton={false}
                render={
                  <Link to={`/projects/${result.member.projectId}/overview`} />
                }
              >
                进入 Project
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                邀请 ID：<code className="font-mono text-xs">{invitationId}</code>
              </p>
              <Button type="button" disabled={busy} onClick={() => void accept()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                接受邀请
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectInvitationPage;
