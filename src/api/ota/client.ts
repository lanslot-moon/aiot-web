import { request } from '@/api/iam/client';
export { query } from '@/api/device/client';
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface FirmwareModule {
  id: string;
  productId: string;
  moduleCode: string;
  displayName: string;
  firmwareChannel: number;
  state: string;
}
export interface FirmwareVersion {
  id: string;
  moduleId: string;
  versionText: string;
  lifecycleState: string;
  hardwareConstraintJson?: string | null;
  descriptionText?: string;
  createTime: number;
}
export interface Package {
  verificationPassed?: boolean;
  id: string;
  targetVersionId: string;
  packageType: 'FULL' | 'DELTA';
  state: string;
  buildStatus?: string | null;
  manifestSha256?: string;
  sourceVersionText?: string;
  sourceImageSha256?: string;
  targetImageSha256?: string;
  algorithmId?: string;
  signatureRef?: string;
  files: { fileId: string; fileRole: string; sizeBytes: number; orderNo: number }[];
}
export interface Build {
  id: string;
  packageId: string;
  status: string;
  progress: number;
  attemptCount: number;
  msg?: string;
  fileId?: string;
  patchBytes?: number;
}
export interface BuildAttempt {
  id: string;
  taskId: string;
  leaseEpoch: number;
  attemptNo: number;
  status: string;
  startedAt: number | null;
  finishedAt: number | null;
  durationMillis: number | null;
  exitCode: number | null;
  timedOut: boolean | null;
  msg: string | null;
}
export interface Verification {
  id: string;
  packageId: string;
  state: string;
  packageManifestSha256?: string;
  createTime?: number;
}
export interface Release {
  id: string;
  productId: string;
  moduleId: string;
  targetVersionId: string;
  packageId: string;
  state: string;
  mode: string;
  moduleName?: string;
  targetVersionText?: string;
  activeRevisionNo: number;
  effectiveFrom?: number;
  effectiveUntil?: number;
  createTime?: number;
}
export interface ReleasePolicy {
  productId: string;
  moduleId: string;
  targetVersionId: string;
  packageId: string;
  mode: 'STATIC' | 'DYNAMIC';
  rolloutPercent: number;
  pushPerMinute: number;
  rateMode: 'CONSTANT' | 'PROGRESSIVE';
  rateStep?: number;
  rateThreshold?: number;
  maxPushPerMinute?: number;
  sourceVersions: string[];
  hardwareVersions: string[];
  deviceIds: string[];
  groupId?: string;
  tags: Record<string, string>;
  priority: number;
  requireAppConfirm: boolean;
  upgradeType: 1;
  execTime: number;
  effectiveFrom?: number;
  effectiveUntil?: number;
}
export type Configuration = Release & ReleasePolicy;
export interface Task {
  id: string;
  deviceId: string;
  state: string;
  phase?: string;
  progressPercent?: number;
  attemptNo: number;
  lastErrorCode?: string;
  nextActionAt?: number;
}
export interface Attempt {
  id: string;
  attemptNo: number;
  state: string;
  failureCode?: string;
  startedAt?: number;
  finishedAt?: number;
}
export interface Statistics {
  matchedDevices: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  waitingCount: number;
}
export function otaRequest<T>(
  projectId: string,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  return request<T>('/api/v1/ota/' + path, method, body, { projectId, successCode: 'SUCCESS' });
}
export const states: Record<string, string> = {
  ACTIVE: '已激活',
  DRAFT: '草稿',
  BUILDING: '构建中',
  READY_TO_SEAL: '待封存',
  PUBLISHED: '已发布',
  SEALED: '已封存',
  REVOKED: '已撤销',
  PAUSED: '已暂停',
  STOPPED: '已停止',
  LOST: '执行失联',
  COMPLETED: '已完成',
  CANCELED: '已取消',
  PENDING: '等待构建',
  RUNNING: '执行中',
  VERIFYING: '还原校验中',
  UPLOADING: '上传产物中',
  SUCCEEDED: '成功',
  FAILED: '失败',
  PASSED: '验证通过',
  RETRY_WAIT: '等待重试',
  WAIT_CONFIRM: '待业务确认',
  WAIT_DISPATCH: '等待下发',
  NOTIFIED: '已通知设备',
  TIMED_OUT: '已超时',
};
export const splitValues = (value: string) => [
  ...new Set(
    value
      .split(/[\s,，]+/)
      .map((v) => v.trim())
      .filter(Boolean),
  ),
];
