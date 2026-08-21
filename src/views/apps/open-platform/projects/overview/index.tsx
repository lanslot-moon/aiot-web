import { useState } from 'react';
import { Link, useParams } from 'react-router';
import useSWR from 'swr';
import { Eye, EyeOff, KeyRound, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  OpenPlatformApiError,
  openPlatformGetFetcher,
  useProjectDetail,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import {
  AUTHORIZATION_STATUS_LABEL,
  PROJECT_ROLE_LABEL,
  PROJECT_STATUS_LABEL,
  labelOf,
} from '@/lib/open-platform-labels';
import type {
  AuthorizationMetadataView,
  ProjectKeyPairView,
} from '@/types/apps/open-platform';

const BCrumb = [
  { to: '/projects', title: '项目' },
  { title: '概览' },
];

function maskSecret(value: string): string {
  if (!value) return '••••••••';
  return '•'.repeat(Math.min(Math.max(value.length, 8), 28));
}

const ProjectOverviewPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: project, isLoading: projectLoading } = useProjectDetail(projectId);

  const {
    data: authz,
    error: authzError,
    isLoading: authzLoading,
    mutate: mutateAuthz,
  } = useSWR<AuthorizationMetadataView>(
    projectId ? `/api/v1/projects/${projectId}/authorization` : null,
    openPlatformGetFetcher,
  );

  const [keyPair, setKeyPair] = useState<ProjectKeyPairView | null>(null);
  const [revealSecret, setRevealSecret] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);

  const loadKeys = async () => {
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

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="概览" items={BCrumb} />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="overview">
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">项目概览</h3>
            <p className="text-sm text-muted-foreground">
              查看项目状态与 API 凭证摘要；轮换、启用/禁用等请到授权管理页。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>项目状态</CardDescription>
                <CardTitle className="text-base">
                  {projectLoading && !project
                    ? '…'
                    : labelOf(PROJECT_STATUS_LABEL, project?.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>角色 {labelOf(PROJECT_ROLE_LABEL, project?.myRole)}</p>
                {project?.description ? (
                  <p className="line-clamp-3 text-foreground/80">{project.description}</p>
                ) : (
                  <p>暂无描述</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="size-4" aria-hidden />
                    API 授权
                  </CardTitle>
                  <CardDescription>
                    可在此查看密钥与白名单；精细操作请进入授权管理
                  </CardDescription>
                </div>
                {authz ? (
                  <Badge variant="outline">
                    {labelOf(AUTHORIZATION_STATUS_LABEL, authz.status)}
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {authzError ? (
                  <ApiErrorAlert
                    code={(authzError as OpenPlatformApiError).code}
                    message={authzError.message}
                    onRetry={() => void mutateAuthz()}
                  />
                ) : authzLoading && !authz ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : authz ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={loadingKey || authz.status === 'REVOKED'}
                        onClick={() => void loadKeys()}
                      >
                        {loadingKey ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Eye className="size-3.5" aria-hidden />
                        )}
                        查看密钥
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        nativeButton={false}
                        render={
                          <Link to={`/projects/${projectId}/authorization`} />
                        }
                      >
                        <Shield className="size-3.5" aria-hidden />
                        API 授权管理
                      </Button>
                    </div>

                    {keyPair ? (
                      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Client ID</span>
                          <code className="font-mono text-xs break-all">
                            {keyPair.clientId}
                          </code>
                          <CopyIdButton value={keyPair.clientId} label="Client ID" />
                        </div>
                        <Separator />
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Client Secret</span>
                          <code className="font-mono text-xs break-all">
                            {revealSecret
                              ? keyPair.clientSecret
                              : maskSecret(keyPair.clientSecret)}
                          </code>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setRevealSecret((v) => !v)}
                            aria-label={revealSecret ? '隐藏 Secret' : '显示 Secret'}
                          >
                            {revealSecret ? (
                              <EyeOff aria-hidden />
                            ) : (
                              <Eye aria-hidden />
                            )}
                          </Button>
                          <CopyIdButton
                            value={keyPair.clientSecret}
                            label="Client Secret"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          显示密钥会记审计；轮换 / 启用 / 禁用请到授权管理页。
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        默认不加载明文密钥。点击「查看密钥」后显示。
                      </p>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">IP 白名单</p>
                        <Badge variant="secondary">
                          {authz.networkPolicyEnabled ? '已启用限制' : '未启用限制'}
                        </Badge>
                      </div>
                      {authz.ipAllowlist.length === 0 ? (
                        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          {authz.networkPolicyEnabled
                            ? '白名单为空：启用限制时将拒绝所有来源（请到授权管理页配置）。'
                            : '暂无白名单条目。可在授权管理页添加 IP / CIDR。'}
                        </p>
                      ) : (
                        <ul className="divide-y rounded-lg border">
                          {authz.ipAllowlist.map((ip) => (
                            <li
                              key={ip}
                              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                            >
                              <code className="font-mono text-xs">{ip}</code>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectOverviewPage;
