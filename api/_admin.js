import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Server-only Firestore access. Bypasses security rules, so it must never
// be imported by anything that runs in the browser.
function init() {
    if (getApps().length) return getApps()[0];
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
    const creds = JSON.parse(raw);
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    return initializeApp({ credential: cert(creds) });
}

export const db = getFirestore(init());
export { FieldValue };
export function getAdminAuth() { return getAuth(init()); }
