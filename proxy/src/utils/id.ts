import crypto from 'crypto';

export function generateId(prefix: string): string {
  return prefix + '_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
}
