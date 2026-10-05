/** Checks public email address structure; ownership is verified with a code. */
export function isValidEmail(value: string): boolean {
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || domain.length > 253) return false;
  if (!labels.every((label) => label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))) return false;
  const suffix = labels[labels.length - 1];
  return /^[A-Za-z]{2,63}$/.test(suffix) || /^xn--[A-Za-z0-9-]+$/i.test(suffix);
}

/** Associates a recoverable validation failure with its input. */
export class FieldValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'FieldValidationError';
  }
}
