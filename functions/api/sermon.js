/**
 * File Path: /functions/api/admin/sermons.js
 * Handles: 
 * - GET /api/admin/sermons - List all sermons
 * - DELETE /api/admin/sermons - Delete sermon (path handled separately)
 */

const textEncoder = new TextEncoder();
async function getHmacKey(secret) { return await crypto.subtle.importKey('raw',textEncoder.encode(secret),{ name: 'HMAC', hash: 'SHA-256' },false,['sign', 'verify']); }
async function verifyToken(token, secret) { try { if (!secret) return null; const [header, payloadB64, signatureB64] = token.split('.'); if (!header || !payloadB64 || !signatureB64) return null; const key = await getHmacKey(secret); const data = textEncoder.encode(`${header}.${payloadB64}`); const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); const isValid = await crypto.subtle.verify('HMAC', key, signature, data); if (!isValid) return null; return JSON.parse(atob(payloadB64)); } catch (e) { return null; } }
async function authFromRequest(request, env) { const h = request.headers.get('authorization') || ''; if (!h.startsWith('Bearer ')) return null; const tok = h.slice(7); return await verifyToken(tok, env.ADMIN_SECRET); }

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const user = await authFromRequest(request, env);
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Handle GET /api/admin/sermons
    if (request.method === 'GET') {
        return await listSermons(env);
    }

    // Handle DELETE with ID in path: /api/admin/sermons/sermon:2024-01-01
    if (request.method === 'DELETE') {
        const pathParts = url.pathname.split('/');
        const id = pathParts[pathParts.length - 1];
        if (id && id !== 'sermons') {
            return await deleteSermon(decodeURIComponent(id), env);
        }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function listSermons(env) { 
    const list = await env.MBSERMON.list({ prefix: 'sermon:' }); 
    const promises = list.keys.map(key => env.MBSERMON.get(key.name, { type: 'json' })); 
    const sermons = (await Promise.all(promises)).filter(Boolean); 
    sermons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); 
    return new Response(JSON.stringify(sermons), { 
        headers: { 'Content-Type': 'application/json' } 
    }); 
}

async function deleteSermon(id, env) { 
    await env.MBSERMON.delete(id); 
    return new Response(null, { status: 204 }); 
}