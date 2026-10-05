import { put, segment } from '@/api/iam/client';
import type { ProjectDetailVO } from '@/api/iam/contracts';
import { useLocation, useParams } from 'react-router';
import { useSWRConfig } from 'swr';
import { useIam } from '../../context/iam-context/identity';

import { IamProjectShell } from '@/components/iam/project-shell';
import { Action, FieldsForm, Panel, Status } from '@/components/iam/shared';
import { epoch, reasonFields, useResource } from '../../components/iam/shared-utils';
export default function ProjectPage() {
  const { platformAuthorization: authorization, authorization: projectAuthorization } = useIam();
  const codes = authorization.data?.permissionCodes ?? [];
  const { projectId = '' } = useParams();
  const path = `/api/v1/projects/${segment(projectId)}`;
  const detail = useResource<ProjectDetailVO>(path, 'project:view');
  const { mutate } = useSWRConfig();
  const location = useLocation();
  const data = detail.data;
  const refresh = () => {
    void detail.mutate();
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith('/api/v1/projects'));
  };
  const transitions: Record<string, string[]> = {
    ACTIVE: ['SUSPENDED', 'ARCHIVED', 'CLOSED'],
    SUSPENDED: ['ACTIVE', 'ARCHIVED'],
    ARCHIVED: ['CLOSED'],
    CLOSED: [],
  };
  const labels: Record<string, string> = {
    ACTIVE: '恢复项目',
    SUSPENDED: '暂停项目',
    ARCHIVED: '归档项目',
    CLOSED: '关闭项目',
  };
  return (
    <IamProjectShell title={location.pathname.endsWith('/overview') ? '项目概览' : '项目设置'}>
      {location.pathname.endsWith('/overview') ? (
        <Panel title="项目概况">
          {data && <>
            <dl className="space-y-3 text-sm">
              <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-muted-foreground">项目说明</dt>
                <dd className="min-w-0 whitespace-pre-wrap break-words">{data.project.description?.trim() || '尚未填写项目说明'}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-muted-foreground">更新时间</dt>
                <dd>{epoch(data.project.updateTime)}</dd>
              </div>
            </dl>
            {data.myMember && <dl className="space-y-3 border-t pt-4 text-sm">
              <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-muted-foreground">我的成员状态</dt>
              <dd>
                <Status value={data.myMember.membershipStatus} />
              </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-muted-foreground">加入时间</dt>
                <dd>{epoch(data.myMember.joinedAt)}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"><dt className="text-muted-foreground">我的项目角色</dt><dd>{projectAuthorization.data?.roles.map((role) => role.roleName).join('、') || '未分配角色'}</dd></div>
            </dl>}
          </>}
        </Panel>
      ) : (
        <>
          <Panel title="基本信息">
            {data && (
              <FieldsForm
                key={data.project.updateTime}
                fields={[
                  { name: 'projectName', label: '项目名称', required: true, maxLength: 128 },
                  { name: 'description', label: '项目说明', type: 'textarea', maxLength: 512 },
                ]}
                initial={{
                  projectName: data.project.projectName ?? '',
                  description: data.project.description ?? '',
                }}
                label="保存项目"
                submitDisabled={!codes.includes('project:update')}
                onSave={async (values) => {
                  await put(path, values);
                  refresh();
                }}
              />
            )}
          </Panel>
          <Panel title="项目生命周期" description="暂停会限制项目使用，关闭不可恢复。">
            <div className="flex flex-wrap gap-2">
              {(transitions[data?.project.status ?? ''] ?? []).map((status) => (
                <Action
                  key={status}
                  label={labels[status]}
                  danger={status !== 'ACTIVE'}
                  permission="project:update"
                  fields={reasonFields}
                  description={`将项目「${data?.project.projectName}」${labels[status].replace('项目', '')}。${status === 'CLOSED' ? '关闭后无法恢复。' : '项目资源使用可能受到影响。'}`}
                  run={(values) => put(`${path}/lifecycle`, { ...values, status, confirm: true })}
                  done={refresh}
                />
              ))}
            </div>
          </Panel>
          <Panel
            title="转移所有权"
            description="转移后，目标账号成为项目所有者，你的项目管理权限可能变化。"
          >
            <Action
              label="转移所有权"
              danger
              permission="project:transfer"
              fields={[{ name: 'targetAccountId', label: '新所有者账号 ID', required: true }]}
              description={`将项目「${data?.project.projectName}」交给新所有者。`}
              run={(values) => put(`${path}/owner`, { ...values, confirm: true })}
              done={refresh}
            />
          </Panel>
        </>
      )}
    </IamProjectShell>
  );
}
