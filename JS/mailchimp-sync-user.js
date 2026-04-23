// Netlify Function: Sync new users to Mailchimp
// Called via webhook when user signs up

const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { email, firstName, lastName, userId } = data;

    if (!email || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Mailchimp configuration
    const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
    const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;
    const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;

    if (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX || !MAILCHIMP_AUDIENCE_ID) {
      console.error('Missing Mailchimp environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Create subscriber hash (MD5 of lowercase email)
    const subscriberHash = crypto
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex');

    // Add/update subscriber in Mailchimp
    const mailchimpUrl = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}`;
    
    const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');

    const response = await fetch(mailchimpUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status_if_new: 'subscribed',
        merge_fields: {
          FNAME: firstName || '',
          LNAME: lastName || '',
          USERID: userId,
          PLAN: 'free',
          SIGNUPDATE: new Date().toISOString().split('T')[0],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Mailchimp API Error:', error);
      throw new Error(`Mailchimp error: ${response.status}`);
    }

    // Add 'new_signup' tag to trigger welcome email
    const tagResponse = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}/tags`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tags: [{ name: 'new_signup', status: 'active' }]
        }),
      }
    );

    console.log('User synced to Mailchimp:', email);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'User synced to Mailchimp' })
    };

  } catch (error) {
    console.error('Error syncing to Mailchimp:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
