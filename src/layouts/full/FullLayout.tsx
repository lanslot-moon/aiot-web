import { FC } from 'react';
import Sidebar from './vertical/sidebar/Sidebar';
import Header from './vertical/header/Header';
import { SidebarInset, SidebarProvider } from 'src/components/ui/sidebar';
import Footer from './shared/footer/Footer';
import { Outlet, useLocation } from 'react-router';
import { ProjectScopeProvider } from '@/context/iam-context/project-scope';
import { useProjectAuthorization } from '@/context/iam-context/project-scope-context';
import { projectIdFromPath, canNavigate } from '@/components/iam/menu-navigation';
import { OpenPlatformApiError } from '@/api/iam/client';
import { useIam } from '@/context/iam-context/identity';
import { ErrorNotice, Loading } from '@/components/iam/shared';

function ProjectContent() {
  const authorization = useProjectAuthorization();
  const { platformAuthorization } = useIam();
  const { pathname } = useLocation();
  const projectId = projectIdFromPath(pathname);
  const section = projectId ? pathname.slice(`/projects/${projectId}/`.length).split('/')[0] || 'overview' : '';
  const codes = section === 'settings' ? platformAuthorization.data?.permissionCodes : authorization?.data?.permissionCodes;
  if (authorization?.error) return <ErrorNotice error={authorization.error} retry={() => authorization.mutate()} />;
  if (authorization && !authorization.data) return <Loading />;
  if (authorization?.data && !canNavigate(section, codes ?? [])) return <ErrorNotice error={new OpenPlatformApiError('FORBIDDEN', '当前项目角色没有访问此功能的权限。', 403)} />;
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
