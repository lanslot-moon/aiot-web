import { Link, useLocation } from 'react-router';
import { useIam } from '../../../../context/iam-context/identity';

import { authorizedNavigation, settingsNavigation } from '@/components/iam/menu-navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PanelLeft, Settings } from 'lucide-react';
import { useSidebar } from '../../../../components/ui/sidebar-hooks';

import { cn } from '@/lib/utils';
import ProjectSwitcher from 'src/components/open-platform/project-switcher';
import { Button } from 'src/components/ui/button';
import { Separator } from 'src/components/ui/separator';
import { buttonVariants } from '../../../../components/ui/button-variants';
import FullLogo from '../../shared/logo/FullLogo';
import LightDark from './Light-Dark';
import Profile from './Profile';
import Search from './Search';

const Header = () => {
  const { toggleSidebar } = useSidebar();
  const { platformAuthorization: authorization } = useIam();
  const { pathname } = useLocation();
  const settings = authorizedNavigation([{ items: settingsNavigation }], authorization.data?.menus ?? [], authorization.data?.permissionCodes ?? []).flatMap((group) => group.items ?? []);
  const settingsActive = settings.some((item) => item.url === pathname);
  return (
    <header className="sticky top-0 z-2 border-b border-border bg-background">
      <nav aria-label="控制台工具栏">
        <div className="mx-auto flex items-center justify-between gap-2 p-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="block shrink-0 lg:hidden"><FullLogo /></div>
            <Button variant="ghost" size="icon" aria-label="切换导航菜单"
              className="shrink-0 cursor-pointer rounded-full p-2 transition hover:bg-primary/5"
              onClick={toggleSidebar}><PanelLeft size={21} /></Button>
            <Separator orientation="vertical" className="ml-2 mr-4 h-4 w-px self-center bg-border max-lg:hidden" />
            <ProjectSwitcher />
            <div className="hidden xl:block"><Search /></div>
          </div>
          <div className="flex shrink-0 items-center gap-0 sm:gap-1">{settings[0]?.url && <Tooltip>
            <TooltipTrigger render={<Link to={settings[0].url} />} aria-label="控制台设置"
              aria-current={settingsActive ? 'location' : undefined}
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'rounded-full aria-current:bg-muted')}>
              <Settings size={20} />
            </TooltipTrigger>
            <TooltipContent>控制台设置</TooltipContent>
          </Tooltip>}<LightDark /><Profile /></div>
        </div>
      </nav>
    </header>
  );
};
export default Header;
