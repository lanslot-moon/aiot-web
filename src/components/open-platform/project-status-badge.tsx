import { Archive, Ban, CircleCheck, PauseCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; Icon: typeof CircleCheck }
> = {
  ACTIVE: {
    label: 'ACTIVE',
    className: 'bg-chart-2/12! text-chart-2! border-transparent',
    Icon: CircleCheck,
  },
  SUSPENDED: {
    label: 'SUSPENDED',
    className: 'bg-chart-4/12! text-chart-4! border-transparent',
    Icon: PauseCircle,
  },
  ARCHIVED: {
    label: 'ARCHIVED',
    className: 'bg-muted text-muted-foreground border-transparent',
    Icon: Archive,
  },
  CLOSED: {
    label: 'CLOSED',
    className: 'bg-destructive/12! text-destructive! border-transparent',
    Icon: Ban,
  },
};

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-secondary text-secondary-foreground border-transparent',
    Icon: CircleCheck,
  };
  const { Icon } = config;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <Icon data-icon="inline-start" aria-hidden />
      {config.label}
    </Badge>
  );
}
