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

const BCrumb = [
  { to: '/projects', title: 'Projects' },
  { title: '设置' },
];

const ProjectSettingsPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProjectDetail(projectId);

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="项目设置" items={BCrumb} />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="settings">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
              <CardDescription>仅展示正式 ProjectView 字段</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && !project ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ) : project ? (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">名称</dt>
                    <dd className="mt-0.5 font-medium">{project.projectName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">状态</dt>
                    <dd className="mt-0.5 font-medium">{project.status}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">我的角色</dt>
                    <dd className="mt-0.5 font-medium">{project.myRole}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">更新时间</dt>
                    <dd className="mt-0.5 font-medium">
                      {new Date(project.updateTime).toLocaleString()}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">描述</dt>
                    <dd className="mt-0.5">
                      {project.description || (
                        <span className="text-muted-foreground">未填写</span>
                      )}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">快捷入口</CardTitle>
              <CardDescription>设置较重，主路径仍是产品</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/products`} />}
              >
                <Package className="size-4" aria-hidden />
                返回产品
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/members`} />}
              >
                <Users className="size-4" aria-hidden />
                成员与邀请
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/authorization`} />}
              >
                <KeyRound className="size-4" aria-hidden />
                API 授权
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectSettingsPage;
