import { ChevronsUpDown, FolderKanban, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import useSWR from 'swr';

import { Button } from 'src/components/ui/button';
import {
Command,
CommandGroup,
CommandInput,
CommandItem,
CommandList,
CommandSeparator,
} from 'src/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from 'src/components/ui/popover';
import { projectsListKey } from '../../context/open-platform-context/project-resources';

import type { CursorResult, ProjectView } from '@/types/apps/open-platform';
import { useResource } from '../iam/shared-utils';

import { canNavigate, projectIdFromPath, projectSection } from '@/components/iam/menu-navigation';
import { useIam } from '../../context/iam-context/identity';

import { get, segment } from '@/api/iam/client';
import type { ProjectDetailVO } from '@/api/iam/contracts';

const ProjectSwitcher = () => {
  const { platformAuthorization: authorization, session } = useIam();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = projectIdFromPath(location.pathname);
  const detail = useResource<ProjectDetailVO>(
    projectId ? `/api/v1/projects/${segment(projectId)}` : null,
    'project:view',
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [composing, setComposing] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = useSWR<CursorResult<ProjectView>>(
    open && session && authorization.data?.permissionCodes.includes('project:view')
      ? [projectsListKey({ keyword: keyword || undefined, cursor }), session.sessionId, 'project-switcher']
      : null,
    ([path]) => get<CursorResult<ProjectView>>(path),
    { shouldRetryOnError: false },
  );
  const projects = list.data?.items ?? [];
  const listLoading = list.isLoading;
  const listError = list.error;
  const nextCursor = list.data?.nextCursor;
  const hasMore = list.data?.hasMore;
  const commitSearch = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setKeyword(value.trim());
    setCursor(undefined);
  };
  useEffect(() => {
    if (!open || composing) return;
    searchTimer.current = setTimeout(() => { setKeyword(search.trim()); setCursor(undefined); }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, composing, open]);

  const handleSelect = (nextProjectId: string) => {
    const section = projectSection(location.pathname);
    const suffix = canNavigate(section, authorization.data?.permissionCodes ?? []) ? section : 'overview';
    setOpen(false);
    navigate(`/projects/${segment(nextProjectId)}/${suffix}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={!authorization.data?.permissionCodes.includes('project:view')}
            aria-label="选择或切换项目"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-[170px] justify-between sm:w-[220px] px-3 font-normal"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {detail.data?.project.projectName ??
              (projectId ? (detail.error ? '项目不可访问' : '正在加载项目') : '进入项目')}
          </span>
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="relative">
          <CommandInput
            ref={searchRef}
            className="pr-8"
            placeholder="搜索项目…"
            value={search}
            onValueChange={setSearch}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing && !composing) {
                if (search.trim() !== keyword) { event.preventDefault(); event.stopPropagation(); commitSearch(search); }
              }
            }}
          />
          {search && <Button variant="ghost" size="icon-sm" aria-label="清除切换项目搜索" className="absolute right-1 top-1" onClick={() => { setSearch(''); commitSearch(''); searchRef.current?.focus(); }}><X className="size-4" /></Button>}
          </div>
          <CommandList>
            {listLoading ? (
              <div role="status" className="flex min-h-24 items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                正在加载…
              </div>
            ) : listError ? (
              <div className="min-h-24 space-y-2 px-3 py-6 text-center text-sm text-destructive">
                <p role="alert">项目加载失败</p>
                <Button variant="outline" onClick={() => void list.mutate()}>
                  重试
                </Button>
              </div>
            ) : (
              <>
                {projects.length === 0 && <div role="status" className="flex min-h-24 items-center justify-center py-6 text-center text-sm text-muted-foreground">没有找到项目</div>}
                <CommandGroup heading="项目">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.projectId}
                      value={project.projectId}
                      className={
                        project.projectId === projectId
                          ? 'bg-accent text-accent-foreground [&_svg]:text-accent-foreground'
                          : undefined
                      }
                      data-checked={project.projectId === projectId || undefined}
                      onSelect={() => handleSelect(project.projectId)}
                    >
                      <FolderKanban className="size-4 text-muted-foreground" />
                      <span className="truncate">{project.projectName}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          {(hasMore || cursor) && <div className="flex items-center justify-between border-t px-3 py-2">
            <Button variant="ghost" size="sm" disabled={listLoading || !cursor} onClick={() => setCursor(undefined)}>返回首页</Button>
            <Button variant="ghost" size="sm" disabled={listLoading || !hasMore || !nextCursor} onClick={() => setCursor(nextCursor ?? undefined)}>下一页</Button>
          </div>}
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__all_projects__"
                onSelect={() => {
                  setOpen(false);
                  navigate('/projects');
                }}
              >
                查看全部项目
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProjectSwitcher;
