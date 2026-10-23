import { createHash, randomBytes } from 'node:crypto';
import { db } from './_admin.js';
import { recordExecution } from './_executionStats.js';

const DELIVERY_SESSION_TTL_MS = 90 * 1000;
const VERIFY_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_LIMIT_ATTEMPTS = 30;
const VERIFY_LIMIT_TTL_MS = 24 * 60 * 60 * 1000;

async function cleanupExpiredSessions() {
    const expired = await db.collection('sessions').where('expiresAt', '<=', Date.now()).limit(25).get();
    await Promise.all(expired.docs.map(doc => doc.ref.delete()));
}

async function cleanupExpiredVerificationLimits() {
    const expired = await db.collection('verificationLimits').where('expiresAt', '<=', Date.now()).limit(25).get();
    await Promise.all(expired.docs.map(doc => doc.ref.delete()));
}

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function getVaultKeys(vaultData) {
    if (Array.isArray(vaultData.keys) && vaultData.keys.length > 0) return vaultData.keys;
    if (vaultData.key) {
        return [{
            id: 'k_legacy', key: vaultData.key, durationDays: null,
            keyGeneratedAt: vaultData.keyGeneratedAt || null,
            maxUsers: 1, maxUsersUnlimited: true, boundUsers: [], terminated: false
        }];
    }
    return [];
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

function getClientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function keyDigest(key) {
    return createHash('sha256').update(String(key)).digest('hex');
}

async function consumeVerificationAttempt(vaultId, req) {
    const ip = getClientIp(req);
    const refId = createHash('sha256').update(`${vaultId}\0${ip}`).digest('hex');
    const ref = db.collection('verificationLimits').doc(refId);
    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const now = Date.now();
        const state = snap.exists ? snap.data() : {};
        const blockedUntil = Number(state.blockedUntil) || 0;
        if (blockedUntil > now) {
            return { allowed: false, retryAfter: Math.ceil((blockedUntil - now) / 1000) };
        }

        const previousStart = Number(state.windowStartedAt) || 0;
        const sameWindow = previousStart > 0 && now - previousStart < VERIFY_LIMIT_WINDOW_MS;
        const windowStartedAt = sameWindow ? previousStart : now;
        const attempts = (sameWindow ? Number(state.attempts) || 0 : 0) + 1;
        const nextBlockedUntil = attempts > VERIFY_LIMIT_ATTEMPTS ? now + VERIFY_LIMIT_WINDOW_MS : 0;
        tx.set(ref, {
            vaultId,
            windowStartedAt,
            attempts,
            blockedUntil: nextBlockedUntil,
            expiresAt: now + VERIFY_LIMIT_TTL_MS,
            updatedAt: now
        });
        return nextBlockedUntil > now
            ? { allowed: false, retryAfter: VERIFY_LIMIT_WINDOW_MS / 1000 }
            : { allowed: true };
    });
}

function isBanned(vault, userId) {
    if (!userId) return false;
    const ban = (Array.isArray(vault.bannedUsers) ? vault.bannedUsers : [])
        .find(item => String(item.userId) === userId);
    return !!ban && (ban.bannedUntil == null || Number(ban.bannedUntil) > Date.now());
}

