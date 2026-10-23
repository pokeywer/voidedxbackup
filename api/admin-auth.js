import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './_admin.js';
import { adminConfigReady, adminCookie, createAdminSession, hasAdminSession, sameOriginRequest } from './_adminSession.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function matchesSecret(provided, expected) {
    const digest = value => createHash('sha256').update(String(value)).digest();
    return timingSafeEqual(digest(provided), digest(expected));
}

function clientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.socket?.remoteAddress || 'unknown';
}

function rateLimitId(req) {
    return createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
        .update(clientIp(req))
        .digest('hex');
}

async function getLoginLimit(req) {
    const ref = db.collection('adminLoginLimits').doc(rateLimitId(req));
    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const now = Date.now();
        const state = snap.exists ? snap.data() : {};
        const blockedUntil = Number(state.blockedUntil) || 0;
        if (blockedUntil > now) return { allowed: false, retryAfter: Math.ceil((blockedUntil - now) / 1000) };
        const windowStartedAt = Number(state.windowStartedAt) || 0;
        if (!windowStartedAt || now - windowStartedAt >= LOGIN_WINDOW_MS) {
            tx.set(ref, { windowStartedAt: now, failures: 0, blockedUntil: 0, updatedAt: now });
            return { allowed: true };
        }
        return { allowed: true };
    });
}

async function recordFailedLogin(req) {
    const ref = db.collection('adminLoginLimits').doc(rateLimitId(req));
    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const now = Date.now();
        const state = snap.exists ? snap.data() : {};
        const oldWindow = Number(state.windowStartedAt) || 0;
        const windowStartedAt = oldWindow && now - oldWindow < LOGIN_WINDOW_MS ? oldWindow : now;
        const failures = (windowStartedAt === oldWindow ? Number(state.failures) || 0 : 0) + 1;
        const blockedUntil = failures >= MAX_FAILED_LOGINS ? now + LOGIN_WINDOW_MS : 0;
        tx.set(ref, { windowStartedAt, failures, blockedUntil, updatedAt: now });
        return { blocked: blockedUntil > 0, retryAfter: blockedUntil ? LOGIN_WINDOW_MS / 1000 : 0 };
    });
}

async function clearLoginLimit(req) {
    await db.collection('adminLoginLimits').doc(rateLimitId(req)).set({
        windowStartedAt: Date.now(), failures: 0, blockedUntil: 0, updatedAt: Date.now()
    });
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return json(res, 200, {
            ok: true,
            configured: adminConfigReady(),
            authenticated: adminConfigReady() && hasAdminSession(req)
        });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }
    if (!sameOriginRequest(req)) return json(res, 403, { ok: false, message: 'Request origin was rejected.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = String(body.action || '');
    if (action === 'logout') {
        res.setHeader('Set-Cookie', adminCookie(req, '', 0));
        return json(res, 200, { ok: true });
    }
    if (action !== 'login') return json(res, 400, { ok: false, message: 'Choose a supported admin action.' });
    if (!adminConfigReady()) return json(res, 503, { ok: false, message: 'Admin login is not configured for this deployment.' });

    try {
        const limit = await getLoginLimit(req);
        if (!limit.allowed) {
            res.setHeader('Retry-After', String(limit.retryAfter));
            return json(res, 429, { ok: false, message: 'Too many sign-in attempts. Try again in a few minutes.' });
        }

        const username = typeof body.username === 'string' ? body.username.slice(0, 80) : '';
        const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
        const validUsername = matchesSecret(username, process.env.ADMIN_USERNAME);
        const validPassword = matchesSecret(password, process.env.ADMIN_PASSWORD);
        if (!validUsername || !validPassword) {
            const failed = await recordFailedLogin(req);
            if (failed.blocked) res.setHeader('Retry-After', String(failed.retryAfter));
            return json(res, failed.blocked ? 429 : 401, {
                ok: false,
                message: failed.blocked ? 'Too many sign-in attempts. Try again in a few minutes.' : 'The username or password is incorrect.'
            });
        }

        await clearLoginLimit(req);
        res.setHeader('Set-Cookie', adminCookie(req, createAdminSession()));
        return json(res, 200, { ok: true });
    } catch (error) {
        console.error('Admin authentication failed:', error);
        return json(res, 500, { ok: false, message: 'Could not complete admin sign-in.' });
    }
}
