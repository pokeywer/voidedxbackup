import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously,
    GoogleAuthProvider, signInWithPopup, linkWithPopup, signInWithCredential
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
    getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, serverTimestamp, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// --- YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
    apiKey: "AIzaSyBdAR4ARjHccTlxrmP9tzdYGJxo4MvETXw",
    authDomain: "voidedx-fe79f.firebaseapp.com",
    projectId: "voidedx-fe79f",
    storageBucket: "voidedx-fe79f.firebasestorage.app",
    messagingSenderId: "784635868195",
    appId: "1:784635868195:web:6e879214df4238bc2aad96"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let isSignUpMode = false;
const ZERO_EXECUTION_VAULT_TTL_MS = 10 * 60 * 60 * 1000;
const MAX_USER_VAULTS = 5;
const vaultExpiryTimers = new Map();
const vaultExpiryWarningIds = new Set();
let vaultsLoadedForUid = null;

// ============================================================
// Small reusable UI helpers (toasts, field errors, confirm modal)
// ============================================================

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
        <span>${message}</span>
        <button class="toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
    `;

    const remove = () => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.toast-close').addEventListener('click', remove);
    container.appendChild(toast);

    if (duration > 0) setTimeout(remove, duration);
}

function setFieldError(inputEl, errorEl, message) {
    if (inputEl) inputEl.classList.add('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

function clearFieldError(inputEl, errorEl) {
    if (inputEl) inputEl.classList.remove('error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
}

function shakeElement(el) {
    if (!el) return;
    el.classList.remove('shake-error');
    // force reflow so the animation can restart if triggered repeatedly
    void el.offsetWidth;
    el.classList.add('shake-error');
    setTimeout(() => el.classList.remove('shake-error'), 450);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Only allow http(s) links for ad-gate URLs — blocks javascript: URI injection
// and similar schemes from ever becoming a clickable href on the Get-Key page.
function isSafeUrl(url) {
    if (!url) return true; // empty is fine — it just means no ad-gate step
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// Translates raw Firebase Auth error codes into human, actionable copy.
function friendlyAuthError(err) {
    const code = err && err.code ? err.code : '';
    switch (code) {
        case 'auth/invalid-email':
            return "That email address doesn't look valid.";
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Incorrect email or password. Double-check and try again.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists — try logging in instead.';
        case 'auth/weak-password':
            return 'That password is too weak — use at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment before trying again.';
        case 'auth/network-request-failed':
            return "Network error — check your connection and try again.";
        case 'auth/user-disabled':
            return 'This account has been disabled. Contact support if that seems wrong.';
        case 'auth/operation-not-allowed':
            return 'Google sign-in is not enabled for this Firebase project yet. Turn on Google in Firebase Authentication settings.';
        case 'auth/unauthorized-domain':
            return 'This website domain is not approved for Google sign-in. Add it to Firebase Authentication’s authorized domains.';
        case 'auth/popup-blocked':
            return 'Your browser blocked the Google sign-in window. Allow popups for this site and try again.';
        case 'auth/popup-closed-by-user':
            return 'Google sign-in was closed before it finished.';
        case 'auth/account-exists-with-different-credential':
            return 'This Google email already uses a different sign-in method. Log in with that method first.';
        default:
            return (err && err.message ? err.message.replace(/^Firebase:\s*/i, '') : 'Something went wrong. Please try again.');
    }
}

async function loadSiteAnnouncement() {
    const banner = document.getElementById('site-announcement');
    if (!banner) return;
    try {
        const response = await fetch('/api/announcements');
        if (!response.ok) return;
        const data = await response.json();
        const announcement = data && data.announcement;
        if (!announcement || !announcement.message) return;

        const dismissalKey = `voidedx-announcement-dismissed-${announcement.updatedAt || announcement.message}`;
        try { if (localStorage.getItem(dismissalKey) === '1') return; } catch {}

        const title = document.getElementById('site-announcement-title');
        const message = document.getElementById('site-announcement-message');
        const link = document.getElementById('site-announcement-link');
        const dismiss = document.getElementById('site-announcement-dismiss');
        title.textContent = announcement.title || 'VoidedX update';
        message.textContent = announcement.message;

        banner.classList.remove('info', 'success', 'warning');
        banner.classList.add(['info', 'success', 'warning'].includes(announcement.kind) ? announcement.kind : 'info');
        const icon = document.getElementById('site-announcement-icon');
        icon.className = announcement.kind === 'success'
            ? 'fa-solid fa-circle-check'
            : announcement.kind === 'warning' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-info';

        link.classList.add('hidden');
        if (announcement.link) {
            const parsed = new URL(announcement.link, window.location.origin);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                link.href = parsed.href;
                link.textContent = announcement.linkLabel || 'Learn more';
                link.classList.remove('hidden');
            }
        }
        dismiss.onclick = () => {
            banner.classList.add('hidden');
            try { localStorage.setItem(dismissalKey, '1'); } catch {}
        };
        banner.classList.remove('hidden');
    } catch {
        // Public pages remain usable if announcements are temporarily unavailable.
    }
}

// Start the backup download directly from the Save button click. Browsers can
// block downloads triggered only after the later Firebase requests complete.
function downloadLocalVaultBackup(vaultId, title, code) {
    let blobUrl = '';
    let link = null;
    try {
        const getKeyLine = vaultId
            ? `Get-key page: ${window.location.origin}/key.html?id=${encodeURIComponent(vaultId)}`
            : 'Get-key page: Available after this draft is saved.';
        const backupTxt = [
            '==================================================',
            'VOIDEDX VAULT BACKUP',
            `Title: ${String(title).replace(/[\r\n]+/g, ' ')}`,
            `Vault ID: ${vaultId || 'Not saved yet'}`,
            getKeyLine,
            'For protected vaults, copy the current loader from VoidedX after saving.',
            '==================================================',
            code
        ].join('\n');
        const safeVaultId = String(vaultId || 'draft').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80) || 'vault';
        blobUrl = URL.createObjectURL(new Blob([backupTxt], { type: 'text/plain;charset=utf-8' }));
        link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${safeVaultId}_backup.txt`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Let the browser finish consuming the Blob URL before releasing it.
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return true;
    } catch (error) {
        if (link) link.remove();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        console.warn('Could not start the local vault backup download:', error);
        return false;
    }
}

// Simple promise-based replacement for window.confirm, styled to match the app.
function customConfirm({ title, message, confirmLabel = 'Delete' }) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        okBtn.textContent = confirmLabel;
        modal.classList.remove('hidden');

        const cleanup = (result) => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onOverlayClick);
            resolve(result);
        };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onOverlayClick = (e) => { if (e.target === modal) cleanup(false); };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onOverlayClick);
    });
}

