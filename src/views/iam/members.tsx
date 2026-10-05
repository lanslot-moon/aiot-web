import { put, remove, request, segment } from '@/api/iam/client';
import type {
ProjectAccessRequestVO,
ProjectInvitationVO,
ProjectMemberVO,
} from '@/api/iam/contracts';
import { InvitationDetailsAction } from '@/components/iam/invitation-details-action';
import { MemberRolesAction } from '@/components/iam/member-roles-action';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemberDetailsAction } from '@/components/iam/member-details-action';
import { InviteMemberAction } from '@/components/iam/invite-member-action';
import { InvitationResult } from '@/components/iam/invitation-result';
import { useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { useSWRConfig } from 'swr';
import { useIam } from '../../context/iam-context/identity';

import { IamProjectShell } from '@/components/iam/project-shell';
import { useProjectRoleDirectory } from '@/components/iam/role-directory';
import { Action, CursorTable, Panel, Status } from '@/components/iam/shared';
import { epoch, optional, reasonFields } from '../../components/iam/shared-utils';
export default function MembersPage() {
  const { projectId = '' } = useParams();
  const location = useLocation();
  const base = `/api/v1/projects/${segment(projectId)}`;
  const { authorization } = useIam();
  const roles = useProjectRoleDirectory(projectId);
  const roleOptions = [
    { value: '', label: '请选择角色' },
    ...(roles.data?.items ?? [])
      .filter((r) => r.status === 'ACTIVE' && r.roleId !== 'PROJECT_OWNER')
      .map((r) => ({ value: r.roleId ?? '', label: r.roleName ?? '' })),
  ];
  const { mutate } = useSWRConfig();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'invitations' ? 'invitations' : 'members';
  const setTab = (value: string) => setParams((previous) => { const next = new URLSearchParams(previous); next.set('tab', value); return next; });
  const [invitation, setInvitation] = useState<ProjectInvitationVO | null>(null);
  const refresh = () => {
    void authorization.mutate();
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(base));
  };
  return (
    <IamProjectShell title={location.pathname.endsWith('/access-requests') ? '加入申请' : '成员与邀请'}>
      {location.pathname.endsWith('/access-requests') ? (
        <Panel title="加入申请" description="审批通过后建立项目成员关系，并授予选择的角色。">
          <CursorTable<ProjectAccessRequestVO>
            path={`${base}/access-requests`}
            permission="project-member:review"
            columns={[
              { label: '申请账号', render: (row) => row.applicantAccountId },
              { label: '申请说明', render: (row) => row.message },
              { label: '状态', render: (row) => <Status value={row.status} /> },
              { label: '时间', render: (row) => epoch(row.createTime) },
              {
                label: '操作',
                render: (row) =>
                  row.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Action
                        label="批准申请"
                        permission="project-member:review"
                        fields={[
                          {
                            name: 'approvedRoleId',
                            label: '授予角色',
                            required: true,
                            options: roleOptions,
                          },
                          ...reasonFields,
                        ]}
                        description="此账号将加入当前项目，并获得选定的访问权限。"
                        run={(values) =>
                          put(`${base}/access-requests/${segment(row.requestId ?? '')}`, {
                            ...values,
                            approvedRoleId: optional(values.approvedRoleId),
                            status: 'APPROVED',
                          })
                        }
                        done={refresh}
                      />
                      <Action
                        label="拒绝申请"
                        danger
                        permission="project-member:review"
                        fields={reasonFields}
                        run={(values) =>
                          put(`${base}/access-requests/${segment(row.requestId ?? '')}`, {
                            ...values,
                            status: 'REJECTED',
                          })
                        }
                        done={refresh}
                      />
                    </div>
                  ),
              },
            ]}
          />
        </Panel>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="flex-col gap-4">
          <TabsList aria-label="成员与邀请" className="h-9 w-fit flex-none self-start"><TabsTrigger value="members">项目成员</TabsTrigger><TabsTrigger value="invitations">邀请记录</TabsTrigger></TabsList>
          <TabsContent value="members">
          <Panel title="项目成员" description="角色只在当前项目生效。需要协作时再邀请成员。" actions={<InviteMemberAction projectId={projectId} onCreated={(result) => { refresh(); setTab('invitations'); setInvitation(result); }} />}>
            <CursorTable<ProjectMemberVO>
              path={`${base}/members`}
              permission="project-member:view"
              columns={[
                {
                  label: '成员',
                  render: (row) => (
                    <div>
                      {row.username ?? row.accountId}
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  ),
                },
                {
                  label: '账号 ID',
                  render: (row) => <span className="font-mono text-xs">{row.accountId}</span>,
                },
                { label: '项目角色', render: (row) => row.roles?.map((role) => role.roleName).join('、') || '未分配角色' },
                { label: '状态', render: (row) => <Status value={row.membershipStatus} /> },
                { label: '加入时间', render: (row) => epoch(row.joinedAt) },
                {
                  label: '操作',
                  render: (row) => (
                    <div className="flex gap-2">
                      <MemberDetailsAction projectId={projectId} accountId={row.accountId} />
                      <MemberRolesAction projectId={projectId} member={row} onSaved={refresh} />
                      {!row.roles?.some((role) => role.roleId === 'PROJECT_OWNER') && <Action
                        label="移除成员"
                        danger
                        permission="project-member:remove"
                        fields={reasonFields}
                        description={`将「${row.username ?? row.accountId}」移出项目，移除后撤销当前项目角色并失去成员身份，不影响其他项目。`}
                        run={(values) =>
                          remove(`${base}/members/${segment(row.accountId ?? '')}`, values)
                        }
                        done={refresh}
                      />}
                    </div>
                  ),
                },
              ]}
            />

          </Panel>
          </TabsContent>
          <TabsContent value="invitations">
          <Panel
            title="项目邀请"
            actions={<InviteMemberAction projectId={projectId} onCreated={(result) => { refresh(); setInvitation(result); }} />}
            description="邀请创建后由你分享给对方；接受前不会成为项目成员。"
          >
            <CursorTable<ProjectInvitationVO>
              path={`${base}/invitations`}
              permission="project-member:view"
              columns={[
                { label: '受邀用户', render: (row) => row.inviteeEmail ?? row.inviteeAccountId },
                { label: '授予角色', render: (row) => roles.data?.items.find((role) => role.roleId === row.roleId)?.roleName ?? row.roleId },
                { label: '状态', render: (row) => <Status value={row.status} /> },
                { label: '有效期', render: (row) => epoch(row.expiresAt) },
                {
                  label: '操作',
                  render: (row) => (
                    <div className="flex gap-2">
                      <InvitationDetailsAction invitation={row} roleName={roles.data?.items.find((role) => role.roleId === row.roleId)?.roleName} />
                      {row.status === 'PENDING' && (
                        <Action
                          label="撤销邀请"
                          danger
                          permission="project-member:revoke-invitation"
                          fields={reasonFields}
                          description="撤销后此邀请无法再被接受。"
                          run={(values) =>
                            request(
                              `/api/v1/project-invitations/${segment(row.invitationId ?? '')}`,
                              'DELETE',
                              values,
                              { projectId },
                            )
                          }
                          done={refresh}
                        />
                      )}
                    </div>
                  ),
                },
              ]}
            />

          </Panel>
          </TabsContent>
          <InvitationResult invitation={invitation} onClose={() => setInvitation(null)} />
        </Tabs>
      )}
    </IamProjectShell>
  );
}
