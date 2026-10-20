import { request } from '@/api/iam/client';
import type { DeviceDetail } from './client';
export interface TelemetryPoint { timestamp: number | null; value: unknown }
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
