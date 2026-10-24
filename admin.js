import { obfuscateLua, resolveObfuscationLevel, encodeVaultSource, encodeObfuscatedCode, getUtf8ByteLength, MAX_VAULT_SOURCE_BYTES, MAX_OBFUSCATED_OUTPUT_BYTES } from './lua-medium.js';

const loginView = document.getElementById('admin-login-view');
const dashboardView = document.getElementById('admin-dashboard-view');
const usernameInput = document.getElementById('admin-username');
const passwordInput = document.getElementById('admin-password');
const loginButton = document.getElementById('admin-login-btn');
const loginError = document.getElementById('admin-login-error');
const statusBox = document.getElementById('admin-status');
const ideasList = document.getElementById('admin-ideas-list');
const pendingScriptsList = document.getElementById('admin-script-pending-list');
const reportedScriptsList = document.getElementById('admin-script-reported-list');
const managedScriptsList = document.getElementById('admin-managed-script-list');
let managedScripts = [];
const adminVaultList = document.getElementById('admin-vault-list');
const adminVaultStatus = document.getElementById('admin-vault-status');
const adminVaultSearch = document.getElementById('admin-vault-search');
const adminVaultTitle = document.getElementById('admin-vault-title');
const adminVaultSource = document.getElementById('admin-vault-source');
const adminVaultObfuscation = document.getElementById('admin-vault-obfuscation');
const adminVaultLevel = document.getElementById('admin-vault-level');
const adminVaultTamper = document.getElementById('admin-vault-tamper');
const adminVaultVm = document.getElementById('admin-vault-vm');
const adminVaultSplitting = document.getElementById('admin-vault-splitting');
const adminVaultOutput = document.getElementById('admin-vault-obfuscated-output');
const adminVaultPreviewWrap = document.getElementById('admin-vault-preview-wrap');
const adminVaultEditFields = document.getElementById('admin-vault-edit-fields');
const adminVaultEmpty = document.getElementById('admin-vault-empty');
const adminVaultPreviewButton = document.getElementById('admin-vault-preview-btn');
const adminVaultFormControls = [adminVaultTitle, adminVaultSource, adminVaultObfuscation, adminVaultLevel, adminVaultTamper, adminVaultVm, adminVaultSplitting];
let adminVaults = [];
let activeAdminVault = null;
let adminVaultDirty = false;
let adminVaultSaving = false;
let adminVaultRevision = 0;
let adminVaultPreviewIsCurrent = false;
let adminVaultPreviewSignature = '';
let adminVaultLoadSequence = 0;

async function requestJson(path, options = {}) {
    const response = await fetch(path, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok || data.ok === false) throw new Error(data.message || 'The request could not be completed.');
    return data;
}

function setStatus(message, kind = 'info') {
    statusBox.textContent = message;
    statusBox.className = `admin-status ${kind}`;
    statusBox.classList.remove('hidden');
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
}

function setLoggedIn(isLoggedIn) {
    loginView.classList.toggle('hidden', isLoggedIn);
    dashboardView.classList.toggle('hidden', !isLoggedIn);
    if (isLoggedIn) statusBox.classList.add('hidden');
    else clearAdminVaultWorkspace();
}

function setLoading(button, loading, label) {
    if (!button) return;
    button.disabled = loading;
    if (loading) {
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;
    } else if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }
}

async function checkSession() {
    try {
        const data = await requestJson('/api/admin-auth');
        if (!data.configured) {
            showLoginError('Admin setup is incomplete. Add the Vercel environment variables, use a password with at least 12 characters, and set a separate random session secret of at least 32 bytes. Then redeploy.');
            return;
        }
        if (data.authenticated) {
            setLoggedIn(true);
            await refreshDashboard();
        }
    } catch (error) {
        showLoginError(error.message);
    }
}

async function signIn() {
    loginError.classList.add('hidden');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
        showLoginError('Enter your admin username and password.');
        return;
    }

    setLoading(loginButton, true, 'SIGNING IN…');
    try {
        await requestJson('/api/admin-auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username, password })
        });
        passwordInput.value = '';
        setLoggedIn(true);
        await refreshDashboard();
    } catch (error) {
        showLoginError(error.message);
    } finally {
        setLoading(loginButton, false);
    }
}

function formatDate(value) {
    if (!value) return 'Date unavailable';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
        return 'Date unavailable';
    }
}

function setVaultStatus(message, kind = 'info') {
    adminVaultStatus.textContent = message;
    adminVaultStatus.className = `admin-status ${kind}`;
}

function clearAdminVaultWorkspace() {
    activeAdminVault = null;
    adminVaults = [];
    adminVaultDirty = false;
    adminVaultRevision += 1;
    adminVaultTitle.value = '';
    adminVaultSource.value = '';
    adminVaultSearch.value = '';
    adminVaultList.replaceChildren();
    clearAdminVaultPreview();
    setAdminVaultEditorEnabled(false);
    adminVaultStatus.classList.add('hidden');
}

