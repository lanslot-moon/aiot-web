import { Cpu } from 'lucide-react';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  { to: '/projects', title: 'Projects' },
  { title: '设备' },
];

const ProjectDevicesPage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="设备" items={BCrumb} />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="devices">
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-2">
            <h3 className="text-base font-semibold">设备</h3>
            <Badge variant="secondary">未发布</Badge>
          </div>
          <Empty className="rounded-lg border border-dashed py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Cpu aria-hidden />
              </EmptyMedia>
              <EmptyTitle>设备管理尚未开放</EmptyTitle>
              <EmptyDescription>
                设备将跟随当前 Project 与产品。正式能力上线前仅保留入口，避免干扰产品主路径。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectDevicesPage;
