// ============================================================
// REVOLUT MERCHANT WEBHOOK HANDLER
// ============================================================
// Handles subscription lifecycle events from Revolut
// Updates user tier in Firestore
// Sends confirmation emails via Resend
// ============================================================

const crypto = require('crypto');
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
}

const db = admin.firestore();
const SITE_URL = process.env.SITE_URL || 'https://aglaea.co.uk';

exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Verify webhook signature (production security)
        // Revolut's actual scheme: payload_to_sign = "v1." + timestamp + "." + raw_body,
        // signed with HMAC-SHA256, compared against the "v1=..." value(s) in
        // Revolut-Signature (comma-separated if multiple secrets are active
        // during rotation). See:
        // https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature
        const signature = event.headers['revolut-signature'] || event.headers['Revolut-Signature'];
        const timestamp = event.headers['revolut-request-timestamp'] || event.headers['Revolut-Request-Timestamp'];
        const webhookSecret = process.env.REVOLUT_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('REVOLUT_WEBHOOK_SECRET not configured — rejecting webhook');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Webhook not configured' })
            };
        }

        if (!signature || !timestamp) {
            console.warn('Missing signature or timestamp headers');
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Missing signature headers' })
            };
        }

        // Reject requests older than 5 minutes (replay protection), per
        // Revolut's documented tolerance window.
        const ageMs = Math.abs(Date.now() - Number(timestamp));
        if (Number.isNaN(ageMs) || ageMs > 5 * 60 * 1000) {
            console.warn('Webhook timestamp out of tolerance');
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Timestamp out of tolerance' })
            };
        }

        const payloadToSign = `v1.${timestamp}.${event.body}`;
        const expectedSignature = 'v1=' + crypto
            .createHmac('sha256', webhookSecret)
            .update(payloadToSign)
            .digest('hex');

        // Revolut-Signature may contain multiple comma-separated v1=... values
        // during secret rotation — valid if any of them match.
        const providedSignatures = signature.split(',').map(s => s.trim());
        if (!providedSignatures.includes(expectedSignature)) {
            console.warn('Invalid webhook signature');
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }

        // Parse webhook payload
        const webhookEvent = JSON.parse(event.body);
        console.log('Revolut webhook received:', webhookEvent.event);

        // Handle different event types
        switch (webhookEvent.event) {
            
            case 'SUBSCRIPTION_INITIATED':
            case 'ORDER_COMPLETED':
                await handleSubscriptionActivated(webhookEvent);
                break;

            case 'SUBSCRIPTION_FINISHED':
            case 'SUBSCRIPTION_CANCELLED':
                await handleSubscriptionCancelled(webhookEvent);
                break;

            case 'SUBSCRIPTION_OVERDUE':
            case 'ORDER_PAYMENT_DECLINED':
            case 'ORDER_PAYMENT_FAILED':
                await handlePaymentFailed(webhookEvent);
                break;

            default:
                console.log('Unhandled event type:', webhookEvent.event);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('Webhook processing error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Webhook processing failed',
                message: error.message
            })
        };
    }
};

