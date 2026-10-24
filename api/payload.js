import { createHash } from 'node:crypto';
import { db } from './_admin.js';
import { getCodeForExecution } from './_deliveryCode.js';

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function keyDigest(key) {
    return createHash('sha256').update(String(key)).digest('hex');
}

function keyExpiresAt(key) {
    if (!key || !key.durationDays || !key.keyGeneratedAt) return null;
    const generatedAt = typeof key.keyGeneratedAt === 'number'
        ? key.keyGeneratedAt
        : key.keyGeneratedAt && typeof key.keyGeneratedAt.toMillis === 'function'
            ? key.keyGeneratedAt.toMillis()
            : Number.NaN;
    const durationDays = Number(key.durationDays);
    if (!Number.isFinite(generatedAt) || !Number.isFinite(durationDays) || durationDays <= 0) return null;
    return generatedAt + durationDays * 86400000;
}

function getVaultKeys(vault) {
    if (Array.isArray(vault.keys) && vault.keys.length > 0) return vault.keys;
    if (vault.key) return [{ id: 'k_legacy', key: vault.key, terminated: false, maxUsersUnlimited: true }];
    return [];
}

function getClientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
}

async function findSessionKey(session, vault) {
    if (!session.requireKey) return { ok: !vault.requireKey };
    if (!vault.requireKey || !session.keyHash) return { ok: false, message: 'Key access changed. Run the current loader again.' };

    let key = null;
    if (session.issuedKeyId) {
        const snap = await db.collection('vaults').doc(session.vaultId)
            .collection('issuedKeys').doc(session.issuedKeyId).get();
        if (snap.exists) key = snap.data();
    } else {
        key = getVaultKeys(vault).find(item =>
            keyDigest(item.key) === session.keyHash && (item.id || 'k_legacy') === session.keyId
        ) || null;
    }

    if (!key || keyDigest(key.key) !== session.keyHash || key.terminated) {
        return { ok: false, message: 'This key is no longer valid.' };
    }
    const expiresAt = keyExpiresAt(key);
    if (expiresAt != null && Date.now() >= expiresAt) return { ok: false, message: 'This key has expired.' };

    if (session.userId && key.maxUsersUnlimited !== true && key.maxUsers !== 'unlimited') {
        const boundUsers = Array.isArray(key.boundUsers) ? key.boundUsers : [];
        if (!boundUsers.some(item => String(item.userId) === String(session.userId))) {
            return { ok: false, message: 'This key is no longer assigned to this player.' };
        }
    }
    return { ok: true };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }

    const sessionToken = String(req.query?.session || '');
    if (!/^[a-f0-9]{64}$/i.test(sessionToken)) {
        return json(res, 400, { ok: false, message: 'Missing or invalid delivery ticket.' });
    }
    const requestedUserId = req.query?.userId == null ? '' : String(req.query.userId);
    if (requestedUserId && !/^\d{1,20}$/.test(requestedUserId)) {
        return json(res, 400, { ok: false, message: 'Invalid player ID.' });
    }

    try {
        const sessionRef = db.collection('sessions').doc(sessionToken);
        const consumed = await db.runTransaction(async tx => {
            const snap = await tx.get(sessionRef);
            if (!snap.exists) return { ok: false, status: 401, message: 'Delivery ticket expired or already used.' };
            const session = snap.data();
            if (!Number(session.expiresAt) || Date.now() >= Number(session.expiresAt)) {
                tx.delete(sessionRef);
                return { ok: false, status: 401, message: 'Delivery ticket expired. Run the loader again.' };
            }
            if (session.userId && String(session.userId) !== requestedUserId) {
                tx.delete(sessionRef);
                return { ok: false, status: 403, message: 'Delivery ticket belongs to a different player.' };
            }
            tx.delete(sessionRef);
            return { ok: true, session };
        });
        if (!consumed.ok) return json(res, consumed.status, { ok: false, message: consumed.message });

        const session = consumed.session;
        const vaultRef = db.collection('vaults').doc(String(session.vaultId));
        const vaultSnap = await vaultRef.get();
        if (!vaultSnap.exists) return json(res, 404, { ok: false, message: 'Vault not found.' });
        const vault = vaultSnap.data();
        if (vault.launchPaused === true) {
            return json(res, 423, { ok: false, message: 'This vault is temporarily paused by its owner.' });
        }

        if (session.userId) {
            const banned = (Array.isArray(vault.bannedUsers) ? vault.bannedUsers : [])
                .find(item => String(item.userId) === String(session.userId));
            if (banned && (banned.bannedUntil == null || Number(banned.bannedUntil) > Date.now())) {
                return json(res, 403, { ok: false, message: 'You are banned from this vault.' });
            }
        }
        if (session.requireKey && vault.ipLock) {
            const currentIp = getClientIp(req);
            if (!session.clientIp || session.clientIp !== currentIp || vault.boundIp !== currentIp) {
                return json(res, 403, { ok: false, message: 'This delivery ticket no longer matches the vault network lock.' });
            }
        }

        const keyStatus = await findSessionKey(session, vault);
        if (!keyStatus.ok) return json(res, 403, { ok: false, message: keyStatus.message || 'Key access changed.' });

        const executionCode = getCodeForExecution(vault);
        if (typeof executionCode !== 'string' || !executionCode.trim()) {
            return json(res, 500, { ok: false, message: 'Vault payload is unavailable.' });
        }

        return json(res, 200, { ok: true, version: 3, code: executionCode });
    } catch (error) {
        console.error('Protected payload delivery failed:', error);
        return json(res, 500, { ok: false, message: 'Could not load the protected payload.' });
    }
}
