/**
 * Cloudflare Pages Function: contact.js
 * Endpoint: POST /api/contact -> saves to ANALYTICS_KV (or CONTACT_KV) and forwards to EMAIL_WEBHOOK_URL
 *
 * Expected env bindings:
 * - ANALYTICS_KV
 * - EMAIL_WEBHOOK_URL (optional)
 * - SITE_BASE_URL
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.pathname.replace(/^\/+|\/+$/g,'') !== 'api/contact' || request.method !== 'POST') {
    return new Response('Not Found', { status: 404 });
  }
  const data = await request.json();
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  const id = 'contact:' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
  const record = {
    id,
    name: data.name || '',
    email: data.email || '',
    message: data.message || '',
    page: data.page || '',
    formId: data.formId || '',
    trackingId: data.trackingId || '',
    ua: request.headers.get('user-agent') || '',
    ip,
    createdAt: new Date().toISOString()
  };
  await env.ANALYTICS_KV.put(id, JSON.stringify(record));

  if (env.EMAIL_WEBHOOK_URL) {
    try {
      await fetch(env.EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: `New site contact: ${record.name || '(no name)'} - ${record.page}`,
          text: `${record.message}\n\nFrom: ${record.name} <${record.email}>\nPage: ${record.page}\nForm: ${record.formId}\nIP: ${record.ip}`,
          to: env.NOTIFY_EMAIL || ''
        })
      });
    } catch (e) {
      console.error('email webhook error', e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
