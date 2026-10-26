import { formatDateTime } from '@/lib/date-time';
import { ChevronRight, Info, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import useSWR from 'swr';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
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
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OpenPlatformApiError, openPlatformDelete, openPlatformGetFetcher, openPlatformPost, openPlatformPut } from '../../../../context/open-platform-context/project-resources';

import { BreadcrumbTrail } from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import type { CursorResult, ParserProfileView } from '@/types/apps/open-platform';



const ParserProfilesPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const profileListPath = `/projects/${projectId}/parser-profiles`;
  const { data, error, isLoading, mutate } = useSWR<CursorResult<ParserProfileView>>(
    '/api/v1/parser-profiles?pageSize=100',
    openPlatformGetFetcher,
  );
  const [keyword, setKeyword] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ParserProfileView | null>(null);
  const [profileName, setProfileName] = useState('');
  const [protocolCode, setProtocolCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ParserProfileView | null>(null);
  const apiError = error as OpenPlatformApiError | undefined;
  const profiles = useMemo(() => data?.items ?? [], [data?.items]);
  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) =>
      [profile.profileName, profile.profileId, profile.protocolCode].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [keyword, profiles]);

  const openCreate = () => {
    setEditing(null);
    setProfileName('');
    setProtocolCode('');
    setDialogOpen(true);
  };

  const openEdit = (profile: ParserProfileView) => {
    setEditing(profile);
    setProfileName(profile.profileName);
    setProtocolCode(profile.protocolCode);
    setDialogOpen(true);
  };

  const saveProfile = async () => {
    if (!profileName.trim() || !protocolCode.trim()) {
      toast.error('请填写 Profile 名称和协议编码。');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await openPlatformPut(`/api/v1/parser-profiles/${editing.profileId}`, {
          profileName: profileName.trim(),
          protocolCode: protocolCode.trim(),
        });
        toast.success('Profile 信息已更新。');
      } else {
        await openPlatformPost('/api/v1/parser-profiles', {
          profileName: profileName.trim(),
          protocolCode: protocolCode.trim(),
        });
        toast.success('Parser Profile 已创建，请继续创建版本草稿。');
      }
      setDialogOpen(false);
      await mutate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '保存失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  const deleteProfile = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await openPlatformDelete(`/api/v1/parser-profiles/${deleteTarget.profileId}`);
      toast.success('Parser Profile 已删除。');
      setDeleteTarget(null);
      await mutate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '删除失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StyleAwareWrapper
      lyraClassName="flex flex-col gap-px bg-border p-px"
      defaultClassName="flex flex-col gap-4"
    >
      <ProjectWorkspaceShell activePrimary="parserProfiles" breadcrumbs={<BreadcrumbTrail
        title="协议解析"
        items={[{ to: '/projects', title: '项目' }, { title: '协议解析' }]}
      />}>
        <div className="flex flex-col gap-4">
        {showGuide && <Alert className="rounded-xl! border-primary/20 bg-primary/5 px-3 py-2.5 [&>svg]:text-primary">
          <Info className="size-4" aria-hidden />
          <AlertDescription>
            管理自定义报文到物模型能力的映射。版本发布后不可编辑，产品可绑定已发布版本。
          </AlertDescription>
          <AlertAction>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="关闭协议解析提示" onClick={() => setShowGuide(false)}>
              <X className="size-3.5" aria-hidden />
            </Button>
          </AlertAction>
        </Alert>}

        {apiError ? <ApiErrorAlert code={apiError.code} message={apiError.message} /> : null}

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <InputGroup className="w-full sm:w-72">
                <InputGroupAddon>
                  <Search className="size-4" aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索名称、协议或 ID"
                  aria-label="搜索 Parser Profile"
                />
              </InputGroup>
              <Button type="button" onClick={openCreate} className="w-full shrink-0 gap-1.5 sm:w-auto">
                <Plus className="size-4" aria-hidden />
                新建 Profile
              </Button>
            </div>
          </div>
          <div>
            {isLoading && !data ? (
              <div className="space-y-3">
                {[1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
                {profiles.length === 0 ? '还没有 Parser Profile，先创建一个吧。' : '没有匹配的 Profile。'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profile</TableHead>
                      <TableHead className="w-[12rem]">Profile ID</TableHead>
                      <TableHead>协议编码</TableHead>
                      <TableHead>已发布版本</TableHead>
                      <TableHead>最近更新</TableHead>
                      <TableHead className="w-44 min-w-44"><div className="flex justify-center">操作</div></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((profile) => (
                      <TableRow key={profile.profileId}>
                        <TableCell>
                          <Button type="button" variant="link" className="h-auto max-w-64 p-0 font-medium" nativeButton={false} render={<Link to={`${profileListPath}/${profile.profileId}`} />}>
                            <span className="truncate" title={profile.profileName}>{profile.profileName}</span>
                          </Button>
                        </TableCell>
                        <TableCell className="w-[12rem] whitespace-nowrap">
                          <div className="flex max-w-[11rem] items-center gap-0.5">
                            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={profile.profileId}>{profile.profileId}</code>
                            <CopyIdButton value={profile.profileId} label="Profile ID" />
                          </div>
                        </TableCell>
                        <TableCell><span className="block max-w-48 truncate text-sm" title={profile.protocolCode}>{profile.protocolCode}</span></TableCell>
                        <TableCell>
                          {profile.currentVersion ? <Badge variant="outline" className="border-transparent bg-chart-2/12 text-chart-2">v{profile.currentVersion} 已发布</Badge> : <span className="text-xs text-muted-foreground">暂无已发布</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(profile.updateTime)}</TableCell>
                        <TableCell className="w-44 min-w-44">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button type="button" variant="ghost" size="sm" nativeButton={false} render={<Link to={`${profileListPath}/${profile.profileId}`} />}>
                              打开 <ChevronRight className="size-4" aria-hidden />
                            </Button>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={`编辑 ${profile.profileName}`} onClick={() => openEdit(profile)}>
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`删除 ${profile.profileName}`} onClick={() => setDeleteTarget(profile)}>
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
        </div>
      </ProjectWorkspaceShell>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑 Parser Profile' : '新建 Parser Profile'}</DialogTitle>
            <DialogDescription>
              {editing ? '只修改 Profile 元数据，不会改变已存在的版本。' : '先建立 Profile，再在详情页创建和维护版本映射。'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-sm font-medium">
              Profile 名称
              <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="例如：MQTT 设备上报解析" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              协议编码
              <Input value={protocolCode} onChange={(event) => setProtocolCode(event.target.value)} placeholder="例如：MQTT_JSON" className="font-mono" />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button type="button" onClick={() => void saveProfile()} disabled={busy}>{busy ? '保存中…' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除 Parser Profile？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除“{deleteTarget?.profileName}”及其版本管理入口。已被产品引用的 Profile 无法删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deleteProfile()} disabled={busy}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StyleAwareWrapper>
  );
};

export default ParserProfilesPage;
