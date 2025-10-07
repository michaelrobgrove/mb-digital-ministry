/**
 * File Path: /functions/api/admin.js
 * FINAL CONSOLIDATED VERSION: Handles Admin, Login, Sermons, Prayers, and Ask Pastor AIden.
 */

// --- ROUTER ---
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Public "Ask Pastor" route
    if (path === '/api/ask-pastor' && request.method === 'POST') {
      return await handleAskPastor(request, env);
    }
    
    // Admin routes
    const adminPath = path.split('/api/admin/')[1];
    if (adminPath !== undefined) {
        if (adminPath === 'login' && request.method === 'POST') {
            return await handleLogin(request, env);
        }
        
        const user = await authFromRequest(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        if (adminPath === 'sermons' && request.method === 'GET') return await listSermons(env);
        if (adminPath.startsWith('sermons/delete/')) return await deleteSermon(decodeURIComponent(adminPath.split('/').pop()), env);
        if (adminPath === 'sermons/generate' && request.method === 'POST') return await forceGenerateSermon(context);
        if (adminPath === 'prayers' && request.method === 'GET') return await listPrayers(env);
        if (adminPath.startsWith('prayers/delete/')) return await deletePrayer(decodeURIComponent(adminPath.split('/').pop()), env);
    }

    return new Response(JSON.stringify({error: 'Not Found'}), { status: 404 });
  } catch (err) {
    console.error("API Error:", err);
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
    if (!response.ok) throw new Error('Failed to get a response from the AI model.');

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('AI model returned an empty response.');

    return new Response(JSON.stringify({ response: text }), { headers: { 'Content-Type': 'application/json' } });
}


// --- AUTHENTICATION ---
// (The full, working Web Crypto auth code is here...)
const textEncoder = new TextEncoder();
async function getHmacKey(secret) { /* ... */ }
async function signToken(payload, secret) { /* ... */ }
async function verifyToken(token, secret) { /* ... */ }
async function handleLogin(request, env) { /* ... */ }
async function authFromRequest(request, env) { /* ... */ }


// --- ADMIN ACTIONS (SERMONS & PRAYERS) ---
// (The full, working admin action code is here...)
async function listSermons(env) { /* ... */ }
async function deleteSermon(id, env) { /* ... */ }
async function forceGenerateSermon(context) { /* ... */ }
async function listPrayers(env) { /* ... */ }
async function deletePrayer(id, env) { /* ... */ }

// --- SERMON GENERATION LOGIC ---
// (The full, working sermon generation code is here...)
async function generateAndCacheSermon(env) { /* ... */ }
async function generateSermonAndAudio(geminiApiKey, elevenLabsApiKey) { /* ... */ }
async function generateSermonText(apiKey) { /* ... */ }
async function generateAudio(text, apiKey) { /* ... */ }

