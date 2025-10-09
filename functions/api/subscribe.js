export async function onRequestPost({ request, env }) {
  try {
    const { email, weekly, daily, consent, ministry_solution } = await request.json();

    // Honeypot field for spam prevention
    if (ministry_solution) {
      // This is likely a bot, return a success response but do nothing
      return new Response(JSON.stringify({ success: true, message: "Thank you for subscribing!" }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate input
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, message: "Please enter a valid email address." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!consent) {
        return new Response(JSON.stringify({ success: false, message: "You must agree to be contacted." }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const SENDER_API_KEY = env.SENDER_API_KEY;
    if (!SENDER_API_KEY) {
        console.error("SENDER_API_KEY is not defined in environment variables.");
        return new Response(JSON.stringify({ success: false, message: "Server configuration error." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // IMPORTANT: Replace these with your actual Group IDs from your Sender account dashboard.
    const weeklyGroupId = 'avJD68'; // e.g., '62657271'
    const dailyGroupId = 'YdwgZ6r';   // e.g., '62657272'

    const groups = [];
    if (weekly) {
        groups.push(weeklyGroupId);
    }
    if (daily) {
        groups.push(dailyGroupId);
    }
    
    if (groups.length === 0) {
        return new Response(JSON.stringify({ success: false, message: "Please select at least one newsletter." }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }


    const response = await fetch('https://api.sender.net/v2/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        groups: groups,
        trigger_automation: true,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Sender API Error:', errorData);
        // Avoid exposing detailed API errors to the client
        return new Response(JSON.stringify({ success: false, message: "Could not subscribe. Please try again later." }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }
  
    return new Response(JSON.stringify({ success: true, message: "Thank you for subscribing!" }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Subscription error:', error);
    return new Response(JSON.stringify({ success: false, message: 'An unexpected error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
