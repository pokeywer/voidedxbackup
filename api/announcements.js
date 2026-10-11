import { db } from './_admin.js';
import { hasAdminSession, sameOriginRequest } from './_adminSession.js';

function json(res, status, body, cache = 'no-store') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', cache);
    return res.status(status).json(body);
}

function safeHttpUrl(value) {
    if (!value) return '';
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    const ref = db.collection('siteSettings').doc('announcement');

    if (req.method === 'GET') {
        try {
            const snap = await ref.get();
            const data = snap.exists ? snap.data() : null;
            return json(res, 200, {
                ok: true,
                announcement: data && data.enabled ? {
                    title: data.title || '',
                    message: data.message || '',
                    kind: data.kind || 'info',
                    link: data.link || '',
                    linkLabel: data.linkLabel || 'Learn more',
                    updatedAt: Number(data.updatedAt) || 0
                } : null
            }, 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
        } catch (err) {
            console.error('Could not load announcement:', err);
            return json(res, 500, { ok: false, message: 'Could not load the announcement.' });
        }
    }

    if (!['POST', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', 'GET, POST, DELETE');
        return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }
    if (!sameOriginRequest(req)) return json(res, 403, { ok: false, message: 'Request origin was rejected.' });
    if (!hasAdminSession(req)) return json(res, 401, { ok: false, message: 'Sign in as an administrator first.' });

    try {
        if (req.method === 'DELETE') {
            await ref.delete();
            return json(res, 200, { ok: true, announcement: null });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const title = String(body.title || '').trim();
        const message = String(body.message || '').trim();
        const link = safeHttpUrl(String(body.link || '').trim());
        const linkLabel = String(body.linkLabel || 'Learn more').trim();
        const kind = String(body.kind || 'info');

        if (!title || title.length > 80) return json(res, 400, { ok: false, message: 'Title must be 1–80 characters.' });
        if (!message || message.length > 500) return json(res, 400, { ok: false, message: 'Message must be 1–500 characters.' });
        if (link === null) return json(res, 400, { ok: false, message: 'Link must be a valid http or https URL.' });
        if (linkLabel.length > 32) return json(res, 400, { ok: false, message: 'Link label must be 32 characters or fewer.' });
        if (!['info', 'success', 'warning'].includes(kind)) return json(res, 400, { ok: false, message: 'Choose a valid announcement style.' });

        const announcement = { title, message, kind, link, linkLabel: link ? (linkLabel || 'Learn more') : '', enabled: true, updatedAt: Date.now() };
        await ref.set(announcement);
        return json(res, 200, { ok: true, announcement });
    } catch (err) {
        console.error('Could not update announcement:', err);
        return json(res, 500, { ok: false, message: 'Could not update the announcement.' });
    }
}