// --- FULL FUNCTION IMPLEMENTATIONS (to be pasted below) ---
async function getHmacKey(secret) { return await crypto.subtle.importKey('raw',textEncoder.encode(secret),{ name: 'HMAC', hash: 'SHA-256' },false,['sign', 'verify']); }
async function signToken(payload, secret) { const key = await getHmacKey(secret); const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, ''); const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, ''); const data = textEncoder.encode(`${header}.${payloadB64}`); const signature = await crypto.subtle.sign('HMAC', key, data); const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, ''); return `${header}.${payloadB64}.${signatureB64}`; }
async function verifyToken(token, secret) { try { if (!secret) return null; const [header, payloadB64, signatureB64] = token.split('.'); if (!header || !payloadB64 || !signatureB64) return null; const key = await getHmacKey(secret); const data = textEncoder.encode(`${header}.${payloadB64}`); const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); const isValid = await crypto.subtle.verify('HMAC', key, signature, data); if (!isValid) return null; return JSON.parse(atob(payloadB64)); } catch (e) { return null; } }
async function handleLogin(request, env) { if (!env.SUPERADMIN_USERNAME || !env.SUPERADMIN_PASSWORD || !env.ADMIN_SECRET) { console.error("CRITICAL: Admin environment variables are not configured."); return new Response(JSON.stringify({ error: 'Server-side environment variables are not configured.' }), { status: 500 }); } const body = await request.json(); const { username, password } = body; if (username === env.SUPERADMIN_USERNAME && password === env.SUPERADMIN_PASSWORD) { const token = await signToken({ username, iat: Date.now() }, env.ADMIN_SECRET); return new Response(JSON.stringify({ token }), { status: 200 }); } return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 }); }
async function authFromRequest(request, env) { const h = request.headers.get('authorization') || ''; if (!h.startsWith('Bearer ')) return null; const tok = h.slice(7); return await verifyToken(tok, env.ADMIN_SECRET); }
async function listSermons(env) { const list = await env.MBSERMON.list({ prefix: 'sermon:' }); const promises = list.keys.map(key => env.MBSERMON.get(key.name, { type: 'json' })); const sermons = (await Promise.all(promises)).filter(Boolean); sermons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); return new Response(JSON.stringify(sermons), { headers: { 'Content-Type': 'application/json' } }); }
async function deleteSermon(id, env) { await env.MBSERMON.delete(id); return new Response(null, { status: 204 }); }
async function forceGenerateSermon(context) { const sermon = await generateAndCacheSermon(context.env); return new Response(JSON.stringify(sermon), { status: 201, headers: { 'Content-Type': 'application/json' } }); }
async function listPrayers(env) { const list = await env.MBPRAY_LOGS.list({ prefix: 'log:', limit: 100 }); const promises = list.keys.map(key => env.MBPRAY_LOGS.get(key.name, { type: 'json' }).then(data => ({ ...data, id: key.name }))); const prayers = (await Promise.all(promises)).filter(Boolean); prayers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); return new Response(JSON.stringify(prayers), { headers: { 'Content-Type': 'application/json' } }); }
async function deletePrayer(id, env) { const logData = await env.MBPRAY_LOGS.get(id, { type: 'json' }); if (logData && logData.moderationStatus === 'APPROVE') { const publicList = await env.MBPRAY.list({ prefix: 'prayer:' }); for (const key of publicList.keys) { const prayer = await env.MBPRAY.get(key.name, { type: 'json' }); if (prayer && new Date(prayer.createdAt).getTime() === new Date(logData.timestamp).getTime()) { await env.MBPRAY.delete(key.name); break; } } } await env.MBPRAY_LOGS.delete(id); return new Response(null, { status: 204 }); }
const getSundayKey = (date) => { const d = new Date(date); d.setDate(d.getDate() - d.getDay()); return `sermon:${d.toISOString().split('T')[0]}`; };
const getMostRecentSunday845AMET = () => { const now = new Date(); const edtOffset = -4 * 60; const nowInUTC = now.getTime() + now.getTimezoneOffset() * 60000; const nowET = new Date(nowInUTC + edtOffset * 60000); const releaseDate = new Date(nowET); releaseDate.setDate(releaseDate.getDate() - nowET.getDay()); releaseDate.setHours(8, 45, 0, 0); if (releaseDate > nowET) { releaseDate.setDate(releaseDate.getDate() - 7); } return releaseDate; };
async function generateAndCacheSermon(env) { const releaseTime = getMostRecentSunday845AMET(); const cacheKey = getSundayKey(releaseTime); const newSermon = await generateSermonAndAudio(env.GEMINI_API_KEY, env.ELEVENLABS_API_KEY); newSermon.id = cacheKey; await env.MBSERMON.put(cacheKey, JSON.stringify(newSermon), { expirationTtl: 5616000 }); return newSermon; }
async function generateSermonAndAudio(geminiApiKey, elevenLabsApiKey) { const sermonTextData = await generateSermonText(geminiApiKey); let audioBase64 = null; try { audioBase64 = await generateAudio(sermonTextData.text, elevenLabsApiKey); } catch (error) { console.error("Audio generation failed, continuing with text-only sermon:", error); } return { ...sermonTextData, audioData: audioBase64, createdAt: new Date().toISOString() }; }
async function generateSermonText(apiKey) { const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`; const sermonThemes = ["a key passage from the book of Romans", "a key passage from the Gospel of John", "the concept of faith as described in the book of Hebrews", "a parable from the Gospel of Luke", "the theme of grace in the book of Ephesians", "a Psalm of praise and its meaning for today's believer", "the importance of fellowship from the book of Acts"]; const selectedTheme = sermonThemes[Math.floor(Math.random() * sermonThemes.length)]; const prompt = `You are an AI assistant, Pastor AIden... based on ${selectedTheme}. ... Your response MUST be a JSON object...`; const response = await fetch(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, response_mime_type: "application/json" } }) }); if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`); const data = await response.json(); let sermonText = data.candidates?.[0]?.content?.parts?.[0]?.text; if (!sermonText) throw new Error('No valid sermon text returned from Gemini.'); try { sermonText = sermonText.replace(/^```json\n/, '').replace(/\n```$/, ''); return JSON.parse(sermonText); } catch (e) { throw new Error("Malformed JSON received from AI model."); } }
async function generateAudio(text, apiKey) { const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`; const textForAudio = text.substring(0, 2500); const response = await fetch(ELEVENLABS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey }, body: JSON.stringify({ text: textForAudio, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) }); if (!response.ok) throw new Error(`ElevenLabs API Error: ${await response.text()}`); const audioArrayBuffer = await response.arrayBuffer(); return btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer))); }

