import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import StyleAwareWrapper from 'src/components/shared/StyleAwareWrapper';
import StyleDivider from 'src/components/shared/StyleDivider';

const BCrumb = [
  { to: '/', title: 'Home' },
  { to: '/projects', title: 'Projects' },
  { title: 'New' },
];

const CreateProjectPage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="Create Project" items={BCrumb} />
      <StyleDivider />
      <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
        Create Project wizard will be implemented in a later task.
      </div>
    </StyleAwareWrapper>
  );
};

export default CreateProjectPage;
