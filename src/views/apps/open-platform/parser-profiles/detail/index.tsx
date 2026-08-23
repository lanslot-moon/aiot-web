import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  ArrowLeft,
  CheckCircle2,
  Braces,
  GitCompare,
  History,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  TestTube2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import {
  OpenPlatformApiError,
  openPlatformDelete,
  openPlatformGetFetcher,
  openPlatformPost,
  openPlatformPut,
} from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import type {
  ParserProfileDiffView,
  ParserProfileDirection,
  ParserProfileMapping,
  ParserProfileMappingRule,
  ParserProfileMappingType,
  ParserProfileTestView,
  ParserProfileValidationView,
  ParserProfileVersionView,
  ParserProfileView,
} from '@/types/apps/open-platform';

type MappingRow = { source: string; rule: ParserProfileMappingRule };
type ConfirmAction = 'publish' | 'deprecate' | 'delete' | null;

const TYPE_OPTIONS: ParserProfileMappingType[] = ['BOOLEAN', 'INTEGER', 'NUMBER', 'STRING', 'BINARY', 'OBJECT', 'ARRAY'];
const DIRECTION_OPTIONS: ParserProfileDirection[] = ['UPLINK', 'DOWNLINK', 'BIDIRECTIONAL'];

const TYPE_LABEL: Record<ParserProfileMappingType, string> = {
  BOOLEAN: '布尔值',
  INTEGER: '整数',
  NUMBER: '数字',
  STRING: '字符串',
  BINARY: '二进制',
  OBJECT: '对象',
  ARRAY: '数组',
};
const DIRECTION_LABEL: Record<ParserProfileDirection, string> = {
  UPLINK: '上行',
  DOWNLINK: '下行',
  BIDIRECTIONAL: '双向',
};

function formatDate(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}

function statusLabel(status: string) {
  if (status === 'PUBLISHED') return '已发布';
  if (status === 'DEPRECATED') return '已废弃';
  return '草稿';
}

function statusClass(status: string) {
  if (status === 'PUBLISHED') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'DEPRECATED') return 'border-muted-foreground/30 bg-muted text-muted-foreground';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function rowsFromMapping(mapping: ParserProfileMapping | undefined): MappingRow[] {
  return Object.entries(mapping?.mappings ?? {}).map(([source, rule]) => ({ source, rule: { ...rule } }));
}

