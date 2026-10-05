import { put } from '@/api/iam/client';
import type { AccountVO } from '@/api/iam/contracts';
import { UserRound } from 'lucide-react';
import { useEffect } from 'react';
import { useIam } from '../../context/iam-context/identity';

import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import StyleDivider from '@/components/shared/StyleDivider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { AvatarEditor } from './avatar-editor';
import { canNavigate } from './menu-navigation';
import { Action, ErrorNotice, Loading, Navigation, Status } from './shared';
import { epoch } from './shared-utils';

const links = [
  { to: '/account/profile', label: '个人资料' },
  { to: '/account/security', label: '账号安全' },
  { to: '/account/sessions', label: '登录设备' },
  { to: '/account/access-requests', label: '我的加入申请' },
];

/** Compact account facts built from the existing profile primitives. */
export function AccountProfile() {
  useEffect(() => { document.title = '个人资料 · AIoT'; }, []);
  const { account, authorization } = useIam();
  const data = account.data;
  const codes = authorization.data?.permissionCodes ?? [];
  return (
    <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4">
      <BreadcrumbComp title="个人资料" items={[{ title: '全部项目', to: '/projects' }]} />
      <StyleDivider />
      <div className="bg-background p-4 md:p-6">
        <Navigation links={links.filter((link) => canNavigate(link.to, codes))} />
      </div>
      <ErrorNotice error={account.error} retry={() => account.mutate()} />
      {account.isLoading ? <Loading /> : data && <>
        <div className="bg-background px-4 pb-4 md:px-6 md:pb-6">
          <Card className="max-w-3xl gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="size-16! shrink-0">
                  <AvatarImage src={data.avatarUrl ?? undefined} alt="账号头像" />
                  <AvatarFallback>{(data.displayName || data.username)?.slice(0, 2).toUpperCase() || <UserRound className="size-6" />}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-2">
                  <h2 className="card-title break-all">{data.displayName || data.username}</h2>
                  {codes.includes('account:update') && <AvatarEditor account={data} />}
                </div>
              </div>
              <Action label="编辑资料" permission="account:update"
                description="显示名称用于个人资料展示，不修改登录用户名。"
                fields={[{ name: 'displayName', label: '显示名称', maxLength: 64 }]}
                initial={{ displayName: data.displayName ?? '' }}
                run={async (values) => {
                  const updated = await put<AccountVO>('/api/v1/accounts/current/profile', values);
                  await account.mutate(updated, { revalidate: false });
                }} />
            </div>
            <dl className="divide-y px-4 text-sm [&>div]:grid [&>div]:grid-cols-[6rem_minmax(0,1fr)] [&>div]:gap-3 [&>div]:py-3 [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-all sm:[&>div]:grid-cols-[8rem_minmax(0,1fr)]">
              <div><dt>显示名称</dt><dd>{data.displayName || '未设置'}</dd></div>
              <div><dt>用户名</dt><dd>{data.username}</dd></div>
              <div><dt>邮箱</dt><dd>{data.email || '尚未绑定'}</dd></div>
              <div><dt>手机号</dt><dd>{data.phone || '尚未绑定'}</dd></div>
              <div><dt>账号 ID</dt><dd className="font-mono text-xs">{data.accountId}</dd></div>
              <div><dt>账号状态</dt><dd><Status value={data.status} /></dd></div>
              <div><dt>创建时间</dt><dd>{epoch(data.createTime)}</dd></div>
              <div><dt>更新时间</dt><dd>{epoch(data.updateTime)}</dd></div>
            </dl>
            <details className="border-t p-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">当前访问权限</summary>
              <div className="mt-3 flex flex-wrap gap-2">{authorization.data?.roles.map((role) => <Status key={role.roleId} value={role.roleName} />)}</div>
              <ul className="mt-3 max-h-64 space-y-2 overflow-auto">{codes.map((code) => <li key={code} className="break-all font-mono text-xs">{code}</li>)}</ul>
            </details>
          </Card>
        </div>
      </>}
    </StyleAwareWrapper>
  );
}
