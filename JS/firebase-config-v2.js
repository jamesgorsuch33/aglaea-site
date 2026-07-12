// ============================================================
// FIREBASE CONFIGURATION V2
// People-Centric Model with Just Because Support
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, initializeFirestore, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with auto-detect long polling
// This fixes Safari's aggressive connection closing on WebSocket streams
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
});

// Collection references
export const peopleCollection = collection(db, 'people');
export const giftHistoryCollection = collection(db, 'giftHistory');

// ============================================================
// PEOPLE FUNCTIONS
// ============================================================

/**
 * Create a new person
 * @param {string} userId - Firebase Auth UID
 * @param {string} personName - Person's display name
 * @param {string} relationship - Optional relationship (Mother, Father, etc.)
 * @returns {Promise<string>} - Person document ID
 */
export async function createPerson(userId, personName, relationship = null) {
    try {
        const personData = {
            userId,
            personName,
            relationship,
            hasJustBecause: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        
        const docRef = await addDoc(peopleCollection, personData);
        return docRef.id;
    } catch (error) {
        console.error('Error creating person:', error);
        throw error;
    }
}

/**
 * Get all people for a user
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<Array>} - Array of people with their IDs
 */
export async function getPeopleForUser(userId) {
    try {
        const q = query(peopleCollection, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        const people = [];
        querySnapshot.forEach((doc) => {
            people.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return people;
    } catch (error) {
        console.error('Error getting people:', error);
        throw error;
    }
}

/**
 * Update person details
 * @param {string} personId - Person document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updatePerson(personId, updates) {
    try {
        const personRef = doc(db, 'people', personId);
        await updateDoc(personRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error updating person:', error);
        throw error;
    }
}

/**
 * Delete a person and all their reminders
 * @param {string} personId - Person document ID
 * @returns {Promise<void>}
 */
export async function deletePerson(personId) {
    try {
        // Delete all reminders first
        const remindersRef = collection(db, 'people', personId, 'reminders');
        const remindersSnapshot = await getDocs(remindersRef);
        
        const deletePromises = [];
        remindersSnapshot.forEach((reminderDoc) => {
            deletePromises.push(deleteDoc(reminderDoc.ref));
        });
        
        await Promise.all(deletePromises);
        
        // Then delete the person
        const personRef = doc(db, 'people', personId);
        await deleteDoc(personRef);
    } catch (error) {
        console.error('Error deleting person:', error);
        throw error;
    }
}

// ============================================================
// REMINDER FUNCTIONS
// ============================================================

/**
 * Create a date-based reminder
 * @param {string} personId - Person document ID
 * @param {Object} reminderData - Reminder details
 * @returns {Promise<string>} - Reminder document ID
 */
export async function createDateBasedReminder(personId, reminderData) {
    try {
        const remindersRef = collection(db, 'people', personId, 'reminders');
        
        const reminder = {
            reminderType: 'date-based',
            occasion: reminderData.occasion,
            date: reminderData.date,
            reminderDays: reminderData.reminderDays || [7, 3, 0],
            smsEnabled: reminderData.smsEnabled || false,
            active: true,
            lastReminderSent: null,
            giftPurchased: false,
            purchaseDate: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        
        const docRef = await addDoc(remindersRef, reminder);
        return docRef.id;
    } catch (error) {
        console.error('Error creating date-based reminder:', error);
        throw error;
    }
}

/**
 * Create a Just Because reminder
 * @param {string} personId - Person document ID
 * @param {Object} jbData - Just Because configuration
 * @returns {Promise<string>} - Reminder document ID
 */
export async function createJustBecauseReminder(personId, jbData) {
    try {
        const remindersRef = collection(db, 'people', personId, 'reminders');
        
        // Calculate first reminder date
        const startDate = jbData.startImmediately ? new Date() : new Date(jbData.startDate);
        const nextReminderDate = await calculateNextJustBecauseDate(
            personId,
            jbData.frequency,
            startDate,
            jbData.customMonths,
            jbData.randomPerYear
        );
        
        const reminder = {
            reminderType: 'just-because',
            occasion: 'Just Because',
            frequency: jbData.frequency,
            customMonths: jbData.customMonths || null,
            randomPerYear: jbData.randomPerYear || null,
            startDate: formatDate(startDate),
            nextReminderDate: formatDate(nextReminderDate),
            lastSentDate: null,
            avoidDateBufferWeeks: 3,
            active: true,
            paused: false,
            skipNext: false,
            giftPurchased: false,
            purchaseDate: null,
            smsEnabled: jbData.smsEnabled || false,
            lastReminderSent: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        
        const docRef = await addDoc(remindersRef, reminder);
        
        // Update person to show they have Just Because
        await updatePerson(personId, { hasJustBecause: true });
        
        return docRef.id;
    } catch (error) {
        console.error('Error creating Just Because reminder:', error);
        throw error;
    }
}

/**
 * Get all reminders for a person
 * @param {string} personId - Person document ID
 * @returns {Promise<Array>} - Array of reminders with their IDs
 */
export async function getRemindersForPerson(personId) {
    try {
        const remindersRef = collection(db, 'people', personId, 'reminders');
        const querySnapshot = await getDocs(remindersRef);
        
        const reminders = [];
        querySnapshot.forEach((doc) => {
            reminders.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by next reminder date (date-based use 'date', just-because use 'nextReminderDate')
        reminders.sort((a, b) => {
            const dateA = a.reminderType === 'date-based' ? new Date(a.date) : new Date(a.nextReminderDate);
            const dateB = b.reminderType === 'date-based' ? new Date(b.date) : new Date(b.nextReminderDate);
            return dateA - dateB;
        });
        
        return reminders;
    } catch (error) {
        console.error('Error getting reminders:', error);
        throw error;
    }
}

/**
 * Update a reminder
 * @param {string} personId - Person document ID
 * @param {string} reminderId - Reminder document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateReminder(personId, reminderId, updates) {
    try {
        const reminderRef = doc(db, 'people', personId, 'reminders', reminderId);
        await updateDoc(reminderRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error updating reminder:', error);
        throw error;
    }
}

/**
 * Delete a reminder
 * @param {string} personId - Person document ID
 * @param {string} reminderId - Reminder document ID
 * @returns {Promise<void>}
 */
export async function deleteReminder(personId, reminderId) {
    try {
        const reminderRef = doc(db, 'people', personId, 'reminders', reminderId);
        await deleteDoc(reminderRef);
        
        // Check if person still has any Just Because reminders
        const reminders = await getRemindersForPerson(personId);
        const hasJB = reminders.some(r => r.reminderType === 'just-because');
        
        if (!hasJB) {
            await updatePerson(personId, { hasJustBecause: false });
        }
    } catch (error) {
        console.error('Error deleting reminder:', error);
        throw error;
    }
}

// ============================================================
// JUST BECAUSE CALCULATION ENGINE
// ============================================================

/**
 * Calculate next Just Because reminder date
 * @param {string} personId - Person document ID
 * @param {string} frequency - Frequency type
 * @param {Date} fromDate - Calculate from this date
 * @param {number} customMonths - Custom months (if frequency is 'custom')
 * @param {number} randomPerYear - Random occurrences per year (if frequency is 'random')
 * @returns {Promise<Date>} - Next reminder date
 */
export async function calculateNextJustBecauseDate(personId, frequency, fromDate, customMonths = null, randomPerYear = null) {
    // Get all date-based reminders for this person (to avoid)
    const reminders = await getRemindersForPerson(personId);
    const dateBasedReminders = reminders.filter(r => r.reminderType === 'date-based');
    
    let proposedDate;
    
    // Calculate based on frequency
    switch (frequency) {
        case 'monthly':
            proposedDate = addWeeks(fromDate, 4);
            break;
        case 'every_6_weeks':
            proposedDate = addWeeks(fromDate, 6);
            break;
        case 'every_2_months':
            proposedDate = addWeeks(fromDate, 8);
            break;
        case 'every_3_months':
            proposedDate = addWeeks(fromDate, 12);
            break;
        case 'every_6_months':
            proposedDate = addWeeks(fromDate, 26);
            break;
        case 'custom':
            proposedDate = addMonths(fromDate, customMonths);
            break;
        case 'random':
            // Generate truly random date
            proposedDate = generateRandomDate(fromDate, dateBasedReminders);
            return proposedDate; // Random already avoids conflicts
        default:
            proposedDate = addWeeks(fromDate, 6);
    }
    
    // Apply smart date avoidance for non-random frequencies
    const finalDate = avoidConflictingDates(proposedDate, dateBasedReminders);
    
    return finalDate;
}

/**
 * Generate a truly random date avoiding conflicts
 * @param {Date} fromDate - Starting point
 * @param {Array} dateBasedReminders - Date-based reminders to avoid
 * @returns {Date} - Random date
 */
function generateRandomDate(fromDate, dateBasedReminders) {
    const maxAttempts = 100;
    let attempts = 0;
    
    // Calculate end of year or 365 days from now
    const endDate = new Date(fromDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    while (attempts < maxAttempts) {
        // Generate random date between fromDate and endDate
        const randomTime = fromDate.getTime() + Math.random() * (endDate.getTime() - fromDate.getTime());
        const randomDate = new Date(randomTime);
        
        // Check if it's at least 6 weeks from fromDate
        const weeksDiff = Math.floor((randomDate - fromDate) / (7 * 24 * 60 * 60 * 1000));
        if (weeksDiff < 6) {
            attempts++;
            continue;
        }
        
        // Check if it conflicts with any date-based reminders (3-week buffer)
        let hasConflict = false;
        for (const reminder of dateBasedReminders) {
            const reminderDate = new Date(reminder.date);
            const daysDiff = Math.abs((randomDate - reminderDate) / (24 * 60 * 60 * 1000));
            
            if (daysDiff < 21) { // 3 weeks = 21 days
                hasConflict = true;
                break;
            }
        }
        
        if (!hasConflict) {
            return randomDate;
        }
        
        attempts++;
    }
    
    // Fallback: if we can't find a random date, use 8 weeks from now
    return addWeeks(fromDate, 8);
}

/**
 * Check if date conflicts with any date-based reminders and adjust if needed
 * @param {Date} proposedDate - Proposed Just Because date
 * @param {Array} dateBasedReminders - Date-based reminders to check against
 * @returns {Date} - Adjusted date (or original if no conflicts)
 */
function avoidConflictingDates(proposedDate, dateBasedReminders) {
    const bufferWeeks = 3;
    const bufferDays = bufferWeeks * 7;
    
    for (const reminder of dateBasedReminders) {
        const reminderDate = new Date(reminder.date);
        const daysDifference = Math.abs((proposedDate - reminderDate) / (24 * 60 * 60 * 1000));
        
        // If within 3-week buffer, move forward past the buffer zone
        if (daysDifference < bufferDays) {
            // Move to 1 day after the buffer zone ends
            const daysToAdd = bufferDays - daysDifference + 1;
            proposedDate = new Date(proposedDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            
            // Recursively check if new date conflicts with other reminders
            return avoidConflictingDates(proposedDate, dateBasedReminders);
        }
    }
    
    return proposedDate;
}

// ============================================================
// GIFT HISTORY FUNCTIONS
// ============================================================

/**
 * Record a gift purchase
 * @param {Object} giftData - Gift purchase details
 * @returns {Promise<string>} - History document ID
 */
export async function recordGiftPurchase(giftData) {
    try {
        const historyData = {
            userId: giftData.userId,
            personId: giftData.personId,
            personName: giftData.personName,
            occasion: giftData.occasion,
            purchaseDate: giftData.purchaseDate,
            giftDescription: giftData.giftDescription || null,
            vendor: giftData.vendor || null,
            affiliateLink: giftData.affiliateLink || null,
            createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(giftHistoryCollection, historyData);
        
        // If this was a Just Because gift, calculate next reminder date
        if (giftData.occasion === 'Just Because' && giftData.reminderId) {
            const reminder = await getReminder(giftData.personId, giftData.reminderId);
            
            // Calculate next date from purchase date
            const purchaseDate = new Date(giftData.purchaseDate);
            const nextDate = await calculateNextJustBecauseDate(
                giftData.personId,
                reminder.frequency,
                purchaseDate,
                reminder.customMonths,
                reminder.randomPerYear
            );
            
            await updateReminder(giftData.personId, giftData.reminderId, {
                nextReminderDate: formatDate(nextDate),
                lastSentDate: formatDate(new Date()),
                giftPurchased: false, // Reset for next occurrence
                purchaseDate: giftData.purchaseDate
            });
        }
        
        return docRef.id;
    } catch (error) {
        console.error('Error recording gift purchase:', error);
        throw error;
    }
}

/**
 * Get gift history for a person
 * @param {string} userId - Firebase Auth UID
 * @param {string} personId - Person document ID
 * @returns {Promise<Array>} - Array of gift history
 */
export async function getGiftHistory(userId, personId) {
    try {
        const q = query(
            giftHistoryCollection,
            where('userId', '==', userId),
            where('personId', '==', personId)
        );
        
        const querySnapshot = await getDocs(q);
        const history = [];
        
        querySnapshot.forEach((doc) => {
            history.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by purchase date (most recent first)
        history.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
        
        return history;
    } catch (error) {
        console.error('Error getting gift history:', error);
        throw error;
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get a single reminder
 * @param {string} personId - Person document ID
 * @param {string} reminderId - Reminder document ID
 * @returns {Promise<Object>} - Reminder data
 */
async function getReminder(personId, reminderId) {
    try {
        const reminderRef = doc(db, 'people', personId, 'reminders', reminderId);
        const reminderSnap = await getDoc(reminderRef);
        
        if (reminderSnap.exists()) {
            return { id: reminderSnap.id, ...reminderSnap.data() };
        } else {
            throw new Error('Reminder not found');
        }
    } catch (error) {
        console.error('Error getting reminder:', error);
        throw error;
    }
}

/**
 * Add weeks to a date
 * @param {Date} date - Starting date
 * @param {number} weeks - Number of weeks to add
 * @returns {Date} - New date
 */
function addWeeks(date, weeks) {
    const result = new Date(date);
    result.setDate(result.getDate() + (weeks * 7));
    return result;
}

/**
 * Add months to a date
 * @param {Date} date - Starting date
 * @param {number} months - Number of months to add
 * @returns {Date} - New date
 */
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================
// USER FUNCTIONS
// ============================================================

/**
 * Create or update a user document in Firestore
 * @param {string} userId - User's Firebase Auth UID
 * @param {object} data - User data to save
 */
export async function createOrUpdateUser(userId, data) {
    try {
        const userRef = doc(db, 'users', userId);
        const existingDoc = await getDoc(userRef);
        
        if (existingDoc.exists()) {
            // Update existing user
            await updateDoc(userRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
        } else {
            // Create new user
            const { setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            await setDoc(userRef, {
                ...data,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        }
        
        return true;
    } catch (error) {
        console.error('Error creating/updating user:', error);
        throw error;
    }
}

/**
 * Get a user document by ID
 * @param {string} userId - User's Firebase Auth UID
 * @returns {object|null} - User data or null if not found
 */
export async function getUser(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting user:', error);
        throw error;
    }
}

// Export helper functions for use in UI
export { formatDate, addWeeks, addMonths };
