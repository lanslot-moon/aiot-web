import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { GatewayDataTable } from '@/components/tables/data-table/DataTable';
import type { LucideIcon } from 'lucide-react';

export function DetailField({ label, children, fullWidth = false }: {
  label: string; children: ReactNode; fullWidth?: boolean;
}) {
  return <div className={cn('min-w-0 space-y-1', fullWidth && 'sm:col-span-2')}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">{children || '—'}</dd>
  </div>;
}

export function DeviceTable<T>({ rows, columns, stickyActions = false }: {
  rows: T[]; columns: { label: string; render: (row: T) => ReactNode }[]; stickyActions?: boolean;
}) {
  return <div className={cn(
    'min-w-0',
    stickyActions && '[&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:bg-background [&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:bg-background [&_td:last-child]:border-l [&_th:last-child]:border-l',
  )}>
    <GatewayDataTable rows={rows} columns={columns} />
  </div>;
}

// Device forms share the same 36px control rhythm as their action buttons.
export function DeviceInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn('h-9!', className)} />;
}

export function DeviceSection({ title, description, actions, children }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode;
}) {
  return <section className="min-w-0 space-y-3">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-medium leading-5">{title}</h3>
        {description && <p className="text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
    {children}
  </section>;
}

export function DeviceTabsNav({ label, items, actions, variant = 'line' }: {
  label: string; items: { value: string; label: string; icon?: LucideIcon; disabled?: boolean; disabledReason?: string }[]; actions?: ReactNode; variant?: 'line' | 'default';
}) {
  return <div className={cn('flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2', variant === 'line' ? 'border-b pb-1' : 'rounded-lg border bg-muted/20 p-1')}>
    <div className={cn('min-w-0 max-w-full overflow-x-auto', variant === 'line' && 'pb-1')}>
      <TabsList variant={variant} aria-label={label} className={cn('h-auto! w-max justify-start bg-transparent', variant === 'default' && 'gap-1 p-0!')}>
        {items.map(item => <TabsTrigger key={item.value} value={item.value} disabled={item.disabled} title={item.disabledReason} className={cn(variant === 'default' && 'h-7! flex-none gap-1.5 rounded-md px-2.5 text-xs! font-medium data-active:bg-background data-active:shadow-sm')}>
          {item.icon && <item.icon className="size-3.5" aria-hidden />}{item.label}
        </TabsTrigger>)}
      </TabsList>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">{actions}</div>}
  </div>;
}
