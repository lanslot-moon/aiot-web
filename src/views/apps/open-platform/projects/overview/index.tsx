import { Link, useParams } from 'react-router';
import { Cpu, KeyRound, Package, Users } from 'lucide-react';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useProjectDetail } from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import {
  PROJECT_ROLE_LABEL,
  PROJECT_STATUS_LABEL,
  labelOf,
} from '@/lib/open-platform-labels';

const BCrumb = [
  { to: '/projects', title: '项目' },
  { title: '概览' },
];

const ProjectOverviewPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: project } = useProjectDetail(projectId);

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
              快速了解当前项目状态，并进入产品开发主路径。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>项目状态</CardDescription>
                <CardTitle className="text-lg">
                  {labelOf(PROJECT_STATUS_LABEL, project?.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                角色 {labelOf(PROJECT_ROLE_LABEL, project?.myRole)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>产品</CardDescription>
                <CardTitle className="text-lg tabular-nums">4</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                演示数据，待物模型接口接入
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>设备</CardDescription>
                <CardTitle className="text-lg">未发布</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                设备管理稍后开放
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>API 授权</CardDescription>
                <CardTitle className="text-lg">可配置</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                密钥在项目设置中查看
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">下一步</CardTitle>
                <CardDescription>按主路径继续开发</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  nativeButton={false}
                  render={<Link to={`/projects/${projectId}/products`} />}
                >
                  <Package className="size-4" aria-hidden />
                  管理产品
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  nativeButton={false}
                  render={<Link to={`/projects/${projectId}/devices`} />}
                >
                  <Cpu className="size-4" aria-hidden />
                  查看设备
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  nativeButton={false}
                  render={<Link to={`/projects/${projectId}/members`} />}
                >
                  <Users className="size-4" aria-hidden />
                  成员与邀请
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  nativeButton={false}
                  render={<Link to={`/projects/${projectId}/authorization`} />}
                >
                  <KeyRound className="size-4" aria-hidden />
                  API 授权
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">项目说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {project?.description?.trim() ||
                    '还没有描述。可在「项目设置 → 基本信息」中补充。'}
                </p>
                <p className="font-mono text-xs">{projectId}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectOverviewPage;
