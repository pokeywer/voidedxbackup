import { isIP } from 'node:net';

const BLOCKED_DOMAINS = [
    'phub.com', 'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com',
    'redtube.com', 'youporn.com', 'tube8.com', 'spankbang.com',
    'porn.com', 'hentaihaven.xxx', 'nhentai.net', 'rule34.xxx', 'chaturbate.com',
    'stripchat.com', 'livejasmin.com', 'xhamsterlive.com', 'camsoda.com'
];

const BLOCKED_HOST_LABELS = new Set(['porn', 'phub', 'xxx', 'hentai', 'xvideos', 'xnxx', 'xhamster', 'adult']);

export function isSafeExternalUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) return false;
    let url;
    try {
        url = new URL(value.trim());
    } catch {
        return false;
    }

    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || isIP(hostname) || hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
    if (/\.(local|internal|test|invalid|onion)$/.test(hostname)) return false;

    const labels = hostname.split('.');
    if (labels.some(label => BLOCKED_HOST_LABELS.has(label))) return false;
    return !BLOCKED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}
