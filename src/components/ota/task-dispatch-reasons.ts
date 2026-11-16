const reasons: Record<string, string> = {
  ATTEMPT_RECORD_UNAVAILABLE: '执行轮次记录暂不可用',
  CHECK_INCOMPLETE: '本次下发检查未完成',
  FACTS_UNAVAILABLE: '下发所需信息读取失败',
  FIRMWARE_FACTS_MISSING: '固件模块或目标版本信息缺失',
  DEVICE_SNAPSHOT_MISSING: '缺少设备固件通道信息',
  OTA_CAPABILITY_MISSING: '设备未声明支持 OTA',
  PRODUCT_MISMATCH: '设备与固件所属产品不一致',
  RELEASE_NOT_EXECUTABLE: '升级批次当前不可下发',
  OUTSIDE_RELEASE_WINDOW: '不在批次执行时间范围内',
  PACKAGE_UNAVAILABLE: '升级包不可用或不兼容',
  PACKAGE_FILE_INVALID: '固件文件或完整性信息校验未通过',
  QUOTA_CHECK_FAILED: '下发额度检查未完成',
  RATE_LIMITED: '等待下发额度',
  DOWNLOAD_AUTH_UNAVAILABLE: '固件下载授权获取受阻',
  DOWNLOAD_EXPIRES_BEFORE_EXECUTION: '下载授权早于预约执行时间过期',
  LEASE_EXPIRED: '本次下发处理窗口已结束',
  NOTICE_NOT_ACCEPTED: '升级通知投递未确认',
  NOTICE_BROKER_REJECTED: '消息服务拒绝投递',
  NOTICE_BACKPRESSURED: '消息服务繁忙，通知尚未发送',
  NOTICE_EXPIRED: '通知在发送前已过期',
  NOTICE_PAYLOAD_TOO_LARGE: '升级通知超出消息大小限制',
  NOTICE_TIMEOUT: '通知投递超时，未发送',
  NOTICE_UNKNOWN: '升级通知已尝试发送，结果未知',
  NOTIFIED: '升级通知已被投递链路受理',
};

export function dispatchResultLabel(reasonCode: string) {
  return reasons[reasonCode] ?? '下发检查结果：' + reasonCode;
}
