/**
 * File Path: /functions/api/prayer.js
 * Handles all public-facing prayer and question submissions.
 * - POST /api/prayer -> Submits a new prayer request for the wall.
 * - POST /api/ask-pastor -> Submits a question for Pastor AIden.
 */

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        if (url.pathname === '/api/prayer') {
            return await handlePrayerSubmission(request, env, context.waitUntil);
        }
        if (url.pathname === '/api/ask-pastor') {
            return await handleAskPastor(request, env);
        }
        return new Response('Not Found', { status: 404 });
    } catch (err) {
        console.error("Error in prayer/ask function:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

// --- ASK PASTOR AIDEN LOGIC ---
async function handleAskPastor(request, env) {
    const { question } = await request.json();
    if (!question) {
        return new Response(JSON.stringify({ error: 'Question is required.' }), { status: 400 });
    }
    
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const prompt = `You are Pastor AIden, an AI assistant for the Maryland Baptist Digital Ministry. Your theology is strictly aligned with Southern Baptist beliefs (using the KJV Bible). A user has asked the following question. Provide a compassionate, biblically-sound answer of 2-4 paragraphs. Question: "${question}"`;
    
    const response = await fetch(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }]}) });
    if (!response.ok) {
        console.error("Gemini API Error:", await response.text());
        throw new Error('Failed to get a response from the AI model.');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('AI model returned an empty response.');

    return new Response(JSON.stringify({ response: text }), { headers: { 'Content-Type': 'application/json' } });
}

// --- PRAYER WALL SUBMISSION LOGIC ---
async function handlePrayerSubmission(request, env, waitUntil) {
    const { firstName, requestText } = await request.json();
    if (!firstName || !requestText) {
        return new Response('Missing first name or request text.', { status: 400 });
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
            createdAt: logEntry.timestamp, // Use the same timestamp
        };
        await env.MBPRAY.put(`prayer:${prayerId}`, JSON.stringify(prayerData), {
            expirationTtl: 604800,
        });
        return new Response(JSON.stringify({ success: true, message: 'Prayer request approved and posted.' }), { status: 201 });
    } else {
        return new Response(JSON.stringify({ success: true, message: 'Prayer request submitted for review.' }), { status: 200 });
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

