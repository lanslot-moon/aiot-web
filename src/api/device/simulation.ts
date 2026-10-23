import { request } from '@/api/iam/client';
import { query, type CursorPage } from './client';

export type SimulationValue = { type: 'number'; value: number } | { type: 'text'; value: string } | { type: 'boolean'; value: boolean } | { type: 'null' } | { type: 'array'; values: SimulationValue[] } | { type: 'object'; values: ValueMap };
export type ValueMap = Record<string, SimulationValue>;
export interface SimulationProfile { profileId: string; productId: string; name: string; description: string | null; latestVersion: number; revision: number }
export interface BehaviorRule { ruleId: string; trigger: { type: string; intervalMs?: number; serviceId?: string }; condition?: unknown; actions: Record<string, unknown>[] }
export interface ProfileBody { version: number; parameters: Record<string, { schema: { schema: unknown }; defaultValue: SimulationValue; overridable: boolean }>; initialProperties: ValueMap; rules: BehaviorRule[]; scripts: Record<string, { scriptId: string; source: string }> }
export interface ProfileSnapshot extends ProfileBody { profileId: { value: string } }
export interface ProfileVersion { profileId: string; version: number; snapshot: ProfileSnapshot; model: { modelRevision: number; modelDigest: string }; publishedAt: number }
export interface InstanceConfiguration { instanceId: { value: string }; deviceId: { value: string }; profileId: { value: string }; profileVersion: number; parameterOverrides: ValueMap; initialOverrides: ValueMap }
export interface SimulationInstance { instanceId: string; productId: string; deviceId: string; profileId: string; profileVersion: number; configuration: InstanceConfiguration; desiredState: 'RUNNING' | 'STOPPED'; activeSessionId: string | null; generation: number; revision: number; updatedAt: number }
export interface SimulationSession { sessionId: string; instanceId: string; profileId: string; profileVersion: number; generation: number; status: 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'FAILED'; startedAt: number; endedAt: number | null; failureCode: string | null }
export interface SimulationState { instance: SimulationInstance; session: SimulationSession | null }
export interface BehaviorPreview { propertyChanges: ValueMap; behaviorStateChanges: ValueMap; effects: Record<string, unknown>[] }
export interface PropertyReportReceipt {
  reportId: string;
  sessionId: string;
  status: 'ACCEPTED' | 'QUEUED' | 'FAILED';
  updatedAt: number;
  message: string;
}
export const sessionLabels: Record<SimulationSession['status'], string> = { STARTING: '启动中', RUNNING: '运行中', STOPPING: '停止中', STOPPED: '已停止', FAILED: '运行失败' };
export const simulationPath = (path: string) => `/api/v1/simulation/${path}`;
export function simulationRequest<T>(projectId: string, path: string, method = 'GET', body?: unknown) {
  return request<T>(simulationPath(path), method, body, { projectId });
}

// The current API has no device/product filter. Read bounded pages, never hydrate each row.
// Hitting the bound is an error, not proof that the device has no binding.
export async function simulationDirectory<T>(projectId: string, path: string): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const result: CursorPage<T> = await simulationRequest(projectId, path + query({ pageSize: 500, cursor }));
    items.push(...result.items);
    if (!result.hasMore) return items;
    if (!result.nextCursor || seen.has(result.nextCursor)) throw new Error('模拟目录分页游标异常，请刷新重试。');
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('模拟目录超过本页查询范围，暂时无法确认绑定。请联系管理员提供按设备筛选接口。');
}

export function encodeValue(value: unknown, depth = 0): SimulationValue {
  if (depth > 32) throw new Error('数据嵌套不能超过 32 层。');
  if (value === null) return { type: 'null' };
  if (typeof value === 'number' && Number.isFinite(value)) return { type: 'number', value };
  if (typeof value === 'string') return { type: 'text', value };
  if (typeof value === 'boolean') return { type: 'boolean', value };
  if (Array.isArray(value)) return { type: 'array', values: value.map(item => encodeValue(item, depth + 1)) };
  if (typeof value === 'object' && value) return { type: 'object', values: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item, depth + 1)])) };
  throw new Error('请输入有效的 JSON 值。');
}
export function decodeValue(value: SimulationValue): unknown {
  if (value.type === 'null') return null;
  if (value.type === 'array') return value.values.map(decodeValue);
  if (value.type === 'object') return decodeMap(value.values);
  return value.value;
}
export function decodeMap(values: ValueMap) { return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, decodeValue(value)])); }
export function parseValueMap(text: string): ValueMap {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('请输入有效的 JSON 对象，例如 {"temperature": 25}。'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('请输入 JSON 对象。');
  if (Object.keys(parsed).length > 256 || Object.keys(parsed).some(key => !key.trim())) throw new Error('字段名不能为空，最多 256 项。');
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, encodeValue(value)]));
}

export function previewInput(rule: BehaviorRule, argumentsText: string, elapsedMs: number) {
  const kind = { periodic: 'PERIODIC', manual: 'MANUAL', propertySet: 'PROPERTY_SET', serviceInvoke: 'SERVICE_INVOKE' }[rule.trigger.type];
  if (!kind) throw new Error('不支持此触发类型。');
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) throw new Error('预演时间必须为非负整数。');
  return { kind, target: kind === 'SERVICE_INVOKE' ? rule.trigger.serviceId : rule.ruleId, commandId: ['PROPERTY_SET', 'SERVICE_INVOKE'].includes(kind) ? 'preview-command' : null, arguments: parseValueMap(argumentsText), nowEpochMs: Date.now(), elapsedMs, randomSeed: 42 };
}
