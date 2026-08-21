import { CircleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ApiErrorAlert({
  code,
  message,
  traceId,
  onRetry,
  className,
}: {
  code?: string;
  message?: string;
  traceId?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const what = message?.trim() || '请求接口时发生错误。';
  const mockWorkerNotIntercepted = code === 'MOCK_NOT_INTERCEPTED';
  const why = code ? `错误代码：${code}。` : '请求未能成功完成。';
  const next = mockWorkerNotIntercepted
    ? 'Mock Service Worker 未拦截到此 API 请求，页面正在刷新以更新 mock。'
    : onRetry
    ? '你可以重试请求，或检查网络后再试。'
    : '请刷新页面后重试。';

  return (
    <Alert variant="destructive" className={cn(className)}>
      <CircleAlert aria-hidden />
      <AlertTitle>请求失败</AlertTitle>
      <AlertDescription>
        <p>{what}</p>
        <p className="mt-1">{why}</p>
        <p className="mt-1">{next}</p>
        {traceId ? (
          <p className="mt-1 font-mono text-xs break-all">traceId: {traceId}</p>
        ) : null}
      </AlertDescription>
      {onRetry ? (
        <div data-slot="alert-action">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (mockWorkerNotIntercepted) {
                window.location.reload();
                return;
              }
              onRetry();
            }}
          >
            {mockWorkerNotIntercepted ? '刷新页面' : '重试'}
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}
