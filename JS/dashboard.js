// ============================================================
// DASHBOARD V2 LOGIC
// Person-Grouped Display + Just Because Support
// ============================================================

import { 
    getPeopleForUser, 
    getRemindersForPerson,
    createPerson,
    createDateBasedReminder,
    createJustBecauseReminder,
    updatePerson,
    updateReminder,
    deletePerson,
    deleteReminder,
    getUser,
    createOrUpdateUser
} from './firebase-config-v2.js';

// Get Firebase instances
const auth = window.firebaseAuth;
const db = window.firebaseDb;

let currentUser = null;
let currentUserTier = 'free'; // TODO: Get from user profile

// ============================================================
// INITIALIZATION
// ============================================================

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];

 /**
 * Load user data and set tier
 * @returns {Promise<Object>} - User data
 */
async function loadUserData() {
    try {
        const userId = auth.currentUser.uid;
        const userData = await getUser(userId);
        
        if (userData) {
            // Update global tier variable
            currentUserTier = userData.tier || 'free';
            return userData;
        } else {
            // User document doesn't exist - create it
            await createOrUpdateUser(userId, {
                email: auth.currentUser.email,
                tier: 'free'
            });
            currentUserTier = 'free';
            return { tier: 'free' };
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        currentUserTier = 'free';
        return { tier: 'free' };
    }
}
        // Load dashboard data
        loadDashboard();
    } else {
        window.location.href = 'signin.html';
    }
});

// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {
    try {
        // Load user data first to get tier
        await loadUserData();  // ← ADD THIS LINE
        
        // Show loading state
        document.getElementById('peopleList').innerHTML = `
        
        // Get all people for this user
        const people = await getPeopleForUser(currentUser.uid);
        
        // Get reminders for each person
        const peopleWithReminders = await Promise.all(
            people.map(async (person) => {
                const reminders = await getRemindersForPerson(person.id);
                return {
                    ...person,
                    reminders
                };
            })
        );
        
        // Update stats
        updateStats(peopleWithReminders);
        
        // Render people list
        renderPeopleList(peopleWithReminders);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('peopleList').innerHTML = `
            <div class="empty-state">
                <p>Error loading reminders. Please refresh the page.</p>
            </div>
        `;
    }
}

// ============================================================
// UPDATE STATS
// ============================================================

function updateStats(peopleWithReminders) {
    // Count total reminders (excluding Just Because from limit)
    const dateBasedReminders = peopleWithReminders.reduce((total, person) => {
        return total + person.reminders.filter(r => r.reminderType === 'date-based').length;
    }, 0);
    
    // Update reminder count
    const limit = currentUserTier === 'free' ? 5 : '∞';
    document.getElementById('reminderCount').textContent = `${dateBasedReminders}/${limit}`;
    
    // Show upgrade banner if at limit
    if (currentUserTier === 'free' && dateBasedReminders >= 5) {
        document.getElementById('upgradeBanner').classList.remove('hidden');
    }
    
    // Find next reminder
    const allReminders = peopleWithReminders.flatMap(person => 
        person.reminders.map(reminder => ({
            ...reminder,
            personName: person.personName
        }))
    );
    
    const now = new Date();
    const upcomingReminders = allReminders
        .map(reminder => {
            const reminderDate = reminder.reminderType === 'date-based' 
                ? new Date(reminder.date)
                : new Date(reminder.nextReminderDate);
            
            return {
                ...reminder,
                reminderDate,
                daysUntil: Math.ceil((reminderDate - now) / (24 * 60 * 60 * 1000))
            };
        })
        .filter(r => r.daysUntil >= 0)
        .sort((a, b) => a.daysUntil - b.daysUntil);
    
    if (upcomingReminders.length > 0) {
        const next = upcomingReminders[0];
        const daysText = next.daysUntil === 0 ? 'Today' : 
                        next.daysUntil === 1 ? 'Tomorrow' : 
                        `${next.daysUntil} days`;
        document.getElementById('nextReminder').textContent = daysText;
    } else {
        document.getElementById('nextReminder').textContent = '-';
    }
    
    // Update plan type
    document.getElementById('planType').textContent = 
        currentUserTier === 'free' ? 'Free' :
        currentUserTier === 'essential' ? 'Essential' : 'Premium';
}

// ============================================================
// RENDER PEOPLE LIST
// ============================================================

function renderPeopleList(peopleWithReminders) {
    const container = document.getElementById('peopleList');
    
    if (peopleWithReminders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No reminders yet. Add your first one to get started!</p>
                <button class="btn btn-primary" onclick="document.getElementById('addReminderBtn').click()">+ Add Reminder</button>
            </div>
        `;
        return;
    }
    
    // Sort people by next reminder date
    const sortedPeople = peopleWithReminders.map(person => {
        const nextReminder = person.reminders.length > 0 ? person.reminders[0] : null;
        const nextDate = nextReminder 
            ? (nextReminder.reminderType === 'date-based' ? new Date(nextReminder.date) : new Date(nextReminder.nextReminderDate))
            : new Date('9999-12-31');
        
        return {
            ...person,
            nextDate
        };
    }).sort((a, b) => a.nextDate - b.nextDate);
    
    container.innerHTML = sortedPeople.map(person => renderPersonCard(person)).join('');
}

