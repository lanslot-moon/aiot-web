const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

/** Display API timestamps in milliseconds using the viewer's local time zone. */
export function formatDateTime(value?: number | null, emptyLabel = '—'): string {
  if (value == null || !Number.isFinite(value)) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return `${dateTimeFormatter.format(date)}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}
