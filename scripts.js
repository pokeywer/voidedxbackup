import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: 'AIzaSyBdAR4ARjHccTlxrmP9tzdYGJxo4MvETXw',
    authDomain: 'voidedx-fe79f.firebaseapp.com',
    projectId: 'voidedx-fe79f',
    storageBucket: 'voidedx-fe79f.firebasestorage.app',
    messagingSenderId: '784635868195',
    appId: '1:784635868195:web:6e879214df4238bc2aad96'
};

const auth = getAuth(initializeApp(firebaseConfig));
const $ = (selector) => document.querySelector(selector);
const grid = $('#script-grid');
const emptyState = $('#scripts-empty');
const searchInput = $('#script-search-input');
const categoryFilter = $('#script-category-filter');
const sortSelect = $('#script-sort');
const toastContainer = $('#scripts-toast-container');
const authModal = $('#scripts-auth-modal');
const uploadModal = $('#script-upload-modal');
const detailModal = $('#script-detail-modal');

let currentUser = null;
let activeTab = 'explore';
let publicScripts = [];
let myScripts = [];
const storedSavedIds = readStorage('voidedx-community-saved', []);
let savedIds = Array.isArray(storedSavedIds) ? storedSavedIds.filter(id => typeof id === 'string') : [];
let likedIds = {};
let activeLikedUid = null;
let selectedScript = null;
let authMode = 'login';
let afterSignInAction = '';

function readStorage(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
}

function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function showToast(message, kind = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${kind}`;
    const icon = document.createElement('i');
    icon.className = `fa-solid ${kind === 'success' ? 'fa-circle-check' : kind === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'} toast-icon`;
    const text = document.createElement('span');
    text.textContent = message;
    const close = document.createElement('button');
    close.className = 'toast-close'; close.type = 'button'; close.setAttribute('aria-label', 'Dismiss'); close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    toast.append(icon, text, close); toastContainer.appendChild(toast);
    const remove = () => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 200); };
    close.addEventListener('click', remove); setTimeout(remove, 4200);
}

function openModal(modal) { modal.classList.remove('hidden'); }
function closeModal(modal) { modal.classList.add('hidden'); }

async function requestApi(url, { method = 'GET', body, authRequired = false } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (authRequired && currentUser) headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
    const options = { method, headers, body: body ? JSON.stringify(body) : undefined };
    // The public browse list is shared by all visitors and the API response is
    // cached at Vercel. Keep authenticated, changing, and detail requests private.
    if (method !== 'GET' || url !== '/api/scripts') options.cache = 'no-store';
    const response = await fetch(url, options);
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok || data.ok === false) throw new Error(data.message || 'Something went wrong. Please try again.');
    return data;
}

function number(value) { return Math.max(0, Number(value) || 0).toLocaleString(); }
function dateLabel(timestamp) {
    if (!timestamp) return 'Recently';
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp)); }
    catch { return 'Recently'; }
}

function allRelevantScripts() {
    if (activeTab === 'mine') return myScripts;
    if (activeTab === 'saved') return publicScripts.filter(script => savedIds.includes(script.id));
    return publicScripts;
}

function makeTag(label) {
    const tag = document.createElement('span');
    tag.className = 'script-tag'; tag.textContent = label;
    return tag;
}