// ============================================================
// RENDER PERSON CARD
// ============================================================

function renderPersonCard(person) {
    const now = new Date();
    
    // Render reminders (already sorted by date from getRemindersForPerson)
    const remindersHTML = person.reminders.map(reminder => {
        const isJustBecause = reminder.reminderType === 'just-because';
        
        if (isJustBecause) {
            return renderJustBecauseReminder(reminder, person.id, now);
        } else {
            return renderDateBasedReminder(reminder, person.id, now);
        }
    }).join('');
    
    return `
        <div class="person-card" data-person-id="${person.id}">
            <div class="person-header">
                <div class="person-name-wrapper">
                    <h3 class="person-name">${person.personName}</h3>
                    ${person.hasJustBecause ? '<span class="jb-badge">✨ JB</span>' : ''}
                </div>
                <div class="person-actions">
                    <button class="btn-icon" onclick="editPerson('${person.id}')" title="Edit person">✏️</button>
                    <button class="btn-icon" onclick="deletePerson('${person.id}')" title="Delete person">🗑️</button>
                </div>
            </div>
            
            <div class="person-reminders">
                ${remindersHTML}
            </div>
        </div>
    `;
}

// ============================================================
// RENDER DATE-BASED REMINDER
// ============================================================

function renderDateBasedReminder(reminder, personId, now) {
    const reminderDate = new Date(reminder.date);
    const daysUntil = Math.ceil((reminderDate - now) / (24 * 60 * 60 * 1000));
    
    const dateFormatted = reminderDate.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
    });
    
    let daysText = '';
    let daysClass = '';
    
    if (daysUntil < 0) {
        daysText = `${Math.abs(daysUntil)} days ago`;
        daysClass = '';
    } else if (daysUntil === 0) {
        daysText = 'Today!';
        daysClass = 'upcoming';
    } else if (daysUntil === 1) {
        daysText = 'Tomorrow!';
        daysClass = 'upcoming';
    } else if (daysUntil <= 7) {
        daysText = `${daysUntil} days`;
        daysClass = 'upcoming';
    } else {
        daysText = `${daysUntil} days`;
        daysClass = '';
    }
    
    const icon = getOccasionIcon(reminder.occasion);
    
    return `
        <div class="reminder-item" data-reminder-id="${reminder.id}">
            <div class="reminder-info">
                <div class="reminder-occasion">
                    <span class="reminder-icon">${icon}</span>
                    ${reminder.occasion}
                </div>
                <div class="reminder-date">${dateFormatted}</div>
            </div>
            <div class="reminder-status">
                <span class="days-until ${daysClass}">${daysText}</span>
                <button class="btn-icon" onclick="deleteReminderFromCard('${personId}', '${reminder.id}')" title="Delete reminder">🗑️</button>
            </div>
        </div>
    `;
}

