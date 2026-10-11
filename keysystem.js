import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
    getFirestore, doc, getDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {
    getAuth, onAuthStateChanged, signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBdAR4ARjHccTlxrmP9tzdYGJxo4MvETXw",
    authDomain: "voidedx-fe79f.firebaseapp.com",
    projectId: "voidedx-fe79f",
    storageBucket: "voidedx-fe79f.firebasestorage.app",
    messagingSenderId: "784635868195",
    appId: "1:784635868195:web:6e879214df4238bc2aad96"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Resolves with the current Firebase user (signing in anonymously if needed),
// so every visitor has a real UID to compare against the vault's owner.
function waitForUser() {
    return new Promise((resolve, reject) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) { unsub(); resolve(user); return; }
            try { await signInAnonymously(auth); } catch (e) { unsub(); reject(e); }
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span>${message}</span><button class="toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>`;
    const remove = () => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 200); };
    toast.querySelector('.toast-close').addEventListener('click', remove);
    container.appendChild(toast);
    if (duration > 0) setTimeout(remove, duration);
}

function customConfirm({ title, message, confirmLabel = 'Confirm' }) {
    return new Promise(resolve => {
        const ok = window.confirm(`${title}\n\n${message}`);
        resolve(ok);
    });
}

function formatDuration(ms) {
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    return `${h}h ${m}m`;
}

