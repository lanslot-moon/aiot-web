import { Link, useLocation } from 'react-router';
import type { ProjectVO } from '@/api/iam/contracts';
import { Page, Panel, CursorTable, Status } from '@/components/iam/shared';
export default function ProjectEntry() {
  const location = useLocation();
  const suffix =
    location.pathname.includes('members') || location.pathname.includes('invitations')
      ? 'members'
      : location.pathname.includes('access-requests')
        ? 'access-requests'
        : 'authorization';
  return (
    <Page title="选择项目" description="先选择项目，再管理项目成员或 API 访问设置。">
      <Panel title="项目列表">
        <CursorTable<ProjectVO>
          path="/api/v1/projects"
          permission="project:view"
          filters
          columns={[
            {
              label: '项目',
              render: (row) => (
                <Link className="hover:underline" to={`/projects/${row.projectId}/${suffix}`}>
                  {row.projectName}
                </Link>
              ),
            },
            { label: '状态', render: (row) => <Status value={row.status} /> },
          ]}
        />
      </Panel>
    </Page>
  );
}