// ============================================================
// RENDER JUST BECAUSE REMINDER
// ============================================================

function renderJustBecauseReminder(reminder, personId, now) {
    const nextDate = new Date(reminder.nextReminderDate);
    const daysUntil = Math.ceil((nextDate - now) / (24 * 60 * 60 * 1000));
    
    const dateFormatted = nextDate.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long'
    });
    
    let daysText = '';
    let daysClass = '';
    
    if (daysUntil <= 7) {
        daysText = `${daysUntil} days`;
        daysClass = 'upcoming';
    } else {
        daysText = `${daysUntil} days`;
        daysClass = '';
    }
    
    const frequencyLabel = getFrequencyLabel(reminder.frequency, reminder.customMonths, reminder.randomPerYear);
    
    return `
        <div class="reminder-item" data-reminder-id="${reminder.id}">
            <div class="reminder-info">
                <div class="reminder-occasion">
                    <span class="reminder-icon">✨</span>
                    Just Because
                </div>
                <div class="reminder-frequency">${frequencyLabel}</div>
                <div class="reminder-next">Next: ${dateFormatted}</div>
            </div>
            <div class="reminder-status">
                <span class="days-until ${daysClass}">${daysText}</span>
                <button class="btn-icon" onclick="pauseJustBecause('${personId}', '${reminder.id}')" title="Pause Just Because">⏸️</button>
                <button class="btn-icon" onclick="deleteReminderFromCard('${personId}', '${reminder.id}')" title="Delete reminder">🗑️</button>
            </div>
        </div>
    `;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getOccasionIcon(occasion) {
    const icons = {
        'Birthday': '🎂',
        'Anniversary': '💕',
        "Valentine's Day": '💝',
        "Mother's Day": '🌸',
        "Father's Day": '👔',
        'Christmas': '🎄',
        'Wedding': '💍'
    };
    return icons[occasion] || '🎁';
}

function getFrequencyLabel(frequency, customMonths, randomPerYear) {
    const labels = {
        'monthly': 'Every month',
        'every_6_weeks': 'Every 6 weeks',
        'every_2_months': 'Every 2 months',
        'every_3_months': 'Every 3 months',
        'every_6_months': 'Every 6 months'
    };
    
    if (frequency === 'custom') {
        return `Every ${customMonths} ${customMonths === 1 ? 'month' : 'months'}`;
    }
    
    if (frequency === 'random') {
        return `Random - ${randomPerYear}x per year`;
    }
    
    return labels[frequency] || 'Every 6 weeks';
}

// ============================================================
// MODAL MANAGEMENT
// ============================================================

const modal = document.getElementById('addReminderModal');
const addReminderBtn = document.getElementById('addReminderBtn');
const closeModalBtns = document.querySelectorAll('.modal-close');

addReminderBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    resetForm();
});

closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
});

// Close modal on outside click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// ============================================================
// FORM LOGIC
// ============================================================

// Update person name in Just Because checkbox dynamically
document.getElementById('newName').addEventListener('input', (e) => {
    const name = e.target.value || 'this person';
    document.getElementById('justBecausePersonName').textContent = name;
});

// Show/hide custom occasion input
document.getElementById('newOccasion').addEventListener('change', (e) => {
    const customInput = document.getElementById('newCustomOccasion');
    if (e.target.value === 'Other') {
        customInput.classList.remove('hidden');
        customInput.required = true;
    } else {
        customInput.classList.add('hidden');
        customInput.required = false;
        customInput.value = '';
    }
});

