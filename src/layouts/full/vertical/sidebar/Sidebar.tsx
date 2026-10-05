import React from 'react';
import SimpleBar from 'simplebar-react';
import FullLogo from '../../shared/logo/FullLogo';
import NavCollapse from './nav-collapse';

import { ArrowLeft, FolderKanban } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Badge } from 'src/components/ui/badge';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader } from 'src/components/ui/sidebar';
import { useResource } from '../../../../components/iam/shared-utils';
import { useSidebar } from '../../../../components/ui/sidebar-hooks';

import type { ProjectDetailVO } from '@/api/iam/contracts';



import { useIam } from '../../../../context/iam-context/identity';

import { authorizedNavigation, personalCenterNavigation, platformMainNavigation, projectIdFromPath, projectNavigation } from '@/components/iam/menu-navigation';

const SidebarLayout = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const { isMobile, setOpenMobile } = useSidebar();
  const { authorization, platformAuthorization } = useIam();
  const { pathname } = useLocation();
  const projectId = projectIdFromPath(pathname);
  const detail = useResource<ProjectDetailVO>(projectId ? `/api/v1/projects/${encodeURIComponent(projectId)}` : null, 'project:view');
  const menu = authorizedNavigation(
    projectId ? projectNavigation(projectId) : platformMainNavigation,
    authorization.data?.menus ?? [],
    authorization.data?.permissionCodes ?? [],
    projectId,
    platformAuthorization.data?.permissionCodes ?? [],
  );

  const accountMenu = authorizedNavigation(
    [{ items: personalCenterNavigation }],
    platformAuthorization.data?.menus ?? [],
    platformAuthorization.data?.permissionCodes ?? [],
  );

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      {...props}
      className="sidebar-box **:data-[slot=sidebar-inner]:bg-background **:data-[slot=sidebar-inner]:border **:data-[slot=sidebar-inner]:border-border group-data-[state=collapsed]:hover:shadow-xl"
      side="left"
    >
      <SidebarHeader className="p-3 group-data-[state=collapsed]:px-2.5 flex flex-row items-center justify-between border-b border-border">
        <FullLogo />
        <Badge className="group-data-[state=collapsed]:hidden" variant="secondary">V.1.0</Badge>
      </SidebarHeader>

      <SidebarContent>
        <SimpleBar style={{ height: '100%' }}>
          {projectId && <div className="border-b p-3 group-data-[state=collapsed]:hidden">
              <Link to="/projects" onClick={() => { if (isMobile) setOpenMobile(false); }} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-ring"><ArrowLeft className="size-4" />返回全部项目</Link>
              <div className="mt-2 flex items-start gap-2 px-2 py-2">
                <FolderKanban className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0"><p className="break-words text-sm font-medium">{detail.data?.project.projectName ?? (detail.error ? '项目不可访问' : '正在加载项目…')}</p><p className="mt-1 text-xs text-muted-foreground">项目工作台</p></div>
              </div>
          </div>}
          <SidebarGroup className="flex items-center justify-center group-data-[state=collapsed]:px-2 px-3 py-4">
            <div className="px-0 group-data-[state=collapsed]:px-0 w-full flex flex-col gap-4">
              <NavCollapse menu={menu} className="text-sm" />
            </div>
          </SidebarGroup>
        </SimpleBar>
      </SidebarContent>

      {accountMenu.length > 0 && <SidebarFooter className="border-t p-4">
        <NavCollapse menu={accountMenu} className="text-sm" />
      </SidebarFooter>}
    </Sidebar>
  );
};

export default SidebarLayout;
