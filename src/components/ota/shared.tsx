import { useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DeviceInput } from '@/components/device/layout';
import { Failure, Loading, Pager, PolicySelect } from '@/components/policy/shared';
import { states } from '@/api/ota/client';
import { usePage } from './hooks';
import { cn } from '@/lib/utils';
export { Failure, Loading, PolicySelect as Choice, DeviceInput as Input };
export function Help({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6! text-muted-foreground"
            aria-label={label + '说明'}
          />
        }
      >
        <CircleHelp className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs leading-6">{children}</PopoverContent>
    </Popover>
  );
}
export function Field({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-h-6 items-center gap-1 text-xs font-medium">
        {title}
        {help && <Help label={title}>{help}</Help>}
      </div>
      {children}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap font-normal',
        ['PASSED', 'SUCCEEDED', 'SEALED', 'PUBLISHED', 'ACTIVE'].includes(value) &&
          'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
        ['FAILED', 'TIMED_OUT'].includes(value) && 'border-red-500/25 text-red-600',
      )}
    >
      {states[value] ?? value}
    </Badge>
  );
}
export function RemoteChoice<T extends { id: string }>({
  projectId,
  path,
  value,
  onChange,
  label,
  text,
  disabled,
}: {
  projectId: string;
  path: string | null;
  value: string;
  onChange: (value: string, item?: T) => void;
  label: string;
  text: (item: T) => string;
  disabled?: boolean;
}) {
  const page = usePage<T>(projectId, path);
  const [selected, setSelected] = useState<T>();
  const options = page.rows.map((item) => ({ value: item.id, label: text(item) }));
  if (value && !options.some((item) => item.value === value))
    options.unshift({ value, label: selected?.id === value ? text(selected) : value });
  return (
    <div className="space-y-2">
      <PolicySelect
        label={label}
        value={value || null}
        placeholder={page.isLoading ? '读取中…' : `选择${label}`}
        disabled={disabled || !path || page.isLoading}
        options={options}
        onValueChange={(id) => {
          const item =
            page.rows.find((row) => row.id === id) ?? (selected?.id === id ? selected : undefined);
          setSelected(item);
          onChange(id, item);
        }}
      />
      <Failure error={page.error} retry={() => page.mutate()} />
      {(page.data?.hasMore || page.hasPrevious) && <Pager {...page.pagerProps} />}
    </div>
  );
}
export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  busy,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'flex! w-[calc(100vw-2rem)]! max-h-[90dvh] flex-col gap-0! overflow-hidden p-0!',
          wide ? 'max-w-4xl!' : 'max-w-xl!',
        )}
        showCloseButton={!busy}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12 sm:px-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}配置</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">{children}</div>
        <DialogFooter className="m-0! shrink-0 border-t px-5 py-4 sm:px-8">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