function scriptCard(script) {
    const card = document.createElement('article');
    card.className = 'script-card';
    card.dataset.scriptId = script.id;
    const top = document.createElement('div');
    top.className = 'script-card-top';
    const category = document.createElement('span');
    category.className = `script-card-category category-${String(script.category || 'Other').toLowerCase()}`;
    category.innerHTML = `<i class="fa-solid ${script.category === 'Utility' ? 'fa-screwdriver-wrench' : script.category === 'Combat' ? 'fa-bolt' : script.category === 'Simulator' ? 'fa-gamepad' : script.category === 'Universal' ? 'fa-globe' : 'fa-cubes'}"></i>`;
    category.append(document.createTextNode(` ${script.category || 'Other'}`));
    top.appendChild(category);
    if (activeTab === 'mine') {
        const status = document.createElement('span');
        status.className = `script-review-status status-${script.status || 'pending'}`;
        status.textContent = script.status === 'approved' ? 'Live' : script.status === 'rejected' ? 'Not approved' : script.status === 'hidden' ? 'Hidden by moderator' : 'In review';
        top.appendChild(status);
    }
    const title = document.createElement('h3'); title.textContent = script.title;
    const description = document.createElement('p'); description.className = 'script-card-description'; description.textContent = script.description || 'Community shared script.';
    const game = document.createElement('div'); game.className = 'script-card-game'; game.innerHTML = '<i class="fa-solid fa-gamepad"></i> ';
    game.append(document.createTextNode(script.game || 'Any game'));
    const tags = document.createElement('div'); tags.className = 'script-card-tags';
    (script.tags || []).slice(0, 4).forEach(tag => tags.appendChild(makeTag(tag)));
    const author = document.createElement('div'); author.className = 'script-card-author';
    const avatar = document.createElement('span'); avatar.className = 'script-avatar'; avatar.textContent = (script.authorName || 'C').slice(0, 1).toUpperCase();
    const authorCopy = document.createElement('span'); authorCopy.className = 'script-author-copy';
    const authorName = document.createElement('strong'); authorName.textContent = script.authorName || 'Community member';
    const added = document.createElement('small'); added.textContent = dateLabel(script.createdAt);
    authorCopy.append(authorName, added); author.append(avatar, authorCopy);
    const stats = document.createElement('div'); stats.className = 'script-card-stats';
    stats.innerHTML = `<span title="Likes"><i class="fa-solid fa-heart"></i> ${number(script.likes)}</span><span title="Views"><i class="fa-solid fa-eye"></i> ${number(script.views)}</span><span title="Downloads"><i class="fa-solid fa-download"></i> ${number(script.downloads)}</span>`;
    const footer = document.createElement('div'); footer.className = 'script-card-footer'; footer.append(author, stats);
    const actions = document.createElement('div'); actions.className = 'script-card-actions';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'btn-accent script-open-btn'; open.dataset.action = 'open'; open.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> View script';
    const isSaved = savedIds.includes(script.id);
    const save = document.createElement('button'); save.type = 'button'; save.className = `btn-ghost script-icon-btn${isSaved ? ' active' : ''}`; save.dataset.action = 'save'; save.setAttribute('aria-label', isSaved ? 'Remove saved script' : 'Save script'); save.innerHTML = `<i class="fa-${isSaved ? 'solid' : 'regular'} fa-bookmark"></i>`;
    actions.append(open, save);
    if (activeTab === 'mine') {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn-ghost script-icon-btn script-remove-btn'; remove.dataset.action = 'remove'; remove.setAttribute('aria-label', 'Remove upload'); remove.innerHTML = '<i class="fa-solid fa-trash"></i>'; actions.appendChild(remove);
    } else {
        const like = document.createElement('button'); like.type = 'button'; like.className = `btn-ghost script-icon-btn${likedIds[script.id] ? ' active' : ''}`; like.dataset.action = 'like'; like.setAttribute('aria-label', 'Like script'); like.innerHTML = `<i class="fa-${likedIds[script.id] ? 'solid' : 'regular'} fa-heart"></i>`; actions.appendChild(like);
    }
    card.append(top, title, description, game, tags, footer, actions);
    return card;
}

function render() {
    const queryText = searchInput.value.trim().toLowerCase();
    let list = allRelevantScripts().filter(script => {
        const categoryMatch = categoryFilter.value === 'all' || script.category === categoryFilter.value;
        const haystack = [script.title, script.description, script.game, script.authorName, ...(script.tags || [])].join(' ').toLowerCase();
        return categoryMatch && (!queryText || haystack.includes(queryText));
    });
    const sort = sortSelect.value;
    const keys = { popular: 'likes', recent: 'createdAt', viewed: 'views', downloaded: 'downloads' };
    list.sort((a, b) => (Number(b[keys[sort]]) || 0) - (Number(a[keys[sort]]) || 0));
    grid.replaceChildren();
    list.forEach(script => grid.appendChild(scriptCard(script)));
    grid.classList.toggle('hidden', list.length === 0);
    emptyState.classList.toggle('hidden', list.length !== 0);
    $('#explore-count').textContent = number(publicScripts.length);
    $('#saved-count').textContent = number(savedIds.filter(id => publicScripts.some(script => script.id === id)).length);
    $('#mine-count').textContent = number(myScripts.length);
}