// ============================================================
// Main app
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadSiteAnnouncement();
    const lockBtn = document.getElementById('lock-vault-btn');
    const newVaultBtn = document.getElementById('new-vault-btn');
    const deleteBtn = document.getElementById('delete-vault-btn');
    const sourceCode = document.getElementById('source-code');
    const codeError = document.getElementById('code-error');
    const lineNumbersEl = document.getElementById('line-numbers');
    const syntaxHighlightEl = document.getElementById('syntax-highlight');
    const checkCodeBtn = document.getElementById('check-code-btn');
    const diagnosticsPanel = document.getElementById('code-diagnostics');
    const diagnosticsSummary = document.getElementById('diagnostics-summary');
    const diagnosticsHint = document.getElementById('diagnostics-hint');
    const diagnosticsList = document.getElementById('code-diagnostics-list');
    const closeDiagnosticsBtn = document.getElementById('close-diagnostics-btn');
    const mobileVaultSettings = document.getElementById('mobile-vault-settings');
    if (mobileVaultSettings && window.matchMedia('(max-width: 768px)').matches) mobileVaultSettings.open = false;
    const scriptTitle = document.getElementById('script-title');
    const titleError = document.getElementById('title-error');
    const resultOverlay = document.getElementById('result-overlay');
    const editorSaveStatus = document.getElementById('editor-save-status');
    const editorSaveLabel = document.getElementById('editor-save-label');
    const lsOutput = document.getElementById('ls-output');
    const copyBtn = document.getElementById('copy-out-btn');
    const getKeyRow = document.getElementById('get-key-row');
    const getKeyOutput = document.getElementById('get-key-output');
    const copyKeyLinkBtn = document.getElementById('copy-key-link-btn');
    const chkBackup = document.getElementById('chk-backup');
    const backupNowBtn = document.getElementById('backup-now-btn');
    const protectionKeyStatus = document.getElementById('protection-key-status');
    const openKeysystemBtn = document.getElementById('open-keysystem-btn');
    const keysystemStatusBadge = document.getElementById('keysystem-status-badge');
    const activeVaultId = document.getElementById('active-vault-id');
    const editingIndicator = document.getElementById('editing-indicator');
    const vaultListContainer = document.getElementById('vault-list');
    const vaultListToggle = document.getElementById('vault-list-toggle');
    const vaultListPanel = document.getElementById('vault-list-panel');
    const vaultListCount = document.getElementById('vault-list-count');
    const vaultSearch = document.getElementById('vault-search');
    const vaultSort = document.getElementById('vault-sort');
    const vaultFilter = document.getElementById('vault-filter');
    const vaultStatTotal = document.getElementById('vault-stat-total');
    const vaultStatExecutions = document.getElementById('vault-stat-executions');
    const vaultStatProtected = document.getElementById('vault-stat-protected');
    const execCountBadge = document.getElementById('exec-count-badge');
    const execCountNum = document.getElementById('exec-count-num');
    const promoShareBtn = document.getElementById('promo-share-btn');

    let hasUnsavedChanges = false;
    let cachedVaults = [];

    function setEditorDirty(isDirty) {
        hasUnsavedChanges = !!isDirty;
        if (!editorSaveStatus) return;
        editorSaveStatus.classList.toggle('unsaved', hasUnsavedChanges);
        editorSaveStatus.setAttribute('aria-label', hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved');
        if (editorSaveStatus.querySelector('i')) {
            editorSaveStatus.querySelector('i').className = hasUnsavedChanges
                ? 'fa-solid fa-circle-exclamation'
                : 'fa-solid fa-circle-check';
        }
        if (editorSaveLabel) editorSaveLabel.textContent = hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved';
    }

    function setProtectionKeyStatus(isEnabled) {
        if (!protectionKeyStatus) return;
        protectionKeyStatus.textContent = isEnabled ? 'ON' : 'OFF';
        protectionKeyStatus.classList.toggle('on', !!isEnabled);
        protectionKeyStatus.classList.toggle('off', !isEnabled);
    }

    window.addEventListener('beforeunload', (event) => {
        if (!hasUnsavedChanges) return;
        event.preventDefault();
        event.returnValue = '';
    });

    if (promoShareBtn) {
        promoShareBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.origin);
            showToast('VoidedX link copied to clipboard!', 'success', 3000);
        });
    }

    // Vault list dropdown (starts expanded)
    vaultListPanel.classList.add('expanded');
    vaultListToggle.classList.add('expanded');
    vaultListToggle.addEventListener('click', () => {
        const isExpanded = vaultListPanel.classList.toggle('expanded');
        vaultListToggle.classList.toggle('expanded', isExpanded);
    });

    // Auth Elements
    const authBtn = document.getElementById('auth-btn');
    const userDisplay = document.getElementById('user-display');
    const authModal = document.getElementById('auth-modal');
    const authHeading = document.getElementById('auth-heading');
    const authSubheading = document.getElementById('auth-subheading');
    const authBanner = document.getElementById('auth-banner');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const googleAuthBtn = document.getElementById('google-auth-btn');
    const googleAuthLabel = document.getElementById('google-auth-label');
    const authEmail = document.getElementById('auth-email');
    const emailError = document.getElementById('email-error');
    const authPassword = document.getElementById('auth-password');
    const passwordError = document.getElementById('password-error');
    const passwordHint = document.getElementById('password-hint');
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authSubmitLabel = document.getElementById('auth-submit-label');
    const authCloseBtn = document.getElementById('auth-close-btn');
    const authCloseX = document.getElementById('auth-close-x');

    // ---------------- Auth modal open/close ----------------

    function resetAuthForm() {
        authEmail.value = '';
        authPassword.value = '';
        // Reopen the modal in Log In mode so a previous Sign Up selection cannot
        // make an existing user accidentally try to create the account again.
        setAuthMode(false);
        clearFieldError(authEmail, emailError);
        clearFieldError(authPassword, passwordError);
        authBanner.classList.add('hidden');
        authPassword.type = 'password';
        togglePasswordBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        setAuthLoading(false);
    }

    function openAuthModal() {
        resetAuthForm();
        authModal.classList.remove('hidden');
        if (!window.matchMedia('(max-width: 768px)').matches) authEmail.focus();
    }

    function closeAuthModal() {
        authModal.classList.add('hidden');
    }

    authBtn.addEventListener('click', () => {
        if (currentUser && !currentUser.isAnonymous) {
            signOut(auth);
            showToast('Logged out.', 'info', 2500);
        } else {
            openAuthModal();
        }
    });

    authCloseBtn.addEventListener('click', closeAuthModal);
    authCloseX.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

    function setAuthMode(signUp) {
        isSignUpMode = signUp;
        tabLogin.classList.toggle('active', !signUp);
        tabSignup.classList.toggle('active', signUp);
        authSubmitLabel.textContent = signUp ? 'Sign Up' : 'Log In';
        authHeading.textContent = signUp ? 'Create your account' : 'Welcome back';
        authSubheading.textContent = signUp
            ? 'Sign up to start saving vaults to the cloud.'
            : 'Log in to sync your vaults to the cloud.';
        passwordHint.classList.toggle('hidden', !signUp);
        clearFieldError(authEmail, emailError);
        clearFieldError(authPassword, passwordError);
        authBanner.classList.add('hidden');
    }

    tabLogin.addEventListener('click', () => setAuthMode(false));
    tabSignup.addEventListener('click', () => setAuthMode(true));

    togglePasswordBtn.addEventListener('click', () => {
        const showing = authPassword.type === 'text';
        authPassword.type = showing ? 'password' : 'text';
        togglePasswordBtn.innerHTML = showing
            ? '<i class="fa-solid fa-eye"></i>'
            : '<i class="fa-solid fa-eye-slash"></i>';
    });

    authEmail.addEventListener('input', () => clearFieldError(authEmail, emailError));
    authPassword.addEventListener('input', () => clearFieldError(authPassword, passwordError));
    [authEmail, authPassword].forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                authSubmitBtn.click();
            }
        });
    });

    function setAuthLoading(isLoading) {
        authSubmitBtn.disabled = isLoading;
        googleAuthBtn.disabled = isLoading;
        authCloseBtn.disabled = isLoading;
        authSubmitLabel.innerHTML = isLoading
            ? `<i class="fa-solid fa-spinner fa-spin"></i> ${isSignUpMode ? 'Creating account…' : 'Logging in…'}`
            : (isSignUpMode ? 'Sign Up' : 'Log In');
        googleAuthLabel.textContent = isLoading ? 'Opening Google…' : 'Continue with Google';
    }

    const googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    async function finishGoogleLinkConflict(error) {
        if (!error || error.code !== 'auth/credential-already-in-use') return false;
        const credential = GoogleAuthProvider.credentialFromError(error);
        if (!credential) return false;
        await signInWithCredential(auth, credential);
        closeAuthModal();
        showToast('Signed in with Google. If you have guest vaults from before, recover them with their vault ID.', 'success', 7000);
        return true;
    }

    function showGoogleAuthError(error) {
        authBanner.textContent = friendlyAuthError(error);
        authBanner.className = 'auth-banner error';
    }

    googleAuthBtn.addEventListener('click', async () => {
        authBanner.classList.add('hidden');
        setAuthLoading(true);
        try {
            const current = auth.currentUser;
            // Popup sign-in also works on this Vercel-hosted site without requiring
            // the extra same-domain proxy setup that redirect sign-in needs.
            if (current && current.isAnonymous) await linkWithPopup(current, googleProvider);
            else await signInWithPopup(auth, googleProvider);
            closeAuthModal();
            showToast('You’re signed in with Google.', 'success');
        } catch (error) {
            try {
                if (await finishGoogleLinkConflict(error)) return;
            } catch (signInError) {
                error = signInError;
            }
            showGoogleAuthError(error);
        } finally {
            setAuthLoading(false);
        }
    });

    authSubmitBtn.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value;

        clearFieldError(authEmail, emailError);
        clearFieldError(authPassword, passwordError);
        authBanner.classList.add('hidden');

        let hasError = false;
        if (!email) {
            setFieldError(authEmail, emailError, 'Enter your email address.');
            hasError = true;
        } else if (!isValidEmail(email)) {
            setFieldError(authEmail, emailError, "That doesn't look like a valid email.");
            hasError = true;
        }

        if (!password) {
            setFieldError(authPassword, passwordError, 'Enter your password.');
            hasError = true;
        } else if (isSignUpMode && password.length < 6) {
            setFieldError(authPassword, passwordError, 'Password must be at least 6 characters.');
            hasError = true;
        }

        if (hasError) return;

        setAuthLoading(true);
        try {
            if (isSignUpMode) {
                await createUserWithEmailAndPassword(auth, email, password);
                showToast('Account created — you\'re logged in!', 'success');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                showToast('Welcome back!', 'success');
            }
            closeAuthModal();
        } catch (err) {
            if (isSignUpMode && err.code === 'auth/email-already-in-use') {
                // Keep the email and move straight to the existing account's login.
                setAuthMode(false);
                authEmail.value = email;
                authPassword.value = '';
                authBanner.textContent = 'This email already has an account. You are on Log In now—use the same sign-in method you used before.';
            } else {
                authBanner.textContent = friendlyAuthError(err);
            }
            authBanner.classList.remove('hidden');
            authBanner.className = 'auth-banner error';
        } finally {
            setAuthLoading(false);
        }
    });

    let lastUid = null;
    onAuthStateChanged(auth, user => {
        currentUser = user;
        const newUid = user ? user.uid : null;
        if (newUid !== lastUid) {
            for (const timer of vaultExpiryTimers.values()) clearTimeout(timer);
            vaultExpiryTimers.clear();
            vaultExpiryWarningIds.clear();
            vaultsLoadedForUid = null;
            // Identity changed (login / logout / new guest): clear the editor and the
            // vault list so nothing from the previous account stays on screen.
            resetEditor();
            vaultListContainer.innerHTML = '<div class="info-box"><p><i class="fa-solid fa-spinner fa-spin"></i> Loading vaults...</p></div>';
            updateVaultCount(0);
            lastUid = newUid;
        }
        if (user && !user.isAnonymous) {
            userDisplay.innerHTML = `<i class="fa-solid fa-user-check text-cyan"></i> ${user.email}`;
            authBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Logout`;
            loadUserVaults();
        } else if (user && user.isAnonymous) {
            // Real Firebase Auth session, just without an email — this UID is what
            // proves ownership of vaults created while "not logged in".
            userDisplay.innerHTML = `<i class="fa-solid fa-user"></i> Guest`;
            authBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
            loadUserVaults();
        } else {
            // No session at all yet — silently start one so this browser gets a
            // stable, unique UID instead of everyone sharing the literal "guest".
            signInAnonymously(auth).catch(() => {
                userDisplay.innerHTML = `<i class="fa-solid fa-user"></i> Guest`;
                authBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
                vaultListContainer.innerHTML = '<div class="info-box"><p>Log in to save and manage your script vaults cloud-wide.</p></div>';
                updateVaultCount(0);
            });
        }
    });

    // ---------------- Vault list ----------------

    function updateVaultOverview() {
        const totalExecutions = cachedVaults.reduce((sum, vault) => sum + (Number(vault.data.executions) || 0), 0);
        const protectedCount = cachedVaults.filter(vault => !!vault.data.requireKey).length;
        if (vaultStatTotal) vaultStatTotal.textContent = cachedVaults.length.toLocaleString();
        if (vaultStatExecutions) vaultStatExecutions.textContent = totalExecutions.toLocaleString();
        if (vaultStatProtected) vaultStatProtected.textContent = protectedCount.toLocaleString();
    }

    function vaultUpdatedAt(value) {
        if (typeof value === 'number') return value;
        if (value && typeof value.toMillis === 'function') return value.toMillis();
        return 0;
    }

    function renderVaultList() {
        if (!vaultListContainer) return;
        vaultListContainer.innerHTML = '';

        if (!cachedVaults.length) {
            vaultListContainer.innerHTML = '<div class="info-box"><p>No vaults found. Create one!</p></div>';
            return;
        }

        const searchTerm = vaultSearch ? vaultSearch.value.trim().toLowerCase() : '';
        const filterMode = vaultFilter ? vaultFilter.value : 'all';
        const visibleVaults = cachedVaults.filter(vault => {
            const title = String(vault.data.title || '').toLowerCase();
            const matchesSearch = !searchTerm || title.includes(searchTerm) || vault.id.toLowerCase().includes(searchTerm);
            const matchesProtection = filterMode === 'all'
                || (filterMode === 'protected' && !!vault.data.requireKey)
                || (filterMode === 'open' && !vault.data.requireKey);
            return matchesSearch && matchesProtection;
        });
        const sortMode = vaultSort ? vaultSort.value : 'recent';
        visibleVaults.sort((a, b) => {
            if (sortMode === 'executions') {
                return (Number(b.data.executions) || 0) - (Number(a.data.executions) || 0)
                    || String(a.data.title || '').localeCompare(String(b.data.title || ''));
            }
            if (sortMode === 'title') {
                return String(a.data.title || '').localeCompare(String(b.data.title || ''));
            }
            return vaultUpdatedAt(b.data.updatedAt) - vaultUpdatedAt(a.data.updatedAt);
        });

        if (!visibleVaults.length) {
            vaultListContainer.innerHTML = '<div class="info-box"><p>No vaults match that search.</p></div>';
            return;
        }

        visibleVaults.forEach(vault => {
            const item = vault.data;
            const div = document.createElement('div');
            div.className = 'vault-item';
            const execs = Number(item.executions) || 0;
            const title = String(item.title || 'Untitled Vault');
            const initial = title.trim().charAt(0).toUpperCase() || '?';
            div.innerHTML = `
                <span class="vault-item-main">
                    <span class="vault-item-icon">${escapeHtml(initial)}</span>
                    <span class="vault-item-title">${escapeHtml(title)}</span>
                </span>
                <span class="vault-item-badge"><i class="fa-solid fa-play"></i> ${execs.toLocaleString()}</span>
            `;
            div.addEventListener('click', () => {
                if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Discard them and open this vault?')) return;
                loadVaultIntoEditor(vault.id, item);
            });
            vaultListContainer.appendChild(div);
        });
    }

    if (vaultSearch) vaultSearch.addEventListener('input', renderVaultList);
    if (vaultSort) vaultSort.addEventListener('change', renderVaultList);
    if (vaultFilter) vaultFilter.addEventListener('change', renderVaultList);

    async function loadUserVaults() {
        if (!currentUser) return;
        vaultListContainer.innerHTML = '<div class="info-box"><p><i class="fa-solid fa-spinner fa-spin"></i> Loading vaults...</p></div>';
        try {
            const uidAtStart = currentUser.uid;
            const q = query(collection(db, "vaults"), where("uid", "==", uidAtStart));
            const snapshot = await getDocs(q);
            if (!currentUser || currentUser.uid !== uidAtStart) return;
            const now = Date.now();
            const loadedVaults = [];
            let expiredCount = 0;
            let expirySetupFailed = false;

            for (const docSnap of snapshot.docs) {
                let data = docSnap.data();
                const executions = Number(data.executions) || 0;
                if (executions === 0) {
                    let expiresAt = Number(data.autoDeleteAt);
                    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
                        expiresAt = Date.now() + ZERO_EXECUTION_VAULT_TTL_MS;
                        try {
                            await updateDoc(docSnap.ref, { autoDeleteAt: expiresAt });
                            data = { ...data, autoDeleteAt: expiresAt };
                        } catch {
                            data = { ...data, autoDeleteAt: null };
                            expiresAt = 0;
                            expirySetupFailed = true;
                        }
                    }

                    if (expiresAt > 0 && expiresAt <= now
                        && !(activeVaultId.value === docSnap.id && hasUnsavedChanges)) {
                        try {
                            const outcome = await deleteVaultIfStillUnused(docSnap.id, uidAtStart);
                            if (outcome.deleted) {
                                expiredCount++;
                                continue;
                            }
                            if (outcome.data) {
                                data = outcome.data;
                            } else {
                                const fresh = await getDoc(docSnap.ref);
                                if (!fresh.exists()) { expiredCount++; continue; }
                                data = fresh.data();
                            }
                        } catch {
                            // Leave the vault visible; a later list refresh will retry.
                        }
                    }
                }
                loadedVaults.push({ id: docSnap.id, data });
            }

            if (!currentUser || currentUser.uid !== uidAtStart) return;
            vaultsLoadedForUid = uidAtStart;
            for (const timer of vaultExpiryTimers.values()) clearTimeout(timer);
            vaultExpiryTimers.clear();
            cachedVaults = loadedVaults;
            cachedVaults.forEach(vault => scheduleUnusedVaultCleanup(vault, uidAtStart));
            updateVaultCount(cachedVaults.length);
            updateVaultOverview();
            renderVaultList();
            if (expiredCount) {
                showToast(`${expiredCount} unused vault${expiredCount === 1 ? '' : 's'} removed after 10 hours with 0 executions.`, 'info', 7000);
            }
            if (expirySetupFailed) {
                showToast('Could not start the 10-hour timer for an older vault. Save it once to enable cleanup.', 'warning', 7000);
            }
        } catch (err) {
            vaultListContainer.innerHTML = `<div class="info-box text-red"><p>Error loading vaults: ${escapeHtml(friendlyAuthError(err))}</p></div>`;
        }
    }

    async function deleteVaultIfStillUnused(vaultId, ownerUid) {
        const ref = doc(db, 'vaults', vaultId);
        return runTransaction(db, async transaction => {
            const fresh = await transaction.get(ref);
            if (!fresh.exists()) return { deleted: true };
            const data = fresh.data();
            const expiresAt = Number(data.autoDeleteAt);
            if (data.uid !== ownerUid || (Number(data.executions) || 0) !== 0
                || !Number.isFinite(expiresAt) || expiresAt > Date.now()) {
                return { deleted: false, data };
            }
            transaction.delete(ref);
            return { deleted: true };
        });
    }

    function scheduleUnusedVaultCleanup(vault, ownerUid, delayOverride = null) {
        const previous = vaultExpiryTimers.get(vault.id);
        if (previous) clearTimeout(previous);

        const expiresAt = Number(vault.data.autoDeleteAt);
        if ((Number(vault.data.executions) || 0) !== 0 || !Number.isFinite(expiresAt) || expiresAt <= 0) {
            vaultExpiryTimers.delete(vault.id);
            return;
        }

        const delay = delayOverride == null ? Math.max(0, expiresAt - Date.now()) : delayOverride;
        const timer = setTimeout(async () => {
            vaultExpiryTimers.delete(vault.id);
            if (!currentUser || currentUser.uid !== ownerUid) return;

            if (activeVaultId.value === vault.id && hasUnsavedChanges) {
                if (!vaultExpiryWarningIds.has(vault.id)) {
                    vaultExpiryWarningIds.add(vault.id);
                    showToast('This unused vault reached its 10-hour limit. Save your edits or download a backup before leaving it.', 'warning', 9000);
                }
                scheduleUnusedVaultCleanup(vault, ownerUid, 60 * 1000);
                return;
            }

            try {
                const outcome = await deleteVaultIfStillUnused(vault.id, ownerUid);
                if (outcome.deleted) {
                    cachedVaults = cachedVaults.filter(item => item.id !== vault.id);
                    if (activeVaultId.value === vault.id) resetEditor();
                    vaultExpiryWarningIds.delete(vault.id);
                    updateVaultCount(cachedVaults.length);
                    updateVaultOverview();
                    renderVaultList();
                    showToast(`"${vault.data.title || 'Untitled Vault'}" was deleted after 10 hours with 0 executions.`, 'info', 7000);
                    return;
                }

                if (outcome.data) {
                    const refreshed = { id: vault.id, data: outcome.data };
                    cachedVaults = cachedVaults.map(item => item.id === vault.id ? refreshed : item);
                    updateVaultOverview();
                    renderVaultList();
                    scheduleUnusedVaultCleanup(refreshed, ownerUid);
                }
            } catch {
                // Cleanup is retried when the owner next reloads the vault list.
            }
        }, Math.min(delay, 2147483647));
        vaultExpiryTimers.set(vault.id, timer);
    }

    function updateVaultCount(count) {
        if (!vaultListCount) return;
        vaultListCount.textContent = `${count}/${MAX_USER_VAULTS}`;
        vaultListCount.title = `${count} of ${MAX_USER_VAULTS} saved vaults`;
        vaultListCount.classList.remove('hidden');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function loadVaultIntoEditor(id, data) {
        activeVaultId.value = id;
        scriptTitle.value = data.title || '';
        sourceCode.value = data.code || '';
        setEditorDirty(false);
        setProtectionKeyStatus(!!data.requireKey);
        updateLineNumbers();
        renderSyntaxHighlight();
        diagnosticsPanel.classList.add('hidden');
        clearFieldError(sourceCode, codeError);
        editingIndicator.classList.remove('hidden');
        deleteBtn.classList.remove('hidden');

        const keyCount = Array.isArray(data.keys) ? data.keys.length : (data.requireKey && data.key ? 1 : 0);
        if (data.requireKey && keyCount > 0) {
            keysystemStatusBadge.textContent = `ON · ${keyCount} key${keyCount > 1 ? 's' : ''}`;
            keysystemStatusBadge.classList.remove('hidden');
            keysystemStatusBadge.classList.add('on');
        } else {
            keysystemStatusBadge.textContent = 'OFF';
            keysystemStatusBadge.classList.remove('on');
            keysystemStatusBadge.classList.add('hidden');
        }

        if (execCountBadge && execCountNum) {
            execCountNum.textContent = data.executions || 0;
            execCountBadge.classList.remove('hidden');
        }

        const keyParam = (!data.guiMode && data.requireKey && data.key) ? `&key=${encodeURIComponent(data.key)}` : '';
        const rawUrl = `${window.location.origin}/api/raw?id=${id}${keyParam}`;
        lsOutput.value = `loadstring(game:HttpGet("${rawUrl}"))()`;
        resultOverlay.classList.remove('hidden');

        if (data.requireKey) {
            getKeyOutput.value = `${window.location.origin}/key.html?id=${id}`;
            getKeyRow.classList.remove('hidden');
        } else {
            getKeyRow.classList.add('hidden');
        }
        showToast(`Loaded "${escapeHtml(data.title || 'Untitled Vault')}" into the editor.`, 'info', 2500);
    }

    // ---------------- Lock / Save Vault ----------------

    // ---------------- Line numbers gutter ----------------

    function updateLineNumbers() {
        const lineCount = sourceCode.value.split('\n').length;
        let out = '';
        for (let i = 1; i <= lineCount; i++) out += i + (i < lineCount ? '\n' : '');
        lineNumbersEl.textContent = out || '1';
    }

    const luauKeywords = new Set('and break do else elseif end false for function if in local nil not or repeat return then true until while continue type export'.split(' '));
    const luauBuiltins = new Set('assert collectgarbage error getfenv getmetatable ipairs load loadstring newproxy next pairs pcall print rawequal rawget rawlen rawset select setfenv setmetatable tonumber tostring type typeof unpack xpcall'.split(' '));
    const luauGlobals = new Set('game workspace script shared _G Enum Instance Vector2 Vector3 Vector2int16 Vector3int16 CFrame Color3 UDim UDim2 BrickColor Ray Region3 TweenInfo Random Axes Faces NumberRange NumberSequence ColorSequence PhysicalProperties OverlapParams RaycastParams PathWaypoint task coroutine table string math bit32 buffer utf8 os debug'.split(' '));
    const escapeCodeText = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function scanLuau(code) {
        let html = '';
        let index = 0;
        let line = 1;
        let column = 1;
        let previousSignificant = null;
        const tokens = [];
        const issues = [];

        function longBracketAt(position) {
            const match = code.slice(position).match(/^\[(=*)\[/);
            return match ? { open: match[0], close: `]${match[1]}]` } : null;
        }
        function advance(raw) {
            for (const character of raw) {
                if (character === '\n') { line += 1; column = 1; }
                else column += 1;
            }
        }
        function emit(raw, className, type, value = raw) {
            const tokenLine = line;
            const tokenColumn = column;
            if (className) html += `<span class="${className}">${escapeCodeText(raw)}</span>`;
            else html += escapeCodeText(raw);
            if (type) {
                const token = { type, value, line: tokenLine, column: tokenColumn };
                tokens.push(token);
                previousSignificant = token;
            }
            advance(raw);
            index += raw.length;
        }

        while (index < code.length) {
            const character = code[index];
            if (/\s/.test(character)) {
                let end = index + 1;
                while (end < code.length && /\s/.test(code[end])) end += 1;
                emit(code.slice(index, end), null, null);
                continue;
            }

            if (code.startsWith('--', index)) {
                const startLine = line;
                const startColumn = column;
                const longOpen = longBracketAt(index + 2);
                let end;
                if (longOpen) {
                    const closeAt = code.indexOf(longOpen.close, index + 2 + longOpen.open.length);
                    end = closeAt < 0 ? code.length : closeAt + longOpen.close.length;
                    if (closeAt < 0) issues.push({ severity: 'error', line: startLine, column: startColumn, message: 'Long comment is missing its closing bracket.' });
                } else {
                    end = code.indexOf('\n', index);
                    if (end < 0) end = code.length;
                }
                emit(code.slice(index, end), 'syntax-comment', null);
                continue;
            }

            const longOpen = longBracketAt(index);
            if (longOpen) {
                const startLine = line;
                const startColumn = column;
                const closeAt = code.indexOf(longOpen.close, index + longOpen.open.length);
                const end = closeAt < 0 ? code.length : closeAt + longOpen.close.length;
                if (closeAt < 0) issues.push({ severity: 'error', line: startLine, column: startColumn, message: 'Long string is missing its closing bracket.' });
                emit(code.slice(index, end), 'syntax-string', 'string');
                continue;
            }

            if (character === '"' || character === "'") {
                const startLine = line;
                const startColumn = column;
                let end = index + 1;
                let closed = false;
                while (end < code.length) {
                    if (code[end] === '\\') { end += 2; continue; }
                    if (code[end] === character) { end += 1; closed = true; break; }
                    if (code[end] === '\n' || code[end] === '\r') break;
                    end += 1;
                }
                const raw = code.slice(index, Math.min(end, code.length));
                if (!closed) issues.push({ severity: 'error', line: startLine, column: startColumn, message: 'String is not closed before the line ends.' });
                emit(raw, 'syntax-string', 'string');
                continue;
            }

            const identifier = code.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
            if (identifier) {
                const value = identifier[0];
                const tail = code.slice(index + value.length).match(/^\s*/)[0].length;
                let className = '';
                if (luauKeywords.has(value)) className = 'syntax-keyword';
                else if (luauBuiltins.has(value)) className = 'syntax-builtin';
                else if (luauGlobals.has(value)) className = 'syntax-global';
                else if (previousSignificant && (previousSignificant.value === '.' || previousSignificant.value === ':')) className = 'syntax-property';
                else if (code[index + value.length + tail] === '(') className = 'syntax-function';
                emit(value, className, luauKeywords.has(value) ? 'keyword' : 'identifier', value);
                continue;
            }

            const number = code.slice(index).match(/^(?:0[xX][\da-fA-F]+(?:\.[\da-fA-F]*)?(?:[pP][+-]?\d+)?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/);
            if (number) {
                emit(number[0], 'syntax-number', 'number');
                continue;
            }

            const operator = code.slice(index).match(/^(?:\.\.\.|\.\.=|\/\/=?|==|~=|<=|>=|\+=|-=|\*=|\/=|%=|\^=|\.\.|::|->|[=+*/%^<>#~:-])/);
            if (operator) {
                emit(operator[0], 'syntax-operator', 'operator');
                continue;
            }

            const punctuation = '(){}[],;.'.includes(character);
            emit(character, punctuation ? '' : 'syntax-operator', 'punctuation');
        }
        return { html, tokens, issues };
    }

    function renderSyntaxHighlight() {
        if (!syntaxHighlightEl) return;
        const result = scanLuau(sourceCode.value);
        syntaxHighlightEl.innerHTML = result.html + (sourceCode.value.endsWith('\n') ? ' ' : '');
        syntaxHighlightEl.scrollTop = sourceCode.scrollTop;
        syntaxHighlightEl.scrollLeft = sourceCode.scrollLeft;
        return result;
    }

    function checkLuauCode(code) {
        const scanned = scanLuau(code);
        const issues = scanned.issues.slice();
        const tokens = scanned.tokens;
        const delimiters = [];
        const matching = { ')': '(', ']': '[', '}': '{' };
        const opening = new Set(['(', '[', '{']);

        tokens.forEach((token) => {
            if (token.type !== 'punctuation') return;
            if (opening.has(token.value)) delimiters.push(token);
            else if (matching[token.value]) {
                const last = delimiters.pop();
                if (!last || last.value !== matching[token.value]) {
                    issues.push({ severity: 'error', line: token.line, column: token.column, message: `Unexpected “${token.value}”; check the matching bracket.` });
                }
            }
        });
        delimiters.forEach((token) => issues.push({ severity: 'error', line: token.line, column: token.column, message: `“${token.value}” is not closed.` }));

        const blocks = [];
        const ifExpressions = new Set(['=', 'return', '(', ',', '{', '[', 'and', 'or']);
        tokens.forEach((token, position) => {
            if (token.type !== 'keyword') return;
            const value = token.value;
            if (value === 'if') {
                const previous = tokens[position - 1];
                if (!previous || !ifExpressions.has(previous.value)) blocks.push({ kind: 'end', token });
            } else if (value === 'function' || value === 'do') {
                blocks.push({ kind: 'end', token });
            } else if (value === 'repeat') {
                blocks.push({ kind: 'until', token });
            } else if (value === 'end') {
                const last = blocks.pop();
                if (!last) issues.push({ severity: 'warning', line: token.line, column: token.column, message: 'This “end” does not appear to close a block.' });
                else if (last.kind === 'until') issues.push({ severity: 'error', line: token.line, column: token.column, message: 'A repeat block should close with “until condition”.' });
            } else if (value === 'until') {
                const last = blocks.pop();
                if (!last || last.kind !== 'until') {
                    if (last) blocks.push(last);
                    issues.push({ severity: 'warning', line: token.line, column: token.column, message: 'This “until” does not appear to match a repeat block.' });
                }
            }
        });
        blocks.forEach((block) => issues.push({ severity: 'warning', line: block.token.line, column: block.token.column, message: `This ${block.token.value} block may be missing its closing ${block.kind === 'until' ? 'until' : 'end'}.` }));

        for (let i = 0; i < tokens.length; i += 1) {
            const token = tokens[i];
            if (token.type === 'keyword' && token.value === 'if') {
                let depth = 0;
                for (let j = i + 1; j < tokens.length; j += 1) {
                    const current = tokens[j];
                    if (current.value === '(' || current.value === '[' || current.value === '{') depth += 1;
                    else if (current.value === ')' || current.value === ']' || current.value === '}') depth = Math.max(0, depth - 1);
                    if (depth === 0 && current.type === 'keyword' && current.value === 'then') break;
                    if (depth === 0 && current.type === 'operator' && current.value === '=') {
                        issues.push({ severity: 'warning', line: current.line, column: current.column, message: 'Did you mean “==” for a comparison in this if condition?' });
                        break;
                    }
                    if (depth === 0 && current.type === 'keyword' && (current.value === 'end' || current.value === 'do')) break;
                }
            }
            if (token.type === 'identifier' && ['wait', 'spawn', 'delay'].includes(token.value) && tokens[i + 1] && tokens[i + 1].value === '(') {
                const replacements = { wait: 'task.wait()', spawn: 'task.spawn()', delay: 'task.delay()' };
                issues.push({ severity: 'info', line: token.line, column: token.column, message: `Consider ${replacements[token.value]}; ${token.value}() is an older API.` });
            }
        }

        return issues.sort((a, b) => a.line - b.line || a.column - b.column);
    }

    function runCodeCheck() {
        const issues = checkLuauCode(sourceCode.value);
        diagnosticsList.replaceChildren();
        if (!sourceCode.value.trim()) issues.push({ severity: 'info', line: 1, column: 1, message: 'Paste some Luau code into the editor to check it.' });
        if (issues.length === 0) issues.push({ severity: 'info', line: 1, column: 1, message: 'No common issues found in this quick check.' });

        const errors = issues.filter((issue) => issue.severity === 'error').length;
        const warnings = issues.filter((issue) => issue.severity === 'warning').length;
        const suggestions = issues.filter((issue) => issue.severity === 'info').length;
        diagnosticsSummary.textContent = [errors && `${errors} error${errors === 1 ? '' : 's'}`, warnings && `${warnings} warning${warnings === 1 ? '' : 's'}`, suggestions && `${suggestions} suggestion${suggestions === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
        diagnosticsHint.textContent = 'These quick checks catch common issues; they are not a full Luau compiler.';

        issues.forEach((issue) => {
            const item = document.createElement('li');
            item.className = `code-diagnostic-item diagnostic-${issue.severity}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.innerHTML = `<span class="diagnostic-severity">${issue.severity === 'error' ? '●' : issue.severity === 'warning' ? '▲' : 'ⓘ'}</span><span class="diagnostic-location">${issue.line}:${issue.column}</span>`;
            const message = document.createElement('span');
            message.textContent = issue.message;
            button.appendChild(message);
            button.addEventListener('click', () => {
                const lines = sourceCode.value.split('\n');
                const offset = lines.slice(0, issue.line - 1).reduce((total, entry) => total + entry.length + 1, 0) + Math.max(0, issue.column - 1);
                sourceCode.focus();
                sourceCode.setSelectionRange(offset, offset);
                const lineHeight = parseFloat(getComputedStyle(sourceCode).lineHeight) || 21;
                sourceCode.scrollTop = Math.max(0, (issue.line - 1) * lineHeight - 70);
            });
            item.appendChild(button);
            diagnosticsList.appendChild(item);
        });
        diagnosticsPanel.classList.remove('hidden');
    }

    sourceCode.addEventListener('input', () => {
        updateLineNumbers();
        renderSyntaxHighlight();
        if (!diagnosticsPanel.classList.contains('hidden')) diagnosticsHint.textContent = 'Code changed since the last check. Select “Check code” to refresh these results.';
    });
    sourceCode.addEventListener('scroll', () => {
        lineNumbersEl.scrollTop = sourceCode.scrollTop;
        if (syntaxHighlightEl) {
            syntaxHighlightEl.scrollTop = sourceCode.scrollTop;
            syntaxHighlightEl.scrollLeft = sourceCode.scrollLeft;
        }
    });
    updateLineNumbers();
    renderSyntaxHighlight();
    if (checkCodeBtn) checkCodeBtn.addEventListener('click', runCodeCheck);
    if (closeDiagnosticsBtn) closeDiagnosticsBtn.addEventListener('click', () => diagnosticsPanel.classList.add('hidden'));

    sourceCode.addEventListener('input', () => {
        clearFieldError(sourceCode, codeError);
        setEditorDirty(true);
    });
    scriptTitle.addEventListener('input', () => {
        clearFieldError(scriptTitle, titleError);
        setEditorDirty(true);
    });

    if (backupNowBtn) {
        backupNowBtn.addEventListener('click', () => {
            const code = sourceCode.value;
            if (!code.trim()) {
                showToast('Paste a script into the editor before downloading a backup.', 'info');
                sourceCode.focus();
                return;
            }
            const title = scriptTitle.value.trim() || 'Untitled Vault';
            if (downloadLocalVaultBackup(activeVaultId.value, title, code)) {
                showToast('Backup download started. Check your browser’s Downloads.', 'success');
            } else {
                showToast('The browser could not start the backup download.', 'error');
            }
        });
    }

    let isSaving = false;

    document.addEventListener('keydown', (event) => {
        const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
        const isEditingVault = event.target === sourceCode || event.target === scriptTitle;
        if (!isSaveShortcut || !isEditingVault) return;
        event.preventDefault();
        lockBtn.click();
    });

    lockBtn.addEventListener('click', async () => {
        if (isSaving) return;
        if (!currentUser) {
            showToast('Still starting your session — try again in a second.', 'info');
            return;
        }
        if (!activeVaultId.value && vaultsLoadedForUid !== currentUser.uid) {
            showToast('Your saved scripts are still loading. Wait a moment, then try again.', 'info');
            return;
        }
        if (!activeVaultId.value && cachedVaults.length >= MAX_USER_VAULTS) {
            showToast('You can save up to 5 scripts. Delete one of your saved vaults before creating another.', 'warning', 8000);
            return;
        }
        const code = sourceCode.value;

        clearFieldError(sourceCode, codeError);

        if (!code.trim()) {
            setFieldError(sourceCode, codeError, "Your vault can't be empty — paste a script before locking it.");
            shakeElement(sourceCode);
            sourceCode.focus();
            return;
        }

        const title = scriptTitle.value.trim() || 'Untitled Vault';
        const vaultId = activeVaultId.value || ('vx_' + Math.random().toString(36).substring(2, 10));

        isSaving = true;
        const originalBtnHtml = lockBtn.innerHTML;
        lockBtn.disabled = true;
        lockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SAVING...';

        // Trigger the local download before awaiting Firestore so the browser
        // still recognizes the Save button click as the user's action.
        if (chkBackup && chkBackup.checked && !downloadLocalVaultBackup(vaultId, title, code)) {
            showToast('Vault saving will continue, but the browser could not start the .txt backup download.', 'info', 6000);
        }

        let currentExecutions = 0;
        let existingKeyFields = {
            requireKey: false, guiMode: false, guiAppearance: null, publicKeyConfig: null, keys: [], key: '', keyGeneratedAt: null,
            ipLock: false, boundIp: null, bannedUsers: []
        };

        if (activeVaultId.value) {
            try {
                const docSnap = await getDoc(doc(db, "vaults", vaultId));
                if (docSnap.exists()) {
                    const existing = docSnap.data();
                    currentExecutions = existing.executions || 0;
                    // Key system settings are managed on the separate Key System Manager
                    // page — saving the script here just carries them forward untouched.
                    existingKeyFields = {
                        requireKey: !!existing.requireKey,
                        guiMode: !!existing.guiMode,
                        guiAppearance: existing.guiAppearance || null,
                        publicKeyConfig: existing.publicKeyConfig || null,
                        keys: Array.isArray(existing.keys) ? existing.keys : [],
                        key: existing.key || '',
                        keyGeneratedAt: existing.keyGeneratedAt || null,
                        ipLock: !!existing.ipLock,
                        boundIp: existing.boundIp || null,
                        bannedUsers: Array.isArray(existing.bannedUsers) ? existing.bannedUsers : []
                    };
                }
            } catch (e) {}
        }

        const payload = {
            id: vaultId,
            title: title,
            code: code,
            ...existingKeyFields,
            executions: currentExecutions,
            autoDeleteAt: currentExecutions === 0 ? Date.now() + ZERO_EXECUTION_VAULT_TTL_MS : null,
            uid: currentUser.uid,
            updatedAt: Date.now()
        };

        try {
            await setDoc(doc(db, "vaults", vaultId), payload);
            const savedVault = { id: vaultId, data: payload };
            const savedIndex = cachedVaults.findIndex(vault => vault.id === vaultId);
            if (savedIndex >= 0) cachedVaults[savedIndex] = savedVault;
            else cachedVaults.push(savedVault);
            scheduleUnusedVaultCleanup(savedVault, currentUser.uid);
            updateVaultCount(cachedVaults.length);
            updateVaultOverview();
            renderVaultList();
            vaultExpiryWarningIds.delete(vaultId);
            activeVaultId.value = vaultId;

            if (execCountBadge && execCountNum) {
                execCountNum.textContent = currentExecutions;
                execCountBadge.classList.remove('hidden');
            }

            const primaryKey = existingKeyFields.keys[0] || (existingKeyFields.key ? { key: existingKeyFields.key } : null);
            const keyParam = (!existingKeyFields.guiMode && existingKeyFields.requireKey && primaryKey) ? `&key=${encodeURIComponent(primaryKey.key)}` : '';
            const rawUrl = `${window.location.origin}/api/raw?id=${vaultId}${keyParam}`;
            const loadstringCmd = `loadstring(game:HttpGet("${rawUrl}"))()`;

            lsOutput.value = loadstringCmd;
            resultOverlay.classList.remove('hidden');

            if (existingKeyFields.requireKey) {
                getKeyOutput.value = `${window.location.origin}/key.html?id=${vaultId}`;
                getKeyRow.classList.remove('hidden');
            } else {
                getKeyRow.classList.add('hidden');
            }

            showToast('Vault saved and locked!', 'success');
            setEditorDirty(false);
            setProtectionKeyStatus(existingKeyFields.requireKey);

            if (currentUser) {
                editingIndicator.classList.remove('hidden');
                deleteBtn.classList.remove('hidden');
                loadUserVaults();
            }

        } catch (err) {
            showToast('Failed to save vault: ' + friendlyAuthError(err), 'error', 6000);
        } finally {
            isSaving = false;
            lockBtn.disabled = false;
            lockBtn.innerHTML = originalBtnHtml;
        }
    });

    // ---------------- Delete Vault ----------------

    function resetEditor() {
        activeVaultId.value = '';
        scriptTitle.value = '';
        sourceCode.value = '';
        setEditorDirty(false);
        setProtectionKeyStatus(false);
        updateLineNumbers();
        renderSyntaxHighlight();
        diagnosticsPanel.classList.add('hidden');
        keysystemStatusBadge.textContent = 'OFF';
        keysystemStatusBadge.classList.remove('on');
        keysystemStatusBadge.classList.add('hidden');
        editingIndicator.classList.add('hidden');
        deleteBtn.classList.add('hidden');
        resultOverlay.classList.add('hidden');
        getKeyRow.classList.add('hidden');
        if (execCountBadge) execCountBadge.classList.add('hidden');
        clearFieldError(sourceCode, codeError);
        clearFieldError(scriptTitle, titleError);
    }

    const claimVaultBtn = document.getElementById('claim-vault-btn');
    claimVaultBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        if (vaultsLoadedForUid !== currentUser.uid) {
            showToast('Your saved scripts are still loading. Wait a moment, then try again.', 'info');
            return;
        }
        if (cachedVaults.length >= MAX_USER_VAULTS) {
            showToast('You can keep up to 5 scripts. Delete one before recovering another vault.', 'warning', 8000);
            return;
        }
        const vid = (window.prompt('Enter the ID of your old vault (looks like vx_abc12345):') || '').trim();
        if (!vid) return;
        try {
            const ref = doc(db, "vaults", vid);
            const snap = await getDoc(ref);
            if (!snap.exists()) { showToast('No vault found with that ID.', 'error'); return; }
            const d = snap.data();
            if (d.uid === currentUser.uid) { showToast('That vault is already yours.', 'info'); return; }
            if (d.uid !== 'guest') { showToast('That vault belongs to another account.', 'error'); return; }
            await updateDoc(ref, { uid: currentUser.uid });
            cachedVaults.push({ id: vid, data: { ...d, uid: currentUser.uid } });
            updateVaultCount(cachedVaults.length);
            updateVaultOverview();
            renderVaultList();
            showToast('Vault recovered — it is now tied to your account.', 'success');
            loadUserVaults();
        } catch (err) {
            showToast('Could not recover vault: ' + friendlyAuthError(err), 'error');
        }
    });

    newVaultBtn.addEventListener('click', () => {
        if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Discard them and start a new vault?')) return;
        resetEditor();
        scriptTitle.focus();
        showToast('Ready for a new vault.', 'info', 2000);
    });

    openKeysystemBtn.addEventListener('click', () => {
        if (!activeVaultId.value) {
            showToast('Save this vault first, then you can manage its key system.', 'info');
            return;
        }
        window.location.href = `keysystem.html?id=${activeVaultId.value}`;
    });

    deleteBtn.addEventListener('click', async () => {
        const id = activeVaultId.value;
        if (!id) return;

        const confirmed = await customConfirm({
            title: 'Delete this vault?',
            message: `"${scriptTitle.value || 'Untitled Vault'}" will be permanently deleted. This can't be undone.`,
            confirmLabel: 'Delete Vault'
        });
        if (!confirmed) return;

        const originalBtnHtml = deleteBtn.innerHTML;
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> DELETING...';

        try {
            await deleteDoc(doc(db, "vaults", id));
            resetEditor();
            showToast('Vault deleted.', 'info');
            loadUserVaults();
        } catch (err) {
            showToast('Failed to delete vault: ' + friendlyAuthError(err), 'error', 6000);
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalBtnHtml;
        }
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(lsOutput.value);
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> COPIED!';
        showToast('Loadstring copied to clipboard.', 'success', 2000);
        setTimeout(() => copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> COPY LOADSTRING', 2000);
    });
});

