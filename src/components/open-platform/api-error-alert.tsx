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
  const what = message?.trim() || 'Something went wrong while talking to the API.';
  const why = code ? `Error code: ${code}.` : 'The request did not complete successfully.';
  const next = onRetry
    ? 'You can retry the request, or check your network and try again later.'
    : 'Refresh the page or try again later.';

  return (
    <Alert variant="destructive" className={cn(className)}>
      <CircleAlert aria-hidden />
      <AlertTitle>Request failed</AlertTitle>
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
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}
