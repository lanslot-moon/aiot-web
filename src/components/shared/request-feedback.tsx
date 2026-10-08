import { Spinner } from '@/components/ui/spinner';
import { TableCell, TableRow } from '@/components/ui/table';
import { ApiErrorAlert } from '@/components/open-platform/api-error-alert';
import { OpenPlatformApiError } from '@/api/iam/client';

export function RequestLoading({ label = '正在加载…' }: { label?: string }) {
  return <div aria-busy="true" className="flex min-h-24 items-center justify-center py-3">
    <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" className="motion-reduce:animate-none" />{label}
    </p>
  </div>;
}

export function RequestTableState({ colSpan, error, loading, onRetry }: { colSpan: number; error?: unknown; loading?: boolean; onRetry?: () => void }) {
  return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center">
    {error && !loading ? <ApiErrorAlert code={error instanceof OpenPlatformApiError ? error.code : undefined} message={error instanceof Error ? error.message : '加载失败，请重试。'} onRetry={onRetry} /> : <RequestLoading />}
  </TableCell></TableRow>;
}
