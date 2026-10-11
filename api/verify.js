import { db, FieldValue } from './_admin.js';
import { recordExecution } from './_executionStats.js';

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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

function remainingKeySeconds(key) {
    const expiresAt = keyExpiresAt(key);
    if (expiresAt == null) return null;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

export default async function handler(req, res) {
    const { id, key, userId, username } = req.query;

    if (!id || !key) {
        return json(res, 400, { ok: false, message: 'Missing id or key.' });
    }

    try {
        const vaultRef = db.collection('vaults').doc(id);
        const vaultSnap = await vaultRef.get();

        if (!vaultSnap.exists) {
            return json(res, 200, {
                ok: false,
                code: 'vault_removed',
                message: 'This vault has been removed or deleted. Contact the owner for support.'
            });
        }

        const vault = vaultSnap.data();

        if (!vault.requireKey) {
            return json(res, 200, { ok: true, code: vault.code });
        }

        const uidStr = userId ? String(userId) : null;

        // Ban check — vault-wide, blocks a Roblox account from using ANY key here.
        if (uidStr) {
            const banned = (Array.isArray(vault.bannedUsers) ? vault.bannedUsers : [])
                .find(b => String(b.userId) === uidStr);
            if (banned && (banned.bannedUntil == null || banned.bannedUntil > Date.now())) {
                const untilMsg = banned.bannedUntil
                    ? `until ${new Date(banned.bannedUntil).toLocaleString()}`
                    : 'permanently';
                return json(res, 403, { ok: false, message: `You are banned from this vault ${untilMsg}.` });
            }
        }

        const keysList = getVaultKeys(vault);
        let matched = keysList.find(k => k.key === key);
        let issuedKeyRef = null;

        // Linkvertise completions receive individual keys stored outside the
        // main vault document, so look them up when no managed key matches.
        if (!matched) {
            const issuedSnap = await vaultRef.collection('issuedKeys').where('key', '==', key).limit(1).get();
            if (!issuedSnap.empty) {
                issuedKeyRef = issuedSnap.docs[0].ref;
                matched = issuedSnap.docs[0].data();
            }
        }

        if (!matched) {
            return json(res, 403, { ok: false, message: 'Invalid key.' });
        }
        if (matched.terminated) {
            return json(res, 403, { ok: false, message: 'This key has been terminated by the owner.' });
        }
        const matchedExpiresAt = keyExpiresAt(matched);
        if (matchedExpiresAt != null && Date.now() >= matchedExpiresAt) {
            return json(res, 403, { ok: false, message: 'This key has expired.' });
        }
        const initialRemainingSeconds = remainingKeySeconds(matched);
        const initialExpiresAt = matchedExpiresAt;

        // IP lock — vault-wide, atomic so two IPs can't both "win" the bind.
        if (vault.ipLock) {
            const clientIp = getClientIp(req);
            try {
                const ipResult = await db.runTransaction(async (tx) => {
                    const freshSnap = await tx.get(vaultRef);
                    if (!freshSnap.exists) return { ok: true };
                    const freshData = freshSnap.data();
                    if (!freshData.boundIp) {
                        tx.update(vaultRef, { boundIp: clientIp });
                        return { ok: true };
                    }
                    return { ok: freshData.boundIp === clientIp };
                });
                if (!ipResult.ok) {
                    return json(res, 403, { ok: false, message: 'This key is locked to a different network/IP.' });
                }
            } catch (e) {}
        }

        // Per-key player limit, atomic so two people can't both slip past a full cap.
        if (uidStr) {
            const result = await db.runTransaction(async (tx) => {
                const freshSnap = await tx.get(vaultRef);
                if (!freshSnap.exists) {
                    return {
                        ok: false,
                        code: 'vault_removed',
                        message: 'This vault has been removed or deleted. Contact the owner for support.'
                    };
                }
                const freshData = freshSnap.data();
                let freshKeys = null;
                let idx = -1;
                let fk;
                let issuedSnap = null;
                if (issuedKeyRef) {
                    issuedSnap = await tx.get(issuedKeyRef);
                    if (issuedSnap.exists && issuedSnap.data().key === key) fk = issuedSnap.data();
                } else {
                    freshKeys = getVaultKeys(freshData);
                    idx = freshKeys.findIndex(k => k.key === key);
                    if (idx !== -1) fk = freshKeys[idx];
                }
                if (!fk) return { ok: false, status: 403, message: 'Invalid key.' };
                if (fk.terminated) return { ok: false, status: 403, message: 'This key has been terminated by the owner.' };
                const freshExpiresAt = keyExpiresAt(fk);
                if (freshExpiresAt != null && Date.now() >= freshExpiresAt) {
                    return { ok: false, status: 403, message: 'This key has expired.' };
                }
                const remainingSeconds = remainingKeySeconds(fk);
                const boundUsers = Array.isArray(fk.boundUsers) ? fk.boundUsers : [];
                const existing = boundUsers.find(u => String(u.userId) === uidStr);

                if (existing) {
                    return { ok: true, code: freshData.code, remainingSeconds, expiresAt: freshExpiresAt };
                }
                if (!fk.maxUsersUnlimited && boundUsers.length >= (fk.maxUsers || 1)) {
                    return {
                        ok: false, status: 403,
                        message: `This key is already in use by the maximum number of players (${fk.maxUsers || 1}). Ask the vault owner to reset or raise the limit.`
                    };
                }

                const updatedUsers = [...boundUsers, { userId: uidStr, username: username || 'Unknown', boundAt: Date.now() }];
                if (issuedKeyRef) {
                    tx.update(issuedKeyRef, { boundUsers: updatedUsers });
                } else {
                    const updatedKeys = [...freshKeys];
                    updatedKeys[idx] = { ...fk, boundUsers: updatedUsers };

                    // Only write back through the modern `keys` array shape.
                    if (Array.isArray(freshData.keys) && freshData.keys.length > 0) {
                        tx.update(vaultRef, { keys: updatedKeys });
                    }
                }
                return { ok: true, code: freshData.code, remainingSeconds, expiresAt: freshExpiresAt };
            });

            if (!result.ok) {
                const status = result.code === 'vault_removed' ? 200 : (result.status || 403);
                return json(res, status, { ok: false, code: result.code || null, message: result.message });
            }
            try { await recordExecution(vaultRef, id, vault.title, uidStr); } catch (e) {}
            return json(res, 200, { ok: true, code: result.code, remainingSeconds: result.remainingSeconds, expiresAt: result.expiresAt });
        }

        try { await recordExecution(vaultRef, id, vault.title, uidStr); } catch (e) {}
        return json(res, 200, { ok: true, code: vault.code, remainingSeconds: initialRemainingSeconds, expiresAt: initialExpiresAt });
    } catch (err) {
        return json(res, 500, { ok: false, message: 'Server error: ' + err.message });
    }
}
