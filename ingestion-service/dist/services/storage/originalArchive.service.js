import crypto from 'node:crypto';
export function computeImmutableHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}
