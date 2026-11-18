import type { FirmwareVersion } from './client';

export const firmwareVersionHint =
  '版本号须为 X.Y.Z 三段非负整数，每段不超过 2147483647，不允许前导零或版本后缀，例如 1.0.0。';

// 对齐后端 semver4j 的正式版子集及 int 数字段范围，不做自动补位或版本转换。
function parseFirmwareVersion(value: string) {
  if (value.length > 32 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return undefined;
  const parts = value.split('.').map(Number);
  return parts.every((part) => part <= 2_147_483_647) && parts.join('.') === value ? parts : undefined;
}

export function isFirmwareVersion(value: string) {
  return !!parseFirmwareVersion(value);
}

export function isFirmwareUpgrade(source: string, target: string) {
  const from = parseFirmwareVersion(source);
  const to = parseFirmwareVersion(target);
  if (!from || !to) return false;
  for (let index = 0; index < from.length; index++) {
    if (from[index] !== to[index]) return to[index] > from[index];
  }
  return false;
}

export function isDeltaSource(source: FirmwareVersion, target: FirmwareVersion) {
  return source.id !== target.id && source.moduleId === target.moduleId &&
    isFirmwareUpgrade(source.versionText, target.versionText);
}
