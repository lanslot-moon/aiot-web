import { Link, useParams } from 'react-router';
import { PackagePlus } from 'lucide-react';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';

/**
 * Project-scoped product home — main path after creating/opening a Project.
 * Product CRUD / thing-model editor hooks in here later (still Project-scoped).
 */
const ProjectProductsPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col p-px gap-px bg-border"
      defaultClassName="flex flex-col gap-4"
    >
      <BreadcrumbComp title="产品" />
      <StyleDivider />
      <ProjectWorkspaceShell activePrimary="products">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">产品</h3>
            <p className="text-sm text-muted-foreground">
              在当前 Project 下管理产品与物模型；这是创建 Project 后的主路径。
            </p>
          </div>
          <Button type="button" size="sm" className="gap-1" disabled title="物模型创建向导下一阶段接入">
            <PackagePlus className="size-3.5" aria-hidden />
            创建产品
          </Button>
        </div>

        <Empty className="border border-dashed bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackagePlus aria-hidden />
            </EmptyMedia>
            <EmptyTitle>还没有产品</EmptyTitle>
            <EmptyDescription>
              创建第一个产品后，可继续编辑物模型草稿、校验并发布 revision。设备管理尚未发布。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" disabled>
              创建产品（即将接入）
            </Button>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/projects/${projectId}/settings`} />}
            >
              项目设置
            </Button>
          </EmptyContent>
        </Empty>
      </ProjectWorkspaceShell>
    </StyleAwareWrapper>
  );
};

export default ProjectProductsPage;
