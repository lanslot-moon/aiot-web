import { request } from '@/api/iam/client';

export type Lifecycle = 'PENDING_ACTIVATION' | 'ACTIVE' | 'DISABLED' | 'DELETING';
export interface CursorPage<T> { items: T[]; nextCursor: string | null; hasMore: boolean }
export interface DeviceSummary {
  deviceId: string; projectId: string; productId: string; deviceName: string;
  lifecycle: Lifecycle; virtualDevice: boolean;
  nodeType: 'DIRECT' | 'GATEWAY' | 'SUB_DEVICE';
  createTime: number; updateTime: number;
  activation: { method: string; activatedAt: number; observedAt: number } | null;
}
export interface DeviceDetail extends DeviceSummary {
  description: string | null; customIconUrl: string | null; hardwareUuid: string | null;
  authRoute: string;
}
export interface DeviceGroup {
  groupId: string; projectId: string; name: string; description: string | null;
  parentGroupId: string | null; depth: number; createTime: number; updateTime: number;
  counts?: { directDeviceCount: number };
}
export interface GroupMember { device: DeviceSummary }
export interface DeviceMembership { group: DeviceGroup; joinedAt: number }
export interface Tags { tags: Record<string, string>; updateTime: number }
export interface HardwareObservation {
  serialNumber: string | null; hardwareVersion: string | null; source: string; receivedAt: number;
  macAddresses: { interfaceName: string | null; address: string }[];
}
export interface HardwareProfile { verified: HardwareObservation | null; reported: HardwareObservation | null }
export interface MembershipResult {
  deviceId: string; action: 'ADD' | 'REMOVE'; status: 'CHANGED' | 'UNCHANGED' | 'FAILED' | 'UNKNOWN'; code: string | null;
}

export function query(values: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) params.set(key, String(value));
  });
  return params.size ? `?${params}` : '';
}
export const devicePath = (id: string) => `devices/${encodeURIComponent(id)}`;
export const groupPath = (id: string) => `device-groups/${encodeURIComponent(id)}`;
export const gatewayPath = (projectId: string, path: string) => `/api/v1/projects/${encodeURIComponent(projectId)}/${path}`;
// Reuse the authenticated gateway; only the gateway can establish trusted tenant identity.
export function deviceRequest<T>(projectId: string, path: string, method = 'GET', body?: unknown) {
  return request<T>(gatewayPath(projectId, path), method, body, { projectId });
}
export const lifecycleLabels: Record<Lifecycle, string> = {
  PENDING_ACTIVATION: '待激活', ACTIVE: '已激活', DISABLED: '已停用', DELETING: '解绑处理中',
};
export const nodeLabels = { DIRECT: '直连设备', GATEWAY: '网关', SUB_DEVICE: '子设备' };
export const formatTime = (time?: number | null) => time == null ? '—' : new Date(time).toLocaleString('zh-CN', { hour12: false });
