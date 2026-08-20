import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const ProjectMembersPage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="成员与邀请" />
      <StyleDivider />
      <ProjectWorkspaceShell activeTab="members">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">成员与邀请</CardTitle>
            <CardDescription>
              成员列表、邀请 Sheet 与接受流程将在下一任务接通 Mock。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            当前工作区壳层与页签已就绪。邀请只能通过邮箱或 Account ID 二选一发起，角色不含
            OWNER。
          </CardContent>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectMembersPage;
