import { gunzipSync } from 'node:zlib';

const MAX_VAULT_SOURCE_BYTES = 2 * 1024 * 1024;

export function getSourceForEditor(vaultData) {
    const storedSource = typeof vaultData.code === 'string' ? vaultData.code : '';
    if (vaultData.codeEncoding === 'gzip-base64') {
        return gunzipSync(Buffer.from(storedSource, 'base64'), { maxOutputLength: MAX_VAULT_SOURCE_BYTES }).toString('utf8');
    }
    if (vaultData.codeEncoding === 'identity') return storedSource;
    // Older vaults store readable source directly in `code`.
    return storedSource;
}

export function getCodeForExecution(vaultData) {
    if (vaultData.obfuscationEnabled === true && typeof vaultData.obfuscatedCode === 'string') {
        if (vaultData.obfuscatedCodeEncoding === 'gzip-base64') {
            return gunzipSync(Buffer.from(vaultData.obfuscatedCode, 'base64'), { maxOutputLength: 8 * 1024 * 1024 }).toString('utf8');
        }
        if (vaultData.obfuscatedCodeEncoding === 'identity') return vaultData.obfuscatedCode;
    }

    return getSourceForEditor(vaultData);
}
