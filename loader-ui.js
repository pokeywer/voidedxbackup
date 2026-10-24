const LOADER_REFRESH_FALLBACK_MS = 40_000;
const REFRESH_MARGIN_MS = 5_000;

export function startRotatingLoader({ id, key = '', input, status, copyButton }) {
    let stopped = false;
    let paused = false;
    let requesting = false;
    let expiresAt = 0;
    let refreshTimer = 0;
    let countdownTimer = 0;

    const setStatus = message => {
        if (status) status.textContent = message;
    };

    const updateCountdown = () => {
        if (stopped) return;
        const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        if (copyButton && expiresAt) copyButton.disabled = seconds === 0;
        setStatus(seconds
            ? `Current loader expires in ${seconds}s · refreshing automatically`
            : 'Loader expired · refreshing now…');
    };

    async function refresh() {
        if (stopped || paused || requesting) return;
        requesting = true;
        clearTimeout(refreshTimer);
        if (copyButton) copyButton.disabled = true;
        setStatus('Refreshing loader…');
        try {
            const response = await fetch('/api/loader-token', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, key })
            });
            let data = {};
            try { data = await response.json(); } catch {}
            if (!response.ok || !data.ok || typeof data.token !== 'string') {
                const error = new Error(data.message || 'The loader could not be refreshed.');
                error.status = response.status;
                throw error;
            }
            if (stopped) return;

            const rawUrl = new URL('/api/raw', window.location.origin);
            rawUrl.searchParams.set('id', id);
            rawUrl.searchParams.set('token', data.token);
            rawUrl.searchParams.set('format', 'raw');
            if (key) rawUrl.searchParams.set('key', key);
            input.value = `loadstring(game:HttpGet("${rawUrl.href}"))()`;
            if (copyButton) copyButton.disabled = false;
            expiresAt = Number(data.expiresAt) || (Date.now() + 45_000);
            updateCountdown();
            const refreshAfter = Math.max(1_000, Math.min(
                Number(data.refreshAfterMs) || LOADER_REFRESH_FALLBACK_MS,
                expiresAt - Date.now() - REFRESH_MARGIN_MS
            ));
            refreshTimer = window.setTimeout(refresh, refreshAfter);
        } catch (error) {
            if (stopped) return;
            if (error.status === 423) {
                paused = true;
                if (copyButton) copyButton.disabled = true;
                setStatus(error.message);
                return;
            }
            setStatus(`${error.message} Retrying shortly…`);
            refreshTimer = window.setTimeout(refresh, 5_000);
        } finally {
            requesting = false;
        }
    }

    const onVisibilityChange = () => {
        if (!paused && !document.hidden && (!expiresAt || expiresAt - Date.now() <= 10_000)) {
            if (copyButton) copyButton.disabled = true;
            refresh();
        }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    countdownTimer = window.setInterval(updateCountdown, 1_000);
    setStatus('Preparing loader…');
    refresh();

    return () => {
        stopped = true;
        clearTimeout(refreshTimer);
        clearInterval(countdownTimer);
        document.removeEventListener('visibilitychange', onVisibilityChange);
    };
}
