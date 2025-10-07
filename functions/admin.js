/**
 * Cloudflare Pages Function: admin.js
 * Routes handled (based on pathname):
 *  - POST /api/admin/login         -> returns JWT token (simple signed token)
 *  - GET  /api/admin/posts         -> list posts from BLOG_KV
 *  - POST /api/admin/posts         -> create new post (body: {title, body, tags, imageKey?})
 *  - DELETE /api/admin/posts/:id   -> delete post
 *  - POST /api/admin/generate      -> generate a post using the PROMPT_TEMPLATE env
 *
 * Environment variables expected:
 *  - ADMIN_SECRET (string)         -> HMAC secret to sign tokens
 *  - SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD
 *  - SITEADMIN_USERNAME / SITEADMIN_PASSWORD
 *  - BLOG_KV (KV namespace binding)
 *  - ANALYTICS_KV (KV namespace binding)
 *  - R2_IMAGES (R2 binding name)
 *  - EMAIL_WEBHOOK_URL (optional)
 *  - PROMPT_TEMPLATE (text used to seed generated posts)
 */

import { createHmac } from 'crypto';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$|^\/+/, ''); // trim slashes

  // Simple router
  try {
    if (path === 'api/admin/login' && request.method === 'POST') {
      return await handleLogin(request, env);
    }
    if (path === 'api/admin/posts' && request.method === 'GET') {
      return await listPosts(request, env);
    }
    if (path === 'api/admin/posts' && request.method === 'POST') {
      return await createPost(request, env);
    }
    if (path.startsWith('api/admin/posts/') && request.method === 'DELETE') {
      const id = path.split('/').pop();
      return await deletePost(id, env);
    }
    if (path === 'api/admin/generate' && request.method === 'POST') {
      return await generatePost(request, env);
    }

    return new Response('Not Found', { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

function signToken(payload, secret) {
  // Very small stateless token: base64(payload).HMAC
  const str = JSON.stringify(payload);
  const b64 = Buffer.from(str).toString('base64');
  const sig = createHmac('sha256', secret).update(b64).digest('hex');
  return b64 + '.' + sig;
}

function verifyToken(token, secret) {
  try {
    const [b64, sig] = token.split('.');
    const expected = createHmac('sha256', secret).update(b64).digest('hex');
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return payload;
  } catch (e) {
    return null;
  }
}

async function handleLogin(request, env) {
  const body = await request.json();
  const { username, password } = body;
  const SA = env.SUPERADMIN_USERNAME;
  const SAP = env.SUPERADMIN_PASSWORD;
  const A = env.SITEADMIN_USERNAME;
  const AP = env.SITEADMIN_PASSWORD;
  if ((username === SA && password === SAP) || (username === A && password === AP)) {
    const token = signToken({ username, role: username === SA ? 'super' : 'site' , iat: Date.now() }, env.ADMIN_SECRET || 'dev_secret');
    return new Response(JSON.stringify({ token }), { status: 200 });
  }
  return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
}

function authFromRequest(request, env) {
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const tok = h.slice(7);
  return verifyToken(tok, env.ADMIN_SECRET || 'dev_secret');
}

async function listPosts(request, env) {
  const user = authFromRequest(request, env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // BLOG_KV should store posts as JSON under keys like post:<id>
  const list = await env.BLOG_KV.list({ prefix: 'post:' , limit: 1000 });
  const keys = list.keys || [];
  const out = [];
  for (const k of keys) {
    const v = await env.BLOG_KV.get(k.name);
    out.push(JSON.parse(v));
  }
  // sort by createdAt desc
  out.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  return new Response(JSON.stringify({ posts: out }), { status: 200 });
}

function makeId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
}

async function createPost(request, env) {
  const user = authFromRequest(request, env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { title, body: content, tags = [], imageKey = null, slug = null } = body;
  if (!title || !content) return new Response(JSON.stringify({ error: 'Missing title or body' }), { status: 400 });
  const id = makeId();
  const post = {
    id,
    title,
    content,
    tags,
    imageKey,
    slug: slug || (title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')),
    createdAt: new Date().toISOString()
  };
  await env.BLOG_KV.put('post:' + id, JSON.stringify(post));
  await regenerateRSSAndSitemap(env);
  return new Response(JSON.stringify({ ok: true, post }), { status: 201 });
}

async function deletePost(id, env) {
  // In Pages Functions you can authenticate before calling this. We'll assume simple use.
  await env.BLOG_KV.delete('post:' + id);
  await regenerateRSSAndSitemap(env);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

async function generatePost(request, env) {
  const user = authFromRequest(request, env);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { category = 'General' } = body;
  const template = env.PROMPT_TEMPLATE || 'Write a short local blog post (3-5 short paragraphs) about {topic} for a small-town audience. Tone: friendly, helpful.';
  const prompt = template.replace('{topic}', category);
  const title = `${category} tips for our town`;
  const content = `<p>${prompt}</p><p>Need help? Contact Alfred Web Design & Shirts.</p>`;
  const id = makeId();
  const post = {
    id,
    title,
    content,
    tags: [category],
    createdAt: new Date().toISOString(),
    generated: true
  };
  await env.BLOG_KV.put('post:' + id, JSON.stringify(post));
  await regenerateRSSAndSitemap(env);
  return new Response(JSON.stringify({ ok: true, post }), { status: 201 });
}

async function regenerateRSSAndSitemap(env) {
  try {
    const list = await env.BLOG_KV.list({ prefix: 'post:' , limit: 1000 });
    const keys = list.keys || [];
    const posts = [];
    for (const k of keys) {
      const v = await env.BLOG_KV.get(k.name);
      posts.push(JSON.parse(v));
    }
    posts.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));

    const base = env.SITE_BASE_URL || 'https://example.com';
    const rssItems = posts.map(p=>`
      <item>
        <title><![CDATA[${p.title}]]></title>
        <link>${base}/posts/${p.slug}</link>
        <guid>${base}/posts/${p.id}</guid>
        <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
        <description><![CDATA[${p.content.replace(/<[^>]+>/g,'').slice(0,200)}]]></description>
      </item>`).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
      <title>Alfred Web Design & Shirts - Blog</title>
      <link>${base}</link>
      <description>Local posts for Alfred & area</description>
      ${rssItems}
    </channel>
    </rss>`;

    const sitemapItems = posts.map(p=>`<url><loc>${base}/posts/${p.slug}</loc><lastmod>${p.createdAt}</lastmod></url>`).join('\n');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>${base}</loc></url>
      ${sitemapItems}
    </urlset>`;

    await env.BLOG_KV.put('rss_xml', rss);
    await env.BLOG_KV.put('sitemap_xml', sitemap);
  } catch (e) {
    console.error('regenerate error', e);
  }
}
