import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  ChevronDown,
  Cpu,
  LayoutDashboard,
  Loader2,
  Package,
  Pencil,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProjectStatusBadge } from '@/components/open-platform/project-status-badge';
import { RoleBadge } from '@/components/open-platform/role-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  OpenPlatformApiError,
  useOpenPlatform,
  useProjectDetail,
} from '@/context/open-platform-context';
import { cn } from '@/lib/utils';
import type { ProjectView } from '@/types/apps/open-platform';

type PrimaryTab = 'overview' | 'products' | 'devices' | 'settings';

type SettingsTab =
  | 'settings'
  | 'members'
  | 'authorization'
  | 'usage'
  | 'subscriptions';

const PRIMARY_NAV: {
  id: PrimaryTab;
  label: string;
  icon: typeof Package;
  path: (id: string) => string;
  badge?: string;
}[] = [
  {
    id: 'overview',
    label: '概览',
    icon: LayoutDashboard,
    path: (id) => `/projects/${id}/overview`,
  },
  {
    id: 'products',
    label: '产品',
    icon: Package,
    path: (id) => `/projects/${id}/products`,
  },
  {
    id: 'devices',
    label: '设备',
    icon: Cpu,
    path: (id) => `/projects/${id}/devices`,
    badge: '未发布',
  },
  {
    id: 'settings',
    label: '项目设置',
    icon: Settings,
    path: (id) => `/projects/${id}/settings`,
  },
];

const SETTINGS_NAV: {
  id: SettingsTab;
  label: string;
  path: (id: string) => string;
}[] = [
  { id: 'settings', label: '基本信息', path: (id) => `/projects/${id}/settings` },
  { id: 'members', label: '成员与邀请', path: (id) => `/projects/${id}/members` },
  {
    id: 'authorization',
    label: 'API 授权',
    path: (id) => `/projects/${id}/authorization`,
  },
  { id: 'usage', label: '用量', path: (id) => `/projects/${id}/usage` },
  {
    id: 'subscriptions',
    label: '订阅',
    path: (id) => `/projects/${id}/subscriptions`,
  },
];

function primaryFromPath(pathname: string): PrimaryTab {
  if (pathname.includes('/products') || pathname.includes('/thing-model')) {
    return 'products';
  }
  if (pathname.includes('/devices')) return 'devices';
  if (
    pathname.includes('/settings') ||
    pathname.includes('/members') ||
    pathname.includes('/authorization') ||
    pathname.includes('/usage') ||
    pathname.includes('/subscriptions')
  ) {
    return 'settings';
  }
  return 'overview';
}

function settingsFromPath(pathname: string): SettingsTab {
  if (pathname.includes('/members')) return 'members';
  if (pathname.includes('/authorization')) return 'authorization';
  if (pathname.includes('/usage')) return 'usage';
  if (pathname.includes('/subscriptions')) return 'subscriptions';
  return 'settings';
}

type LifecycleAction = 'activate' | 'suspend' | 'archive' | 'close';

