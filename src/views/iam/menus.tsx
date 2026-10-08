import { SettingsNavigation } from '@/components/iam/settings-navigation';
import type { MenuVO } from '@/api/iam/contracts';
import { DataTable, ErrorNotice, Loading, Page, Panel, Status } from '@/components/iam/shared';
import { useResource } from '../../components/iam/shared-utils';
import { ownerMenusPath } from '@/api/iam/authorization';
import { useIam } from '@/context/iam-context/identity';

export default function MenusPage() {
  const { account } = useIam();
  const owner = account.data?.accountId;
  const resource = useResource<MenuVO[]>(owner ? ownerMenusPath(owner) : null, 'menu:view');

  return (
    <Page breadcrumbs={[{ title: '控制台设置' }]} title="菜单目录" description="查看当前账号的菜单目录。创建角色时选择项目权限，决定成员可访问的功能与操作。">
      <SettingsNavigation />
      <Panel title="账号菜单目录" description="此页面提供目录查询。实际可见菜单由后端按当前权限和菜单层级筛选。">
        <ErrorNotice error={resource.error} retry={() => resource.mutate()} />
        {resource.error ? null : resource.isLoading ? <Loading /> : (
          <DataTable
            rows={resource.data ?? []}
            columns={[
              { label: '菜单', render: (row) => <div><p>{row.menuName}</p><p className="text-xs text-muted-foreground">{row.menuCode} · {row.menuType === 'DIRECTORY' ? '目录' : '页面'}</p></div> },
              { label: '路由', render: (row) => row.route ?? '—' },
              { label: '权限码', render: (row) => row.permissionCode ?? '—' },
              { label: '状态', render: (row) => <Status value={row.status} /> },
            ]}
          />
        )}
      </Panel>
    </Page>
  );
}
