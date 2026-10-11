import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'vx_admin_session';
const SESSION_MS = 8 * 60 * 60 * 1000;

export function adminConfigReady() {
    return !!process.env.ADMIN_USERNAME
        && Buffer.byteLength(process.env.ADMIN_PASSWORD || '') >= 12
        && Buffer.byteLength(process.env.ADMIN_SESSION_SECRET || '') >= 32;
}

export function sameOriginRequest(req) {
    const origin = String(req.headers.origin || '');
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
    if (!origin || !host) return false;
    try {
        const parsed = new URL(origin);
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        return parsed.host.toLowerCase() === host && (parsed.protocol === 'https:' || isLocal);
    } catch {
        return false;
    }
}

function sign(payload) {
    return createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '')
        .update(payload)
        .digest('base64url');
}

export function createAdminSession() {
    const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + SESSION_MS })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function hasAdminSession(req) {
    if (!adminConfigReady()) return false;
    const cookieHeader = String(req.headers.cookie || '');
    const cookie = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return false;
    const token = cookie.slice(COOKIE_NAME.length + 1);
    const [payload, suppliedSignature] = token.split('.');
    if (!payload || !suppliedSignature) return false;

    const expected = Buffer.from(sign(payload));
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return session.role === 'admin' && Number(session.exp) > Date.now();
    } catch {
        return false;
    }
}

export function adminCookie(req, value, maxAgeSeconds = 8 * 60 * 60) {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    const secure = forwardedProto === 'https' || host.endsWith('.vercel.app');
    return `${COOKIE_NAME}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

