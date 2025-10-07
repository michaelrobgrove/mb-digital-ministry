/* Admin frontend script - minimal, uses Fetch to call functions endpoints.
   Assumes env: BLOG_KV and authentication token stored in localStorage as 'awd_token'
*/
(async function(){
  const apiBase = '/api';
  let token = localStorage.getItem('awd_token');

  // Simple check - redirect to login if no token
  if (!token) {
    const u = prompt('Admin token missing. Enter admin token:');
    if (!u) return alert('No token provided.');
    token = u;
    localStorage.setItem('awd_token', token);
  }

  const q = new Quill('#editor', { theme: 'snow' });

  async function api(path, opts={}) {
    opts.headers = opts.headers || {};
    opts.headers['Content-Type'] = 'application/json';
    opts.headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, opts);
    if (res.status === 401) {
      localStorage.removeItem('awd_token');
      alert('Unauthorized - token removed. Reload to login.');
      throw new Error('Unauthorized');
    }
    return res.json();
  }

  async function loadPosts(){
    const data = await api('/api/admin/posts', { method: 'GET' });
    const wrap = document.getElementById('postsList');
    wrap.innerHTML = '';
    data.posts.forEach(p=>{
      const el = document.createElement('div');
      el.className = 'post-item';
      el.innerHTML = `<strong>${p.title}</strong><div>${new Date(p.createdAt).toLocaleString()}</div>
      <button data-id="${p.id}" class="deleteBtn">Delete</button>
      <a href="/posts/${p.slug}" target="_blank">View</a>`;
      wrap.appendChild(el);
    });
    document.querySelectorAll('.deleteBtn').forEach(b=>b.addEventListener('click', async (e)=>{
      const id = e.target.dataset.id;
      await fetch('/api/admin/posts/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token }});
      loadPosts();
    }));
  }

  document.getElementById('createPost').addEventListener('click', async ()=>{
    const title = document.getElementById('postTitle').value;
    const content = q.root.innerHTML;
    const tags = document.getElementById('postTags').value.split(',').map(s=>s.trim()).filter(Boolean);
    const file = document.getElementById('postImage').files[0];
    let imageKey = null;
    if (file) {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      imageKey = 'data:' + file.type + ';base64,' + b64;
    }
    await api('/api/admin/posts', { method: 'POST', body: JSON.stringify({ title, body: content, tags, imageKey }) });
    loadPosts();
  });

  document.getElementById('generatePost').addEventListener('click', async ()=>{
    const cat = prompt('Category (e.g. Web Design, Apparel)') || 'General';
    await api('/api/admin/generate', { method: 'POST', body: JSON.stringify({ category: cat }) });
    loadPosts();
  });

  async function loadContacts(){
    const res = await fetch('/api/contacts?limit=50', { headers: { Authorization: 'Bearer ' + token }});
    if (res.status === 200) {
      const data = await res.json();
      const wrap = document.getElementById('contactsList');
      wrap.innerHTML = data.items.map(i=>`<div><strong>${i.name}</strong> (${i.email})<div>${i.page}</div></div>`).join('');
    } else {
      document.getElementById('contactsList').innerText = 'No contacts or unauthorized.';
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', ()=>{ localStorage.removeItem('awd_token'); location.reload(); });

  await loadPosts();
  loadContacts();
})();
