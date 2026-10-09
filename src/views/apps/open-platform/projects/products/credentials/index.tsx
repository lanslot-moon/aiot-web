import {
ArrowLeft,
Ban,
Boxes,
CircleAlert,
CloudDownload,
Copy,
Eye,
FileKey2,
KeyRound,
Loader2,
PackageCheck,
PackagePlus,
Plus,
RefreshCw,
RotateCcw,
ShieldAlert,
ShieldCheck,
Upload,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import useSWR from 'swr';
import { RequestLoading, RequestTableState } from '@/components/shared/request-feedback';
import useSWRInfinite from 'swr/infinite';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProductLifecycleBadge } from '@/components/open-platform/product-lifecycle-badge';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpenPlatformApiError, openPlatformDelete, openPlatformGetFetcher, openPlatformPost } from '../../../../../../context/open-platform-context/project-resources';

import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { cn } from '@/lib/utils';
import type {
CredentialDistributionView as DistributionView,
CredentialExportTaskView,
CredentialManufacturingBatchView,
CredentialManufacturingItemView,
CredentialPreRegistrationView,
CredentialRotationTaskView as RotationView,
CredentialSecretDeliveryView,
CredentialSummaryView,
CursorResult,
ProductDetailView,
} from '@/types/apps/open-platform';

type CredentialRotationTaskView = Omit<RotationView, 'switchDeadline'> & { claimDeadline: number };

type CredentialDistributionView = Omit<DistributionView, 'requestReference'> & { distributionRequestId: string };

const PRODUCT_TAB_CLASS = 'h-8 gap-1.5';

