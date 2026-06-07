// Netlify Function: Stripe Webhook Handler
// Automatically updates user plan when payment succeeds
// Captures next billing date for settings page display

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
        // Verify webhook signature
        const sig = event.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        let stripeEvent;
        
        try {
            stripeEvent = stripe.webhooks.constructEvent(
                event.body,
                sig,
                webhookSecret
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }
        
        // Handle different event types
        switch (stripeEvent.type) {
            
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object;
                const userId = session.client_reference_id;
                
                console.log('Checkout completed for user:', userId);
                
                if (userId && session.subscription) {
                    // Get subscription details to capture next billing date
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    const nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
                    
                    await db.collection('users').doc(userId).set({
                        tier: 'essential',
                        stripeCustomerId: session.customer,
                        subscriptionId: session.subscription,
                        subscriptionStatus: 'active',
                        nextBillingDate: nextBillingDate,
                        upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    
                    console.log('User plan updated to Essential, next billing:', nextBillingDate);
                }
                break;
            }
            
            case 'invoice.payment_succeeded': {
                // When recurring payment succeeds, update next billing date
                const invoice = stripeEvent.data.object;
                
                if (invoice.subscription && invoice.customer) {
                    console.log('Recurring payment succeeded for customer:', invoice.customer);
                    
                    // Get subscription details
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    const nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
                    
                    // Find user by Stripe customer ID
                    const usersRef = db.collection('users');
                    const snapshot = await usersRef.where('stripeCustomerId', '==', invoice.customer).get();
                    
                    if (!snapshot.empty) {
                        const userDoc = snapshot.docs[0];
                        await userDoc.ref.set({
                            nextBillingDate: nextBillingDate,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        
                        console.log('Next billing date updated:', nextBillingDate);
                    }
                }
                break;
            }
            
            case 'customer.subscription.updated': {
                // Handle subscription updates (including cancellation requests)
                const subscription = stripeEvent.data.object;
                const customerId = subscription.customer;
                
                console.log('Subscription updated for customer:', customerId);
                
                const usersRef = db.collection('users');
                const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
                
                if (!snapshot.empty) {
                    const userDoc = snapshot.docs[0];
                    const updateData = {
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (subscription.cancel_at_period_end) {
                        // User has scheduled cancellation
                        updateData.subscriptionStatus = 'cancelling';
                        updateData.cancellationDate = new Date(subscription.current_period_end * 1000).toISOString();
                    } else if (subscription.status === 'active') {
                        // Subscription is active (possibly reactivated)
                        updateData.subscriptionStatus = 'active';
                        updateData.cancellationDate = null;
                        updateData.nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
                    }
                    
                    await userDoc.ref.set(updateData, { merge: true });
                    console.log('User subscription status updated');
                }
                break;
            }
            
            case 'customer.subscription.deleted': {
                // Subscription has actually ended (after cancellation period)
                const subscription = stripeEvent.data.object;
                const customerId = subscription.customer;
                
                console.log('Subscription ended for customer:', customerId);
                
                const usersRef = db.collection('users');
                const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
                
                if (!snapshot.empty) {
                    const userDoc = snapshot.docs[0];
                    await userDoc.ref.set({
                        tier: 'free',
                        subscriptionStatus: 'cancelled',
                        nextBillingDate: null,
                        cancellationDate: null,
                        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    
                    console.log('User downgraded to Free');
                }
                break;
            }
            
            default:
                console.log('Unhandled event type:', stripeEvent.type);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
        
    } catch (error) {
        console.error('Webhook error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
