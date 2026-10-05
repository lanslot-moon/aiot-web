import { useState } from 'react';
import { CloudOff, Loader2 } from 'lucide-react';
import { OpenPlatformApiError } from '@/api/iam/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';

const unavailableCodes = ['503', '502', '504', 'NETWORK_ERROR', 'AUTHZ_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'ROUTE_NOT_ENABLED'];
export function ErrorNotice({ error, retry }: { error?: unknown; retry?: () => unknown | Promise<unknown> }) {
  const [retrying, setRetrying] = useState(false);
  if (!error) return null;
  const apiError = error instanceof OpenPlatformApiError ? error : null;
  const unavailable = !!apiError && ([502, 503, 504].includes(apiError.status) || unavailableCodes.includes(apiError.code));
  async function retryRequest() {
    if (!retry || retrying) return;
    setRetrying(true);
    try { await retry(); } catch { /* The resource retains its current error for the next attempt. */ }
    finally { setRetrying(false); }
  }
  const action = retry && <Button type="button" variant="outline" disabled={retrying} onClick={() => void retryRequest()}>
    {retrying && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}{retrying ? '正在重新加载…' : '重新加载'}
  </Button>;
  if (unavailable) return <Empty className="rounded-lg border" role="status" aria-live="polite">
    <EmptyHeader>
      <EmptyMedia variant="icon">{retrying ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <CloudOff />}</EmptyMedia>
      <EmptyTitle>{retrying ? '正在重新加载' : '服务暂时不可用'}</EmptyTitle>
      <EmptyDescription>{retrying ? '请稍候…' : '暂时无法获取数据，请稍后重试。'}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent>{action}
      {!retrying && <details className="w-full text-left text-xs text-muted-foreground">
        <summary className="cursor-pointer text-center">查看技术详情</summary>
        <p className="mt-2 break-all">{apiError?.code}{apiError?.status ? ` · HTTP ${apiError.status}` : ''}：{apiError?.message}</p>
      </details>}
    </EmptyContent>
  </Empty>;
  return <Alert variant="destructive" role="alert">
    <AlertTitle>{apiError?.status === 403 ? '没有访问权限' : '操作未完成'}</AlertTitle>
    <AlertDescription>
      <p>{error instanceof Error ? error.message : '操作失败，请重试。'}</p>
      {apiError?.errors.map((field, i) => <p key={i}>{field.message}</p>)}
      {action}
    </AlertDescription>
  </Alert>;
}
