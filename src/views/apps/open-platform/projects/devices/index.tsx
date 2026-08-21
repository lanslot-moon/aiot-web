import { Cpu } from 'lucide-react';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const ProjectDevicesPage = () => {
  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="设备" />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="devices">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">设备</h3>
          <Badge variant="secondary">未发布</Badge>
        </div>
        <Empty className="border border-dashed bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Cpu aria-hidden />
            </EmptyMedia>
            <EmptyTitle>设备管理尚未开放</EmptyTitle>
            <EmptyDescription>
              设备跟随 Project 与产品，正式能力发布前仅作入口占位，避免与产品主路径抢注意力。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectDevicesPage;
