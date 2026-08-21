import { useParams } from 'react-router';
import { Package, PackagePlus, SearchIcon } from 'lucide-react';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  { to: '/projects', title: 'Projects' },
  { title: '产品' },
];

const ProjectProductsPage = () => {
  const { projectId: _projectId = '' } = useParams<{ projectId: string }>();

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="产品" items={BCrumb} />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="products">
        <Card className="p-6">
          <div className="mb-6 grid grid-cols-12 gap-4">
            <button
              type="button"
              className="col-span-12 rounded-lg border border-primary/20 bg-primary/5 p-6 text-center md:col-span-4"
            >
              <h3 className="text-2xl font-semibold tabular-nums">0</h3>
              <p className="mt-1 text-sm text-muted-foreground">全部产品</p>
            </button>
            <button
              type="button"
              className="col-span-12 rounded-lg border border-chart-2/20 bg-chart-2/12 p-6 text-center md:col-span-4"
            >
              <h3 className="text-2xl font-semibold tabular-nums">0</h3>
              <p className="mt-1 text-sm text-muted-foreground">已发布</p>
            </button>
            <button
              type="button"
              className="col-span-12 rounded-lg border border-chart-4/20 bg-chart-4/12 p-6 text-center md:col-span-4"
            >
              <h3 className="text-2xl font-semibold tabular-nums">0</h3>
              <p className="mt-1 text-sm text-muted-foreground">草稿</p>
            </button>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-72">
              <SearchIcon
                size={16}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="搜索产品名称或 ID…"
                className="pl-8"
                aria-label="搜索产品"
                disabled
              />
            </div>
            <Button type="button" className="shrink-0 gap-1" disabled>
              <PackagePlus className="size-4" aria-hidden />
              创建产品
            </Button>
          </div>

          <Empty className="rounded-lg border border-dashed py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package aria-hidden />
              </EmptyMedia>
              <EmptyTitle>还没有产品</EmptyTitle>
              <EmptyDescription>
                创建产品后可编辑物模型（属性 / 动作 / 事件），校验并发布版本。设备管理稍后开放。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" disabled>
                创建第一个产品
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectProductsPage;
