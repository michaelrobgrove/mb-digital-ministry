/**
 * File Path: /functions/api/prayer.js
 * Handles all public-facing prayer submissions and retrieval
 * - GET /api/prayer -> Returns all approved prayers
 * - POST /api/prayer -> Submits a new prayer request for the wall
 */

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    try {
        if (request.method === 'GET' && url.pathname === '/api/prayer') {
            return await getPrayers(env);
        }
        
        if (request.method === 'POST' && url.pathname === '/api/prayer') {
            return await handlePrayerSubmission(request, env, context.waitUntil);
        }
        
        return new Response('Not Found', { status: 404 });
    } catch (err) {
        console.error("Error in prayer function:", err);
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// --- GET APPROVED PRAYERS ---
async function getPrayers(env) {
    try {
        const list = await env.MBPRAY.list({ prefix: 'prayer:' });
        const promises = list.keys.map(key => env.MBPRAY.get(key.name, { type: 'json' }));
        const prayers = (await Promise.all(promises)).filter(Boolean);
        
        // Sort by creation date, newest first
        prayers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return new Response(JSON.stringify(prayers), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error fetching prayers:", error);
        return new Response(JSON.stringify({ error: 'Failed to load prayers' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// --- PRAYER WALL SUBMISSION LOGIC ---
async function handlePrayerSubmission(request, env, waitUntil) {
    const { firstName, requestText } = await request.json();
    if (!firstName || !requestText) {
        return new Response(JSON.stringify({ error: 'Missing first name or request text.' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const moderationResult = await moderateWithGemini(requestText, env.GEMINI_API_KEY);

    const logEntry = {
        timestamp: new Date().toISOString(),
        firstName: firstName,
        requestText: requestText,
        moderationStatus: moderationResult,
        ip: request.headers.get('CF-Connecting-IP') || 'N/A',
    };
    
    const logKey = `log:${logEntry.timestamp}:${crypto.randomUUID()}`;
    waitUntil(env.MBPRAY_LOGS.put(logKey, JSON.stringify(logEntry)));

    if (moderationResult === 'APPROVE') {
        const prayerId = crypto.randomUUID();
        const prayerData = {
            id: prayerId,
            firstName: firstName.trim(),
            requestText: requestText.trim(),
            createdAt: logEntry.timestamp,
        };
        await env.MBPRAY.put(`prayer:${prayerId}`, JSON.stringify(prayerData), {
            expirationTtl: 604800,
        });
        return new Response(JSON.stringify({ success: true, message: 'Prayer request approved and posted.' }), { 
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } else {
        return new Response(JSON.stringify({ success: true, message: 'Prayer request submitted for review.' }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function moderateWithGemini(text, apiKey) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `Analyze the following prayer request for a public church prayer wall. Is it a genuine, safe-for-public prayer request? Rules: No spam, no profanity, no hate speech, no violence, and no sensitive personal information (last names, addresses, emails, phone numbers). Respond with JSON that follows this schema: {"decision": "APPROVE" | "REJECT"}. Prayer Request: "${text}"`;
    
    try {
        const response = await fetch(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, response_mime_type: "application/json" } }) });
        if (!response.ok) { console.error('Gemini API Error:', await response.text()); return 'REJECT'; }
        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) { console.error('Gemini API Error: No valid text content returned.', JSON.stringify(data)); return 'REJECT'; }
        const parsedResult = JSON.parse(resultText);
        const decision = parsedResult.decision?.trim().toUpperCase();
        return decision === 'APPROVE' ? 'APPROVE' : 'REJECT';
    } catch (error) {
        console.error('Error calling or parsing Gemini API response:', error);
        return 'REJECT';
    }
}