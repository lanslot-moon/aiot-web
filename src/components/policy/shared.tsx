import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorNotice } from '@/components/iam/error-notice';
import { OpenPlatformApiError } from '@/api/iam/client';
import { statusLabels } from '@/api/policy/client';
import { useIam } from '@/context/iam-context/identity';
import { cn } from '@/lib/utils';
export function PolicySelect({ value, options, onValueChange, disabled, label, placeholder }: {
  value: string | null;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  placeholder?: string;
}) {
  return <Select value={value} disabled={disabled} onValueChange={next => { if (next !== null) onValueChange(next); }}>
    <SelectTrigger className="w-full min-w-0" aria-label={label}><SelectValue className="min-w-0"><span className="truncate">{options.find(option => option.value === value)?.label ?? value ?? placeholder}</span></SelectValue></SelectTrigger>
    <SelectContent className="rounded-md!" alignItemWithTrigger={false}>{options.map(option => <SelectItem key={option.value} value={option.value}><span className="truncate">{option.label}</span></SelectItem>)}</SelectContent>
  </Select>;
}
export function Status({ value }: { value: string }) {
  return <Badge variant="outline" className={cn('whitespace-nowrap font-normal', ['ACTIVE', 'CURRENT', 'VALID'].includes(value) && 'border-emerald-600/25 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400')}>{statusLabels[value] ?? value}</Badge>;
}
export function Loading() { return <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在读取…</div>; }
export function Failure({ error, retry }: { error: unknown; retry?: () => unknown }) { return error ? <ErrorNotice error={error} retry={retry} /> : null; }
export function CatalogFailure({ projectId, source, error, retry }: {
  projectId: string; source: 'platform' | 'atop'; error: unknown; retry: () => unknown;
}) {
  const { authorization } = useIam();
  const projectAuthorization = authorization.data?.projectId === projectId ? authorization.data : undefined;
  const catalog = source === 'platform' ? '平台权限目录' : '设备 ATOP 接口目录';
  let description: string | undefined;
  if (error instanceof OpenPlatformApiError) {
    if (error.code === 'ROUTE_NOT_ENABLED') {
      description = `网关尚未开放${catalog}，请联系管理员检查路由。`;
    } else if (error.code === 'FORBIDDEN' || error.status === 403) {
      if (!projectAuthorization) description = `无法读取${catalog}。请确认当前项目角色有「查看授权策略」权限；若能打开策略草稿，请联系管理员检查目录接口登记。`;
      else if (projectAuthorization.permissionCodes.includes('policy:read')) description = `当前项目已有「查看授权策略」权限，但${catalog}请求仍被拒绝。请联系管理员检查目录接口是否已登记并生效。`;
      else description = `当前项目角色缺少「查看授权策略」权限，无法读取${catalog}。`;
    }
  }
  return <ErrorNotice error={error} retry={retry} title={`无法读取${catalog}`} description={description} />;
}
export function Field({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) { return <label className="flex min-w-0 flex-col gap-2 self-start text-xs"><span className="min-h-5 font-medium leading-5">{title}</span>{children}{hint && <span className="text-xs font-normal leading-5 text-muted-foreground">{hint}</span>}</label>; }
export function Pager({ previous, next, busy }: { previous?: () => void; next?: () => void; busy?: boolean }) {
  return <div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={!previous || busy} onClick={previous}>上一页</Button><Button size="sm" variant="outline" disabled={!next || busy} onClick={next}>下一页</Button></div>;
}
