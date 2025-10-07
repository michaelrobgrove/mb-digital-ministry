/**
 * File Path: /public/admin/admin.js
 * CORRECTED: Improved authentication flow to handle invalid tokens on page load.
 */
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Using a specific key for this site
    const TOKEN_KEY = 'mb_admin_token';
    let token = localStorage.getItem(TOKEN_KEY);

    // --- API HELPER ---
    async function api(path, opts = {}) {
        opts.headers = opts.headers || {};
        opts.headers['Content-Type'] = 'application/json';
        if (token) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }
        const response = await fetch('/api/admin' + path, opts);
        if (response.status === 401) {
            // If unauthorized, always log out.
            logout();
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
            throw new Error(errData.error || 'API Error');
        }
        // Handle no-content responses for DELETE requests
        if (response.status === 204) return;
        return response.json();
    }

    // --- UI & AUTHENTICATION ---
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
        localStorage.removeItem(TOKEN_KEY);
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
            localStorage.setItem(TOKEN_KEY, token);
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
            if (sermons.length === 0) {
                 sermonsList.innerHTML = '<p>No sermons found in the archive.</p>';
                 return;
            }
            sermonsList.innerHTML = sermons.map(s => `
                <div class="post-item">
                    <strong>${s.title}</strong>
                    <div>${new Date(s.createdAt).toLocaleString()}</div>
                    <button class="delete-sermon" data-id="${s.id}">Delete</button>
                </div>
            `).join('');
        } catch (e) {
            // Errors are handled by the api helper, which will trigger logout on 401
        }
    }
    
    generateSermonBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to generate a new sermon? This can take up to a minute and will replace this week\'s scheduled sermon.')) return;
        try {
            generateSermonBtn.disabled = true;
            generateSermonBtn.textContent = 'Generating...';
            await api('/sermons/generate', { method: 'POST' });
            alert('New sermon generation complete. The archive will update.');
            loadSermons();
        } catch (e) {
            alert('Failed to trigger generation: ' + e.message);
        } finally {
            generateSermonBtn.disabled = false;
            generateSermonBtn.textContent = 'Force Generate New Sermon';
        }
    });

    sermonsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-sermon')) {
            const id = e.target.dataset.id;
            if (confirm(`Are you sure you want to delete this sermon?\nID: ${id}`)) {
                try {
                    await api(`/sermons/delete/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
            if (prayers.length === 0) {
                prayersList.innerHTML = '<p>No prayer requests have been logged.</p>';
                return;
            }
            prayersList.innerHTML = prayers.map(p => `
                <div class="post-item ${p.moderationStatus === 'REJECT' ? 'rejected' : ''}">
                    <p><strong>${p.firstName || 'Anonymous'}</strong> <span class="status ${p.moderationStatus || 'UNKNOWN'}">${p.moderationStatus || 'N/A'}</span></p>
                    <p>${p.requestText || ''}</p>
                    <small>${new Date(p.timestamp).toLocaleString()}</small>
                    <button class="delete-prayer" data-id="${p.id}">Delete Log</button>
                </div>
            `).join('');
        } catch (e) {
            // Errors are handled by the api helper
        }
    }

    prayersList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-prayer')) {
            const id = e.target.dataset.id;
            if (confirm(`Are you sure you want to delete this prayer log?\nID: ${id}`)) {
                try {
                    await api(`/prayers/delete/${encodeURIComponent(id)}`, { method: 'DELETE' });
                    loadPrayers();
                } catch (err) {
                    alert('Delete failed: ' + err.message);
                }
            }
        }
    });

    // --- INITIAL LOAD ---
    async function initialize() {
        if (!token) {
            showLogin();
            return;
        }
        // Verify token by trying to load data. If it fails with 401, the API helper will force a logout.
        try {
            await listSermons(); // A lightweight check
            showAdmin();
        } catch (e) {
            // The api() helper already called logout(), so the login screen is now visible.
            console.error("Initial auth check failed, showing login.");
        }
    }

    initialize();
});

