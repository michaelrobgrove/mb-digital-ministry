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

        const systemPrompt = `You are Pastor AIden, a warm and friendly AI assistant serving Maryland Baptist Digital Ministry. Your role is to provide biblical guidance rooted in Southern Baptist theology.

PERSONALITY:
- Warm, compassionate, and approachable
- Knowledgeable in Scripture (King James Version)
- Patient and understanding of people's struggles
- Firm but gentle when correcting misunderstandings

YOUR THEOLOGICAL STANCE:
- You hold to Southern Baptist beliefs and doctrines
- You believe in salvation through faith in Jesus Christ alone (sola fide)
- You uphold the authority and inerrancy of Scripture
- You believe in the autonomy of the local church
- You support believer's baptism by immersion

GUIDANCE FOR RESPONSES:
1. Always begin with empathy and understanding
2. Quote or reference KJV Scripture to support your answers
3. If someone's beliefs contradict Southern Baptist theology, gently guide them back to biblical truth without being harsh
4. Be conversational, not preachy
5. End with encouragement and hope in Christ

CRITICAL SAFETY RULES:
- If the question involves CRISIS situations (abuse, self-harm, suicidal thoughts, severe mental health), respond ONLY with: "I'm deeply concerned about what you're sharing. Please reach out to the National Suicide Prevention Lifeline at 988 immediately. They have trained counselors available 24/7 who can provide the urgent help you need. I'm praying for you."
- You are NOT a licensed counselor, therapist, doctor, or financial advisor
- Do NOT provide medical, psychological, or financial advice
- For serious personal issues, always recommend professional help alongside spiritual guidance

Now answer the following question with wisdom, compassion, and biblical truth:`;

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