// ============================================================
// DASHBOARD LOGIC - CLEAN VERSION
// Person-Grouped Display + Just Because + Tier Integration
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
let currentUserTier = 'free';

// ============================================================
// INITIALIZATION
// ============================================================

auth.onAuthStateChanged(function(user) {
    if (user) {
        currentUser = user;
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
        loadDashboard();
        setupEventListeners();
    } else {
        window.location.href = 'signin.html';
    }
});

// ============================================================
// LOAD USER DATA AND TIER
// ============================================================

async function loadUserData() {
    try {
        const userData = await getUser(currentUser.uid);
        
        if (userData) {
            currentUserTier = userData.tier || 'free';
        } else {
            await createOrUpdateUser(currentUser.uid, {
                email: currentUser.email,
                tier: 'free'
            });
            currentUserTier = 'free';
        }
        
        // Update plan display
        const planEl = document.getElementById('planType');
        if (planEl) {
            planEl.textContent = currentUserTier.charAt(0).toUpperCase() + currentUserTier.slice(1);
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
        currentUserTier = 'free';
    }
}

// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {
    try {
        // Load user tier first
        await loadUserData();
        
        // Get all people for this user
        const people = await getPeopleForUser(currentUser.uid);
        
        // Get reminders for each person
        const peopleWithReminders = await Promise.all(
            people.map(async function(person) {
                const reminders = await getRemindersForPerson(person.id);
                return Object.assign({}, person, { reminders: reminders });
            })
        );
        
        // Update stats
        updateStats(peopleWithReminders);
        
        // Render people list
        renderPeopleList(peopleWithReminders);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('peopleList').innerHTML = '<div class="empty-state"><p>Error loading reminders. Please refresh the page.</p></div>';
    }
}

// ============================================================
// UPDATE STATS
// ============================================================

function updateStats(peopleWithReminders) {
    // Count total date-based reminders (excluding Just Because from limit)
    const dateBasedReminders = peopleWithReminders.reduce(function(total, person) {
        return total + person.reminders.filter(function(r) {
            return r.reminderType === 'date-based';
        }).length;
    }, 0);
    
    // Update reminder count
    const limit = currentUserTier === 'free' ? 5 : '∞';
    document.getElementById('reminderCount').textContent = dateBasedReminders + '/' + limit;
    
    // Show upgrade banner if at limit
    if (currentUserTier === 'free' && dateBasedReminders >= 5) {
        document.getElementById('upgradeBanner').classList.remove('hidden');
    }
    
    // Find next reminder
    const allReminders = peopleWithReminders.flatMap(function(person) {
        return person.reminders.map(function(reminder) {
            return Object.assign({}, reminder, { personName: person.personName });
        });
    });
    
    const dateReminders = allReminders.filter(function(r) {
        return r.reminderType === 'date-based';
    });
    
    if (dateReminders.length > 0) {
        const sorted = dateReminders.sort(function(a, b) {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });
        
        const next = sorted[0];
        const nextDate = new Date(next.date);
        const dateStr = nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        document.getElementById('nextReminder').textContent = dateStr;
    } else {
        document.getElementById('nextReminder').textContent = '-';
    }
}

// ============================================================
// RENDER PEOPLE LIST
// ============================================================

function renderPeopleList(peopleWithReminders) {
    const listEl = document.getElementById('peopleList');
    
    if (peopleWithReminders.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No reminders yet. Click "Add Reminder" to get started!</p></div>';
        return;
    }
    
    let html = '';
    
    peopleWithReminders.forEach(function(person) {
        const jbBadge = person.hasJustBecause ? '<span class="jb-badge">✨ JB</span>' : '';
        
        html += '<div class="person-card" data-person-id="' + person.id + '">';
        html += '<div class="person-header">';
        html += '<h3>' + person.personName + ' ' + jbBadge + '</h3>';
        html += '<button class="btn-icon delete-person" data-person-id="' + person.id + '" title="Delete person">🗑️</button>';
        html += '</div>';
        
        if (person.reminders.length === 0) {
            html += '<p class="no-reminders">No reminders for this person</p>';
        } else {
            html += '<div class="reminders-list">';
            person.reminders.forEach(function(reminder) {
                if (reminder.reminderType === 'date-based') {
                    html += renderDateReminder(reminder, person.id);
                } else if (reminder.reminderType === 'just-because') {
                    html += renderJustBecauseReminder(reminder, person.id);
                }
            });
            html += '</div>';
        }
        
        html += '</div>';
    });
    
    listEl.innerHTML = html;
    
    // Attach delete handlers
    document.querySelectorAll('.delete-person').forEach(function(btn) {
        btn.addEventListener('click', handleDeletePerson);
    });
}