// Enable/disable Just Because based on checkbox
document.getElementById('enableJustBecause').addEventListener('change', (e) => {
    const options = document.getElementById('justBecauseOptions');
    const upgradePrompt = document.getElementById('jbUpgradePrompt');
    const configSection = document.getElementById('jbConfigSection');
    
    if (e.target.checked) {
        options.classList.remove('hidden');
        
        // Check user tier
        if (currentUserTier === 'free') {
            // Show upgrade prompt
            upgradePrompt.classList.remove('hidden');
            // Grey out config section
            configSection.classList.add('disabled');
        } else {
            // Hide upgrade prompt
            upgradePrompt.classList.add('hidden');
            // Enable config section
            configSection.classList.remove('disabled');
        }
    } else {
        options.classList.add('hidden');
        // Reset to default state
        configSection.classList.remove('disabled');
    }
});

// Show/hide custom/random dropdowns based on radio selection
document.querySelectorAll('input[name="jbFrequency"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const customGroup = document.getElementById('customMonthsGroup');
        const randomGroup = document.getElementById('randomPerYearGroup');
        
        // Hide both first
        customGroup.classList.add('hidden');
        randomGroup.classList.add('hidden');
        
        // Show only the relevant one
        if (e.target.value === 'custom') {
            customGroup.classList.remove('hidden');
        } else if (e.target.value === 'random') {
            randomGroup.classList.remove('hidden');
        }
    });
});

// Show/hide start date input
document.getElementById('jbStartImmediately').addEventListener('change', (e) => {
    const startDateGroup = document.getElementById('jbStartDateGroup');
    if (e.target.checked) {
        startDateGroup.classList.add('hidden');
        document.getElementById('jbStartDate').required = false;
    } else {
        startDateGroup.classList.remove('hidden');
        document.getElementById('jbStartDate').required = true;
    }
});

