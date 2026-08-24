import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import {
  ArrowLeft,
  Ban,
  Boxes,
  Check,
  ChevronRight,
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
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { ProductLifecycleBadge } from '@/components/open-platform/product-lifecycle-badge';
import { ProjectWorkspaceShell } from '@/components/open-platform/project-workspace-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StyleAwareWrapper from '@/components/shared/StyleAwareWrapper';
import { OpenPlatformApiError, openPlatformDelete, openPlatformGetFetcher, openPlatformPost } from '@/context/open-platform-context';
import BreadcrumbComp from '@/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { cn } from '@/lib/utils';
import type {
  CredentialDistributionView,
  CredentialExportTaskView,
  CredentialManufacturingBatchView,
  CredentialManufacturingItemView,
  CredentialPreRegistrationView,
  CredentialRotationTaskView,
  CredentialSecretDeliveryView,
  CredentialSummaryView,
  CursorResult,
  ProductDetailView,
} from '@/types/apps/open-platform';

const PRODUCT_TAB_CLASS = 'h-8 gap-1.5';

function formatDate(value: number | null | undefined) {
  if (!value) return '长期有效';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatDateShort(value: number | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('zh-CN');
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
  AVAILABLE: '可划拨',
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
  FROZEN: '已冻结',
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
    <Dialog open={delivery != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
                请在 {formatDate(delivery.deliveryExpiresAt)} 前完成保存；不要把明文粘贴到工单、日志或聊天工具。
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
                凭证指纹：<code className="font-mono">{delivery.credential.fingerprint}</code>
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
  const [deviceId, setDeviceId] = useState('');
  const [hardwareUuid, setHardwareUuid] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (kind === 'DEVICE_SECRET' && !deviceId.trim() && !hardwareUuid.trim()) {
      toast.error('设备凭证至少需要绑定设备 ID 或 Hardware Identity。');
      return;
    }
    setBusy(true);
    try {
      const delivery = await openPlatformPost<CredentialSecretDeliveryView>('/api/v1/credentials', {
        productId,
        kind,
        deviceId: kind === 'DEVICE_SECRET' ? deviceId.trim() || undefined : undefined,
        hardwareUuid: kind === 'DEVICE_SECRET' ? hardwareUuid.trim() || undefined : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
      });
      toast.success(kind === 'PRODUCT_SECRET' ? 'Product Secret 已签发，请立即保存。' : 'Device Secret 已签发，请立即保存。');
      setDeviceId('');
      setHardwareUuid('');
      setExpiresAt('');
      onOpenChange(false);
      onDelivered(delivery);
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '凭证签发失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
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
                <Label htmlFor="credential-device-id">设备 ID（可选）</Label>
                <Input id="credential-device-id" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="例如：gateway-0003" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credential-hardware-uuid">Hardware Identity（可选）</Label>
                <Input id="credential-hardware-uuid" value={hardwareUuid} onChange={(event) => setHardwareUuid(event.target.value)} placeholder="例如：GW-HW-202608-0003" />
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
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [gracePeriod, setGracePeriod] = useState('86400');
  const [enforcementMode, setEnforcementMode] = useState<'NORMAL' | 'SECURITY_ENFORCED'>('NORMAL');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!credential) return;
    const switchDeadline = new Date(deadline).getTime();
    const gracePeriodSeconds = Number(gracePeriod);
    if (!Number.isFinite(switchDeadline) || switchDeadline <= Date.now()) {
      toast.error('切换截止时间必须晚于当前时间。');
      return;
    }
    if (!Number.isInteger(gracePeriodSeconds) || gracePeriodSeconds < 0) {
      toast.error('宽限期需要填写不小于 0 的整数秒数。');
      return;
    }
    setBusy(true);
    try {
      await openPlatformPost('/api/v1/rotation-tasks', {
        credentialId: credential.credentialId,
        switchDeadline,
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
      <DialogContent className="sm:max-w-lg">
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
              <div className="space-y-2"><Label htmlFor="rotation-deadline">切换截止时间</Label><Input id="rotation-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="rotation-grace-period">宽限期（秒）</Label><Input id="rotation-grace-period" type="number" min={0} value={gracePeriod} onChange={(event) => setGracePeriod(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>执行模式</Label><Select value={enforcementMode} onValueChange={(value) => setEnforcementMode(value as 'NORMAL' | 'SECURITY_ENFORCED')}><SelectTrigger className="w-full"><SelectValue placeholder="选择执行模式" /></SelectTrigger><SelectContent><SelectItem value="NORMAL">普通轮换（保留宽限期）</SelectItem><SelectItem value="SECURITY_ENFORCED">强制轮换（到期阻断旧凭证）</SelectItem></SelectContent></Select></div>
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
  preRegistrationMode,
  pendingPreRegistrationCount,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  preRegistrationMode: boolean;
  pendingPreRegistrationCount: number;
  onCreated: () => Promise<unknown>;
}) {
  const [quantity, setQuantity] = useState('100');
  const [grantReference, setGrantReference] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && preRegistrationMode) setQuantity(String(pendingPreRegistrationCount));
  }, [open, pendingPreRegistrationCount, preRegistrationMode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 10000) {
      toast.error('数量需要填写 1 到 10000 之间的整数。');
      return;
    }
    if (preRegistrationMode && parsedQuantity !== pendingPreRegistrationCount) {
      toast.error(`严格接入产品的批次数量必须等于当前待绑定预注册数量（${pendingPreRegistrationCount}）。`);
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
        grantReference: grantReference.trim(),
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建量产批次</DialogTitle>
          <DialogDescription>{preRegistrationMode ? '严格接入产品会按当前待绑定预注册资格创建设备凭证，批次数量和硬件 UUID 由预注册列表决定。' : '先生成固定数量的设备凭证，再按产线或渠道划拨。批次创建后不会直接把 Secret 显示在页面上。'}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="credential-batch-quantity">凭证数量</Label>
              {preRegistrationMode ? (
                <div id="credential-batch-quantity" className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium tabular-nums">
                  {formatNumber(pendingPreRegistrationCount)}
                </div>
              ) : (
                <Input id="credential-batch-quantity" type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              )}
              <p className="text-xs text-muted-foreground">{preRegistrationMode ? '数量固定为当前待绑定预注册资格数量。' : '单批最多 10000 个设备凭证。'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credential-batch-expires">失效时间（可选）</Label>
              <Input id="credential-batch-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              <p className="text-xs text-muted-foreground">不填写表示长期有效。</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="credential-batch-reference">批次引用</Label>
            <Input id="credential-batch-reference" value={grantReference} onChange={(event) => setGrantReference(event.target.value)} placeholder="例如：上海一期网关产线" />
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
  preRegistrationMode,
  pendingPreRegistrationCount,
  onOpenChange,
  onBatchUpdated,
}: {
  batch: CredentialManufacturingBatchView | null;
  preRegistrationMode: boolean;
  pendingPreRegistrationCount: number;
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

  const batchId = batch?.batchId ?? '';
  const batchKey = batch ? `/api/v1/credential-batches/${encodeURIComponent(batch.batchId)}` : null;
  const { data: batchDetail, error: batchError, isLoading: batchLoading, mutate: mutateBatch } = useSWR<CredentialManufacturingBatchView>(batchKey, openPlatformGetFetcher);

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
    setSelectedItemId(item.itemId);
    setItemDetail(null);
    setItemDetailLoading(true);
    try {
      const result = await openPlatformGetFetcher<CredentialManufacturingItemView>(`/api/v1/credential-batches/${encodeURIComponent(item.batchId)}/items/${encodeURIComponent(item.itemId)}`);
      setItemDetail(result);
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '制造项详情加载失败，请稍后重试。');
    } finally {
      setItemDetailLoading(false);
    }
  };

  const voidItem = async () => {
    if (!pendingVoid) return;
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
          {preRegistrationMode ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>制造项中的 Hardware UUID 会直接取自这 {formatNumber(pendingPreRegistrationCount)} 条待绑定预注册资格，不会重新生成或允许手动输入。</AlertDescription>
            </Alert>
          ) : null}
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
      <Dialog open={batch != null} onOpenChange={(next) => !voidBusy && onOpenChange(next)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-none max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto sm:!max-w-6xl">
          <DialogHeader className="min-w-0">
            <DialogTitle>制造批次详情</DialogTitle>
            <DialogDescription>查看批次生成的制造项及其当前状态。列表不会展示 Device Secret 明文。</DialogDescription>
          </DialogHeader>
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
                            <TableCell><div className="flex justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => void openItemDetail(item)}><Eye className="size-3.5" aria-hidden />查看</Button>{item.status === 'AVAILABLE' ? <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => { setPendingVoid(item); setVoidReason(''); }}><Ban className="size-3.5" aria-hidden />作废</Button> : null}</div></TableCell>
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
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={voidBusy}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingVoid != null} onOpenChange={(open) => { if (!open && !voidBusy) { setPendingVoid(null); setVoidReason(''); } }}>
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
  batch,
  onOpenChange,
  onCreated,
}: {
  batch: CredentialManufacturingBatchView | null;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<unknown>;
}) {
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!batch) return;
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > batch.availableCount) {
      toast.error(`划拨数量需要在 1 到 ${formatNumber(batch.availableCount)} 之间。`);
      return;
    }
    if (!reference.trim()) {
      toast.error('请填写本次划拨引用。');
      return;
    }
    setBusy(true);
    try {
      await openPlatformPost('/api/v1/credential-distributions', {
        batchId: batch.batchId,
        quantity: parsedQuantity,
        requestReference: reference.trim(),
      });
      toast.success('凭证集合已冻结，可以创建导出任务。');
      setQuantity('');
      setReference('');
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '凭证划拨失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={batch != null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>划拨固定凭证集合</DialogTitle>
          <DialogDescription>划拨后成员集合会被冻结，后续导出只针对这组固定设备，避免重复领取或误导出。</DialogDescription>
        </DialogHeader>
        {batch ? (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">批次</span>
                <code className="font-mono text-xs">{batch.batchId}</code>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">剩余可划拨</span>
                <span className="font-semibold tabular-nums">{formatNumber(batch.availableCount)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="distribution-quantity">本次划拨数量</Label>
              <Input id="distribution-quantity" type="number" min={1} max={batch.availableCount} value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={`最多 ${batch.availableCount}`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distribution-reference">业务引用</Label>
              <Input id="distribution-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="例如：上海一期 / 产线 A" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
              <Button type="submit" disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PackageCheck className="size-4" aria-hidden />}
                冻结划拨
              </Button>
            </DialogFooter>
          </form>
        ) : null}
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建凭证导出任务</DialogTitle>
          <DialogDescription>导出对象是已冻结的划拨集合，不会导出未划拨或其他批次的凭证。</DialogDescription>
        </DialogHeader>
        {distribution ? (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">固定集合</span><span className="font-semibold tabular-nums">{formatNumber(distribution.allocatedQuantity)} 台</span></div>
              <div className="mt-2 flex items-center justify-between gap-3"><span className="text-muted-foreground">划拨引用</span><span>{distribution.requestReference}</span></div>
            </div>
            <div className="space-y-2">
              <Label>导出格式</Label>
              <Select value={format} onValueChange={(value) => setFormat(value as 'EXCEL' | 'JSON')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="选择格式" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCEL">Excel（适合产线交付）</SelectItem>
                  <SelectItem value="JSON">JSON（适合自动化流程）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>生成文件后仍需再次点击下载，下载链接会限时失效。</AlertDescription>
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
  distribution,
  loading,
  canExport,
  onOpenChange,
  onExport,
}: {
  distribution: CredentialDistributionView | null;
  loading: boolean;
  canExport: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (distribution: CredentialDistributionView) => void;
}) {
  const open = distribution != null || loading;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>领取单详情</DialogTitle>
          <DialogDescription>领取单对应一组已经冻结的凭证成员，后续导出和审计都会以这组固定集合为准。</DialogDescription>
        </DialogHeader>
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
              <div><p className="text-xs text-muted-foreground">业务引用</p><p className="mt-1 break-all text-sm">{distribution.requestReference}</p></div>
              <div><p className="text-xs text-muted-foreground">冻结时间</p><p className="mt-1 text-sm">{distribution.frozenAt ? formatDate(distribution.frozenAt) : '尚未冻结'}</p></div>
              <div><p className="text-xs text-muted-foreground">失效时间</p><p className="mt-1 text-sm">{formatDate(distribution.expiresAt)}</p></div>
              <div><p className="text-xs text-muted-foreground">更新时间</p><p className="mt-1 text-sm">{formatDate(distribution.updateTime)}</p></div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">固定集合摘要</p>
              <code className="mt-2 block break-all font-mono text-xs text-muted-foreground">{distribution.allocationHash}</code>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          {distribution?.status === 'FROZEN' && canExport ? <Button type="button" onClick={() => { onExport(distribution); onOpenChange(false); }} className="gap-1.5"><CloudDownload className="size-4" aria-hidden />创建导出任务</Button> : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>关闭</Button>
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
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Array.from(new Set(hardwareUuids.split(/\s|,|，/).map((item) => item.trim()).filter(Boolean)));
    if (values.length === 0) {
      toast.error('请至少填写一个 Hardware Identity。');
      return;
    }
    if (!expiresAt) {
      toast.error('请设置预注册资格有效期。');
      return;
    }
    setBusy(true);
    try {
      const result = await openPlatformPost<{ inserted: number; duplicate: number }>('/api/v1/products/' + encodeURIComponent(productId) + '/pre-registrations', {
        hardwareUuids: values,
        note: note.trim() || undefined,
        expiresAt: new Date(expiresAt).getTime(),
      });
      toast.success(`已导入 ${result.inserted} 个资格${result.duplicate ? `，${result.duplicate} 个重复` : ''}。`);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>导入预注册资格</DialogTitle>
          <DialogDescription>适用于一型一密预注册：先导入出厂 Hardware Identity，设备首次绑定时再领取设备凭证。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-2">
            <Label htmlFor="pre-registration-hardware">Hardware Identity</Label>
            <textarea id="pre-registration-hardware" className="flex min-h-28 w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" value={hardwareUuids} onChange={(event) => setHardwareUuids(event.target.value)} placeholder={'一行一个，例如：\nGW-HW-202608-0101\nGW-HW-202608-0102'} />
            <p className="text-xs text-muted-foreground">支持换行、空格或逗号分隔，单次最多 500 个。</p>
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
            <Button type="submit" disabled={busy} className="gap-1.5">
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
      onDelivered(delivery);
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
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-44 w-full" /><Skeleton className="h-44 w-full" /></div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

const ProductCredentialsPage = () => {
  const { projectId = '', productId = '' } = useParams<{ projectId: string; productId: string }>();
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [manufacturingBatch, setManufacturingBatch] = useState<CredentialManufacturingBatchView | null>(null);
  const [allocateBatch, setAllocateBatch] = useState<CredentialManufacturingBatchView | null>(null);
  const [exportDistribution, setExportDistribution] = useState<CredentialDistributionView | null>(null);
  const [distributionDetail, setDistributionDetail] = useState<CredentialDistributionView | null>(null);
  const [distributionDetailLoading, setDistributionDetailLoading] = useState(false);
  const [preRegistrationDialogOpen, setPreRegistrationDialogOpen] = useState(false);
  const [resetCredential, setResetCredential] = useState<CredentialSummaryView | null>(null);
  const [issueCredentialKind, setIssueCredentialKind] = useState<'PRODUCT_SECRET' | 'DEVICE_SECRET' | null>(null);
  const [pendingCredentialAction, setPendingCredentialAction] = useState<{ credential: CredentialSummaryView; action: CredentialAction } | null>(null);
  const [rotationCredential, setRotationCredential] = useState<CredentialSummaryView | null>(null);
  const [delivery, setDelivery] = useState<CredentialSecretDeliveryView | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<CredentialPreRegistrationView | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const productKey = productId ? `/api/v1/products/${encodeURIComponent(productId)}` : null;
  const batchesKey = productId ? `/api/v1/credential-batches?productId=${encodeURIComponent(productId)}&pageSize=100` : null;
  const credentialsKey = productId ? `/api/v1/credentials?productId=${encodeURIComponent(productId)}&pageSize=100` : null;
  const exportsKey = productId ? `/api/v1/credential-exports?productId=${encodeURIComponent(productId)}&pageSize=100` : null;
  const rotationsKey = productId ? `/api/v1/rotation-tasks?productId=${encodeURIComponent(productId)}&pageSize=100` : null;

  const { data: product, error: productError, isLoading: productLoading } = useSWR<ProductDetailView>(productKey, openPlatformGetFetcher);
  const { data: batchesData, error: batchesError, mutate: mutateBatches } = useSWR<CursorResult<CredentialManufacturingBatchView>>(batchesKey, openPlatformGetFetcher);
  const { data: credentialsData, error: credentialsError, mutate: mutateCredentials } = useSWR<CursorResult<CredentialSummaryView>>(credentialsKey, openPlatformGetFetcher);
  const { data: exportsData, error: exportsError, mutate: mutateExports } = useSWR<CursorResult<CredentialExportTaskView>>(exportsKey, openPlatformGetFetcher);
  const getPreRegistrationPageKey = (pageIndex: number, previousPageData: CursorResult<CredentialPreRegistrationView> | null) => {
    if (!productId) return null;
    if (pageIndex > 0 && (!previousPageData || !previousPageData.hasMore)) return null;
    const params = new URLSearchParams({ pageSize: '100' });
    if (previousPageData?.nextCursor) params.set('cursor', previousPageData.nextCursor);
    return `/api/v1/products/${encodeURIComponent(productId)}/pre-registrations?${params.toString()}`;
  };
  const { data: preRegistrationPages, error: preRegistrationsError, size: preRegistrationPageCount, setSize: setPreRegistrationPageCount, mutate: mutatePreRegistrations } = useSWRInfinite<CursorResult<CredentialPreRegistrationView>>(getPreRegistrationPageKey, openPlatformGetFetcher);
  const { data: rotationsData, error: rotationsError, mutate: mutateRotations } = useSWR<CursorResult<CredentialRotationTaskView>>(rotationsKey, openPlatformGetFetcher);

  useEffect(() => {
    const lastPage = preRegistrationPages?.[preRegistrationPages.length - 1];
    if (preRegistrationPages && lastPage?.hasMore && preRegistrationPages.length === preRegistrationPageCount) {
      void setPreRegistrationPageCount(preRegistrationPageCount + 1);
    }
  }, [preRegistrationPageCount, preRegistrationPages, setPreRegistrationPageCount]);

  const batches = batchesData?.items ?? [];
  const credentials = credentialsData?.items ?? [];
  const exports = exportsData?.items ?? [];
  const preRegistrations = preRegistrationPages?.flatMap((page) => page.items) ?? [];
  const rotations = rotationsData?.items ?? [];
  const productSecret = credentials.find((credential) => credential.kind === 'PRODUCT_SECRET' && credential.credentialStatus === 'ACTIVE');
  const deviceCredentials = credentials.filter((credential) => credential.kind === 'DEVICE_SECRET');
  const distributionBatchIds = batches.map((batch) => batch.batchId).join(',');
  const distributionsKey = productId ? `/api/v1/credential-distributions?productId=${encodeURIComponent(productId)}&batches=${encodeURIComponent(distributionBatchIds)}` : null;
  const { data: distributionsData, error: distributionsError, mutate: mutateDistributions } = useSWR<CredentialDistributionView[]>(distributionsKey, async () => {
    if (batches.length === 0) return [];
    const distributionLists = await Promise.all(batches.map((batch) => openPlatformGetFetcher<CredentialDistributionView[]>(`/api/v1/credential-distributions/${encodeURIComponent(batch.batchId)}/distributions`)));
    return distributionLists.flat();
  });
  const distributions = distributionsData ?? [];
  const sortedDistributions = [...distributions].sort((left, right) => right.createTime - left.createTime);
  const availableCount = batches.reduce((sum, batch) => sum + batch.availableCount, 0);
  const allocatedCount = batches.reduce((sum, batch) => sum + batch.allocatedQuantity, 0);
  const activeExports = exports.filter((item) => ['PENDING', 'RUNNING'].includes(item.status)).length;
  const allocationTotal = allocatedCount + availableCount;
  const allocationPercent = allocationTotal ? Math.round((allocatedCount / allocationTotal) * 100) : 0;
  const canProvision = product != null && ['PUBLISHED', 'DISABLED'].includes(product.lifecycleStatus);
  const supportsProductSecret = product?.authModes.includes('PRODUCT_SECRET') ?? false;
  const supportsDeviceSecret = product?.authModes.includes('DEVICE_SECRET') ?? false;
  const preRegistrationMode = product?.bootstrapMode === 'STRICT';
  const pendingPreRegistrationCount = preRegistrations.filter(
    (item) => item.productId === productId
      && item.status === 'PENDING'
      && item.expiresAt > Date.now()
      && !deviceCredentials.some(
        (credential) => credential.hardwareUuid === item.hardwareUuid
          && ['ACTIVE', 'RETIRING'].includes(credential.credentialStatus),
      ),
  ).length;
  const manufacturingFlowEnabled = canProvision && supportsDeviceSecret;
  const canCreateBatch = manufacturingFlowEnabled && (!preRegistrationMode || pendingPreRegistrationCount > 0);
  const canImportPreRegistrations = canProvision && preRegistrationMode && supportsProductSecret;
  const productSecretOnly = supportsProductSecret && !supportsDeviceSecret;
  const hasErrors = productError || batchesError || credentialsError || exportsError || preRegistrationsError || rotationsError || distributionsError;

  const refreshAll = async () => {
    await Promise.all([mutateBatches(), mutateCredentials(), mutateExports(), mutatePreRegistrations(), mutateRotations(), mutateDistributions()]);
  };

  const removePreRegistration = async () => {
    if (!pendingRemoval) return;
    setBusyAction(true);
    try {
      await openPlatformDelete(`/api/v1/pre-registrations/${encodeURIComponent(pendingRemoval.preRegistrationId)}`, {});
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
    if (!supportsDeviceSecret) {
      toast.info('当前产品未启用设备密钥，不支持下载设备凭证导出文件。');
      return;
    }
    try {
      const result = await openPlatformPost<{ downloadUrl: string; expiresAt: number }>(`/api/v1/credential-exports/${encodeURIComponent(task.exportId)}/download-grants`, {});
      toast.success(`下载链接已签发，将于 ${formatDate(result.expiresAt)} 失效。`);
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '下载链接签发失败。');
    }
  };

  const openExportForBatch = async (batch: CredentialManufacturingBatchView) => {
    if (!manufacturingFlowEnabled) {
      toast.info('当前产品未启用设备密钥，不支持导出设备凭证。');
      return;
    }
    try {
      const batchDistributions = await openPlatformGetFetcher<CredentialDistributionView[]>(`/api/v1/credential-distributions/${encodeURIComponent(batch.batchId)}/distributions`);
      const frozen = batchDistributions.find((item) => item.status === 'FROZEN');
      if (!frozen) {
        toast.info('这个批次还没有冻结的划拨集合，请先完成划拨。');
        return;
      }
      setExportDistribution(frozen);
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '划拨集合加载失败。');
    }
  };

  const openDistributionDetail = async (distribution: CredentialDistributionView) => {
    setDistributionDetail(null);
    setDistributionDetailLoading(true);
    try {
      const detail = await openPlatformGetFetcher<CredentialDistributionView>(`/api/v1/credential-distributions/${encodeURIComponent(distribution.distributionId)}`);
      setDistributionDetail(detail);
    } catch (error) {
      toast.error(error instanceof OpenPlatformApiError ? error.message : '领取单详情加载失败。');
    } finally {
      setDistributionDetailLoading(false);
    }
  };

  const breadcrumbItems = [
    { to: '/projects', title: '项目' },
    { to: `/projects/${projectId}/products`, title: '产品' },
    { to: `/projects/${projectId}/products/${productId}`, title: product?.productName ?? '产品详情' },
    { title: '凭证与量产' },
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
              <Button type="button" size="sm" className="gap-1.5" onClick={() => setBatchDialogOpen(true)} disabled={!canCreateBatch}>
                <Plus className="size-3.5" aria-hidden /> 创建量产批次
              </Button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/20 p-1" aria-label="产品功能">
            <Button type="button" variant="ghost" size="sm" className={PRODUCT_TAB_CLASS} nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}`} />}><Boxes className="size-3.5" aria-hidden />产品概览</Button>
            <Button type="button" variant="ghost" size="sm" className={PRODUCT_TAB_CLASS} nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}/model`} />}><KeyRound className="size-3.5" aria-hidden />物模型</Button>
            <Button type="button" variant="secondary" size="sm" className={`${PRODUCT_TAB_CLASS} bg-background shadow-sm`} nativeButton={false} render={<Link to={`/projects/${projectId}/products/${productId}/credentials`} />}><FileKey2 className="size-3.5" aria-hidden />凭证与量产</Button>
          </nav>

          {!canProvision ? (
            <Alert className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
              <CircleAlert className="size-4" aria-hidden />
              <AlertDescription>当前产品尚未发布，凭证签发、量产批次、预注册和导出操作会在发布后开放；现在可以先查看已有安全状态。</AlertDescription>
            </Alert>
          ) : null}
          {canProvision && productSecretOnly && product.bootstrapMode === 'OPEN' ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>当前产品仅使用产品密钥并采用免预注册动态接入。设备首次上线时由平台动态生成设备凭证，因此不支持制造批次、划拨、预注册和导出操作。</AlertDescription>
            </Alert>
          ) : null}
          {canProvision && productSecretOnly && product.bootstrapMode === 'STRICT' ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>当前产品仅启用产品密钥，不能生成设备凭证；可以维护预注册资格，但不支持制造批次、划拨和导出设备凭证。</AlertDescription>
            </Alert>
          ) : null}
          {canProvision && !productSecretOnly && preRegistrationMode ? (
            <Alert className="rounded-xl border-primary/20 bg-primary/5">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <AlertDescription>当前产品使用严格预注册接入。创建制造批次时会自动使用全部待绑定预注册 Hardware UUID，批次数量固定为 {formatNumber(pendingPreRegistrationCount)}。</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <Card className="h-full overflow-hidden">
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-emerald-500" aria-hidden />凭证安全概览</CardTitle>
                <CardDescription>只展示非敏感摘要；明文凭证只会在签发或重置成功后短暂交付。</CardDescription>
              </CardHeader>
              <CardContent className="grid flex-1 gap-3 p-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-background p-3 transition-colors hover:bg-muted/30">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Product Secret</span>{productSecret ? statusBadge(credentialStatusLabel[productSecret.credentialStatus] ?? productSecret.credentialStatus, getCredentialTone(productSecret.credentialStatus)) : supportsProductSecret ? statusBadge('未签发', 'warning') : statusBadge('未启用', 'default')}</div>
                  {productSecret ? <><p className="mt-3 font-mono text-xs">{productSecret.fingerprint}</p><p className="mt-1 text-xs text-muted-foreground">版本 v{productSecret.versionNo} · 更新于 {formatDateShort(productSecret.updateTime)}</p>{supportsProductSecret ? <Button type="button" variant="outline" size="sm" className="mt-3 w-full gap-1.5" onClick={() => setResetCredential(productSecret)} disabled={!canProvision}><RefreshCw className="size-3.5" aria-hidden />重置并交付新密钥</Button> : <p className="mt-3 text-xs text-muted-foreground">当前产品未启用产品密钥认证，不能继续重置。</p>}</> : supportsProductSecret ? <><p className="mt-3 text-xs text-muted-foreground">产品发布后可以签发第一把产品密钥。</p><Button type="button" variant="outline" size="sm" className="mt-3 w-full gap-1.5" onClick={() => setIssueCredentialKind('PRODUCT_SECRET')} disabled={!canProvision}><KeyRound className="size-3.5" aria-hidden />签发 Product Secret</Button></> : <p className="mt-3 text-xs text-muted-foreground">当前产品使用设备密钥认证，不需要产品密钥。</p>}
                </div>
                <div className="rounded-xl border bg-background p-3 transition-colors hover:bg-muted/30">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Device Secret</span>{statusBadge(`${formatNumber(deviceCredentials.length)} 个摘要`, 'default')}</div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{formatNumber(deviceCredentials.filter((item) => item.credentialStatus === 'ACTIVE').length)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">当前有效版本 · 冻结和吊销不会删除审计记录</p>
                </div>
              </CardContent>
            </Card>
            <Card className="h-full overflow-hidden">
              <CardHeader className="border-b bg-muted/10"><CardTitle className="text-base">量产进度</CardTitle><CardDescription>从生成到交付，每一步都能追溯固定集合。</CardDescription></CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3 pb-4">
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg border border-border/60 bg-muted/70 px-2 py-1.5"><p className="text-base font-semibold leading-5 tabular-nums">{formatNumber(availableCount)}</p><p className="text-[10px] leading-4 text-muted-foreground">可划拨</p></div>
                  <div className="rounded-lg border border-border/60 bg-muted/70 px-2 py-1.5"><p className="text-base font-semibold leading-5 tabular-nums">{formatNumber(allocatedCount)}</p><p className="text-[10px] leading-4 text-muted-foreground">已划拨</p></div>
                  <div className="rounded-lg border border-border/60 bg-muted/70 px-2 py-1.5"><p className="text-base font-semibold leading-5 tabular-nums">{formatNumber(activeExports)}</p><p className="text-[10px] leading-4 text-muted-foreground">进行中</p></div>
                </div>
                <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">已划拨占比</span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-foreground/10">{allocationPercent}%</span>
                  </div>
                  <Progress aria-label="已划拨占比" value={allocationPercent} className="[&_[data-slot=progress-track]]:!h-2 [&_[data-slot=progress-track]]:!bg-muted/80" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="!gap-3 !py-3">
            <CardHeader className="!gap-0"><CardTitle className="text-base">推荐工作流</CardTitle><CardDescription>{productSecretOnly && product.bootstrapMode === 'OPEN' ? '当前模式由产品密钥完成首次接入，不需要提前生成或导出设备凭证。' : preRegistrationMode ? '按“预注册 → 批次 → 划拨 → 导出”推进，批次成员始终来自预注册 Hardware UUID。' : '按“批次 → 划拨 → 导出”推进，避免把 Secret 直接暴露给不该看到的人。'}</CardDescription></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              {[
                { icon: Plus, title: '1. 创建制造批次', description: preRegistrationMode ? `使用 ${formatNumber(pendingPreRegistrationCount)} 条预注册 Hardware UUID。` : '生成指定数量的 Device Secret 和硬件身份。', done: batches.length > 0 },
                { icon: PackageCheck, title: '2. 固定划拨集合', description: '按产线或渠道冻结一组不可变成员。', done: allocatedCount > 0 },
                { icon: CloudDownload, title: '3. 创建导出任务', description: '选择 Excel 或 JSON，按固定集合限时下载。', done: exports.length > 0 },
              ].map((step) => (
                <div key={step.title} className="group flex items-start gap-2 rounded-xl border p-2 transition-colors hover:bg-muted/30">
                  <div className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted/30 transition-colors', step.done && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600')}>
                    {step.done ? <Check className="size-3.5" aria-hidden /> : <step.icon className="size-3.5" aria-hidden />}
                  </div>
                  <div className="min-w-0"><p className="text-xs font-medium leading-4">{step.title}</p><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{step.description}</p></div>
                  <ChevronRight className="mt-0.5 ml-auto size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              ))}
            </CardContent>
          </Card>

          <Tabs defaultValue="batches" className="flex-col gap-4">
            <TabsList variant="line" className="w-full gap-3 justify-start overflow-x-auto rounded-none border-b px-0 md:w-1/2">
              <TabsTrigger value="batches" className="min-w-0 flex-1 basis-0 px-3">量产批次</TabsTrigger>
              <TabsTrigger value="distributions" className="min-w-0 flex-1 basis-0 px-3">领取单</TabsTrigger>
              <TabsTrigger value="credentials" className="min-w-0 flex-1 basis-0 px-3">设备凭证</TabsTrigger>
              <TabsTrigger value="exports" className="min-w-0 flex-1 basis-0 px-3">导出记录</TabsTrigger>
              <TabsTrigger value="pre-registrations" className="min-w-0 flex-1 basis-0 px-3">预注册</TabsTrigger>
              <TabsTrigger value="rotations" className="min-w-0 flex-1 basis-0 px-3">密钥轮换</TabsTrigger>
            </TabsList>

            <TabsContent value="batches" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-start gap-2"><div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground"><PackagePlus className="size-3.5" aria-hidden /></div><div className="min-w-0"><h2 className="text-sm font-semibold leading-5">制造批次</h2><p className="mt-1 text-xs leading-4 text-muted-foreground">{productSecretOnly ? '当前认证配置不生成可导出的设备凭证。' : preRegistrationMode ? '批次数量和 Hardware UUID 取自待绑定预注册资格。' : '批次是生成凭证的来源，导出前还需要先创建固定划拨。'}</p></div></div><Button type="button" size="sm" className="gap-1.5" onClick={() => setBatchDialogOpen(true)} disabled={!canCreateBatch}><Plus className="size-3.5" aria-hidden />创建批次</Button></div>
              {canProvision && preRegistrationMode && supportsDeviceSecret && pendingPreRegistrationCount === 0 ? <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">当前没有可用于制造批次的待绑定预注册资格。请先在“预注册”中导入 Hardware UUID。</div> : null}
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>批次</TableHead><TableHead>状态</TableHead><TableHead>数量</TableHead><TableHead>失效时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {batches.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">还没有量产批次，发布产品后可创建第一批凭证。</TableCell></TableRow> : batches.map((batch) => {
                      const displayStatus = getBatchDisplayStatus(batch);
                      const fullyAllocated = displayStatus === 'FULLY_ALLOCATED';
                      return <TableRow key={batch.batchId} className="transition-colors hover:bg-muted/20">
                        <TableCell><div className="font-medium">{batch.batchId}</div><div className="mt-1 text-xs text-muted-foreground">创建于 {formatDateShort(batch.createTime)}</div></TableCell>
                        <TableCell>{statusBadge(batchStatusLabel[displayStatus] ?? displayStatus, getBatchTone(displayStatus))}</TableCell>
                        <TableCell><div className="font-medium tabular-nums">{formatNumber(batch.targetQuantity)}</div><div className="mt-1 text-xs text-muted-foreground">{fullyAllocated ? `已全部划拨 ${formatNumber(batch.allocatedQuantity)}` : `可划拨 ${formatNumber(batch.availableCount)}`} · 已绑定 {formatNumber(batch.boundCount)}</div></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(batch.expiresAt)}</TableCell>
                        <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setManufacturingBatch(batch)}><Eye className="size-3.5" aria-hidden />制造项</Button><Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setAllocateBatch(batch)} disabled={!manufacturingFlowEnabled || batch.availableCount === 0}><PackageCheck className="size-3.5" aria-hidden />{fullyAllocated ? '已全部划拨' : '划拨凭证'}</Button><Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => void openExportForBatch(batch)} disabled={!manufacturingFlowEnabled || batch.allocatedQuantity === 0}><CloudDownload className="size-3.5" aria-hidden />导出</Button></div></TableCell>
                      </TableRow>;
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="distributions" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-sm font-semibold">领取单列表</h2><p className="text-xs text-muted-foreground">领取单由制造批次划拨产生；成员集合冻结后才能导出和交付。</p></div>
                <Button type="button" size="sm" className="gap-1.5" onClick={() => { const nextBatch = batches.find((batch) => batch.availableCount > 0); if (nextBatch) setAllocateBatch(nextBatch); else toast.info('暂无可划拨的制造批次。'); }} disabled={!manufacturingFlowEnabled || !batches.some((batch) => batch.availableCount > 0)}><Plus className="size-3.5" aria-hidden />创建领取单</Button>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>领取单</TableHead><TableHead>来源批次</TableHead><TableHead>数量</TableHead><TableHead>状态</TableHead><TableHead>冻结时间</TableHead><TableHead>失效时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sortedDistributions.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">还没有领取单，请先在制造批次中划拨一组固定凭证。</TableCell></TableRow> : sortedDistributions.map((distribution) => <TableRow key={distribution.distributionId} className="transition-colors hover:bg-muted/20">
                      <TableCell><button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => void openDistributionDetail(distribution)}>{distribution.distributionId}</button><div className="mt-1 text-xs text-muted-foreground">{distribution.requestReference}</div></TableCell>
                      <TableCell><code className="font-mono text-xs">{distribution.batchId}</code></TableCell>
                      <TableCell><span className="font-medium tabular-nums">{formatNumber(distribution.allocatedQuantity)}</span><span className="text-xs text-muted-foreground"> / {formatNumber(distribution.requestedQuantity)}</span></TableCell>
                      <TableCell>{statusBadge(distributionStatusLabel[distribution.status] ?? distribution.status, getDistributionTone(distribution.status))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{distribution.frozenAt ? formatDate(distribution.frozenAt) : '尚未冻结'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(distribution.expiresAt)}</TableCell>
                      <TableCell><div className="flex justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" onClick={() => void openDistributionDetail(distribution)}>查看</Button>{distribution.status === 'FROZEN' && manufacturingFlowEnabled ? <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setExportDistribution(distribution)}><CloudDownload className="size-3.5" aria-hidden />导出</Button> : null}</div></TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="credentials" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">设备凭证摘要</h2><p className="text-xs text-muted-foreground">列表不返回 Device Secret，只展示设备身份、指纹和安全状态。</p></div><Button type="button" size="sm" className="gap-1.5" onClick={() => setIssueCredentialKind('DEVICE_SECRET')} disabled={!manufacturingFlowEnabled}><Plus className="size-3.5" aria-hidden />手动签发</Button></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>设备身份</TableHead><TableHead>凭证版本</TableHead><TableHead>状态</TableHead><TableHead>指纹</TableHead><TableHead>更新时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>{deviceCredentials.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">还没有设备级凭证摘要。</TableCell></TableRow> : deviceCredentials.map((credential) => <TableRow key={credential.credentialId} className="transition-colors hover:bg-muted/20">
                    <TableCell><div className="font-medium">{credential.deviceId || '未绑定设备'}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{maskId(credential.hardwareUuid)}</div></TableCell>
                    <TableCell><span className="font-mono text-xs">v{credential.versionNo}</span><div className="mt-1 text-xs text-muted-foreground">{credential.credentialId}</div></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1.5">{statusBadge(credentialStatusLabel[credential.credentialStatus] ?? credential.credentialStatus, getCredentialTone(credential.credentialStatus))}{statusBadge(accessStateLabel[credential.accessState] ?? credential.accessState, credential.accessState === 'ENABLED' ? 'success' : 'warning')}</div></TableCell>
                    <TableCell><code className="font-mono text-xs text-muted-foreground">{credential.fingerprint}</code></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(credential.updateTime)}</TableCell>
                    <TableCell><div className="flex justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" onClick={() => setRotationCredential(credential)} disabled={!manufacturingFlowEnabled || credential.credentialStatus !== 'ACTIVE'}><RotateCcw className="size-3.5" aria-hidden />轮换</Button>{credential.credentialStatus !== 'REVOKED' ? <Button type="button" variant="ghost" size="sm" className={credential.accessState === 'ENABLED' ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'} onClick={() => setPendingCredentialAction({ credential, action: credential.accessState === 'ENABLED' ? 'FREEZE' : 'UNFREEZE' })}>{credential.accessState === 'ENABLED' ? '冻结' : '解冻'}</Button> : null}<Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setPendingCredentialAction({ credential, action: 'REVOKE' })} disabled={credential.credentialStatus === 'REVOKED'}>吊销</Button></div></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="exports" className="space-y-3">
              <div><h2 className="text-sm font-semibold">导出任务</h2><p className="text-xs text-muted-foreground">每次点击导出都会创建新任务；下载链接单独签发并限时失效。</p></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>任务</TableHead><TableHead>集合</TableHead><TableHead>格式</TableHead><TableHead>结果</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>{exports.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">还没有导出任务。完成划拨后可创建。</TableCell></TableRow> : exports.map((task) => <TableRow key={task.exportId} className="transition-colors hover:bg-muted/20">
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
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">一型一密预注册</h2><p className="text-xs text-muted-foreground">{preRegistrationMode ? '先登记硬件身份，设备首次绑定时再签发 Device Secret。' : '当前产品未启用预注册模式。'}</p></div><Button type="button" size="sm" className="gap-1.5" onClick={() => setPreRegistrationDialogOpen(true)} disabled={!canImportPreRegistrations}><Upload className="size-3.5" aria-hidden />导入资格</Button></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>Hardware Identity</TableHead><TableHead>状态</TableHead><TableHead>有效期</TableHead><TableHead>备注</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>{preRegistrations.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">当前产品没有预注册资格。</TableCell></TableRow> : preRegistrations.map((item) => <TableRow key={item.preRegistrationId} className="transition-colors hover:bg-muted/20">
                    <TableCell><code className="font-mono text-xs">{item.hardwareUuid}</code><div className="mt-1 text-xs text-muted-foreground">代次 {item.registrationGeneration}</div></TableCell>
                    <TableCell>{statusBadge(preRegistrationStatusLabel[item.status] ?? item.status, getPreRegistrationTone(item.status))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(item.expiresAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.note || '—'}</TableCell>
                    <TableCell className="text-right"><Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setPendingRemoval(item)} disabled={item.status !== 'PENDING'}>移除</Button></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="rotations" className="space-y-3">
              <div><h2 className="text-sm font-semibold">Device Secret 轮换</h2><p className="text-xs text-muted-foreground">轮换先签发候选版本，再等待设备领取和切换；旧版本会在宽限期后退役。</p></div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>设备</TableHead><TableHead>任务状态</TableHead><TableHead>当前 / 候选版本</TableHead><TableHead>切换截止</TableHead><TableHead>安全模式</TableHead></TableRow></TableHeader>
                  <TableBody>{rotations.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">还没有轮换任务。</TableCell></TableRow> : rotations.map((task) => <TableRow key={task.taskId} className="transition-colors hover:bg-muted/20">
                    <TableCell><div className="font-medium">{task.deviceId || '未绑定设备'}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{maskId(task.hardwareUuid)}</div></TableCell>
                    <TableCell>{statusBadge(rotationStatusLabel[task.status] ?? task.status, getRotationTone(task.status))}<div className="mt-1 text-xs text-muted-foreground">{task.reasonCode}</div></TableCell>
                    <TableCell className="font-mono text-xs">v{task.currentCredentialVersion} → {task.replacementCredentialVersion ? `v${task.replacementCredentialVersion}` : '待签发'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(task.switchDeadline)}</TableCell>
                    <TableCell><Badge variant="outline">{task.enforcementMode === 'SECURITY_ENFORCED' ? '强制轮换' : '普通轮换'}</Badge></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ProjectWorkspaceShell>

      <CreateBatchDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen} productId={productId} preRegistrationMode={preRegistrationMode} pendingPreRegistrationCount={pendingPreRegistrationCount} onCreated={async () => { await Promise.all([mutateBatches(), mutateCredentials()]); }} />
      <ManufacturingBatchDetailDialog batch={manufacturingBatch} preRegistrationMode={preRegistrationMode} pendingPreRegistrationCount={pendingPreRegistrationCount} onOpenChange={(open) => { if (!open) setManufacturingBatch(null); }} onBatchUpdated={mutateBatches} />
      <AllocateDialog batch={allocateBatch} onOpenChange={(open) => { if (!open) setAllocateBatch(null); }} onCreated={async () => { await mutateBatches(); await mutateDistributions(); }} />
      <ExportDialog distribution={exportDistribution} onOpenChange={(open) => { if (!open) setExportDistribution(null); }} onCreated={mutateExports} />
      <DistributionDetailDialog distribution={distributionDetail} loading={distributionDetailLoading} canExport={manufacturingFlowEnabled} onOpenChange={(open) => { if (!open) setDistributionDetail(null); }} onExport={setExportDistribution} />
      <PreRegistrationDialog open={preRegistrationDialogOpen} onOpenChange={setPreRegistrationDialogOpen} productId={productId} onCreated={mutatePreRegistrations} />
      <IssueCredentialDialog open={issueCredentialKind != null} kind={issueCredentialKind ?? 'PRODUCT_SECRET'} productId={productId} onOpenChange={(open) => { if (!open) setIssueCredentialKind(null); }} onDelivered={(next) => { setDelivery(next); void mutateCredentials(); }} />
      <CredentialActionDialog target={pendingCredentialAction} onOpenChange={(open) => { if (!open) setPendingCredentialAction(null); }} onCompleted={mutateCredentials} />
      <CreateRotationDialog credential={rotationCredential} onOpenChange={(open) => { if (!open) setRotationCredential(null); }} onCreated={mutateRotations} />
      <ResetProductSecretDialog credential={resetCredential} onOpenChange={(open) => { if (!open) setResetCredential(null); }} onDelivered={async (next) => { setDelivery(next); await mutateCredentials(); }} />
      <OneTimeSecretDialog delivery={delivery} onOpenChange={(open) => { if (!open) setDelivery(null); }} />

      <AlertDialog open={pendingRemoval != null} onOpenChange={(open) => { if (!open && !busyAction) setPendingRemoval(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>移除这条预注册资格？</AlertDialogTitle><AlertDialogDescription>只有尚未绑定的资格可以移除。移除后该 Hardware Identity 不会再自动领取设备凭证。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busyAction}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busyAction} onClick={(event) => { event.preventDefault(); void removePreRegistration(); }}>{busyAction ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}确认移除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StyleAwareWrapper>
  );
};

export default ProductCredentialsPage;
