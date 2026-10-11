import { db, FieldValue, getAdminAuth } from './_admin.js';

const MAX_CODE_LENGTH = 40000;
const CATEGORIES = new Set(['Universal', 'Simulator', 'Combat', 'Utility', 'Other']);

function json(res, status, body, cache = 'no-store') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cache);
    return res.status(status).json(body);
}

function clean(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function publicScript(id, data) {
    return {
        id,
        title: clean(data.title, 80) || 'Untitled script',
        description: clean(data.description, 400),
        game: clean(data.game, 80) || 'Any game',
        category: CATEGORIES.has(data.category) ? data.category : 'Other',
        tags: Array.isArray(data.tags) ? data.tags.slice(0, 6).map(tag => clean(tag, 24)).filter(Boolean) : [],
        authorName: clean(data.authorName, 32) || 'Community member',
        createdAt: Number(data.createdAt) || 0,
        updatedAt: Number(data.updatedAt) || Number(data.createdAt) || 0,
        likes: Math.max(0, Number(data.likes) || 0),
        views: Math.max(0, Number(data.views) || 0),
        downloads: Math.max(0, Number(data.downloads) || 0)
    };
}

async function authenticate(req, { requireNamedAccount = true } = {}) {
    const header = String(req.headers.authorization || '');
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    try {
        const decoded = await getAdminAuth().verifyIdToken(match[1]);
        const anonymous = decoded.firebase?.sign_in_provider === 'anonymous';
        if (requireNamedAccount && (anonymous || !decoded.email)) return null;
        return decoded;
    } catch {
        return null;
    }
}

function validId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
}

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const id = clean(req.query?.id, 120);
            if (id) {
                if (!validId(id)) return json(res, 400, { ok: false, message: 'That script link is not valid.' });
                const ref = db.collection('communityScripts').doc(id);
                const snap = await ref.get();
                if (!snap.exists || snap.data().status !== 'approved') {
                    return json(res, 404, { ok: false, message: 'This script is unavailable.' });
                }
                await ref.update({ views: FieldValue.increment(1) });
                const data = snap.data();
                return json(res, 200, { ok: true, script: { ...publicScript(snap.id, data), views: (Number(data.views) || 0) + 1, code: clean(data.code, MAX_CODE_LENGTH) } });
            }

            const mine = req.query?.mine === '1';
            const token = mine ? await authenticate(req) : null;
            if (mine && !token) {
                return json(res, 401, { ok: false, message: 'Sign in with an account to view your uploads.' });
            }
            const source = mine
                ? db.collection('communityScripts').where('ownerUid', '==', token.uid).limit(100)
                : db.collection('communityScripts').where('status', '==', 'approved').limit(100);
            const snapshot = await source.get();
            const scripts = snapshot.docs.map(doc => ({ ...publicScript(doc.id, doc.data()), status: doc.data().status }));
            return json(res, 200, { ok: true, scripts }, mine ? 'private, no-store' : 'public, s-maxage=20, stale-while-revalidate=60');
        }

        if (req.method === 'DELETE') {
            const token = await authenticate(req);
            if (!token) return json(res, 401, { ok: false, message: 'Sign in with your account first.' });
            const id = clean(req.query?.id, 120);
            if (!validId(id)) return json(res, 400, { ok: false, message: 'That script link is not valid.' });
            const ref = db.collection('communityScripts').doc(id);
            const snap = await ref.get();
            if (!snap.exists) return json(res, 404, { ok: false, message: 'This upload could not be found.' });
            if (snap.data().ownerUid !== token.uid) return json(res, 403, { ok: false, message: 'You can only remove your own uploads.' });
            await ref.delete();
            return json(res, 200, { ok: true });
        }

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST, DELETE');
            return json(res, 405, { ok: false, message: 'Method not allowed.' });
        }

        const token = await authenticate(req);
        if (!token) return json(res, 401, { ok: false, message: 'Please sign in with your account to use this feature.' });
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const action = clean(body.action, 20);

        if (action === 'submit') {
            const title = clean(body.title, 80);
            const description = clean(body.description, 400);
            const authorName = clean(body.authorName, 32).replace(/[<>\r\n\u0000-\u001f]/g, '');
            const game = clean(body.game, 80) || 'Any game';
            const category = CATEGORIES.has(body.category) ? body.category : '';
            const code = typeof body.code === 'string' ? body.code.trim() : '';
            const tags = Array.isArray(body.tags)
                ? [...new Set(body.tags.map(tag => clean(tag, 24).replace(/[^\p{L}\p{N} _-]/gu, '')).filter(Boolean))].slice(0, 6)
                : [];
            if (title.length < 3) return json(res, 400, { ok: false, message: 'Give your script a title with at least 3 characters.' });
            if (description.length < 10) return json(res, 400, { ok: false, message: 'Add a short description (at least 10 characters).' });
            if (!category) return json(res, 400, { ok: false, message: 'Choose a category.' });
            if (code.length < 10 || code.length > MAX_CODE_LENGTH) return json(res, 400, { ok: false, message: `Script code must be between 10 and ${MAX_CODE_LENGTH.toLocaleString()} characters.` });
            if (body.acceptedRules !== true) return json(res, 400, { ok: false, message: 'Please confirm the community upload rules.' });

            const now = Date.now();
            const day = new Date(now).toISOString().slice(0, 10);
            const limitRef = db.collection('scriptSubmissionLimits').doc(token.uid);
            const scriptRef = db.collection('communityScripts').doc();
            await db.runTransaction(async tx => {
                const limitSnap = await tx.get(limitRef);
                const limitData = limitSnap.exists ? limitSnap.data() : {};
                const count = limitData.day === day ? Number(limitData.count) || 0 : 0;
                if (count >= 5) throw new Error('You have reached the limit of 5 uploads per day. Try again tomorrow.');
                tx.set(limitRef, { day, count: count + 1, updatedAt: now });
                tx.set(scriptRef, {
                    title, description, game, category, tags, code,
                    authorName: authorName || 'Community member',
                    ownerUid: token.uid,
                    status: 'pending',
                    likes: 0, views: 0, downloads: 0, reports: 0,
                    createdAt: now, updatedAt: now
                });
            });
            return json(res, 201, { ok: true, id: scriptRef.id, status: 'pending' });
        }

        const scriptId = clean(body.scriptId, 120);
        if (!validId(scriptId)) return json(res, 400, { ok: false, message: 'Choose a valid script.' });
        const scriptRef = db.collection('communityScripts').doc(scriptId);
        const scriptSnap = await scriptRef.get();
        if (!scriptSnap.exists || scriptSnap.data().status !== 'approved') {
            return json(res, 404, { ok: false, message: 'This script is unavailable.' });
        }

        if (action === 'like') {
            const likeRef = scriptRef.collection('likes').doc(token.uid);
            const liked = await db.runTransaction(async tx => {
                const [fresh, existing] = await Promise.all([tx.get(scriptRef), tx.get(likeRef)]);
                if (!fresh.exists || fresh.data().status !== 'approved') throw new Error('This script is unavailable.');
                const currentLikes = Math.max(0, Number(fresh.data().likes) || 0);
                if (existing.exists) {
                    tx.delete(likeRef);
                    tx.update(scriptRef, { likes: Math.max(0, currentLikes - 1) });
                    return false;
                }
                tx.set(likeRef, { createdAt: Date.now() });
                tx.update(scriptRef, { likes: currentLikes + 1 });
                return true;
            });
            const fresh = await scriptRef.get();
            return json(res, 200, { ok: true, liked, likes: Math.max(0, Number(fresh.data()?.likes) || 0) });
        }

        if (action === 'report') {
            const reason = clean(body.reason, 300);
            if (reason.length < 8) return json(res, 400, { ok: false, message: 'Tell us a little more (at least 8 characters).' });
            const reportRef = scriptRef.collection('reports').doc(token.uid);
            const created = await db.runTransaction(async tx => {
                const [fresh, existing] = await Promise.all([tx.get(scriptRef), tx.get(reportRef)]);
                if (!fresh.exists || fresh.data().status !== 'approved') throw new Error('This script is unavailable.');
                if (existing.exists) return false;
                tx.set(reportRef, { reason, reporterUid: token.uid, createdAt: Date.now() });
                tx.update(scriptRef, { reports: FieldValue.increment(1) });
                return true;
            });
            return json(res, 200, { ok: true, created, message: created ? 'Thanks. Your report was sent to the moderators.' : 'You already reported this script.' });
        }

        if (action === 'download') {
            await scriptRef.update({ downloads: FieldValue.increment(1) });
            return json(res, 200, { ok: true });
        }

        return json(res, 400, { ok: false, message: 'Choose a supported script action.' });
    } catch (error) {
        if (/limit of 5 uploads/.test(error.message)) return json(res, 429, { ok: false, message: error.message });
        if (/unavailable/.test(error.message)) return json(res, 404, { ok: false, message: error.message });
        console.error('Community scripts request failed:', error);
        return json(res, 500, { ok: false, message: 'Could not complete that scripts request.' });
    }
}
