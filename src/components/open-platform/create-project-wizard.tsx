import { Link, useNavigate } from 'react-router';
import type { ProjectCreateVO } from '@/api/iam/contracts';
import { post, segment } from '@/api/iam/client';
import { usePermission } from '@/context/iam-context/identity';
import { FieldsForm, Panel } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { useSWRConfig } from 'swr';

export function CreateProjectWizard() {
  const canCreate = usePermission('project:create');
  const { mutate } = useSWRConfig();
  const navigate = useNavigate();
  return <Panel title="项目信息" description="创建后直接进入项目工作台。角色配置和成员邀请可以在需要时进行。">
    <div className="max-w-2xl space-y-4">
      <FieldsForm fields={[
        { name: 'projectName', label: '项目名称', required: true, maxLength: 128, hint: '例如：智能园区。名称显示在项目列表与切换器中。' },
        { name: 'description', label: '项目说明', type: 'textarea', maxLength: 512, hint: '选填，可在项目设置中修改。' },
      ]} label="创建项目" submitDisabled={!canCreate} onSave={async (values) => {
        const result = await post<ProjectCreateVO>('/api/v1/projects', { projectName: values.projectName.trim(), description: values.description.trim() || undefined });
        void mutate((key) => Array.isArray(key) && String(key[0]).startsWith('/api/v1/projects'));
        navigate(`/projects/${segment(result.project.projectId)}/overview`);
      }} />
      {!canCreate && <p className="text-sm text-muted-foreground">当前账号没有创建项目的权限。</p>}
      <Button variant="ghost" nativeButton={false} render={<Link to="/projects" />}>返回项目列表</Button>
    </div>
  </Panel>;
}
