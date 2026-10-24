import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const LOADER_TOKEN_TTL_MS = 45_000;

function secret() {
    const value = process.env.LOADER_TOKEN_SECRET
        || process.env.ADMIN_SESSION_SECRET
        || process.env.FIREBASE_SERVICE_ACCOUNT
        || '';
    if (Buffer.byteLength(value) < 32) throw new Error('Loader token signing secret is not configured.');
    return value;
}

function sign(payload) {
    return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function keyDigest(key) {
    return key ? createHash('sha256').update(String(key)).digest('hex') : '';
}

function normalizeVaultVersion(version) {
    const parsed = Number(version);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function issueLoaderToken(vaultId, key = '', vaultVersion = 0) {
    const expiresAt = Date.now() + LOADER_TOKEN_TTL_MS;
    const payload = Buffer.from(JSON.stringify({
        version: 1,
        vaultId: String(vaultId),
        keyHash: keyDigest(key),
        vaultVersion: normalizeVaultVersion(vaultVersion),
        expiresAt,
        nonce: randomBytes(16).toString('base64url')
    })).toString('base64url');
    return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyLoaderToken(token, vaultId, key = '', expectedVaultVersion) {
    if (typeof token !== 'string' || token.length > 2048) return false;
    const [payload, suppliedSignature, extra] = token.split('.');
    if (!payload || !suppliedSignature || extra !== undefined) return false;
    try {
        const expected = Buffer.from(sign(payload));
        const supplied = Buffer.from(suppliedSignature);
        if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        const versionMatches = expectedVaultVersion === undefined
            || normalizeVaultVersion(data.vaultVersion) === normalizeVaultVersion(expectedVaultVersion);
        return data.version === 1
            && data.vaultId === String(vaultId)
            && data.keyHash === keyDigest(key)
            && versionMatches
            && Number.isFinite(data.expiresAt)
            && Date.now() < data.expiresAt
            && typeof data.nonce === 'string';
    } catch {
        return false;
    }
}

