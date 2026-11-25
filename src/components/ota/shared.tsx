import { useState, type ReactNode } from 'react';
import { CopyIdButton } from '@/components/open-platform/copy-id-button';
import { Link } from 'react-router';
import { CircleHelp, Tag } from 'lucide-react';
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
  required,
  children,
}: {
  title: string;
  help?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-h-6 items-center gap-1 text-xs font-medium">
        {title}
        {required && <span aria-hidden="true" className="text-destructive">*</span>}
        {help && <Help label={title}>{help}</Help>}
      </div>
      {children}
    </div>
  );
}
export function DeviceIdCell({ projectId, deviceId }: { projectId: string; deviceId: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <Link
        to={`/projects/${encodeURIComponent(projectId)}/devices?${new URLSearchParams({ device: deviceId })}`}
        className="truncate font-mono text-xs text-primary underline underline-offset-4"
        title={deviceId}
      >
        {deviceId}
      </Link>
      <CopyIdButton value={deviceId} label="设备 ID" className="shrink-0 text-foreground" />
    </span>
  );
}

export function ProductIdLink({ projectId, productId }: { projectId: string; productId: string }) {
  return (
    <Link
      to={`/projects/${projectId}/products/${encodeURIComponent(productId)}`}
      className="font-mono text-[11px] leading-tight text-muted-foreground underline underline-offset-2 hover:text-primary"
    >
      {productId}
    </Link>
  );
}

export function FirmwareVersionBadge({ version }: { version?: string }) {
  return (
    <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">
      <Tag aria-hidden="true" />{version || '—'}
    </Badge>
  );
}

export function Status({ value }: { value: string }) {
  const failed = value === 'FAILED' || value === 'TIMED_OUT';
  return (
    <Badge
      variant={failed ? 'destructive' : 'outline'}
      className={cn(
        'whitespace-nowrap font-normal',
        ['PASSED', 'SUCCEEDED', 'SEALED', 'VERIFIED', 'PUBLISHED', 'ACTIVE'].includes(value) &&
          'border-emerald-500/25! bg-emerald-500/10! text-emerald-700! dark:text-emerald-400!',
        failed && 'border-destructive/30!',
        value === 'STOPPED' &&
          'border-orange-500/35! bg-orange-500/10! text-orange-800! dark:text-orange-300!',
        ['RUNNING', 'NOTIFIED'].includes(value) &&
          'border-blue-500/25! bg-blue-500/10! text-blue-700! dark:text-blue-400!',
        ['WAIT_CONFIRM', 'WAIT_DISPATCH', 'RETRY_WAIT'].includes(value) &&
          'border-amber-500/25! bg-amber-500/10! text-amber-800! dark:text-amber-300!',
      )}
    >
      {states[value] ?? value}
    </Badge>
  );
}
export function RemoteChoice<T extends { id: string }>({
  projectId,
  path,
  excludeId,
  filterItem,
  required,
  value,
  onChange,
  label,
  text,
  disabled,
}: {
  projectId: string;
  path: string | null;
  excludeId?: string;
  filterItem?: (item: T) => boolean;
  required?: boolean;
  value: string;
  onChange: (value: string, item?: T) => void;
  label: string;
  text: (item: T) => string;
  disabled?: boolean;
}) {
  const page = usePage<T>(projectId, path);
  const [selected, setSelected] = useState<T>();
  const eligible = (item: T) => item.id !== excludeId && (!filterItem || filterItem(item));
  const options = page.rows.filter(eligible).map((item) => ({ value: item.id, label: text(item) }));
  const cached = page.rows.find((item) => item.id === value) ?? (selected?.id === value ? selected : undefined);
  if (value && value !== excludeId && !options.some((item) => item.value === value) && (!filterItem || (cached && eligible(cached))))
    options.unshift({ value, label: selected?.id === value ? text(selected) : value });
  return (
    <div className="space-y-2">
      <PolicySelect
        required={required && !page.error}
        label={label}
        value={options.some((item) => item.value === value) ? value : null}
        placeholder={page.isLoading ? '读取中…' : `选择${label}`}
        disabled={disabled || !path || page.isLoading}
        options={options}
        onValueChange={(id) => {
          const item =
            page.rows.find((row) => row.id === id) ?? (selected?.id === id ? selected : undefined);
          if (id && (!item || !eligible(item))) return;
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
