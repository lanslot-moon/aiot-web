import type { DeviceConnectivity } from './client';

export function connectivityBlockReason(value?: DeviceConnectivity | null): string {
  if (value === 'ONLINE') return '';
  if (value === 'OFFLINE') return '设备已离线，连接上线后才能发送指令。';
  if (value === 'NOT_APPLICABLE') return '此设备不支持在线连接，无法发送指令。';
  return '设备在线状态未确认，暂时无法发送指令。';
}
