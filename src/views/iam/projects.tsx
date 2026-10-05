import { post } from '@/api/iam/client';
import type { ProjectCreateVO, ProjectVO } from '@/api/iam/contracts';
import { Action, CursorTable, Panel, Status } from '@/components/iam/shared';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSWRConfig } from 'swr';
import { epoch } from '../../components/iam/shared-utils';
export default function ProjectsPage() {
  useEffect(() => { document.title = '全部项目 · AIoT'; }, []);
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  return (
    <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4">
      <BreadcrumbComp title="全部项目" items={[]} />
      <Panel title="项目" description="进入项目后管理成员、API 凭证和项目设置。" actions={
        <Action
          label="创建项目"
          permission="project:create"
          fields={[
            { name: 'projectName', label: '项目名称', required: true, maxLength: 128 },
            { name: 'description', label: '项目说明', type: 'textarea', maxLength: 512 },
          ]}
          run={async (values) => {
            const result = await post<ProjectCreateVO>('/api/v1/projects', values);
            await mutate(
              (key) => Array.isArray(key) && String(key[0]).startsWith('/api/v1/projects'),
            );
            navigate(`/projects/${result.project.projectId}/overview`);
          }}
        />
      }>
        <CursorTable<ProjectVO>
          path="/api/v1/projects"
          permission="project:view"
          filters
          columns={[
            {
              label: '项目名称',
              render: (row) => (
                <Link
                  className="font-medium hover:underline"
                  to={`/projects/${row.projectId}/overview`}
                >
                  {row.projectName}
                </Link>
              ),
            },
            {
              label: '项目 ID',
              render: (row) => <span className="font-mono text-xs">{row.projectId}</span>,
            },
            { label: '说明', render: (row) => row.description ?? '—' },
            { label: '状态', render: (row) => <Status value={row.status} /> },
            { label: '创建时间', render: (row) => epoch(row.createTime) },
            { label: '操作', render: (row) => <Link className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline focus-visible:outline-ring" to={`/projects/${row.projectId}/overview`}>进入项目</Link> },
          ]}
        />
      </Panel>
    </StyleAwareWrapper>
  );
}
