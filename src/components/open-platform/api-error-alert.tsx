import { OpenPlatformApiError } from '@/api/iam/client';
import { ErrorNotice } from '@/components/iam/error-notice';

/** Compatibility wrapper; all service failures share the same presentation. */
export function ApiErrorAlert({ code, message, traceId, onRetry, className }: {
  code?: string; message?: string; traceId?: string;
  onRetry?: () => unknown | Promise<unknown>; className?: string;
}) {
  const error = new OpenPlatformApiError(code ?? 'REQUEST_FAILED', message?.trim() || '请求未能完成。', /^\d{3}$/.test(code ?? '') ? Number(code) : 0);
  return <div className={className}>
    <ErrorNotice error={error} retry={onRetry} />
    {traceId && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">请求诊断信息</summary><p className="break-all font-mono">traceId: {traceId}</p></details>}
  </div>;
}
