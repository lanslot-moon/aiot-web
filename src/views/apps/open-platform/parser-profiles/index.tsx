import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronRight, Info, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import {
  OpenPlatformApiError,
  openPlatformDelete,
  openPlatformGetFetcher,
  openPlatformPost,
  openPlatformPut,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import type { CursorResult, ParserProfileView } from '@/types/apps/open-platform';

function formatDate(value: number) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

const ParserProfilesPage = () => {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const profileListPath = `/projects/${projectId}/parser-profiles`;
  const { data, error, isLoading, mutate } = useSWR<CursorResult<ParserProfileView>>(
    '/api/v1/parser-profiles?pageSize=100',
    openPlatformGetFetcher,
  );
  const [keyword, setKeyword] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ParserProfileView | null>(null);
  const [profileName, setProfileName] = useState('');
  const [protocolCode, setProtocolCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ParserProfileView | null>(null);
  const apiError = error as OpenPlatformApiError | undefined;
  const profiles = data?.items ?? [];
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
          version: editing.version,
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
      await openPlatformDelete(`/api/v1/parser-profiles/${deleteTarget.profileId}`, {
        version: deleteTarget.version,
      });
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
      lyraClassName="flex min-h-full flex-col gap-px bg-border p-px"
      defaultClassName="flex min-h-full flex-col gap-4 p-4 lg:p-6"
    >
      <BreadcrumbComp
        title="协议解析"
        items={[{ to: '/projects', title: '项目' }, { title: '协议解析' }]}
      />
      <ProjectWorkspaceShell activePrimary="parserProfiles">
        <div className="flex flex-col gap-4">
        <Alert className="rounded-xl! border-primary/20 bg-primary/5 px-3 py-2.5 [&>svg]:text-primary">
          <Info className="size-4" aria-hidden />
          <AlertDescription>
            管理自定义报文到物模型能力的映射。版本发布后不可编辑，产品可绑定已发布版本。
          </AlertDescription>
        </Alert>

        {apiError ? <ApiErrorAlert code={apiError.code} message={apiError.message} /> : null}

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Profile 列表</CardTitle>
              <CardDescription>Profile 本身不区分草稿，版本映射独立维护生命周期。</CardDescription>
            </div>
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
          </CardHeader>
          <CardContent>
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
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Profile</th>
                      <th className="px-4 py-3 font-medium">协议编码</th>
                      <th className="px-4 py-3 font-medium">已发布版本</th>
                      <th className="px-4 py-3 font-medium">最近更新</th>
                      <th className="px-4 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((profile) => (
                      <tr key={profile.profileId} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-0">
                          <Link
                            to={`${profileListPath}/${profile.profileId}`}
                            className="block px-4 py-3 outline-none transition-colors focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          >
                            <div className="font-medium">{profile.profileName}</div>
                            <div className="font-mono text-xs text-muted-foreground">{profile.profileId}</div>
                          </Link>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline">{profile.protocolCode}</Badge></td>
                        <td className="px-4 py-3">
                          {profile.currentVersion ? <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">v{profile.currentVersion} 已发布</Badge> : <span className="text-muted-foreground">暂无已发布</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(profile.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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
