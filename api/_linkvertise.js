import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey() {
    const key = Buffer.from(process.env.LINKVERTISE_ENCRYPTION_KEY || '', 'base64');
    if (key.length !== 32) throw new Error('LINKVERTISE_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    return key;
}

export function encryptLinkvertiseToken(token) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return {
        token: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64')
    };
}

export function decryptLinkvertiseToken(record) {
    if (!record || !record.token || !record.iv || !record.tag) return null;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(record.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(record.token, 'base64')),
        decipher.final()
    ]).toString('utf8');
}
