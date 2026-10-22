import type { CommandRecord } from '@/api/device/commands';

export type CommandNotice = { message: string; requestId?: string };

export function commandNoticeText(notice: CommandNotice | null, records: CommandRecord[]): string {
  if (!notice) return '';
  if (!notice.requestId) return notice.message;
  const record = records.find(item => item.requestId === notice.requestId);
  if (record && (record.deviceResult || record.executionStatus !== 'PENDING'
    || record.responseStatus !== 'WAITING' || record.deliveryStatus === 'NOT_SENT')) return '';
  return notice.message;
}
