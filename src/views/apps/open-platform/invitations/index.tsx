import { useParams } from 'react-router';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import StyleAwareWrapper from 'src/components/shared/StyleAwareWrapper';
import StyleDivider from 'src/components/shared/StyleDivider';

const ProjectInvitationPage = () => {
  const { invitationId } = useParams<{ invitationId: string }>();

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Project Invitation" />
      <StyleDivider />
      <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
        Invitation placeholder for{' '}
        <span className="font-mono text-foreground">{invitationId}</span>.
      </div>
    </StyleAwareWrapper>
  );
};

export default ProjectInvitationPage;
