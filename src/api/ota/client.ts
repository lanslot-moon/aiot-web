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
  id: string;
  packageName: string;
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
  description?: string | null;
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
  description?: string;
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
  firstProgressAt?: number | null;
  attemptNo: number;
  lastErrorCode?: string;
  nextActionAt?: number;
  createTime?: number;
  lastDispatchAt?: number | null;
  dispatchReasonCode?: string | null;
}
export interface AttemptEvent {
  eventId: string;
  type: string;
  reasonCode: string | null;
  message: string | null;
  occurredAt: number;
  expiresAt: number;
}
export interface AttemptEventTimeline {
  events: AttemptEvent[];
  historyOutsideRetention: boolean;
  truncated: boolean;
}
export interface Attempt {
  id: string;
  attemptNo: number;
  state: string;
  failureCode?: string;
  startedAt?: number;
  finishedAt?: number;
  createTime: number;
}
export interface ReleaseTarget {
  deviceId: string;
  matchState: 'PENDING' | 'INELIGIBLE' | 'TASK_CREATED';
  matchReason: string | null;
  matchedRevisionNo: number | null;
  bucketNo: number;
  createTime: number;
  updateTime: number;
}

export interface Statistics {
  candidateCount: number;
  pendingCount: number;
  ineligibleCount: number;
  createdTaskCount: number;
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
  return request<T>('/api/v1/ota/' + path, method, body, { projectId });
}

// 查询独立于列表当前页，避免其他分页中的可用包被遗漏。
export async function findPublishablePackage(projectId: string, versionId: string) {
  if (!versionId) throw new Error('请选择要发布的固件版本。');
  let cursor = '';
  const visited = new Set<string>();
  while (true) {
    const params = new URLSearchParams({
      targetVersionId: versionId,
      state: 'VERIFIED',
      pageSize: '20',
      ...(cursor ? { cursor } : {}),
    });
    const page = await otaRequest<Page<Omit<Package, 'files'>>>(projectId, `packages?${params}`);
    // 验证成功以封存和完整的样机验证为前提，列表摘要足以判断是否可发布。
    const pkg = page.items.find(
      (item) => item.targetVersionId === versionId && item.state === 'VERIFIED',
    );
    if (pkg) return pkg;
    if (!page.hasMore) return null;
    if (!page.nextCursor || visited.has(page.nextCursor))
      throw new Error('无法确认升级包状态，请刷新后重试。');
    cursor = page.nextCursor;
    visited.add(cursor);
  }
}

export async function publishFirmwareVersion(projectId: string, versionId: string) {
  // 点击时重新查询，不能依赖页面缓存中的升级包状态。
  if (!(await findPublishablePackage(projectId, versionId)))
    throw new Error('该固件版本没有可发布的升级包，请先准备升级包并完成样机验证。');
  await otaRequest(projectId, `firmware/versions/${versionId}/publish`, 'POST');
}
export const states: Record<string, string> = {
  CREATED: '轮次已建立',
  ACTIVE: '已激活',
  DRAFT: '草稿',
  BUILDING: '构建中',
  READY_TO_SEAL: '待封存',
  PUBLISHED: '已发布',
  SEALED: '已封存',
  VERIFIED: '验证成功',
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
  NOTIFIED: '待设备响应',
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
