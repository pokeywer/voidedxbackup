import { db } from './_admin.js';
import { hasAdminSession, sameOriginRequest } from './_adminSession.js';

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function safeItem(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        title: String(data.title || '').slice(0, 80),
        description: String(data.description || '').slice(0, 400),
        game: String(data.game || '').slice(0, 80),
        category: String(data.category || 'Other').slice(0, 30),
        authorName: String(data.authorName || 'Community member').slice(0, 32),
        code: String(data.code || '').slice(0, 40000),
        status: String(data.status || 'pending'),
        reports: Math.max(0, Number(data.reports) || 0),
        createdAt: Number(data.createdAt) || 0
    };
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
            if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) return json(res, 400, { ok: false, message: 'Choose a valid script.' });
            if (!['approved', 'rejected', 'hidden'].includes(status)) return json(res, 400, { ok: false, message: 'Choose a valid review action.' });
            const ref = db.collection('communityScripts').doc(id);
            const snap = await ref.get();
            if (!snap.exists) return json(res, 404, { ok: false, message: 'That upload no longer exists.' });
            await ref.update({ status, moderatedAt: Date.now(), moderatedBy: 'admin' });
            return json(res, 200, { ok: true });
        }

        const [pendingSnap, reportedSnap] = await Promise.all([
            db.collection('communityScripts').where('status', '==', 'pending').limit(60).get(),
            db.collection('communityScripts').where('reports', '>', 0).limit(40).get()
        ]);
        const pending = pendingSnap.docs.map(safeItem).sort((a, b) => b.createdAt - a.createdAt);
        const reported = reportedSnap.docs.map(safeItem).filter(item => item.status === 'approved').sort((a, b) => b.reports - a.reports);
        return json(res, 200, { ok: true, pending, reported });
    } catch (error) {
        console.error('Admin script review failed:', error);
        return json(res, 500, { ok: false, message: 'Could not load script reviews.' });
    }
}
