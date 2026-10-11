import { db, FieldValue } from './_admin.js';

const SESSION_TTL_MS = 60 * 1000;
const MAX_USES = 3;
const MOD = 16777216; 

const MULT = 25173;
const INC = 13849;

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function seedFromToken(token) {
    let h = 2166131;
    for (let i = 0; i < token.length; i++) {
        h = (h ^ token.charCodeAt(i)) >>> 0;
        h = (h * 16777619) >>> 0;
    }
    return h % MOD;
}

function utf8Bytes(str) {
    return new TextEncoder().encode(str);
}

function b64(bytes) {
    return Buffer.from(bytes).toString('base64');
}

function protect(source, token) {
    const input = utf8Bytes(source);
    let state = seedFromToken(token);
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
        state = (state * MULT + INC) % MOD;
        out[i] = input[i] ^ (state & 255);
    }
    return b64(out);
}

export default async function handler(req, res) {
    const sessionToken = String(req.query.session || '');
    if (!sessionToken || sessionToken.length < 32) {
        return json(res, 400, { ok: false, message: 'Missing or invalid session.' });
    }

    try {
        const sessionRef = db.collection('sessions').doc(sessionToken);
        const result = await db.runTransaction(async tx => {
            const snap = await tx.get(sessionRef);
            if (!snap.exists) return { ok: false, status: 401, message: 'Session expired or invalid.' };
            const session = snap.data();
            const now = Date.now();
            if (!session.expiresAt || now > session.expiresAt) {
                return { ok: false, status: 401, message: 'Session expired. Please run the loader again.' };
            }
            const uses = Number(session.uses || 0);
            if (uses >= Math.min(Number(session.maxUses || MAX_USES), MAX_USES)) {
                return { ok: false, status: 429, message: 'Session payload limit reached.' };
            }
            tx.update(sessionRef, { uses: FieldValue.increment(1) });
            return { ok: true, session };
        });

        if (!result.ok) return json(res, result.status, { ok: false, message: result.message });

        const vaultRef = db.collection('vaults').doc(String(result.session.vaultId));
        const vaultSnap = await vaultRef.get();
        if (!vaultSnap.exists) return json(res, 404, { ok: false, message: 'Vault not found.' });

        const vault = vaultSnap.data();
        if (typeof vault.code !== 'string') {
            return json(res, 500, { ok: false, message: 'Vault payload is unavailable.' });
        }

        return json(res, 200, {
            ok: true,
            version: 2,
            encoding: 'xor-fnv-lcg-base64',
            payload: protect(vault.code, sessionToken)
        });
    } catch (err) {
        return json(res, 500, { ok: false, message: 'Could not load protected payload.' });
    }
}
