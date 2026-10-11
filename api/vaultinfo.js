import { db } from './_admin.js';

// Public data for vault.html. Tells the page whether a key is needed / valid,
// but never returns the script code or any key values.
function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json(body);
}

export default async function handler(req, res) {
    const { id, key } = req.query;
    if (!id) return json(res, 400, { ok: false, message: 'No vault ID was provided in the link.' });
    try {
        const snap = await db.collection('vaults').doc(String(id)).get();
        if (!snap.exists) return json(res, 404, { ok: false, message: "This vault ID doesn't exist or may have been deleted." });
        const v = snap.data();
        const base = { ok: true, title: v.title || '', requireKey: !!v.requireKey };
        if (!v.requireKey) return json(res, 200, base);

        const keys = Array.isArray(v.keys) && v.keys.length ? v.keys
            : (v.key ? [{ key: v.key, durationDays: null, keyGeneratedAt: v.keyGeneratedAt || null }] : []);
        const found = key ? keys.find(k => k.key === key) : null;
        if (!found) return json(res, 200, { ...base, keyStatus: 'wrong' });
        if (found.terminated) return json(res, 200, { ...base, keyStatus: 'terminated' });
        let expiresAt = null;
        if (found.durationDays && found.keyGeneratedAt) {
            expiresAt = found.keyGeneratedAt + found.durationDays * 86400000;
            if (Date.now() > expiresAt) return json(res, 200, { ...base, keyStatus: 'expired' });
        }
        return json(res, 200, { ...base, keyStatus: 'ok', expiresAt });
    } catch (err) {
        return json(res, 500, { ok: false, message: 'Server error.' });
    }
}
