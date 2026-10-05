import { put, segment } from '@/api/iam/client';
import type { ProjectInvitationVO } from '@/api/iam/contracts';
import { Action, ErrorNotice, Loading, Page, Panel, Status } from '@/components/iam/shared';
import { Link, useNavigate, useParams } from 'react-router';
import { useSWRConfig } from 'swr';
import { useIam } from '@/context/iam-context/identity';
import { epoch, useResource } from '../../components/iam/shared-utils';
export default function InvitationPage() {
  const navigate = useNavigate();
  const { platformAuthorization, account } = useIam();
  const { mutate } = useSWRConfig();
  const { invitationId = '' } = useParams();
  const path = `/api/v1/project-invitations/${segment(invitationId)}`;
  const invitation = useResource<ProjectInvitationVO>(path);
  const data = invitation.data;
  return (
    <Page title="项目邀请" description="核对邀请信息后选择是否加入。">
      <Panel title="邀请信息">
        <ErrorNotice error={invitation.error} retry={() => invitation.mutate()} />
        {invitation.isLoading ? (
          <Loading />
        ) : (
          data && (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt>项目 ID</dt>
                <dd>{data.projectId}</dd>
                <dt>受邀人</dt>
                <dd>{data.inviteeEmail ?? data.inviteeAccountId}</dd>
                <dt>状态</dt>
                <dd>
                  <Status value={data.status} />
                </dd>
                <dt>到期时间</dt>
                <dd>{epoch(data.expiresAt)}</dd>
              </dl>
              <p className="text-sm">当前登录：{account.data?.username || account.data?.email}</p>
              <p className="text-sm text-muted-foreground">角色 ID：<span className="break-all font-mono">{data.roleId}</span></p>
              <p className="text-xs text-muted-foreground">接受后建立项目成员关系，并获得本邀请指定的项目角色；不会复制新角色，也不改变其他项目的授权。</p>
              {data.status === 'ACCEPTED' && <Link className="block text-sm font-medium hover:underline" to={`/projects/${segment(data.projectId)}/overview`}>进入项目</Link>}
              {data.status === 'PENDING' && (
                <div className="flex gap-2">
                  {[
                    { status: 'ACCEPTED', label: '接受邀请' },
                    { status: 'REJECTED', label: '拒绝邀请' },
                  ].map((item) => (
                    <Action
                      key={item.status}
                      label={item.label}
                      danger={item.status === 'REJECTED'}
                      description={
                        item.status === 'ACCEPTED'
                          ? '接受后将加入此项目并获得邀请中指定的角色权限。'
                          : '拒绝后此邀请将失效。'
                      }
                      fields={[
                        {
                          name: 'invitationToken',
                          label: '邀请令牌',
                          type: 'password',
                          required: true,
                        },
                      ]}
                      run={(values) => put(path, { ...values, status: item.status })}
                      done={() => { void invitation.mutate(); if (item.status === 'ACCEPTED') { void platformAuthorization.mutate(); void mutate((key) => Array.isArray(key) && String(key[0]).startsWith('/api/v1/projects')); navigate(`/projects/${segment(data.projectId)}/overview`); } }}
                    />
                  ))}
                </div>
              )}
              <Link className="text-sm hover:underline" to="/projects">
                返回项目列表
              </Link>
            </>
          )
        )}
      </Panel>
    </Page>
  );
}
