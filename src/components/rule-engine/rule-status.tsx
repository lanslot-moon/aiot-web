import { cn } from '@/lib/utils';

const statuses = {
  ENABLED: { label: '已启用', color: 'text-emerald-700 dark:text-emerald-300' },
  DISABLED: { label: '已停用', color: 'text-amber-700 dark:text-amber-300' },
  DRAFT: { label: '草稿', color: 'text-slate-600 dark:text-slate-300' },
};

export function RuleStatus({ status }: { status?: string }) {
  const { label, color } =
    status === 'ENABLED' || status === 'DISABLED' ? statuses[status] : statuses.DRAFT;
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-current/8 px-2.5 py-1 text-xs font-medium',
        color,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
