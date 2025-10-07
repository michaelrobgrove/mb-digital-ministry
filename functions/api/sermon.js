/**
 * Cloudflare Function to generate and serve an archive of weekly sermons.
 * Keeps a rolling 2-month archive of sermons.
 * Prioritizes text generation; audio is optional and fails gracefully.
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
    const edtOffset = -4 * 60; 
    const nowInUTC = now.getTime() + (now.getTimezoneOffset() * 60000);
    const nowET = new Date(nowInUTC + (edtOffset * 60000));

    const dayOfWeek = nowET.getDay();
    let daysToSubtract = dayOfWeek;

    const releaseDate = new Date(nowET);
    releaseDate.setDate(releaseDate.getDate() - daysToSubtract);
    releaseDate.setHours(8, 45, 0, 0);

    if (releaseDate > nowET) {
        releaseDate.setDate(releaseDate.getDate() - 7);
    }
    
    return releaseDate;
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
        
        console.log("Function invoked. Attempting to fetch sermon list.");
        const list = await env.MBSERMON.list({ prefix: 'sermon:' });
        console.log(`Found ${list.keys.length} sermon keys in KV.`);

        if (list.keys.length === 0) {
            console.log("No sermons exist. Triggering initial synchronous generation.");
            const firstSermon = await generateAndCacheSermon(env);
            console.log("Initial sermon generated and cached.");
            return new Response(JSON.stringify([firstSermon]), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const sermonPromises = list.keys.map(key => env.MBSERMON.get(key.name, { type: 'json' }));
        let allSermons = (await Promise.all(sermonPromises)).filter(Boolean);
        allSermons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const latestSermon = allSermons[0];
        const releaseTime = getMostRecentSunday845AMET();
        const sermonTimestamp = new Date(latestSermon.createdAt);

        console.log(`Latest sermon date: ${sermonTimestamp.toISOString()}, Target release time: ${releaseTime.toISOString()}`);

        if (sermonTimestamp < releaseTime) {
            console.log("Cache is stale. Starting background regeneration.");
            waitUntil(generateAndCacheSermon(env));
        } else {
            console.log("Serving fresh sermon from cache.");
        }

        return new Response(JSON.stringify(allSermons), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Critical error in handleGetRequest:", error);
        return new Response('Failed to load sermons.', { status: 500 });
    }
}

async function generateAndCacheSermon(env) {
    const releaseTime = getMostRecentSunday845AMET();
    const cacheKey = getSundayKey(releaseTime);
    
    console.log(`Generating new sermon for key: ${cacheKey}`);
    const newSermon = await generateSermonAndAudio(env.GEMINI_API_KEY, env.ELEVENLABS_API_KEY);
    newSermon.id = cacheKey;
    
    await env.MBSERMON.put(cacheKey, JSON.stringify(newSermon), {
        expirationTtl: 5616000, // ~65 days
    });
    console.log(`Successfully cached new sermon: ${cacheKey}`);
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
    
    let audioBase64 = null;
    try {
        audioBase64 = await generateAudio(sermonTextData.text, elevenLabsApiKey);
    } catch (error) {
        console.error("Audio generation failed, but continuing with text-only sermon:", error);
    }

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
    let sermonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!sermonText) throw new Error('No valid sermon text returned from Gemini.');
    
    // --- NEW: Robust JSON parsing ---
    try {
        // Clean the string: remove markdown backticks and "json" prefix
        sermonText = sermonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        return JSON.parse(sermonText);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response. Raw text:", sermonText);
        // Throw a new error to be caught by the calling function
        throw new Error("Malformed JSON received from AI model.");
    }
}

async function generateAudio(text, apiKey) {
    const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; 
    const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

    const textForAudio = text.substring(0, 2500);

    const response = await fetch(ELEVENLABS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({
            text: textForAudio,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
    });

    if (!response.ok) throw new Error(`ElevenLabs API Error: ${await response.text()}`);
    
    const audioArrayBuffer = await response.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));
}

