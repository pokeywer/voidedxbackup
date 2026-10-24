import { db } from './_admin.js';
import { sameOriginRequest } from './_adminSession.js';
import { issueLoaderToken } from './_loaderToken.js';

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function getVaultKeys(vaultData) {
    if (Array.isArray(vaultData.keys) && vaultData.keys.length > 0) return vaultData.keys;
    if (vaultData.key) {
        return [{
            key: vaultData.key,
            durationDays: null,
            keyGeneratedAt: vaultData.keyGeneratedAt || null,
            terminated: false
        }];
    }
    return [];
}

function isKeyExpired(keyData, now) {
    if (!keyData || !keyData.durationDays || !keyData.keyGeneratedAt) return false;
    const generatedAt = typeof keyData.keyGeneratedAt === 'number'
        ? keyData.keyGeneratedAt
        : keyData.keyGeneratedAt && typeof keyData.keyGeneratedAt.toMillis === 'function'
            ? keyData.keyGeneratedAt.toMillis()
            : Number.NaN;
    const durationDays = Number(keyData.durationDays);
    if (!Number.isFinite(generatedAt) || !Number.isFinite(durationDays) || durationDays <= 0) return false;
    return now >= generatedAt + durationDays * 86400000;
}

async function hasUsableKey(vaultRef, vaultData, key) {
    const storedKeys = getVaultKeys(vaultData);
    let matched = storedKeys.find(item => item && item.key === key);

    if (!matched) {
        const issued = await vaultRef.collection('issuedKeys').where('key', '==', key).limit(1).get();
        if (!issued.empty) matched = issued.docs[0].data();
    }

    return !!matched && !matched.terminated && !isKeyExpired(matched, Date.now());
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }
    if (!sameOriginRequest(req)) return json(res, 403, { ok: false, message: 'Request origin was rejected.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const id = String(body.id || '');
    const key = String(body.key || '');
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) return json(res, 400, { ok: false, message: 'Missing or invalid vault ID.' });
    if (key.length > 256) return json(res, 400, { ok: false, message: 'Invalid key.' });

    try {
        const vaultRef = db.collection('vaults').doc(id);
        const vault = await vaultRef.get();
        if (!vault.exists) return json(res, 404, { ok: false, message: 'This vault no longer exists.' });
        const vaultData = vault.data();
        if (vaultData.launchPaused === true) {
            return json(res, 423, { ok: false, message: 'This vault is temporarily paused by its owner.' });
        }

        // URL-key loaders should not be minted for missing, unknown, terminated,
        // or expired keys. GUI mode deliberately accepts a blank key because the
        // in-game prompt validates it later through /api/verify.
        if (vaultData.requireKey && !vaultData.guiMode) {
            if (!key || !(await hasUsableKey(vaultRef, vaultData, key))) {
                return json(res, 403, { ok: false, message: 'This key is invalid, expired, or has been terminated.' });
            }
        }

        const issued = issueLoaderToken(id, key, vaultData.loaderVersion);
        return json(res, 200, {
            ok: true,
            token: issued.token,
            expiresAt: issued.expiresAt,
            refreshAfterMs: 40_000
        });
    } catch (error) {
        console.error('Could not issue loader token:', error);
        return json(res, 500, { ok: false, message: 'Could not refresh the loader. Try again.' });
    }
}
