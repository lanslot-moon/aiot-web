// Protocol labels mirrored from Policy StandardMqttChannel; not policy records or authorization results.
export const mqttActionOptions = [
  { value: 'mqtt:Publish', label: '设备发布消息' },
  { value: 'mqtt:Subscribe', label: '设备订阅消息' },
  { value: 'mqtt:Connect', label: '设备连接' },
  { value: 'mqtt:RetainPublish', label: '设备发布保留消息' },
];

export const standardChannels = [
  {
    "id": "MODEL_GET",
    "label": "获取物模型",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/model/get"
  },
  {
    "id": "MODEL_GET_RESPONSE",
    "label": "物模型响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/model/get_response"
  },
  {
    "id": "PROPERTY_REPORT",
    "label": "属性上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/property/report"
  },
  {
    "id": "PROPERTY_REPORT_RESPONSE",
    "label": "属性上报响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/property/report_response"
  },
  {
    "id": "PROPERTY_SET",
    "label": "属性设置",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/property/set"
  },
  {
    "id": "PROPERTY_SET_RESPONSE",
    "label": "属性设置结果",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/property/set_response"
  },
  {
    "id": "PROPERTY_DESIRED_GET",
    "label": "获取期望属性",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/property/desired/get"
  },
  {
    "id": "PROPERTY_DESIRED_GET_RESPONSE",
    "label": "期望属性响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/property/desired/get_response"
  },
  {
    "id": "PROPERTY_DESIRED_DELETE",
    "label": "清除期望属性",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/property/desired/delete"
  },
  {
    "id": "PROPERTY_DESIRED_DELETE_RESPONSE",
    "label": "清除期望属性响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/property/desired/delete_response"
  },
  {
    "id": "EVENT_TRIGGER",
    "label": "事件触发",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/event/trigger"
  },
  {
    "id": "EVENT_TRIGGER_RESPONSE",
    "label": "事件响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/event/trigger_response"
  },
  {
    "id": "ACTION_EXECUTE",
    "label": "动作执行",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/action/execute"
  },
  {
    "id": "ACTION_EXECUTE_RESPONSE",
    "label": "动作执行结果",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/action/execute_response"
  },
  {
    "id": "DATA_BATCH_REPORT",
    "label": "批量数据上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/thing/data/batch_report"
  },
  {
    "id": "DATA_BATCH_REPORT_RESPONSE",
    "label": "批量上报响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/thing/data/batch_report_response"
  },
  {
    "id": "SUB_BIND",
    "label": "绑定子设备",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/sub/bind"
  },
  {
    "id": "SUB_BIND_RESPONSE",
    "label": "绑定子设备响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/sub/bind_response"
  },
  {
    "id": "SUB_LOGIN",
    "label": "子设备上线",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/sub/login"
  },
  {
    "id": "SUB_LOGOUT",
    "label": "子设备下线",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/sub/logout"
  },
  {
    "id": "TOPO_ADD",
    "label": "添加拓扑",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/topo/add"
  },
  {
    "id": "TOPO_ADD_RESPONSE",
    "label": "添加拓扑响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/topo/add_response"
  },
  {
    "id": "TOPO_DELETE",
    "label": "删除拓扑",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/topo/delete"
  },
  {
    "id": "TOPO_DELETE_RESPONSE",
    "label": "删除拓扑响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/topo/delete_response"
  },
  {
    "id": "TOPO_GET",
    "label": "查询拓扑",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/topo/get"
  },
  {
    "id": "TOPO_GET_RESPONSE",
    "label": "查询拓扑响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/topo/get_response"
  },
  {
    "id": "OTA_FIRMWARE_REPORT",
    "label": "固件版本上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ota/firmware/report"
  },
  {
    "id": "OTA_ISSUE",
    "label": "升级信息下发",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/ota/issue"
  },
  {
    "id": "OTA_GET",
    "label": "获取升级信息",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ota/get"
  },
  {
    "id": "OTA_GET_RESPONSE",
    "label": "升级信息响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/ota/get_response"
  },
  {
    "id": "OTA_PROGRESS_REPORT",
    "label": "升级进度上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ota/progress/report"
  },
  {
    "id": "TIME_REQUEST",
    "label": "请求时间服务",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ext/time/request"
  },
  {
    "id": "TIME_RESPONSE",
    "label": "时间服务响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/ext/time/response"
  },
  {
    "id": "FILE_UPLOAD_REQUEST",
    "label": "请求上传文件",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ext/file/upload/request"
  },
  {
    "id": "FILE_UPLOAD_RESPONSE",
    "label": "文件上传授权响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/ext/file/upload/response"
  },
  {
    "id": "FILE_DOWNLOAD_REQUEST",
    "label": "请求下载文件",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ext/file/download/request"
  },
  {
    "id": "FILE_DOWNLOAD_RESPONSE",
    "label": "文件下载授权响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/ext/file/download/response"
  },
  {
    "id": "CONFIG_GET",
    "label": "获取远程配置",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/ext/config/get"
  },
  {
    "id": "CONFIG_GET_RESPONSE",
    "label": "远程配置响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/ext/config/get_response"
  },
  {
    "id": "RAW_UP",
    "label": "透传数据上行",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/channel/raw/up"
  },
  {
    "id": "RAW_DOWN",
    "label": "透传数据下行",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/channel/raw/down"
  },
  {
    "id": "RPC_REQUEST",
    "label": "请求 RPC",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/channel/rpc/request"
  },
  {
    "id": "RPC_RESPONSE",
    "label": "RPC 响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/channel/rpc/response"
  },
  {
    "id": "TAG_REPORT",
    "label": "标签上报",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/tag/report"
  },
  {
    "id": "TAG_REPORT_RESPONSE",
    "label": "标签上报响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/tag/report_response"
  },
  {
    "id": "TAG_GET",
    "label": "获取标签",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/tag/get"
  },
  {
    "id": "TAG_GET_RESPONSE",
    "label": "标签查询响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/tag/get_response"
  },
  {
    "id": "TAG_DELETE",
    "label": "删除标签",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/tag/delete"
  },
  {
    "id": "TAG_DELETE_RESPONSE",
    "label": "删除标签响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/tag/delete_response"
  },
  {
    "id": "TOPO_CHANGE",
    "label": "拓扑变更通知",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/topo/change"
  },
  {
    "id": "SUB_DELETE",
    "label": "删除子设备",
    "action": "mqtt:Publish",
    "topic": "aiot/{productId}/{deviceId}/device/sub/delete"
  },
  {
    "id": "SUB_DELETE_RESPONSE",
    "label": "删除子设备响应",
    "action": "mqtt:Subscribe",
    "topic": "aiot/{productId}/{deviceId}/device/sub/delete_response"
  }
] as const;
