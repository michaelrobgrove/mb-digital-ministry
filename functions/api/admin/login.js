/**
 * File Path: /functions/api/admin/login.js
 * Handles admin authentication/login
 */

// --- AUTHENTICATION HELPERS (Web Crypto API) ---
const textEncoder = new TextEncoder();

async function getHmacKey(secret) {
    return await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

async function signToken(payload, secret) {
    const key = await getHmacKey(secret);
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
    const data = textEncoder.encode(`${header}.${payloadB64}`);
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '');
    return `${header}.${payloadB64}.${signatureB64}`;
}

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const { username, password } = await request.json();

        // Check credentials against environment variables
        if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
            const token = await signToken({ user: username, exp: Date.now() + 86400000 }, env.ADMIN_SECRET);
            return new Response(JSON.stringify({ token }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error("Login error:", err);
        return new Response(JSON.stringify({ error: 'Login failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}