function currentAdminVaultSignature() {
    return JSON.stringify({
        title: adminVaultTitle.value,
        source: adminVaultSource.value,
        enabled: adminVaultObfuscation.checked,
        level: adminVaultLevel.value,
        tamper: adminVaultTamper.checked,
        vm: adminVaultVm.checked,
        splitting: adminVaultSplitting.checked
    });
}

function clearAdminVaultPreview() {
    adminVaultRevision += 1;
    adminVaultOutput.value = '';
    adminVaultPreviewWrap.classList.add('hidden');
    adminVaultPreviewIsCurrent = false;
    adminVaultPreviewSignature = '';
    document.getElementById('admin-vault-copy-output').disabled = true;
    document.getElementById('admin-vault-download-output').disabled = true;
}

function invalidateAdminVaultPreview() {
    adminVaultRevision += 1;
    if (!adminVaultOutput.value) return;
    adminVaultPreviewIsCurrent = false;
    document.getElementById('admin-vault-copy-output').disabled = true;
    document.getElementById('admin-vault-download-output').disabled = true;
    setVaultStatus('The source or protection settings changed. Generate a fresh preview before using the output.', 'info');
}

function markAdminVaultDirty() {
    adminVaultDirty = true;
    invalidateAdminVaultPreview();
    setVaultStatus(`Unsaved changes to ${activeAdminVault?.title || 'this vault'}. Saving replaces the live source.${adminVaultOutput.value ? ' The old preview is stale.' : ''}`, 'info');
}

function getAdminVaultObfuscationSettings() {
    const enabled = adminVaultObfuscation.checked;
    const vmProtection = enabled && adminVaultVm.checked;
    return {
        enabled,
        requestedLevel: adminVaultLevel.value,
        effectiveLevel: resolveObfuscationLevel(adminVaultSource.value, adminVaultLevel.value),
        protection: {
            tamperCheck: !vmProtection && adminVaultTamper.checked,
            vmProtection,
            expandedTransforms: !vmProtection && adminVaultSplitting.checked
        }
    };
}

function syncAdminVaultProtectionControls() {
    const enabled = !!activeAdminVault && adminVaultObfuscation.checked;
    const vmProtection = enabled && adminVaultVm.checked;
    adminVaultLevel.disabled = !enabled || vmProtection;
    adminVaultTamper.disabled = !enabled || vmProtection;
    adminVaultVm.disabled = !activeAdminVault || !adminVaultObfuscation.checked;
    adminVaultSplitting.disabled = !enabled || vmProtection;
    if (adminVaultPreviewButton) adminVaultPreviewButton.disabled = !enabled || !activeAdminVault;
}

function renderAdminVaultList() {
    const query = adminVaultSearch.value.trim().toLocaleLowerCase();
    const visible = adminVaults.filter(vault => `${vault.title} ${vault.id} ${vault.ownerUid}`.toLocaleLowerCase().includes(query));
    adminVaultList.replaceChildren();
    document.getElementById('admin-vault-count').textContent = query
        ? `${visible.length} shown · ${adminVaults.length} total`
        : `${adminVaults.length} vault${adminVaults.length === 1 ? '' : 's'}`;
    if (!visible.length) {
        const empty = document.createElement('div');
        empty.className = 'info-box';
        const text = document.createElement('p');
        text.textContent = adminVaults.length ? 'No vaults match this search.' : 'No vaults are saved yet.';
        empty.appendChild(text);
        adminVaultList.appendChild(empty);
        return;
    }
    visible.forEach(vault => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `admin-vault-item${activeAdminVault?.id === vault.id ? ' selected' : ''}`;
        button.dataset.vaultId = vault.id;
        const title = document.createElement('strong');
        title.textContent = vault.title || 'Untitled Vault';
        const detail = document.createElement('span');
        detail.textContent = `${vault.id} · ${vault.ownerUid || 'Owner UID unavailable'}`;
        const badges = document.createElement('span');
        badges.textContent = `${vault.obfuscationEnabled ? 'Obfuscated' : 'Plain source'} · ${vault.executions.toLocaleString()} executions · ${formatDate(vault.updatedAt)}`;
        button.append(title, detail, badges);
        adminVaultList.appendChild(button);
    });
}

function setAdminVaultEditorEnabled(enabled) {
    adminVaultEditFields.classList.toggle('hidden', !enabled);
    adminVaultEmpty.classList.toggle('hidden', enabled);
    adminVaultFormControls.forEach(control => { control.disabled = !enabled; });
    document.getElementById('admin-vault-copy-source').disabled = !enabled;
    document.getElementById('admin-vault-download-source').disabled = !enabled;
    document.getElementById('admin-vault-save-btn').disabled = !enabled;
    document.getElementById('admin-vault-preview-btn').disabled = !enabled || !adminVaultObfuscation.checked;
    syncAdminVaultProtectionControls();
}

