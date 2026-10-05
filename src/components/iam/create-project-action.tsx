import { useNavigate } from 'react-router';
import { useSWRConfig } from 'swr';
import { post, segment } from '@/api/iam/client';
import type { ProjectCreateVO } from '@/api/iam/contracts';
import { Action } from './shared';
export function CreateProjectAction() {
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  return <Action label="创建项目" permission="project:create" description="填写基本信息后直接进入项目工作台。成员邀请是项目内的可选操作。" fields={[
    { name: 'projectName', label: '项目名称', required: true, maxLength: 128 },
    { name: 'description', label: '项目说明', type: 'textarea', maxLength: 512 },
  ]} run={async (values) => {
    const result = await post<ProjectCreateVO>('/api/v1/projects', { projectName: values.projectName.trim(), description: values.description.trim() || undefined });
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith('/api/v1/projects'));
    navigate(`/projects/${segment(result.project.projectId)}/overview`);
  }} />;
}
