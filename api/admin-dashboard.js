import { db } from './_admin.js';
import { hasAdminSession, sameOriginRequest } from './_adminSession.js';

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

export default async function handler(req, res) {
    if (!['GET', 'PATCH'].includes(req.method)) {
        res.setHeader('Allow', 'GET, PATCH');
        return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }
    if (req.method === 'PATCH' && !sameOriginRequest(req)) {
        return json(res, 403, { ok: false, message: 'Request origin was rejected.' });
    }
    if (!hasAdminSession(req)) return json(res, 401, { ok: false, message: 'Your admin session expired. Sign in again.' });

    try {
        if (req.method === 'PATCH') {
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const id = String(body.id || '');
            const status = String(body.status || '');
            if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) return json(res, 400, { ok: false, message: 'Invalid idea request.' });
            if (!['new', 'reviewed'].includes(status)) return json(res, 400, { ok: false, message: 'Choose a valid request status.' });
            await db.collection('feature_requests').doc(id).update({ status, reviewedAt: status === 'reviewed' ? Date.now() : null });
            return json(res, 200, { ok: true });
        }

        const [vaultsSnap, ideasSnap, ideasCountSnap] = await Promise.all([
            db.collection('vaults').select('executions').get(),
            db.collection('feature_requests').orderBy('createdAt', 'desc').limit(50).get(),
            db.collection('feature_requests').count().get()
        ]);
        const totalExecutions = vaultsSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().executions) || 0), 0);
        const ideas = ideasSnap.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.createdAt && typeof data.createdAt.toMillis === 'function'
                ? data.createdAt.toMillis()
                : Number(data.createdAt) || 0;
            return {
                id: doc.id,
                name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 40) : 'Anonymous',
                idea: typeof data.idea === 'string' ? data.idea.slice(0, 1000) : '',
                status: data.status === 'reviewed' ? 'reviewed' : 'new',
                createdAt
            };
        });

        return json(res, 200, {
            ok: true,
            stats: {
                vaults: vaultsSnap.size,
                executions: totalExecutions,
                ideas: ideasCountSnap.data().count
            },
            ideas
        });
    } catch (err) {
        console.error('Admin dashboard request failed:', err);
        return json(res, 500, { ok: false, message: 'Could not load admin data.' });
    }
}
