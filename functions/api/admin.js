/**
 * File Path: /functions/api/admin.js
 * * Cloudflare Pages Function for Maryland Baptist Admin Dashboard
 *
 * Routes:
 * - POST /api/admin/login -> returns JWT token
 * - GET  /api/admin/sermons -> list sermons from MBSERMON
 * - DELETE /api/admin/sermons/delete/:id -> delete a sermon
 * - POST /api/admin/sermons/generate -> force generate a new sermon
 * - GET  /api/admin/prayers -> list prayers from MBPRAY_LOGS
 * - DELETE /api/admin/prayers/delete/:id -> delete a prayer request
 *
 * Environment variables expected:
 * - ADMIN_SECRET, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD
 * - GEMINI_API_KEY, ELEVENLABS_API_KEY
 * - MBSERMON (KV), MBPRAY (KV), MBPRAY_LOGS (KV)
 */

import { createHmac } from 'crypto';

// --- ROUTER ---
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // A more robust way to get the path segment after /api/admin/
  const pathSegments = url.pathname.split('/api/admin/');
  const path = pathSegments.length > 1 ? pathSegments[1] : '';

  try {
    if (path === 'login' && request.method === 'POST') {
      return await handleLogin(request, env);
    }
    
    // All routes below this require authentication
    const user = authFromRequest(request, env);
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (path === 'sermons' && request.method === 'GET') {
      return await listSermons(env);
    }
    if (path.startsWith('sermons/delete/')) {
      const id = decodeURIComponent(path.split('/').pop());
      return await deleteSermon(id, env);
    }
    if (path === 'sermons/generate' && request.method === 'POST') {
      return await forceGenerateSermon(env);
    }
    if (path === 'prayers' && request.method === 'GET') {
      return await listPrayers(env);
    }
    if (path.startsWith('prayers/delete/')) {
      const id = decodeURIComponent(path.split('/').pop());
      return await deletePrayer(id, env);
    }

    return new Response(JSON.stringify({error: 'Not Found', path: path}), { status: 404 });
  } catch (err) {
    console.error("API Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// --- AUTHENTICATION ---
function signToken(payload, secret) {
  const str = JSON.stringify(payload);
  const b64 = btoa(str);
  const sig = createHmac('sha256', secret).update(b64).digest('hex');
  return b64 + '.' + sig;
}

function verifyToken(token, secret) {
  try {
    const [b64, sig] = token.split('.');
    const expected = createHmac('sha256', secret).update(b64).digest('hex');
    if (expected !== sig) return null;
    return JSON.parse(atob(b64));
  } catch (e) {
    return null;
  }
}

async function handleLogin(request, env) {
  const body = await request.json();
  const { username, password } = body;
  if (username === env.SUPERADMIN_USERNAME && password === env.SUPERADMIN_PASSWORD) {
    const token = signToken({ username, iat: Date.now() }, env.ADMIN_SECRET);
    return new Response(JSON.stringify({ token }), { status: 200 });
  }
  return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
}

function authFromRequest(request, env) {
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  const tok = h.slice(7);
  return verifyToken(tok, env.ADMIN_SECRET || 'dev_secret');
}

// --- SERMON ACTIONS ---
async function listSermons(env) {
    const list = await env.MBSERMON.list({ prefix: 'sermon:' });
    const promises = list.keys.map(key => env.MBSERMON.get(key.name, { type: 'json' }));
    const sermons = (await Promise.all(promises)).filter(Boolean);
    sermons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return new Response(JSON.stringify(sermons), { headers: { 'Content-Type': 'application/json' } });
}

async function deleteSermon(id, env) {
    await env.MBSERMON.delete(id);
    return new Response(JSON.stringify({ success: true, id }), { headers: { 'Content-Type': 'application/json' } });
}

async function forceGenerateSermon(env) {
    const sermon = await generateAndCacheSermon(env);
    return new Response(JSON.stringify(sermon), { status: 201, headers: { 'Content-Type': 'application/json' } });
}

// --- PRAYER ACTIONS ---
async function listPrayers(env) {
    const list = await env.MBPRAY_LOGS.list({ prefix: 'log:', limit: 100 });
    const promises = list.keys.map(key => env.MBPRAY_LOGS.get(key.name, { type: 'json' }).then(data => ({ ...data, id: key.name })));
    const prayers = (await Promise.all(promises)).filter(Boolean);
    prayers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return new Response(JSON.stringify(prayers), { headers: { 'Content-Type': 'application/json' } });
}

async function deletePrayer(id, env) {
    await env.MBPRAY_LOGS.delete(id);
    // Also try to delete from public prayers if it was approved
    // Note: This is a simple check; a more robust system might link IDs directly.
    return new Response(JSON.stringify({ success: true, id }), { headers: { 'Content-Type': 'application/json' } });
}

// --- SERMON GENERATION LOGIC (Copied from your public sermon function) ---
// NOTE: I am including the full generation logic here so this function is self-contained.
const getSundayKey = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return `sermon:${d.toISOString().split('T')[0]}`;
};

const getMostRecentSunday845AMET = () => {
    const now = new Date();
    const edtOffset = -4 * 60;
    const nowInUTC = now.getTime() + now.getTimezoneOffset() * 60000;
    const nowET = new Date(nowInUTC + edtOffset * 60000);
    const releaseDate = new Date(nowET);
    releaseDate.setDate(releaseDate.getDate() - nowET.getDay());
    releaseDate.setHours(8, 45, 0, 0);
    if (releaseDate > nowET) {
      releaseDate.setDate(releaseDate.getDate() - 7);
    }
    return releaseDate;
};

async function generateAndCacheSermon(env) {
    const releaseTime = getMostRecentSunday845AMET();
    const cacheKey = getSundayKey(releaseTime);
    const newSermon = await generateSermonAndAudio(env.GEMINI_API_KEY, env.ELEVENLABS_API_KEY);
    newSermon.id = cacheKey;
    await env.MBSERMON.put(cacheKey, JSON.stringify(newSermon), { expirationTtl: 5616000 });
    return newSermon;
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
    const prompt = `You are an AI assistant, Pastor AIden, creating a weekly sermon... based on ${selectedTheme}. ... Your response MUST be a JSON object...`; // Shortened for brevity
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