// ============================================================
// RENDER DATE REMINDER
// ============================================================

function renderDateReminder(reminder, personId) {
    const date = new Date(reminder.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    let occasionLabel = reminder.occasion;
    if (reminder.occasion === 'custom' && reminder.customOccasionName) {
        occasionLabel = reminder.customOccasionName;
    }
    
    const occasionIcons = {
        'birthday': '🎂',
        'anniversary': '💕',
        'mothers-day': '🌷',
        'fathers-day': '👔',
        'christmas': '🎄',
        'valentines': '💝',
        'custom': '🎁'
    };
    const icon = occasionIcons[reminder.occasion] || '🎁';
    
    let daysText = '';
    if (daysUntil < 0) {
        daysText = '<span class="days-passed">' + Math.abs(daysUntil) + ' days ago</span>';
    } else if (daysUntil === 0) {
        daysText = '<span class="days-today">Today!</span>';
    } else {
        daysText = '<span class="days-until">in ' + daysUntil + ' days</span>';
    }
    
    let html = '<div class="reminder-item date-based" data-reminder-id="' + reminder.id + '">';
    html += '<div class="reminder-info">';
    html += '<span class="reminder-icon">' + icon + '</span>';
    html += '<div>';
    html += '<strong>' + capitalize(occasionLabel) + '</strong>';
    html += '<small>' + dateStr + ' • ' + daysText + '</small>';
    html += '</div>';
    html += '</div>';
    html += '<div class="reminder-actions">';
    html += '<button class="btn-icon delete-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Delete">🗑️</button>';
    html += '</div>';
    html += '</div>';
    
    return html;
}

// ============================================================
// RENDER JUST BECAUSE REMINDER
// ============================================================

function renderJustBecauseReminder(reminder, personId) {
    const frequencyLabels = {
        'monthly': 'Every month',
        'every_6_weeks': 'Every 6 weeks',
        'every_2_months': 'Every 2 months',
        'every_3_months': 'Every 3 months',
        'every_6_months': 'Every 6 months',
        'custom': 'Custom schedule',
        'random': 'Random surprises'
    };
    
    const frequencyText = frequencyLabels[reminder.frequency] || reminder.frequency;
    
    let nextDateText = '';
    if (reminder.nextScheduledDate) {
        const nextDate = new Date(reminder.nextScheduledDate);
        nextDateText = nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    
    let html = '<div class="reminder-item just-because" data-reminder-id="' + reminder.id + '">';
    html += '<div class="reminder-info">';
    html += '<span class="reminder-icon">✨</span>';
    html += '<div>';
    html += '<strong>Just Because</strong>';
    html += '<small>' + frequencyText;
    if (nextDateText) {
        html += ' • Next: ' + nextDateText;
    }
    html += '</small>';
    html += '</div>';
    html += '</div>';
    html += '<div class="reminder-actions">';
    html += '<button class="btn-icon delete-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Delete">🗑️</button>';
    html += '</div>';
    html += '</div>';
    
    return html;
}

// ============================================================
// SETUP EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // Add Reminder button
    const addBtn = document.getElementById('addReminderBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            document.getElementById('addReminderModal').classList.remove('hidden');
        });
    }
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.getElementById('addReminderModal').classList.add('hidden');
            resetForm();
        });
    });
    
    // Click outside modal to close
    document.getElementById('addReminderModal').addEventListener('click', function(e) {
        if (e.target.id === 'addReminderModal') {
            document.getElementById('addReminderModal').classList.add('hidden');
            resetForm();
        }
    });
    
    // Custom occasion toggle
    const occasionSelect = document.getElementById('newOccasion');
    if (occasionSelect) {
        occasionSelect.addEventListener('change', function(e) {
            const customGroup = document.getElementById('newCustomOccasion');
            if (e.target.value === 'custom') {
                customGroup.classList.remove('hidden');
            } else {
                customGroup.classList.add('hidden');
            }
        });
    }
    
    // Update person name in Just Because text
    const nameInput = document.getElementById('newName');
    if (nameInput) {
        nameInput.addEventListener('input', function(e) {
            const name = e.target.value.trim() || 'this person';
            document.getElementById('justBecausePersonName').textContent = name;
        });
    }
    
    // Just Because checkbox
    const enableJBCheckbox = document.getElementById('enableJustBecause');
    if (enableJBCheckbox) {
        enableJBCheckbox.addEventListener('change', function(e) {
            const options = document.getElementById('justBecauseOptions');
            const upgradePrompt = document.getElementById('jbUpgradePrompt');
            const configSection = document.getElementById('jbConfigSection');
            
            if (e.target.checked) {
                options.classList.remove('hidden');
                
                if (currentUserTier === 'free') {
                    upgradePrompt.classList.remove('hidden');
                    configSection.classList.add('disabled');
                } else {
                    upgradePrompt.classList.add('hidden');
                    configSection.classList.remove('disabled');
                }
            } else {
                options.classList.add('hidden');
                configSection.classList.remove('disabled');
            }
        });
    }
    
    // Frequency radio buttons
    document.querySelectorAll('input[name="jbFrequency"]').forEach(function(radio) {
        radio.addEventListener('change', function(e) {
            const customGroup = document.getElementById('customMonthsGroup');
            const randomGroup = document.getElementById('randomPerYearGroup');
            
            customGroup.classList.add('hidden');
            randomGroup.classList.add('hidden');
            
            if (e.target.value === 'custom') {
                customGroup.classList.remove('hidden');
            } else if (e.target.value === 'random') {
                randomGroup.classList.remove('hidden');
            }
        });
    });
    
    // Start immediately toggle
    const startImmediatelyCheckbox = document.getElementById('jbStartImmediately');
    if (startImmediatelyCheckbox) {
        startImmediatelyCheckbox.addEventListener('change', function(e) {
            const startDateGroup = document.getElementById('jbStartDateGroup');
            if (e.target.checked) {
                startDateGroup.classList.add('hidden');
            } else {
                startDateGroup.classList.remove('hidden');
            }
        });
    }
    
    // Form submission
    const form = document.getElementById('newReminderForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

// ============================================================
// HANDLE FORM SUBMIT
// ============================================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const enableJB = document.getElementById('enableJustBecause').checked;
    
    // Block free users from submitting Just Because
    if (enableJB && currentUserTier === 'free') {
        alert('Just Because reminders require Essential tier. Please upgrade or uncheck the Just Because option.');
        return;
    }
    
    const submitBtn = document.getElementById('submitReminderBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    try {
        // Get form values
        const personName = document.getElementById('newName').value.trim();
        const occasion = document.getElementById('newOccasion').value;
        const customOccasionName = document.getElementById('newCustomOccasionName').value.trim();
        const occasionDate = document.getElementById('newDate').value;
        const notes = document.getElementById('newNotes').value.trim();
        
        // Create person
        const personId = await createPerson(currentUser.uid, {
            personName: personName,
            hasJustBecause: enableJB && currentUserTier !== 'free'
        });
        
        // Create date-based reminder
        await createDateBasedReminder(personId, {
            occasion: occasion,
            customOccasionName: occasion === 'custom' ? customOccasionName : null,
            date: occasionDate,
            notes: notes
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
                frequency: frequency,
                customMonths: customMonths,
                randomPerYear: randomPerYear,
                startImmediately: startImmediately,
                startDate: startDate,
                smsEnabled: currentUserTier !== 'free'
            });
        }
        
        // Close modal and reload
        document.getElementById('addReminderModal').classList.add('hidden');
        resetForm();
        loadDashboard();
        
    } catch (error) {
        console.error('Error adding reminder:', error);
        alert('Error adding reminder. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Reminder';
    }
}

// ============================================================
// HANDLE DELETE PERSON
// ============================================================

async function handleDeletePerson(e) {
    const personId = e.target.dataset.personId;
    
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
    
    // Reset radio to default
    const defaultRadio = document.querySelector('input[name="jbFrequency"][value="every_6_weeks"]');
    if (defaultRadio) {
        defaultRadio.checked = true;
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.loadDashboard = loadDashboard;