export function ProjectWorkspaceShell({
  children,
  activePrimary,
}: {
  children: React.ReactNode;
  activePrimary?: PrimaryTab;
}) {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    updateProject,
    activateProject,
    suspendProject,
    archiveProject,
    closeProject,
  } = useOpenPlatform();

  const { data: project, error, isLoading, mutate } = useProjectDetail(projectId);
  const primaryTab = activePrimary ?? primaryFromPath(location.pathname);
  const settingsTab = settingsFromPath(location.pathname);
  const onSettings = primaryTab === 'settings';

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(
    null,
  );
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [closeNameConfirm, setCloseNameConfirm] = useState('');
  const [closeAck, setCloseAck] = useState(false);

  const canManageStatus =
    project?.myRole === 'OWNER' || project?.myRole === 'ADMIN';
  const canEdit =
    project != null &&
    project.status === 'ACTIVE' &&
    (project.myRole === 'OWNER' || project.myRole === 'ADMIN');

  const statusActions = useMemo(() => {
    if (!project) return [] as LifecycleAction[];
    switch (project.status) {
      case 'ACTIVE':
        return ['suspend', 'archive', 'close'] as LifecycleAction[];
      case 'SUSPENDED':
        return ['activate', 'archive', 'close'] as LifecycleAction[];
      default:
        return [] as LifecycleAction[];
    }
  }, [project]);

  const openEdit = (p: ProjectView) => {
    setEditName(p.projectName);
    setEditDescription(p.description ?? '');
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!projectId || !editName.trim()) return;
    setEditSaving(true);
    try {
      await updateProject(projectId, {
        projectName: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      toast.success('项目已更新');
      setEditOpen(false);
      await mutate();
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '更新失败');
    } finally {
      setEditSaving(false);
    }
  };

  const runLifecycle = async () => {
    if (!projectId || !lifecycleAction || !project) return;
    if (lifecycleAction === 'close') {
      if (closeNameConfirm !== project.projectName || !closeAck) return;
    }
    setLifecycleBusy(true);
    try {
      if (lifecycleAction === 'activate') await activateProject(projectId);
      if (lifecycleAction === 'suspend') await suspendProject(projectId);
      if (lifecycleAction === 'archive') await archiveProject(projectId);
      if (lifecycleAction === 'close') {
        await closeProject(projectId);
        toast.success('项目已关闭');
        setLifecycleAction(null);
        navigate('/projects');
        return;
      }
      toast.success('状态已更新');
      setLifecycleAction(null);
      await mutate();
    } catch (e) {
      const err = e as OpenPlatformApiError;
      toast.error(err.message || '状态变更失败');
    } finally {
      setLifecycleBusy(false);
      setCloseNameConfirm('');
      setCloseAck(false);
    }
  };

  const lifecycleCopy: Record<
    LifecycleAction,
    { title: string; description: string; confirm: string }
  > = {
    activate: {
      title: '恢复项目',
      description: '恢复后可按授权继续创建资源与调用 API。',
      confirm: '恢复',
    },
    suspend: {
      title: '暂停项目',
      description: `将暂停「${project?.projectName ?? ''}」：禁止新建资源与新的 API 调用，之后可恢复。`,
      confirm: '暂停',
    },
    archive: {
      title: '归档项目',
      description: '归档后不可再新建资源、成员与凭证。',
      confirm: '归档',
    },
    close: {
      title: '关闭项目',
      description: 'CLOSED 为终态，不可恢复。请输入项目名称并勾选确认。',
      confirm: '关闭项目',
    },
  };

  if (isLoading && !project) {
    return (
      <Card className="p-6">
        <Skeleton className="mb-4 h-5 w-48" />
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  if (error && !project) {
    return (
      <ApiErrorAlert
        code={(error as OpenPlatformApiError).code}
        message={error.message}
        onRetry={() => void mutate()}
      />
    );
  }

  if (!project) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Project header — denser than first draft, richer than one-line strip */}
      <Card className="gap-0 px-5 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 -ml-2 gap-1 px-2 text-muted-foreground"
                nativeButton={false}
                render={<Link to="/projects" />}
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                全部项目
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold tracking-tight">
                  {project.projectName}
                </h2>
                <ProjectStatusBadge status={project.status} />
                <RoleBadge role={project.myRole} />
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {project.description?.trim()
                  ? project.description
                  : '暂无项目描述，可在「项目设置」中补充。'}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span>ID</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {project.projectId}
                  </code>
                  <CopyIdButton value={project.projectId} label="Project ID" />
                </span>
                <span>
                  创建 {new Date(project.createTime).toLocaleString()}
                </span>
                <span>
                  更新 {new Date(project.updateTime).toLocaleString()}
                </span>
              </div>
            </div>

            {onSettings ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => openEdit(project)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    编辑
                  </Button>
                ) : null}
                {canManageStatus && statusActions.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button type="button" variant="outline" size="sm" className="gap-1">
                          状态
                          <ChevronDown className="size-3.5" aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      {statusActions.includes('activate') ? (
                        <DropdownMenuItem onClick={() => setLifecycleAction('activate')}>
                          恢复
                        </DropdownMenuItem>
                      ) : null}
                      {statusActions.includes('suspend') ? (
                        <DropdownMenuItem onClick={() => setLifecycleAction('suspend')}>
                          暂停
                        </DropdownMenuItem>
                      ) : null}
                      {statusActions.includes('archive') ? (
                        <DropdownMenuItem onClick={() => setLifecycleAction('archive')}>
                          归档
                        </DropdownMenuItem>
                      ) : null}
                      {statusActions.includes('close') ? (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setCloseNameConfirm('');
                            setCloseAck(false);
                            setLifecycleAction('close');
                          }}
                        >
                          关闭
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Left nav + content — fills viewport like Tuya cloud console */}
      <Card className="overflow-hidden p-0">
        <div className="grid min-h-[calc(100vh-16rem)] md:grid-cols-[220px_1fr]">
          <aside className="border-b bg-muted/20 md:border-r md:border-b-0">
            <ScrollArea className="h-full">
              <nav className="flex flex-col gap-1 p-3" aria-label="项目功能">
                <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                  云开发
                </p>
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = primaryTab === item.id;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={active ? 'secondary' : 'ghost'}
                      className={cn(
                        'h-9 justify-start gap-2 px-2 font-normal',
                        active && 'bg-background shadow-sm',
                      )}
                      onClick={() => navigate(item.path(project.projectId))}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </Button>
                  );
                })}

                {onSettings ? (
                  <>
                    <Separator className="my-2" />
                    <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                      设置
                    </p>
                    {SETTINGS_NAV.map((item) => {
                      const active = settingsTab === item.id;
                      return (
                        <Button
                          key={item.id}
                          type="button"
                          variant={active ? 'secondary' : 'ghost'}
                          size="sm"
                          className={cn(
                            'h-8 justify-start px-2 font-normal',
                            active && 'bg-background shadow-sm',
                          )}
                          onClick={() => navigate(item.path(project.projectId))}
                        >
                          {item.label}
                        </Button>
                      );
                    })}
                  </>
                ) : null}
              </nav>
            </ScrollArea>
          </aside>

          <section className="min-w-0 p-4 md:p-6">{children}</section>
        </div>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
            <DialogDescription>仅可修改名称与描述</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-project-name">名称</Label>
              <Input
                id="edit-project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={128}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-project-desc">描述</Label>
              <Textarea
                id="edit-project-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={2048}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={!editName.trim() || editSaving}
              onClick={() => void submitEdit()}
            >
              {editSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={lifecycleAction != null}
        onOpenChange={(open) => {
          if (!open && !lifecycleBusy) {
            setLifecycleAction(null);
            setCloseNameConfirm('');
            setCloseAck(false);
          }
        }}
      >
        <AlertDialogContent>
          {lifecycleAction ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{lifecycleCopy[lifecycleAction].title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {lifecycleCopy[lifecycleAction].description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {lifecycleAction === 'close' ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="close-name">输入项目名称以确认</Label>
                    <Input
                      id="close-name"
                      value={closeNameConfirm}
                      onChange={(e) => setCloseNameConfirm(e.target.value)}
                      placeholder={project.projectName}
                      disabled={lifecycleBusy}
                    />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={closeAck}
                      onCheckedChange={(v) => setCloseAck(v === true)}
                      disabled={lifecycleBusy}
                    />
                    <span>我理解关闭后不可恢复</span>
                  </label>
                </div>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={lifecycleBusy}>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant={lifecycleAction === 'close' ? 'destructive' : 'default'}
                  disabled={
                    lifecycleBusy ||
                    (lifecycleAction === 'close' &&
                      (closeNameConfirm !== project.projectName || !closeAck))
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    void runLifecycle();
                  }}
                >
                  {lifecycleBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {lifecycleCopy[lifecycleAction].confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