function timeAgo(ts) {
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'moments ago';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function generateRandomKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = 'VX-';
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function isSafeUrl(url) {
    if (!url) return true;
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const vaultId = urlParams.get('id');

    const ksLoading = document.getElementById('ks-loading');
    const ksError = document.getElementById('ks-error');
    const ksErrorText = document.getElementById('ks-error-text');
    const ksContent = document.getElementById('ks-content');
    const ksVaultTitle = document.getElementById('ks-vault-title');

    const chkKeySystem = document.getElementById('chk-key-system');
    const keySystemFields = document.getElementById('key-system-fields');
    const keysList = document.getElementById('keys-list');
    const keysCountBadge = document.getElementById('keys-count-badge');
    const addKeyBtn = document.getElementById('add-key-btn');
    const keyRowTemplate = document.getElementById('key-row-template');
    const chkPublicKey = document.getElementById('chk-public-key');
    const publicKeyFields = document.getElementById('public-key-fields');
    const publicDurationSelect = document.getElementById('public-duration-select');
    const publicDurationCustom = document.getElementById('public-duration-custom');
    const publicMaxUsersInput = document.getElementById('public-maxusers-input');
    const publicUnlimitedToggle = document.getElementById('public-unlimited-toggle');
    const publicAdGateInput = document.getElementById('public-adgate-input');
    const linkvertiseTokenInput = document.getElementById('linkvertise-token-input');
    const saveLinkvertiseTokenBtn = document.getElementById('save-linkvertise-token-btn');
    const linkvertiseTokenStatus = document.getElementById('linkvertise-token-status');
    const publicRegenerateBtn = document.getElementById('public-regenerate-btn');
    const publicTerminateBtn = document.getElementById('public-terminate-btn');
    const publicKeyActions = document.getElementById('public-key-actions');
    const publicKeyStatus = document.getElementById('public-key-status');
    const chkGuiMode = document.getElementById('chk-gui-mode');
    const guiCustomizer = document.getElementById('gui-customizer');
    const guiTitleInput = document.getElementById('gui-title-input');
    const guiSubtitleInput = document.getElementById('gui-subtitle-input');
    const guiButtonInput = document.getElementById('gui-button-input');
    const guiTemplateGrid = document.getElementById('gui-template-grid');
    const guiTemplateSelected = document.getElementById('gui-template-selected');
    const guiTemplateCount = document.getElementById('gui-template-count');
    const guiAccentColor = document.getElementById('gui-accent-color');
    const guiSecondaryColor = document.getElementById('gui-secondary-color');
    const guiBackgroundColor = document.getElementById('gui-background-color');
    const guiTextColor = document.getElementById('gui-text-color');
    const guiPreviewCard = document.getElementById('gui-preview-card');
    const guiPreviewScreen = document.getElementById('gui-preview-screen');
    const guiPreviewAccent = document.getElementById('gui-preview-accent');
    const guiPreviewBadge = document.getElementById('gui-preview-badge');
    const guiPreviewTitle = document.getElementById('gui-preview-title');
    const guiPreviewSubtitle = document.getElementById('gui-preview-subtitle');
    const guiPreviewVaultName = document.getElementById('gui-preview-vault-name');
    const guiPreviewInput = document.getElementById('gui-preview-input');
    const guiPreviewButton = document.getElementById('gui-preview-button');
    const guiPreviewButtonText = document.getElementById('gui-preview-button-text');
    const guiPreviewGetKey = document.getElementById('gui-preview-getkey');
    const guiPreviewClose = document.getElementById('gui-preview-close');
    const guiPreviewStatus = document.getElementById('gui-preview-status');
    const guiPreviewTimer = document.getElementById('gui-preview-timer');
    const guiPreviewClosed = document.getElementById('gui-preview-closed');
    const guiPreviewToggle = document.getElementById('gui-preview-toggle');
    const chkIpLock = document.getElementById('chk-ip-lock');
    const ipLockStatus = document.getElementById('ip-lock-status');
    const ipLockStatusText = document.getElementById('ip-lock-status-text');
    const resetIpBtn = document.getElementById('reset-ip-btn');
    const bannedUsersList = document.getElementById('banned-users-list');
    const bannedCountBadge = document.getElementById('banned-count-badge');
    const manualBanUserId = document.getElementById('manual-ban-userid');
    const manualBanDuration = document.getElementById('manual-ban-duration');
    const manualBanBtn = document.getElementById('manual-ban-btn');
    const keysystemStatus = document.getElementById('keysystem-status');
    const keysystemGetKeyOutput = document.getElementById('keysystem-get-key-output');
    const keysystemCopyKeyLinkBtn = document.getElementById('keysystem-copy-key-link-btn');
    const keysystemApplyBtn = document.getElementById('keysystem-apply-btn');

    if (!vaultId) {
        ksLoading.classList.add('hidden');
        ksErrorText.textContent = 'No vault ID was given in the link.';
        ksError.classList.remove('hidden');
        return;
    }

    // ---------------- Tabs ----------------
    document.querySelectorAll('.ks-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ks-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.ks-tab-panel').forEach(p => p.classList.add('hidden'));
            tab.classList.add('active');
            document.querySelector(`.ks-tab-panel[data-panel="${tab.dataset.tab}"]`).classList.remove('hidden');
        });
    });

    // ---------------- Key list state ----------------
    let currentKeys = [];
    let currentOwnerLegacy = false;
    let currentBannedUsers = [];
    let linkvertiseTokenConfigured = false;

    const defaultGuiAppearance = {
        title: 'VoidedX Key System',
        subtitle: 'Enter your key to continue',
        buttonLabel: 'Submit',
        accentColor: '#06b6d4',
        secondaryColor: '#6366f1',
        backgroundColor: '#0b0d12',
        textColor: '#f8fafc',
        templateId: 'custom'
    };

    const guiTemplates = [
        { id: 'cyber-neon', name: 'Cyber Neon', mood: 'Electric cyan', icon: 'fa-bolt', title: 'VOIDEDX ACCESS', subtitle: 'Enter your key to unlock', buttonLabel: 'VERIFY KEY', accentColor: '#00e5c0', secondaryColor: '#31a8ff', backgroundColor: '#080d16', textColor: '#edfffe' },
        { id: 'ultraviolet', name: 'Ultraviolet', mood: 'Purple haze', icon: 'fa-wand-magic-sparkles', title: 'NOVA ACCESS', subtitle: 'Your next level starts here', buttonLabel: 'UNLOCK ACCESS', accentColor: '#a855f7', secondaryColor: '#ec4899', backgroundColor: '#100b1b', textColor: '#faf5ff' },
        { id: 'arctic', name: 'Arctic Pulse', mood: 'Ice blue', icon: 'fa-snowflake', title: 'ARCTIC KEY SYSTEM', subtitle: 'Enter your key to continue', buttonLabel: 'CONTINUE', accentColor: '#38bdf8', secondaryColor: '#818cf8', backgroundColor: '#07131f', textColor: '#effaff' },
        { id: 'toxic', name: 'Toxic Lime', mood: 'Radioactive green', icon: 'fa-biohazard', title: 'TOXIC ACCESS', subtitle: 'Key required to proceed', buttonLabel: 'ACTIVATE', accentColor: '#a3e635', secondaryColor: '#22c55e', backgroundColor: '#0a1108', textColor: '#f7fee7' },
        { id: 'sunset', name: 'Afterglow', mood: 'Pink to amber', icon: 'fa-sun', title: 'AFTERGLOW ACCESS', subtitle: 'A little light before launch', buttonLabel: 'LET ME IN', accentColor: '#fb7185', secondaryColor: '#f59e0b', backgroundColor: '#190c15', textColor: '#fff1f2' },
        { id: 'royal', name: 'Royal Orbit', mood: 'Regal violet', icon: 'fa-crown', title: 'ROYAL ACCESS', subtitle: 'Enter your private key', buttonLabel: 'VERIFY ACCESS', accentColor: '#8b5cf6', secondaryColor: '#2563eb', backgroundColor: '#0d0b19', textColor: '#f5f3ff' },
        { id: 'crimson', name: 'Crimson Ops', mood: 'Red alert', icon: 'fa-crosshairs', title: 'CRIMSON PROTOCOL', subtitle: 'Authentication required', buttonLabel: 'AUTHORIZE', accentColor: '#f43f5e', secondaryColor: '#fb7185', backgroundColor: '#16090d', textColor: '#fff1f2' },
        { id: 'emerald', name: 'Emerald Core', mood: 'Deep green', icon: 'fa-gem', title: 'EMERALD ACCESS', subtitle: 'Your key opens the door', buttonLabel: 'VERIFY KEY', accentColor: '#10b981', secondaryColor: '#2dd4bf', backgroundColor: '#07140f', textColor: '#ecfdf5' },
        { id: 'gold', name: 'Solar Gold', mood: 'Gold and fire', icon: 'fa-star', title: 'SOLAR ACCESS', subtitle: 'A key is needed to continue', buttonLabel: 'UNLOCK', accentColor: '#fbbf24', secondaryColor: '#f97316', backgroundColor: '#181007', textColor: '#fffbeb' },
        { id: 'sakura', name: 'Sakura Dream', mood: 'Blush pink', icon: 'fa-heart', title: 'SAKURA ACCESS', subtitle: 'Welcome, enter your key', buttonLabel: 'OPEN GATE', accentColor: '#f472b6', secondaryColor: '#c084fc', backgroundColor: '#190d18', textColor: '#fdf2f8' },
        { id: 'ocean', name: 'Ocean Drive', mood: 'Aqua blue', icon: 'fa-water', title: 'OCEAN ACCESS', subtitle: 'Dive in with your key', buttonLabel: 'DIVE IN', accentColor: '#06b6d4', secondaryColor: '#3b82f6', backgroundColor: '#071217', textColor: '#ecfeff' },
        { id: 'stealth', name: 'Stealth Mono', mood: 'Clean monochrome', icon: 'fa-moon', title: 'STEALTH ACCESS', subtitle: 'A quiet place for your key', buttonLabel: 'PROCEED', accentColor: '#94a3b8', secondaryColor: '#e2e8f0', backgroundColor: '#0b0d12', textColor: '#f8fafc' },
        { id: 'aurora', name: 'Aurora Flow', mood: 'Mint and violet', icon: 'fa-wand-sparkles', title: 'AURORA ACCESS', subtitle: 'Enter your key to continue', buttonLabel: 'LIGHT IT UP', accentColor: '#34d399', secondaryColor: '#818cf8', backgroundColor: '#09121a', textColor: '#ecfdf5' },
        { id: 'hologram', name: 'Hologram', mood: 'Prismatic cyan', icon: 'fa-cube', title: 'HOLOGRAM ACCESS', subtitle: 'Identity check required', buttonLabel: 'VERIFY ID', accentColor: '#22d3ee', secondaryColor: '#c084fc', backgroundColor: '#0b0c18', textColor: '#f0fdff' }
    ];
    let selectedGuiTemplate = 'custom';

    function renderGuiTemplateGallery() {
        if (!guiTemplateGrid) return;
        guiTemplateGrid.innerHTML = '';
        guiTemplates.forEach(template => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `gui-template-card${selectedGuiTemplate === template.id ? ' active' : ''}`;
            button.setAttribute('aria-pressed', selectedGuiTemplate === template.id ? 'true' : 'false');
            button.title = `Apply the ${template.name} theme`;
            button.style.setProperty('--template-accent', template.accentColor);
            button.style.setProperty('--template-glow', template.secondaryColor);
            button.innerHTML = `<span class="gui-template-swatch"><i class="fa-solid ${template.icon}"></i></span><span class="gui-template-copybox"><strong>${template.name}</strong><small>${template.mood}</small></span>`;
            button.addEventListener('click', () => {
                guiTitleInput.value = template.title;
                guiSubtitleInput.value = template.subtitle;
                guiButtonInput.value = template.buttonLabel;
                guiAccentColor.value = template.accentColor;
                guiSecondaryColor.value = template.secondaryColor;
                guiBackgroundColor.value = template.backgroundColor;
                guiTextColor.value = template.textColor;
                selectedGuiTemplate = template.id;
                renderGuiTemplateGallery();
                renderGuiPreview();
                resetGuiPreview();
            });
            guiTemplateGrid.appendChild(button);
        });
        if (guiTemplateCount) guiTemplateCount.textContent = `${guiTemplates.length} looks`;
        if (guiTemplateSelected) {
            const selected = guiTemplates.find(template => template.id === selectedGuiTemplate);
            guiTemplateSelected.textContent = selected ? selected.name : 'Custom';
        }
    }

    function renderGuiPreview() {
        const accent = guiAccentColor.value || defaultGuiAppearance.accentColor;
        const glow = guiSecondaryColor.value || defaultGuiAppearance.secondaryColor;
        const gradient = `linear-gradient(135deg, ${accent}, ${glow})`;
        guiPreviewCard.style.backgroundColor = guiBackgroundColor.value || defaultGuiAppearance.backgroundColor;
        guiPreviewCard.style.color = guiTextColor.value || defaultGuiAppearance.textColor;
        guiPreviewCard.style.borderColor = `${accent}66`;
        guiPreviewCard.style.setProperty('--template-accent', accent);
        guiPreviewAccent.style.background = `linear-gradient(90deg, ${accent}, ${glow})`;
        guiPreviewBadge.style.background = gradient;
        guiPreviewButton.style.background = gradient;
        guiPreviewButton.style.boxShadow = `0 6px 16px ${accent}44`;
        guiPreviewVaultName.style.color = accent;
        if (guiPreviewInput) {
            guiPreviewInput.style.borderColor = `${accent}88`;
            guiPreviewInput.style.color = accent;
        }
        guiPreviewTitle.textContent = guiTitleInput.value.trim() || defaultGuiAppearance.title;
        guiPreviewSubtitle.textContent = guiSubtitleInput.value.trim() || defaultGuiAppearance.subtitle;
        guiPreviewButtonText.textContent = guiButtonInput.value.trim() || defaultGuiAppearance.buttonLabel;
    }

    let guiPreviewRun = 0;
    let guiPreviewTimeout;

    function resetGuiPreview() {
        guiPreviewRun++;
        clearTimeout(guiPreviewTimeout);
        guiPreviewScreen.classList.remove('is-closed');
        guiPreviewCard.classList.remove('is-hidden', 'is-entering', 'is-unlocking', 'is-success');
        guiPreviewTimer.classList.add('hidden');
        guiPreviewTimer.classList.remove('is-active');
        guiPreviewClosed.classList.add('hidden');
        guiPreviewStatus.textContent = '';
        guiPreviewStatus.className = 'gui-preview-status';
        guiPreviewButton.classList.remove('is-loading', 'is-success');
        guiPreviewButton.disabled = false;
        guiPreviewGetKey.classList.remove('is-pulse');
        guiPreviewButtonText.textContent = guiButtonInput.value.trim() || defaultGuiAppearance.buttonLabel;
        guiPreviewToggle.innerHTML = '<i class="fa-solid fa-xmark"></i> Close popup';
    }

    function playGuiPreviewEntrance() {
        resetGuiPreview();
        void guiPreviewCard.offsetWidth;
        guiPreviewCard.classList.add('is-entering');
    }

    function closeGuiPreview() {
        guiPreviewRun++;
        clearTimeout(guiPreviewTimeout);
        guiPreviewCard.classList.remove('is-entering', 'is-unlocking');
        guiPreviewCard.classList.add('is-hidden');
        guiPreviewButton.classList.remove('is-loading');
        guiPreviewButton.disabled = false;
        guiPreviewScreen.classList.add('is-closed');
        guiPreviewClosed.classList.remove('hidden');
        guiPreviewTimer.classList.add('hidden');
        guiPreviewToggle.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> Open popup';
    }

    function setGuiPreviewStatus(message, state) {
        guiPreviewStatus.textContent = message;
        guiPreviewStatus.className = `gui-preview-status visible is-${state}`;
    }

    function showGuiPreviewKeyHint() {
        if (guiPreviewCard.classList.contains('is-hidden')) playGuiPreviewEntrance();
        guiPreviewRun++;
        clearTimeout(guiPreviewTimeout);
        guiPreviewButton.disabled = false;
        guiPreviewButton.classList.remove('is-loading', 'is-success');
        guiPreviewButtonText.textContent = guiButtonInput.value.trim() || defaultGuiAppearance.buttonLabel;
        guiPreviewGetKey.classList.remove('is-pulse');
        void guiPreviewGetKey.offsetWidth;
        guiPreviewGetKey.classList.add('is-pulse');
        setGuiPreviewStatus('Get-Key link copied — paste it into your browser.', 'success');
        guiPreviewTimeout = setTimeout(() => guiPreviewGetKey.classList.remove('is-pulse'), 700);
    }

    function simulateGuiPreviewUnlock() {
        if (guiPreviewCard.classList.contains('is-hidden')) playGuiPreviewEntrance();
        guiPreviewRun++;
        const run = guiPreviewRun;
        clearTimeout(guiPreviewTimeout);
        guiPreviewStatus.textContent = '';
        guiPreviewStatus.className = 'gui-preview-status';
        guiPreviewButton.disabled = true;
        guiPreviewButton.classList.add('is-loading');
        guiPreviewButton.classList.remove('is-success');
        guiPreviewButtonText.textContent = 'CHECKING KEY';
        guiPreviewTimeout = setTimeout(() => {
            if (run !== guiPreviewRun) return;
            guiPreviewButton.classList.remove('is-loading');
            guiPreviewButton.classList.add('is-success');
            guiPreviewButtonText.textContent = 'UNLOCKED';
            guiPreviewStatus.className = 'gui-preview-status';
            guiPreviewStatus.textContent = '';
            guiPreviewCard.classList.add('is-success');
            guiPreviewTimeout = setTimeout(() => {
                if (run !== guiPreviewRun) return;
                guiPreviewCard.classList.add('is-hidden');
                guiPreviewTimer.classList.remove('hidden');
                requestAnimationFrame(() => guiPreviewTimer.classList.add('is-active'));
            }, 420);
        }, 850);
    }

    guiPreviewButton.addEventListener('click', simulateGuiPreviewUnlock);
    guiPreviewGetKey.addEventListener('click', showGuiPreviewKeyHint);
    guiPreviewClose.addEventListener('click', closeGuiPreview);
    guiPreviewClosed.addEventListener('click', playGuiPreviewEntrance);
    document.querySelectorAll('[data-gui-preview-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.guiPreviewAction;
            if (action === 'entrance') playGuiPreviewEntrance();
            if (action === 'unlock') simulateGuiPreviewUnlock();
            if (action === 'getkey') showGuiPreviewKeyHint();
            if (action === 'toggle') {
                if (guiPreviewCard.classList.contains('is-hidden')) playGuiPreviewEntrance();
                else closeGuiPreview();
            }
        });
    });

    function markGuiAppearanceCustom() {
        selectedGuiTemplate = 'custom';
        if (guiTemplateSelected) guiTemplateSelected.textContent = 'Custom';
        if (guiTemplateGrid) {
            guiTemplateGrid.querySelectorAll('.gui-template-card').forEach(button => {
                button.classList.remove('active');
                button.setAttribute('aria-pressed', 'false');
            });
        }
        renderGuiPreview();
        resetGuiPreview();
    }

    function setGuiCustomizerVisible() {
        guiCustomizer.classList.toggle('hidden', !chkGuiMode.checked);
    }

    async function loadLinkvertiseConfig() {
        try {
            const user = auth.currentUser || await waitForUser();
            const response = await fetch(`/api/linkvertise-config?id=${encodeURIComponent(vaultId)}`, {
                headers: { Authorization: `Bearer ${await user.getIdToken()}` }
            });
            const data = await response.json();
            if (!data.ok) throw new Error(data.message || 'Could not load Linkvertise settings.');
            linkvertiseTokenConfigured = !!data.configured;
            linkvertiseTokenStatus.textContent = linkvertiseTokenConfigured
                ? 'Anti-Bypass token saved securely on the server.'
                : 'No token saved. Ad-gate links stay disabled until you save one.';
        } catch (err) {
            linkvertiseTokenConfigured = false;
            linkvertiseTokenStatus.textContent = err.message || 'Could not load Linkvertise settings.';
        }
    }

    saveLinkvertiseTokenBtn.addEventListener('click', async () => {
        const token = linkvertiseTokenInput.value.trim();
        if (!/^[a-f0-9]{64}$/i.test(token)) {
            showToast('Paste the 64-character Anti-Bypass token from Linkvertise.', 'error');
            return;
        }
        saveLinkvertiseTokenBtn.disabled = true;
        try {
            const user = auth.currentUser || await waitForUser();
            const response = await fetch(`/api/linkvertise-config?id=${encodeURIComponent(vaultId)}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${await user.getIdToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            if (!data.ok) throw new Error(data.message || 'Could not save the token.');
            linkvertiseTokenConfigured = true;
            linkvertiseTokenInput.value = '';
            linkvertiseTokenStatus.textContent = 'Anti-Bypass token saved securely on the server.';
            showToast('Linkvertise verification token saved.', 'success');
        } catch (err) {
            showToast(err.message || 'Could not save the token.', 'error', 6000);
        } finally {
            saveLinkvertiseTokenBtn.disabled = false;
        }
    });

    renderGuiTemplateGallery();
    [guiTitleInput, guiSubtitleInput, guiButtonInput, guiAccentColor, guiSecondaryColor, guiBackgroundColor, guiTextColor]
        .forEach(input => input.addEventListener('input', markGuiAppearanceCustom));
    chkGuiMode.addEventListener('change', () => {
        setGuiCustomizerVisible();
        renderGuiPreview();
    });

    chkKeySystem.addEventListener('change', () => {
        keySystemFields.classList.toggle('hidden', !chkKeySystem.checked);
        updateKeysystemBadge();
    });

    function updateKeysystemBadge() {
        keysCountBadge.textContent = String(currentKeys.length);
        keysCountBadge.classList.toggle('hidden', currentKeys.length === 0);
    }

    function newKeyObject(label) {
        return {
            id: 'k_' + Math.random().toString(36).substring(2, 10),
            label: label || (currentKeys.length === 0 ? 'Main Key' : `Key ${currentKeys.length + 1}`),
            key: generateRandomKey(),
            priority: currentKeys.length + 1,
            durationDays: null,
            keyGeneratedAt: Date.now(),
            maxUsers: 1,
            maxUsersUnlimited: false,
            boundUsers: [],
            terminated: false
        };
    }

    function formatKeyStatus(k) {
        const parts = [];
        if (k.terminated) {
            parts.push('TERMINATED — this key no longer works until reactivated.');
        } else if (!k.durationDays) {
            parts.push('Permanent — never expires on its own.');
        } else if (!k.keyGeneratedAt) {
            parts.push(`Set to expire ${k.durationDays} day${k.durationDays > 1 ? 's' : ''} after you Apply.`);
        } else {
            const expiresAt = k.keyGeneratedAt + k.durationDays * 86400000;
            const msLeft = expiresAt - Date.now();
            parts.push(msLeft > 0 ? `Expires in ${formatDuration(msLeft)}.` : 'This key has expired.');
        }
        const boundCount = Array.isArray(k.boundUsers) ? k.boundUsers.length : 0;
        parts.push(k.maxUsersUnlimited
            ? `${boundCount} player${boundCount === 1 ? '' : 's'} used so far — unlimited allowed.`
            : `${boundCount} / ${k.maxUsers} player slot${k.maxUsers === 1 ? '' : 's'} used.`);
        return parts.join(' ');
    }

    function renderKeysList() {
        keysList.innerHTML = '';
        if (currentKeys.length === 0) {
            keysList.innerHTML = '<div class="info-box"><p>No keys yet — add one below.</p></div>';
            updateKeysystemBadge();
            return;
        }
        const sorted = [...currentKeys].sort((a, b) => (a.priority || 0) - (b.priority || 0));

        sorted.forEach(k => {
            const node = keyRowTemplate.content.firstElementChild.cloneNode(true);
            node.dataset.keyId = k.id;
            node.classList.toggle('key-card-terminated', !!k.terminated);

            node.querySelector('.key-priority-input').value = k.priority || 1;
            node.querySelector('.key-label-input').value = k.label;
            node.querySelector('.key-value-input').value = k.key;

            const durationSelect = node.querySelector('.key-duration-select');
            const durationCustom = node.querySelector('.key-duration-custom');
            const presetDays = [1, 3, 7, 14, 30];
            if (!k.durationDays) {
                durationSelect.value = 'permanent';
                durationCustom.classList.add('hidden');
            } else if (presetDays.includes(k.durationDays)) {
                durationSelect.value = String(k.durationDays);
                durationCustom.classList.add('hidden');
            } else {
                durationSelect.value = 'custom';
                durationCustom.value = k.durationDays;
                durationCustom.classList.remove('hidden');
            }

            node.querySelector('.key-maxusers-input').value = k.maxUsers || 1;
            node.querySelector('.key-maxusers-input').disabled = !!k.maxUsersUnlimited;
            node.querySelector('.key-unlimited-toggle').checked = !!k.maxUsersUnlimited;
            node.querySelector('.key-card-status').textContent = formatKeyStatus(k);
            node.querySelector('.key-terminate-btn').innerHTML = k.terminated
                ? '<i class="fa-solid fa-rotate-left"></i>'
                : '<i class="fa-solid fa-ban"></i>';
            node.querySelector('.key-terminate-btn').title = k.terminated ? 'Reactivate' : 'Terminate';

            node.querySelector('.key-priority-input').addEventListener('change', (e) => {
                k.priority = parseInt(e.target.value, 10) || 1;
            });
            node.querySelector('.key-label-input').addEventListener('input', (e) => { k.label = e.target.value; });
            node.querySelector('.key-value-input').addEventListener('input', (e) => { k.key = e.target.value; });
            durationSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val === 'permanent') {
                    k.durationDays = null;
                    durationCustom.classList.add('hidden');
                } else if (val === 'custom') {
                    durationCustom.classList.remove('hidden');
                    durationCustom.focus();
                    k.durationDays = parseInt(durationCustom.value, 10) || null;
                } else {
                    k.durationDays = parseInt(val, 10);
                    durationCustom.classList.add('hidden');
                }
                node.querySelector('.key-card-status').textContent = formatKeyStatus(k);
            });
            durationCustom.addEventListener('input', (e) => {
                k.durationDays = parseInt(e.target.value, 10) || null;
                node.querySelector('.key-card-status').textContent = formatKeyStatus(k);
            });

            node.querySelector('.key-maxusers-input').addEventListener('input', (e) => {
                k.maxUsers = Math.max(1, parseInt(e.target.value, 10) || 1);
                node.querySelector('.key-card-status').textContent = formatKeyStatus(k);
            });
            node.querySelector('.key-unlimited-toggle').addEventListener('change', (e) => {
                k.maxUsersUnlimited = e.target.checked;
                node.querySelector('.key-maxusers-input').disabled = k.maxUsersUnlimited;
                node.querySelector('.key-card-status').textContent = formatKeyStatus(k);
            });

            node.querySelector('.key-generate-btn').addEventListener('click', () => {
                k.key = generateRandomKey();
                node.querySelector('.key-value-input').value = k.key;
                showToast('Random key generated.', 'success', 2000);
            });
            node.querySelector('.key-extend-btn').addEventListener('click', () => {
                k.keyGeneratedAt = Date.now();
                node.querySelector('.key-card-status').textContent = formatKeyStatus(k);
                showToast('Timer restarted from now — click "Apply Changes" to confirm.', 'info', 3000);
            });
            node.querySelector('.key-regenerate-btn').addEventListener('click', async () => {
                const confirmed = await customConfirm({ title: 'Regenerate this key?', message: 'The old key stops working once you Apply.', confirmLabel: 'Regenerate' });
                if (!confirmed) return;
                k.key = generateRandomKey();
                k.keyGeneratedAt = Date.now();
                node.querySelector('.key-value-input').value = k.key;
                node.querySelector('.key-card-status').textContent = formatKeyStatus(k);
                showToast('New key generated — click "Apply Changes" to confirm it.', 'info', 3500);
            });
            node.querySelector('.key-terminate-btn').addEventListener('click', async () => {
                if (k.terminated) {
                    k.terminated = false;
                    renderKeysList();
                    showToast('Key reactivated — click "Apply Changes" to confirm.', 'info', 3000);
                    return;
                }
                const confirmed = await customConfirm({ title: 'Terminate this key?', message: `"${k.label || 'This key'}" stops working for everyone once you Apply.`, confirmLabel: 'Terminate' });
                if (!confirmed) return;
                k.terminated = true;
                renderKeysList();
                showToast('Key terminated — click "Apply Changes" to confirm.', 'info', 3500);
            });
            node.querySelector('.key-delete-btn').addEventListener('click', async () => {
                const confirmed = await customConfirm({ title: 'Delete this key?', message: `"${k.label || 'This key'}" will stop working once you Apply.`, confirmLabel: 'Delete' });
                if (!confirmed) return;
                currentKeys = currentKeys.filter(item => item.id !== k.id);
                renderKeysList();
                showToast('Key removed — click "Apply Changes" to confirm.', 'info', 3000);
            });

            renderKeyBoundUsers(node, k);
            keysList.appendChild(node);
        });
        updateKeysystemBadge();
    }

    function renderKeyBoundUsers(node, k) {
        const container = node.querySelector('.key-bound-users-list');
        const boundUsers = Array.isArray(k.boundUsers) ? k.boundUsers : [];
        if (boundUsers.length === 0) {
            container.innerHTML = '<div class="info-box"><p>No one has used this key yet.</p></div>';
            return;
        }
        container.innerHTML = '';
        boundUsers.forEach(u => {
            const row = document.createElement('div');
            row.className = 'manage-user-row';
            row.innerHTML = `
                <div class="manage-user-info">
                    <span class="manage-user-name"><i class="fa-solid fa-user text-cyan"></i> ${escapeHtml(u.username || 'Unknown')}</span>
                    <span class="manage-user-meta">UserId: ${escapeHtml(String(u.userId))} • ${escapeHtml(timeAgo(u.boundAt))}</span>
                </div>
                <div class="key-bound-user-actions">
                    <button class="btn-ghost kick-user-btn"><i class="fa-solid fa-user-slash"></i> Kick</button>
                    <button class="btn-danger ban-user-btn"><i class="fa-solid fa-gavel"></i> Ban</button>
                </div>
            `;
            row.querySelector('.kick-user-btn').addEventListener('click', () => {
                k.boundUsers = boundUsers.filter(item => String(item.userId) !== String(u.userId));
                renderKeysList();
                showToast('Removed — click "Apply Changes" to confirm.', 'info', 3000);
            });
            row.querySelector('.ban-user-btn').addEventListener('click', () => {
                manualBanUserId.value = String(u.userId);
                document.querySelector('.ks-tab[data-tab="security"]').click();
                manualBanUserId.scrollIntoView({ behavior: 'smooth', block: 'center' });
                manualBanUserId.focus();
                showToast(`Pick a duration and click Ban to block ${u.username || 'this user'}.`, 'info', 4000);
            });
            container.appendChild(row);
        });
    }

    addKeyBtn.addEventListener('click', () => {
        currentKeys.push(newKeyObject());
        renderKeysList();
    });

    // ---------------- Public Key section ----------------
    chkPublicKey.addEventListener('change', () => {
        publicKeyFields.classList.toggle('hidden', !chkPublicKey.checked);
    });
    publicDurationSelect.addEventListener('change', (e) => {
        publicDurationCustom.classList.toggle('hidden', e.target.value !== 'custom');
    });
    publicUnlimitedToggle.addEventListener('change', (e) => {
        publicMaxUsersInput.disabled = e.target.checked;
    });

    function renderPublicKeyStatus(entry) {
        if (!chkPublicKey.checked) { publicKeyStatus.textContent = ''; return; }
        if (publicAdGateInput.value.trim()) {
            publicKeyActions.classList.add('hidden');
            publicKeyStatus.textContent = 'With Ad-Gate enabled, each successfully verified Linkvertise completion issues a new random key. Reusing the same completion proof cannot issue another.';
            return;
        }
        publicKeyActions.classList.remove('hidden');
        if (!entry) {
            publicKeyStatus.textContent = 'No key generated yet — the first visitor to use the Get-Key link creates one.';
            return;
        }
        const parts = [];
        if (entry.terminated) {
            parts.push('TERMINATED — this key no longer works until regenerated.');
        } else if (!entry.durationDays) {
            parts.push('Current key is permanent — never expires on its own.');
        } else if (entry.keyGeneratedAt) {
            const msLeft = (entry.keyGeneratedAt + entry.durationDays * 86400000) - Date.now();
            parts.push(msLeft > 0 ? `Current key expires in ${formatDuration(msLeft)}.` : 'Current key has expired — a new one generates on next visit.');
        }
        const boundCount = Array.isArray(entry.boundUsers) ? entry.boundUsers.length : 0;
        parts.push(entry.maxUsersUnlimited
            ? `${boundCount} player${boundCount === 1 ? '' : 's'} have used it so far.`
            : `${boundCount} / ${entry.maxUsers} player slot${entry.maxUsers === 1 ? '' : 's'} used.`);
        publicKeyStatus.textContent = parts.join(' ');
    }

    publicRegenerateBtn.addEventListener('click', async () => {
        const confirmed = await customConfirm({ title: 'Force regenerate the public key?', message: 'The current public key stops working immediately. The next visitor gets a new one.', confirmLabel: 'Regenerate' });
        if (!confirmed) return;
        try {
            const snap = await getDoc(doc(db, "vaults", vaultId));
            const data = snap.data();
            const updatedKeys = (Array.isArray(data.keys) ? data.keys : []).filter(k => k.id !== 'k_public');
            await updateDoc(doc(db, "vaults", vaultId), { keys: updatedKeys });
            showToast('Public key cleared — a new one will be generated on next visit.', 'success');
            await loadVault();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    });

    publicTerminateBtn.addEventListener('click', async () => {
        try {
            const snap = await getDoc(doc(db, "vaults", vaultId));
            const data = snap.data();
            const keys = Array.isArray(data.keys) ? data.keys : [];
            const idx = keys.findIndex(k => k.id === 'k_public');
            if (idx === -1) { showToast('No public key exists yet to terminate.', 'info'); return; }
            const nowTerminated = !keys[idx].terminated;
            const updatedKeys = keys.map((k, i) => i === idx ? { ...k, terminated: nowTerminated } : k);
            await updateDoc(doc(db, "vaults", vaultId), { keys: updatedKeys });
            showToast(nowTerminated ? 'Public key terminated.' : 'Public key reactivated.', 'success');
            await loadVault();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        }
    });

    // ---------------- Banned users ----------------
    function renderBannedUsersList() {
        bannedCountBadge.textContent = String(currentBannedUsers.length);
        bannedCountBadge.classList.toggle('hidden', currentBannedUsers.length === 0);
        if (currentBannedUsers.length === 0) {
            bannedUsersList.innerHTML = '<div class="info-box"><p>No one is banned from this vault.</p></div>';
            return;
        }
        bannedUsersList.innerHTML = '';
        currentBannedUsers.forEach(b => {
            const isExpired = b.bannedUntil && b.bannedUntil <= Date.now();
            const remaining = b.bannedUntil ? formatDuration(b.bannedUntil - Date.now()) : null;
            const row = document.createElement('div');
            row.className = 'manage-user-row';
            row.innerHTML = `
                <div class="manage-user-info">
                    <span class="manage-user-name"><i class="fa-solid fa-gavel text-red"></i> ${escapeHtml(b.username || 'Unknown')}</span>
                    <span class="manage-user-meta">UserId: ${escapeHtml(String(b.userId))} • ${isExpired ? 'Ban expired' : (b.bannedUntil ? `${escapeHtml(remaining)} left` : 'Permanent')}</span>
                </div>
                <button class="btn-ghost unban-btn"><i class="fa-solid fa-check"></i> Unban</button>
            `;
            row.querySelector('.unban-btn').addEventListener('click', () => unbanUser(b.userId));
            bannedUsersList.appendChild(row);
        });
    }

    async function unbanUser(userId) {
        try {
            currentBannedUsers = currentBannedUsers.filter(b => String(b.userId) !== String(userId));
            await updateDoc(doc(db, "vaults", vaultId), { bannedUsers: currentBannedUsers });
            renderBannedUsersList();
            showToast('User unbanned.', 'success');
        } catch (err) {
            showToast('Failed to unban: ' + err.message, 'error');
        }
    }

    manualBanBtn.addEventListener('click', async () => {
        const userId = manualBanUserId.value.trim();
        if (!userId) {
            showToast('Enter a Roblox UserId to ban.', 'error');
            manualBanUserId.focus();
            return;
        }
        const durationVal = manualBanDuration.value;
        const bannedUntil = durationVal === 'permanent' ? null : Date.now() + parseInt(durationVal, 10) * 86400000;

        const originalHtml = manualBanBtn.innerHTML;
        manualBanBtn.disabled = true;
        manualBanBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            currentBannedUsers = currentBannedUsers.filter(b => String(b.userId) !== userId);
            currentBannedUsers.push({ userId, username: 'Unknown', bannedAt: Date.now(), bannedUntil });
            await updateDoc(doc(db, "vaults", vaultId), { bannedUsers: currentBannedUsers });
            renderBannedUsersList();
            manualBanUserId.value = '';
            showToast('User banned.', 'success');
        } catch (err) {
            showToast('Failed to ban: ' + err.message, 'error');
        } finally {
            manualBanBtn.disabled = false;
            manualBanBtn.innerHTML = originalHtml;
        }
    });

    resetIpBtn.addEventListener('click', async () => {
        const confirmed = await customConfirm({ title: 'Reset the bound IP?', message: 'The next person to use this key will lock it to their IP instead.', confirmLabel: 'Reset IP' });
        if (!confirmed) return;
        try {
            await updateDoc(doc(db, "vaults", vaultId), { boundIp: null });
            showToast('Bound IP reset.', 'success');
            loadVault();
        } catch (err) {
            showToast('Failed to reset IP: ' + err.message, 'error');
        }
    });

    keysystemCopyKeyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(keysystemGetKeyOutput.value);
        keysystemCopyKeyLinkBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        showToast('Get-Key link copied.', 'success', 2000);
        setTimeout(() => keysystemCopyKeyLinkBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy', 2000);
    });

    // ---------------- Load / migrate vault data ----------------
    function keysFromVaultData(data) {
        // Only private/whitelist keys live in the manual list now — the public
        // key (id "k_public") is auto-generated and managed in its own section.
        if (Array.isArray(data.keys) && data.keys.length > 0) {
            return data.keys
                .filter(k => k.id !== 'k_public' && k.visibility !== 'public')
                .map((k, i) => ({
                    id: k.id || ('k_' + Math.random().toString(36).substring(2, 10)),
                    label: k.label || 'Key',
                    key: k.key || '',
                    priority: k.priority || (i + 1),
                    durationDays: k.durationDays != null ? k.durationDays : null,
                    keyGeneratedAt: k.keyGeneratedAt || null,
                    maxUsers: k.maxUsers || 1,
                    maxUsersUnlimited: k.maxUsersUnlimited === true || k.maxUsers === 'unlimited',
                    boundUsers: Array.isArray(k.boundUsers) ? k.boundUsers : [],
                    terminated: !!k.terminated
                }));
        }
        if (data.requireKey && data.key) {
            return [{
                id: 'k_legacy', label: 'Main Key', key: data.key, priority: 1,
                durationDays: null, keyGeneratedAt: data.keyGeneratedAt || null,
                maxUsers: data.maxUsers || 1, maxUsersUnlimited: !data.accountBinding,
                boundUsers: Array.isArray(data.boundUsers) ? data.boundUsers : [],
                terminated: false
            }];
        }
        return [];
    }

    function getPublicKeyEntry(data) {
        return (Array.isArray(data.keys) ? data.keys : []).find(k => k.id === 'k_public') || null;
    }

    async function loadVault() {
        try {
            const snap = await getDoc(doc(db, "vaults", vaultId));
            if (!snap.exists()) {
                ksLoading.classList.add('hidden');
                ksErrorText.textContent = "This vault doesn't exist or may have been deleted.";
                ksError.classList.remove('hidden');
                return;
            }
            const data = snap.data();

            // Ownership gate: only the vault's owner (or anyone, for old pre-UID
            // "guest" vaults) may see or change its keys.
            const user = await waitForUser();
            if (data.uid !== user.uid && data.uid !== 'guest') {
                ksLoading.classList.add('hidden');
                ksErrorText.textContent = "Access denied — this vault belongs to a different account.";
                ksError.classList.remove('hidden');
                return;
            }
            await loadLinkvertiseConfig();
            currentOwnerLegacy = data.uid === 'guest';
            ksVaultTitle.textContent = data.title || 'Untitled Vault';
            guiPreviewVaultName.textContent = `Vault: ${ksVaultTitle.textContent}`;

            chkKeySystem.checked = !!data.requireKey;
            keySystemFields.classList.toggle('hidden', !data.requireKey);
            currentKeys = keysFromVaultData(data);
            renderKeysList();

            const cfg = data.publicKeyConfig || {};
            chkPublicKey.checked = !!cfg.enabled;
            publicKeyFields.classList.toggle('hidden', !cfg.enabled);
            const presetDays = [1, 3, 7, 14, 30];
            if (!cfg.durationDays) {
                publicDurationSelect.value = 'permanent';
                publicDurationCustom.classList.add('hidden');
            } else if (presetDays.includes(cfg.durationDays)) {
                publicDurationSelect.value = String(cfg.durationDays);
                publicDurationCustom.classList.add('hidden');
            } else {
                publicDurationSelect.value = 'custom';
                publicDurationCustom.value = cfg.durationDays;
                publicDurationCustom.classList.remove('hidden');
            }
            publicMaxUsersInput.value = cfg.maxUsers || 1;
            publicMaxUsersInput.disabled = !!cfg.maxUsersUnlimited;
            publicUnlimitedToggle.checked = !!cfg.maxUsersUnlimited;
            publicAdGateInput.value = cfg.adGateUrl || '';
            renderPublicKeyStatus(getPublicKeyEntry(data));

            chkGuiMode.checked = !!data.guiMode;
            const appearance = { ...defaultGuiAppearance, ...(data.guiAppearance || {}) };
            selectedGuiTemplate = guiTemplates.some(template => template.id === appearance.templateId) ? appearance.templateId : 'custom';
            guiTitleInput.value = appearance.title;
            guiSubtitleInput.value = appearance.subtitle;
            guiButtonInput.value = appearance.buttonLabel;
            guiAccentColor.value = appearance.accentColor;
            guiSecondaryColor.value = appearance.secondaryColor;
            guiBackgroundColor.value = appearance.backgroundColor;
            guiTextColor.value = appearance.textColor;
            setGuiCustomizerVisible();
            renderGuiTemplateGallery();
            renderGuiPreview();
            chkIpLock.checked = !!data.ipLock;

            currentBannedUsers = Array.isArray(data.bannedUsers) ? data.bannedUsers : [];
            renderBannedUsersList();

            if (data.ipLock) {
                ipLockStatus.classList.remove('hidden');
                if (data.boundIp) {
                    ipLockStatusText.textContent = `Locked to IP: ${data.boundIp}`;
                    resetIpBtn.classList.remove('hidden');
                } else {
                    ipLockStatusText.textContent = 'Not bound to any IP yet — the next person to use this key locks it in.';
                    resetIpBtn.classList.add('hidden');
                }
            } else {
                ipLockStatus.classList.add('hidden');
                resetIpBtn.classList.add('hidden');
            }

            keysystemGetKeyOutput.value = `${window.location.origin}/key.html?id=${vaultId}`;
            keysystemStatus.innerHTML = (!data.requireKey || currentKeys.length === 0)
                ? '<i class="fa-solid fa-circle-info text-cyan"></i><p>Key system is currently off, or has no keys yet.</p>'
                : `<i class="fa-solid fa-circle-check text-success"></i><p>${currentKeys.length} key${currentKeys.length > 1 ? 's are' : ' is'} active. Visitors pick any working public key from the Get-Key link.</p>`;

            updateKeysystemBadge();
            ksLoading.classList.add('hidden');
            ksContent.classList.remove('hidden');
        } catch (err) {
            ksLoading.classList.add('hidden');
            ksErrorText.textContent = 'Something went wrong loading this vault: ' + err.message;
            ksError.classList.remove('hidden');
        }
    }

    keysystemApplyBtn.addEventListener('click', async () => {
        if (chkKeySystem.checked && currentKeys.length === 0 && !chkPublicKey.checked) {
            showToast('Add a private key or enable the Public Key, or turn the key system off.', 'error');
            return;
        }
        if (chkKeySystem.checked && currentKeys.some(k => !k.key.trim())) {
            showToast('One of your keys is empty — fill it in or delete that key.', 'error');
            return;
        }
        if (chkKeySystem.checked && chkPublicKey.checked && !isSafeUrl(publicAdGateInput.value.trim())) {
            showToast('The public key ad-gate link looks invalid — only http/https links are allowed.', 'error', 5000);
            return;
        }
        if (chkKeySystem.checked && chkPublicKey.checked && publicAdGateInput.value.trim() && !linkvertiseTokenConfigured) {
            showToast('Save your Linkvertise Anti-Bypass token before applying an ad-gate link.', 'error', 6000);
            return;
        }

        const requireKey = chkKeySystem.checked;
        const guiMode = requireKey && chkGuiMode.checked;
        const ipLock = requireKey && chkIpLock.checked;
        const guiAppearance = {
            title: guiTitleInput.value.trim().slice(0, 40) || defaultGuiAppearance.title,
            subtitle: guiSubtitleInput.value.trim().slice(0, 64) || defaultGuiAppearance.subtitle,
            buttonLabel: guiButtonInput.value.trim().slice(0, 20) || defaultGuiAppearance.buttonLabel,
            accentColor: guiAccentColor.value,
            secondaryColor: guiSecondaryColor.value,
            backgroundColor: guiBackgroundColor.value,
            textColor: guiTextColor.value,
            templateId: selectedGuiTemplate
        };
        const privateKeysPayload = requireKey ? currentKeys.map(k => ({
            id: k.id, label: k.label.trim() || 'Key', key: k.key.trim(),
            priority: k.priority || 1, durationDays: k.durationDays || null,
            keyGeneratedAt: k.keyGeneratedAt || Date.now(),
            maxUsers: Math.max(1, k.maxUsers || 1), maxUsersUnlimited: !!k.maxUsersUnlimited,
            boundUsers: Array.isArray(k.boundUsers) ? k.boundUsers : [],
            terminated: !!k.terminated, visibility: 'private'
        })) : [];

        const publicDurationVal = publicDurationSelect.value;
        const publicKeyConfig = {
            enabled: requireKey && chkPublicKey.checked,
            label: 'Public Key',
            durationDays: publicDurationVal === 'permanent' ? null
                : publicDurationVal === 'custom' ? (parseInt(publicDurationCustom.value, 10) || null)
                : parseInt(publicDurationVal, 10),
            maxUsers: Math.max(1, parseInt(publicMaxUsersInput.value, 10) || 1),
            maxUsersUnlimited: !!publicUnlimitedToggle.checked,
            adGateUrl: publicAdGateInput.value.trim()
        };

        const originalHtml = keysystemApplyBtn.innerHTML;
        keysystemApplyBtn.disabled = true;
        keysystemApplyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying...';

        try {
            const existingSnap = await getDoc(doc(db, "vaults", vaultId));
            const existing = existingSnap.exists() ? existingSnap.data() : {};
            const boundIp = ipLock ? (existing.boundIp || null) : null;

            // Preserve the live auto-generated public key entry as-is — it's
            // managed by Regenerate/Terminate, not rebuilt here.
            const existingPublicEntry = (Array.isArray(existing.keys) ? existing.keys : []).find(k => k.id === 'k_public');
            const keysPayload = existingPublicEntry ? [...privateKeysPayload, existingPublicEntry] : privateKeysPayload;
            const primaryKey = privateKeysPayload[0] || null;

            await updateDoc(doc(db, "vaults", vaultId), {
                requireKey, guiMode, guiAppearance, keys: keysPayload, publicKeyConfig,
                key: primaryKey ? primaryKey.key : '',
                keyGeneratedAt: primaryKey ? primaryKey.keyGeneratedAt : null,
                ipLock, boundIp,
                ...(currentOwnerLegacy && auth.currentUser ? { uid: auth.currentUser.uid } : {})
            });

            showToast('Key settings updated!', 'success');
            await loadVault();
        } catch (err) {
            showToast('Failed to update key settings: ' + err.message, 'error', 6000);
        } finally {
            keysystemApplyBtn.disabled = false;
            keysystemApplyBtn.innerHTML = originalHtml;
        }
    });

    loadVault();
});
