import { useParams } from 'react-router';
import { SearchIcon } from 'lucide-react';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  { to: '/projects', title: '项目' },
  { title: '设备' },
];

const ProjectDevicesPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="设备" items={BCrumb} />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="devices">
        <div className="flex h-full min-h-[28rem] flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">设备</h3>
              <Badge variant="secondary">未发布</Badge>
            </div>
            <Button type="button" size="sm" disabled>
              添加设备
            </Button>
          </div>

          <div className="relative w-full sm:max-w-72">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input placeholder="搜索设备名称 / ID" className="pl-8" disabled />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>设备名称</TableHead>
                  <TableHead>设备 ID</TableHead>
                  <TableHead>所属产品</TableHead>
                  <TableHead>在线状态</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-40 text-center text-sm text-muted-foreground"
                  >
                    设备管理尚未开放。当前项目{' '}
                    <span className="font-mono text-xs">{projectId}</span>{' '}
                    仅保留列表骨架，避免空页面。
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectDevicesPage;