function updateStats() {
    $('#scripts-stat-count').textContent = number(publicScripts.length);
    $('#scripts-stat-likes').textContent = number(publicScripts.reduce((sum, script) => sum + (Number(script.likes) || 0), 0));
    $('#scripts-stat-views').textContent = number(publicScripts.reduce((sum, script) => sum + (Number(script.views) || 0), 0));
}

async function loadPublicScripts() {
    try {
        const data = await requestApi('/api/scripts');
        publicScripts = data.scripts || [];
        updateStats(); render();
        const sharedId = new URLSearchParams(location.search).get('id');
        if (sharedId) openScript(sharedId, false);
    } catch (error) {
        grid.innerHTML = '';
        const message = document.createElement('div'); message.className = 'info-box'; message.textContent = `${error.message} If this is your first deployment, confirm the Firebase service account is configured on Vercel.`;
        grid.appendChild(message);
    }
}

async function loadMyScripts() {
    if (!currentUser || currentUser.isAnonymous) { myScripts = []; render(); return; }
    try {
        const data = await requestApi('/api/scripts?mine=1', { authRequired: true });
        myScripts = data.scripts || [];
        render();
    } catch (error) { showToast(error.message, 'error'); }
}

function requireAccount(action) {
    if (currentUser && !currentUser.isAnonymous && currentUser.email) return true;
    afterSignInAction = action;
    setAuthMode('login');
    openModal(authModal);
    showToast('Sign in with an account to continue.', 'info');
    return false;
}

