import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Check, ChevronsUpDown, FolderKanban, Loader2 } from 'lucide-react';

import { Button } from 'src/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'src/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from 'src/components/ui/popover';
import { useOpenPlatform } from 'src/context/open-platform-context';
import { cn } from 'src/lib/utils';

const WORKSPACE_SEGMENTS = [
  'products',
  'devices',
  'settings',
  'overview',
  'members',
  'authorization',
  'usage',
  'subscriptions',
  'thing-model',
] as const;

/** Header sits outside Outlet — parse projectId from pathname, not useParams. */
function projectIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (!match) return undefined;
  const id = match[1];
  if (id === 'new') return undefined;
  return id;
}

/** Prefer product main path when switching; keep settings sub-routes. */
function resolveWorkspaceSuffix(pathname: string, projectId: string | undefined): string {
  if (!projectId) return 'products';
  const prefix = `/projects/${projectId}/`;
  if (!pathname.startsWith(prefix)) return 'products';
  const rest = pathname.slice(prefix.length);
  const head = rest.split('/')[0];
  if (head === 'thing-model') return 'products';
  if (head === 'overview') return 'settings';
  if (WORKSPACE_SEGMENTS.includes(head as (typeof WORKSPACE_SEGMENTS)[number])) {
    return rest || 'products';
  }
  return 'products';
}

const ProjectSwitcher = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = projectIdFromPath(location.pathname);
  const { projects, listLoading, listError, setListFilters, listFilters } = useOpenPlatform();

  const current = useMemo(
    () => projects.find((p) => p.projectId === projectId) ?? null,
    [projects, projectId],
  );

  const handleSearch = (value: string) => {
    setListFilters((prev) => ({
      ...prev,
      keyword: value.trim() ? value.trim() : undefined,
      cursor: undefined,
    }));
  };

  const handleSelect = (nextProjectId: string) => {
    const suffix = resolveWorkspaceSuffix(location.pathname, projectId);
    setOpen(false);
    navigate(`/projects/${nextProjectId}/${suffix}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-[220px] justify-between px-3 font-normal"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {current?.projectName ?? (projectId ? projectId : 'Select project')}
          </span>
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search projects…"
            value={listFilters.keyword ?? ''}
            onValueChange={handleSearch}
          />
          <CommandList>
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : listError ? (
              <div className="px-3 py-6 text-center text-sm text-destructive">
                Failed to load projects
              </div>
            ) : (
              <>
                <CommandEmpty>No projects found.</CommandEmpty>
                <CommandGroup heading="Projects">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.projectId}
                      value={project.projectId}
                      data-checked={project.projectId === projectId || undefined}
                      onSelect={() => handleSelect(project.projectId)}
                    >
                      <FolderKanban className="size-4 text-muted-foreground" />
                      <span className="truncate">{project.projectName}</span>
                      <Check
                        className={cn(
                          'ml-auto size-4',
                          project.projectId === projectId ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
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
                View all projects
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProjectSwitcher;
