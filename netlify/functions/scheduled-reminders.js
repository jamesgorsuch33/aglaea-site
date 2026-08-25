// ============================================================
// AGLAEA - SCHEDULED REMINDER FUNCTION
// Runs daily at 8am UTC via Netlify scheduled function
// 
// Logic:
// 1. Query all date-based reminders across all people
// 2. For each, check if today matches a cadence (21/14/10/7/3 days or day-of)
// 3. Skip purchased reminders (except day-of)
// 4. Skip if cadence already sent
// 5. Send appropriate branded email via Resend
// 6. Log what was sent (audit trail)
// 
// Also handles Just Because reminders (Essential tier)
// ============================================================

const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

const db = admin.firestore();
const SITE_URL = process.env.SITE_URL || 'https://aglaea.co.uk';

// ============================================================
// ADMIN DASHBOARD — DAILY SNAPSHOT
// Runs once per day (piggybacking on this function's existing
// 7am UK gate, rather than a separate scheduled job) and writes a
// single dated record to adminStats. Point-in-time counts (users,
// reminders) are queried fresh each day; send-activity figures
// (emails, SMS, etc.) reuse today's `stats` object rather than
// recomputing anything, since this runs at the very end of the
// same function that already produced them.
//
// Uses collectionGroup('reminders') to count reminders across every
// person in one query — this works from server-side Admin SDK
// without needing any Firestore rule for it, since the Admin SDK
// bypasses security rules entirely (same as everything else in this
// file). This is intentionally NOT how the admin page itself reads
// data — the page only ever reads pre-aggregated adminStats.
// ============================================================

const CURATE_MONTHLY_PRICE = 4.99;
const CURATE_ANNUAL_PRICE = 49.99;
// Cost per SMS in GBP — set via the SMS_COST_PER_MESSAGE_GBP Netlify
// environment variable, so it can be corrected without a code change
// or redeploy. The fallback below is Twilio's listed USD rate for UK
// mobile-number outbound SMS ($0.056), converted at a rough
// approximate exchange rate — treat it as a placeholder only. Twilio
// bills in USD by default regardless of destination, so the real GBP
// figure depends on your account's actual billing currency and
// Twilio's own exchange rate at charge time — check a real invoice
// and set SMS_COST_PER_MESSAGE_GBP in Netlify to the true figure.
const SMS_COST_PER_MESSAGE_GBP = parseFloat(process.env.SMS_COST_PER_MESSAGE_GBP) || 0.045;

