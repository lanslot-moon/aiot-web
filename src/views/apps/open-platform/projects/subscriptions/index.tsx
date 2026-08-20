import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const ProjectSubscriptionsPage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="订阅" />
      <StyleDivider />
      <ProjectWorkspaceShell activeTab="subscriptions">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">服务订阅</CardTitle>
            <CardDescription>只读；订阅真相来自 Entitlement/Billing。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            订阅列表接通前保持占位说明。
          </CardContent>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectSubscriptionsPage;
