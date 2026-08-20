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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  OpenPlatformApiError,
  useOpenPlatform,
  useProjectDetail,
} from '@/context/open-platform-context';
import { cn } from '@/lib/utils';
import type { ProjectView } from '@/types/apps/open-platform';

type WorkspaceTab =
  | 'overview'
  | 'thing-model'
  | 'members'
  | 'authorization'
  | 'usage'
  | 'subscriptions';

const TABS: { id: WorkspaceTab; label: string; path: (id: string) => string }[] = [
  { id: 'overview', label: '概览', path: (id) => `/projects/${id}/overview` },
  {
    id: 'thing-model',
    label: '物模型',
    path: (id) => `/projects/${id}/thing-model/products`,
  },
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

function tabFromPath(pathname: string): WorkspaceTab {
  if (pathname.includes('/thing-model')) return 'thing-model';
  if (pathname.includes('/members')) return 'members';
  if (pathname.includes('/authorization')) return 'authorization';
  if (pathname.includes('/usage')) return 'usage';
  if (pathname.includes('/subscriptions')) return 'subscriptions';
  return 'overview';
}

type LifecycleAction = 'activate' | 'suspend' | 'archive' | 'close';

export function ProjectWorkspaceShell({
  children,
  activeTab,
}: {
  children: React.ReactNode;
  activeTab?: WorkspaceTab;
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
  const currentTab = activeTab ?? tabFromPath(location.pathname);

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
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 gap-1"
          nativeButton={false}
          render={<Link to="/projects" />}
        >
          <ArrowLeft className="size-4" aria-hidden />
          返回 Project 列表
        </Button>
      </div>

      {isLoading && !project ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
      ) : error && !project ? (
        <ApiErrorAlert
          code={(error as OpenPlatformApiError).code}
          message={error.message}
          onRetry={() => void mutate()}
        />
      ) : project ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    {project.projectName}
                  </h2>
                  <ProjectStatusBadge status={project.status} />
                  <RoleBadge role={project.myRole} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Project ID</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {project.projectId}
                  </code>
                  <CopyIdButton value={project.projectId} label="Project ID" />
                </div>
                {project.description ? (
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
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
            </div>

            <nav
              className="flex flex-wrap gap-1 border-b border-border pb-0"
              aria-label="Project workspace tabs"
            >
              {TABS.map((tab) => {
                const active = currentTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    to={tab.path(project.projectId)}
                    className={cn(
                      'rounded-t-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'border-b-2 border-primary font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </CardContent>
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
