import { useEffect, useId, useRef, useState } from 'react';
import { CircleAlert, CloudOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { OpenPlatformApiError } from '@/api/iam/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';

const unavailableCodes = ['503', '502', '504', 'NETWORK_ERROR', 'AUTHZ_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'ROUTE_NOT_ENABLED'];
export function ErrorNotice({ error, retry, title, description, retryLabel = '重试', presentation = 'inline' }: {
  error?: unknown;
  retry?: () => unknown | Promise<unknown>;
  title?: string;
  description?: string;
  retryLabel?: string;
  presentation?: 'inline' | 'empty' | 'toast';
}) {
  const [retrying, setRetrying] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const toastId = useId();
  const lastError = useRef('');
  const apiError = error instanceof OpenPlatformApiError ? error : null;
  const unavailable = !!apiError && ([502, 503, 504].includes(apiError.status) || unavailableCodes.includes(apiError.code));
  const heading = title ?? (apiError?.status === 401 ? '登录已失效' : apiError?.status === 403 ? '没有访问权限' : unavailable ? '服务暂时不可用' : '操作未完成');
  const message = description ?? (unavailable ? '请稍后重试。' : error instanceof Error ? error.message : '操作失败，请重试。');
  const diagnostic = [apiError?.code, apiError?.status ? `HTTP ${apiError.status}` : '', error instanceof Error ? error.message : '未知错误'].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!error || presentation !== 'toast') {
      lastError.current = '';
      toast.dismiss(toastId);
      return;
    }
    const fingerprint = `${heading}:${diagnostic}`;
    if (lastError.current === fingerprint) return;
    lastError.current = fingerprint;
    toast.error(heading, {
      id: toastId,
      duration: 5000,
      closeButton: true,
      icon: <CircleAlert className="size-4 text-red-500" />,
      action: <button type="button" className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => setDetailsOpen(true)}>详情</button>,
    });
  }, [error, presentation, heading, diagnostic, toastId]);
  useEffect(() => () => { toast.dismiss(toastId); }, [toastId]);

  async function retryRequest() {
    if (!retry || retrying) return;
    setRetrying(true);
    try { await retry(); } catch { /* The resource keeps the failure available to the caller. */ }
    finally { setRetrying(false); }
  }
  if (!error) return null;
  const action = retry && <Button type="button" size="sm" variant="ghost" disabled={retrying} onClick={() => void retryRequest()}>
    {retrying && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}{retrying ? '重试中…' : retryLabel}
  </Button>;
  const detailsButton = <Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => { setCopyStatus(''); setDetailsOpen(true); }}>详情</Button>;
  const details = <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
    <DialogContent className="max-w-md!">
      <DialogHeader><DialogTitle>{heading}</DialogTitle><DialogDescription>{message}</DialogDescription></DialogHeader>
      <div className="space-y-2 rounded-md bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground">诊断信息</div>
        <pre className="m-0 whitespace-pre-wrap break-all font-mono text-xs leading-6">{diagnostic}</pre>
        {apiError?.errors.map((field, i) => <div key={i} className="text-xs">{field.field}：{field.message}</div>)}
      </div>
      {copyStatus && <span role="status" className="text-xs text-muted-foreground">{copyStatus}</span>}
      <DialogFooter><Button type="button" variant="ghost" size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(diagnostic); setCopyStatus('已复制'); }
        catch { setCopyStatus('复制失败，请手动选择诊断信息复制'); }
      }}>复制信息</Button>{action}</DialogFooter>
    </DialogContent>
  </Dialog>;
  if (presentation === 'toast') return details;
  if (presentation === 'empty') return <>
    <Empty className="rounded-lg border" role="status" aria-live="polite">
      <EmptyHeader><EmptyMedia variant="icon"><CloudOff /></EmptyMedia><EmptyTitle>{heading}</EmptyTitle><EmptyDescription>{message}</EmptyDescription></EmptyHeader>
      <EmptyContent><div className="flex items-center gap-1">{action}{detailsButton}</div></EmptyContent>
    </Empty>{details}
  </>;
  return <>
    <div role="alert" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1 text-sm">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-red-500" />
      <span className="min-w-0 flex-1 text-foreground/80">{description ?? (!unavailable && error instanceof Error ? error.message : heading)}</span>
      <div className="flex shrink-0 items-center gap-0.5">{action}{detailsButton}</div>
      {!!apiError?.errors.length && <div className="w-full space-y-1 pl-6 text-xs text-muted-foreground">{apiError.errors.map((field, i) => <div key={i}>{field.message}</div>)}</div>}
    </div>{details}
  </>;
}
