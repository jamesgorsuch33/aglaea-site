// Netlify Function: Delete Account
// Permanently deletes user data, cancels Stripe subscription, removes all reminders

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
        const { userId } = JSON.parse(event.body);
        
        if (!userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing userId' })
            };
        }
        
        console.log('Deleting account for user:', userId);
        
        // Step 1: Get user data to check for Stripe subscription
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        
        // Step 2: Cancel Stripe subscription immediately (if exists)
        if (userData && userData.subscriptionId) {
            try {
                await stripe.subscriptions.cancel(userData.subscriptionId);
                console.log('Stripe subscription cancelled:', userData.subscriptionId);
            } catch (stripeError) {
                console.error('Error cancelling Stripe subscription:', stripeError);
                // Continue with account deletion even if Stripe fails
            }
        }
        
        // Step 3: Delete all people (and their reminders subcollections)
        const peopleSnapshot = await db.collection('people')
            .where('userId', '==', userId)
            .get();
        
        for (const personDoc of peopleSnapshot.docs) {
            // Delete reminders subcollection
            const remindersSnapshot = await personDoc.ref.collection('reminders').get();
            const batch = db.batch();
            
            remindersSnapshot.docs.forEach(function(reminderDoc) {
                batch.delete(reminderDoc.ref);
            });
            
            await batch.commit();
            
            // Delete the person document
            await personDoc.ref.delete();
        }
        
        console.log('Deleted', peopleSnapshot.size, 'people and their reminders');
        
        // Step 4: Delete gift history if any
        const giftHistorySnapshot = await db.collection('giftHistory')
            .where('userId', '==', userId)
            .get();
        
        if (!giftHistorySnapshot.empty) {
            const giftBatch = db.batch();
            giftHistorySnapshot.docs.forEach(function(doc) {
                giftBatch.delete(doc.ref);
            });
            await giftBatch.commit();
            console.log('Deleted gift history');
        }
        
        // Step 5: Delete the user document
        await db.collection('users').doc(userId).delete();
        
        console.log('Account deleted successfully');
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
        
    } catch (error) {
        console.error('Error deleting account:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
