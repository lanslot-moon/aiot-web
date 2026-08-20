import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const ProjectAuthorizationPage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="API 授权" />
      <StyleDivider />
      <ProjectWorkspaceShell activeTab="authorization">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API 授权</CardTitle>
            <CardDescription>一个 Project 任意时刻只有一组有效密钥对。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            查看密钥、轮换、启用/禁用/吊销与 IP 白名单将在后续任务接通。不会提供「新增授权」。
          </CardContent>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectAuthorizationPage;