async function selectAdminVault(id, { discardConfirmed = false } = {}) {
    if (adminVaultSaving) {
        setVaultStatus('Wait for the current vault save to finish before opening another vault.', 'info');
        return;
    }
    if (adminVaultDirty && !discardConfirmed && !window.confirm('Discard your unsaved vault edits and open another vault?')) return;
    const sequence = ++adminVaultLoadSequence;
    adminVaultRevision += 1;
    setVaultStatus('Loading readable source…', 'info');
    try {
        const data = await requestJson(`/api/admin-vaults?id=${encodeURIComponent(id)}`);
        if (sequence !== adminVaultLoadSequence) return;
        const vault = data.vault;
        activeAdminVault = vault;
        adminVaultTitle.value = vault.title || '';
        adminVaultSource.value = vault.source || '';
        adminVaultObfuscation.checked = vault.obfuscationEnabled === true;
        adminVaultLevel.value = ['auto', 'low', 'medium', 'high'].includes(vault.obfuscationLevel) ? vault.obfuscationLevel : 'auto';
        adminVaultTamper.checked = vault.tamperCheckEnabled === true;
        adminVaultVm.checked = vault.vmProtectionEnabled === true;
        adminVaultSplitting.checked = vault.expandedTransformsEnabled === true;
        adminVaultDirty = false;
        clearAdminVaultPreview();
        setAdminVaultEditorEnabled(true);
        const sourceSize = (getUtf8ByteLength(vault.source) / 1024).toFixed(1);
        document.getElementById('admin-vault-meta').textContent = `ID ${vault.id} · Owner ${vault.ownerUid || 'unknown'} · ${sourceSize} KiB source · ${vault.requireKey ? 'key gated' : 'no key gate'}`;
        renderAdminVaultList();
        setVaultStatus(`Loaded ${vault.title || vault.id}. Review its source, make changes, then save to update the live vault.`, 'success');
    } catch (error) {
        if (sequence !== adminVaultLoadSequence) return;
        setVaultStatus(error.message, 'error');
        if (/session expired/i.test(error.message)) setLoggedIn(false);
    }
}

async function loadAdminVaults() {
    if (adminVaultSaving) return;
    if (adminVaultDirty && !window.confirm('Discard your unsaved vault edits and reload the vault list?')) return;
    const selectedId = activeAdminVault?.id || '';
    adminVaultDirty = false;
    activeAdminVault = null;
    adminVaultTitle.value = '';
    adminVaultSource.value = '';
    document.getElementById('admin-vault-meta').textContent = '';
    setAdminVaultEditorEnabled(false);
    clearAdminVaultPreview();
    adminVaultList.innerHTML = '<div class="info-box"><p><i class="fa-solid fa-spinner fa-spin"></i> Loading all vaults…</p></div>';
    setVaultStatus('Loading vault list…', 'info');
    try {
        const all = [];
        let cursor = '';
        do {
            const url = cursor ? `/api/admin-vaults?cursor=${encodeURIComponent(cursor)}` : '/api/admin-vaults';
            const page = await requestJson(url);
            all.push(...(Array.isArray(page.items) ? page.items : []));
            cursor = page.nextCursor || '';
        } while (cursor);
        adminVaults = all;
        renderAdminVaultList();
        if (selectedId && adminVaults.some(vault => vault.id === selectedId)) {
            await selectAdminVault(selectedId, { discardConfirmed: true });
        } else {
            setVaultStatus(`Loaded all ${adminVaults.length.toLocaleString()} saved vaults. Select one to inspect its source.`, 'success');
        }
    } catch (error) {
        adminVaultList.innerHTML = '';
        setVaultStatus(error.message, 'error');
        if (/session expired/i.test(error.message)) setLoggedIn(false);
    }
}

function safeVaultFilename(label) {
    return String(label || 'vault-script').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'vault-script';
}

function downloadAdminText(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function copyAdminText(text, textarea) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch { /* Fall through to the selection-based browser copy. */ }
    }
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.setSelectionRange(0, 0);
    return copied;
}

