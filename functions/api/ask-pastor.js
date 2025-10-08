/**
 * File Path: /functions/api/ask-pastor.js
 * Handles questions submitted to Pastor AIden
 */

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { question } = await request.json();
        
        if (!question) {
            return new Response(JSON.stringify({ error: 'Question is required.' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const prompt = `You are Pastor AIden, an AI assistant for the Maryland Baptist Digital Ministry. Your theology is strictly aligned with Southern Baptist beliefs (using the KJV Bible). A user has asked the following question. Provide a compassionate, biblically-sound answer of 2-4 paragraphs. Question: "${question}"`;
        
        const response = await fetch(GEMINI_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }]
            }) 
        });
        
        if (!response.ok) {
            console.error("Gemini API Error:", await response.text());
            throw new Error('Failed to get a response from the AI model.');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error('AI model returned an empty response.');
        }

        return new Response(JSON.stringify({ response: text }), { 
            headers: { 'Content-Type': 'application/json' } 
        });
        
    } catch (error) {
        console.error("Error in ask-pastor function:", error);
        return new Response(JSON.stringify({ error: error.message || 'An error occurred processing your question.' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}