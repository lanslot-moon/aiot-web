// Protocol labels mirrored from Policy StandardMqttChannel; not policy records or authorization results.
export const mqttActionOptions = [
  { value: 'mqtt:Publish', label: '设备发布消息' },
  { value: 'mqtt:Subscribe', label: '设备订阅消息' },
  { value: 'mqtt:Connect', label: '设备连接' },
  { value: 'mqtt:RetainPublish', label: '设备发布保留消息' },
];

export const standardChannels = [
  {
    "id": "PROPERTY_REPORT",
    "label": "属性上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/property/report"
  },
  {
    "id": "PROPERTY_SET",
    "label": "属性下发",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/property/set"
  },
  {
    "id": "PROPERTY_SET_REPLY",
    "label": "属性下发回复",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/property/set/reply"
  },
  {
    "id": "EVENT_REPORT",
    "label": "事件上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/event/+/report"
  },
  {
    "id": "ACTION_INVOKE",
    "label": "动作下发",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/service/+/invoke"
  },
  {
    "id": "ACTION_REPLY",
    "label": "动作回复",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/service/+/reply"
  },
  {
    "id": "DIAGNOSTIC_REPORT",
    "label": "诊断上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/diagnostic/report"
  },
  {
    "id": "SHADOW_REPORT",
    "label": "影子状态上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/shadow/reported"
  },
  {
    "id": "FIRMWARE_VERSION_REPORT",
    "label": "固件版本上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ota/version/report"
  },
  {
    "id": "OTA_PROGRESS",
    "label": "升级进度上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ota/progress/report"
  },
  {
    "id": "OTA_UPGRADE",
    "label": "升级任务下发",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/ota/+/upgrade"
  },
  {
    "id": "JOB_STATUS",
    "label": "任务状态上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/job/+/status/report"
  },
  {
    "id": "CONFIGURATION_STATUS",
    "label": "配置状态上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/configuration/+/status/report"
  },
  {
    "id": "CONFIGURATION_APPLY",
    "label": "配置下发",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/configuration/+/apply"
  },
  {
    "id": "TOPOLOGY_DISCOVER",
    "label": "网关发现上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/gateway/topology/discover/report"
  },
  {
    "id": "TOPOLOGY_ATTACH",
    "label": "网关挂载上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/gateway/topology/attach/report"
  },
  {
    "id": "TOPOLOGY_DETACH",
    "label": "网关卸载上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/gateway/topology/detach/report"
  },
  {
    "id": "PROPERTY_REPORT_ACCEPTED",
    "label": "属性上报成功响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/property/report/accepted"
  },
  {
    "id": "EVENT_REPORT_ACCEPTED",
    "label": "事件上报成功响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/event/+/report/accepted"
  },
  {
    "id": "DIAGNOSTIC_REPORT_ACCEPTED",
    "label": "诊断上报成功响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/diagnostic/report/accepted"
  },
  {
    "id": "PROPERTY_REPORT_REJECTED",
    "label": "属性上报失败响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/property/report/rejected"
  },
  {
    "id": "EVENT_REPORT_REJECTED",
    "label": "事件上报失败响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/event/+/report/rejected"
  },
  {
    "id": "DIAGNOSTIC_REPORT_REJECTED",
    "label": "诊断上报失败响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/diagnostic/report/rejected"
  }
] as const;
