// Netlify Function: Delete Account
// Permanently deletes user data, cancels any active Revolut
// subscription, removes all reminders, and deletes the Firebase
// Auth record itself (previously only Firestore data was removed —
// the Auth account persisted, meaning someone could still sign in
// after "permanently" deleting their account).

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

const REVOLUT_API_URL = process.env.REVOLUT_ENV === 'production'
    ? 'https://merchant.revolut.com/api'
    : 'https://sandbox-merchant.revolut.com/api';

const REVOLUT_API_VERSION = '2026-04-20';

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
        
        // Step 1: Get user data to check for an active Revolut subscription
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        
        // Step 2: Cancel Revolut subscription immediately (if one exists
        // and hasn't already been cancelled). Best-effort — account
        // deletion continues even if this fails, same as the original
        // Stripe version's resilience approach.
        if (userData && userData.revolutSubscriptionId && userData.subscriptionStatus !== 'cancelled') {
            try {
                const cancelResponse = await fetch(
                    `${REVOLUT_API_URL}/subscriptions/${userData.revolutSubscriptionId}/cancel`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                            'Revolut-Api-Version': REVOLUT_API_VERSION
                        }
                    }
                );
                if (cancelResponse.ok || cancelResponse.status === 204) {
                    console.log('Revolut subscription cancelled:', userData.revolutSubscriptionId);
                } else {
                    console.error('Revolut cancel returned non-OK status:', cancelResponse.status);
                }
            } catch (revolutError) {
                console.error('Error cancelling Revolut subscription:', revolutError);
                // Continue with account deletion even if this fails
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
        
        // Step 6: Delete the Firebase Auth record itself. Without this,
        // the account "deletion" only ever removed app data — the person
        // could still sign in with their original email and password
        // afterward, which doesn't meet a genuine right-to-erasure
        // standard. Best-effort: if this specific step fails (e.g. the
        // Auth user was already removed some other way), don't fail the
        // whole request, since the data deletion above already succeeded.
        try {
            await admin.auth().deleteUser(userId);
            console.log('Firebase Auth record deleted for user:', userId);
        } catch (authError) {
            console.error('Error deleting Firebase Auth record:', authError);
        }
        
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
