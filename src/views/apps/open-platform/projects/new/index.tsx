import { CreateProjectWizard } from '@/components/open-platform/create-project-wizard';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

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
      <CreateProjectWizard />
    </StyleAwareWrapper>
  );
};

export default CreateProjectPage;
