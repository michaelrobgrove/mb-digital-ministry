/**
 * Cloudflare Function to handle prayer requests.
 * ...
 * Required Environment Variables & Bindings:
 * - GEMINI_API_KEY: Your API key for the Google Gemini API.
 * - MBPRAY: The KV namespace for public prayers.
 * - MBPRAY_LOGS: The KV namespace for internal moderation logs.
 */

export async function onRequest(context) {
    if (context.request.method === 'GET') {
        return handleGetRequest(context);
    }
    if (context.request.method === 'POST') {
        return handlePostRequest(context);
    }
    return new Response('Invalid request method.', { status: 405 });
}

async function handleGetRequest(context) {
    try {
        const { env } = context;
        const list = await env.MBPRAY.list({ prefix: 'prayer:' });
        const prayerPromises = list.keys.map(key => env.MBPRAY.get(key.name, { type: 'json' }));
        const prayers = await Promise.all(prayerPromises);
        const sortedPrayers = prayers.filter(p => p).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return new Response(JSON.stringify(sortedPrayers), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error fetching prayer requests:', error);
        return new Response('Could not fetch prayer requests.', { status: 500 });
    }
}

async function handlePostRequest(context) {
    try {
        const { request, env, waitUntil } = context;
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
                createdAt: new Date().toISOString(),
            };
            await env.MBPRAY.put(`prayer:${prayerId}`, JSON.stringify(prayerData), {
                expirationTtl: 604800,
            });
            return new Response(JSON.stringify({ success: true, message: 'Prayer request approved and posted.' }), { status: 201 });
        } else {
            return new Response(JSON.stringify({ success: true, message: 'Prayer request submitted for review.' }), { status: 200 });
        }
    } catch (error) {
        console.error('Error processing prayer submission:', error);
        return new Response('An error occurred while submitting your request.', { status: 500 });
    }
}

async function moderateWithGemini(text, apiKey) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `You are a content moderator for a Christian church's public prayer wall. Analyze the following prayer request. Determine if it is spam, contains inappropriate content (profanity, hate speech, violence), or includes sensitive personal identifiable information (like last names, addresses, phone numbers, emails). Respond with only a single word: APPROVE if the request is a genuine, safe-for-public prayer request. Respond with only a single word: REJECT if it violates any of the rules. Prayer Request: "${text}"`;
    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0, maxOutputTokens: 10 },
            }),
        });
        if (!response.ok) {
            console.error('Gemini API Error:', await response.text());
            return 'REJECT';
        }
        const data = await response.json();
        
        // --- FIX: Safely access nested properties to prevent crash ---
        // Use optional chaining (?.) to avoid errors if parts of the response are missing.
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            console.error('Gemini API Error: No valid text content returned. The prompt may have been blocked for safety reasons.', JSON.stringify(data));
            return 'REJECT';
        }

        const result = resultText.trim().toUpperCase();
        return result === 'APPROVE' ? 'APPROVE' : 'REJECT';
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return 'REJECT';
    }
}

