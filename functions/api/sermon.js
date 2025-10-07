/**
 * Cloudflare Function to generate and serve an archive of weekly sermons.
 * Keeps a rolling 2-month archive of sermons.
 *
 * Required Environment Variables:
 * - ADMIN_KEY: A secret key to authorize manual cache deletion.
 * - GEMINI_API_KEY: Your API key for the Google Gemini API.
 * - ELEVENLABS_API_KEY: Your API key for ElevenLabs TTS service.
 * - MBSERMON: The KV namespace for storing the sermon archive.
 */

function getSundayKey(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const sunday = new Date(d.setDate(diff));
    return `sermon:${sunday.toISOString().split('T')[0]}`;
}

function getMostRecentSunday845AMET() {
    const now = new Date();
    const nowET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dayOfWeek = nowET.getDay();
    const diff = nowET.getDate() - dayOfWeek;
    const lastSunday = new Date(nowET.setDate(diff));
    lastSunday.setHours(8, 45, 0, 0);
    if (nowET < lastSunday) {
        lastSunday.setDate(lastSunday.getDate() - 7);
    }
    return lastSunday;
}

export async function onRequest(context) {
    const { request } = context;
    if (request.method === 'GET') {
        return handleGetRequest(context);
    }
    if (request.method === 'DELETE') {
        return handleDeleteRequest(context);
    }
    return new Response('Invalid request method.', { status: 405 });
}

async function handleGetRequest(context) {
    try {
        const { env, waitUntil } = context;

        // 1. Fetch all existing sermon keys
        const list = await env.MBSERMON.list({ prefix: 'sermon:' });
        const sermonPromises = list.keys.map(key => env.MBSERMON.get(key.name, { type: 'json' }));
        const allSermons = (await Promise.all(sermonPromises)).filter(Boolean);
        
        // 2. Sort sermons with the newest first
        allSermons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // 3. Check if the current week's sermon needs to be generated
        const releaseTime = getMostRecentSunday845AMET();
        const currentSermonKey = getSundayKey(releaseTime);
        const currentSermonExists = allSermons.some(sermon => sermon.id === currentSermonKey);
        
        const now = new Date();
        const nowET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

        if (!currentSermonExists && nowET >= releaseTime) {
             // If it's after the release time and the sermon doesn't exist, generate it in the background.
             waitUntil(generateAndCacheSermon(env, currentSermonKey));
        }

        // 4. Return all found sermons
        return new Response(JSON.stringify(allSermons), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in sermon function:", error);
        return new Response('Failed to load sermons.', { status: 500 });
    }
}

async function generateAndCacheSermon(env, cacheKey) {
    const newSermon = await generateSermonAndAudio(env.GEMINI_API_KEY, env.ELEVENLABS_API_KEY);
    newSermon.id = cacheKey; // Use the date-based key as the ID
    await env.MBSERMON.put(cacheKey, JSON.stringify(newSermon), {
        // Expire sermons after ~65 days
        expirationTtl: 5616000, 
    });
    return newSermon;
}

async function handleDeleteRequest(context) {
    try {
        const { request, env } = context;
        const providedKey = request.headers.get('x-admin-key');
        if (providedKey !== env.ADMIN_KEY) {
            return new Response('Unauthorized', { status: 401 });
        }
        
        const list = await env.MBSERMON.list({ prefix: 'sermon:' });
        const keysToDelete = list.keys.map(key => key.name);
        await Promise.all(keysToDelete.map(key => env.MBSERMON.delete(key)));

        return new Response(`Sermon archive cleared. ${keysToDelete.length} sermons deleted.`, { status: 200 });
    } catch (error) {
        console.error('Error during sermon deletion:', error);
        return new Response('An error occurred while clearing the sermon archive.', { status: 500 });
    }
}

async function generateSermonAndAudio(geminiApiKey, elevenLabsApiKey) {
    const sermonTextData = await generateSermonText(geminiApiKey);
    const audioBase64 = await generateAudio(sermonTextData.text, elevenLabsApiKey);
    return {
        ...sermonTextData,
        audioData: audioBase64,
        createdAt: new Date().toISOString(),
    };
}

async function generateSermonText(apiKey) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `You are an AI assistant, Pastor AIden, creating a weekly sermon for a Baptist resource website. Your theology must strictly align with Southern Baptist and Independent Baptist beliefs, using the King James Version of the Bible for all scripture references. Generate a full, expositional sermon of approximately 2,500 words based on a key passage from the book of Romans. The sermon should be structured with a clear introduction, 3-4 main points with sub-points, and a concluding call to action or reflection. Your response MUST be a JSON object with the following schema: {"topic": "A short, engaging topic for the sermon (e.g., 'The Power of Grace')","title": "A formal title for the sermon (e.g., 'Unwavering Hope in Romans 8')","text": "The full text of the sermon, formatted with newline characters (\\n\\n) between paragraphs."}`;
    
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
    const sermonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!sermonText) throw new Error('No valid sermon text returned from Gemini.');
    return JSON.parse(sermonText);
}

async function generateAudio(text, apiKey) {
    const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; 
    const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

    const response = await fetch(ELEVENLABS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
        },
        body: JSON.stringify({
            text: text.substring(0, 4900), // ElevenLabs has a ~5000 character limit per request
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
            },
        }),
    });

    if (!response.ok) throw new Error(`ElevenLabs API Error: ${await response.text()}`);
    
    const audioArrayBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));
    return audioBase64;
}

