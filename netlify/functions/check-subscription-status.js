// ============================================================
// CHECK REVOLUT SUBSCRIPTION STATUS
// ============================================================
// Called from dashboard when user returns from Revolut checkout
// Also called by scheduled function every 5 minutes as backup
// Updates user tier when subscription is confirmed active
// ============================================================

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

const REVOLUT_API_URL = process.env.REVOLUT_ENV === 'production'
    ? 'https://merchant.revolut.com/api'
    : 'https://sandbox-merchant.revolut.com/api';

exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { userId } = JSON.parse(event.body);

        if (!userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        console.log('Checking subscription for user:', userId);

        // Get user from Firebase
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        const userData = userDoc.data();

        // If already Curate, no need to check
        if (userData.tier === 'curate' || userData.tier === 'essential') {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    tier: userData.tier,
                    message: 'Already on paid tier' 
                })
            };
        }

        // If this user has explicitly cancelled, never re-check or
        // re-grant tier based on a stale pendingSubscriptionId — that
        // flag may not have been cleared on older cancellations from
        // before this check existed, so self-heal it here too.
        if (userData.subscriptionStatus === 'cancelled') {
            if (userData.pendingSubscriptionId) {
                await db.collection('users').doc(userId).set({
                    pendingSubscriptionId: admin.firestore.FieldValue.delete()
                }, { merge: true });
            }
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    tier: userData.tier || 'discover',
                    message: 'Subscription was explicitly cancelled — not re-checking'
                })
            };
        }

        // Get pending subscription ID
        const pendingSubId = userData.pendingSubscriptionId;
        
        if (!pendingSubId) {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    tier: userData.tier || 'discover',
                    message: 'No pending subscription' 
                })
            };
        }

        console.log('Checking Revolut for subscription:', pendingSubId);

        // Fetch subscription status from Revolut
        const response = await fetch(`${REVOLUT_API_URL}/subscriptions/${pendingSubId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                'Revolut-Api-Version': '2026-04-20'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Revolut API error:', errorText);
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Failed to fetch subscription',
                    details: errorText
                })
            };
        }

        const subscription = await response.json();
        console.log('Subscription state:', subscription.state);

        // If subscription is active or setup complete, upgrade user
        if (subscription.state === 'active' || 
            subscription.state === 'in_progress' ||
            subscription.state === 'trial') {
            
            console.log('Upgrading user to Curate');

            await db.collection('users').doc(userId).set({
                tier: 'curate',
                revolutCustomerId: subscription.customer_id,
                revolutSubscriptionId: pendingSubId,
                upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
                pendingSubscriptionId: admin.firestore.FieldValue.delete()
            }, { merge: true });

            // Send upgrade confirmation email
            try {
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
                console.log('Confirmation email sent');
            } catch (emailErr) {
                console.error('Email send failed:', emailErr);
                // Don't fail the whole request
            }

            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    tier: 'curate',
                    upgraded: true,
                    message: 'Successfully upgraded to Curate'
                })
            };
        }

        // Subscription not yet active - still pending
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                tier: userData.tier || 'discover',
                subscriptionState: subscription.state,
                message: 'Subscription still pending'
            })
        };

    } catch (error) {
        console.error('Check subscription error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
