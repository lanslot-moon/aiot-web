import { Code2, Crown, Eye, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<
  string,
  { label: string; className: string; Icon: typeof Crown }
> = {
  OWNER: {
    label: 'OWNER',
    className: 'bg-primary/10! text-primary! border-transparent',
    Icon: Crown,
  },
  ADMIN: {
    label: 'ADMIN',
    className: 'bg-chart-1/12! text-chart-1! border-transparent',
    Icon: Shield,
  },
  DEVELOPER: {
    label: 'DEVELOPER',
    className: 'bg-secondary text-secondary-foreground border-transparent',
    Icon: Code2,
  },
  VIEWER: {
    label: 'VIEWER',
    className: 'bg-muted text-muted-foreground border-transparent',
    Icon: Eye,
  },
};

export function RoleBadge({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  const config = ROLE_CONFIG[role] ?? {
    label: role,
    className: 'bg-secondary text-secondary-foreground border-transparent',
    Icon: Eye,
  };
  const { Icon } = config;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <Icon data-icon="inline-start" aria-hidden />
      {config.label}
    </Badge>
  );
}