async function generateAdminVaultPreview() {
    if (!activeAdminVault || adminVaultSaving) return;
    if (!adminVaultSource.value.trim()) {
        setVaultStatus('The vault source cannot be empty.', 'error');
        return;
    }
    const settings = getAdminVaultObfuscationSettings();
    if (!settings.enabled) {
        setVaultStatus('Turn on obfuscation before generating an execution preview.', 'info');
        return;
    }
    const revision = adminVaultRevision;
    const signature = currentAdminVaultSignature();
    const button = document.getElementById('admin-vault-preview-btn');
    setLoading(button, true, 'OBFUSCATING…');
    try {
        const output = await obfuscateLua(adminVaultSource.value, settings.effectiveLevel, settings.protection);
        if (revision !== adminVaultRevision) return;
        const outputBytes = getUtf8ByteLength(output);
        if (outputBytes > MAX_OBFUSCATED_OUTPUT_BYTES) throw new Error('The obfuscated output is over the 8 MiB limit.');
        adminVaultOutput.value = output;
        adminVaultPreviewWrap.classList.remove('hidden');
        adminVaultPreviewIsCurrent = true;
        adminVaultPreviewSignature = signature;
        document.getElementById('admin-vault-copy-output').disabled = false;
        document.getElementById('admin-vault-download-output').disabled = false;
        setVaultStatus(`Preview ready · ${settings.effectiveLevel} strength · ${(outputBytes / 1024).toFixed(1)} KiB.`, 'success');
    } catch (error) {
        if (revision === adminVaultRevision) setVaultStatus(`Could not obfuscate this source: ${error.message}`, 'error');
    } finally {
        setLoading(button, false);
        button.disabled = adminVaultSaving || !activeAdminVault || !adminVaultObfuscation.checked;
    }
}

async function saveAdminVault() {
    if (!activeAdminVault || adminVaultSaving) return;
    const source = adminVaultSource.value;
    if (!source.trim()) return setVaultStatus('The vault source cannot be empty.', 'error');
    if (getUtf8ByteLength(source) > MAX_VAULT_SOURCE_BYTES) return setVaultStatus('Source exceeds the 2 MiB save limit.', 'error');
    const title = adminVaultTitle.value.trim() || 'Untitled Vault';
    if (!window.confirm(`Save changes to “${title}” (${activeAdminVault.id})? This replaces the live source used by that vault's loader.`)) return;

    const settings = getAdminVaultObfuscationSettings();
    adminVaultSaving = true;
    adminVaultRevision += 1;
    const buttons = ['admin-vault-copy-source', 'admin-vault-download-source', 'admin-vault-preview-btn', 'admin-vault-save-btn'];
    adminVaultFormControls.forEach(control => { control.disabled = true; });
    buttons.forEach(id => { document.getElementById(id).disabled = true; });
    const saveButton = document.getElementById('admin-vault-save-btn');
    const originalHtml = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SAVING…';
    let generatedOutput = null;
    try {
        setVaultStatus(settings.enabled ? 'Generating and saving the execution copy…' : 'Saving readable source…', 'info');
        const encodedSource = await encodeVaultSource(source);
        let encodedOutput = null;
        if (settings.enabled) {
            generatedOutput = await obfuscateLua(source, settings.effectiveLevel, settings.protection);
            if (getUtf8ByteLength(generatedOutput) > MAX_OBFUSCATED_OUTPUT_BYTES) throw new Error('The obfuscated output is over the 8 MiB limit.');
            encodedOutput = await encodeObfuscatedCode(generatedOutput);
        }
        const payload = {
            id: activeAdminVault.id,
            title,
            code: encodedSource.value,
            codeEncoding: encodedSource.encoding,
            obfuscationEnabled: settings.enabled,
            obfuscationLevel: settings.requestedLevel,
            tamperCheckEnabled: settings.protection.tamperCheck,
            vmProtectionEnabled: settings.protection.vmProtection,
            expandedTransformsEnabled: settings.protection.expandedTransforms,
            obfuscatedCodeLevel: settings.enabled ? settings.effectiveLevel : null,
            obfuscatedCode: encodedOutput?.value || null,
            obfuscatedCodeEncoding: encodedOutput?.encoding || null
        };
        await requestJson('/api/admin-vaults', { method: 'PATCH', body: JSON.stringify(payload) });
        activeAdminVault.title = title;
        activeAdminVault.source = source;
        activeAdminVault.updatedAt = Date.now();
        activeAdminVault.obfuscationEnabled = settings.enabled;
        activeAdminVault.obfuscationLevel = settings.requestedLevel;
        activeAdminVault.tamperCheckEnabled = settings.protection.tamperCheck;
        activeAdminVault.vmProtectionEnabled = settings.protection.vmProtection;
        activeAdminVault.expandedTransformsEnabled = settings.protection.expandedTransforms;
        const item = adminVaults.find(vault => vault.id === activeAdminVault.id);
        if (item) {
            item.title = title;
            item.updatedAt = activeAdminVault.updatedAt;
            item.obfuscationEnabled = settings.enabled;
        }
        adminVaultDirty = false;
        renderAdminVaultList();
        if (generatedOutput) {
            adminVaultOutput.value = generatedOutput;
            adminVaultPreviewWrap.classList.remove('hidden');
            adminVaultPreviewIsCurrent = true;
            adminVaultPreviewSignature = currentAdminVaultSignature();
            document.getElementById('admin-vault-copy-output').disabled = false;
            document.getElementById('admin-vault-download-output').disabled = false;
        } else {
            clearAdminVaultPreview();
        }
        setVaultStatus(`Saved “${title}”. The owner's live vault has been updated.`, 'success');
    } catch (error) {
        setVaultStatus(error.message, 'error');
        if (/session expired/i.test(error.message)) setLoggedIn(false);
    } finally {
        adminVaultSaving = false;
        adminVaultFormControls.forEach(control => { control.disabled = false; });
        setAdminVaultEditorEnabled(!!activeAdminVault);
        buttons.forEach(id => { document.getElementById(id).disabled = !activeAdminVault; });
        saveButton.innerHTML = originalHtml;
        syncAdminVaultProtectionControls();
        document.getElementById('admin-vault-copy-source').disabled = !activeAdminVault;
        document.getElementById('admin-vault-download-source').disabled = !activeAdminVault;
        document.getElementById('admin-vault-save-btn').disabled = !activeAdminVault;
        document.getElementById('admin-vault-preview-btn').disabled = !activeAdminVault || !adminVaultObfuscation.checked;
    }
}

