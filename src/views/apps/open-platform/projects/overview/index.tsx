import { Link, useParams } from 'react-router';
import { KeyRound, Package, Users } from 'lucide-react';

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
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectDetail } from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const ProjectOverviewPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProjectDetail(projectId);

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Project 概览" />
      <StyleDivider />
      <ProjectWorkspaceShell activeTab="overview">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
              <CardDescription>来自 ProjectView 正式字段</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isLoading && !project ? (
                <>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                </>
              ) : project ? (
                <>
                  <div>
                    <span className="text-muted-foreground">名称：</span>
                    {project.projectName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">状态：</span>
                    {project.status}
                  </div>
                  <div>
                    <span className="text-muted-foreground">我的角色：</span>
                    {project.myRole}
                  </div>
                  <div>
                    <span className="text-muted-foreground">更新时间：</span>
                    {new Date(project.updateTime).toLocaleString()}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">暂无数据</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4" aria-hidden />
                物模型
              </CardTitle>
              <CardDescription>在当前 Project 下管理产品与模型</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                物模型能力将挂在本 Project 路径下，避免无上下文的全局列表。
              </p>
              <Button
                size="sm"
                className="w-fit"
                nativeButton={false}
                render={
                  <Link to={`/projects/${projectId}/thing-model/products`} />
                }
              >
                进入物模型
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4" aria-hidden />
                API 授权
              </CardTitle>
              <CardDescription>单组有效 Client ID / Secret</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                查看授权状态、轮换密钥与网络策略。
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/authorization`} />}
              >
                打开授权
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" aria-hidden />
                下一步
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/members`} />}
              >
                邀请成员
              </Button>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/authorization`} />}
              >
                配置授权
              </Button>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={
                  <Link to={`/projects/${projectId}/thing-model/products`} />
                }
              >
                查看物模型
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectOverviewPage;
