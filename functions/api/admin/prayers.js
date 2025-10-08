/**
 * File Path: /functions/api/admin/prayers.js
 * Handles admin-level prayer log management
 * - GET /api/admin/prayers - List all prayer logs
 * - DELETE /api/admin/prayers/{id} - Delete a prayer log
 */

// --- AUTH HELPERS (copy from sermons.js or create a shared module) ---
const textEncoder = new TextEncoder();
async function getHmacKey(secret) { return await crypto.subtle.importKey('raw',textEncoder.encode(secret),{ name: 'HMAC', hash: 'SHA-256' },false,['sign', 'verify']); }
async function verifyToken(token, secret) { try { if (!secret) return null; const [header, payloadB64, signatureB64] = token.split('.'); if (!header || !payloadB64 || !signatureB64) return null; const key = await getHmacKey(secret); const data = textEncoder.encode(`${header}.${payloadB64}`); const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); const isValid = await crypto.subtle.verify('HMAC', key, signature, data); if (!isValid) return null; return JSON.parse(atob(payloadB64)); } catch (e) { return null; } }
async function authFromRequest(request, env) { const h = request.headers.get('authorization') || ''; if (!h.startsWith('Bearer ')) return null; const tok = h.slice(7); return await verifyToken(tok, env.ADMIN_SECRET); }


export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // All admin routes require authentication
    const user = await authFromRequest(request, env);
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Handle GET to list all prayer logs
    if (request.method === 'GET') {
        const list = await env.MBPRAY_LOGS.list({ prefix: 'log:' });
        const promises = list.keys.map(key => env.MBPRAY_LOGS.get(key.name, { type: 'json' }));
        const prayerLogs = (await Promise.all(promises)).filter(Boolean);
        prayerLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        // Add the key as the ID for deletion
        prayerLogs.forEach((log, index) => log.id = list.keys[index].name);
        return new Response(JSON.stringify(prayerLogs), { headers: { 'Content-Type': 'application/json' } });
    }

    // Handle DELETE to remove a specific prayer log
    if (request.method === 'DELETE') {
        const pathParts = url.pathname.split('/');
        const id = pathParts[pathParts.length - 1];
        if (id && id !== 'prayers') {
            await env.MBPRAY_LOGS.delete(decodeURIComponent(id));
            return new Response(null, { status: 204 });
        }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
}