function mappingFromRows(rows: MappingRow[], codecText: string): ParserProfileMapping | null {
  let codec: Record<string, unknown> | null = null;
  if (codecText.trim()) {
    try {
      const parsed = JSON.parse(codecText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      codec = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return {
    mappings: rows.reduce<Record<string, ParserProfileMappingRule>>((result, row) => {
      const source = row.source.trim();
      const code = row.rule.code.trim();
      if (source && code) result[source] = { ...row.rule, code };
      return result;
    }, {}),
    codec,
  };
}

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

const ParserProfileDetailPage = () => {
  const { projectId = '', profileId = '' } = useParams<{
    projectId: string;
    profileId: string;
  }>();
  const navigate = useNavigate();
  const profileListPath = `/projects/${projectId}/parser-profiles`;
  const profileKey = profileId ? `/api/v1/parser-profiles/${profileId}` : null;
  const versionsKey = profileId ? `/api/v1/parser-profiles/${profileId}/versions` : null;
  const { data: profile, error: profileError, mutate: mutateProfile } = useSWR<ParserProfileView>(profileKey, openPlatformGetFetcher);
  const { data: versions, error: versionsError, mutate: mutateVersions } = useSWR<ParserProfileVersionView[]>(versionsKey, openPlatformGetFetcher);
  const [selectedVersion, setSelectedVersion] = useState('');
  const selectedVersionKey = profileId && selectedVersion
    ? `/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(selectedVersion)}`
    : null;
  const { data: versionDetail, error: versionError, mutate: mutateVersion } = useSWR<ParserProfileVersionView>(selectedVersionKey, openPlatformGetFetcher);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [codecText, setCodecText] = useState('');
  const [validation, setValidation] = useState<ParserProfileValidationView | null>(null);
  const [testResult, setTestResult] = useState<ParserProfileTestView | null>(null);
  const [payloadText, setPayloadText] = useState('{\n  "params": {\n    "temp": 235,\n    "humidity": 48,\n    "battery": 86\n  }\n}');
  const [testDirection, setTestDirection] = useState<ParserProfileDirection>('UPLINK');
  const [saveFailureSample, setSaveFailureSample] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [createVersionOpen, setCreateVersionOpen] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffFrom, setDiffFrom] = useState('');
  const [diffTo, setDiffTo] = useState('');
  const [diff, setDiff] = useState<ParserProfileDiffView | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editProtocol, setEditProtocol] = useState('');

  const apiError = (profileError ?? versionsError ?? versionError) as OpenPlatformApiError | undefined;
  const version = versionDetail;
  const isDraft = version?.versionStatus === 'DRAFT';
  const loadingVersion = versions === undefined || Boolean(selectedVersion && !version && !versionError);
  const sortedVersions = useMemo(() => versions ?? [], [versions]);

  useEffect(() => {
    if (!selectedVersion && sortedVersions[0]) setSelectedVersion(sortedVersions[0].profileVersion);
    if (selectedVersion && !sortedVersions.some((item) => item.profileVersion === selectedVersion)) {
      setSelectedVersion(sortedVersions[0]?.profileVersion ?? '');
    }
  }, [selectedVersion, sortedVersions]);

  useEffect(() => {
    if (!version) return;
    setRows(rowsFromMapping(version.mapping));
    setCodecText(prettyJson(version.mapping.codec ?? {}));
    setValidation(null);
    setTestResult(null);
  }, [version]);

  useEffect(() => {
    if (!profile) return;
    setEditName(profile.profileName);
    setEditProtocol(profile.protocolCode);
  }, [profile]);

  const refreshVersion = async () => {
    await Promise.all([mutateProfile(), mutateVersions(), mutateVersion()]);
  };

  const saveDraft = async () => {
    if (!profileId || !version || !isDraft) return;
    const mapping = mappingFromRows(rows, codecText);
    if (!mapping) {
      toast.error('Codec 必须是 JSON 对象。');
      return;
    }
    setBusy('save');
    try {
      await openPlatformPut(`/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(version.profileVersion)}`, { mapping });
      toast.success('草稿映射已保存。');
      await refreshVersion();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '保存失败。');
    } finally {
      setBusy(null);
    }
  };

  const validateDraft = async () => {
    if (!profileId || !version) return;
    setBusy('validate');
    try {
      const mapping = isDraft ? mappingFromRows(rows, codecText) : version.mapping;
      if (!mapping) {
        toast.error('Codec 必须是 JSON 对象。');
        return;
      }
      if (isDraft) {
        await openPlatformPut(`/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(version.profileVersion)}`, { mapping });
        await mutateVersion();
      }
      const result = await openPlatformPost<ParserProfileValidationView>(`/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(version.profileVersion)}/validate`, {});
      setValidation(result);
      toast[result.valid ? 'success' : 'error'](result.valid ? '映射校验通过。' : '映射校验未通过。');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '校验失败。');
    } finally {
      setBusy(null);
    }
  };

  const runPublish = async () => {
    if (!profileId || !version) return;
    setBusy('publish');
    try {
      await openPlatformPost(`/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(version.profileVersion)}/publish`, {});
      toast.success(`版本 ${version.profileVersion} 已发布。`);
      setConfirmAction(null);
      await refreshVersion();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '发布失败。');
    } finally {
      setBusy(null);
    }
  };

  const runDeprecate = async () => {
    if (!profileId || !version) return;
    setBusy('deprecate');
    try {
      await openPlatformPost(`/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(version.profileVersion)}/deprecate`, {});
      toast.success(`版本 ${version.profileVersion} 已废弃。`);
      setConfirmAction(null);
      await refreshVersion();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '废弃失败。');
    } finally {
      setBusy(null);
    }
  };

  const createVersion = async () => {
    if (!profileId || !newVersion.trim()) {
      toast.error('请填写版本号。');
      return;
    }
    setBusy('create-version');
    try {
      const created = await openPlatformPost<ParserProfileVersionView>(`/api/v1/parser-profiles/${profileId}/versions`, {
        profileVersion: newVersion.trim(),
        mapping: { mappings: {}, codec: null },
      });
      toast.success(`草稿版本 ${created.profileVersion} 已创建。`);
      setCreateVersionOpen(false);
      setNewVersion('');
      await mutateProfile();
      await mutateVersions();
      setSelectedVersion(created.profileVersion);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '创建版本失败。');
    } finally {
      setBusy(null);
    }
  };

  const openCreateVersion = () => {
    setNewVersion(sortedVersions.length ? '' : '1.0');
    setCreateVersionOpen(true);
  };

  const rollback = async () => {
    if (!profileId || !version || !rollbackTarget.trim()) {
      toast.error('请填写目标草稿版本。');
      return;
    }
    setBusy('rollback');
    try {
      const created = await openPlatformPost<ParserProfileVersionView>(
        `/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(version.profileVersion)}/rollback?targetVersion=${encodeURIComponent(rollbackTarget.trim())}`,
        {},
      );
      toast.success(`已复制为草稿 ${created.profileVersion}。`);
      setRollbackOpen(false);
      setRollbackTarget('');
      await mutateProfile();
      await mutateVersions();
      setSelectedVersion(created.profileVersion);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '复制草稿失败。');
    } finally {
      setBusy(null);
    }
  };

  const compareVersions = async () => {
    if (!profileId || !diffFrom || !diffTo || diffFrom === diffTo) {
      toast.error('请选择两个不同的版本。');
      return;
    }
    setBusy('diff');
    try {
      const result = await openPlatformPost<ParserProfileDiffView>(`/api/v1/parser-profiles/${profileId}/versions/diff`, { fromVersion: diffFrom, toVersion: diffTo });
      setDiff(result);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '差异比较失败。');
    } finally {
      setBusy(null);
    }
  };

  const testMapping = async () => {
    if (!profileId || !version) return;
    let payload: unknown;
    try { payload = JSON.parse(payloadText); } catch { toast.error('测试报文不是有效 JSON。'); return; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { toast.error('测试报文必须是 JSON 对象。'); return; }
    setBusy('test');
    try {
      const result = await openPlatformPost<ParserProfileTestView>(`/api/v1/parser-profiles/${profileId}/versions/${encodeURIComponent(version.profileVersion)}/test`, {
        direction: testDirection,
        payload,
        saveFailureSample,
      });
      setTestResult(result);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : '测试失败。');
    } finally {
      setBusy(null);
    }
  };

  const saveMetadata = async () => {
    if (!profile) return;
    if (!editName.trim() || !editProtocol.trim()) { toast.error('名称和协议编码不能为空。'); return; }
    setBusy('metadata');
    try {
      await openPlatformPut(`/api/v1/parser-profiles/${profile.profileId}`, { version: profile.version, profileName: editName.trim(), protocolCode: editProtocol.trim() });
      toast.success('Profile 信息已更新。');
      setEditOpen(false);
      await mutateProfile();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : '保存失败。'); }
    finally { setBusy(null); }
  };

  const deleteProfile = async () => {
    if (!profile) return;
    setBusy('delete');
    try {
      await openPlatformDelete(`/api/v1/parser-profiles/${profile.profileId}`, { version: profile.version });
      toast.success('Parser Profile 已删除。');
      navigate(profileListPath);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : '删除失败。'); }
    finally { setBusy(null); setConfirmAction(null); }
  };

  if (!profile && profileError) {
    return (
      <StyleAwareWrapper lyraClassName="flex min-h-full flex-col gap-4 p-4 lg:p-6">
        <ProjectWorkspaceShell activePrimary="parserProfiles">
          <ApiErrorAlert code={apiError?.code} message={apiError?.message} />
        </ProjectWorkspaceShell>
      </StyleAwareWrapper>
    );
  }

  return (
    <StyleAwareWrapper
      lyraClassName="flex min-h-full flex-col gap-px bg-border p-px"
      defaultClassName="flex min-h-full flex-col gap-4 p-4 lg:p-6"
    >
      <BreadcrumbComp title="协议解析详情" items={[{ to: profileListPath, title: '协议解析' }, { title: profile?.profileName ?? '详情' }]} />
      <ProjectWorkspaceShell activePrimary="parserProfiles">
        {apiError ? <ApiErrorAlert code={apiError.code} message={apiError.message} /> : null}
        {!profile ? <Skeleton className="h-32 w-full" /> : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <Button type="button" variant="ghost" size="icon-sm" nativeButton={false} render={<Link to={profileListPath} />} aria-label="返回 Profile 列表"><ArrowLeft className="size-4" aria-hidden /></Button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{profile.profileName}</h1><Badge variant="outline">{profile.protocolCode}</Badge></div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-mono">{profile.profileId}</span><span>·</span><span>当前发布：{profile.currentVersion ? `v${profile.currentVersion}` : '暂无'}</span></div>
                  <p className="mt-2 text-xs text-muted-foreground">Profile 本身无草稿状态，草稿、已发布和已废弃状态仅属于版本映射。</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}><Pencil className="size-4" aria-hidden />编辑信息</Button>
                <Button type="button" variant="destructive" className="gap-1.5" onClick={() => setConfirmAction('delete')}><Trash2 className="size-4" aria-hidden />删除</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                  <div><CardTitle className="flex items-center gap-2"><Braces className="size-4" aria-hidden />版本映射编辑器</CardTitle><CardDescription>把厂商字段映射到物模型能力 code，保存后再校验和发布。</CardDescription></div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void validateDraft()} disabled={!version || busy != null}><CheckCircle2 className="size-4" aria-hidden />校验</Button>
                    {isDraft ? <Button type="button" size="sm" className="gap-1.5" onClick={() => void saveDraft()} disabled={busy != null}><Save className="size-4" aria-hidden />保存草稿</Button> : null}
                    {isDraft ? <Button type="button" size="sm" className="gap-1.5" onClick={() => setConfirmAction('publish')} disabled={busy != null}><Send className="size-4" aria-hidden />发布</Button> : null}
                    {version?.versionStatus === 'PUBLISHED' ? <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmAction('deprecate')} disabled={busy != null}><XCircle className="size-4" aria-hidden />废弃</Button> : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingVersion ? <Skeleton className="h-64 w-full" /> : version ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"><span className="font-medium">版本 {version.profileVersion}</span><Badge className={statusClass(version.versionStatus)} variant="outline">{statusLabel(version.versionStatus)}</Badge><span className="text-xs text-muted-foreground">更新于 {formatDate(version.updatedAt)}</span></div>
                      <div className="flex items-center justify-between"><div><h3 className="text-sm font-medium">字段映射</h3><p className="text-xs text-muted-foreground">source key 是厂商报文字段或路径。</p></div><Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!isDraft} onClick={() => setRows((current) => [...current, { source: '', rule: { code: '', type: 'STRING', sourcePath: '', direction: 'UPLINK' } }])}><Plus className="size-4" aria-hidden />添加映射</Button></div>
                      <div className="space-y-2">
                        {rows.length === 0 ? <div className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">还没有映射规则，点击“添加映射”开始配置。</div> : rows.map((row, index) => (
                          <div key={`${row.source}-${index}`} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1.1fr_1.1fr_0.9fr_1fr_1fr_auto] md:items-end">
                            <label className="grid gap-1 text-xs text-muted-foreground">厂商字段<input value={row.source} disabled={!isDraft} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, source: event.target.value } : item))} className="h-8 rounded-md border bg-background px-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring" placeholder="params.temp" /></label>
                            <label className="grid gap-1 text-xs text-muted-foreground">能力 code<input value={row.rule.code} disabled={!isDraft} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rule: { ...item.rule, code: event.target.value } } : item))} className="h-8 rounded-md border bg-background px-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring" placeholder="temperature" /></label>
                            <label className="grid gap-1 text-xs text-muted-foreground">类型<Select value={row.rule.type ?? 'STRING'} onValueChange={(value) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rule: { ...item.rule, type: value as ParserProfileMappingType } } : item))} disabled={!isDraft}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{TYPE_OPTIONS.map((type) => <SelectItem key={type} value={type}>{TYPE_LABEL[type]}</SelectItem>)}</SelectContent></Select></label>
                            <label className="grid gap-1 text-xs text-muted-foreground">取值路径<input value={row.rule.sourcePath ?? ''} disabled={!isDraft} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rule: { ...item.rule, sourcePath: event.target.value } } : item))} className="h-8 rounded-md border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring" placeholder="payload.value" /></label>
                            <label className="grid gap-1 text-xs text-muted-foreground">方向<Select value={row.rule.direction ?? 'BIDIRECTIONAL'} onValueChange={(value) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rule: { ...item.rule, direction: value as ParserProfileDirection } } : item))} disabled={!isDraft}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{DIRECTION_OPTIONS.map((direction) => <SelectItem key={direction} value={direction}>{DIRECTION_LABEL[direction]}</SelectItem>)}</SelectContent></Select></label>
                            <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" disabled={!isDraft} aria-label={`删除映射 ${row.source || index + 1}`} onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" aria-hidden /></Button>
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-2"><Label htmlFor="profile-codec">Codec 配置（JSON，可选）</Label><Textarea id="profile-codec" value={codecText} disabled={!isDraft} onChange={(event) => setCodecText(event.target.value)} className="min-h-28 font-mono text-xs" placeholder={'{\n  "textEncoding": "UTF-8"\n}'} /></div>
                      {validation ? <div className={`rounded-lg border px-3 py-3 text-sm ${validation.valid ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-destructive/30 bg-destructive/10'}`}><div className="flex items-center gap-2 font-medium">{validation.valid ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : <XCircle className="size-4 text-destructive" aria-hidden />}{validation.valid ? '映射校验通过' : '映射校验未通过'}</div>{validation.details?.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{validation.details.map((item, index) => <li key={`${item.instanceLocation}-${index}`}>{item.instanceLocation ?? '$'}：{item.message}</li>)}</ul> : null}</div> : null}
                    </>
                  ) : (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Braces className="size-5" aria-hidden /></div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">还没有版本</p>
                        <p className="text-xs text-muted-foreground">先创建一个版本，创建后会以草稿状态进入字段映射编辑。</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openCreateVersion}><Plus className="size-4" aria-hidden />新建版本草稿</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TestTube2 className="size-4" aria-hidden />报文测试</CardTitle><CardDescription>使用真实报文样例验证映射结果；失败时可选择保存样本。</CardDescription></CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3"><div className="grid gap-2"><Label>方向<Select value={testDirection} onValueChange={(value) => setTestDirection(value as ParserProfileDirection)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DIRECTION_OPTIONS.map((direction) => <SelectItem key={direction} value={direction}>{DIRECTION_LABEL[direction]}</SelectItem>)}</SelectContent></Select></Label></div><div className="grid gap-2"><Label htmlFor="profile-test-payload">输入报文（JSON）</Label><Textarea id="profile-test-payload" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} className="min-h-48 font-mono text-xs" /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveFailureSample} onChange={(event) => setSaveFailureSample(event.target.checked)} />失败时保存样本</label><Button type="button" className="gap-1.5" onClick={() => void testMapping()} disabled={!version || busy != null}><TestTube2 className="size-4" aria-hidden />{busy === 'test' ? '测试中…' : '运行测试'}</Button></div>
                  <div className="rounded-lg border bg-muted/20 p-3">{testResult ? <div className="space-y-3"><div className="flex items-center gap-2">{testResult.success ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : <XCircle className="size-4 text-destructive" aria-hidden />}<span className="font-medium">{testResult.success ? '解析成功' : '解析存在问题'}</span>{testResult.failureSampleId ? <Badge variant="outline">样本已保存</Badge> : null}</div><div><div className="mb-1 text-xs text-muted-foreground">映射结果</div><pre className="max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs">{prettyJson(testResult.mapped)}</pre></div>{testResult.issues.length ? <div><div className="mb-1 text-xs text-muted-foreground">问题</div><ul className="space-y-1 text-xs text-destructive">{testResult.issues.map((issue) => <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>)}</ul></div> : null}</div> : <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">运行测试后在这里查看映射结果。</div>}</div>
                </CardContent>
              </Card>
            </div>

            <aside className="min-w-0 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><History className="size-4" aria-hidden />版本历史</CardTitle><CardDescription>草稿、已发布和已废弃版本都会保留。</CardDescription></div><Button type="button" size="icon-sm" variant="outline" aria-label="新建版本" onClick={openCreateVersion}><Plus className="size-4" aria-hidden /></Button></CardHeader>
                <CardContent className="space-y-2">
                  {sortedVersions.map((item) => <button key={item.profileVersion} type="button" onClick={() => setSelectedVersion(item.profileVersion)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedVersion === item.profileVersion ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">v{item.profileVersion}</span><Badge variant="outline" className={statusClass(item.versionStatus)}>{statusLabel(item.versionStatus)}</Badge></div><div className="mt-1 text-xs text-muted-foreground">发布时间：{formatDate(item.publishedAt)}</div><div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{item.versionDigest || '尚未生成摘要'}</div></button>)}
                  {!sortedVersions.length ? <div className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">还没有版本。</div> : null}
                  <div className="grid grid-cols-2 gap-2 pt-2"><Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!version} onClick={() => { setRollbackTarget(`${version?.profileVersion ?? ''}-copy`); setRollbackOpen(true); }}><RotateCcw className="size-3.5" aria-hidden />复制为草稿</Button><Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={sortedVersions.length < 2} onClick={() => { setDiffFrom(sortedVersions[1]?.profileVersion ?? ''); setDiffTo(sortedVersions[0]?.profileVersion ?? ''); setDiff(null); setDiffOpen(true); }}><GitCompare className="size-3.5" aria-hidden />版本比较</Button></div>
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle>生命周期说明</CardTitle></CardHeader><CardContent className="space-y-2 text-xs text-muted-foreground"><p>草稿可反复保存和校验，发布后映射内容与摘要会锁定。</p><p>同一 Profile 同时只允许一个已发布版本；发布新版本会将旧版本标记为已废弃。</p><p>产品使用自定义报文时，必须绑定这里的已发布版本。</p></CardContent></Card>
            </aside>
          </div>
        </>
        )}
      </ProjectWorkspaceShell>

      <Dialog open={createVersionOpen} onOpenChange={setCreateVersionOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>新建版本草稿</DialogTitle><DialogDescription>版本号由你定义，例如 1.2 或 2026.08。</DialogDescription></DialogHeader><div className="grid gap-2"><Label htmlFor="new-profile-version">版本号</Label><Input id="new-profile-version" value={newVersion} onChange={(event) => setNewVersion(event.target.value)} placeholder="1.2" className="font-mono" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateVersionOpen(false)}>取消</Button><Button type="button" onClick={() => void createVersion()} disabled={busy != null}>{busy === 'create-version' ? '创建中…' : '创建草稿'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>复制为草稿</DialogTitle><DialogDescription>复制当前版本的完整映射，生成一个新的可编辑草稿。</DialogDescription></DialogHeader><div className="grid gap-2"><Label htmlFor="rollback-target">目标版本号</Label><Input id="rollback-target" value={rollbackTarget} onChange={(event) => setRollbackTarget(event.target.value)} className="font-mono" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRollbackOpen(false)}>取消</Button><Button type="button" onClick={() => void rollback()} disabled={busy != null}>{busy === 'rollback' ? '复制中…' : '复制草稿'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto !max-w-[min(94vw,896px)]"><DialogHeader><DialogTitle className="flex items-center gap-2"><GitCompare className="size-4" aria-hidden />比较 Profile 版本</DialogTitle><DialogDescription>按映射项展示新增、删除和字段级修改。</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Label>基线版本<Select value={diffFrom} onValueChange={(value) => setDiffFrom(value ?? '')}><SelectTrigger><SelectValue placeholder="选择版本" /></SelectTrigger><SelectContent>{sortedVersions.map((item) => <SelectItem key={item.profileVersion} value={item.profileVersion}>v{item.profileVersion} · {statusLabel(item.versionStatus)}</SelectItem>)}</SelectContent></Select></Label><Label>目标版本<Select value={diffTo} onValueChange={(value) => setDiffTo(value ?? '')}><SelectTrigger><SelectValue placeholder="选择版本" /></SelectTrigger><SelectContent>{sortedVersions.map((item) => <SelectItem key={item.profileVersion} value={item.profileVersion}>v{item.profileVersion} · {statusLabel(item.versionStatus)}</SelectItem>)}</SelectContent></Select></Label><Button type="button" className="self-end gap-1.5" onClick={() => void compareVersions()} disabled={busy === 'diff'}><RefreshCw className="size-4" aria-hidden />比较</Button></div>{diff ? <div className="grid gap-3 md:grid-cols-3"><DiffGroup title="新增映射" items={diff.added} tone="emerald" /><DiffGroup title="删除映射" items={diff.removed} tone="red" /><DiffGroup title="修改映射" items={diff.modified} tone="amber" /></div> : <div className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">选择两个版本后开始比较。</div>}</DialogContent></Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>编辑 Profile 信息</DialogTitle><DialogDescription>元数据变更不会改写任何版本映射。</DialogDescription></DialogHeader><div className="grid gap-4"><Label>Profile 名称<Input value={editName} onChange={(event) => setEditName(event.target.value)} /></Label><Label>协议编码<Input value={editProtocol} onChange={(event) => setEditProtocol(event.target.value)} className="font-mono" /></Label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>取消</Button><Button type="button" onClick={() => void saveMetadata()} disabled={busy != null}>{busy === 'metadata' ? '保存中…' : '保存'}</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={confirmAction != null} onOpenChange={(open) => !open && setConfirmAction(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmAction === 'publish' ? `确认发布 v${version?.profileVersion}？` : confirmAction === 'deprecate' ? `确认废弃 v${version?.profileVersion}？` : '确认删除 Parser Profile？'}</AlertDialogTitle><AlertDialogDescription>{confirmAction === 'publish' ? '发布后该版本映射不可再编辑，并会成为产品可绑定的版本。' : confirmAction === 'deprecate' ? '废弃后该版本不能再作为新的产品绑定版本，但历史内容仍会保留。' : `将删除“${profile?.profileName}”及其版本入口；已被产品引用时删除会被拒绝。`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy != null}>取消</AlertDialogCancel><AlertDialogAction variant={confirmAction === 'delete' ? 'destructive' : 'default'} onClick={() => { if (confirmAction === 'publish') void runPublish(); else if (confirmAction === 'deprecate') void runDeprecate(); else void deleteProfile(); }} disabled={busy != null}>{confirmAction === 'publish' ? '确认发布' : confirmAction === 'deprecate' ? '确认废弃' : '确认删除'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </StyleAwareWrapper>
  );
};

function DiffGroup({ title, items, tone }: { title: string; items: ParserProfileDiffView['added']; tone: 'emerald' | 'red' | 'amber' }) {
  const toneClass = tone === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/5' : tone === 'red' ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5';
  return <div className={`rounded-lg border p-3 ${toneClass}`}><div className="mb-2 flex items-center justify-between text-sm font-medium"><span>{title}</span><Badge variant="outline">{items.length}</Badge></div>{items.length ? <div className="space-y-2">{items.map((item, index) => <div key={`${item.source}-${index}`} className="rounded-md border bg-background/70 p-2 text-xs"><div className="font-mono">{item.source} → {item.code}</div>{item.changedField ? <div className="mt-1 text-muted-foreground">变更字段：{item.changedField}</div> : null}</div>)}</div> : <p className="text-xs text-muted-foreground">无变化</p>}</div>;
}

export default ParserProfileDetailPage;
