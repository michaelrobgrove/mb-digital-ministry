/**
 * File Path: /functions/api/admin/sermons/generate.js
 * Handles: POST /api/admin/sermons/generate - Force generate a new sermon
 */

const textEncoder = new TextEncoder();
async function getHmacKey(secret) { return await crypto.subtle.importKey('raw',textEncoder.encode(secret),{ name: 'HMAC', hash: 'SHA-256' },false,['sign', 'verify']); }
async function verifyToken(token, secret) { try { if (!secret) return null; const [header, payloadB64, signatureB64] = token.split('.'); if (!header || !payloadB64 || !signatureB64) return null; const key = await getHmacKey(secret); const data = textEncoder.encode(`${header}.${payloadB64}`); const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); const isValid = await crypto.subtle.verify('HMAC', key, signature, data); if (!isValid) return null; return JSON.parse(atob(payloadB64)); } catch (e) { return null; } }
async function authFromRequest(request, env) { const h = request.headers.get('authorization') || ''; if (!h.startsWith('Bearer ')) return null; const tok = h.slice(7); return await verifyToken(tok, env.ADMIN_SECRET); }

export async function onRequest(context) {
    const { request, env } = context;
    
    const user = await authFromRequest(request, env);
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (request.method === 'POST') {
        return await forceGenerateSermon(env);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function forceGenerateSermon(env) { 
    // Generate with a unique timestamp-based key instead of Sunday-based
    const now = new Date();
    const cacheKey = `sermon:${now.toISOString()}`; // Unique timestamp-based key
    const newSermon = await generateSermonAndAudio(env.GEMINI_API_KEY, env.ELEVENLABS_API_KEY); 
    newSermon.id = cacheKey; 
    await env.MBSERMON.put(cacheKey, JSON.stringify(newSermon), { expirationTtl: 5616000 }); 
    
    return new Response(JSON.stringify(newSermon), { 
        status: 201, 
        headers: { 'Content-Type': 'application/json' } 
    }); 
}

async function generateSermonAndAudio(geminiApiKey, elevenLabsApiKey) { 
    const sermonTextData = await generateSermonText(geminiApiKey); 
    let audioBase64 = null; 
    try { 
        audioBase64 = await generateAudio(sermonTextData.text, elevenLabsApiKey); 
    } catch (error) { 
        console.error("Audio generation failed, continuing with text-only sermon:", error); 
    } 
    return { ...sermonTextData, audioData: audioBase64, createdAt: new Date().toISOString() }; 
}

async function generateSermonText(apiKey) { 
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`; 
    const sermonThemes = ["a key passage from the book of Romans", "a key passage from the Gospel of John", "the concept of faith as described in the book of Hebrews", "a parable from the Gospel of Luke", "the theme of grace in the book of Ephesians", "a Psalm of praise and its meaning for today's believer", "the importance of fellowship from the book of Acts"]; 
    const selectedTheme = sermonThemes[Math.floor(Math.random() * sermonThemes.length)]; 
    const prompt = `You are an AI assistant, Pastor AIden, creating a weekly sermon for a Baptist resource website. Your theology must strictly align with Southern Baptist and Independent Baptist beliefs, using the King James Version of the Bible for all scripture references. Generate a full, expositional sermon of approximately 2,500 words based on ${selectedTheme}. The sermon should be structured with a clear introduction, 3-4 main points with sub-points, and a concluding call to action or reflection. Your response MUST be a JSON object with the following schema: {"topic": "A short, engaging topic for the sermon (e.g., 'The Power of Grace')","title": "A formal title for the sermon (e.g., 'Unwavering Hope in Romans 8')","text": "The full text of the sermon, formatted with newline characters (\\n\\n) between paragraphs."}`; 
    const response = await fetch(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, response_mime_type: "application/json" } }) }); 
    if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`); 
    const data = await response.json(); 
    let sermonText = data.candidates?.[0]?.content?.parts?.[0]?.text; 
    if (!sermonText) throw new Error('No valid sermon text returned from Gemini.'); 
    try { 
        sermonText = sermonText.replace(/^```json\n/, '').replace(/\n```$/, ''); 
        return JSON.parse(sermonText); 
    } catch (e) { 
        throw new Error("Malformed JSON received from AI model."); 
    } 
}

async function generateAudio(text, apiKey) { 
    const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; 
    const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`; 
    const textForAudio = text.substring(0, 2500); 
    const response = await fetch(ELEVENLABS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey }, body: JSON.stringify({ text: textForAudio, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) }); 
    if (!response.ok) throw new Error(`ElevenLabs API Error: ${await response.text()}`); 
    const audioArrayBuffer = await response.arrayBuffer(); 
    return btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer))); 
}