function datetimeLocalValue(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function updateAnnouncementPreview() {
    const title = document.getElementById('announcement-title').value.trim();
    const message = document.getElementById('announcement-message').value.trim();
    const kind = document.getElementById('announcement-kind').value;
    const link = document.getElementById('announcement-link').value.trim();
    const label = document.getElementById('announcement-link-label').value.trim() || 'Learn more';
    const dismissible = document.getElementById('announcement-dismissible').checked;
    const preview = document.getElementById('announcement-preview');
    preview.classList.remove('info', 'success', 'warning');
    preview.classList.add(['info', 'success', 'warning'].includes(kind) ? kind : 'info');
    document.getElementById('announcement-preview-icon').className = kind === 'success'
        ? 'fa-solid fa-circle-check promo-icon'
        : kind === 'warning' ? 'fa-solid fa-triangle-exclamation promo-icon' : 'fa-solid fa-circle-info promo-icon';
    document.getElementById('announcement-preview-title').textContent = title || 'Your announcement title';
    document.getElementById('announcement-preview-message').textContent = message || 'Your message will appear here.';
    const previewLink = document.getElementById('announcement-preview-link');
    previewLink.textContent = label;
    previewLink.classList.toggle('hidden', !link);
    previewLink.href = link || '#';
    document.getElementById('announcement-preview-dismiss').classList.toggle('hidden', !dismissible);
    document.getElementById('announcement-title-count').textContent = `${title.length} / 80`;
    document.getElementById('announcement-message-count').textContent = `${message.length} / 500`;
}

function renderIdeas(ideas) {
    ideasList.innerHTML = '';
    if (!ideas.length) {
        ideasList.innerHTML = '<div class="info-box"><p>No ideas have been submitted yet.</p></div>';
        return;
    }

    ideas.forEach(idea => {
        const card = document.createElement('article');
        card.className = `admin-idea-card${idea.status === 'reviewed' ? ' reviewed' : ''}`;
        const header = document.createElement('div');
        header.className = 'admin-idea-header';
        const author = document.createElement('strong');
        author.textContent = idea.name || 'Anonymous';
        const date = document.createElement('time');
        date.textContent = formatDate(idea.createdAt);
        header.append(author, date);

        const message = document.createElement('p');
        message.textContent = idea.idea || '(Empty suggestion)';
        const actions = document.createElement('div');
        actions.className = 'admin-idea-actions';
        const badge = document.createElement('span');
        badge.className = 'admin-state-pill';
        badge.textContent = idea.status === 'reviewed' ? 'Reviewed' : 'New';
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'btn-ghost admin-idea-action';
        action.dataset.ideaId = idea.id;
        action.dataset.nextStatus = idea.status === 'reviewed' ? 'new' : 'reviewed';
        action.innerHTML = idea.status === 'reviewed'
            ? '<i class="fa-solid fa-rotate-left"></i> Reopen'
            : '<i class="fa-solid fa-check"></i> Mark reviewed';
        actions.append(badge, action);
        card.append(header, message, actions);
        ideasList.appendChild(card);
    });
}

function renderScriptReviews(items, container, reported = false) {
    container.replaceChildren();
    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'info-box';
        const copy = document.createElement('p');
        copy.textContent = reported ? 'There are no reported public scripts.' : 'There are no scripts waiting for review.';
        empty.appendChild(copy); container.appendChild(empty); return;
    }
    items.forEach(script => {
        const card = document.createElement('article'); card.className = 'admin-script-review-item';
        const heading = document.createElement('div'); heading.className = 'admin-script-review-heading';
        const title = document.createElement('strong'); title.textContent = script.title;
        const meta = document.createElement('span'); meta.textContent = `${script.category} · ${script.game} · by ${script.authorName}`;
        heading.append(title, meta);
        const description = document.createElement('p'); description.textContent = script.description || '(No description)';
        const codeToggle = document.createElement('details'); codeToggle.className = 'admin-script-source';
        const summary = document.createElement('summary'); summary.textContent = 'Review source code';
        const code = document.createElement('pre'); code.textContent = script.code || '(No source code)';
        codeToggle.append(summary, code);
        const actionRow = document.createElement('div'); actionRow.className = 'admin-idea-actions';
        const state = document.createElement('span'); state.className = 'admin-state-pill';
        state.textContent = reported ? `${script.reports} report${script.reports === 1 ? '' : 's'}` : `Submitted ${formatDate(script.createdAt)}`;
        actionRow.appendChild(state);
        const buttons = document.createElement('div'); buttons.className = 'admin-script-review-actions';
        if (!reported) {
            const approve = document.createElement('button'); approve.type = 'button'; approve.className = 'btn-primary admin-script-review-button'; approve.dataset.scriptId = script.id; approve.dataset.nextStatus = 'approved'; approve.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
            const reject = document.createElement('button'); reject.type = 'button'; reject.className = 'btn-danger admin-script-review-button'; reject.dataset.scriptId = script.id; reject.dataset.nextStatus = 'rejected'; reject.innerHTML = '<i class="fa-solid fa-xmark"></i> Reject';
            buttons.append(approve, reject);
        } else {
            const hide = document.createElement('button'); hide.type = 'button'; hide.className = 'btn-danger admin-script-review-button'; hide.dataset.scriptId = script.id; hide.dataset.nextStatus = 'hidden'; hide.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide from library';
            buttons.appendChild(hide);
        }
        actionRow.appendChild(buttons); card.append(heading, description, codeToggle, actionRow); container.appendChild(card);
    });
}

