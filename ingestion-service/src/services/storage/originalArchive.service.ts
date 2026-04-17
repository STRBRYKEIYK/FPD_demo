import crypto from 'node:crypto';

export function computeImmutableHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
