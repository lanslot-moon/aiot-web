import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const ProjectUsagePage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="用量" />
      <StyleDivider />
      <ProjectWorkspaceShell activeTab="usage">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">用量</CardTitle>
            <CardDescription>只读指标；无数据时显示 Empty，不虚构数字。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            用量接口接通前保持占位说明。
          </CardContent>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectUsagePage;