function renderManagedScripts() {
    const query = document.getElementById('admin-script-search').value.trim().toLocaleLowerCase();
    const status = document.getElementById('admin-script-status-filter').value;
    const visible = managedScripts.filter(script => {
        if (status !== 'all' && script.status !== status) return false;
        const searchable = [script.title, script.description, script.game, script.category, script.authorName].join(' ').toLocaleLowerCase();
        return !query || searchable.includes(query);
    });
    document.getElementById('admin-managed-script-count').textContent = `${visible.length} shown · ${managedScripts.length} loaded`;
    managedScriptsList.replaceChildren();
    if (!visible.length) {
        const empty = document.createElement('div');
        empty.className = 'info-box';
        const text = document.createElement('p');
        text.textContent = managedScripts.length ? 'No scripts match these filters.' : 'No published or hidden scripts found.';
        empty.appendChild(text);
        managedScriptsList.appendChild(empty);
        return;
    }

    visible.forEach(script => {
        const card = document.createElement('article');
        card.className = 'admin-script-review-item admin-managed-script-item';
        const heading = document.createElement('div');
        heading.className = 'admin-script-review-heading';
        const title = document.createElement('strong');
        title.textContent = script.title;
        const meta = document.createElement('span');
        meta.textContent = `${script.category} · ${script.game} · by ${script.authorName}`;
        heading.append(title, meta);
        const description = document.createElement('p');
        description.textContent = script.description || '(No description)';
        const actions = document.createElement('div');
        actions.className = 'admin-managed-script-actions';
        const state = document.createElement('span');
        state.className = `admin-state-pill status-pill-${script.status}`;
        state.textContent = script.status === 'approved' ? 'Published' : script.status === 'hidden' ? 'Hidden' : 'Rejected';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = script.status === 'approved' ? 'btn-danger admin-script-review-button' : 'btn-primary admin-script-review-button';
        button.dataset.scriptId = script.id;
        button.dataset.nextStatus = script.status === 'approved' ? 'hidden' : 'approved';
        button.innerHTML = script.status === 'approved'
            ? '<i class="fa-solid fa-eye-slash"></i> Hide from library'
            : '<i class="fa-solid fa-arrow-up"></i> Publish';
        actions.append(state, button);
        card.append(heading, description, actions);
        managedScriptsList.appendChild(card);
    });
}