function formatDate(value: number | null | undefined) {
  if (!value) return '长期有效';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatDateShort(value: number | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('zh-CN');
}

function formatDateTimeInput(value: number) {
  const date = new Date(value);
  return new Date(value - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function maskId(value: string | null | undefined) {
  if (!value) return '—';
  if (value.length <= 12) return value;
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

const credentialStatusLabel: Record<string, string> = {
  ACTIVE: '当前有效',
  RETIRING: '轮换中',
  EXPIRED: '已过期',
  REVOKED: '已吊销',
};

const accessStateLabel: Record<string, string> = {
  ENABLED: '可访问',
  FROZEN: '已冻结',
};

const batchStatusLabel: Record<string, string> = {
  ISSUING: '签发中',
  AVAILABLE: '已生成',
  PARTIALLY_AVAILABLE: '部分可用',
  FULLY_ALLOCATED: '已全部划拨',
  EXPIRED: '已过期',
};

const exportStatusLabel: Record<string, string> = {
  PENDING: '等待执行',
  RUNNING: '执行中',
  SUCCEEDED: '导出成功',
  PARTIALLY_SUCCEEDED: '部分成功',
  FAILED: '导出失败',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
};

const preRegistrationStatusLabel: Record<string, string> = {
  PENDING: '待绑定',
  BOUND: '已绑定',
  EXPIRED: '已过期',
  REMOVED: '已移除',
};

const rotationStatusLabel: Record<string, string> = {
  REQUESTED: '已请求',
  NEW_CREDENTIAL_ISSUED: '新凭证已签发',
  WAITING_DEVICE_CLAIM: '等待设备领取',
  WAITING_DEVICE_SWITCH: '等待设备切换',
  GRACE_PERIOD: '宽限期',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  FAILED: '已失败',
};

const distributionStatusLabel: Record<string, string> = {
  CREATING: '创建中',
  FROZEN: '可导出',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
};

const manufacturingItemStatusLabel: Record<string, string> = {
  AVAILABLE: '可绑定',
  BOUND: '已绑定',
  EXPIRED: '已过期',
  REVOKED: '已吊销',
  VOID: '已作废',
};

function statusBadge(status: string, tone: 'default' | 'success' | 'warning' | 'danger' = 'default') {
  return (
    <Badge
      variant={tone === 'danger' ? 'destructive' : tone === 'success' ? 'default' : 'secondary'}
      className={cn(
        'whitespace-nowrap',
        tone === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        tone === 'warning' && 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      )}
    >
      {status}
    </Badge>
  );
}

function getBatchTone(status: string) {
  if (status === 'AVAILABLE') return 'success' as const;
  if (status === 'PARTIALLY_AVAILABLE' || status === 'ISSUING') return 'warning' as const;
  return 'default' as const;
}

function isBatchFullyAllocated(batch: CredentialManufacturingBatchView) {
  return batch.targetQuantity > 0 && batch.availableCount === 0 && batch.allocatedQuantity >= batch.targetQuantity;
}

function getBatchDisplayStatus(batch: CredentialManufacturingBatchView) {
  return isBatchFullyAllocated(batch) ? 'FULLY_ALLOCATED' : batch.status;
}

function getCredentialTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'RETIRING') return 'warning' as const;
  return 'danger' as const;
}

function getExportTone(status: string) {
  if (status === 'SUCCEEDED') return 'success' as const;
  if (status === 'RUNNING' || status === 'PENDING' || status === 'PARTIALLY_SUCCEEDED') return 'warning' as const;
  return 'danger' as const;
}

function getPreRegistrationTone(status: string) {
  if (status === 'PENDING') return 'warning' as const;
  if (status === 'BOUND') return 'success' as const;
  return 'default' as const;
}

function getRotationTone(status: string) {
  if (status === 'COMPLETED') return 'success' as const;
  if (['FAILED', 'CANCELLED'].includes(status)) return 'danger' as const;
  return 'warning' as const;
}

function getDistributionTone(status: string) {
  if (status === 'FROZEN') return 'success' as const;
  if (status === 'CREATING') return 'warning' as const;
  if (['CANCELLED', 'EXPIRED'].includes(status)) return 'danger' as const;
  return 'default' as const;
}

function getManufacturingItemTone(status: string) {
  if (status === 'AVAILABLE') return 'success' as const;
  if (status === 'BOUND') return 'default' as const;
  if (status === 'VOID' || status === 'REVOKED') return 'danger' as const;
  return 'warning' as const;
}

function OneTimeSecretDialog({
  delivery,
  onOpenChange,
}: {
  delivery: CredentialSecretDeliveryView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const copySecret = async () => {
    if (!delivery) return;
    try {
      await navigator.clipboard.writeText(delivery.secret);
      toast.success('Secret 已复制，请立即保存到安全位置。');
    } catch {
      toast.error('复制失败，请手动复制。');
    }
  };

  return (
    <Dialog open={delivery != null} disablePointerDismissal onOpenChange={(next, details) => { if (details.reason === 'escape-key') { details.cancel(); return; } onOpenChange(next); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-500" aria-hidden />
            一次性交付凭证明文
          </DialogTitle>
          <DialogDescription>
            出于安全原因，Secret 只在这次成功响应中显示。关闭后不能从列表或详情页再次查看。
          </DialogDescription>
        </DialogHeader>
        {delivery ? (
          <div className="space-y-4">
            <Alert className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
              <CircleAlert className="size-4" aria-hidden />
              <AlertDescription>
                请在关闭窗口前完成保存；不要把明文粘贴到工单、日志或聊天工具。
              </AlertDescription>
            </Alert>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">{delivery.credential.kind === 'PRODUCT_SECRET' ? 'Product Secret' : 'Device Secret'}</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-background px-3 py-2 font-mono text-sm">
                  {delivery.secret}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={() => void copySecret()} aria-label="复制 Secret">
                  <Copy className="size-4" aria-hidden />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                凭证 ID：<code className="break-all font-mono">{delivery.credential.credentialId}</code>
              </p>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>我已安全保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueCredentialDialog({
  open,
  kind,
  productId,
  onOpenChange,
  onDelivered,
}: {
  open: boolean;
  kind: 'PRODUCT_SECRET' | 'DEVICE_SECRET';
  productId: string;
  onOpenChange: (open: boolean) => void;
  onDelivered: (delivery: CredentialSecretDeliveryView) => void;
}) {
  const [hardwareUuid, setHardwareUuid] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (kind === 'DEVICE_SECRET' && !hardwareUuid.trim()) {
      toast.error('请填写设备出厂硬件身份。');
      return;
    }
    setBusy(true);
    try {
      const delivery = await openPlatformPost<CredentialSecretDeliveryView>('/api/v1/credentials', {
        productId,
        kind,
        hardwareUuid: kind === 'DEVICE_SECRET' ? hardwareUuid.trim() || undefined : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
      });
      toast.success(kind === 'PRODUCT_SECRET' ? 'Product Secret 已签发，请立即保存。' : 'Device Secret 已签发，请立即保存。');
      setHardwareUuid('');
      setExpiresAt('');
      onOpenChange(false);
      if (delivery.secret) onDelivered(delivery);
      else toast.info('凭证已存在；重复签发不会再次交付明文。');
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '凭证签发失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === 'PRODUCT_SECRET' ? '签发 Product Secret' : '手动签发 Device Secret'}</DialogTitle>
          <DialogDescription>
            {kind === 'PRODUCT_SECRET'
              ? 'Product Secret 用于产品级的一型一密流程。明文只会在本次成功响应中交付一次。'
              : '手动签发适合工程样机或单台设备；批量量产请优先使用“制造批次 → 划拨 → 导出”。'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {kind === 'DEVICE_SECRET' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="credential-hardware-uuid">Hardware Identity</Label>
                <Input required id="credential-hardware-uuid" value={hardwareUuid} onChange={(event) => setHardwareUuid(event.target.value)} placeholder="例如：GW-HW-202608-0003" />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="credential-expires-at">失效时间（可选）</Label>
            <Input id="credential-expires-at" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            <p className="text-xs text-muted-foreground">不填写表示长期有效；凭证过期后不会自动恢复。</p>
          </div>
          <Alert className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
            <ShieldAlert className="size-4" aria-hidden />
            <AlertDescription>请确认当前操作人有安全交付权限，关闭明文窗口后将无法再次查看。</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
              签发并交付明文
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CredentialAction = 'FREEZE' | 'UNFREEZE' | 'REVOKE';

function CredentialActionDialog({
  target,
  onOpenChange,
  onCompleted,
}: {
  target: { credential: CredentialSummaryView; action: CredentialAction } | null;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const action = target?.action;
  const actionPath = action?.toLowerCase();
  const actionLabel = action === 'REVOKE' ? '吊销' : action === 'FREEZE' ? '冻结' : '解除冻结';

  const confirm = async () => {
    if (!target || !actionPath) return;
    setBusy(true);
    try {
      await openPlatformPost(`/api/v1/credentials/${encodeURIComponent(target.credential.credentialId)}/${actionPath}`, {
        reasonCode: `MANUAL_${target.action}`,
        reason: `管理台手动${actionLabel}`,
        expectedVersion: target.credential.securityVersion,
      });
      toast.success(`凭证已${actionLabel}。`);
      onOpenChange(false);
      await onCompleted();
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : `凭证${actionLabel}失败，请刷新后重试。`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={target != null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认{actionLabel}设备凭证？</AlertDialogTitle>
          <AlertDialogDescription>
            {action === 'REVOKE'
              ? '吊销后该凭证不能恢复，设备需要通过新的签发或轮换流程重新获得凭证。'
              : action === 'FREEZE'
                ? '冻结会立即阻断该凭证的认证访问，但会保留完整审计记录。'
                : '解除冻结后该凭证会恢复认证访问，请确认设备侧已经准备好。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction variant={action === 'REVOKE' ? 'destructive' : 'default'} disabled={busy} onClick={(event) => { event.preventDefault(); void confirm(); }}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            确认{actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateRotationDialog({
  credential,
  onOpenChange,
  onCreated,
}: {
  credential: CredentialSummaryView | null;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const [deadline, setDeadline] = useState(() => formatDateTimeInput(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [forceRevokeAt, setForceRevokeAt] = useState(() => formatDateTimeInput(Date.now() + 8 * 24 * 60 * 60 * 1000));
  const [gracePeriod, setGracePeriod] = useState('86400');
  const [enforcementMode, setEnforcementMode] = useState<'NORMAL' | 'SECURITY_ENFORCED'>('NORMAL');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!credential) return;
    const claimDeadline = new Date(deadline).getTime();
    const gracePeriodSeconds = Number(gracePeriod);
    if (!Number.isFinite(claimDeadline) || claimDeadline <= Date.now()) {
      toast.error('领取截止时间必须晚于当前时间。');
      return;
    }
    if (!Number.isInteger(gracePeriodSeconds) || gracePeriodSeconds < 0) {
      toast.error('宽限期需要填写不小于 0 的整数秒数。');
      return;
    }
    if (enforcementMode === 'SECURITY_ENFORCED' && (!Number.isFinite(new Date(forceRevokeAt).getTime()) || new Date(forceRevokeAt).getTime() <= claimDeadline)) { toast.error('强制吊销时间必须晚于领取截止时间。'); return; }
    setBusy(true);
    try {
      await openPlatformPost('/api/v1/rotation-tasks', {
        credentialId: credential.credentialId,
        claimDeadline,
        forceRevokeAt: enforcementMode === 'SECURITY_ENFORCED' ? new Date(forceRevokeAt).getTime() : null,
        gracePeriodSeconds,
        enforcementMode,
        reasonCode: 'MANUAL_ROTATION',
      });
      toast.success('轮换任务已创建，设备领取新凭证后才会进入切换阶段。');
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '轮换任务创建失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={credential != null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>发起 Device Secret 轮换</DialogTitle>
          <DialogDescription>先签发候选版本，再等待设备领取和切换；旧凭证会在宽限期结束后退役。</DialogDescription>
        </DialogHeader>
        {credential ? (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">设备</span><span className="font-medium">{credential.deviceId || credential.hardwareUuid || '未绑定设备'}</span></div>
              <div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted-foreground">当前版本</span><span className="font-mono">v{credential.versionNo}</span></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="rotation-deadline">领取截止时间</Label><Input id="rotation-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="rotation-grace-period">宽限期（秒）</Label><Input id="rotation-grace-period" type="number" min={0} value={gracePeriod} onChange={(event) => setGracePeriod(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>执行模式</Label><Select value={enforcementMode} onValueChange={(value) => setEnforcementMode(value as 'NORMAL' | 'SECURITY_ENFORCED')}><SelectTrigger aria-label="轮换执行模式" className="w-full"><SelectValue placeholder="选择执行模式" /></SelectTrigger><SelectContent><SelectItem value="NORMAL">普通轮换（保留宽限期）</SelectItem><SelectItem value="SECURITY_ENFORCED">强制轮换（到期阻断旧凭证）</SelectItem></SelectContent></Select></div>
            {enforcementMode === 'SECURITY_ENFORCED' ? <div className="space-y-2"><Label htmlFor="rotation-force-revoke">强制吊销时间</Label><Input id="rotation-force-revoke" type="datetime-local" value={forceRevokeAt} onChange={(event) => setForceRevokeAt(event.target.value)} /></div> : null}
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button><Button type="submit" disabled={busy} className="gap-1.5">{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}创建轮换任务</Button></DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateBatchDialog({
  open,
  onOpenChange,
  productId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  onCreated: () => Promise<unknown>;
}) {
  const [quantity, setQuantity] = useState('100');
  const [grantReference, setGrantReference] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);


  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 10000) {
      toast.error('数量需要填写 1 到 10000 之间的整数。');
      return;
    }
    if (!grantReference.trim()) {
      toast.error('请填写批次引用，方便产线和审计追踪。');
      return;
    }
    setBusy(true);
    try {
      await openPlatformPost('/api/v1/credential-batches', {
        productId,
        quantity: parsedQuantity,
        batchRequestId: grantReference.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
      });
      toast.success('量产批次已创建，正在准备可划拨凭证。');
      setGrantReference('');
      setExpiresAt('');
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '批次创建失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建量产批次</DialogTitle>
          <DialogDescription>生成指定数量的设备凭证，随后可按产线或订单创建领取单。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="credential-batch-quantity">凭证数量</Label>
              <Input id="credential-batch-quantity" type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <p className="text-xs text-muted-foreground">单批最多 10000 个设备凭证。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credential-batch-expires">失效时间（可选）</Label>
              <Input id="credential-batch-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              <p className="text-xs text-muted-foreground">不填写表示长期有效。</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="credential-batch-reference">批次引用</Label>
            <Input required id="credential-batch-reference" value={grantReference} onChange={(event) => setGrantReference(event.target.value)} placeholder="例如：上海一期网关产线" />
            <p className="text-xs text-muted-foreground">建议使用客户、产线或订单号，后续导出和审计都会显示。</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              创建批次
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManufacturingBatchDetailDialog({
  batch,
  canManage,
  onOpenChange,
  onBatchUpdated,
}: {
  batch: CredentialManufacturingBatchView | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onBatchUpdated: () => Promise<unknown>;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemDetail, setItemDetail] = useState<CredentialManufacturingItemView | null>(null);
  const [itemDetailLoading, setItemDetailLoading] = useState(false);
  const [pendingVoid, setPendingVoid] = useState<CredentialManufacturingItemView | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);
  const [itemStatusFilter, setItemStatusFilter] = useState('ALL');
  const [hardwareUuidPrefix, setHardwareUuidPrefix] = useState('');
  const [credentialIdFilter, setCredentialIdFilter] = useState('');
  const itemDetailRef = useRef<HTMLDivElement | null>(null);
  const itemRequest = useRef(0);

  const batchId = batch?.batchId ?? '';
  const batchKey = batch ? `/api/v1/credential-batches/${encodeURIComponent(batch.batchId)}` : null;
  const { data: batchDetail, error: batchError, isLoading: batchLoading, mutate: mutateBatch } = useSWR<CredentialManufacturingBatchView>(batchKey, openPlatformGetFetcher, { refreshInterval: (data) => data?.status === 'ISSUING' ? 5000 : 0 });

  const getItemPageKey = (pageIndex: number, previousPageData: CursorResult<CredentialManufacturingItemView> | null) => {
    if (!batch) return null;
    if (pageIndex > 0 && (!previousPageData || !previousPageData.hasMore)) return null;
    const params = new URLSearchParams({ limit: '100', sortBy: 'createTime', sortDirection: 'DESC' });
    if (previousPageData?.nextCursor) params.set('cursor', previousPageData.nextCursor);
    if (itemStatusFilter !== 'ALL') params.set('status', itemStatusFilter);
    if (hardwareUuidPrefix.trim()) params.set('hardwareUuidPrefix', hardwareUuidPrefix.trim());
    if (credentialIdFilter.trim()) params.set('credentialId', credentialIdFilter.trim());
    return `/api/v1/credential-batches/${encodeURIComponent(batch.batchId)}/items?${params.toString()}`;
  };
  const {
    data: itemPages,
    error: itemsError,
    isLoading: itemsLoading,
    isValidating: itemsValidating,
    size: itemPageCount,
    setSize: setItemPageCount,
    mutate: mutateItems,
  } = useSWRInfinite<CursorResult<CredentialManufacturingItemView>>(getItemPageKey, openPlatformGetFetcher);

  const items = itemPages?.flatMap((page) => page.items) ?? [];
  const lastItemPage = itemPages?.[itemPages.length - 1];
  const hasMoreItems = lastItemPage?.hasMore ?? false;
  const detail = batchDetail ?? batch;

  useEffect(() => {
    if (batchDetail?.status && batchDetail.status !== 'ISSUING') void mutateItems();
  }, [batchDetail?.status, mutateItems]);

  useEffect(() => {
    itemRequest.current += 1;
    setItemDetailLoading(false);
    setSelectedItemId(null);
    setItemDetail(null);
    setPendingVoid(null);
    setVoidReason('');
  }, [batchId]);

  useEffect(() => {
    if (selectedItemId && (itemDetailLoading || itemDetail)) {
      itemDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [itemDetail, itemDetailLoading, selectedItemId]);

  const openItemDetail = async (item: CredentialManufacturingItemView) => {
    const requestId = ++itemRequest.current;
    setSelectedItemId(item.itemId);
    setItemDetail(null);
    setItemDetailLoading(true);
    try {
      const result = await openPlatformGetFetcher<CredentialManufacturingItemView>(`/api/v1/credential-batches/${encodeURIComponent(item.batchId)}/items/${encodeURIComponent(item.itemId)}`);
      if (requestId === itemRequest.current) setItemDetail(result);
    } catch (error) {
      if (requestId === itemRequest.current) toast.error(error instanceof OpenPlatformApiError ? error.message : '制造项详情加载失败，请稍后重试。');
    } finally {
      if (requestId === itemRequest.current) setItemDetailLoading(false);
    }
  };

  const voidItem = async () => {
    if (!canManage || !pendingVoid) return;
    setVoidBusy(true);
    try {
      const result = await openPlatformPost<CredentialManufacturingItemView>(`/api/v1/credential-batches/${encodeURIComponent(pendingVoid.batchId)}/items/${encodeURIComponent(pendingVoid.itemId)}/void`, {
        reasonCode: 'MANUAL_VOID',
        reason: voidReason.trim() || '管理台手动作废',
        expectedVersion: pendingVoid.version,
      });
      toast.success('制造项已作废，关联设备凭证已吊销。');
      setSelectedItemId(result.itemId);
      setItemDetail(result);
      setPendingVoid(null);
      setVoidReason('');
      await Promise.all([mutateItems(), mutateBatch(), onBatchUpdated()]);
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '制造项作废失败，请稍后重试。');
    } finally {
      setVoidBusy(false);
    }
  };

  const itemDetailPanel = (
    <div ref={itemDetailRef} aria-live="polite">
      {itemDetailLoading ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          正在加载制造项详情…
        </div>
      ) : itemDetail ? (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">制造项详情</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">仅展示管理所需的非敏感字段。</p>
            </div>
            {statusBadge(manufacturingItemStatusLabel[itemDetail.status] ?? itemDetail.status, getManufacturingItemTone(itemDetail.status))}
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">制造项 ID</p><code className="mt-1 block break-all font-mono text-xs">{itemDetail.itemId}</code></div>
            <div><p className="text-xs text-muted-foreground">硬件身份</p><code className="mt-1 block break-all font-mono text-xs">{itemDetail.hardwareUuid}</code></div>
            <div><p className="text-xs text-muted-foreground">凭证</p><code className="mt-1 block break-all font-mono text-xs">{itemDetail.credentialId} · v{itemDetail.credentialVersion}</code></div>
            <div><p className="text-xs text-muted-foreground">凭证族</p><code className="mt-1 block break-all font-mono text-xs">{itemDetail.credentialFamilyId}</code></div>
            <div><p className="text-xs text-muted-foreground">绑定设备</p><p className="mt-1">{itemDetail.boundDeviceId || '尚未绑定'}</p></div>
            <div><p className="text-xs text-muted-foreground">划拨集合</p><p className="mt-1 break-all">{itemDetail.distributionId || '尚未划拨'}</p></div>
            <div><p className="text-xs text-muted-foreground">分配时间</p><p className="mt-1">{itemDetail.allocatedAt ? formatDate(itemDetail.allocatedAt) : '尚未分配'}</p></div>
            <div><p className="text-xs text-muted-foreground">绑定时间</p><p className="mt-1">{itemDetail.boundAt ? formatDate(itemDetail.boundAt) : '尚未绑定'}</p></div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <Sheet open={batch != null} onOpenChange={(next) => !voidBusy && onOpenChange(next)}>
        <SheetContent className="!w-full sm:!w-[90vw] sm:!max-w-6xl overflow-y-auto px-4 pb-4">
          <SheetHeader className="min-w-0">
            <SheetTitle>制造批次详情</SheetTitle>
            <SheetDescription>查看批次生成的制造项及其当前状态。列表不会展示 Device Secret 明文。</SheetDescription>
          </SheetHeader>
          {batch ? (
            <div className="min-w-0 space-y-4">
              {batchError ? <Alert className="rounded-xl border-destructive/30 bg-destructive/5 text-destructive"><CircleAlert className="size-4" aria-hidden /><AlertDescription>{batchError instanceof Error ? batchError.message : '批次详情加载失败，请刷新重试。'}</AlertDescription></Alert> : null}
              <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-4">
                <div className="min-w-0"><p className="text-xs text-muted-foreground">批次 ID</p><code className="mt-1 block break-all font-mono text-xs">{detail?.batchId ?? batch.batchId}</code></div>
                <div><p className="text-xs text-muted-foreground">状态</p><div className="mt-1">{statusBadge(batchStatusLabel[getBatchDisplayStatus(detail ?? batch)] ?? (detail ?? batch).status, getBatchTone((detail ?? batch).status))}</div></div>
                <div><p className="text-xs text-muted-foreground">目标数量</p><p className="mt-1 font-semibold tabular-nums">{formatNumber((detail ?? batch).targetQuantity)}</p></div>
                <div><p className="text-xs text-muted-foreground">可绑定 / 已绑定 / 已作废</p><p className="mt-1 text-sm tabular-nums">{formatNumber((detail ?? batch).availableCount)} / {formatNumber((detail ?? batch).boundCount)} / {formatNumber((detail ?? batch).voidCount)}</p></div>
              </div>

              <div className="min-w-0 space-y-3 rounded-xl border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
                  <div><h3 className="text-sm font-semibold">制造项</h3><p className="mt-0.5 text-xs text-muted-foreground">制造项是单台设备的凭证与硬件身份关联记录。</p></div>
                  {batchLoading ? <span className="text-xs text-muted-foreground">正在刷新批次…</span> : null}
                </div>
                <div className="grid gap-2 px-3 pt-1 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <Select value={itemStatusFilter} onValueChange={(value) => setItemStatusFilter(value ?? 'ALL')}>
                    <SelectTrigger aria-label="制造项状态" className="w-full"><SelectValue placeholder="全部状态" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">全部状态</SelectItem>
                      <SelectItem value="AVAILABLE">可绑定</SelectItem>
                      <SelectItem value="BOUND">已绑定</SelectItem>
                      <SelectItem value="EXPIRED">已过期</SelectItem>
                      <SelectItem value="REVOKED">已吊销</SelectItem>
                      <SelectItem value="VOID">已作废</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input aria-label="硬件身份前缀" value={hardwareUuidPrefix} onChange={(event) => setHardwareUuidPrefix(event.target.value)} placeholder="按硬件身份前缀筛选" />
                  <Input aria-label="凭证 ID" value={credentialIdFilter} onChange={(event) => setCredentialIdFilter(event.target.value)} placeholder="按凭证 ID 精确筛选" />
                </div>
                {itemsError ? <Alert className="mx-3 rounded-xl border-destructive/30 bg-destructive/5 text-destructive"><CircleAlert className="size-4" aria-hidden /><AlertDescription>{itemsError instanceof Error ? itemsError.message : '制造项列表加载失败，请重试。'}</AlertDescription></Alert> : null}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>制造项</TableHead><TableHead>硬件身份</TableHead><TableHead>状态</TableHead><TableHead>凭证</TableHead><TableHead>绑定信息</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {itemsLoading && itemPages == null ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden />正在加载制造项…</TableCell></TableRow> : null}
                      {!itemsLoading && items.length === 0 ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">当前筛选条件下没有制造项。</TableCell></TableRow> : null}
                      {items.map((item) => (
                        <Fragment key={item.itemId}>
                          <TableRow className={cn('transition-colors hover:bg-muted/20', selectedItemId === item.itemId && 'bg-muted/30')}>
                            <TableCell className="whitespace-normal"><button type="button" className="max-w-full break-all whitespace-normal text-left font-medium underline-offset-4 hover:underline" onClick={() => void openItemDetail(item)}>{item.itemId}</button><div className="mt-1 text-xs text-muted-foreground">创建于 {formatDateShort(item.createTime)}</div></TableCell>
                            <TableCell className="whitespace-normal break-all"><code className="break-all font-mono text-xs">{item.hardwareUuid}</code></TableCell>
                            <TableCell>{statusBadge(manufacturingItemStatusLabel[item.status] ?? item.status, getManufacturingItemTone(item.status))}</TableCell>
                            <TableCell className="whitespace-normal break-all"><code className="break-all font-mono text-xs">{item.credentialId}</code><div className="mt-1 text-xs text-muted-foreground">v{item.credentialVersion}</div></TableCell>
                            <TableCell className="whitespace-normal break-words text-sm">{item.status === 'BOUND' ? item.boundDeviceId || '已绑定设备' : item.status === 'AVAILABLE' ? '尚未绑定' : item.status === 'VOID' ? '已作废' : '—'}</TableCell>
                            <TableCell><div className="flex justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => void openItemDetail(item)}><Eye className="size-3.5" aria-hidden />查看</Button>{canManage && item.status === 'AVAILABLE' ? <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => { setPendingVoid(item); setVoidReason(''); }}><Ban className="size-3.5" aria-hidden />作废</Button> : null}</div></TableCell>
                          </TableRow>
                          {selectedItemId === item.itemId ? <TableRow className="bg-muted/10"><TableCell colSpan={6} className="p-3">{itemDetailPanel}</TableCell></TableRow> : null}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {hasMoreItems ? <div className="flex justify-center border-t p-2.5"><Button type="button" variant="outline" size="sm" onClick={() => void setItemPageCount(itemPageCount + 1)} disabled={itemsValidating} className="gap-1.5">{itemsValidating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}加载更多</Button></div> : null}
              </div>

            </div>
          ) : null}
          <SheetFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={voidBusy}>关闭</Button></SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={canManage && pendingVoid != null} onOpenChange={(open) => { if (!open && !voidBusy) { setPendingVoid(null); setVoidReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>作废这个制造项？</AlertDialogTitle><AlertDialogDescription>作废后该制造项不能再绑定设备，关联的设备凭证也会被吊销。这个操作不可恢复，请确认当前硬件身份和凭证版本。</AlertDialogDescription></AlertDialogHeader>
          {pendingVoid ? <div className="space-y-2"><div className="rounded-lg border bg-muted/20 p-3 text-xs"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">制造项</span><code className="font-mono">{pendingVoid.itemId}</code></div><div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted-foreground">硬件身份</span><code className="font-mono">{pendingVoid.hardwareUuid}</code></div></div><Label htmlFor="manufacturing-void-reason">作废说明（可选）</Label><Input id="manufacturing-void-reason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={256} placeholder="例如：产线抽检失败" /></div> : null}
          <AlertDialogFooter><AlertDialogCancel disabled={voidBusy}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={voidBusy} onClick={(event) => { event.preventDefault(); void voidItem(); }}>{voidBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ban className="size-4" aria-hidden />}确认作废</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AllocateDialog({
  batch: initialBatch,
  batches,
  open,
  onOpenChange,
  onCreated,
}: {
  batch: CredentialManufacturingBatchView | null;
  batches: CredentialManufacturingBatchView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const batch = batches.find((item) => item.batchId === selectedBatchId) ?? null;
  useEffect(() => {
    if (open) { setSelectedBatchId(initialBatch?.batchId ?? ''); setQuantity(''); setReference(''); }
  }, [open, initialBatch]);
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!batch) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > batch.availableCount) {
      toast.error(`领取数量需要在 1 到 ${formatNumber(batch.availableCount)} 之间。`);
      return;
    }
    if (!reference.trim()) {
      toast.error('请填写领取单引用。');
      return;
    }
    setBusy(true);
    try {
      await openPlatformPost('/api/v1/credential-distributions', {
        batchId: batch.batchId,
        quantity: parsedQuantity,
        distributionRequestId: reference.trim(),
      });
      toast.success('领取单已创建，可继续导出。');
      setQuantity('');
      setReference('');
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '创建领取单失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建领取单</DialogTitle>
          <DialogDescription>从选定批次领取凭证。创建后成员固定，可导出交付。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2"><Label>来源批次</Label><Select value={selectedBatchId} onValueChange={(value) => { setSelectedBatchId(value ?? ''); setQuantity(''); }}><SelectTrigger className="w-full" aria-label="选择来源批次"><SelectValue placeholder="请选择制造批次" /></SelectTrigger><SelectContent>{batches.filter((item) => item.availableCount > 0).map((item) => <SelectItem key={item.batchId} value={item.batchId}>{item.batchId} · 可绑定 {formatNumber(item.availableCount)}</SelectItem>)}</SelectContent></Select></div>
        {batch ? (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">批次</span>
                <code className="font-mono text-xs">{batch.batchId}</code>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">可绑定制造项（含已划拨）</span>
                <span className="font-semibold tabular-nums">{formatNumber(batch.availableCount)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="distribution-quantity">领取数量</Label>
              <Input required id="distribution-quantity" type="number" min={1} max={batch.availableCount} value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="输入本次领取数量" />
            </div>
            <p className="text-xs text-muted-foreground">已划拨成员不能重复领取，服务会核对实际剩余数量。</p>
            <div className="space-y-2">
              <Label htmlFor="distribution-reference">领取单引用</Label>
              <Input required id="distribution-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="例如：上海一期 / 产线 A" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
              <Button type="submit" disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PackageCheck className="size-4" aria-hidden />}
                确认领取
              </Button>
            </DialogFooter>
          </form>
        ) : <p className="text-sm text-muted-foreground">选择来源批次后，填写本次领取数量和领取单引用。</p>}
      </DialogContent>
    </Dialog>
  );
}

function ExportDialog({
  distribution,
  onOpenChange,
  onCreated,
}: {
  distribution: CredentialDistributionView | null;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const [format, setFormat] = useState<'EXCEL' | 'JSON'>('EXCEL');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!distribution) return;
    setBusy(true);
    try {
      await openPlatformPost('/api/v1/credential-exports', { distributionId: distribution.distributionId, format });
      toast.success('导出任务已创建，完成后可签发下载链接。');
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '导出任务创建失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={distribution != null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建凭证导出任务</DialogTitle>
          <DialogDescription>仅导出当前领取单中的设备凭证。</DialogDescription>
        </DialogHeader>
        {distribution ? (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">固定集合</span><span className="font-semibold tabular-nums">{formatNumber(distribution.allocatedQuantity)} 台</span></div>
              <div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted-foreground">领取单引用</span><span>{distribution.distributionRequestId}</span></div>
            </div>
            <div className="space-y-2">
              <Label>导出格式</Label>
              <Select value={format} onValueChange={(value) => setFormat(value as 'EXCEL' | 'JSON')}>
                <SelectTrigger aria-label="导出格式" className="w-full"><SelectValue placeholder="选择格式" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCEL">Excel（适合产线交付）</SelectItem>
                  <SelectItem value="JSON">JSON（适合自动化流程）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>文件生成后，在“导出记录”中下载。</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
              <Button type="submit" disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CloudDownload className="size-4" aria-hidden />}
                创建导出任务
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DistributionDetailDialog({
  distribution: selectedDistribution,
  canExport,
  onOpenChange,
  onExport,
}: {
  distribution: CredentialDistributionView | null;
  canExport: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (distribution: CredentialDistributionView) => void;
}) {
  const key = selectedDistribution ? `/api/v1/credential-distributions/${encodeURIComponent(selectedDistribution.distributionId)}` : null;
  const { data, isLoading: loading, error, mutate } = useSWR<CredentialDistributionView>(key, openPlatformGetFetcher);
  const distribution = data ?? selectedDistribution;
  const open = selectedDistribution != null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>领取单详情</DialogTitle>
          <DialogDescription>成员固定，导出文件仅包含本单凭证。</DialogDescription>
        </DialogHeader>
        {error ? <ApiErrorAlert message={error.message} /> : null}
        {error ? <Button type="button" variant="outline" onClick={() => void mutate()}>重新加载</Button> : null}
        {loading ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />正在加载领取单详情…
          </div>
        ) : distribution ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">领取单状态</p><div className="mt-1">{statusBadge(distributionStatusLabel[distribution.status] ?? distribution.status, getDistributionTone(distribution.status))}</div></div>
              <div><p className="text-xs text-muted-foreground">领取数量</p><p className="mt-1 font-semibold tabular-nums">{formatNumber(distribution.allocatedQuantity)} 台</p></div>
              <div><p className="text-xs text-muted-foreground">领取单 ID</p><code className="mt-1 block break-all font-mono text-xs">{distribution.distributionId}</code></div>
              <div><p className="text-xs text-muted-foreground">来源批次</p><code className="mt-1 block break-all font-mono text-xs">{distribution.batchId}</code></div>
              <div><p className="text-xs text-muted-foreground">领取单引用</p><p className="mt-1 break-all text-sm">{distribution.distributionRequestId}</p></div>
              <div><p className="text-xs text-muted-foreground">领取时间</p><p className="mt-1 text-sm">{distribution.frozenAt ? formatDate(distribution.frozenAt) : '尚未领取'}</p></div>
              <div><p className="text-xs text-muted-foreground">失效时间</p><p className="mt-1 text-sm">{formatDate(distribution.expiresAt)}</p></div>
              <div><p className="text-xs text-muted-foreground">更新时间</p><p className="mt-1 text-sm">{formatDate(distribution.updateTime)}</p></div>
            </div>
            <details className="rounded-lg border p-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground focus-visible:outline focus-visible:outline-ring">集合校验信息</summary>
              <code className="mt-2 block break-all font-mono text-muted-foreground">{distribution.allocationHash}</code>
            </details>
          </div>
        ) : null}
        <DialogFooter>
          {data?.status === 'FROZEN' && canExport && !error ? <Button type="button" onClick={() => { onExport(data); onOpenChange(false); }} className="gap-1.5"><CloudDownload className="size-4" aria-hidden />创建导出任务</Button> : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreRegistrationDialog({
  open,
  onOpenChange,
  productId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  onCreated: () => Promise<unknown>;
}) {
  const [hardwareUuids, setHardwareUuids] = useState('');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const hardwareValues = Array.from(new Set(hardwareUuids.split(/\s|,|，/).map((item) => item.trim()).filter(Boolean)));
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Array.from(new Set(hardwareUuids.split(/\s|,|，/).map((item) => item.trim()).filter(Boolean)));
    if (values.length === 0) {
      toast.error('请至少填写一个 Hardware Identity。');
      return;
    }
    if (values.length > 500) { toast.error('单次最多导入 500 个硬件身份，请分批导入。'); return; }
    if (!expiresAt || !Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= Date.now()) {
      toast.error('资格有效期必须晚于当前时间。');
      return;
    }
    setBusy(true);
    try {
      const result = await openPlatformPost<{ inserted: number; duplicate: number; invalid: number; invalidItems: { index: number; message: string }[] }>('/api/v1/products/' + encodeURIComponent(productId) + '/pre-registrations', {
        hardwareUuids: values,
        note: note.trim() || undefined,
        expiresAt: new Date(expiresAt).getTime(),
      });
      const summary = `新增 ${result.inserted} 个，重复 ${result.duplicate} 个，无效 ${result.invalid} 个。`;
      if (result.invalid > 0) toast.warning(summary); else toast.success(summary);
      if (result.invalid > 0) {
        setImportErrors(result.invalidItems.map((item) => `${values[item.index]}：${item.message}`));
        setHardwareUuids(result.invalidItems.map((item) => values[item.index]).join('\n'));
        await onCreated();
        return;
      }
      setImportErrors([]);
      setHardwareUuids('');
      setNote('');
      setExpiresAt('');
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '预注册导入失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加预注册 UUID</DialogTitle>
          <DialogDescription>适用于一型一密预注册：先导入出厂 Hardware Identity，设备首次绑定时再领取设备凭证。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {importErrors.length > 0 ? <Alert variant="destructive"><AlertDescription><p>部分资格未导入，已保留待修改的硬件身份。</p><ul className="mt-2 max-h-32 overflow-y-auto">{importErrors.map((message, index) => <li key={index}>{message}</li>)}</ul></AlertDescription></Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="pre-registration-hardware">Hardware Identity</Label>
            <textarea id="pre-registration-hardware" className="flex min-h-28 w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" value={hardwareUuids} onChange={(event) => setHardwareUuids(event.target.value)} placeholder={'一行一个，例如：\nGW-HW-202608-0101\nGW-HW-202608-0102'} />
            <p className="text-xs text-muted-foreground">已识别 {hardwareValues.length} 个不同的硬件身份，单次最多 500 个。</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pre-registration-expires">资格有效期</Label>
              <Input id="pre-registration-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pre-registration-note">备注（可选）</Label>
              <Input id="pre-registration-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：华东试产" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
            <Button type="submit" disabled={busy || hardwareValues.length === 0 || hardwareValues.length > 500 || !expiresAt} className="gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              导入资格
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetProductSecretDialog({
  credential,
  onOpenChange,
  onDelivered,
}: {
  credential: CredentialSummaryView | null;
  onOpenChange: (open: boolean) => void;
  onDelivered: (delivery: CredentialSecretDeliveryView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!credential) return;
    setBusy(true);
    try {
      const delivery = await openPlatformPost<CredentialSecretDeliveryView>(`/api/v1/credentials/${encodeURIComponent(credential.credentialId)}/reset`, {
        reasonCode: 'MANUAL_RESET',
        reason: '管理台手动重置产品密钥',
        expectedVersion: credential.securityVersion,
      });
      toast.success('新产品密钥已签发，请立即保存。');
      onOpenChange(false);
      if (delivery.secret) onDelivered(delivery);
      else toast.info('凭证已存在；重复签发不会再次交付明文。');
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '重置失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={credential != null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认重置产品密钥？</AlertDialogTitle>
          <AlertDialogDescription>
            当前密钥会立即吊销，并签发同一凭证族的新版本。正在使用旧密钥的设备将无法继续认证，请确认已安排切换窗口。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={(event) => { event.preventDefault(); void submit(); }} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            重置并交付新密钥
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CredentialsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

const ProductCredentialsPage = () => {
  const { projectId = '', productId = '' } = useParams<{ projectId: string; productId: string }>();
  const [activeTab, setActiveTab] = useState('');
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [distributionBatchFilter, setDistributionBatchFilter] = useState('ALL');
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [manufacturingBatch, setManufacturingBatch] = useState<CredentialManufacturingBatchView | null>(null);
  const [allocateBatch, setAllocateBatch] = useState<CredentialManufacturingBatchView | null>(null);
  const [exportDistribution, setExportDistribution] = useState<CredentialDistributionView | null>(null);
  const [distributionDetail, setDistributionDetail] = useState<CredentialDistributionView | null>(null);
  const [preRegistrationDialogOpen, setPreRegistrationDialogOpen] = useState(false);
  const [resetCredential, setResetCredential] = useState<CredentialSummaryView | null>(null);
  const [issueCredentialKind, setIssueCredentialKind] = useState<'PRODUCT_SECRET' | 'DEVICE_SECRET' | null>(null);
  const [pendingCredentialAction, setPendingCredentialAction] = useState<{ credential: CredentialSummaryView; action: CredentialAction } | null>(null);
  const [rotationCredential, setRotationCredential] = useState<CredentialSummaryView | null>(null);
  const [delivery, setDelivery] = useState<CredentialSecretDeliveryView | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<CredentialPreRegistrationView | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const productKey = productId ? `/api/v1/products/${encodeURIComponent(productId)}` : null;
  const { data: product, error: productError, isLoading: productLoading } = useSWR<ProductDetailView>(productKey, openPlatformGetFetcher);
  const canReadCredentials = product != null && product.lifecycleStatus !== 'DRAFT';
  const supportsProductSecret = product?.authMode === 'PRODUCT_SECRET';
  const supportsDeviceSecret = product?.authMode === 'DEVICE_SECRET';
  const preRegistrationMode = supportsProductSecret && product?.bootstrapMode === 'STRICT';
  const visibleTab = (!supportsDeviceSecret && ['batches', 'distributions', 'exports'].includes(activeTab))
    || (!preRegistrationMode && activeTab === 'pre-registrations') || !activeTab
    ? (supportsDeviceSecret ? 'batches' : preRegistrationMode ? 'pre-registrations' : 'credentials')
    : activeTab;
  const batchesKey = canReadCredentials && productId && supportsDeviceSecret ? `/api/v1/credential-batches?productId=${encodeURIComponent(productId)}&limit=100` : null;
  const credentialsKey = canReadCredentials && productId ? `/api/v1/credentials?productId=${encodeURIComponent(productId)}&limit=100` : null;
  const exportsKey = canReadCredentials && productId && supportsDeviceSecret ? `/api/v1/credential-exports?productId=${encodeURIComponent(productId)}&limit=100` : null;
  const rotationsKey = canReadCredentials && productId ? `/api/v1/rotation-tasks?productId=${encodeURIComponent(productId)}&limit=100` : null;

  const { data: batchesData, isLoading: batchesLoading, error: batchesError, mutate: mutateBatches } = useSWR<CursorResult<CredentialManufacturingBatchView>>(batchesKey, openPlatformGetFetcher, { refreshInterval: (data) => data?.items.some((item) => item.status === 'ISSUING') ? 5000 : 0 });
  const { data: credentialsData, isLoading: credentialsLoading, error: credentialsError, mutate: mutateCredentials } = useSWR<CursorResult<CredentialSummaryView>>(credentialsKey, openPlatformGetFetcher);
  const { data: exportsData, isLoading: exportsLoading, error: exportsError, mutate: mutateExports } = useSWR<CursorResult<CredentialExportTaskView>>(exportsKey, openPlatformGetFetcher, { refreshInterval: (data) => data?.items.some((item) => ['PENDING', 'RUNNING'].includes(item.status)) ? 5000 : 0 });
  const getPreRegistrationPageKey = (pageIndex: number, previousPageData: CursorResult<CredentialPreRegistrationView> | null) => {
    if (!canReadCredentials || !productId || !preRegistrationMode) return null;
    if (pageIndex > 0 && (!previousPageData || !previousPageData.hasMore)) return null;
    const params = new URLSearchParams({ limit: '100' });
    if (previousPageData?.nextCursor) params.set('cursor', previousPageData.nextCursor);
    return `/api/v1/products/${encodeURIComponent(productId)}/pre-registrations?${params.toString()}`;
  };
  const { data: preRegistrationPages, isLoading: preRegistrationsLoading, error: preRegistrationsError, size: preRegistrationPageCount, setSize: setPreRegistrationPageCount, mutate: mutatePreRegistrations } = useSWRInfinite<CursorResult<CredentialPreRegistrationView>>(getPreRegistrationPageKey, openPlatformGetFetcher);
  const { data: rotationsData, isLoading: rotationsLoading, error: rotationsError, mutate: mutateRotations } = useSWR<CursorResult<CredentialRotationTaskView>>(rotationsKey, openPlatformGetFetcher);

  useEffect(() => {
    const lastPage = preRegistrationPages?.[preRegistrationPages.length - 1];
    if (preRegistrationPages && lastPage?.hasMore && preRegistrationPages.length === preRegistrationPageCount) {
      void setPreRegistrationPageCount(preRegistrationPageCount + 1);
    }
  }, [preRegistrationPageCount, preRegistrationPages, setPreRegistrationPageCount]);

  const batches = batchesData?.items ?? [];
  const credentials = credentialsData?.items ?? [];
  const manufacturingState = batches.map((batch) => `${batch.batchId}:${batch.status}`).join(',');
  useEffect(() => {
    if (manufacturingState) void mutateCredentials();
  }, [manufacturingState, mutateCredentials]);
  const exports = exportsData?.items ?? [];
  const preRegistrations = preRegistrationPages?.flatMap((page) => page.items) ?? [];
  const rotations = rotationsData?.items ?? [];
  const productSecret = credentials.find((credential) => credential.kind === 'PRODUCT_SECRET' && credential.credentialStatus === 'ACTIVE');
  const deviceCredentials = credentials.filter((credential) => credential.kind === 'DEVICE_SECRET');
  const distributionBatchIds = batches.map((batch) => batch.batchId).join(',');
  const distributionsKey = productId && batchesData ? `/api/v1/credential-distributions?productId=${encodeURIComponent(productId)}&batches=${encodeURIComponent(distributionBatchIds)}` : null;
  const { data: distributionsData, isLoading: distributionsLoading, error: distributionsError, mutate: mutateDistributions } = useSWR<CredentialDistributionView[]>(distributionsKey, async () => {
    if (batches.length === 0) return [];
    const distributionLists = await Promise.all(batches.map((batch) => openPlatformGetFetcher<CredentialDistributionView[]>(`/api/v1/credential-distributions/${encodeURIComponent(batch.batchId)}/distributions`)));
    return distributionLists.flat();
  });
  const distributions = distributionsData ?? [];
  const sortedDistributions = distributions.filter((item) => distributionBatchFilter === 'ALL' || item.batchId === distributionBatchFilter).sort((left, right) => right.createTime - left.createTime);
  const allocatedCount = distributions.reduce((sum, distribution) => sum + distribution.allocatedQuantity, 0);
  const activeExports = exports.filter((item) => ['PENDING', 'RUNNING'].includes(item.status)).length;
  const canProvision = product?.lifecycleStatus === 'PUBLISHED';
  const manufacturingFlowEnabled = canProvision && supportsDeviceSecret;
  const canCreateBatch = manufacturingFlowEnabled;
  const canImportPreRegistrations = canProvision && preRegistrationMode && supportsProductSecret;
  const productSecretOnly = supportsProductSecret && !supportsDeviceSecret;
  const hasErrors = productError || batchesError || credentialsError || exportsError || preRegistrationsError || rotationsError || distributionsError;

  const refreshAll = async () => {
    await Promise.all([mutateBatches(), mutateCredentials(), mutateExports(), mutatePreRegistrations(), mutateRotations(), mutateDistributions()]);
  };

  const removePreRegistration = async () => {
    if (!canImportPreRegistrations || !pendingRemoval) return;
    setBusyAction(true);
    try {
      await openPlatformDelete(`/api/v1/pre-registrations/${encodeURIComponent(pendingRemoval.preRegistrationId)}`, { reasonCode: 'MANUAL_REMOVE', reason: '管理台移除预注册资格', expectedVersion: pendingRemoval.version });
      toast.success('预注册资格已移除。');
      setPendingRemoval(null);
      await mutatePreRegistrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移除失败，请稍后重试。');
    } finally {
      setBusyAction(false);
    }
  };

  const downloadExport = async (task: CredentialExportTaskView) => {
    if (!manufacturingFlowEnabled) {
      toast.info('当前产品状态不允许签发下载链接。');
      return;
    }
    try {
      const result = await openPlatformPost<{ downloadUrl: string; expiresAt: number }>(`/api/v1/credential-exports/${encodeURIComponent(task.exportId)}/download-link`, {});
      toast.success(`下载链接已签发，将于 ${formatDate(result.expiresAt)} 失效。`);
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '下载链接签发失败。');
    }
  };

  const openExportForBatch = (batch: CredentialManufacturingBatchView) => {
    setDistributionBatchFilter(batch.batchId);
    setActiveTab('distributions');
  };

  const openDistributionDetail = (distribution: CredentialDistributionView) => setDistributionDetail(distribution);

  const breadcrumbItems = [
    { to: '/projects', title: '项目' },
    { to: `/projects/${projectId}/products`, title: '产品' },
    { to: `/projects/${projectId}/products/${productId}`, title: product?.productName ?? '产品详情' },
  ];

  if (productLoading && !product) {
    return (
      <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4">
        <BreadcrumbComp title="凭证与量产" items={breadcrumbItems} />
        <ProjectWorkspaceShell activePrimary="products"><CredentialsPageSkeleton /></ProjectWorkspaceShell>
      </StyleAwareWrapper>
    );
  }

  if (!product) {
    return (
      <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4">
        <BreadcrumbComp title="凭证与量产" items={breadcrumbItems} />
        <ProjectWorkspaceShell activePrimary="products">
          <ApiErrorAlert code={(productError as OpenPlatformApiError | undefined)?.code} message={productError?.message ?? '产品不存在。'} />
        </ProjectWorkspaceShell>
      </StyleAwareWrapper>
    );
  }

  return (
    <StyleAwareWrapper lyraClassName="flex flex-col gap-px bg-border p-px" defaultClassName="flex flex-col gap-4">
      <BreadcrumbComp title="凭证与量产" items={breadcrumbItems} />
      <ProjectWorkspaceShell activePrimary="products">
        <div className="space-y-4">
          {hasErrors ? <ApiErrorAlert code="CREDENTIAL_DATA_ERROR" message="凭证数据加载失败，请刷新后重试。" /> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-1 gap-1 px-2 text-muted-foreground" nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}`} />}>
                <ArrowLeft className="size-3.5" aria-hidden />
                返回产品
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="size-5 shrink-0" aria-hidden />
                <h1 className="truncate text-lg font-semibold tracking-tight">{product.productName}</h1>
                <ProductLifecycleBadge status={product.lifecycleStatus} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>Product ID</span><code className="font-mono">{product.productId}</code><CopyIdButton value={product.productId} label="Product ID" />
                <span className="text-border">·</span><span>{product.productModel || '未填写型号'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void refreshAll()}>
                <RefreshCw className="size-3.5" aria-hidden /> 刷新状态
              </Button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-1" aria-label="产品功能">
            <Button type="button" variant="ghost" size="sm" className={PRODUCT_TAB_CLASS} nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}`} />}><Boxes className="size-3.5" aria-hidden />产品概览</Button>
            <Button type="button" variant="ghost" size="sm" className={PRODUCT_TAB_CLASS} nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}/model`} />}><KeyRound className="size-3.5" aria-hidden />物模型</Button>
            <Button type="button" variant="secondary" size="sm" className={`${PRODUCT_TAB_CLASS} bg-background shadow-sm`} nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}/credentials`} />}><FileKey2 className="size-3.5" aria-hidden />凭证与量产</Button>
          </nav>

          {product.lifecycleStatus === 'DRAFT' ? (
            <section className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-muted/10 p-6" aria-labelledby="credentials-publish-title">
              <FileKey2 className="size-6 text-muted-foreground" aria-hidden />
              <h2 id="credentials-publish-title" className="text-base font-semibold">发布产品后，开始准备设备凭证</h2>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">先完成产品接入配置和物模型，再检查并发布。发布后即可按接入方式签发密钥、创建量产批次或维护预注册名单。</p>
              <Button nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}`} />}>返回产品，完成发布</Button>
            </section>
          ) : <>
          {!canProvision ? (
            <Alert className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
              <CircleAlert className="size-4" aria-hidden />
              <AlertDescription>{product.lifecycleStatus === 'DEPRECATED' ? '产品已废弃，当前为只读档案。可查看历史凭证、批次和领取单；不再支持签发、变更、导出或下载密钥。' : '产品已停用，当前仅可查看历史数据。重新启用产品后可继续操作。'}</AlertDescription>
            </Alert>
          ) : null}
          {canProvision && productSecretOnly && product.bootstrapMode === 'OPEN' ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>动态注册：无需提前登记 UUID。设备首次使用产品密钥注册后，领取设备密钥。</AlertDescription>
            </Alert>
          ) : null}
          {canProvision && productSecretOnly && product.bootstrapMode === 'STRICT' ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>预注册：先添加 UUID 名单。名单内设备使用产品密钥注册后，领取设备密钥。</AlertDescription>
            </Alert>
          ) : null}


          {batchesLoading || credentialsLoading || exportsLoading || preRegistrationsLoading ? <RequestLoading label="正在加载凭证概览…" /> : batchesError || credentialsError || exportsError || preRegistrationsError ? null : <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/10 px-3 py-2 text-xs" aria-label="凭证与量产状态">
            <span className="text-muted-foreground">设备凭证 <span className="ml-1 font-medium tabular-nums text-foreground">{formatNumber(deviceCredentials.length)}</span></span>
            {supportsDeviceSecret ? <span className="text-muted-foreground">已领取 <span className="ml-1 font-medium tabular-nums text-foreground">{formatNumber(allocatedCount)}</span></span> : null}
            {supportsDeviceSecret ? <span className="text-muted-foreground">导出中 <span className="ml-1 font-medium tabular-nums text-foreground">{formatNumber(activeExports)}</span></span> : null}
          </div>
          {supportsProductSecret ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="text-sm font-medium">产品密钥</span>{productSecret ? statusBadge(credentialStatusLabel[productSecret.credentialStatus] ?? productSecret.credentialStatus, getCredentialTone(productSecret.credentialStatus)) : statusBadge('未签发', 'warning')}</div>
                {productSecret ? <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{productSecret.credentialId} · v{productSecret.versionNo}</p> : <p className="mt-1 text-xs text-muted-foreground">用于设备首次接入。</p>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => productSecret ? setResetCredential(productSecret) : setIssueCredentialKind('PRODUCT_SECRET')} disabled={!canProvision}>{productSecret ? '重置产品密钥' : '签发产品密钥'}</Button>
            </div>
          ) : null}

          </>}
          <Tabs value={visibleTab} onValueChange={(value) => setActiveTab(value as string)} className="flex-col gap-4">
            <TabsList variant="line" className="w-full gap-1 justify-start overflow-x-auto rounded-none border-b px-0">
              {supportsDeviceSecret ? <TabsTrigger value="batches" className="shrink-0 px-3">量产批次</TabsTrigger> : null}
              {supportsDeviceSecret ? <TabsTrigger value="distributions" className="shrink-0 px-3">领取单</TabsTrigger> : null}
              <TabsTrigger value="credentials" className="shrink-0 px-3">设备凭证</TabsTrigger>
              {supportsDeviceSecret ? <TabsTrigger value="exports" className="shrink-0 px-3">导出记录</TabsTrigger> : null}
              {preRegistrationMode ? <TabsTrigger value="pre-registrations" className="shrink-0 px-3">预注册名单</TabsTrigger> : null}
              <TabsTrigger value="rotations" className="shrink-0 px-3">密钥轮换</TabsTrigger>
            </TabsList>

            <TabsContent value="batches" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-start gap-2"><div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground"><PackagePlus className="size-3.5" aria-hidden /></div><div className="min-w-0"><h2 className="text-sm font-semibold leading-5">制造批次</h2><p className="mt-1 text-xs leading-4 text-muted-foreground">批量生成设备凭证，完成后可创建领取单。</p></div></div><Button type="button" size="sm" className="gap-1.5" onClick={() => setBatchDialogOpen(true)} disabled={!canCreateBatch}><Plus className="size-3.5" aria-hidden />创建批次</Button></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>批次</TableHead><TableHead>状态</TableHead><TableHead>数量</TableHead><TableHead>失效时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {batchesLoading || batchesError ? <RequestTableState colSpan={5} error={batchesError} loading={batchesLoading} onRetry={() => void mutateBatches()} /> : batches.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">{canProvision ? '还没有量产批次，点击“创建批次”开始准备设备凭证。' : '没有历史量产批次。'}</TableCell></TableRow> : batches.map((batch) => {
                      const displayStatus = getBatchDisplayStatus(batch);
                      const fullyAllocated = displayStatus === 'FULLY_ALLOCATED';
                      return <TableRow key={batch.batchId} className="transition-colors hover:bg-muted/20">
                        <TableCell><button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setManufacturingBatch(batch)} aria-label={`查看批次 ${batch.batchId}`}>批次 {maskId(batch.batchId)}</button><div className="mt-1 text-xs text-muted-foreground">{formatDateShort(batch.createTime)}</div></TableCell>
                        <TableCell>{statusBadge(batchStatusLabel[displayStatus] ?? displayStatus, getBatchTone(displayStatus))}</TableCell>
                        <TableCell><div className="font-medium tabular-nums">{formatNumber(batch.targetQuantity)}</div><div className="mt-1 text-xs text-muted-foreground">{fullyAllocated ? `已全部划拨 ${formatNumber(batch.allocatedQuantity)}` : `可绑定 ${formatNumber(batch.availableCount)}`} · 已绑定 {formatNumber(batch.boundCount)}</div></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(batch.expiresAt)}</TableCell>
                        <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-1.5"><Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => { setAllocateBatch(batch); setAllocationOpen(true); }} disabled={!manufacturingFlowEnabled || batch.availableCount === 0}><PackageCheck className="size-3.5" aria-hidden />{fullyAllocated ? '已全部领取' : '创建领取单'}</Button><Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => void openExportForBatch(batch)} disabled={!distributions.some((item) => item.batchId === batch.batchId)}><Eye className="size-3.5" aria-hidden />查看领取单</Button></div></TableCell>
                      </TableRow>;
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="distributions" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2"><Label>来源批次</Label><Select value={distributionBatchFilter} onValueChange={(value) => setDistributionBatchFilter(value ?? 'ALL')}><SelectTrigger aria-label="筛选领取单来源批次" className="w-full sm:w-80"><SelectValue>{distributionBatchFilter === 'ALL' ? '全部批次' : distributionBatchFilter}</SelectValue></SelectTrigger><SelectContent><SelectItem value="ALL">全部批次</SelectItem>{batches.map((batch) => <SelectItem key={batch.batchId} value={batch.batchId}>{batch.batchId}</SelectItem>)}</SelectContent></Select></div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-sm font-semibold">领取单列表</h2><p className="text-xs text-muted-foreground">按产线或订单领取凭证，再导出交付。</p></div>
                <Button type="button" size="sm" className="gap-1.5" onClick={() => { setAllocateBatch(null); setAllocationOpen(true); }} disabled={!manufacturingFlowEnabled || !batches.some((batch) => batch.availableCount > 0)}><Plus className="size-3.5" aria-hidden />创建领取单</Button>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>领取单</TableHead><TableHead>来源批次</TableHead><TableHead>数量</TableHead><TableHead>状态</TableHead><TableHead>领取时间</TableHead><TableHead>失效时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {batchesLoading || distributionsLoading || batchesError || distributionsError ? <RequestTableState colSpan={7} error={batchesError || distributionsError} loading={batchesLoading || distributionsLoading} onRetry={() => void mutateDistributions()} /> : sortedDistributions.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">{canProvision ? '还没有领取单。点击“创建领取单”，选择批次和数量。' : '没有历史领取单。'}</TableCell></TableRow> : sortedDistributions.map((distribution) => <TableRow key={distribution.distributionId} className="transition-colors hover:bg-muted/20">
                      <TableCell><button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => void openDistributionDetail(distribution)}>{distribution.distributionId}</button><div className="mt-1 text-xs text-muted-foreground">{distribution.distributionRequestId}</div></TableCell>
                      <TableCell><code className="font-mono text-xs">{distribution.batchId}</code></TableCell>
                      <TableCell><span className="font-medium tabular-nums">{formatNumber(distribution.allocatedQuantity)}</span><span className="text-xs text-muted-foreground"> / {formatNumber(distribution.requestedQuantity)}</span></TableCell>
                      <TableCell>{statusBadge(distributionStatusLabel[distribution.status] ?? distribution.status, getDistributionTone(distribution.status))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{distribution.frozenAt ? formatDate(distribution.frozenAt) : '尚未领取'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(distribution.expiresAt)}</TableCell>
                      <TableCell><div className="flex justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" onClick={() => void openDistributionDetail(distribution)}>查看</Button>{distribution.status === 'FROZEN' && manufacturingFlowEnabled ? <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setExportDistribution(distribution)}><CloudDownload className="size-3.5" aria-hidden />导出</Button> : null}</div></TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="credentials" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">设备凭证摘要</h2><p className="text-xs text-muted-foreground">管理设备凭证的访问状态；已激活设备可发起轮换。</p></div>{supportsDeviceSecret ? <Button type="button" size="sm" className="gap-1.5" onClick={() => setIssueCredentialKind('DEVICE_SECRET')} disabled={!manufacturingFlowEnabled}><Plus className="size-3.5" aria-hidden />手动签发</Button> : null}</div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>设备身份</TableHead><TableHead>凭证版本</TableHead><TableHead>状态</TableHead><TableHead>凭证族</TableHead><TableHead>更新时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>{credentialsLoading || credentialsError ? <RequestTableState colSpan={6} error={credentialsError} loading={credentialsLoading} onRetry={() => void mutateCredentials()} /> : deviceCredentials.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">还没有设备级凭证摘要。</TableCell></TableRow> : deviceCredentials.map((credential) => <TableRow key={credential.credentialId} className="transition-colors hover:bg-muted/20">
                    <TableCell><div className="font-medium">{credential.deviceId || '未绑定设备'}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{maskId(credential.hardwareUuid)}</div></TableCell>
                    <TableCell><span className="font-mono text-xs">v{credential.versionNo}</span><div className="mt-1 text-xs text-muted-foreground">{credential.credentialId}</div></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1.5">{statusBadge(credentialStatusLabel[credential.credentialStatus] ?? credential.credentialStatus, getCredentialTone(credential.credentialStatus))}{statusBadge(accessStateLabel[credential.accessState] ?? credential.accessState, credential.accessState === 'ENABLED' ? 'success' : 'warning')}</div></TableCell>
                    <TableCell><code className="font-mono text-xs text-muted-foreground">{credential.credentialFamilyId}</code></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(credential.updateTime)}</TableCell>
                    <TableCell><div className="flex justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" onClick={() => canProvision && setRotationCredential(credential)} disabled={!canProvision || credential.credentialStatus !== 'ACTIVE' || !credential.deviceId} title={!credential.deviceId ? '设备激活并绑定后才能轮换' : undefined}><RotateCcw className="size-3.5" aria-hidden />轮换</Button>{canProvision && credential.credentialStatus !== 'REVOKED' ? <Button type="button" variant="ghost" size="sm" className={credential.accessState === 'ENABLED' ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'} onClick={() => setPendingCredentialAction({ credential, action: credential.accessState === 'ENABLED' ? 'FREEZE' : 'UNFREEZE' })}>{credential.accessState === 'ENABLED' ? '冻结' : '解冻'}</Button> : null}<Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setPendingCredentialAction({ credential, action: 'REVOKE' })} disabled={!canProvision || credential.credentialStatus === 'REVOKED'}>吊销</Button></div></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="exports" className="space-y-3">
              <div><h2 className="text-sm font-semibold">导出任务</h2><p className="text-xs text-muted-foreground">导出完成后可下载 Excel 或 JSON 文件。</p></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>任务</TableHead><TableHead>集合</TableHead><TableHead>格式</TableHead><TableHead>结果</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>{exportsLoading || exportsError ? <RequestTableState colSpan={5} error={exportsError} loading={exportsLoading} onRetry={() => void mutateExports()} /> : exports.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">还没有导出记录。请先从领取单中创建导出任务。</TableCell></TableRow> : exports.map((task) => <TableRow key={task.exportId} className="transition-colors hover:bg-muted/20">
                    <TableCell><div className="font-medium">{task.exportId}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(task.createTime)}</div></TableCell>
                    <TableCell><div className="font-mono text-xs">{task.distributionId}</div><div className="mt-1 text-xs text-muted-foreground">{formatNumber(task.expectedCount)} 台</div></TableCell>
                    <TableCell><Badge variant="outline">{task.format}</Badge></TableCell>
                    <TableCell>{statusBadge(exportStatusLabel[task.status] ?? task.status, getExportTone(task.status))}<div className="mt-1 text-xs text-muted-foreground">{formatNumber(task.successCount)} / {formatNumber(task.expectedCount)} 成功</div></TableCell>
                    <TableCell className="text-right"><Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void downloadExport(task)} disabled={!manufacturingFlowEnabled || !['SUCCEEDED', 'PARTIALLY_SUCCEEDED'].includes(task.status)}><CloudDownload className="size-3.5" aria-hidden />下载</Button></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pre-registrations" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">预注册名单</h2><p className="text-xs text-muted-foreground">{preRegistrationMode ? '先登记硬件身份，设备首次绑定时再签发 Device Secret。' : '当前产品未启用预注册模式。'}</p></div><Button type="button" size="sm" className="gap-1.5" onClick={() => setPreRegistrationDialogOpen(true)} disabled={!canImportPreRegistrations}><Upload className="size-3.5" aria-hidden />添加 UUID</Button></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>UUID</TableHead><TableHead>状态</TableHead><TableHead>有效期</TableHead><TableHead>备注</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>{preRegistrationsLoading || preRegistrationsError ? <RequestTableState colSpan={5} error={preRegistrationsError} loading={preRegistrationsLoading} onRetry={() => void mutatePreRegistrations()} /> : preRegistrations.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">还没有预注册设备。添加 UUID 后，名单内设备才可首次注册。</TableCell></TableRow> : preRegistrations.map((item) => <TableRow key={item.preRegistrationId} className="transition-colors hover:bg-muted/20">
                    <TableCell><code className="font-mono text-xs">{item.hardwareUuid}</code><div className="mt-1 text-xs text-muted-foreground">代次 {item.registrationGeneration}</div></TableCell>
                    <TableCell>{statusBadge(preRegistrationStatusLabel[item.status] ?? item.status, getPreRegistrationTone(item.status))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(item.expiresAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.note || '—'}</TableCell>
                    <TableCell className="text-right"><Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setPendingRemoval(item)} disabled={!canImportPreRegistrations || item.status !== 'PENDING'}>移除</Button></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="rotations" className="space-y-3">
              <div><h2 className="text-sm font-semibold">Device Secret 轮换</h2><p className="text-xs text-muted-foreground">轮换先签发候选版本，再等待设备领取和切换；旧版本会在宽限期后退役。</p></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>设备</TableHead><TableHead>任务状态</TableHead><TableHead>当前 / 候选版本</TableHead><TableHead>领取截止</TableHead><TableHead>安全模式</TableHead></TableRow></TableHeader>
                  <TableBody>{rotationsLoading || rotationsError ? <RequestTableState colSpan={5} error={rotationsError} loading={rotationsLoading} onRetry={() => void mutateRotations()} /> : rotations.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">还没有轮换任务。</TableCell></TableRow> : rotations.map((task) => <TableRow key={task.taskId} className="transition-colors hover:bg-muted/20">
                    <TableCell><div className="font-medium">{task.hardwareUuid || '—'}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{maskId(task.hardwareUuid)}</div></TableCell>
                    <TableCell>{statusBadge(rotationStatusLabel[task.status] ?? task.status, getRotationTone(task.status))}<div className="mt-1 text-xs text-muted-foreground">{task.reasonCode}</div></TableCell>
                    <TableCell className="font-mono text-xs">v{task.currentCredentialVersion} → {task.replacementCredentialVersion ? `v${task.replacementCredentialVersion}` : '待签发'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(task.claimDeadline)}</TableCell>
                    <TableCell><Badge variant="outline">{task.enforcementMode === 'SECURITY_ENFORCED' ? '强制轮换' : '普通轮换'}</Badge></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
          </>}
        </div>
      </ProjectWorkspaceShell>

      <CreateBatchDialog open={batchDialogOpen && manufacturingFlowEnabled} onOpenChange={setBatchDialogOpen} productId={productId} onCreated={async () => { setActiveTab('batches'); await Promise.all([mutateBatches(), mutateCredentials()]); }} />
      <ManufacturingBatchDetailDialog canManage={canProvision} batch={manufacturingBatch} onOpenChange={(open) => { if (!open) setManufacturingBatch(null); }} onBatchUpdated={mutateBatches} />
      <AllocateDialog open={allocationOpen && manufacturingFlowEnabled} batch={allocateBatch} batches={batches} onOpenChange={setAllocationOpen} onCreated={async () => { setDistributionBatchFilter('ALL'); setActiveTab('distributions'); await Promise.all([mutateBatches(), mutateDistributions()]); }} />
      <ExportDialog distribution={manufacturingFlowEnabled ? exportDistribution : null} onOpenChange={(open) => { if (!open) setExportDistribution(null); }} onCreated={async () => { setActiveTab('exports'); await mutateExports(); }} />
      <DistributionDetailDialog distribution={distributionDetail} canExport={manufacturingFlowEnabled} onOpenChange={(open) => { if (!open) setDistributionDetail(null); }} onExport={setExportDistribution} />
      <PreRegistrationDialog open={preRegistrationDialogOpen && canImportPreRegistrations} onOpenChange={setPreRegistrationDialogOpen} productId={productId} onCreated={mutatePreRegistrations} />
      <IssueCredentialDialog open={canProvision && issueCredentialKind != null} kind={issueCredentialKind ?? 'PRODUCT_SECRET'} productId={productId} onOpenChange={(open) => { if (!open) setIssueCredentialKind(null); }} onDelivered={(next) => { setDelivery(next); void mutateCredentials(); }} />
      <CredentialActionDialog target={canProvision ? pendingCredentialAction : null} onOpenChange={(open) => { if (!open) setPendingCredentialAction(null); }} onCompleted={mutateCredentials} />
      <CreateRotationDialog credential={canProvision ? rotationCredential : null} onOpenChange={(open) => { if (!open) setRotationCredential(null); }} onCreated={mutateRotations} />
      <ResetProductSecretDialog credential={canProvision ? resetCredential : null} onOpenChange={(open) => { if (!open) setResetCredential(null); }} onDelivered={async (next) => { setDelivery(next); await mutateCredentials(); }} />
      <OneTimeSecretDialog delivery={delivery} onOpenChange={(open) => { if (!open) setDelivery(null); }} />

      <AlertDialog open={canImportPreRegistrations && pendingRemoval != null} onOpenChange={(open) => { if (!open && !busyAction) setPendingRemoval(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>移除这条预注册资格？</AlertDialogTitle><AlertDialogDescription>只有尚未绑定的资格可以移除。移除后该 Hardware Identity 不会再自动领取设备凭证。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busyAction}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busyAction} onClick={(event) => { event.preventDefault(); void removePreRegistration(); }}>{busyAction ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}确认移除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StyleAwareWrapper>
  );
};

export default ProductCredentialsPage;
