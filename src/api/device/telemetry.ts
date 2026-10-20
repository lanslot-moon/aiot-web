import { request } from '@/api/iam/client';
import type { DeviceDetail, CursorPage } from './client';
export interface TelemetryPoint { timestamp: number | null; value: unknown }
export interface PropertyReport { timestamp: number; recordKey: string; properties: Record<string, unknown> }
export interface EventReport { recordId: string; messageId: string; eventCode: string; eventType: string; ts: number; receivedAt: number; output: unknown }
export const telemetryScope = (device: DeviceDetail) => ({ productId: device.productId, sourceSpace: device.virtualDevice ? 'simulation' : 'production' });
export async function latestProperties(projectId: string, device: DeviceDetail, codes: string[]) {
  const values: Record<string, TelemetryPoint> = {};
  // Respect the provider's 50-code boundary without silently hiding additional properties.
  for (let offset = 0; offset < codes.length; offset += 50) {
    const page = await request<{ values: Record<string, TelemetryPoint> }>('/api/v1/telemetry/properties/latest:query', 'POST', {
      ...telemetryScope(device), deviceId: device.deviceId, codes: codes.slice(offset, offset + 50),
    }, { projectId, successCode: '200' });
    Object.assign(values, page.values);
  }
  return values;
}
export function reportPage(projectId: string, device: DeviceDetail, kind: 'property' | 'event', codes: string[], from: number, to: number, cursor: string | null) {
  if (kind === 'property' && (codes.length === 0 || codes.length > 10)) throw new Error('上报记录每次须查询 1 至 10 个属性。');
  const base = `/api/v1/telemetry/devices/${encodeURIComponent(device.deviceId)}`;
  const scope = { ...telemetryScope(device), pageSize: 20, cursor };
  return kind === 'property'
    ? request<CursorPage<PropertyReport>>(`${base}/properties/history:query`, 'POST', { ...scope, codes, from, to }, { projectId, successCode: '200' })
    : request<CursorPage<EventReport>>(`${base}/events:query`, 'POST', { ...scope, startAt: from, endAt: to, order: 'DESC', eventCodes: codes, filters: [] }, { projectId, successCode: '200' });
}

export type ReportRow = { kind: 'property'; data: PropertyReport } | { kind: 'event'; data: EventReport };
interface ReportSourceCursor { cursor: string | null; hasMore: boolean; buffer: ReportRow[] }
export interface ReportStreamCursor { property: ReportSourceCursor; event: ReportSourceCursor }
export interface ReportStreamQuery { kind: 'all' | 'property' | 'event'; propertyCodes: string[]; eventCodes: string[]; from: number; to: number }
export interface ReportStreamPage { items: ReportRow[]; next: ReportStreamCursor; hasMore: boolean }
const REPORT_PAGE_SIZE = 20;
const MAX_REPORT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

export function reportTimestamp(row: ReportRow) { return row.kind === 'property' ? row.data.timestamp : row.data.ts; }
export function reportMessageId(row: ReportRow) { return row.kind === 'property' ? row.data.recordKey : row.data.messageId; }

/** Merge two independently paginated streams, retaining every unconsumed row in the next cursor. */
export async function reportStreamPage(projectId: string, device: DeviceDetail, query: ReportStreamQuery, cursor: ReportStreamCursor | null): Promise<ReportStreamPage> {
  if (!Number.isSafeInteger(query.from) || !Number.isSafeInteger(query.to) || query.from < 0 || query.to <= query.from || query.to - query.from > MAX_REPORT_RANGE_MS) {
    throw new Error('请选择有效的起止时间，查询跨度最多七天。');
  }
  const next: ReportStreamCursor = cursor ? {
    property: { ...cursor.property, buffer: [...cursor.property.buffer] },
    event: { ...cursor.event, buffer: [...cursor.event.buffer] },
  } : {
    property: { cursor: null, hasMore: query.kind !== 'event' && query.propertyCodes.length > 0, buffer: [] },
    event: { cursor: null, hasMore: query.kind !== 'property', buffer: [] },
  };
  async function fill(kind: 'property' | 'event') {
    const source = next[kind];
    while (!source.buffer.length && source.hasMore) {
      const result = await reportPage(projectId, device, kind, kind === 'property' ? query.propertyCodes : query.eventCodes, query.from, query.to, source.cursor);
      if (result.hasMore && (!result.nextCursor || result.nextCursor === source.cursor)) throw new Error('上报记录分页游标未前进，请重新查询。');
      source.cursor = result.nextCursor;
      source.hasMore = result.hasMore;
      source.buffer = result.items.map(row => 'recordKey' in row ? { kind: 'property', data: row } : { kind: 'event', data: row });
    }
  }
  const items: ReportRow[] = [];
  while (items.length < REPORT_PAGE_SIZE) {
    // Both heads must be known before choosing the next row. A failed source
    // rejects the whole page so a partial result cannot advance either cursor.
    await Promise.all([fill('property'), fill('event')]);
    const property = next.property.buffer[0];
    const event = next.event.buffer[0];
    if (!property && !event) break;
    const propertyFirst = property && (!event || reportTimestamp(property) > reportTimestamp(event)
      || (reportTimestamp(property) === reportTimestamp(event) && reportMessageId(property) >= reportMessageId(event)));
    const row = propertyFirst ? next.property.buffer.shift() : next.event.buffer.shift();
    if (row) items.push(row);
  }
  return { items, next, hasMore: Object.values(next).some(source => source.hasMore || source.buffer.length > 0) };
}
