/**
 * Serve RSS and sitemap from BLOG_KV cached values
 * - GET /rss -> returns BLOG_KV.get('rss_xml')
 * - GET /sitemap.xml -> returns BLOG_KV.get('sitemap_xml')
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/+|\/+$/g,'');
  if (path === 'rss' || path === 'rss.xml') {
    const rss = await env.BLOG_KV.get('rss_xml');
    if (!rss) return new Response('No RSS', { status: 404 });
    return new Response(rss, { status: 200, headers: { 'content-type':'application/rss+xml' } });
  }
  if (path === 'sitemap.xml' || path === 'sitemap') {
    const xml = await env.BLOG_KV.get('sitemap_xml');
    if (!xml) return new Response('No sitemap', { status: 404 });
    return new Response(xml, { status: 200, headers: { 'content-type':'application/xml' } });
  }
  return new Response('Not Found', { status: 404 });
}
