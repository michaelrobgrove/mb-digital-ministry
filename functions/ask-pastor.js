export async function onRequest(context) {
    // Only allow POST requests
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { question } = await context.request.json();

        if (!question || question.trim() === '') {
            return new Response(JSON.stringify({ error: 'Question is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const systemPrompt = `You are an AI assistant acting as a digital pastor. A user has asked a question. Answer them compassionately from a Southern Baptist theological perspective, using KJV scripture to support your answer. You are not a counselor. Do not give medical, financial, or psychological advice. If the user's question involves a crisis (abuse, self-harm), your ONLY response must be to provide the National Suicide Prevention Lifeline (988) and advise them to seek immediate professional help.`;

        const apiKey = context.env.GEMINI_API_KEY;
        
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\nUser question: ${question}`
                    }]
                }]
            })
        });

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;

        return new Response(JSON.stringify({ response: aiResponse }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'An error occurred processing your question' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}