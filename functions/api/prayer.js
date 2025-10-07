/**
 * Cloudflare Function to handle prayer requests.
 * - GET /api/prayer: Fetches all approved public prayer requests from KV.
 * - POST /api/prayer: Submits a new prayer request for AI moderation and storage.
 *
 * Required Environment Variables:
 * - GEMINI_API_KEY: Your API key for the Google Gemini API.
 * - MBPRAY: The KV namespace binding for storing prayer requests.
 */

// Handles both GET and POST requests
export async function onRequest(context) {
    if (context.request.method === 'GET') {
        return handleGetRequest(context);
    }

    if (context.request.method === 'POST') {
        return handlePostRequest(context);
    }

    return new Response('Invalid request method.', { status: 405 });
}

/**
 * Handles fetching and returning all approved prayer requests.
 */
async function handleGetRequest(context) {
    try {
        const { env } = context;
        const list = await env.MBPRAY.list({ prefix: 'prayer:' });
        
        const prayerPromises = list.keys.map(key => env.MBPRAY.get(key.name, { type: 'json' }));
        const prayers = await Promise.all(prayerPromises);

        // Sort prayers with the newest first
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

/**
 * Handles submitting, moderating, and storing a new prayer request.
 */
async function handlePostRequest(context) {
    try {
        const { request, env } = context;
        const { firstName, requestText } = await request.json();

        if (!firstName || !requestText) {
            return new Response('Missing first name or request text.', { status: 400 });
        }

        // Moderate the content using Gemini
        const isApproved = await moderateWithGemini(requestText, env.GEMINI_API_KEY);

        if (isApproved) {
            const prayerId = crypto.randomUUID();
            const prayerData = {
                id: prayerId,
                firstName: firstName.trim(),
                requestText: requestText.trim(),
                createdAt: new Date().toISOString(),
            };

            // Store in KV for 7 days (604800 seconds)
            await env.MBPRAY.put(`prayer:${prayerId}`, JSON.stringify(prayerData), {
                expirationTtl: 604800,
            });

            return new Response(JSON.stringify({ success: true, message: 'Prayer request approved and posted.' }), { status: 201 });
        } else {
            // If rejected, we still return a "success" to the client.
            // This prevents spammers from knowing they were blocked.
            return new Response(JSON.stringify({ success: true, message: 'Prayer request submitted.' }), { status: 200 });
        }
    } catch (error) {
        console.error('Error processing prayer submission:', error);
        return new Response('An error occurred while submitting your request.', { status: 500 });
    }
}

/**
 * Calls the Gemini API to moderate content.
 * @param {string} text - The text to moderate.
 * @param {string} apiKey - The Gemini API key.
 * @returns {Promise<boolean>} - True if approved, false if rejected.
 */
async function moderateWithGemini(text, apiKey) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    const prompt = `You are a content moderator for a Christian church's public prayer wall. Analyze the following prayer request. Determine if it is spam, contains inappropriate content (profanity, hate speech, violence), or includes sensitive personal identifiable information (like last names, addresses, phone numbers, emails). Respond with only a single word: APPROVE if the request is a genuine, safe-for-public prayer request. Respond with only a single word: REJECT if it violates any of the rules. Prayer Request: "${text}"`;

    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 10,
                },
            }),
        });

        if (!response.ok) {
            console.error('Gemini API Error:', await response.text());
            return false; // Fails safely
        }

        const data = await response.json();
        const result = data.candidates[0].content.parts[0].text.trim().toUpperCase();

        return result === 'APPROVE';
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return false; // If the API call fails for any reason, reject the content to be safe.
    }
}