// ============================================================
// Share Your Ideas — sends feature requests to Firestore
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const ideasBtn = document.getElementById('ideas-btn');
    const ideasModal = document.getElementById('ideas-modal');
    if (!ideasBtn || !ideasModal) return;

    const ideasCloseX = document.getElementById('ideas-close-x');
    const ideasCancelBtn = document.getElementById('ideas-cancel-btn');
    const ideasSubmitBtn = document.getElementById('ideas-submit-btn');
    const ideasSubmitLabel = document.getElementById('ideas-submit-label');
    const ideasName = document.getElementById('ideas-name');
    const ideasText = document.getElementById('ideas-text');
    const ideasError = document.getElementById('ideas-error');
    const ideasCount = document.getElementById('ideas-count');

    const IDEA_MIN = 10;
    const IDEA_MAX = 1000;

    const openIdeasModal = () => {
        ideasModal.classList.remove('hidden');
        clearFieldError(ideasText, ideasError);
        setTimeout(() => ideasText.focus(), 50);
    };

    const closeIdeasModal = () => {
        ideasModal.classList.add('hidden');
    };

    ideasBtn.addEventListener('click', openIdeasModal);
    ideasCloseX.addEventListener('click', closeIdeasModal);
    ideasCancelBtn.addEventListener('click', closeIdeasModal);
    ideasModal.addEventListener('click', (e) => {
        if (e.target === ideasModal) closeIdeasModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !ideasModal.classList.contains('hidden')) closeIdeasModal();
    });

    ideasText.addEventListener('input', () => {
        ideasCount.textContent = `${ideasText.value.length} / ${IDEA_MAX}`;
        clearFieldError(ideasText, ideasError);
    });

    ideasSubmitBtn.addEventListener('click', async () => {
        const idea = ideasText.value.trim();
        const name = ideasName.value.trim();

        if (idea.length < IDEA_MIN) {
            setFieldError(ideasText, ideasError, `Give us a bit more detail — at least ${IDEA_MIN} characters.`);
            shakeElement(ideasText);
            return;
        }
        clearFieldError(ideasText, ideasError);

        ideasSubmitBtn.disabled = true;
        ideasSubmitLabel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SENDING...';

        try {
            await addDoc(collection(db, 'feature_requests'), {
                name: name || 'Anonymous',
                idea: idea,
                uid: currentUser ? currentUser.uid : null,
                email: currentUser && currentUser.email ? currentUser.email : null,
                page: 'index',
                userAgent: navigator.userAgent,
                createdAt: serverTimestamp()
            });

            showToast('Thanks! Your idea was sent to the VoidedX team.', 'success');
            ideasText.value = '';
            ideasName.value = '';
            ideasCount.textContent = `0 / ${IDEA_MAX}`;
            closeIdeasModal();
        } catch (err) {
            showToast('Couldn\'t send your idea: ' + friendlyAuthError(err), 'error', 6000);
        } finally {
            ideasSubmitBtn.disabled = false;
            ideasSubmitLabel.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Idea';
        }
    });
});
