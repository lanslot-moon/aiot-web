import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';
import { Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  OpenPlatformApiError,
  getStoredAccessToken,
  openPlatformGetFetcher,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import {
  AUTHORIZATION_STATUS_LABEL,
  labelOf,
} from '@/lib/open-platform-labels';
import {
  REST_SUCCESS_CODE,
  type AuthorizationMetadataView,
  type ProjectKeyPairView,
  type RestResult,
} from '@/types/apps/open-platform';

async function mutateAuth<T>(
  url: string,
  method: 'POST' | 'PUT',
  body?: unknown,
): Promise<T> {
  const token = getStoredAccessToken();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as RestResult<T>;
  if (json.code !== REST_SUCCESS_CODE) {
    throw new OpenPlatformApiError(json.code, json.message);
  }
  return json.data;
}

const ProjectAuthorizationPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const authKey = `/api/v1/projects/${projectId}/authorization`;

  const { data, error, isLoading, mutate } = useSWR<AuthorizationMetadataView>(
    authKey,
    openPlatformGetFetcher,
  );

  const [keyPair, setKeyPair] = useState<ProjectKeyPairView | null>(null);
  const [revealSecret, setRevealSecret] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateAck, setRotateAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ipDraft, setIpDraft] = useState('');
  const [policyEnabled, setPolicyEnabled] = useState(false);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [emptyWarnOpen, setEmptyWarnOpen] = useState(false);

  const syncPolicyFromData = (authz: AuthorizationMetadataView) => {
    setPolicyEnabled(authz.networkPolicyEnabled);
    setAllowlist([...(authz.ipAllowlist ?? [])]);
  };

  useEffect(() => {
    if (data) syncPolicyFromData(data);
  }, [data]);

  const revealKeys = async () => {
    setLoadingKey(true);
    try {
      const pair = await openPlatformGetFetcher<ProjectKeyPairView>(
        `/api/v1/projects/${projectId}/authorization/key-pair`,
      );
      setKeyPair(pair);
      setRevealSecret(false);
      toast.success('已加载密钥（查看会记审计）');
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '无法查看密钥');
    } finally {
      setLoadingKey(false);
    }
  };

  const runAction = async (action: 'enable' | 'disable' | 'revoke' | 'rotate') => {
    setBusy(true);
    try {
      if (action === 'rotate') {
        const pair = await mutateAuth<ProjectKeyPairView>(
          `/api/v1/projects/${projectId}/authorization/rotate`,
          'POST',
          { confirm: true },
        );
        setKeyPair(pair);
        setRevealSecret(true);
        toast.success('密钥已轮换');
        setRotateOpen(false);
        setRotateAck(false);
      } else {
        await mutateAuth<boolean>(
          `/api/v1/projects/${projectId}/authorization/${action}`,
          'POST',
          {},
        );
        toast.success('授权状态已更新');
      }
      await mutate();
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const saveNetworkPolicy = async () => {
    if (policyEnabled && allowlist.length === 0) {
      setEmptyWarnOpen(true);
      return;
    }
    await persistNetworkPolicy();
  };

  const persistNetworkPolicy = async () => {
    setBusy(true);
    try {
      const next = await mutateAuth<AuthorizationMetadataView>(
        `/api/v1/projects/${projectId}/authorization/network-policy`,
        'PUT',
        { networkPolicyEnabled: policyEnabled, ipAllowlist: allowlist },
      );
      syncPolicyFromData(next);
      await mutate();
      toast.success('网络策略已保存');
      setEmptyWarnOpen(false);
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="API 授权" />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="settings">
        {error ? (
          <ApiErrorAlert
            code={(error as OpenPlatformApiError).code}
            message={error.message}
            onRetry={() => void mutate()}
          />
        ) : isLoading && !data ? (
          <Skeleton className="h-48 w-full" />
        ) : data ? (
          <div className="grid gap-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">授权状态</CardTitle>
                  <CardDescription>Project 与授权状态分开展示</CardDescription>
                </div>
                <Badge variant="outline">
                  {labelOf(AUTHORIZATION_STATUS_LABEL, data.status)}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.status === 'DISABLED' ? (
                  <Button size="sm" disabled={busy} onClick={() => void runAction('enable')}>
                    启用
                  </Button>
                ) : null}
                {data.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void runAction('disable')}
                  >
                    禁用
                  </Button>
                ) : null}
                {data.status !== 'REVOKED' ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void runAction('revoke')}
                  >
                    吊销
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => {
                    setRotateAck(false);
                    setRotateOpen(true);
                  }}
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  轮换密钥
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">当前 Project API 密钥</CardTitle>
                <CardDescription>默认不拉取明文；查看会记录审计。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingKey || data.status === 'REVOKED'}
                  onClick={() => void revealKeys()}
                >
                  {loadingKey ? <Loader2 className="size-4 animate-spin" /> : null}
                  查看密钥
                </Button>
                {keyPair ? (
                  <div className="space-y-2 rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Client ID</span>
                      <code className="font-mono text-xs">{keyPair.clientId}</code>
                      <CopyIdButton value={keyPair.clientId} label="Client ID" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Client Secret</span>
                      <code className="font-mono text-xs">
                        {revealSecret ? keyPair.clientSecret : '••••••••••••'}
                      </code>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => setRevealSecret((v) => !v)}
                        aria-label={revealSecret ? '隐藏 Secret' : '显示 Secret'}
                      >
                        {revealSecret ? <EyeOff /> : <Eye />}
                      </Button>
                      <CopyIdButton value={keyPair.clientSecret} label="Client Secret" />
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">网络策略</CardTitle>
                <CardDescription>
                  enabled=true 且列表为空表示拒绝所有来源，不会被解释为不限制。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={policyEnabled}
                    onCheckedChange={(v) => setPolicyEnabled(Boolean(v))}
                  />
                  启用 IP 限制
                </label>
                <div className="flex gap-2">
                  <Input
                    value={ipDraft}
                    onChange={(e) => setIpDraft(e.target.value)}
                    placeholder="添加 IPv4 / IPv6 / CIDR"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const v = ipDraft.trim();
                      if (!v) return;
                      setAllowlist((prev) => [...prev, v]);
                      setIpDraft('');
                    }}
                  >
                    添加
                  </Button>
                </div>
                <ul className="space-y-1 text-sm">
                  {allowlist.map((ip) => (
                    <li key={ip} className="flex items-center justify-between rounded border px-2 py-1">
                      <code className="font-mono text-xs">{ip}</code>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setAllowlist((prev) => prev.filter((x) => x !== ip))}
                      >
                        删除
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button type="button" size="sm" disabled={busy} onClick={() => void saveNetworkPolicy()}>
                  保存网络策略
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>轮换 Project API 密钥</AlertDialogTitle>
              <AlertDialogDescription>
                旧 Client ID/Secret 将立即失效；正在运行的 OpenAPI 客户端需要切换到新密钥。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={rotateAck}
                onCheckedChange={(v) => setRotateAck(v === true)}
              />
              <span>我理解旧密钥会立即失效</span>
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                disabled={!rotateAck || busy}
                onClick={(e) => {
                  e.preventDefault();
                  void runAction('rotate');
                }}
              >
                确认轮换
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={emptyWarnOpen} onOpenChange={setEmptyWarnOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>白名单为空</AlertDialogTitle>
              <AlertDialogDescription>
                启用 IP 限制且白名单为空将拒绝所有 Project API 请求。确认仍要保存？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  void persistNetworkPolicy();
                }}
              >
                确认保存
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectAuthorizationPage;
