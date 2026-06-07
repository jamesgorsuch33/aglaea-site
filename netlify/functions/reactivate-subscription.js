// Netlify Function: Reactivate Subscription
// Reactivates a subscription that was set to cancel at period end

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
        
        console.log('Reactivating subscription:', subscriptionId, 'for user:', userId);
        
        // Remove the cancellation
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false
        });
        
        // Update user in Firestore
        await db.collection('users').doc(userId).set({
            subscriptionStatus: 'active',
            cancellationDate: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('Subscription reactivated successfully');
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
        
    } catch (error) {
        console.error('Error reactivating subscription:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