function setAuthMode(mode) {
    authMode = mode;
    $('#scripts-login-tab').classList.toggle('active', mode === 'login');
    $('#scripts-signup-tab').classList.toggle('active', mode === 'signup');
    $('#scripts-auth-heading').textContent = mode === 'signup' ? 'Create your account' : 'Welcome to VoidedX';
    $('#scripts-auth-subtitle').textContent = mode === 'signup' ? 'Create an account to share with the community.' : 'Sign in to like, save, and upload scripts.';
    $('#scripts-auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('#scripts-auth-submit').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    $('#scripts-auth-error').classList.add('hidden');
}

async function openUpload() {
    if (!requireAccount('upload')) return;
    $('#script-upload-form').reset(); $('#upload-code-count').textContent = '0 / 40,000'; $('#upload-error').classList.add('hidden');
    openModal(uploadModal);
}

function setButtonLoading(button, loading, label) {
    if (loading) { button.dataset.original = button.innerHTML; button.disabled = true; button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`; }
    else { button.disabled = false; if (button.dataset.original) { button.innerHTML = button.dataset.original; delete button.dataset.original; } }
}

async function handleUpload(event) {
    event.preventDefault();
    if (!requireAccount('upload')) return;
    const button = $('#upload-submit-btn');
    const error = $('#upload-error'); error.classList.add('hidden');
    const body = {
        action: 'submit',
        title: $('#upload-title').value.trim(),
        authorName: $('#upload-author').value.trim(),
        description: $('#upload-description').value.trim(),
        game: $('#upload-game').value.trim(),
        category: $('#upload-category').value,
        tags: $('#upload-tags').value.split(',').map(tag => tag.trim()).filter(Boolean),
        code: $('#upload-code').value,
        acceptedRules: $('#upload-rules-check').checked
    };
    setButtonLoading(button, true, 'SENDING FOR REVIEW…');
    try {
        await requestApi('/api/scripts', { method: 'POST', body, authRequired: true });
        closeModal(uploadModal);
        activeTab = 'mine'; setActiveTab('mine');
        await loadMyScripts();
        showToast('Script submitted. It will appear after a moderator approves it.', 'success');
    } catch (error) { $('#upload-error').textContent = error.message; $('#upload-error').classList.remove('hidden'); }
    finally { setButtonLoading(button, false); }
}

function setActiveTab(tab) {
    activeTab = tab;
    if (tab === 'mine') categoryFilter.value = 'all';
    document.querySelectorAll('.script-tab').forEach(button => {
        const active = button.dataset.tab === tab;
        button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    });
    const filtersVisible = tab !== 'mine';
    categoryFilter.classList.toggle('hidden', !filtersVisible);
    sortSelect.classList.toggle('hidden', !filtersVisible);
    if (tab === 'mine') loadMyScripts();
    render();
}

async function toggleLike(scriptId) {
    if (!requireAccount('like')) return;
    try {
        const data = await requestApi('/api/scripts', { method: 'POST', body: { action: 'like', scriptId }, authRequired: true });
        likedIds[scriptId] = data.liked;
        if (!data.liked) delete likedIds[scriptId];
        writeStorage(`voidedx-community-liked-${currentUser.uid}`, likedIds);
        const item = publicScripts.find(script => script.id === scriptId);
        if (item) item.likes = data.likes;
        if (selectedScript?.id === scriptId) {
            selectedScript.likes = data.likes;
            $('#detail-like-btn').classList.toggle('active', data.liked);
            $('#detail-like-btn').innerHTML = `<i class="fa-${data.liked ? 'solid' : 'regular'} fa-heart"></i> ${data.liked ? 'Liked' : 'Like'}`;
        }
        render(); updateStats();
    } catch (error) { showToast(error.message, 'error'); }
}

function toggleSave(scriptId) {
    if (savedIds.includes(scriptId)) savedIds = savedIds.filter(id => id !== scriptId);
    else savedIds = [...savedIds, scriptId];
    writeStorage('voidedx-community-saved', savedIds);
    render();
    if (selectedScript?.id === scriptId) {
        const saved = savedIds.includes(scriptId);
        $('#detail-save-btn').classList.toggle('active', saved);
        $('#detail-save-btn').innerHTML = `<i class="fa-${saved ? 'solid' : 'regular'} fa-bookmark"></i> ${saved ? 'Saved' : 'Save'}`;
    }
    showToast(savedIds.includes(scriptId) ? 'Added to your saved scripts.' : 'Removed from saved scripts.', 'success');
}

async function openScript(scriptId, updateUrl = true) {
    const item = publicScripts.find(script => script.id === scriptId);
    if (!item) { showToast('This script is not available right now.', 'error'); return; }
    $('#detail-title').textContent = item.title;
    $('#detail-description').textContent = item.description || '';
    $('#detail-category').textContent = item.category || 'Other';
    const detailAuthor = $('#detail-author');
    const detailGame = $('#detail-game');
    const detailDate = $('#detail-date');
    detailAuthor.replaceChildren(Object.assign(document.createElement('i'), { className: 'fa-solid fa-user' }), document.createTextNode(` ${item.authorName || 'Community member'}`));
    detailGame.replaceChildren(Object.assign(document.createElement('i'), { className: 'fa-solid fa-gamepad' }), document.createTextNode(` ${item.game || 'Any game'}`));
    detailDate.replaceChildren(Object.assign(document.createElement('i'), { className: 'fa-regular fa-calendar' }), document.createTextNode(` ${dateLabel(item.createdAt)}`));
    $('#detail-code').value = 'Loading script source…';
    $('#detail-tags').replaceChildren(...(item.tags || []).map(makeTag));
    $('#report-form').classList.add('hidden'); $('#report-reason').value = '';
    $('#detail-like-btn').classList.toggle('active', !!likedIds[scriptId]);
    $('#detail-like-btn').innerHTML = `<i class="fa-${likedIds[scriptId] ? 'solid' : 'regular'} fa-heart"></i> ${likedIds[scriptId] ? 'Liked' : 'Like'} · ${number(item.likes)}`;
    $('#detail-save-btn').classList.toggle('active', savedIds.includes(scriptId));
    $('#detail-save-btn').innerHTML = `<i class="fa-${savedIds.includes(scriptId) ? 'solid' : 'regular'} fa-bookmark"></i> ${savedIds.includes(scriptId) ? 'Saved' : 'Save'}`;
    selectedScript = item;
    openModal(detailModal);
    if (updateUrl) history.pushState({ scriptId }, '', `/scripts?id=${encodeURIComponent(scriptId)}`);
    try {
        const data = await requestApi(`/api/scripts?id=${encodeURIComponent(scriptId)}`);
        if (selectedScript?.id !== scriptId) return;
        selectedScript = data.script;
        $('#detail-code').value = data.script.code;
        item.views = data.script.views;
        render(); updateStats();
    } catch (error) {
        $('#detail-code').value = '';
        $('#detail-description').textContent = error.message;
    }
}

function closeDetail() {
    closeModal(detailModal); selectedScript = null;
    if (new URLSearchParams(location.search).has('id')) history.pushState({}, '', '/scripts');
}

async function copyCode() {
    const code = $('#detail-code').value;
    try { await navigator.clipboard.writeText(code); showToast('Script copied to clipboard.', 'success'); }
    catch { $('#detail-code').focus(); $('#detail-code').select(); showToast('Press Ctrl+C to copy the selected script.', 'info'); }
}

async function downloadCode() {
    if (!selectedScript || !$('#detail-code').value) return;
    const blob = new Blob([$('#detail-code').value], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedScript.title.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64) || 'community_script'}.txt`;
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    if (currentUser && !currentUser.isAnonymous) {
        try { await requestApi('/api/scripts', { method: 'POST', body: { action: 'download', scriptId: selectedScript.id }, authRequired: true }); }
        catch {}
    }
    showToast('Script downloaded as a text file.', 'success');
}

async function shareScript() {
    if (!selectedScript) return;
    const link = `${location.origin}/scripts?id=${encodeURIComponent(selectedScript.id)}`;
    try {
        if (navigator.share) await navigator.share({ title: selectedScript.title, text: 'Check out this community script on VoidedX.', url: link });
        else { await navigator.clipboard.writeText(link); showToast('Script link copied to clipboard.', 'success'); }
    } catch (error) {
        if (error.name !== 'AbortError') showToast('Could not share the link. You can copy it from the browser address bar.', 'error');
    }
}

async function submitReport() {
    if (!selectedScript || !requireAccount('report')) return;
    const button = $('#report-submit-btn'); setButtonLoading(button, true, 'SENDING…');
    try {
        const data = await requestApi('/api/scripts', { method: 'POST', body: { action: 'report', scriptId: selectedScript.id, reason: $('#report-reason').value }, authRequired: true });
        showToast(data.message, 'success'); $('#report-form').classList.add('hidden');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setButtonLoading(button, false); }
}

async function removeUpload(id) {
    if (!confirm('Remove this script upload from the community?')) return;
    try {
        await requestApi(`/api/scripts?id=${encodeURIComponent(id)}`, { method: 'DELETE', authRequired: true });
        myScripts = myScripts.filter(script => script.id !== id);
        publicScripts = publicScripts.filter(script => script.id !== id);
        render(); updateStats(); showToast('Your upload was removed.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
}

async function submitAuth() {
    const email = $('#scripts-auth-email').value.trim();
    const password = $('#scripts-auth-password').value;
    const error = $('#scripts-auth-error');
    error.classList.add('hidden');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error.textContent = 'Enter a valid email address.'; error.classList.remove('hidden'); return; }
    if (!password || (authMode === 'signup' && password.length < 6)) { error.textContent = authMode === 'signup' ? 'Use a password with at least 6 characters.' : 'Enter your password.'; error.classList.remove('hidden'); return; }
    const button = $('#scripts-auth-submit'); setButtonLoading(button, true, authMode === 'signup' ? 'CREATING ACCOUNT…' : 'SIGNING IN…');
    try {
        if (authMode === 'signup') await createUserWithEmailAndPassword(auth, email, password);
        else await signInWithEmailAndPassword(auth, email, password);
        currentUser = auth.currentUser;
        closeModal(authModal); showToast(authMode === 'signup' ? 'Account created. Welcome to the community!' : 'You are signed in.', 'success');
        if (afterSignInAction === 'upload') { afterSignInAction = ''; await openUpload(); }
        if (activeTab === 'mine') await loadMyScripts();
    } catch (err) {
        const friendly = {
            'auth/invalid-credential': 'That email and password do not match.',
            'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
            'auth/weak-password': 'Use a stronger password with at least 6 characters.',
            'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
            'auth/invalid-email': 'Enter a valid email address.'
        };
        error.textContent = friendly[err.code] || 'Could not sign in. Check your connection and try again.'; error.classList.remove('hidden');
    } finally { setButtonLoading(button, false); }
}

$('#scripts-auth-btn').addEventListener('click', async () => {
    if (currentUser && !currentUser.isAnonymous) {
        await signOut(auth); showToast('You are signed out.', 'info'); return;
    }
    afterSignInAction = ''; setAuthMode('login'); openModal(authModal);
});
$('#scripts-login-tab').addEventListener('click', () => setAuthMode('login'));
$('#scripts-signup-tab').addEventListener('click', () => setAuthMode('signup'));
$('#scripts-auth-submit').addEventListener('click', submitAuth);
$('#scripts-auth-password').addEventListener('keydown', event => { if (event.key === 'Enter') submitAuth(); });
$('#scripts-auth-email').addEventListener('keydown', event => { if (event.key === 'Enter') $('#scripts-auth-password').focus(); });
$('#hero-upload-btn').addEventListener('click', openUpload);
$('#browser-upload-btn').addEventListener('click', openUpload);
$('#guidelines-open-upload').addEventListener('click', event => { event.preventDefault(); openUpload(); });
document.querySelectorAll('[data-open-upload]').forEach(button => button.addEventListener('click', openUpload));
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => {
    const modal = button.closest('.modal-overlay'); closeModal(modal); if (modal === detailModal) closeDetail();
}));
[authModal, uploadModal, detailModal].forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) { closeModal(modal); if (modal === detailModal) closeDetail(); } }));
$('#script-upload-form').addEventListener('submit', handleUpload);
$('#upload-code').addEventListener('input', event => { $('#upload-code-count').textContent = `${event.target.value.length.toLocaleString()} / 40,000`; });
document.querySelectorAll('.script-tab').forEach(button => button.addEventListener('click', () => setActiveTab(button.dataset.tab)));
[searchInput, categoryFilter, sortSelect].forEach(input => input.addEventListener('input', render));

