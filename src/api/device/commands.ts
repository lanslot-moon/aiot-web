import { request } from '@/api/iam/client';
export interface CommandRecord {
  requestId: string; deviceId: string; commandType: 'PROPERTY' | 'ACTION'; code: string | null;
  properties: string | null; inputParams: string | null; deliveryStatus: string; executionStatus: string;
  createTime: number; deliveryExpiresAt: number;
  deviceResult: { code: string; message: string; outputParams: string | null; receivedAt: number } | null;
}
export const commandPath = (id: string) => `/api/v1/commands/${encodeURIComponent(id)}`;
export function commandRequest<T>(projectId: string, path: string, method = 'GET', body?: unknown) {
  return request<T>(path, method, body, { projectId, successCode: '200' });
}
export const deliveryLabels: Record<string, string> = { DISPATCHING: '正在投递', BROKER_ACCEPTED: '消息代理已接收', NOT_SENT: '未发送', UNKNOWN: '投递结果未知' };
export const executionLabels: Record<string, string> = { PENDING: '等待设备结果', SUCCEEDED: '执行成功', FAILED: '执行失败', REJECTED: '设备拒绝', NOT_EXECUTED: '未执行' };
export function parseCommandInput(text: string, type: string): Record<string, unknown> {
  if (text.length > 65536 || new TextEncoder().encode(text).length > 65536) throw new Error('参数不能超过 64 KiB。');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('请输入有效的 JSON，例如 {"power": true}。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('参数必须是 JSON 对象。');
  if (type === 'PROPERTY' && (Object.keys(value).length < 1 || Object.keys(value).length > 100)) throw new Error('一次请填写 1 至 100 个属性。');
  return value as Record<string, unknown>;
}
