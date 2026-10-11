let nextJobId = 0;
let lastSuccessfulObfuscation = null;

export const AUTO_HIGH_BYTE_THRESHOLD = 10_000;
// Retained aliases for any callers that imported the earlier threshold names.
export const AUTO_LOW_BYTE_THRESHOLD = AUTO_HIGH_BYTE_THRESHOLD;
export const AUTO_LOW_CHAR_THRESHOLD = AUTO_HIGH_BYTE_THRESHOLD;
export const MAX_VAULT_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_OBFUSCATION_SOURCE_BYTES = MAX_VAULT_SOURCE_BYTES;
export const MAX_OBFUSCATED_OUTPUT_BYTES = 8 * 1024 * 1024;

const PRESETS = Object.freeze({ low: 'Weak', medium: 'Medium', high: 'Strong' });
const MIN_JOB_TIMEOUT_MS = 120_000;
const MAX_JOB_TIMEOUT_MS = 900_000;

export function getUtf8ByteLength(value) {
    const text = typeof value === 'string' ? value : String(value ?? '');
    return new TextEncoder().encode(text).byteLength;
}

export function resolveObfuscationLevel(source, requestedLevel = 'auto') {
    if (Object.hasOwn(PRESETS, requestedLevel)) return requestedLevel;
    return getUtf8ByteLength(source) > AUTO_HIGH_BYTE_THRESHOLD ? 'medium' : 'high';
}

export function obfuscateLua(source, level = 'medium', protection = {}) {
    if (typeof source !== 'string') {
        return Promise.reject(new Error('Paste a LuaU script before obfuscating it.'));
    }

    const sourceBytes = getUtf8ByteLength(source);
    if (sourceBytes > MAX_OBFUSCATION_SOURCE_BYTES) {
        return Promise.reject(new Error('This script is over the 2 MiB browser obfuscation limit. Reduce its size or save it without Lua obfuscation.'));
    }

    const preset = PRESETS[level];
    if (!preset) return Promise.reject(new Error('Choose Auto, Low, Medium, or High obfuscation.'));

    const tamperCheck = protection.tamperCheck === true;
    const vmProtection = protection.vmProtection === true;
    if (lastSuccessfulObfuscation?.source === source
        && lastSuccessfulObfuscation.level === level
        && lastSuccessfulObfuscation.tamperCheck === tamperCheck
        && lastSuccessfulObfuscation.vmProtection === vmProtection) {
        return Promise.resolve(lastSuccessfulObfuscation.output);
    }

    return new Promise((resolve, reject) => {
        const workerUrl = new URL('./prometheus-engine/assets/prometheus.worker-CXYhVY6S.js', import.meta.url);
        let worker;
        let timeoutId;
        let settled = false;
        const jobId = `voidedx-${Date.now()}-${++nextJobId}`;
        const timeoutMs = Math.min(MAX_JOB_TIMEOUT_MS, Math.max(MIN_JOB_TIMEOUT_MS, Math.ceil(sourceBytes / 10_240) * 8_000));

        const finish = (error, output) => {
            if (settled) return;
            settled = true;
            if (timeoutId !== undefined) clearTimeout(timeoutId);
            try { worker?.terminate(); } catch {}
            if (error) {
                reject(error);
                return;
            }
            lastSuccessfulObfuscation = { source, level, tamperCheck, vmProtection, output };
            resolve(output);
        };

        try {
            worker = new Worker(workerUrl, { type: 'module' });
            timeoutId = setTimeout(() => finish(new Error('Prometheus timed out. Large scripts can take several minutes; try Medium strength or reduce the script size.')), timeoutMs);
            worker.addEventListener('message', event => {
                const message = event.data;
                if (!message || message.id !== jobId || message.type !== 'result') return;
                if (message.result && message.result.ok && typeof message.result.output === 'string') {
                    finish(null, message.result.output);
                } else {
                    finish(new Error(message.result?.error || 'Prometheus could not obfuscate this script.'));
                }
            });
            worker.addEventListener('error', event => {
                finish(new Error(event.message || 'The Prometheus worker could not start.'));
            }, { once: true });
            worker.addEventListener('messageerror', () => {
                finish(new Error('The Prometheus worker returned data the browser could not read.'));
            }, { once: true });

            const seed = Math.floor(Math.random() * 2_147_483_646) + 1;
            worker.postMessage({
                id: jobId,
                action: 'obfuscate',
                options: {
                    source,
                    filename: 'vault.lua',
                    preset,
                    luaVersion: 'LuaU',
                    tamperCheck,
                    vmProtection,
                    prettyPrint: false,
                    seed
                }
            });
        } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

export async function encodeObfuscatedCode(source) {
    if (typeof source !== 'string') throw new Error('Prometheus returned an invalid script.');

    const sourceBytes = new TextEncoder().encode(source);
    if (sourceBytes.byteLength > MAX_OBFUSCATED_OUTPUT_BYTES) {
        throw new Error('The generated script is larger than the 8 MiB delivery limit. Try Low strength or reduce the source size.');
    }

    return encodeGzipBase64(source, sourceBytes);
}

export async function encodeVaultSource(source) {
    if (typeof source !== 'string') throw new Error('The source script is invalid.');
    const sourceBytes = new TextEncoder().encode(source);
    if (sourceBytes.byteLength > MAX_VAULT_SOURCE_BYTES) {
        throw new Error('This script is over the 2 MiB save limit. Reduce its size before saving.');
    }
    return encodeGzipBase64(source, sourceBytes);
}

export async function decodeVaultSource(value, encoding) {
    if (typeof value !== 'string') throw new Error('The saved source is unavailable.');
    if (!encoding || encoding === 'identity') return value;
    if (encoding !== 'gzip-base64') throw new Error('This vault uses an unsupported source encoding.');
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open compressed vault source.');

    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const decompressed = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'));
    const sourceBytes = new Uint8Array(await new Response(decompressed).arrayBuffer());
    if (sourceBytes.byteLength > MAX_VAULT_SOURCE_BYTES) throw new Error('The saved source exceeds the 2 MiB limit.');
    return new TextDecoder().decode(sourceBytes);
}

async function encodeGzipBase64(source, sourceBytes) {
    if (typeof CompressionStream !== 'function') {
        return { encoding: 'identity', value: source };
    }
    const compressed = new Blob([sourceBytes])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
    return { encoding: 'gzip-base64', value: bytesToBase64(bytes) };
}

function bytesToBase64(bytes) {
    if (typeof btoa !== 'function') throw new Error('This browser cannot encode the generated script for storage.');

    // Keep temporary binary strings small while still producing one valid Base64 value.
    const chunkSize = 0x6000; // Divisible by 3, so only the final chunk can contain padding.
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const binary = String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        chunks.push(btoa(binary));
    }
    return chunks.join('');
}
