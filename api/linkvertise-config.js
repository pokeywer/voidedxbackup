import { db, getAdminAuth } from './_admin.js';
import { encryptLinkvertiseToken } from './_linkvertise.js';

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

async function getOwner(req, vaultId) {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return { error: { status: 401, message: 'Sign in before saving Linkvertise settings.' } };
    let decoded;
    try {
        decoded = await getAdminAuth().verifyIdToken(match[1]);
    } catch {
        return { error: { status: 401, message: 'Your sign-in expired. Reload and try again.' } };
    }

    const vaultSnap = await db.collection('vaults').doc(vaultId).get();
    if (!vaultSnap.exists) return { error: { status: 404, message: 'Vault not found.' } };
    const vault = vaultSnap.data();
    if (vault.uid !== decoded.uid && vault.uid !== 'guest') {
        return { error: { status: 403, message: 'Only this vault’s owner can change Linkvertise settings.' } };
    }
    return { vault };
}

export default async function handler(req, res) {
    const vaultId = String(req.query.id || '');
    if (!vaultId) return json(res, 400, { ok: false, message: 'Missing vault id.' });
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }

    try {
        const owner = await getOwner(req, vaultId);
        if (owner.error) return json(res, owner.error.status, { ok: false, message: owner.error.message });
        const tokenRef = db.collection('linkvertiseCredentials').doc(vaultId);

        if (req.method === 'GET') {
            const saved = await tokenRef.get();
            return json(res, 200, { ok: true, configured: saved.exists });
        }

        const token = String((req.body && req.body.token) || '').trim();
        if (!/^[a-f0-9]{64}$/i.test(token)) {
            return json(res, 400, { ok: false, message: 'Paste the 64-character Linkvertise Anti-Bypass token.' });
        }

        const encrypted = encryptLinkvertiseToken(token);
        await tokenRef.set({ ...encrypted, updatedAt: Date.now() });
        return json(res, 200, { ok: true, configured: true });
    } catch (err) {
        const message = err && err.message && err.message.includes('LINKVERTISE_ENCRYPTION_KEY')
            ? 'The site owner must add LINKVERTISE_ENCRYPTION_KEY to the Vercel environment before Linkvertise verification can be saved.'
            : 'Could not save Linkvertise settings.';
        return json(res, 500, { ok: false, message });
    }
}
