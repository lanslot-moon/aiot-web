import { Badge } from '@/components/ui/badge';
import { PRODUCT_LIFECYCLE_LABEL, labelOf } from '@/lib/open-platform-labels';
import { cn } from '@/lib/utils';

const LIFECYCLE_CLASS: Record<string, string> = {
  DRAFT: 'border-transparent bg-chart-4/12 text-chart-4',
  PUBLISHED: 'border-transparent bg-chart-2/12 text-chart-2',
  DISABLED: 'border-transparent bg-muted text-muted-foreground',
  DEPRECATED: 'border-transparent bg-destructive/12 text-destructive',
};

export function ProductLifecycleBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        LIFECYCLE_CLASS[status] ?? 'border-transparent bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {labelOf(PRODUCT_LIFECYCLE_LABEL, status)}
    </Badge>
  );
}
