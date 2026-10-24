import { devicePath, type DeviceDetail } from '@/api/device/client';
import { connectivityBlockReason } from '@/api/device/connectivity';
import { useDeviceResource } from './use-device-resource';

export function useCommandAvailability(projectId: string, deviceId: string) {
  const resource = useDeviceResource<DeviceDetail>(projectId, devicePath(deviceId));
  const blocked = connectivityBlockReason(resource.error ? undefined : resource.data?.connectivity);
  async function verifyOnline() {
    // Refresh the shared detail cache at submission time; cached ONLINE alone is insufficient.
    const latest = await resource.mutate();
    if (!latest) throw new Error('设备在线状态未确认，暂时无法发送指令。');
    const reason = connectivityBlockReason(latest.connectivity);
    if (reason) throw new Error(reason);
    if (latest.lifecycle !== 'ACTIVE') throw new Error('设备尚未激活、已停用或正在解绑，无法发送指令。');
  }
  return { blocked, verifyOnline };
}
