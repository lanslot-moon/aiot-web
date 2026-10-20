import { devicePath, deviceRequest, query, type DeviceDetail } from '@/api/device/client';
import { Action } from '@/components/iam/shared';

const operations = [
  {
    path: 'remove',
    label: '解绑设备',
    submitLabel: '确认解绑',
    permission: 'device:delete',
    description: '结束当前激活绑定，并将设备从列表中移除。',
  },
  {
    path: 'reset-factory',
    label: '解绑并清除数据',
    submitLabel: '确认解绑并清除数据',
    permission: 'device:delete',
    description: '结束当前激活绑定，并清理该设备在云端设备管理中的数据。',
  },
] as const;

export default function DeviceUnbindActions({ projectId, device, done }: {
  projectId: string;
  device: DeviceDetail;
  done: () => void;
}) {
  return operations.map(operation => (
    <Action
      key={`${device.deviceId}:${operation.path}`}
      label={operation.label}
      submitLabel={operation.submitLabel}
      danger
      permission={operation.permission}
      description={`即将对「${device.deviceName}」执行${operation.label}。${operation.description}`}
      fields={[
        {
          name: 'confirm',
          label: '输入设备名称确认',
          required: true,
          validate: value => value === device.deviceName ? undefined : '请输入完整设备名称',
        },
        { name: 'reason', label: '操作说明（选填）', type: 'textarea', maxLength: 512 },
      ]}
      run={values => deviceRequest<void>(
        projectId,
        `${devicePath(device.deviceId)}/${operation.path}${query({ reason: values.reason.trim() })}`,
        'POST',
      )}
      done={done}
    />
  ));
}
