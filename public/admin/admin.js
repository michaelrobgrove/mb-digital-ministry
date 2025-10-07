// File Path: /public/admin/admin.js
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let token = localStorage.getItem('mb_admin_token');

    // --- API HELPER ---
    async function api(path, opts = {}) {
        opts.headers = opts.headers || {};
        opts.headers['Content-Type'] = 'application/json';
        if (token) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }
        const response = await fetch('/api/admin' + path, opts);
        if (response.status === 401) {
            logout();
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'API Error');
        }
        return response.json();
    }

    // --- AUTHENTICATION ---
    function showLogin() {
        loginScreen.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    }

    function showAdmin() {
        loginScreen.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        loadSermons();
        loadPrayers();
    }

    function logout() {
        localStorage.removeItem('mb_admin_token');
        token = null;
        showLogin();
    }

    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        try {
            const data = await api('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            token = data.token;
            localStorage.setItem('mb_admin_token', token);
            showAdmin();
        } catch (e) {
            alert('Login failed: ' + e.message);
        }
    });

    logoutBtn.addEventListener('click', logout);

    // --- SERMONS ---
    const sermonsList = document.getElementById('sermonsList');
    const generateSermonBtn = document.getElementById('generateSermonBtn');

    async function loadSermons() {
        sermonsList.innerHTML = 'Loading sermons...';
        try {
            const sermons = await api('/sermons');
            sermonsList.innerHTML = sermons.map(s => `
                <div class="post-item">
                    <strong>${s.title}</strong>
                    <div>${new Date(s.createdAt).toLocaleString()}</div>
                    <button class="delete-sermon" data-id="${s.id}">Delete</button>
                </div>
            `).join('');
        } catch (e) {
            sermonsList.innerHTML = `<p class="error">Failed to load sermons: ${e.message}</p>`;
        }
    }
    
    generateSermonBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to generate a new sermon? This will replace the current week\'s sermon if it exists.')) return;
        try {
            await api('/sermons/generate', { method: 'POST' });
            alert('New sermon generation triggered. It will be available on the next page load.');
            loadSermons();
        } catch (e) {
            alert('Failed to trigger generation: ' + e.message);
        }
    });

    sermonsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-sermon')) {
            const id = e.target.dataset.id;
            if (confirm(`Are you sure you want to delete this sermon?\nID: ${id}`)) {
                try {
                    await api(`/sermons/delete/${encodeURIComponent(id)}`);
                    loadSermons();
                } catch (err) {
                    alert('Delete failed: ' + err.message);
                }
            }
        }
    });

    // --- PRAYERS ---
    const prayersList = document.getElementById('prayersList');

    async function loadPrayers() {
        prayersList.innerHTML = 'Loading prayer logs...';
        try {
            const prayers = await api('/prayers');
            prayersList.innerHTML = prayers.map(p => `
                <div class="post-item ${p.moderationStatus === 'REJECT' ? 'rejected' : ''}">
                    <p><strong>${p.firstName}</strong> <span class="status ${p.moderationStatus}">${p.moderationStatus}</span></p>
                    <p>${p.requestText}</p>
                    <small>${new Date(p.timestamp).toLocaleString()}</small>
                    <button class="delete-prayer" data-id="${p.id}">Delete Log</button>
                </div>
            `).join('');
        } catch (e) {
            prayersList.innerHTML = `<p class="error">Failed to load prayers: ${e.message}</p>`;
        }
    }

    prayersList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-prayer')) {
            const id = e.target.dataset.id;
            if (confirm(`Are you sure you want to delete this prayer log?\nID: ${id}`)) {
                try {
                    await api(`/prayers/delete/${encodeURIComponent(id)}`);
                    loadPrayers();
                } catch (err) {
                    alert('Delete failed: ' + err.message);
                }
            }
        }
    });

    // --- INITIAL LOAD ---
    if (token) {
        showAdmin();
    } else {
        showLogin();
    }
});

