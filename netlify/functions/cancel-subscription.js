// ============================================================
// CANCEL SUBSCRIPTION — Netlify Function
// Cancels a Revolut subscription immediately (Revolut has no
// "cancel at period end" — cancellation is instant and final).
// Records the real end-of-access date (the current billing
// cycle's actual end_date) for display purposes, and flips the
// user's tier to Discover right away.
//
// If keepReminderIds is provided, every other active date-based
// reminder for this user is paused (not deleted) to bring them
// under the 5-reminder Discover cap. This is expected to be sent
// by a "pick which 5 to keep" step on the frontend — until that
// picker exists, omitting it just cancels/downgrades without
// pausing anything.
// ============================================================

const admin = require('firebase-admin');

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
        const { userId, subscriptionId, keepReminderIds } = JSON.parse(event.body);

        if (!userId || !subscriptionId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing userId or subscriptionId' })
            };
        }

        console.log('Cancelling subscription:', subscriptionId, 'for user:', userId);

        // Step 1: Retrieve the subscription to find its current cycle,
        // so we can record the real date access was paid through to
        // (rather than a naive "+30 days" guess, which would be wrong
        // for annual billing).
        let accessEndDate = null;
        try {
            const subResponse = await fetch(`${REVOLUT_API_URL}/subscriptions/${subscriptionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                    'Revolut-Api-Version': REVOLUT_API_VERSION,
                    'Accept': 'application/json'
                }
            });

            if (subResponse.ok) {
                const subscription = await subResponse.json();
                if (subscription.current_cycle_id) {
                    const cycleResponse = await fetch(
                        `${REVOLUT_API_URL}/subscriptions/${subscriptionId}/cycles/${subscription.current_cycle_id}`,
                        {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                                'Revolut-Api-Version': REVOLUT_API_VERSION,
                                'Accept': 'application/json'
                            }
                        }
                    );
                    if (cycleResponse.ok) {
                        const cycle = await cycleResponse.json();
                        accessEndDate = cycle.end_date || null;
                    }
                }
            }
        } catch (lookupError) {
            // Non-fatal — proceed with cancellation even if we couldn't
            // fetch the cycle end date; it's only used for display.
            console.error('Could not retrieve cycle end date:', lookupError);
        }

        // Step 2: Cancel the subscription. This is immediate and final —
        // Revolut has no deferred/at-period-end cancellation, and a
        // cancelled subscription cannot be un-cancelled via the API.
        const cancelResponse = await fetch(
            `${REVOLUT_API_URL}/subscriptions/${subscriptionId}/cancel`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                    'Revolut-Api-Version': REVOLUT_API_VERSION
                }
            }
        );

        if (!cancelResponse.ok && cancelResponse.status !== 204) {
            const errorText = await cancelResponse.text();
            throw new Error(`Revolut cancel failed: ${errorText}`);
        }

        console.log('Subscription cancelled on Revolut. Access was valid until:', accessEndDate);

        // Step 3: Downgrade the user immediately in Firestore.
        // Also clears pendingSubscriptionId — without this, both the
        // dashboard's post-checkout check and a scheduled 5-minute
        // backup job keep re-checking this same (now-cancelled)
        // subscription indefinitely, risking an incorrect re-upgrade.
        await db.collection('users').doc(userId).set({
            tier: 'discover',
            subscriptionStatus: 'cancelled',
            cancellationDate: accessEndDate,
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            pendingSubscriptionId: admin.firestore.FieldValue.delete()
        }, { merge: true });

        // Step 4: If a set of reminders to keep was provided, pause
        // every other active date-based reminder for this user so
        // they're brought under the 5-reminder Discover cap.
        let pausedCount = 0;
        if (Array.isArray(keepReminderIds)) {
            const peopleSnapshot = await db.collection('people')
                .where('userId', '==', userId)
                .get();

            for (const personDoc of peopleSnapshot.docs) {
                const remindersSnapshot = await db.collection('people')
                    .doc(personDoc.id)
                    .collection('reminders')
                    .get();

                for (const reminderDoc of remindersSnapshot.docs) {
                    const reminderData = reminderDoc.data();
                    const currentlyPaused = reminderData.paused === true;

                    if (reminderData.reminderType === 'just-because') {
                        // Just Because is Curate-only — pause every
                        // instance unconditionally, not tied to the
                        // 5-reminder date-based cap or picker selection.
                        if (!currentlyPaused) {
                            await reminderDoc.ref.update({ paused: true });
                            pausedCount++;
                        }
                        continue;
                    }

                    if (reminderData.reminderType === 'date-based') {
                        const shouldKeep = keepReminderIds.includes(reminderDoc.id);

                        if (!shouldKeep && !currentlyPaused) {
                            await reminderDoc.ref.update({ paused: true });
                            pausedCount++;
                        } else if (shouldKeep && currentlyPaused) {
                            // Defensive: un-pause anything explicitly kept,
                            // in case it was paused by a previous downgrade.
                            await reminderDoc.ref.update({ paused: false });
                        }
                    }
                }
            }
        }

        console.log('Downgrade complete. Reminders paused:', pausedCount);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                cancellationDate: accessEndDate,
                remindersPaused: pausedCount
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
