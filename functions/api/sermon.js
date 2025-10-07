/**
 * Cloudflare Function to generate and serve the weekly sermon text.
 * Caches the sermon for 24 hours to minimize API calls.
 *
 * Required Environment Variables:
 * - GEMINI_API_KEY: Your API key for the Google Gemini API.
 * - MBSERMON: The KV namespace for storing the weekly sermon.
 */

export async function onRequest(context) {
    try {
        const { env } = context;
        const CACHE_KEY = 'current_sermon';

        // 1. Try to get the sermon from the KV cache first
        const cachedSermon = await env.MBSERMON.get(CACHE_KEY, { type: 'json' });
        if (cachedSermon) {
            return new Response(JSON.stringify(cachedSermon), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. If not in cache, generate a new sermon
        const newSermon = await generateSermon(env.GEMINI_API_KEY);

        // 3. Store the new sermon in KV for 24 hours (86400 seconds)
        // Use waitUntil to not block the response to the user
        context.waitUntil(
            env.MBSERMON.put(CACHE_KEY, JSON.stringify(newSermon), {
                expirationTtl: 86400,
            })
        );
        
        // 4. Return the newly generated sermon
        return new Response(JSON.stringify(newSermon), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in sermon function:", error);
        return new Response('Failed to generate sermon.', { status: 500 });
    }
}

/**
 * Calls the Gemini API to generate the sermon text.
 * @param {string} apiKey - The Gemini API key.
 * @returns {Promise<object>} - An object containing the sermon title, topic, and text.
 */
async function generateSermon(apiKey) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // This prompt is designed to create a full-length sermon
    const prompt = `You are an AI assistant, Pastor AIden, creating a weekly sermon for a Baptist resource website. Your theology must strictly align with Southern Baptist and Independent Baptist beliefs, using the King James Version of the Bible for all scripture references.
    
    Generate a full, expositional sermon of approximately 2,500 words. The sermon should be structured with a clear introduction, 3-4 main points with sub-points, and a concluding call to action or reflection.
    
    The sermon should be based on a key passage from the book of Romans.
    
    Your response MUST be a JSON object with the following schema:
    {
      "topic": "A short, engaging topic for the sermon (e.g., 'The Power of Grace')",
      "title": "A formal title for the sermon (e.g., 'Unwavering Hope in Romans 8')",
      "text": "The full text of the sermon, formatted with newline characters (\\n\\n) between paragraphs."
    }`;

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

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const sermonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!sermonText) {
        throw new Error('No valid sermon text returned from Gemini.');
    }

    return JSON.parse(sermonText);
}
