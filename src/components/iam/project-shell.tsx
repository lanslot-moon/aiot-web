import { segment } from '@/api/iam/client';
import type { ProjectDetailVO } from '@/api/iam/contracts';
import { useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router';

import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { ErrorNotice, Loading } from './shared';
import { useResource } from './shared-utils';

export function IamProjectShell({ title, children }: { title: string; children: ReactNode }) {
  const { projectId = '' } = useParams();
  const detail = useResource<ProjectDetailVO>(`/api/v1/projects/${segment(projectId)}`, 'project:view');
  useEffect(() => { document.title = `${title} · AIoT`; }, [title]);
  return (
    <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4">
      <BreadcrumbComp title={title} items={[
        { title: '全部项目', to: '/projects' },
        { title: detail.data?.project.projectName ?? '当前项目', to: title === '项目概览' ? undefined : `/projects/${segment(projectId)}/overview` },
      ]} />
      <ErrorNotice error={detail.error} retry={() => detail.mutate()} />
      {!detail.data && !detail.error ? <Loading /> : detail.data ? (
        <ProjectWorkspaceShell navigationMode="sidebar" activePrimary={title === '项目概览' ? 'overview' : 'settings'}>
          {children}
        </ProjectWorkspaceShell>
      ) : null}
    </StyleAwareWrapper>
  );
}
