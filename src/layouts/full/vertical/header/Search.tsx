import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Component, Search as SearchIcon, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import SimpleBar from 'simplebar-react';
import { useIam } from '../../../../context/iam-context/identity';

import { authorizedNavigation, navigationLinks, platformNavigation, projectIdFromPath, projectNavigation } from '@/components/iam/menu-navigation';

export default function Search() {
  const [query, setQuery] = useState('');
  const { pathname } = useLocation();
  const { authorization, platformAuthorization } = useIam();
  const projectId = projectIdFromPath(pathname);
  const items = useMemo(() => {
    const platformGroups = authorizedNavigation(platformNavigation, platformAuthorization.data?.menus ?? [], platformAuthorization.data?.permissionCodes ?? []);
    const groups = projectId ? [...authorizedNavigation(projectNavigation(projectId), authorization.data?.menus ?? [], authorization.data?.permissionCodes ?? [], projectId, platformAuthorization.data?.permissionCodes ?? []), ...platformGroups] : platformGroups;
    return navigationLinks(groups.flatMap((group) => group.items ?? []));
  }, [authorization.data, platformAuthorization.data, projectId]);
  const results = items.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const clear = () => { setQuery(''); document.getElementById('console-navigation-search')?.focus(); };
  return (
    <div className="relative w-xs" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setQuery('');
    }}>
      <div className="relative flex w-full items-center">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="console-navigation-search" aria-label="搜索菜单" placeholder="搜索菜单…"
          className="rounded-lg pl-10! pr-10!" value={query} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') clear(); }} />
        {query && <Button type="button" variant="ghost" size="icon" aria-label="清除菜单搜索"
          className="absolute right-0 size-9" onClick={clear}><X className="size-4" /></Button>}
      </div>
      {query.trim() && <div className="absolute start-0 top-11 z-10 w-full rounded-md border border-border bg-card shadow-md">
        <SimpleBar className="max-h-72 p-4">
          {results.length ? results.map((item) => <Link key={item.url} to={item.url!} onClick={() => setQuery('')}
            className="mb-1.5 flex w-full items-center gap-3 rounded-md bg-input/30 p-2 text-sm font-medium last:mb-0 hover:bg-primary/5 hover:text-primary focus-visible:outline focus-visible:outline-ring">
            <Component className="size-4 shrink-0" /><span>{item.name}</span>
          </Link>) : <p className="py-8 text-center text-sm text-muted-foreground" role="status">没有匹配的菜单</p>}
        </SimpleBar>
      </div>}
    </div>
  );
}
