import { useNavigate } from 'react-router';
import { post } from '@/api/iam/client';
import type { ProjectCreateVO } from '@/api/iam/contracts';
import { Page, Panel, FieldsForm } from '@/components/iam/shared';
export default function NewProject() {
  const navigate = useNavigate();
  return (
    <Page title="创建项目">
      <Panel title="项目信息">
        <FieldsForm
          fields={[
            { name: 'projectName', label: '项目名称', required: true, maxLength: 128 },
            { name: 'description', label: '项目说明', type: 'textarea', maxLength: 512 },
          ]}
          label="创建项目"
          onSave={async (values) => {
            const response = await post<ProjectCreateVO>('/api/v1/projects', values);
            navigate(`/projects/${response.project.projectId}/overview`);
          }}
        />
      </Panel>
    </Page>
  );
}
