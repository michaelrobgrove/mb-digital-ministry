/**
 * File Path: /functions/api/admin/generate.js
 * Handles: POST /api/admin/generate - Triggers sermon generation manually
 */

// --- Authentication Functions ---
const textEncoder = new TextEncoder();
async function getHmacKey(secret) { 
    return await crypto.subtle.importKey('raw',textEncoder.encode(secret),{ name: 'HMAC', hash: 'SHA-256' },false,['sign', 'verify']); 
}
async function verifyToken(token, secret) { 
    try { 
        if (!secret) return null; 
        const [header, payloadB64, signatureB64] = token.split('.'); 
        if (!header || !payloadB64 || !signatureB64) return null; 
        const key = await getHmacKey(secret); 
        const data = textEncoder.encode(`${header}.${payloadB64}`); 
        const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); 
        const isValid = await crypto.subtle.verify('HMAC', key, signature, data); 
        if (!isValid) return null; 
        return JSON.parse(atob(payloadB64)); 
    } catch (e) { 
        return null; 
    } 
}
async function authFromRequest(request, env) { 
    const h = request.headers.get('authorization') || ''; 
    if (!h.startsWith('Bearer ')) return null; 
    const tok = h.slice(7); 
    return await verifyToken(tok, env.ADMIN_SECRET); 
}

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const user = await authFromRequest(request, env);
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Make an internal request to the scheduled function
        const baseUrl = new URL(request.url).origin;
        const scheduledUrl = `${baseUrl}/_scheduled/generate-sermon`;
        
        console.log('Manual trigger: calling scheduled function');
        
        const result = await fetch(scheduledUrl, {
            method: 'POST',
            headers: {
                'X-Internal-Request': 'true',
                'Content-Type': 'application/json'
            }
        });
        
        if (!result.ok) {
            throw new Error(`Scheduled function returned ${result.status}`);
        }
        
        const data = await result.json();
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Sermon generation completed successfully',
            sermonId: data.sermonId
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Manual generation failed:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to trigger sermon generation',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
