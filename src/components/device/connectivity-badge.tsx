import type { DeviceConnectivity } from '@/api/device/client';
import { cn } from '@/lib/utils';

export function ConnectivityBadge({ value }: { value?: DeviceConnectivity | null }) {
  const online = value === 'ONLINE';
  const offline = value === 'OFFLINE';
  const label = online ? '设备在线' : offline ? '设备离线' : value === 'NOT_APPLICABLE' ? '不支持在线连接' : '在线状态未知';
  return <span role="status" aria-label={label} className={cn(
    'inline-flex shrink-0 items-center gap-2.5 text-sm font-medium leading-5',
    online ? 'text-emerald-700 dark:text-emerald-400'
      : offline ? 'text-rose-700 dark:text-rose-400'
        : 'text-amber-700 dark:text-amber-400',
  )}><span aria-hidden="true" className={cn(
    'mx-1 size-1.5 shrink-0 rounded-full ring-4',
    online ? 'bg-emerald-500 ring-emerald-500/15'
      : offline ? 'bg-rose-500 ring-rose-500/15'
        : 'bg-amber-500 ring-amber-500/15',
  )} />{label}</span>;
}
