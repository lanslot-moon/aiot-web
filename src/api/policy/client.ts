import { request } from '@/api/iam/client';

export type PolicyType = 'MQTT_DEVICE' | 'MANAGEMENT';
export type PrincipalType = 'DEVICE' | 'PRODUCT' | 'STATIC_GROUP' | 'ACCOUNT' | 'APPLICATION' | 'TENANT_ROLE';
export interface Page<T> { items: T[]; nextCursor: string | null; hasMore: boolean }
export interface Policy {
  policyId: string; name: string; description: string | null; policyType: PolicyType;
  scopeProductId: string | null; status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  ownershipType: string; revision: number; currentVersionNo: number | null;
  scheduledVersionNo: number | null; createTime: number; updateTime: number;
}
export interface Statement {
  sid: string; effect: 'ALLOW' | 'DENY'; actions: string[]; operationReferences: string[];
  resources: { resourceType: string; resourcePattern: string }[];
  conditions?: { operator: string; key: string; values: string[] }[];
  constraints?: { allowedQos?: number[]; retainAllowed?: boolean } | null;
}
export interface Document { languageVersion: string; statements: Statement[] }
export interface Draft { policyId: string; revision: number; document: Document; documentDigest: string; validationStatus: string; updateTime: number }
export interface Validation { valid: boolean; validatedRevision: number; issues: { path: string; code: string; message: string; severity: string }[] }
export interface Version { policyId: string; versionNo: number; status: string; effectiveAt: number; changeReason: string; document?: Document; createTime: number }
export interface Binding { bindingId: string; policyId: string; principalType: PrincipalType; principalId: string; status: string; effectiveAt: number; expiresAt: number | null; revision: number }
export interface Usage { canArchive: boolean; blockingReasons: string[]; activeBindingCount: number; scheduledBindingCount: number }
export interface Action { action: string; policyType: PolicyType; description: string; resourceTypes: string[]; allowedConditionKeys: string[]; supportsOperationReference: boolean; status: string }
export interface Snapshot { allowedConnect: boolean; decisionCode: string; rules: { permission: string; action: string; topic: string; qos: number[]; retain: boolean }[]; bindingSources: string[]; warnings: string[]; evaluatedAt: number; expiresAt: number; matchedPolicyVersions: { policyId: string; versionNo: number }[] }
export interface Simulation { results: { allowed: boolean; decisionCode: string; matchedAllows: string[]; matchedDenies: string[]; missingRequirements: string[] }[]; simulatedAt: number }
export interface Effective { policyId: string; policyName: string; policyVersionNo: number; bindingSourceType: string; bindingSourceId: string; expiresAt: number | null }

export function query(values: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== '' && value !== null && value !== undefined) params.set(key, String(value)); });
  return params.size ? '?' + params.toString() : '';
}
// All policy calls go through the existing authenticated gateway. The gateway resolves tenantId.
export function policyRequest<T>(projectId: string, path: string, method = 'GET', body?: unknown) {
  return request<T>('/api/v1/' + path, method, body, { projectId });
}
export const policyPath = (id: string) => 'policies/' + encodeURIComponent(id);
export const principalLabels: Record<PrincipalType, string> = { DEVICE: '设备', PRODUCT: '整个产品', STATIC_GROUP: '静态设备组', ACCOUNT: '账号', APPLICATION: '应用', TENANT_ROLE: '项目角色' };
export const statusLabels: Record<string, string> = { DRAFT: '草稿', ACTIVE: '已生效', ARCHIVED: '已归档', CURRENT: '当前版本', SCHEDULED: '待生效', RETIRED: '历史版本', CANCELLED: '已取消', REVOKED: '已撤销', EXPIRED: '已过期', VALID: '校验通过', INVALID: '校验未通过', NOT_VALIDATED: '待校验' };

export const emptyDocument = (): Document => ({ languageVersion: '2026-09-01', statements: [] });
