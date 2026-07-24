// ============================================================
// SEND SMS — Netlify Function
// Sends reminder SMS messages via Twilio's REST API directly
// (no SDK dependency, mirrors the fetch-based approach used in
// send-email.js for Resend).
//
// Curate-tier only, sent at 14/7/3 days before an occasion.
// Called from scheduled-reminders.js.
// ============================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SITE_URL = process.env.SITE_URL || 'https://aglaea.co.uk';

// ============================================================
// SMS COPY — plain ASCII only (GSM-7 encoding). Do not add
// em dashes, curly quotes, or emoji — a single non-GSM-7
// character forces the whole message into UCS-2 encoding,
// cutting the real limit from 160 characters to 70.
// ============================================================
const SMS_TEMPLATES = {
    14: (name, occasion) => `AGLAEA - ${name}'s ${occasion} is in 14 days. Find something special: ${SITE_URL.replace('https://', '')}/gifts`,
    7:  (name, occasion) => `AGLAEA - ${name}'s ${occasion} is just 7 days away. Browse gift ideas: ${SITE_URL.replace('https://', '')}/gifts`,
    3:  (name, occasion) => `AGLAEA - Just 3 days left for ${name}'s ${occasion}! Last-minute ideas: ${SITE_URL.replace('https://', '')}/gifts`,
    0:  (name, occasion) => `AGLAEA - It's ${name}'s ${occasion} today! A quick call or message means more than you'd think.`
};

const MAX_SMS_LENGTH = 160;

// Build the final message, truncating the occasion (never the
// name) with an ellipsis if a long custom occasion would push
// the message over the GSM-7 single-segment limit.
function buildMessage(days, name, occasion) {
    const templateFn = SMS_TEMPLATES[days];
    if (!templateFn) return null;

    let message = templateFn(name, occasion);

    if (message.length > MAX_SMS_LENGTH) {
        const overBy = message.length - MAX_SMS_LENGTH + 1; // +1 for the ellipsis char
        const truncatedOccasion = occasion.length > overBy
            ? occasion.slice(0, occasion.length - overBy) + '\u2026'
            : occasion;
        message = templateFn(name, truncatedOccasion);

        // Extremely defensive fallback — should be unreachable given
        // the character budget already has 60+ chars of headroom, but
        // never send a message we haven't confirmed fits.
        if (message.length > MAX_SMS_LENGTH) {
            message = message.slice(0, MAX_SMS_LENGTH - 1) + '\u2026';
        }
    }

    return message;
}

// ============================================================
// PHONE NUMBER NORMALIZATION
// Twilio requires E.164 format (+44...). Numbers may be stored
// as entered (07..., +447..., with spaces) rather than guaranteed
// clean — this normalizes common UK formats defensively.
// NOTE: confirm against your actual stored format; adjust if
// numbers are saved differently than assumed here.
// ============================================================
function normalizeUkPhone(raw) {
    if (!raw) return null;
    const cleaned = raw.replace(/[\s\-()]/g, '');

    if (cleaned.startsWith('+44')) return cleaned;
    if (cleaned.startsWith('44')) return '+' + cleaned;
    if (cleaned.startsWith('0')) return '+44' + cleaned.slice(1);

    console.warn(`Unrecognised phone format, sending as-is: ${raw}`);
    return cleaned;
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.error('Twilio environment variables not configured');
        return { statusCode: 500, body: JSON.stringify({ error: 'SMS not configured' }) };
    }

    try {
        const { to, days, recipientName, occasion } = JSON.parse(event.body);

        if (!to || !days || !recipientName || !occasion) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'to, days, recipientName, and occasion are required' })
            };
        }

        const message = buildMessage(Number(days), recipientName, occasion);
        if (!message) {
            return { statusCode: 400, body: JSON.stringify({ error: `No SMS template for ${days} days` }) };
        }

        const phone = normalizeUkPhone(to);
        if (!phone) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid or missing phone number' }) };
        }

        const params = new URLSearchParams({
            To: phone,
            From: TWILIO_PHONE_NUMBER,
            Body: message
        });

        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error('Twilio send failed:', result);
            return { statusCode: 502, body: JSON.stringify({ success: false, error: result }) };
        }

        console.log(`SMS sent to ${phone}: ${result.sid} (${message.length} chars)`);
        return { statusCode: 200, body: JSON.stringify({ success: true, sid: result.sid }) };

    } catch (error) {
        console.error('send-sms error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
