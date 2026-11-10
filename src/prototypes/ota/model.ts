export type FirmwareModule = { id: string; name: string; code: string; channel: number };
export type FirmwareVersion = { id: string; moduleId: string; name: string; description: string; published: boolean };
export type PackageStage = '文件待核验' | '等待构建' | '生成差分' | '还原校验' | '上传产物' | '可封存' | '已封存' | '验证中' | '验证失败' | '验证通过';
export type FirmwarePackage = { id: string; versionId: string; kind: '全量包' | '差分包'; source: string; stage: PackageStage; failed: boolean; devices: string[]; results: Record<string, boolean>; files: string[] };
export type Task = { id: string; device: string; state: string; phase: string; progress: string; history: string[]; reason?: string };
export type Policy = { mode: string; scope: string; sources: string; hardware: string; tagKey: string; tagValue: string; deviceIds: string[]; percent: number; rate: number; progressive: boolean; threshold: number; increment: number; ceiling: number; priority: number; confirm: boolean; start: string; end: string; execute: string };
export type Batch = { id: string; packageId: string; versionName: string; moduleName: string; state: '草稿' | '已激活' | '已暂停'; policy: Policy; tasks: Task[]; activationFailed: boolean; revision: number };
export const defaultPolicy = (): Policy => ({ mode: '仅本次设备', scope: '测试线 A', sources: '', hardware: '', tagKey: '', tagValue: '', deviceIds: [], percent: 5, rate: 20, progressive: false, threshold: 100, increment: 10, ceiling: 100, priority: 50, confirm: false, start: '', end: '', execute: '' });
export const devices = [
  { id: 'gw-test-01', source: '2.3.8', hardware: 'HW-2', online: true },
  { id: 'gw-test-02', source: '2.3.8', hardware: 'HW-2', online: true },
  { id: 'gw-test-03', source: '2.3.5', hardware: 'HW-1', online: false },
];
export const initialModules: FirmwareModule[] = [{ id: 'main', name: '网关主控', code: 'main', channel: 0 }];
export const initialVersions: FirmwareVersion[] = [{ id: 'v241', moduleId: 'main', name: '2.4.1', description: '修复网络切换后重连异常', published: true }];
export const initialPackages: FirmwarePackage[] = [{ id: '83021', versionId: 'v241', kind: '差分包', source: '2.3.8', stage: '验证通过', failed: false, devices: ['gw-test-01', 'gw-test-02'], results: { 'gw-test-01': true, 'gw-test-02': true }, files: ['gateway-2.3.8.bin', 'gateway-2.4.1.bin'] }];
export const initialBatches: Batch[] = [{ id: '86042', packageId: '83021', versionName: '2.4.1', moduleName: '网关主控', state: '已激活', policy: defaultPolicy(), activationFailed: false, revision: 1, tasks: [
  { id: '90001', device: 'gw-a-01', state: '成功', phase: '已确认目标版本', progress: '100%', history: ['第 1 轮 · 已上报目标版本 2.4.1'] },
  { id: '90002', device: 'gw-a-02', state: '执行中', phase: '等待重启后版本确认', progress: '100%', history: ['第 1 轮 · 已安装，等待版本上报'] },
  { id: '90003', device: 'gw-a-03', state: '待业务确认', phase: '等待管理员确认', progress: '—', history: ['第 1 轮 · 等待业务确认'] },
  { id: '90004', device: 'gw-a-04', state: '等待下发', phase: '等待下发条件', progress: '—', history: ['第 1 轮 · 尚未通知设备'] },
  { id: '90005', device: 'gw-a-05', state: '执行超时', phase: '安装结果未按时上报', progress: '—', reason: 'OTA_EXECUTION_TIMEOUT', history: ['第 1 轮 · 执行超时 · OTA_EXECUTION_TIMEOUT'] },
] }];
export function scopeSummary(policy: Policy, pkg: FirmwarePackage) {
  return [policy.scope === '全部符合条件的设备' ? '当前产品设备' : policy.scope === '指定设备' ? `指定 ${policy.deviceIds.length} 台设备` : '测试线 A 的直接成员',
    (pkg.kind === '差分包' ? pkg.source : policy.sources) && `源版本 ${pkg.kind === '差分包' ? pkg.source : policy.sources}`,
    policy.hardware && `硬件 ${policy.hardware}`, policy.tagKey && `${policy.tagKey}=${policy.tagValue}`].filter(Boolean).join('，同时满足 ');
}
export function rateSummary(policy: Policy) {
  return policy.progressive ? `初始 ${policy.rate} 台/分钟，每累计成功 ${policy.threshold} 台增加 ${policy.increment} 台/分钟，上限 ${policy.ceiling} 台/分钟。` : `每分钟推送 ${policy.rate} 台。`;
}
export function validatePolicy(policy: Policy, step: number): string {
  if (step === 1) {
    if (policy.scope === '指定设备' && !policy.deviceIds.length) return '请至少选择一台设备。';
    if (!Number.isInteger(policy.percent) || policy.percent < 0 || policy.percent > 100) return '灰度比例须为 0–100 的整数。';
    if (!!policy.tagKey.trim() !== !!policy.tagValue.trim()) return '标签名称与值需要同时填写。';
  }
  if (step === 2) {
    if (![policy.rate, policy.priority, ...(policy.progressive ? [policy.threshold, policy.increment, policy.ceiling] : [])].every(Number.isInteger)) return '速率、阈值和优先级请输入整数。';
    if (policy.rate < 1 || policy.priority < 0 || policy.priority > 100) return '推送速率须大于 0，优先级须在 0–100 之间。';
    if (policy.progressive && (policy.threshold < 1 || policy.increment < 1 || policy.ceiling < policy.rate)) return '成功阈值与增量须大于 0，速率上限不能低于初始速率。';
    const start = policy.start ? new Date(policy.start).getTime() : Date.now();
    if (policy.start && (!Number.isFinite(start) || start - Date.now() < 300000 || start - Date.now() > 7 * 86400000)) return '预约开始时间须在当前时间之后 5 分钟至 7 天内。';
    if (policy.end && (new Date(policy.end).getTime() - start < 3600000 || new Date(policy.end).getTime() - start > 30 * 86400000)) return '截止时间须在开始时间后 1 小时至 30 天内。';
  }
  return '';
}