async function loadAnnouncement() {
    const data = await requestJson('/api/announcements');
    const announcement = data.announcement;
    const expired = announcement?.expiresAt && Number(announcement.expiresAt) <= Date.now();
    document.getElementById('announcement-state').textContent = expired ? 'Expired' : announcement ? (announcement.dismissible ? 'Published · dismissible' : 'Published · persistent') : 'No active message';
    document.getElementById('announcement-title').value = announcement?.title || '';
    document.getElementById('announcement-message').value = announcement?.message || '';
    document.getElementById('announcement-kind').value = announcement?.kind || 'info';
    document.getElementById('announcement-link').value = announcement?.link || '';
    document.getElementById('announcement-link-label').value = announcement?.linkLabel || '';
    document.getElementById('announcement-dismissible').checked = announcement?.dismissible === true;
    document.getElementById('announcement-expires').value = expired ? '' : datetimeLocalValue(Number(announcement?.expiresAt) || 0);
    updateAnnouncementPreview();
}

async function refreshDashboard() {
    setStatus('Refreshing site data…', 'info');
    try {
        const [dashboard, scriptReviews] = await Promise.all([
            requestJson('/api/admin-dashboard'),
            requestJson('/api/admin-scripts')
        ]);
        document.getElementById('admin-stat-vaults').textContent = Number(dashboard.stats.vaults || 0).toLocaleString();
        document.getElementById('admin-stat-executions').textContent = Number(dashboard.stats.executions || 0).toLocaleString();
        document.getElementById('admin-stat-ideas').textContent = Number(dashboard.stats.ideas || 0).toLocaleString();
        document.getElementById('admin-ideas-count').textContent = `${dashboard.ideas.length} recent`;
        renderIdeas(dashboard.ideas || []);
        renderScriptReviews(scriptReviews.pending || [], pendingScriptsList);
        renderScriptReviews(scriptReviews.reported || [], reportedScriptsList, true);
        managedScripts = Array.isArray(scriptReviews.managed) ? scriptReviews.managed : [];
        renderManagedScripts();
        document.getElementById('admin-script-pending-count').textContent = String((scriptReviews.pending || []).length);
        document.getElementById('admin-script-reported-count').textContent = String((scriptReviews.reported || []).length);
        document.getElementById('admin-script-review-count').textContent = `${(scriptReviews.pending || []).length} pending · ${(scriptReviews.reported || []).length} reported`;
        await loadAdminVaults();
        try {
            await loadAnnouncement();
            statusBox.classList.add('hidden');
        } catch (error) {
            setStatus(`Dashboard loaded, but the announcement could not be loaded: ${error.message}`, 'error');
        }
    } catch (error) {
        setStatus(error.message, 'error');
        if (/session expired/i.test(error.message)) setLoggedIn(false);
    }
}

loginButton.addEventListener('click', signIn);
[usernameInput, passwordInput].forEach(input => input.addEventListener('keydown', event => {
    if (event.key === 'Enter') signIn();
}));

document.getElementById('admin-refresh-btn').addEventListener('click', refreshDashboard);
document.getElementById('admin-vault-refresh-btn').addEventListener('click', loadAdminVaults);
adminVaultSearch.addEventListener('input', renderAdminVaultList);
adminVaultList.addEventListener('click', event => {
    const button = event.target.closest('button[data-vault-id]');
    if (button) selectAdminVault(button.dataset.vaultId);
});
adminVaultTitle.addEventListener('input', markAdminVaultDirty);
adminVaultSource.addEventListener('input', markAdminVaultDirty);
adminVaultObfuscation.addEventListener('change', () => {
    syncAdminVaultProtectionControls();
    markAdminVaultDirty();
});
adminVaultLevel.addEventListener('change', markAdminVaultDirty);
adminVaultTamper.addEventListener('change', markAdminVaultDirty);
adminVaultSplitting.addEventListener('change', markAdminVaultDirty);
adminVaultVm.addEventListener('change', () => {
    if (adminVaultVm.checked) {
        adminVaultTamper.checked = false;
        adminVaultSplitting.checked = false;
    }
    syncAdminVaultProtectionControls();
    markAdminVaultDirty();
});
adminVaultPreviewButton.addEventListener('click', generateAdminVaultPreview);
document.getElementById('admin-vault-save-btn').addEventListener('click', saveAdminVault);
document.getElementById('admin-vault-copy-source').addEventListener('click', async () => {
    if (!activeAdminVault) return;
    const copied = await copyAdminText(adminVaultSource.value, adminVaultSource);
    setVaultStatus(copied ? 'Readable source copied.' : 'Copy was blocked. Select the source and copy it manually.', copied ? 'success' : 'error');
});
document.getElementById('admin-vault-download-source').addEventListener('click', () => {
    if (activeAdminVault) downloadAdminText(`${safeVaultFilename(adminVaultTitle.value || activeAdminVault.id)}_source.lua`, adminVaultSource.value);
});
document.getElementById('admin-vault-copy-output').addEventListener('click', async () => {
    if (!adminVaultPreviewIsCurrent || adminVaultPreviewSignature !== currentAdminVaultSignature()) return;
    const copied = await copyAdminText(adminVaultOutput.value, adminVaultOutput);
    setVaultStatus(copied ? 'Obfuscated execution copy copied.' : 'Copy was blocked. Select the output and copy it manually.', copied ? 'success' : 'error');
});
document.getElementById('admin-vault-download-output').addEventListener('click', () => {
    if (!activeAdminVault || !adminVaultPreviewIsCurrent || adminVaultPreviewSignature !== currentAdminVaultSignature()) return;
    downloadAdminText(`${safeVaultFilename(adminVaultTitle.value || activeAdminVault.id)}_obfuscated.lua`, adminVaultOutput.value);
});
document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    try { await requestJson('/api/admin-auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }); }
    catch {}
    setLoggedIn(false);
    usernameInput.value = '';
    passwordInput.value = '';
    showLoginError('You are signed out.');
});

