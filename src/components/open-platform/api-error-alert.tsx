import { ErrorNotice } from '@/components/iam/error-notice';

export function ApiErrorAlert({ error, message, onRetry, className }: {
  error?: unknown; message?: string;
  onRetry?: () => unknown | Promise<unknown>; className?: string;
}) {
  return <div className={className}>
    <ErrorNotice error={error ?? new Error(message?.trim() || '请求未能完成。')} description={message} retry={onRetry} />
  </div>;
}