async function takeAdminSnapshot(todayStats, dateStr) {
    try {
        const usersSnapshot = await db.collection('users').get();
        let totalUsers = 0;
        let discoverUsers = 0;
        let curateUsers = 0;
        let curateMonthlyCount = 0;
        let curateAnnualCount = 0;

        usersSnapshot.forEach(function(doc) {
            totalUsers++;
            const userData = doc.data();
            const tier = userData.tier;
            if (tier === 'curate' || tier === 'essential') {
                curateUsers++;
                // billingInterval was only added when annual billing was
                // introduced — existing Curate users from before that
                // don't have this field set, so they default to monthly
                // (the only plan that existed at the time they upgraded).
                if (userData.billingInterval === 'annual') {
                    curateAnnualCount++;
                } else {
                    curateMonthlyCount++;
                }
            } else {
                discoverUsers++;
            }
        });

        const remindersSnapshot = await db.collectionGroup('reminders').get();
        let totalReminders = 0;
        let dateBasedReminders = 0;
        let justBecauseReminders = 0;
        let pausedReminders = 0;

        remindersSnapshot.forEach(function(doc) {
            totalReminders++;
            const reminder = doc.data();
            if (reminder.reminderType === 'just-because') {
                justBecauseReminders++;
            } else {
                dateBasedReminders++;
            }
            if (reminder.paused === true) {
                pausedReminders++;
            }
        });

        await db.collection('adminStats').doc(dateStr).set({
            date: dateStr,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),

            totalUsers: totalUsers,
            discoverUsers: discoverUsers,
            curateUsers: curateUsers,
            curateMonthlyCount: curateMonthlyCount,
            curateAnnualCount: curateAnnualCount,
            // Annual subscribers contribute their price divided across 12
            // months, not the full monthly rate — this is now an accurate
            // MRR figure based on real billing intervals, not a flat
            // curateUsers × monthly-price estimate.
            estimatedMonthlyRevenue: Math.round((
                (curateMonthlyCount * CURATE_MONTHLY_PRICE) +
                (curateAnnualCount * CURATE_ANNUAL_PRICE / 12)
            ) * 100) / 100,

            totalReminders: totalReminders,
            dateBasedReminders: dateBasedReminders,
            justBecauseReminders: justBecauseReminders,
            pausedReminders: pausedReminders,

            emailsSentToday: todayStats.sent,
            emailsFailedToday: todayStats.failed,
            smsSentToday: todayStats.smsSent,
            smsFailedToday: todayStats.smsFailed,
            smsCostTodayGbp: Math.round(todayStats.smsSent * SMS_COST_PER_MESSAGE_GBP * 100) / 100,
            justBecauseSentToday: todayStats.justBecauseSent,
            upgradeNudgesSentToday: todayStats.nudgesSent
        }, { merge: true });

        console.log(`Admin snapshot recorded for ${dateStr}: ${totalUsers} users, ${totalReminders} reminders`);
    } catch (snapshotError) {
        // Never let a snapshot failure affect the actual reminder-sending
        // result above — this is a secondary, best-effort record.
        console.error('Admin snapshot failed (reminders were still sent normally):', snapshotError);
    }
}

// Reminder cadences (days before occasion) → email type
// Different cadences AND different templates for different tiers
const CADENCES_CURATE = {
    21: 'reminder21Days',
    14: 'reminder14Days',
    10: 'reminder10Days',
    7: 'reminder7DaysCurate',
    3: 'reminder3DaysCurate',
    0: 'reminderDayOf'  // Day-of
};

const CADENCES_DISCOVER = {
    7: 'reminder7DaysDiscover',
    3: 'reminder3DaysDiscover'
};

// Helper: Determine cadences based on user tier
// Handles both old tier names (free/essential) and new ones (discover/curate)
function getCadencesForTier(tier) {
    if (tier === 'curate' || tier === 'essential') {
        return CADENCES_CURATE;
    }
    // Default to Discover cadence for 'discover', 'free', or unknown
    return CADENCES_DISCOVER;
}

// ============================================================
// HELPER: Calculate days between two dates (ignoring time)
// ============================================================
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(date2);
    d2.setHours(0, 0, 0, 0);
    const diffTime = d2 - d1;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================================
// HELPER: Format date for emails (e.g., "20 June")
// ============================================================
function formatOccasionDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long'
    });
}

// ============================================================
// HELPER: Get occasion label
// ============================================================
function getOccasionLabel(reminder) {
    if (reminder.occasion === 'custom' && reminder.customOccasionName) {
        return reminder.customOccasionName;
    }
    
    const labels = {
        'birthday': 'birthday',
        'anniversary': 'anniversary',
        'mothers-day': "Mother's Day",
        'fathers-day': "Father's Day",
        'christmas': 'Christmas',
        'valentines': "Valentine's Day"
    };
    
    return labels[reminder.occasion] || reminder.occasion;
}

// ============================================================
// HELPER: Send email via send-email function
// ============================================================
async function sendEmail(emailType, to, data) {
    try {
        const response = await fetch(`${SITE_URL}/.netlify/functions/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emailType: emailType,
                to: to,
                data: data
            })
        });
        
        const result = await response.json();
        return result.success === true;
        
    } catch (error) {
        console.error(`Send email failed (${emailType} to ${to}):`, error);
        return false;
    }
}

// ============================================================
// HELPER: Send SMS via send-sms function
// Curate tier only, sent at 14/7/3 days before an occasion.
// ============================================================
async function sendSms(to, days, recipientName, occasion) {
    try {
        const response = await fetch(`${SITE_URL}/.netlify/functions/send-sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, days, recipientName, occasion })
        });
        
        const result = await response.json();
        return result.success === true;
        
    } catch (error) {
        console.error(`Send SMS failed (${days} days to ${to}):`, error);
        return false;
    }
}