grid.addEventListener('click', event => {
    const card = event.target.closest('[data-script-id]');
    if (!card) return;
    const id = card.dataset.scriptId;
    const button = event.target.closest('[data-action]');
    const action = button?.dataset.action || 'open';
    if (action === 'open') {
        const script = activeTab === 'mine' ? myScripts.find(item => item.id === id) : publicScripts.find(item => item.id === id);
        if (script?.status && script.status !== 'approved') { showToast('This upload is still being reviewed.', 'info'); return; }
        openScript(id);
    } else if (action === 'save') toggleSave(id);
    else if (action === 'like') toggleLike(id);
    else if (action === 'remove') removeUpload(id);
});

$('#detail-copy-btn').addEventListener('click', copyCode);
$('#detail-download-btn').addEventListener('click', downloadCode);
$('#detail-share-btn').addEventListener('click', shareScript);
$('#detail-like-btn').addEventListener('click', () => selectedScript && toggleLike(selectedScript.id));
$('#detail-save-btn').addEventListener('click', () => selectedScript && toggleSave(selectedScript.id));
$('#report-toggle-btn').addEventListener('click', () => {
    if (!requireAccount('report')) return;
    $('#report-form').classList.toggle('hidden');
});
$('#report-submit-btn').addEventListener('click', submitReport);
window.addEventListener('keydown', event => {
    if (event.key === '/' && !event.target.matches('input, textarea')) { event.preventDefault(); searchInput.focus(); }
    if (event.key === 'Escape') {
        if (!detailModal.classList.contains('hidden')) closeDetail();
        else [authModal, uploadModal].forEach(closeModal);
    }
});
window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) closeModal(detailModal);
});

onAuthStateChanged(auth, user => {
    currentUser = user;
    const likedUid = user && !user.isAnonymous ? user.uid : null;
    if (likedUid !== activeLikedUid) {
        activeLikedUid = likedUid;
        const stored = likedUid ? readStorage(`voidedx-community-liked-${likedUid}`, {}) : {};
        likedIds = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    }
    const label = $('#scripts-user-label');
    const button = $('#scripts-auth-btn');
    if (user && !user.isAnonymous) {
        label.innerHTML = '<i class="fa-solid fa-user-check text-cyan"></i> ';
        label.append(document.createTextNode(user.displayName || user.email || 'Member'));
        button.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Sign out';
        if (activeTab === 'mine') loadMyScripts();
    } else {
        label.innerHTML = '<i class="fa-solid fa-user"></i> Guest';
        button.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign in';
        myScripts = []; render();
    }
});

loadPublicScripts();
