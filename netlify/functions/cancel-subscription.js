// Netlify Function: Cancel Subscription
// Cancels a Stripe subscription at the end of the current billing period

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { userId, subscriptionId } = JSON.parse(event.body);
        
        if (!userId || !subscriptionId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing userId or subscriptionId' })
            };
        }
        
        console.log('Cancelling subscription:', subscriptionId, 'for user:', userId);
        
        // Cancel subscription at period end (not immediately)
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
        });
        
        // Calculate the end date
        const cancellationDate = new Date(subscription.current_period_end * 1000).toISOString();
        
        // Update user in Firestore
        await db.collection('users').doc(userId).set({
            subscriptionStatus: 'cancelling',
            cancellationDate: cancellationDate,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('Subscription cancelled successfully. Will end:', cancellationDate);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true,
                cancellationDate: cancellationDate
            })
        };
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
