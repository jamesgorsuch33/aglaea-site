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
            
            // Skip if no date
            if (!reminder.date) continue;
            
            // Calculate days until occasion
            const days = daysBetween(today, reminder.date);
            
            // Only process valid cadence days for this user's tier
            if (!(days in userCadences)) continue;
            
            // Skip if purchased AND it's not day-of
            // (Day-of always sends so they don't forget the actual day)
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
                userTier: userTier
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
exports.handler = async (event) => {
    const startTime = Date.now();
    console.log('=== AGLAEA Scheduled Reminders Started ===');
    console.log('Time:', new Date().toISOString());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = {
        sent: 0,
        failed: 0,
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
        console.log(`Just Because sent: ${stats.justBecauseSent}`);
        console.log(`Upgrade nudges sent: ${stats.nudgesSent}`);
        console.log(`Failed: ${stats.failed}`);
        console.log(`By type:`, stats.byType);
        
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
// Runs daily at 8:00 AM UTC
// ============================================================
exports.config = {
    schedule: "0 8 * * *"
};
