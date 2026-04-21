// Netlify Function: Create Stripe Checkout Session
// This runs server-side, so your secret key is safe

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { priceId, customerId, userEmail } = JSON.parse(event.body);

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${event.headers.origin || 'https://myaglaea.netlify.app'}/dashboard.html?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${event.headers.origin || 'https://myaglaea.netlify.app'}/upgrade.html`,
      customer_email: userEmail,
      client_reference_id: customerId,
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url
      })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
