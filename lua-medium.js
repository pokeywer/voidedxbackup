let nextJobId = 0;

export const AUTO_LOW_CHAR_THRESHOLD = 10000;

export function resolveObfuscationLevel(source, requestedLevel = 'auto') {
    if (requestedLevel === 'low' || requestedLevel === 'medium') return requestedLevel;
    return source.length > AUTO_LOW_CHAR_THRESHOLD ? 'low' : 'medium';
}

export function obfuscateLua(source, level = 'medium') {
    const presets = { low: 'Weak', medium: 'Medium' };
    const preset = presets[level];
    if (!preset) return Promise.reject(new Error('Choose Auto, Low, or Medium obfuscation.'));

    return new Promise((resolve, reject) => {
        const workerUrl = new URL('./prometheus-engine/assets/prometheus.worker-CXYhVY6S.js', import.meta.url);
        let worker;
        let timeoutId;
        const jobId = `voidedx-${Date.now()}-${++nextJobId}`;

        const finish = (error, output) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (worker) worker.terminate();
            if (error) reject(error);
            else resolve(output);
        };

        try {
            worker = new Worker(workerUrl, { type: 'module' });
            timeoutId = setTimeout(() => finish(new Error('Prometheus took too long to obfuscate this script.')), 120000);
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
            const seed = Math.floor(Math.random() * 2147483646) + 1;
            worker.postMessage({
                id: jobId,
                action: 'obfuscate',
                options: {
                    source,
                    filename: 'vault.lua',
                    preset,
                    luaVersion: 'LuaU',
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
    if (typeof CompressionStream !== 'function') {
        return { encoding: 'identity', value: source };
    }

    const compressed = new Blob([source])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return { encoding: 'gzip-base64', value: btoa(binary) };
}
