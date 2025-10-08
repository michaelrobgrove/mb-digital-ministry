/**
 * File Path: /functions/api/admin/generate.js
 * Handles: POST /api/admin/generate - Generate new sermon
 */

const textEncoder = new TextEncoder();
async function getHmacKey(secret) { return await crypto.subtle.importKey('raw',textEncoder.encode(secret),{ name: 'HMAC', hash: 'SHA-256' },false,['sign', 'verify']); }
async function verifyToken(token, secret) { try { if (!secret) return null; const [header, payloadB64, signatureB64] = token.split('.'); if (!header || !payloadB64 || !signatureB64) return null; const key = await getHmacKey(secret); const data = textEncoder.encode(`${header}.${payloadB64}`); const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); const isValid = await crypto.subtle.verify('HMAC', key, signature, data); if (!isValid) return null; return JSON.parse(atob(payloadB64)); } catch (e) { return null; } }
async function authFromRequest(request, env) { const h = request.headers.get('authorization') || ''; if (!h.startsWith('Bearer ')) return null; const tok = h.slice(7); return await verifyToken(tok, env.ADMIN_SECRET); }

export async function onRequest(context) {
    const { request, env, waitUntil } = context;

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
        console.log('Starting sermon generation...');
        waitUntil(generateAndStoreSermon(env));
        return new Response(JSON.stringify({ success: true, message: 'Sermon generation started' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('Generate error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function generateAndStoreSermon(env) {
    console.log("Generating sermon content...");
    
    const sermonThemes = [
        "a key passage from the book of Romans",
        "a key passage from the Gospel of John",
        "the concept of faith as described in the book of Hebrews",
        "a parable from the Gospel of Luke",
        "the theme of grace in the book of Ephesians",
        "a Psalm of praise and its meaning for today's believer",
        "the importance of fellowship from the book of Acts"
    ];
    const selectedTheme = sermonThemes[Math.floor(Math.random() * sermonThemes.length)];
    
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const prompt = `You are an AI assistant, Pastor AIden, creating a weekly sermon for a Baptist resource website. Your theology must strictly align with Southern Baptist and Independent Baptist beliefs, using the King James Version of the Bible for all scripture references. Generate a full, expositional sermon of approximately 2,500 words based on ${selectedTheme}. The sermon should be structured with a clear introduction, 3-4 main points with sub-points, and a concluding call to action or reflection. Your response MUST be a JSON object with the following schema: {"topic": "A short, engaging topic for the sermon (e.g., 'The Power of Grace')","title": "A formal title for the sermon (e.g., 'Unwavering Hope in Romans 8')","text": "The full text of the sermon, formatted with newline characters (\\n\\n) between paragraphs."}`;
    
    const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                response_mime_type: "application/json",
            },
        }),
    });

    if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`);
    const data = await response.json();
    let sermonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!sermonText) throw new Error('No valid sermon text returned from Gemini.');
    
    try {
        sermonText = sermonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        const sermonData = JSON.parse(sermonText);
        
        const sermonId = `sermon:${new Date().toISOString()}`;
        const fullSermonData = {
            id: sermonId,
            title: sermonData.title,
            topic: sermonData.topic,
            text: sermonData.text,
            createdAt: new Date().toISOString(),
            audioData: null
        };
        
        await env.MBSERMON.put(sermonId, JSON.stringify(fullSermonData), {
            expirationTtl: 5616000
        });
        console.log("Sermon stored with ID:", sermonId);
    } catch (e) {
        console.error("Failed to parse or store sermon:", e);
        throw new Error("Malformed JSON received from AI model.");
    }
}