// Form submission with tier check
document.getElementById('newReminderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const enableJB = document.getElementById('enableJustBecause').checked;
    
    // Block submission if Just Because enabled but user is free
    if (enableJB && currentUserTier === 'free') {
        alert('Just Because reminders require Essential tier. Please upgrade or uncheck the Just Because option.');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    try {
        await handleFormSubmission();
        modal.classList.add('hidden');
        resetForm();
        await loadDashboard();
    } catch (error) {
        console.error('Error adding reminder:', error);
        alert('Error adding reminder. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Reminder';
    }
});

// Form submission
document.getElementById('newReminderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const enableJB = document.getElementById('enableJustBecause').checked;
    
    // Block submission if Just Because enabled but user is free
    if (enableJB && currentUserTier === 'free') {
        alert('Just Because reminders require Essential tier. Please upgrade or uncheck the Just Because option.');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    try {
        await handleFormSubmission();
        modal.classList.add('hidden');
        resetForm();
        loadDashboard();
    } catch (error) {
        console.error('Error adding reminder:', error);
        alert('Error adding reminder. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Reminder';
    }
});

// Continued in Part 2...
// ============================================================
// DASHBOARD V2 LOGIC - PART 2
// Form Submission & Utility Functions
// ============================================================

// ============================================================
// HANDLE FORM SUBMISSION
// ============================================================

async function handleFormSubmission() {
    // Get form values
    const personName = document.getElementById('newName').value.trim();
    const relationship = document.getElementById('newRelationship').value || null;
    const occasion = document.getElementById('newOccasion').value === 'Other' 
        ? document.getElementById('newCustomOccasion').value.trim()
        : document.getElementById('newOccasion').value;
    const date = document.getElementById('newDate').value;
    
    const enableJB = document.getElementById('enableJustBecause').checked;
    
    // Check if person already exists
    const existingPeople = await getPeopleForUser(currentUser.uid);
    let personId = null;
    
    const existingPerson = existingPeople.find(p => 
        p.personName.toLowerCase() === personName.toLowerCase()
    );
    
    if (existingPerson) {
        // Person exists, use their ID
        personId = existingPerson.id;
    } else {
        // Create new person
        personId = await createPerson(currentUser.uid, personName, relationship);
    }
    
    // Create date-based reminder
    await createDateBasedReminder(personId, {
        occasion,
        date,
        reminderDays: [7, 3, 0],
        smsEnabled: currentUserTier !== 'free'
    });
    
    // Create Just Because reminder if enabled and allowed
    if (enableJB && currentUserTier !== 'free') {
        const frequencyRadio = document.querySelector('input[name="jbFrequency"]:checked');
        const frequency = frequencyRadio ? frequencyRadio.value : 'every_6_weeks';
        const customMonths = frequency === 'custom' 
            ? parseInt(document.getElementById('jbCustomMonths').value)
            : null;
        const randomPerYear = frequency === 'random'
            ? parseInt(document.getElementById('jbRandomPerYear').value)
            : null;
        
        const startImmediately = document.getElementById('jbStartImmediately').checked;
        const startDate = startImmediately 
            ? null 
            : document.getElementById('jbStartDate').value;
        
        await createJustBecauseReminder(personId, {
            frequency,
            customMonths,
            randomPerYear,
            startImmediately,
            startDate,
            smsEnabled: currentUserTier !== 'free'
        });
    }
}

// ============================================================
// RESET FORM
// ============================================================

function resetForm() {
    document.getElementById('newReminderForm').reset();
    document.getElementById('newCustomOccasion').classList.add('hidden');
    document.getElementById('justBecauseOptions').classList.add('hidden');
    document.getElementById('customMonthsGroup').classList.add('hidden');
    document.getElementById('randomPerYearGroup').classList.add('hidden');
    document.getElementById('jbStartDateGroup').classList.add('hidden');
    document.getElementById('jbUpgradePrompt').classList.add('hidden');
    document.getElementById('jbConfigSection').classList.remove('disabled');
    document.getElementById('justBecausePersonName').textContent = 'this person';
    
    // Reset radio buttons to default (every 6 weeks)
    const defaultRadio = document.querySelector('input[name="jbFrequency"][value="every_6_weeks"]');
    if (defaultRadio) {
        defaultRadio.checked = true;
    }
}

// ============================================================
// DELETE FUNCTIONS
// ============================================================

window.deleteReminderFromCard = async function(personId, reminderId) {
    if (!confirm('Are you sure you want to delete this reminder?')) {
        return;
    }
    
    try {
        await deleteReminder(personId, reminderId);
        
        // Check if person has any reminders left
        const reminders = await getRemindersForPerson(personId);
        
        if (reminders.length === 0) {
            // No reminders left, delete the person too
            await deletePerson(personId);
        }
        
        // Reload dashboard
        loadDashboard();
    } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Error deleting reminder. Please try again.');
    }
};

window.deletePerson = async function(personId) {
    if (!confirm('Are you sure you want to delete this person and all their reminders?')) {
        return;
    }
    
    try {
        await deletePerson(personId);
        loadDashboard();
    } catch (error) {
        console.error('Error deleting person:', error);
        alert('Error deleting person. Please try again.');
    }
};

// ============================================================
// EDIT FUNCTIONS
// ============================================================

window.editPerson = function(personId) {
    // TODO: Implement edit person modal
    alert('Edit person feature coming soon!');
};

window.pauseJustBecause = async function(personId, reminderId) {
    try {
        // Toggle pause status
        const reminders = await getRemindersForPerson(personId);
        const reminder = reminders.find(r => r.id === reminderId);
        
        if (reminder) {
            await updateReminder(personId, reminderId, {
                paused: !reminder.paused
            });
            loadDashboard();
        }
    } catch (error) {
        console.error('Error pausing Just Because:', error);
        alert('Error pausing Just Because. Please try again.');
    }
};

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

// Make functions available globally for onclick handlers
window.loadDashboard = loadDashboard;