// ============================================================
// Handle subscription activation (user upgraded to Curate)
// ============================================================
async function handleSubscriptionActivated(webhookEvent) {
    // Revolut sends subscription_id at top level for subscription events
    const subscriptionId = webhookEvent.subscription_id || webhookEvent.data?.id;
    const orderId = webhookEvent.order_id;
    
    console.log('Processing activation - subscription_id:', subscriptionId, 'order_id:', orderId);

    // Fetch full subscription details from Revolut API
    let subscription = webhookEvent.data;
    
    if (subscriptionId && !subscription) {
        try {
            const apiUrl = process.env.REVOLUT_ENV === 'production'
                ? 'https://merchant.revolut.com/api'
                : 'https://sandbox-merchant.revolut.com/api';
                
            const response = await fetch(`${apiUrl}/subscriptions/${subscriptionId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                    'Revolut-Api-Version': '2026-04-20'
                }
            });
            
            if (response.ok) {
                subscription = await response.json();
                console.log('Fetched subscription details');
            }
        } catch (err) {
            console.error('Failed to fetch subscription:', err);
        }
    }
    
    const userId = subscription?.external_reference || subscription?.metadata?.userId;
    const customerId = subscription?.customer_id;

    if (!userId) {
        console.error('No userId in webhook or subscription data');
        return;
    }

    // Guard against delayed/retried webhook deliveries. Revolut can
    // redeliver an event well after it was first sent (observed: ~30
    // minutes) — if the user already explicitly cancelled *this same*
    // subscription in the meantime, a late-arriving activation event
    // must not silently re-grant Curate. Only blocks re-activation for
    // the specific subscription that was cancelled — a genuinely new
    // resubscription (different subscription_id) still goes through.
    const existingUserDoc = await db.collection('users').doc(userId).get();
    if (existingUserDoc.exists) {
        const existingData = existingUserDoc.data();
        const thisSubscriptionId = subscriptionId || subscription?.id;
        const wasCancelled = existingData.subscriptionStatus === 'cancelled';
        const sameSubscription = existingData.revolutSubscriptionId === thisSubscriptionId;

        if (wasCancelled && sameSubscription) {
            console.log(`Ignoring stale activation event for already-cancelled subscription ${thisSubscriptionId} (user ${userId})`);
            return;
        }
    }

    console.log('Activating Curate subscription for user:', userId);

    // Update Firestore - upgrade user to Curate
    await db.collection('users').doc(userId).set({
        tier: 'curate',
        revolutCustomerId: customerId,
        revolutSubscriptionId: subscriptionId || subscription?.id,
        subscriptionStatus: 'active',
        upgradedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('User tier updated to Curate');

    // Send upgrade confirmation email
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            await fetch(`${SITE_URL}/.netlify/functions/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailType: 'upgradeConfirmation',
                    to: userData.email,
                    data: {
                        firstName: userData.firstName || 'there'
                    }
                })
            });
            
            console.log('Upgrade confirmation email sent');
        }
    } catch (emailError) {
        console.error('Failed to send upgrade email:', emailError);
        // Don't fail webhook - upgrade already succeeded
    }
}

// ============================================================
// Handle subscription cancellation
// ============================================================
async function handleSubscriptionCancelled(webhookEvent) {
    const subscriptionId = webhookEvent.subscription_id || webhookEvent.data?.id;
    
    console.log('Handling subscription cancellation - subscription_id:', subscriptionId);

    // Fetch full subscription details from Revolut API if the webhook
    // only included a bare subscription_id (same pattern as
    // handleSubscriptionActivated — the cancellation event doesn't
    // embed external_reference/customer_id directly).
    let subscription = webhookEvent.data;
    
    if (subscriptionId && !subscription) {
        try {
            const apiUrl = process.env.REVOLUT_ENV === 'production'
                ? 'https://merchant.revolut.com/api'
                : 'https://sandbox-merchant.revolut.com/api';
                
            const response = await fetch(`${apiUrl}/subscriptions/${subscriptionId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                    'Revolut-Api-Version': '2026-04-20'
                }
            });
            
            if (response.ok) {
                subscription = await response.json();
                console.log('Fetched subscription details for cancellation');
            } else {
                console.error('Failed to fetch subscription details:', response.status);
            }
        } catch (err) {
            console.error('Failed to fetch subscription:', err);
        }
    }
    
    if (!subscription) {
        console.error('Could not resolve subscription details for cancellation, subscription_id:', subscriptionId);
        return;
    }
    
    const userId = subscription.external_reference || subscription.metadata?.userId;
    const customerId = subscription.customer_id;

    // Find user by external reference or customer ID
    let userDoc;
    if (userId) {
        userDoc = await db.collection('users').doc(userId).get();
    } else if (customerId) {
        const snapshot = await db.collection('users')
            .where('revolutCustomerId', '==', customerId)
            .get();
        
        if (!snapshot.empty) {
            userDoc = snapshot.docs[0];
        }
    }

    if (!userDoc || !userDoc.exists) {
        console.error('User not found for cancellation. userId:', userId, 'customerId:', customerId);
        return;
    }

    // Downgrade to Discover — this is a safety-net path only; the
    // primary downgrade happens synchronously in cancel-subscription.js
    // at the moment the member clicks Cancel. This just catches
    // cancellations that originate outside that flow (e.g. from
    // Revolut's dashboard directly, or a failed-payment auto-cancel).
    await userDoc.ref.set({
        tier: 'discover',
        subscriptionStatus: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('User downgraded to Discover (via webhook)');
}

// ============================================================
// Handle failed payment
// ============================================================
async function handlePaymentFailed(webhookEvent) {
    const order = webhookEvent.data || webhookEvent;
    const customerId = order.customer_id;

    console.log('Payment failed for customer:', customerId);

    // Optional: Send email to user about failed payment
    // Optional: Log to admin dashboard
    // Revolut handles retry logic automatically
}