function failure(status, message, code = null) {
    return { ok: false, status, message, code };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }

    const id = String(req.query?.id || '');
    const key = String(req.query?.key || '');
    const rawUserId = req.query?.userId == null ? '' : String(req.query.userId);
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) {
        return json(res, 400, { ok: false, message: 'Missing or invalid vault ID.' });
    }
    if (key.length > 256) return json(res, 400, { ok: false, message: 'Invalid key.' });
    if (rawUserId && !/^\d{1,20}$/.test(rawUserId)) {
        return json(res, 400, { ok: false, message: 'Invalid player ID.' });
    }
    const userId = rawUserId || null;
    const username = typeof req.query?.username === 'string'
        ? req.query.username.replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').trim().slice(0, 32) || 'Unknown'
        : 'Unknown';
    const vaultRef = db.collection('vaults').doc(id);
    const sessionToken = randomBytes(32).toString('hex');
    const sessionRef = db.collection('sessions').doc(sessionToken);
    const now = Date.now();

    try {
        try { await cleanupExpiredSessions(); } catch {}
        try { await cleanupExpiredVerificationLimits(); } catch {}
        const initialSnap = await vaultRef.get();
        if (!initialSnap.exists) {
            return json(res, 200, {
                ok: false,
                code: 'vault_removed',
                message: 'This vault has been removed or deleted. Contact the owner for support.'
            });
        }

        const initiallyKeyed = !!initialSnap.data().requireKey;
        if (initiallyKeyed) {
            const rateLimit = await consumeVerificationAttempt(id, req);
            if (!rateLimit.allowed) {
                res.setHeader('Retry-After', String(rateLimit.retryAfter));
                return json(res, 429, { ok: false, message: 'Too many key checks from this network. Wait a few minutes and try again.' });
            }
            if (!userId) return json(res, 400, { ok: false, message: 'A player ID is required for key verification.' });
            if (!key) return json(res, 400, { ok: false, message: 'Missing key.' });
        }

        let issuedKeyRef = null;
        if (initiallyKeyed) {
            const existingKey = getVaultKeys(initialSnap.data()).find(item => item.key === key);
            if (!existingKey) {
                const issuedSnap = await vaultRef.collection('issuedKeys').where('key', '==', key).limit(1).get();
                if (!issuedSnap.empty) issuedKeyRef = issuedSnap.docs[0].ref;
            }
        }

        const result = await db.runTransaction(async tx => {
            const freshSnap = await tx.get(vaultRef);
            if (!freshSnap.exists) {
                return failure(200, 'This vault has been removed or deleted. Contact the owner for support.', 'vault_removed');
            }
            const vault = freshSnap.data();
            if (!!vault.requireKey !== initiallyKeyed) {
                return failure(403, 'The vault access settings changed. Run the current loader again.');
            }
            if (isBanned(vault, userId)) return failure(403, 'You are banned from this vault.');

            const expiresAt = now + DELIVERY_SESSION_TTL_MS;
            const sessionBase = {
                vaultId: id,
                createdAt: now,
                expiresAt,
                uses: 0,
                maxUses: 1,
                userId,
                requireKey: initiallyKeyed
            };

            if (!initiallyKeyed) {
                tx.create(sessionRef, sessionBase);
                return { ok: true, token: sessionToken, ticketExpiresAt: expiresAt, expiresAt: null };
            }

            let matched = null;
            let issuedSnap = null;
            let keys = null;
            let keyIndex = -1;
            if (issuedKeyRef) {
                issuedSnap = await tx.get(issuedKeyRef);
                if (issuedSnap.exists && issuedSnap.data().key === key) matched = issuedSnap.data();
            } else {
                keys = getVaultKeys(vault);
                keyIndex = keys.findIndex(item => item.key === key);
                if (keyIndex >= 0) matched = keys[keyIndex];
            }

            if (!matched) return failure(403, 'Invalid key.');
            if (matched.terminated) return failure(403, 'This key has been terminated by the owner.');
            const keyExpiry = keyExpiresAt(matched);
            if (keyExpiry != null && now >= keyExpiry) return failure(403, 'This key has expired.');

            const clientAddress = getClientIp(req);
            const vaultUpdates = {};
            if (vault.ipLock) {
                if (!vault.boundIp) vaultUpdates.boundIp = clientAddress;
                else if (vault.boundIp !== clientAddress) return failure(403, 'This key is locked to a different network/IP.');
            }

            const boundUsers = Array.isArray(matched.boundUsers) ? matched.boundUsers : [];
            const existingBinding = userId
                ? boundUsers.find(item => String(item.userId) === userId)
                : null;
            const maxUsersUnlimited = matched.maxUsersUnlimited === true || matched.maxUsers === 'unlimited';
            const maxUsers = Math.max(1, Number(matched.maxUsers) || 1);
            if (userId && !existingBinding && !maxUsersUnlimited && boundUsers.length >= maxUsers) {
                return failure(403, `This key is already in use by the maximum number of players (${maxUsers}). Ask the vault owner to reset or raise the limit.`);
            }

            if (userId && !existingBinding) {
                const updatedUsers = [...boundUsers, { userId, username, boundAt: now }];
                if (issuedKeyRef) tx.update(issuedKeyRef, { boundUsers: updatedUsers });
                else if (Array.isArray(vault.keys) && vault.keys.length > 0) {
                    const updatedKeys = [...keys];
                    updatedKeys[keyIndex] = { ...matched, boundUsers: updatedUsers };
                    vaultUpdates.keys = updatedKeys;
                }
            }

            if (Object.keys(vaultUpdates).length) tx.update(vaultRef, vaultUpdates);
            tx.create(sessionRef, {
                ...sessionBase,
                keyHash: keyDigest(key),
                keyId: matched.id || 'k_legacy',
                issuedKeyId: issuedKeyRef ? issuedKeyRef.id : null,
                clientIp: vault.ipLock ? clientAddress : null
            });
            return {
                ok: true,
                token: sessionToken,
                ticketExpiresAt: expiresAt,
                expiresAt: keyExpiry,
                remainingSeconds: keyExpiry == null ? null : Math.max(0, Math.ceil((keyExpiry - now) / 1000)),
                keyExpiresAt: keyExpiry
            };
        });

        if (!result.ok) {
            return json(res, result.status || 403, {
                ok: false,
                code: result.code,
                message: result.message
            });
        }

        try { await recordExecution(vaultRef, id, initialSnap.data().title, userId); } catch {}
        return json(res, 200, {
            ok: true,
            token: result.token,
            ticketExpiresAt: result.ticketExpiresAt,
            expiresAt: result.expiresAt,
            remainingSeconds: result.remainingSeconds ?? null,
            keyExpiresAt: result.keyExpiresAt ?? null
        });
    } catch (error) {
        console.error('Vault verification failed:', error);
        return json(res, 500, { ok: false, message: 'Could not verify access to this vault.' });
    }
}
