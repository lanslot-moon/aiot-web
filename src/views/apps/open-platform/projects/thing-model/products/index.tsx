import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const ProjectThingModelProductsPage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="物模型" />
      <StyleDivider />
      <ProjectWorkspaceShell activeTab="thing-model">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">物模型（Project 作用域）</CardTitle>
            <CardDescription>
              产品 / 模型 / Profile / Data Policy 将挂在
              /projects/:projectId/thing-model/... 下实现。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            本期开放平台入口层只提供入口与页签，不单独在侧边栏暴露物模型分组，避免无
            Project 上下文的操作。
          </CardContent>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectThingModelProductsPage;