document.getElementById('announcement-publish-btn').addEventListener('click', async event => {
    const button = event.currentTarget;
    const expiresValue = document.getElementById('announcement-expires').value;
    const expiresAt = expiresValue ? new Date(expiresValue).getTime() : 0;
    if (expiresAt && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
        setStatus('Choose a future expiration time, or clear the expiry field.', 'error');
        return;
    }
    const payload = {
        title: document.getElementById('announcement-title').value.trim(),
        message: document.getElementById('announcement-message').value.trim(),
        kind: document.getElementById('announcement-kind').value,
        link: document.getElementById('announcement-link').value.trim(),
        linkLabel: document.getElementById('announcement-link-label').value.trim() || 'Learn more',
        dismissible: document.getElementById('announcement-dismissible').checked,
        expiresAt
    };
    setLoading(button, true, 'PUBLISHING…');
    try {
        await requestJson('/api/announcements', { method: 'POST', body: JSON.stringify(payload) });
        setStatus(payload.dismissible
            ? 'Announcement published. Visitors can dismiss it on their device.'
            : 'Announcement published. It stays visible until it expires or you remove it.', 'success');
        await loadAnnouncement();
    } catch (error) {
        setStatus(error.message, 'error');
    } finally {
        setLoading(button, false);
    }
});

document.getElementById('announcement-clear-btn').addEventListener('click', async event => {
    const button = event.currentTarget;
    if (!window.confirm('Remove the active announcement from the website?')) return;
    setLoading(button, true, 'REMOVING…');
    try {
        await requestJson('/api/announcements', { method: 'DELETE' });
        await loadAnnouncement();
        setStatus('The active announcement was removed.', 'success');
    } catch (error) {
        setStatus(error.message, 'error');
    } finally {
        setLoading(button, false);
    }
});

ideasList.addEventListener('click', async event => {
    const button = event.target.closest('button[data-idea-id]');
    if (!button) return;
    setLoading(button, true, 'SAVING…');
    try {
        await requestJson('/api/admin-dashboard', {
            method: 'PATCH',
            body: JSON.stringify({ id: button.dataset.ideaId, status: button.dataset.nextStatus })
        });
        await refreshDashboard();
    } catch (error) {
        setStatus(error.message, 'error');
    } finally {
        setLoading(button, false);
    }
});

document.querySelector('.admin-script-review-card').addEventListener('click', async event => {
    const button = event.target.closest('button[data-script-id]');
    if (!button) return;
    const status = button.dataset.nextStatus;
    const actionLabel = status === 'approved' ? 'publish' : status === 'rejected' ? 'reject' : 'hide';
    if (!window.confirm(`Are you sure you want to ${actionLabel} “${button.closest('.admin-script-review-item').querySelector('strong').textContent}”?`)) return;
    setLoading(button, true, 'SAVING…');
    try {
        await requestJson('/api/admin-scripts', { method: 'PATCH', body: JSON.stringify({ id: button.dataset.scriptId, status }) });
        setStatus(`Script ${status === 'approved' ? 'approved and published' : status === 'rejected' ? 'rejected' : 'hidden from the public library'}.`, 'success');
        await refreshDashboard();
    } catch (error) { setStatus(error.message, 'error'); }
    finally { setLoading(button, false); }
});

checkSession();

['announcement-title', 'announcement-message', 'announcement-kind', 'announcement-link-label', 'announcement-link', 'announcement-dismissible'].forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener('input', updateAnnouncementPreview);
    element.addEventListener('change', updateAnnouncementPreview);
});
document.getElementById('announcement-preview-link').addEventListener('click', event => event.preventDefault());
document.getElementById('admin-script-search').addEventListener('input', renderManagedScripts);
document.getElementById('admin-script-status-filter').addEventListener('change', renderManagedScripts);
