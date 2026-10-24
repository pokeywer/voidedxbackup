import { gunzipSync } from 'node:zlib';
import { FieldPath } from 'firebase-admin/firestore';
import { db } from './_admin.js';
import { getSourceForEditor } from './_deliveryCode.js';
import { hasAdminSession, sameOriginRequest } from './_adminSession.js';

const PAGE_SIZE = 100;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_ESTIMATE_BYTES = 870 * 1024;
const LEVELS = new Set(['auto', 'low', 'medium', 'high']);

function json(res, status, body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(status).json(body);
}

function queryValue(value) {
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function millis(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    return Number(value) || 0;
}

function listItem(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        title: String(data.title || 'Untitled Vault').slice(0, 80),
        ownerUid: String(data.uid || ''),
        updatedAt: millis(data.updatedAt),
        executions: Math.max(0, Number(data.executions) || 0),
        obfuscationEnabled: data.obfuscationEnabled === true,
        requireKey: data.requireKey === true
    };
}

function decodeSubmittedSource(value, encoding) {
    if (typeof value !== 'string') throw new Error('Source must be text.');
    let source = value;
    if (encoding === 'gzip-base64') {
        source = gunzipSync(Buffer.from(value, 'base64'), { maxOutputLength: MAX_SOURCE_BYTES }).toString('utf8');
    } else if (encoding !== 'identity') {
        throw new Error('Choose a supported source format.');
    }
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) throw new Error('Source is larger than the 2 MiB limit.');
    if (!source.trim()) throw new Error('A vault source cannot be empty.');
    return source;
}

function validateObfuscatedCopy(value, encoding) {
    if (typeof value !== 'string' || !value) throw new Error('Generate the obfuscated execution copy before saving.');
    let output = value;
    if (encoding === 'gzip-base64') {
        output = gunzipSync(Buffer.from(value, 'base64'), { maxOutputLength: MAX_OUTPUT_BYTES }).toString('utf8');
    } else if (encoding !== 'identity') {
        throw new Error('Choose a supported obfuscated script format.');
    }
    if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES) throw new Error('Obfuscated output is larger than the 8 MiB limit.');
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
        if (req.method === 'GET') {
            const id = queryValue(req.query?.id);
            if (id) {
                if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) return json(res, 400, { ok: false, message: 'Choose a valid vault.' });
                const snap = await db.collection('vaults').doc(id).get();
                if (!snap.exists) return json(res, 404, { ok: false, message: 'That vault no longer exists.' });
                const data = snap.data();
                const source = getSourceForEditor(data);
                return json(res, 200, {
                    ok: true,
                    vault: {
                        ...listItem(snap),
                        title: String(data.title || 'Untitled Vault').slice(0, 80),
                        source,
                        obfuscationLevel: LEVELS.has(data.obfuscationLevel) ? data.obfuscationLevel : 'auto',
                        tamperCheckEnabled: data.tamperCheckEnabled === true,
                        vmProtectionEnabled: data.vmProtectionEnabled === true,
                        expandedTransformsEnabled: data.expandedTransformsEnabled === true
                    }
                });
            }

            const cursor = queryValue(req.query?.cursor);
            if (cursor && !/^[A-Za-z0-9_-]{1,150}$/.test(cursor)) return json(res, 400, { ok: false, message: 'Invalid vault-list cursor.' });
            let query = db.collection('vaults')
                .select('title', 'uid', 'updatedAt', 'executions', 'obfuscationEnabled', 'requireKey')
                .orderBy(FieldPath.documentId())
                .limit(PAGE_SIZE);
            if (cursor) query = query.startAfter(cursor);
            const snap = await query.get();
            const items = snap.docs.map(listItem);
            return json(res, 200, { ok: true, items, nextCursor: snap.docs.length === PAGE_SIZE ? snap.docs.at(-1).id : null });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const id = String(body.id || '');
        if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) return json(res, 400, { ok: false, message: 'Choose a valid vault.' });
        const title = String(body.title || '').trim().slice(0, 80) || 'Untitled Vault';
        let source;
        try {
            source = decodeSubmittedSource(body.code, body.codeEncoding);
        } catch (error) {
            return json(res, 400, { ok: false, message: error.message || 'The source could not be read.' });
        }

        const obfuscationEnabled = body.obfuscationEnabled === true;
        const obfuscationLevel = LEVELS.has(body.obfuscationLevel) ? body.obfuscationLevel : 'auto';
        const vmProtectionEnabled = obfuscationEnabled && body.vmProtectionEnabled === true;
        const tamperCheckEnabled = obfuscationEnabled && !vmProtectionEnabled && body.tamperCheckEnabled === true;
        const expandedTransformsEnabled = obfuscationEnabled && !vmProtectionEnabled && body.expandedTransformsEnabled === true;
        let obfuscatedCode = null;
        let obfuscatedCodeEncoding = null;
        let obfuscatedCodeLevel = null;
        if (obfuscationEnabled) {
            try {
                validateObfuscatedCopy(body.obfuscatedCode, body.obfuscatedCodeEncoding);
            } catch (error) {
                return json(res, 400, { ok: false, message: error.message || 'The obfuscated copy could not be read.' });
            }
            obfuscatedCode = body.obfuscatedCode;
            obfuscatedCodeEncoding = body.obfuscatedCodeEncoding;
            obfuscatedCodeLevel = ['low', 'medium', 'high'].includes(body.obfuscatedCodeLevel) ? body.obfuscatedCodeLevel : null;
            if (!obfuscatedCodeLevel) return json(res, 400, { ok: false, message: 'The obfuscation strength is missing.' });
        }

        const ref = db.collection('vaults').doc(id);
        const snap = await ref.get();
        if (!snap.exists) return json(res, 404, { ok: false, message: 'That vault no longer exists.' });
        const codeEncoding = body.codeEncoding;
        const updates = {
            title,
            code: body.code,
            codeEncoding,
            obfuscationEnabled,
            obfuscationProfileVersion: 3,
            obfuscationLevel,
            tamperCheckEnabled,
            vmProtectionEnabled,
            expandedTransformsEnabled,
            obfuscatedCodeLevel,
            obfuscatedCode,
            obfuscatedCodeEncoding,
            updatedAt: Date.now()
        };
        const estimatedDocumentBytes = Buffer.byteLength(JSON.stringify({ ...snap.data(), ...updates }), 'utf8');
        if (estimatedDocumentBytes > MAX_DOCUMENT_ESTIMATE_BYTES) {
            return json(res, 413, { ok: false, message: 'This vault would exceed the safe Firestore document size. Reduce the source or use a lower obfuscation strength.' });
        }

        await ref.update(updates);
        return json(res, 200, { ok: true, updatedAt: updates.updatedAt, obfuscationEnabled, obfuscatedCodeLevel });
    } catch (error) {
        console.error('Admin vault manager request failed:', error);
        return json(res, 500, { ok: false, message: 'Could not load or update vaults.' });
    }
}
