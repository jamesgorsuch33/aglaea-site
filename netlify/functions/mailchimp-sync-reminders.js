// Netlify Function: Update Mailchimp with user's reminders
// Called when user adds/updates/deletes reminders

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
    const { email, reminders } = data;

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing email' })
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

    // Create subscriber hash
    const subscriberHash = crypto
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex');

    // Format date helper
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Build merge fields for up to 5 reminders
    const mergeFields = {};
    
    for (let i = 0; i < 5; i++) {
      const num = i + 1;
      const reminder = reminders[i];
      
      if (reminder) {
        mergeFields[`REM${num}NAME`] = reminder.name || '';
        mergeFields[`REM${num}DATE`] = formatDate(reminder.date) || '';
        mergeFields[`REM${num}OCC`] = reminder.occasion || '';
      } else {
        // Clear fields if reminder doesn't exist
        mergeFields[`REM${num}NAME`] = '';
        mergeFields[`REM${num}DATE`] = '';
        mergeFields[`REM${num}OCC`] = '';
      }
    }

    // Update subscriber in Mailchimp
    const mailchimpUrl = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}`;
    
    const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64');

    const response = await fetch(mailchimpUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merge_fields: mergeFields,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Mailchimp API Error:', error);
      throw new Error(`Mailchimp error: ${response.status}`);
    }

    console.log('Reminders synced to Mailchimp:', email);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Reminders synced to Mailchimp' })
    };

  } catch (error) {
    console.error('Error syncing reminders to Mailchimp:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
