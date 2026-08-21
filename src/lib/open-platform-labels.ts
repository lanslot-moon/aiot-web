/** Display labels for open-platform / thing-model list enums (zh-CN). */

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '启用',
  SUSPENDED: '已暂停',
  ARCHIVED: '已归档',
  CLOSED: '已关闭',
};

export const PROJECT_ROLE_LABEL: Record<string, string> = {
  OWNER: '所有者',
  ADMIN: '管理员',
  DEVELOPER: '开发者',
  VIEWER: '只读成员',
};

export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '正常',
  SUSPENDED: '已暂停',
  REMOVED: '已移除',
};

export const INVITATION_STATUS_LABEL: Record<string, string> = {
  PENDING: '待接受',
  ACCEPTED: '已接受',
  REJECTED: '已拒绝',
  EXPIRED: '已过期',
  REVOKED: '已撤销',
};

export const AUTHORIZATION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '启用',
  DISABLED: '已禁用',
  REVOKED: '已吊销',
};

export const PRODUCT_LIFECYCLE_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  DISABLED: '已停用',
  DEPRECATED: '已废弃',
};

export const PRODUCT_NODE_TYPE_LABEL: Record<string, string> = {
  DIRECT: '直连设备',
  GATEWAY: '网关设备',
  SUB_DEVICE: '子设备',
};

export const PRODUCT_TRANSPORT_LABEL: Record<string, string> = {
  MQTT: 'MQTT',
  HTTPS: 'HTTPS',
};

export const PRODUCT_AUTH_MODE_LABEL: Record<string, string> = {
  DEVICE_SECRET: '设备密钥',
  PRODUCT_SECRET: '产品密钥',
  CERTIFICATE: '设备证书',
  ACCESS_TOKEN: '访问令牌',
  BASIC: '用户名和密码',
  CUSTOM: '自定义认证',
};

export const PRODUCT_DATA_MODE_LABEL: Record<string, string> = {
  STANDARD_MODEL: '标准物模型',
  CUSTOM_PAYLOAD: '自定义报文',
  TRANSPARENT: '透传报文',
};

export const PRODUCT_BOOTSTRAP_MODE_LABEL: Record<string, string> = {
  OPEN: '开放接入',
  STRICT: '严格接入',
};

export const MODEL_DRAFT_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿待校验',
  VALIDATED: '已通过校验',
};

export const MODEL_REVISION_STATUS_LABEL: Record<string, string> = {
  PUBLISHED: '已发布',
  DEPRECATED: '已废弃',
};

export function labelOf(
  map: Record<string, string>,
  code: string | null | undefined,
  fallback = '—',
): string {
  if (!code) return fallback;
  return map[code] ?? code;
}
