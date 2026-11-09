import { FC } from 'react';
import Sidebar from './vertical/sidebar/Sidebar';
import Header from './vertical/header/Header';
import { SidebarInset, SidebarProvider } from 'src/components/ui/sidebar';
import Footer from './shared/footer/Footer';
import { Link, Outlet, useLocation } from 'react-router';
import { ProjectScopeProvider } from '@/context/iam-context/project-scope';
import { useProjectAuthorization, useProjectDetail } from '@/context/iam-context/project-scope-context';
import { projectIdFromPath, canNavigate } from '@/components/iam/menu-navigation';
import { OpenPlatformApiError } from '@/api/iam/client';
import { useIam } from '@/context/iam-context/identity';
import { ErrorNotice, Loading } from '@/components/iam/shared';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';

function ProjectContent() {
  const authorization = useProjectAuthorization();
  const detail = useProjectDetail();
  const { platformAuthorization } = useIam();
  const { pathname } = useLocation();
  const projectId = projectIdFromPath(pathname);
  const section = projectId ? pathname.slice(`/projects/${projectId}/`.length).split('/')[0] || 'overview' : '';
  // 项目设置使用平台管理权限，项目停用后仍需允许管理生命周期。
  const pageAuthorization = section === 'settings' ? platformAuthorization : authorization;
  const codes = pageAuthorization?.data?.permissionCodes;
  if (projectId) {
    if (platformAuthorization.error) return <ErrorNotice error={platformAuthorization.error} retry={() => platformAuthorization.mutate()} />;
    if (!platformAuthorization.data) return <Loading />;
    if (!platformAuthorization.data.permissionCodes.includes('project:view')) return <ErrorNotice error={new OpenPlatformApiError('FORBIDDEN', '当前账号没有查看项目的权限。', 403)} />;
    if (detail?.error) return <ErrorNotice title="项目加载失败" error={detail.error} retry={() => detail.mutate()} />;
    if (!detail?.data) return <Loading />;
    const status = detail.data.project.status;
    if (status === 'CLOSED') return <Empty className="border py-12">
      <EmptyHeader>
        <EmptyTitle>项目已关闭，无法进入</EmptyTitle>
        <EmptyDescription>项目「{detail.data.project.projectName}」已永久关闭，无法恢复或进入工作台。</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link to="/projects" replace />}>返回全部项目</Button>
      </EmptyContent>
    </Empty>;
    if (status !== 'ACTIVE' && section !== 'settings') return <Empty className="border py-12">
      <EmptyHeader>
        <EmptyTitle>{status === 'SUSPENDED' ? '项目已暂停' : '项目已归档'}</EmptyTitle>
        <EmptyDescription>当前状态下无法进入业务工作台，可前往项目设置查看可执行的管理操作。</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link to={`/projects/${encodeURIComponent(projectId)}/settings`} />}>项目设置</Button>
        <Button variant="link" render={<Link to="/projects" />}>返回全部项目</Button>
      </EmptyContent>
    </Empty>;
  }
  if (pageAuthorization?.error) return <ErrorNotice presentation="empty" title={section === 'settings' ? '项目管理权限加载失败' : '项目权限加载失败'} error={pageAuthorization.error} retry={() => pageAuthorization.mutate()} />;
  if (pageAuthorization && !pageAuthorization.data) return <Loading />;
  if (pageAuthorization?.data && !canNavigate(section, codes ?? [])) return <ErrorNotice error={new OpenPlatformApiError('FORBIDDEN', '当前账号没有访问此功能的权限。', 403)} />;
  if (authorization?.data && pathname.endsWith('/model') && !authorization.data.permissionCodes.includes('thing-model:view')) return <ErrorNotice error={new OpenPlatformApiError('FORBIDDEN', '当前项目角色没有查看物模型的权限。', 403)} />;
  return <Outlet />;
}

const FullLayout: FC = () => {

  return (
    <ProjectScopeProvider><SidebarProvider
           defaultOpen={true}
      style={{ "--sidebar-width-icon": "52px" } as React.CSSProperties}
    >
      
        <Sidebar />
     
      <SidebarInset className="outline outline-border m-2 rounded-none! overflow-hidden">
        {/* Top Header  */}
       <Header /> 
        
        {/* Content fills the remaining space without assuming header/footer heights. */}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex-1"><ProjectContent /></div>
          <div className="shrink-0 pt-6"><Footer /></div>
        </div>
      </SidebarInset>
    </SidebarProvider></ProjectScopeProvider>
  );
};

export default FullLayout;
