import { gunzipSync } from 'node:zlib';

export function getCodeForExecution(vaultData) {
    const source = typeof vaultData.code === 'string' ? vaultData.code : '';
    if (vaultData.obfuscationEnabled !== true || typeof vaultData.obfuscatedCode !== 'string') return source;

    if (vaultData.obfuscatedCodeEncoding === 'gzip-base64') {
        return gunzipSync(Buffer.from(vaultData.obfuscatedCode, 'base64'), { maxOutputLength: 8 * 1024 * 1024 }).toString('utf8');
    }
    if (vaultData.obfuscatedCodeEncoding === 'identity') return vaultData.obfuscatedCode;

    // Older saved vaults do not have a generated delivery copy yet.
    return source;
}
