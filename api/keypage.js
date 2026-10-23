import { db } from './_admin.js';
import { randomBytes } from 'node:crypto';
import { isSafeExternalUrl } from './_safeExternalUrl.js';

// Public endpoint behind key.html. Claims are stored as separate, random
// Firestore documents and removed as soon as a key is issued.
const WAIT_MS = 15000;
const TICKET_TTL_MS = 20 * 60 * 1000;
const PUBLIC_KEY_ID = 'k_public';

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function randomKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = 'VX-';
    for (const byte of randomBytes(16)) out += chars[byte & 31];
    return out;
}

function configuredGate(cfg) {
    return String((cfg && cfg.customLinkUrl) || '').trim();
}

function makeGateUrl(baseUrl, ticket) {
    const url = new URL(baseUrl);
    url.searchParams.set('vx_ticket', ticket);
    return url.toString();
}

export default async function handler(req, res) {
    const id = String(req.query.id || '');
    const action = String(req.query.action || '');
    const token = String(req.query.token || '');
    if (!id) return json(res, 400, { ok: false, message: 'Missing vault id.' });

    const vaultRef = db.collection('vaults').doc(id);

    try {
        if (action === 'start') {
            if (req.method !== 'GET') {
                res.setHeader('Allow', 'GET');
                return json(res, 405, { ok: false, message: 'Method not allowed.' });
            }
            const snap = await vaultRef.get();
            if (!snap.exists) return json(res, 404, { ok: false, message: 'Vault not found.' });
            const v = snap.data();
            const cfg = v.publicKeyConfig;
            if (!v.requireKey || !cfg || !cfg.enabled) {
                return json(res, 400, { ok: false, message: 'This vault has no public key to get.' });
            }

            const gateUrl = configuredGate(cfg);
            if (gateUrl && !isSafeExternalUrl(gateUrl)) {
                return json(res, 400, { ok: false, message: 'The owner’s custom link is blocked or invalid. Please contact the owner.' });
            }

            const now = Date.now();
            const expiredClaims = await vaultRef.collection('keyClaims').where('expiresAt', '<=', now).limit(25).get();
            await Promise.all(expiredClaims.docs.map(doc => doc.ref.delete()));
            const ticket = randomBytes(32).toString('hex');
            await vaultRef.collection('keyClaims').doc(ticket).create({
                status: gateUrl ? 'started' : 'ready',
                gateUrl,
                startedAt: now,
                expiresAt: now + TICKET_TTL_MS
            });

            return json(res, 200, {
                ok: true,
                token: ticket,
                waitMs: WAIT_MS,
                expiresAt: now + TICKET_TTL_MS,
                requiresReturn: !!gateUrl,
                gateUrl: gateUrl ? makeGateUrl(gateUrl, ticket) : ''
            });
        }

        if (action === 'verify') {
            if (req.method !== 'POST') {
                res.setHeader('Allow', 'POST');
                return json(res, 405, { ok: false, message: 'Method not allowed.' });
            }
            const ticket = String((req.body && req.body.ticket) || '');
            if (!/^[a-f0-9]{64}$/i.test(ticket)) {
                return json(res, 400, { ok: false, message: 'The one-time return ticket is missing or invalid.' });
            }

            const claimRef = vaultRef.collection('keyClaims').doc(ticket);
            const result = await db.runTransaction(async tx => {
                const [vaultSnap, claimSnap] = await Promise.all([tx.get(vaultRef), tx.get(claimRef)]);
                if (!vaultSnap.exists) return { ok: false, status: 404, message: 'Vault not found.' };
                if (!claimSnap.exists) return { ok: false, status: 400, message: 'This return ticket was already used or has expired. Start again.' };

                const cfg = vaultSnap.data().publicKeyConfig;
                const claim = claimSnap.data();
                if (!vaultSnap.data().requireKey || !cfg || !cfg.enabled || !configuredGate(cfg) || configuredGate(cfg) !== claim.gateUrl) {
                    return { ok: false, status: 403, message: 'The custom link changed. Start again from the Get-Key page.' };
                }
                if (claim.status !== 'started' || Date.now() >= claim.expiresAt) {
                    return { ok: false, status: 400, message: 'This return ticket was already used or has expired. Start again.' };
                }
                if (!isSafeExternalUrl(claim.gateUrl)) {
                    return { ok: false, status: 403, message: 'The owner’s custom link is blocked or invalid.' };
                }

                const returnedAt = Date.now();
                tx.update(claimRef, { status: 'returned', returnedAt });
                return { ok: true, token: ticket, waitMs: WAIT_MS, expiresAt: claim.expiresAt };
            });
            return json(res, result.status || 200, result);
        }

        if (action === 'claim') {
            if (req.method !== 'GET') {
                res.setHeader('Allow', 'GET');
                return json(res, 405, { ok: false, message: 'Method not allowed.' });
            }
            if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
                return json(res, 400, { ok: false, message: 'Missing or invalid one-time ticket.' });
            }

            const claimRef = vaultRef.collection('keyClaims').doc(token);
            const result = await db.runTransaction(async tx => {
                const [snap, claimSnap] = await Promise.all([tx.get(vaultRef), tx.get(claimRef)]);
                if (!snap.exists) return { ok: false, status: 404, message: 'Vault not found.' };
                if (!claimSnap.exists) return { ok: false, status: 400, message: 'That request expired or was already used. Start again.' };

                const v = snap.data();
                const cfg = v.publicKeyConfig;
                if (!v.requireKey || !cfg || !cfg.enabled) {
                    return { ok: false, status: 400, message: 'This vault has no public key to get.' };
                }
                const claim = claimSnap.data();
                const gateUrl = configuredGate(cfg);
                if (Date.now() >= claim.expiresAt || (gateUrl && gateUrl !== claim.gateUrl)) {
                    tx.delete(claimRef);
                    return { ok: false, status: 400, message: 'That request expired or the owner changed the custom link. Start again.' };
                }
                if (gateUrl && claim.status !== 'returned') {
                    return { ok: false, status: 403, message: 'Return through the owner’s reward link before claiming this key.' };
                }
                if (!gateUrl && claim.status !== 'ready') {
                    return { ok: false, status: 403, message: 'Start again from the Get-Key page.' };
                }

                const startedAt = gateUrl ? claim.returnedAt : claim.startedAt;
                if (!startedAt || Date.now() - startedAt < WAIT_MS) {
                    return { ok: false, status: 425, message: "Please wait — the timer isn't done yet." };
                }

                const now = Date.now();
                const isLive = k => k && !k.terminated &&
                    !(k.durationDays && k.keyGeneratedAt && now >= k.keyGeneratedAt + k.durationDays * 86400000);
                let activeKey;

                if (gateUrl) {
                    activeKey = {
                        id: `k_custom_${randomBytes(12).toString('hex')}`,
                        label: cfg.label || 'Public Key',
                        key: randomKey(),
                        priority: 0,
                        durationDays: cfg.durationDays || null,
                        keyGeneratedAt: now,
                        maxUsers: cfg.maxUsersUnlimited ? 1 : Math.max(1, cfg.maxUsers || 1),
                        maxUsersUnlimited: !!cfg.maxUsersUnlimited,
                        boundUsers: [],
                        terminated: false,
                        customLinkUrl: gateUrl,
                        visibility: 'public',
                        autoGenerated: true,
                        issuedByCustomGate: true
                    };
                    tx.set(vaultRef.collection('issuedKeys').doc(activeKey.id), activeKey);
                } else {
                    const keys = Array.isArray(v.keys) ? v.keys : [];
                    const idx = keys.findIndex(k => k.id === PUBLIC_KEY_ID);
                    if (idx !== -1 && isLive(keys[idx])) {
                        activeKey = keys[idx];
                    } else {
                        activeKey = {
                            id: PUBLIC_KEY_ID,
                            label: cfg.label || 'Public Key',
                            key: randomKey(),
                            priority: 0,
                            durationDays: cfg.durationDays || null,
                            keyGeneratedAt: now,
                            maxUsers: cfg.maxUsersUnlimited ? 1 : Math.max(1, cfg.maxUsers || 1),
                            maxUsersUnlimited: !!cfg.maxUsersUnlimited,
                            boundUsers: [],
                            terminated: false,
                            visibility: 'public',
                            autoGenerated: true
                        };
                        const updatedKeys = idx !== -1 ? keys.map((k, i) => i === idx ? activeKey : k) : [...keys, activeKey];
                        tx.update(vaultRef, { keys: updatedKeys });
                    }
                }

                tx.delete(claimRef);
                return {
                    ok: true,
                    key: activeKey.key,
                    expiresAt: activeKey.durationDays ? activeKey.keyGeneratedAt + activeKey.durationDays * 86400000 : null,
                    unique: !!gateUrl
                };
            });
            return json(res, result.status || 200, result);
        }

        const snap = await vaultRef.get();
        if (!snap.exists) return json(res, 404, { ok: false, message: "This vault ID doesn't exist or may have been deleted." });
        const v = snap.data();
        if (!v.requireKey) return json(res, 200, { ok: true, requireKey: false, title: v.title || '' });

        const cfg = v.publicKeyConfig;
        if (!cfg || !cfg.enabled) {
            return json(res, 200, { ok: true, requireKey: true, title: v.title || '', publicKey: null });
        }
        const gateUrl = configuredGate(cfg);
        const gateBlocked = !!gateUrl && !isSafeExternalUrl(gateUrl);
        return json(res, 200, {
            ok: true,
            requireKey: true,
            title: v.title || '',
            publicKey: {
                label: cfg.label || 'Public Key',
                durationDays: cfg.durationDays || null,
                customLinkUrl: gateBlocked ? '' : gateUrl,
                customLinkConfigured: !!gateUrl,
                customLinkBlocked: gateBlocked
            }
        });
    } catch (err) {
        return json(res, 500, { ok: false, message: 'Server error.' });
    }
}
