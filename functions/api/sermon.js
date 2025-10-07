/**
 * Cloudflare Function to generate and serve the weekly sermon text.
 * Caches the sermon and regenerates it after 8:45 AM ET on Sundays.
 *
 * Required Environment Variables:
 * - ADMIN_KEY: A secret key to authorize manual cache deletion.
 * - GEMINI_API_KEY: Your API key for the Google Gemini API.
 * - MBSERMON: The KV namespace for storing the weekly sermon.
 */

/**
 * Calculates the exact timestamp of the most recent Sunday at 8:45 AM Eastern Time.
 * This is used to determine if the cached sermon is stale.
 * @returns {Date} - The date object for the target release time.
 */
function getMostRecentSunday845AMET() {
    // Workers run in UTC. We need to work with dates relative to America/New_York.
    const now = new Date();
    const nowET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Find the date of the most recent Sunday
    const dayOfWeek = nowET.getDay(); // Sunday is 0
    const diff = nowET.getDate() - dayOfWeek;
    const lastSunday = new Date(nowET.setDate(diff));

    // Set the time to 8:45:00 AM
    lastSunday.setHours(8, 45, 0, 0);

    // If today is Sunday but it's BEFORE 8:45 AM, we should still serve the *previous* week's sermon.
    // So, we check if the current ET time is earlier than the calculated release time.
    if (nowET < lastSunday) {
        // If it is, subtract 7 days to get the previous Sunday's release time.
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
        const { env } = context;
        const CACHE_KEY = 'current_sermon';

        const cachedSermon = await env.MBSERMON.get(CACHE_KEY, { type: 'json' });

        if (cachedSermon) {
            const releaseTime = getMostRecentSunday845AMET();
            const sermonTimestamp = new Date(cachedSermon.createdAt);

            // If the sermon was created after the most recent release time, it's fresh.
            if (sermonTimestamp >= releaseTime) {
                return new Response(JSON.stringify(cachedSermon), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // If no cache or if the sermon is stale, generate a new one.
        const newSermon = await generateSermon(env.GEMINI_API_KEY);

        // Store the new sermon in KV for 8 days as a fallback.
        context.waitUntil(
            env.MBSERMON.put(CACHE_KEY, JSON.stringify(newSermon), {
                expirationTtl: 691200, // 8 days
            })
        );
        
        return new Response(JSON.stringify(newSermon), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in sermon function:", error);
        return new Response('Failed to generate sermon.', { status: 500 });
    }
}

/**
 * Handles securely deleting the cached sermon to force a refresh.
 */
async function handleDeleteRequest(context) {
    try {
        const { request, env } = context;
        const providedKey = request.headers.get('x-admin-key');

        // Check for the secret admin key you already set up
        if (providedKey !== env.ADMIN_KEY) {
            return new Response('Unauthorized', { status: 401 });
        }
        
        await env.MBSERMON.delete('current_sermon');
        
        return new Response('Sermon cache cleared. The next visit will generate a new sermon.', { status: 200 });

    } catch (error) {
        console.error('Error during sermon deletion:', error);
        return new Response('An error occurred while clearing the sermon cache.', { status: 500 });
    }
}


/**
 * Calls the Gemini API to generate the sermon text.
 */
async function generateSermon(apiKey) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
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

    const sermonData = JSON.parse(sermonText);
    // Add the creation timestamp to the sermon object
    sermonData.createdAt = new Date().toISOString();
    return sermonData;
}
```

### How to Manually Force a New Sermon

After you deploy this updated function, you can force the cache to clear at any time.

1.  Open your website's sermon page.
2.  Open the developer console (usually `F12` or `Ctrl+Shift+I`).
3.  Paste the following code into the console, replacing `'YourSecretKeyGoesHere'` with the `ADMIN_KEY` you already have saved in your Cloudflare environment variables.

    ```javascript
    fetch('/api/sermon', {
        method: 'DELETE',
        headers: {
            'x-admin-key': 'YourSecretKeyGoesHere' 
        }
    }).then(res => res.text()).then(console.log);
    