// ============================================================
// PROCESS DATE-BASED REMINDERS
// ============================================================
async function processDateBasedReminders(today, stats) {
    console.log('Processing date-based reminders...');
    
    // Get all people across all users
    const peopleSnapshot = await db.collection('people').get();
    
    for (const personDoc of peopleSnapshot.docs) {
        const person = { id: personDoc.id, ...personDoc.data() };
        
        // Get the user who owns this person
        if (!person.userId) {
            console.warn(`Person ${person.id} has no userId, skipping`);
            continue;
        }
        
        let userData;
        try {
            const userDoc = await db.collection('users').doc(person.userId).get();
            if (!userDoc.exists) {
                console.warn(`User ${person.userId} not found, skipping`);
                continue;
            }
            userData = userDoc.data();
        } catch (e) {
            console.warn(`Could not fetch user ${person.userId}:`, e.message);
            continue;
        }
        
        const userEmail = userData.email;
        const firstName = userData.firstName || 'there';
        const userTier = userData.tier || 'discover';
        
        if (!userEmail) {
            console.warn(`User ${person.userId} has no email, skipping`);
            continue;
        }
        
        // Get cadences based on user tier
        const userCadences = getCadencesForTier(userTier);
        
        // Get all reminders for this person
        const remindersSnapshot = await db.collection('people')
            .doc(person.id)
            .collection('reminders')
            .get();
        
        for (const reminderDoc of remindersSnapshot.docs) {
            const reminder = { id: reminderDoc.id, ...reminderDoc.data() };
            
            // Only process date-based reminders here
            if (reminder.reminderType !== 'date-based') continue;
            
            // Skip entirely if paused (e.g. over the Discover cap after a
            // downgrade) — this previously only affected what showed on
            // the dashboard, not what actually got sent. Applies to every
            // cadence including day-of, unlike the purchased-suppression
            // below which deliberately still sends day-of.
            if (reminder.paused) continue;
            
            // Skip if no date
            if (!reminder.date) continue;
            
            // Calculate days until occasion
            const days = daysBetween(today, reminder.date);
            
            // Only process valid cadence days for this user's tier
            if (!(days in userCadences)) continue;
            
            // Skip if purchased AND it's not day-of.
            // Email day-of always sends (occasion-day well-wish, not a
            // shopping nudge). SMS day-of (added separately below) also
            // deliberately ignores purchased status — it's a "reach out"
            // nudge, independent of whether a gift was bought.
            if (reminder.giftPurchased && days !== 0) {
                console.log(`Skipping purchased reminder ${reminder.id} (${days} days)`);
                continue;
            }
            
            // Check if this cadence has already been sent
            const remindersSent = reminder.remindersSent || [];
            const cadenceKey = `${days}days`;
            
            if (remindersSent.includes(cadenceKey)) {
                console.log(`Cadence ${cadenceKey} already sent for reminder ${reminder.id}`);
                continue;
            }
            
            // Build email data
            const emailType = userCadences[days];
            const emailData = {
                firstName: firstName,
                recipientName: person.personName || 'someone',
                relationship: person.relationship || null,
                occasion: getOccasionLabel(reminder),
                occasionCode: reminder.occasion,
                occasionDate: formatOccasionDate(reminder.date),
                userTier: userTier,
                giftPurchased: reminder.giftPurchased === true
            };
            
            console.log(`Sending ${emailType} to ${userEmail} (${userTier} tier) for ${person.personName}`);
            
            // Send the email
            const sent = await sendEmail(emailType, userEmail, emailData);
            
            if (sent) {
                stats.sent++;
                stats.byType[emailType] = (stats.byType[emailType] || 0) + 1;
                
                // Mark as sent in Firestore
                try {
                    await db.collection('people')
                        .doc(person.id)
                        .collection('reminders')
                        .doc(reminder.id)
                        .update({
                            remindersSent: admin.firestore.FieldValue.arrayUnion(cadenceKey),
                            lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                } catch (updateError) {
                    console.error(`Failed to update reminder ${reminder.id}:`, updateError);
                }
            } else {
                stats.failed++;
                console.error(`Failed to send ${emailType} for reminder ${reminder.id}`);
            }
            
            // ========================================================
            // SEND SMS (Curate tier only, 14/7/3 days before occasion)
            // Independent of email send/fail — tracked separately via
            // reminder.smsSent so it can never collide with the email
            // cadence tracking in reminder.remindersSent. Inherits the
            // giftPurchased suppression above, same as email.
            // ========================================================
            const SMS_DAYS = new Set([14, 7, 3, 0]);
            const isSmsEligibleTier = userTier === 'curate' || userTier === 'essential';
            
            if (isSmsEligibleTier && SMS_DAYS.has(days)) {
                const smsSentList = reminder.smsSent || [];
                const smsCadenceKey = `${days}days`;
                
                if (smsSentList.includes(smsCadenceKey)) {
                    console.log(`SMS cadence ${smsCadenceKey} already sent for reminder ${reminder.id}`);
                } else {
                    const userPhone = userData.phone || null;
                    
                    if (!userPhone) {
                        console.log(`No phone number for user ${person.userId}, skipping SMS`);
                    } else {
                        const smsOk = await sendSms(userPhone, days, person.personName || 'someone', getOccasionLabel(reminder));
                        
                        if (smsOk) {
                            stats.smsSent = (stats.smsSent || 0) + 1;
                            try {
                                await db.collection('people')
                                    .doc(person.id)
                                    .collection('reminders')
                                    .doc(reminder.id)
                                    .update({
                                        smsSent: admin.firestore.FieldValue.arrayUnion(smsCadenceKey),
                                        lastSmsSentAt: admin.firestore.FieldValue.serverTimestamp()
                                    });
                            } catch (updateError) {
                                console.error(`Failed to update SMS-sent flag for reminder ${reminder.id}:`, updateError);
                            }
                        } else {
                            stats.smsFailed = (stats.smsFailed || 0) + 1;
                            console.error(`Failed to send SMS (${days} days) for reminder ${reminder.id}`);
                        }
                    }
                }
            }
        }
    }
}

// ============================================================
// PROCESS JUST BECAUSE REMINDERS
// ============================================================
async function processJustBecauseReminders(today, stats) {
    console.log('Processing Just Because reminders...');
    
    // Get all people across all users
    const peopleSnapshot = await db.collection('people').get();
    
    for (const personDoc of peopleSnapshot.docs) {
        const person = { id: personDoc.id, ...personDoc.data() };
        
        if (!person.userId || !person.hasJustBecause) continue;
        
        // Get user info
        let userData;
        try {
            const userDoc = await db.collection('users').doc(person.userId).get();
            if (!userDoc.exists) continue;
            userData = userDoc.data();
        } catch (e) {
            continue;
        }
        
        // Only Curate/Essential users get Just Because emails
        if (userData.tier !== 'essential' && userData.tier !== 'curate') continue;
        
        const userEmail = userData.email;
        const firstName = userData.firstName || 'there';
        
        if (!userEmail) continue;
        
        // Get Just Because reminders for this person
        const remindersSnapshot = await db.collection('people')
            .doc(person.id)
            .collection('reminders')
            .where('reminderType', '==', 'just-because')
            .get();
        
        for (const reminderDoc of remindersSnapshot.docs) {
            const reminder = { id: reminderDoc.id, ...reminderDoc.data() };
            
            // Skip if no next scheduled date
            if (!reminder.nextScheduledDate) continue;
            
            // Check if today matches scheduled date
            const days = daysBetween(today, reminder.nextScheduledDate);
            
            // Send if today (days = 0)
            if (days !== 0) continue;
            
            console.log(`Sending Just Because email to ${userEmail} for ${person.personName}`);
            
            const sent = await sendEmail('reminderJustBecause', userEmail, {
                firstName: firstName,
                recipientName: person.personName || 'someone',
                relationship: person.relationship || null,
                occasionCode: 'just-because',
                userTier: userData.tier || 'discover'
            });
            
            if (sent) {
                stats.justBecauseSent++;
                
                // Calculate next scheduled date based on frequency
                const nextDate = calculateNextJBDate(reminder, today);
                
                try {
                    await db.collection('people')
                        .doc(person.id)
                        .collection('reminders')
                        .doc(reminder.id)
                        .update({
                            nextScheduledDate: nextDate,
                            lastSentAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                } catch (updateError) {
                    console.error(`Failed to update JB reminder ${reminder.id}:`, updateError);
                }
            }
        }
    }
}

// ============================================================
// PROCESS UPGRADE NUDGE EMAILS
// Sends nudge to free users who signed up exactly 3 days ago
// ============================================================
async function processUpgradeNudges(today, stats) {
    console.log('Processing upgrade nudge emails...');
    
    // Calculate the target signup date (3 days ago)
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);
    
    const endOfThreeDaysAgo = new Date(threeDaysAgo);
    endOfThreeDaysAgo.setHours(23, 59, 59, 999);
    
    console.log(`Looking for free/discover users who signed up between ${threeDaysAgo.toISOString()} and ${endOfThreeDaysAgo.toISOString()}`);
    
    // Get all users (we'll filter for free/discover tier in code)
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
        const user = { id: userDoc.id, ...userDoc.data() };
        
        // Only nudge free/discover users (paid users don't need upgrade nudges)
        if (user.tier !== 'free' && user.tier !== 'discover') {
            continue;
        }
        
        // Skip if already received the nudge
        if (user.upgradeNudgeSent) {
            continue;
        }
        
        // Skip if no email
        if (!user.email) {
            continue;
        }
        
        // Check signup date - we want users who signed up exactly 3 days ago
        let signupDate;
        if (user.createdAt) {
            // Firestore timestamp
            signupDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        } else if (user.signupDate) {
            signupDate = new Date(user.signupDate);
        } else {
            // No signup date - skip
            continue;
        }
        
        // Check if signup was on the target day
        if (signupDate >= threeDaysAgo && signupDate <= endOfThreeDaysAgo) {
            console.log(`Sending upgrade nudge to ${user.email} (signed up ${signupDate.toISOString()})`);
            
            const sent = await sendEmail('upgradeNudge', user.email, {
                firstName: user.firstName || 'there'
            });
            
            if (sent) {
                stats.nudgesSent++;
                
                // Mark as sent
                try {
                    await db.collection('users').doc(user.id).update({
                        upgradeNudgeSent: true,
                        upgradeNudgeSentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (updateError) {
                    console.error(`Failed to mark nudge as sent for ${user.id}:`, updateError);
                }
            } else {
                stats.nudgeFailed++;
            }
        }
    }
}

// ============================================================
// HELPER: Calculate next Just Because date based on frequency
// ============================================================
function calculateNextJBDate(reminder, fromDate) {
    const next = new Date(fromDate);
    
    switch (reminder.frequency) {
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'every_6_weeks':
            next.setDate(next.getDate() + 42);
            break;
        case 'every_2_months':
            next.setMonth(next.getMonth() + 2);
            break;
        case 'every_3_months':
            next.setMonth(next.getMonth() + 3);
            break;
        case 'every_6_months':
            next.setMonth(next.getMonth() + 6);
            break;
        case 'custom':
            if (reminder.customMonths) {
                next.setMonth(next.getMonth() + reminder.customMonths);
            } else {
                next.setMonth(next.getMonth() + 2);
            }
            break;
        case 'random':
            // Random between 30-90 days
            const randomDays = 30 + Math.floor(Math.random() * 60);
            next.setDate(next.getDate() + randomDays);
            break;
        default:
            next.setMonth(next.getMonth() + 2);
    }
    
    return next.toISOString().split('T')[0];
}

// ============================================================
// MAIN HANDLER
// ============================================================
//
// SCHEDULING: this function was previously never actually wired to
// run on any schedule at all — Netlify Scheduled Functions require
// an explicit trigger (this schedule() wrapper, or a netlify.toml
// entry), and neither existed. This is why nothing fired.
//
// Runs every hour on the hour (UTC, per Netlify's cron), but only
// proceeds with the actual reminder run when it's currently 7am UK
// local time — checked via Intl.DateTimeFormat against the real
// Europe/London timezone, which is DST-aware automatically. This
// means the send time stays correct at 7am UK time year-round
// (GMT in winter, BST in summer) without needing the cron
// expression itself to be manually changed twice a year.
const { schedule } = require('@netlify/functions');

const mainHandler = async (event) => {
    // Gate: only proceed if it's currently 7am in the UK right now.
    const ukHourNow = parseInt(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            hour: 'numeric',
            hour12: false
        }).format(new Date()),
        10
    );

    if (ukHourNow !== 7) {
        console.log(`Skipping run — current UK local hour is ${ukHourNow}, not 7. (This function runs hourly and only acts at 7am UK time.)`);
        return { statusCode: 200, body: JSON.stringify({ skipped: true, ukHourNow }) };
    }

    const startTime = Date.now();
    console.log('=== AGLAEA Scheduled Reminders Started ===');
    console.log('Time:', new Date().toISOString());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = {
        sent: 0,
        failed: 0,
        smsSent: 0,
        smsFailed: 0,
        justBecauseSent: 0,
        nudgesSent: 0,
        nudgeFailed: 0,
        byType: {}
    };
    
    try {
        // Process date-based reminders (birthday, anniversary, etc.)
        await processDateBasedReminders(today, stats);
        
        // Process Just Because reminders
        await processJustBecauseReminders(today, stats);
        
        // Process upgrade nudge emails (3 days post-signup)
        await processUpgradeNudges(today, stats);
        
        const duration = (Date.now() - startTime) / 1000;
        
        console.log('=== Scheduled Reminders Complete ===');
        console.log(`Duration: ${duration}s`);
        console.log(`Reminders sent: ${stats.sent}`);
        console.log(`SMS sent: ${stats.smsSent}`);
        console.log(`SMS failed: ${stats.smsFailed}`);
        console.log(`Just Because sent: ${stats.justBecauseSent}`);
        console.log(`Upgrade nudges sent: ${stats.nudgesSent}`);
        console.log(`Failed: ${stats.failed}`);
        console.log(`By type:`, stats.byType);
        
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        await takeAdminSnapshot(stats, todayStr);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                stats: stats,
                duration: duration
            })
        };
        
    } catch (error) {
        console.error('Scheduled reminders error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
                stats: stats
            })
        };
    }
};

// ============================================================
// SCHEDULE CONFIG (Netlify Scheduled Functions)
// Runs hourly (UTC) — mainHandler itself gates on "is it currently
// 7am UK local time" before doing any real work, so this correctly
// self-adjusts for GMT/BST without the cron expression needing to
// change twice a year. This wrapper is the actual, correct
// mechanism for CommonJS-style functions (exports.handler) — a
// previous exports.config block here used a syntax that only
// applies to Netlify's newer ES-module Functions API, which this
// file doesn't use, and was never actually being recognized as a
// schedule at all.
// ============================================================
exports.handler = schedule('0 * * * *', mainHandler);
