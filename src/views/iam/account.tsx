import { post, put, remove, segment, setSession } from '@/api/iam/client';
import type {
ProjectAccessRequestVO,
SessionVO,
} from '@/api/iam/contracts';
import { AccountProfile } from '@/components/iam/account-profile';
import { ContactChangeAction } from '@/components/iam/contact-change-action';
import { canNavigate } from '@/components/iam/menu-navigation';
import { SessionDetailsAction } from '@/components/iam/session-details-action';
import { useLocation, useNavigate } from 'react-router';
import { useSWRConfig } from 'swr';
import { useIam } from '../../context/iam-context/identity';

import { Action, CursorTable, ErrorNotice, Loading, Navigation, Page, Panel, Status } from '@/components/iam/shared';
import { epoch, reasonFields, type Field } from '../../components/iam/shared-utils';
const links = [
  { to: '/account/profile', label: '个人资料' },
  { to: '/account/security', label: '账号安全' },
  { to: '/account/sessions', label: '登录设备' },
  { to: '/account/access-requests', label: '我的加入申请' },
];
const passwordFields: Field[] = [
  {
    name: 'currentPassword',
    label: '当前密码',
    type: 'password',
    required: true,
    autoComplete: 'current-password',
  },
  {
    name: 'newPassword',
    label: '新密码',
    type: 'password',
    required: true,
    minLength: 8,
    maxLength: 128,
    hint: '8–128 个字符',
    autoComplete: 'new-password',
  },
  {
    name: 'confirmation',
    label: '确认新密码',
    type: 'password',
    required: true,
    autoComplete: 'new-password',
  },
];
export default function AccountPage() {
  const { account, session, authorization } = useIam();
  const { mutate } = useSWRConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const refresh = () => {
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith('/api/v1/accounts'));
  };
  if (location.pathname.endsWith('/profile')) return <AccountProfile />;
  return (
    <Page title={links.find((link) => link.to === location.pathname)?.label ?? '账号设置'} description="账号功能在所有项目间共用，切换项目不会改变这些设置。">
      <Navigation links={links.filter((link) => canNavigate(link.to, authorization.data?.permissionCodes ?? []))} />
      <ErrorNotice error={account.error} retry={() => account.mutate()} />
      {account.isLoading ? (
        <Loading />
      ) : location.pathname.endsWith('/security') ? (
        account.data && <Panel title="安全设置">
          <div className="divide-y">
            <div className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">登录密码</h3>
                <p className="text-sm text-muted-foreground">修改后需要重新登录。</p>
              </div>
              <Action
                label="修改密码"
                fields={passwordFields}
                description="保存新密码后，所有设备需要重新登录。"
                run={async (values) => {
                  if (values.newPassword !== values.confirmation)
                    throw new Error('两次输入的新密码不一致。');
                  await put('/api/v1/accounts/current/password', {
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                  });
                  setSession(null);
                  navigate('/auth/auth2/login', { replace: true });
                }}
                permission="account:update"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-medium">邮箱</h3>
                <p className="break-all text-sm text-muted-foreground">{account.data?.email || '未绑定'}</p>
              </div>
              <ContactChangeAction type="EMAIL" current={account.data?.email} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-medium">手机号</h3>
                <p className="break-all text-sm text-muted-foreground">{account.data?.phone || '未绑定'}</p>
              </div>
              <ContactChangeAction type="PHONE" current={account.data?.phone} />
            </div>
          </div>
        </Panel>
      ) : location.pathname.endsWith('/sessions') ? (
        <Panel
          title="登录设备"
          description="退出陌生或不再使用的设备。"
          actions={
            <Action
              label="退出其他设备"
              danger
              fields={reasonFields}
              description="保留当前设备，退出其他全部登录会话。"
              permission="session:manage"
              run={(values) =>
                remove('/api/v1/accounts/current/sessions', {
                  ...values,
                  exceptSessionId: session?.sessionId,
                })
              }
              done={refresh}
            />
          }
        >
          <CursorTable<SessionVO>
            path="/api/v1/accounts/current/sessions"
            permission="session:manage"
            columns={[
              {
                label: '设备 / 会话',
                render: (row) => (
                  <div>
                    <p>
                      {row.clientType ?? '未知设备'}
                      {row.sessionId === session?.sessionId ? '（当前设备）' : ''}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">{row.sessionId}</p>
                  </div>
                ),
              },
              { label: '状态', render: (row) => <Status value={row.status} /> },
              { label: '最后活动', render: (row) => epoch(row.lastSeenAt) },
              { label: '到期时间', render: (row) => epoch(row.expiresAt) },
              {
                label: '操作',
                render: (row) => (
                  <div className="flex gap-2">
                    <SessionDetailsAction sessionId={row.sessionId} />
                    <Action
                      label="退出设备"
                      danger
                      fields={reasonFields}
                      description="此设备的登录会话会立即失效。"
                      permission="session:manage"
                      run={async (values) => {
                        await remove(
                          `/api/v1/accounts/current/sessions/${segment(row.sessionId ?? '')}`,
                          values,
                        );
                        if (row.sessionId === session?.sessionId) setSession(null);
                      }}
                      done={refresh}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Panel>
      ) : (
        <>
          <Panel
            title="我的加入申请"
            actions={
              <Action
                label="申请加入项目"
                description="输入项目 ID 向项目所有者提交申请。"
                fields={[
                  { name: 'projectId', label: '项目 ID', required: true },
                  { name: 'message', label: '申请说明', type: 'textarea', maxLength: 512 },
                  {
                    name: 'requestedRoleId',
                    label: '期望角色 ID',
                    required: true,
                    hint: '请向项目所有者获取可申请的角色 ID',
                  },
                ]}
                run={({ projectId, ...values }) =>
                  post(`/api/v1/projects/${segment(projectId)}/access-requests`, values)
                }
                done={refresh}
              />
            }
          >
            <CursorTable<ProjectAccessRequestVO>
              path="/api/v1/accounts/current/project-access-requests"
              columns={[
                { label: '项目', render: (row) => row.projectId },
                { label: '说明', render: (row) => row.message },
                { label: '状态', render: (row) => <Status value={row.status} /> },
                { label: '提交时间', render: (row) => epoch(row.createTime) },
                {
                  label: '操作',
                  render: (row) =>
                    row.status === 'PENDING' && (
                      <Action
                        label="撤回申请"
                        danger
                        description="撤回后项目所有者将无法继续审批此申请。"
                        run={() =>
                          remove(
                            `/api/v1/accounts/current/project-access-requests/${segment(row.requestId ?? '')}`,
                          )
                        }
                        done={refresh}
                      />
                    ),
                },
              ]}
            />
          </Panel>
        </>
      )}
    </Page>
  );
}
