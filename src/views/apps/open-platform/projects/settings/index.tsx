import { Link, useParams } from 'react-router';

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

/** Settings home — demoted from the former default overview landing. */
const ProjectSettingsPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProjectDetail(projectId);

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="项目设置" />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="settings">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
              <CardDescription>ProjectView 正式字段；编辑与生命周期在上方操作区</CardDescription>
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
              <CardTitle className="text-base">回到主路径</CardTitle>
              <CardDescription>设置完成后继续产品管理</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                nativeButton={false}
                render={<Link to={`/projects/${projectId}/products`} />}
              >
                管理产品
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectSettingsPage;
