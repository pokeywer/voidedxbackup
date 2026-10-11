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

async function loadAnnouncement() {
    const data = await requestJson('/api/announcements');
    const announcement = data.announcement;
    document.getElementById('announcement-state').textContent = announcement ? 'Published' : 'No active message';
    document.getElementById('announcement-title').value = announcement?.title || '';
    document.getElementById('announcement-message').value = announcement?.message || '';
    document.getElementById('announcement-kind').value = announcement?.kind || 'info';
    document.getElementById('announcement-link').value = announcement?.link || '';
    document.getElementById('announcement-link-label').value = announcement?.linkLabel || '';
}

async function refreshDashboard() {
    setStatus('Refreshing site data…', 'info');
    try {
        const [dashboard, scriptReviews] = await Promise.all([
            requestJson('/api/admin-dashboard'),
            requestJson('/api/admin-scripts'),
            loadAnnouncement()
        ]);
        document.getElementById('admin-stat-vaults').textContent = Number(dashboard.stats.vaults || 0).toLocaleString();
        document.getElementById('admin-stat-executions').textContent = Number(dashboard.stats.executions || 0).toLocaleString();
        document.getElementById('admin-stat-ideas').textContent = Number(dashboard.stats.ideas || 0).toLocaleString();
        document.getElementById('admin-ideas-count').textContent = `${dashboard.ideas.length} recent`;
        renderIdeas(dashboard.ideas || []);
        renderScriptReviews(scriptReviews.pending || [], pendingScriptsList);
        renderScriptReviews(scriptReviews.reported || [], reportedScriptsList, true);
        document.getElementById('admin-script-pending-count').textContent = String((scriptReviews.pending || []).length);
        document.getElementById('admin-script-reported-count').textContent = String((scriptReviews.reported || []).length);
        document.getElementById('admin-script-review-count').textContent = `${(scriptReviews.pending || []).length} pending · ${(scriptReviews.reported || []).length} reported`;
        statusBox.classList.add('hidden');
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
    const payload = {
        title: document.getElementById('announcement-title').value.trim(),
        message: document.getElementById('announcement-message').value.trim(),
        kind: document.getElementById('announcement-kind').value,
        link: document.getElementById('announcement-link').value.trim(),
        linkLabel: document.getElementById('announcement-link-label').value.trim() || 'Learn more'
    };
    setLoading(button, true, 'PUBLISHING…');
    try {
        await requestJson('/api/announcements', { method: 'POST', body: JSON.stringify(payload) });
        setStatus('Announcement published. It will appear at the top of the main site.', 'success');
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
    const actionLabel = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'hide';
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
