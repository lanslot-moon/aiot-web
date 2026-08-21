import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronDown, Loader2, Pencil } from 'lucide-react';
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
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  OpenPlatformApiError,
  useOpenPlatform,
  useProjectDetail,
} from '@/context/open-platform-context';
import type { ProjectView } from '@/types/apps/open-platform';

/** Primary IA: 产品 / 设备 / 设置 — settings holds former heavy tabs. */
type PrimaryTab = 'products' | 'devices' | 'settings';

type SettingsTab =
  | 'settings'
  | 'members'
  | 'authorization'
  | 'usage'
  | 'subscriptions';

const PRIMARY_TABS: {
  id: PrimaryTab;
  label: string;
  path: (id: string) => string;
}[] = [
  { id: 'products', label: '产品', path: (id) => `/projects/${id}/products` },
  { id: 'devices', label: '设备', path: (id) => `/projects/${id}/devices` },
  { id: 'settings', label: '设置', path: (id) => `/projects/${id}/settings` },
];

const SETTINGS_TABS: {
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
  if (pathname.includes('/devices')) return 'devices';
  if (
    pathname.includes('/settings') ||
    pathname.includes('/overview') ||
    pathname.includes('/members') ||
    pathname.includes('/authorization') ||
    pathname.includes('/usage') ||
    pathname.includes('/subscriptions')
  ) {
    return 'settings';
  }
  return 'products';
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
  /** Optional override; otherwise derived from URL. */
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

  const canManageStatus = project?.myRole === 'OWNER' || project?.myRole === 'ADMIN';
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
      toast.success('Project 已更新');
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
        toast.success('Project 已关闭');
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
      title: '恢复 Project',
      description: '恢复后允许按授权与 Policy 继续创建资源和调用 API。',
      confirm: '恢复',
    },
    suspend: {
      title: '暂停 Project',
      description: `将暂停「${project?.projectName ?? ''}」：禁止新建资源与新的 Project API 调用，之后可恢复。`,
      confirm: '暂停',
    },
    archive: {
      title: '归档 Project',
      description: '归档后不可再新建资源、成员、邀请和凭证，工作区只读。',
      confirm: '归档',
    },
    close: {
      title: '关闭 Project',
      description:
        'CLOSED 为终态，不可恢复。请输入 Project 名称并勾选确认后继续。',
      confirm: '关闭 Project',
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {isLoading && !project ? (
        <Card className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-9 w-full max-w-md" />
          </div>
        </Card>
      ) : error && !project ? (
        <ApiErrorAlert
          code={(error as OpenPlatformApiError).code}
          message={error.message}
          onRetry={() => void mutate()}
        />
      ) : project ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="space-y-4 border-b py-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 h-7 gap-1 text-muted-foreground"
              nativeButton={false}
              render={<Link to="/projects" />}
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              全部项目
            </Button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold tracking-tight">
                    {project.projectName}
                  </h2>
                  <ProjectStatusBadge status={project.status} />
                  <RoleBadge role={project.myRole} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">{project.projectId}</span>
                  <CopyIdButton value={project.projectId} label="Project ID" />
                  {project.description ? (
                    <>
                      <span className="text-border">·</span>
                      <span className="line-clamp-1 max-w-xl">{project.description}</span>
                    </>
                  ) : null}
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
                            状态操作
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

            <Tabs
              value={primaryTab}
              onValueChange={(value) => {
                const tab = PRIMARY_TABS.find((t) => t.id === value);
                if (tab) navigate(tab.path(project.projectId));
              }}
            >
              <TabsList variant="line" className="w-full justify-start gap-4 bg-transparent p-0">
                {PRIMARY_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 px-1">
                    {tab.label}
                    {tab.id === 'devices' ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        未发布
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {onSettings ? (
              <>
                <Separator />
                <Tabs
                  value={settingsTab}
                  onValueChange={(value) => {
                    const tab = SETTINGS_TABS.find((t) => t.id === value);
                    if (tab) navigate(tab.path(project.projectId));
                  }}
                >
                  <TabsList className="h-auto w-full flex-wrap justify-start">
                    {SETTINGS_TABS.map((tab) => (
                      <TabsTrigger key={tab.id} value={tab.id}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </>
            ) : null}
          </CardHeader>
        </Card>
      ) : null}

      {children}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 Project</DialogTitle>
            <DialogDescription>仅可修改名称与描述，不能改 Project ID。</DialogDescription>
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
              {lifecycleAction === 'close' && project ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="close-name">输入 Project 名称以确认</Label>
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
                    <span>我理解 CLOSED 不可恢复</span>
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
                      (closeNameConfirm !== project?.projectName || !closeAck))
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
