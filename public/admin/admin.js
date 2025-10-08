/**
 * File Path: /public/admin/admin.js
 * Admin panel with improved error handling
 */
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const TOKEN_KEY = 'mb_admin_token';
    let token = localStorage.getItem(TOKEN_KEY);

    // --- API HELPER ---
    async function api(path, opts = {}) {
        opts.headers = opts.headers || {};
        opts.headers['Content-Type'] = 'application/json';
        if (token) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }
        
        console.log('API Request:', opts.method || 'GET', '/api/admin' + path);
        
        const response = await fetch('/api/admin' + path, opts);
        
        console.log('API Response:', response.status, response.statusText);
        
        if (response.status === 401) {
            logout();
            throw new Error('Unauthorized');
        }
        
        // Handle 204 No Content (successful delete)
        if (response.status === 204) {
            console.log('Delete successful (204 No Content)');
            return null;
        }
        
        // Try to parse JSON response
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response received:', text.substring(0, 200));
            throw new Error('Server returned non-JSON response');
        }
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
            throw new Error(errData.error || 'API Error');
        }
        
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
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'Login failed' }));
                throw new Error(errData.error || 'Invalid credentials');
            }
            
            const data = await response.json();
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
            if (!sermons || sermons.length === 0) {
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
            console.error('Error loading sermons:', e);
            sermonsList.innerHTML = '<p class="error">Failed to load sermons: ' + e.message + '</p>';
        }
    }
    
    generateSermonBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to generate a new sermon? This can take up to a minute.')) return;
        try {
            generateSermonBtn.disabled = true;
            generateSermonBtn.textContent = 'Generating...';
            await api('/sermons/generate', { method: 'POST' });
            alert('New sermon generation started. It will appear in the list shortly.');
            setTimeout(loadSermons, 3000); // Reload after 3 seconds
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
                    console.log('Attempting to delete sermon:', id);
                    const result = await api(`/sermons/${encodeURIComponent(id)}`, { method: 'DELETE' });
                    console.log('Delete result:', result);
                    alert('Sermon deleted successfully');
                    loadSermons();
                } catch (err) {
                    console.error('Delete error:', err);
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
            if (!prayers || prayers.length === 0) {
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
            console.error('Error loading prayers:', e);
            prayersList.innerHTML = '<p class="error">Failed to load prayers: ' + e.message + '</p>';
        }
    }

    prayersList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-prayer')) {
            const id = e.target.dataset.id;
            if (confirm(`Are you sure you want to delete this prayer log?\nID: ${id}`)) {
                try {
                    await api(`/prayers/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
        try {
            await api('/sermons');
            showAdmin();
        } catch (e) {
            console.error("Initial auth check failed:", e);
            showLogin();
        }
    }

    initialize();
});