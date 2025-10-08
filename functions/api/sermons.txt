/**
 * File Path: /functions/api/sermon.js
 * Handles public retrieval of the sermon archive for sermon.html
 */

export async function onRequest(context) {
    const { request, env } = context;

    // This is a public endpoint, so it only supports GET
    if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const list = await env.MBSERMON.list({ prefix: 'sermon:' });
        const promises = list.keys.map(key => env.MBSERMON.get(key.name, { type: 'json' }));
        const sermons = (await Promise.all(promises)).filter(Boolean);
        
        // Sort by creation date, newest first, so sermons[0] is always the latest
        sermons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return new Response(JSON.stringify(sermons), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error("Error fetching public sermon archive:", err);
        return new Response(JSON.stringify({ error: "Could not load sermon archive." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}