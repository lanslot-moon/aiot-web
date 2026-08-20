import { useParams } from 'react-router';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import StyleAwareWrapper from 'src/components/shared/StyleAwareWrapper';
import StyleDivider from 'src/components/shared/StyleDivider';

const ThingModelProductsPlaceholder = () => {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="物模型" />
      <StyleDivider />
      <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
        物模型将在此 Project 下提供
        {projectId ? (
          <>
            {' '}
            （<span className="font-mono text-foreground">{projectId}</span>）
          </>
        ) : null}
        。
      </div>
    </StyleAwareWrapper>
  );
};

export default ThingModelProductsPlaceholder;
