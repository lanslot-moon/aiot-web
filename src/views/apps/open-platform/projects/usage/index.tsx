import { useParams } from 'react-router';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import StyleAwareWrapper from 'src/components/shared/StyleAwareWrapper';
import StyleDivider from 'src/components/shared/StyleDivider';

const ProjectUsagePage = () => {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Usage" />
      <StyleDivider />
      <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
        Usage placeholder for project <span className="font-mono text-foreground">{projectId}</span>.
      </div>
    </StyleAwareWrapper>
  );
};

export default ProjectUsagePage;
