// ============================================================
// DASHBOARD LOGIC - FINAL CLEAN VERSION
// People-centric + Just Because + Tier + Edit + Delete
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

import {
    showFieldError,
    clearFieldError,
    clearAllErrors,
    validateRequired,
    validateFutureDate,
    setButtonLoading,
    resetButton,
    setupFieldValidation
} from './form-validation.js';

import { checkAndShowOnboarding } from './onboarding.js';

// Get Firebase instances
const auth = window.firebaseAuth;

let currentUser = null;
let currentUserTier = 'free';

// ============================================================
// COUNT DATE-BASED REMINDERS (for limit checking)
// ============================================================

function countDateBasedReminders() {
    // Count reminder items with 'date-based' class
    // Exclude past reminders (in past gifts section)
    let count = 0;
    document.querySelectorAll('#peopleList .reminder-item.date-based').forEach(function(item) {
        count++;
    });
    return count;
}

// ============================================================
// INITIALIZATION
// ============================================================

auth.onAuthStateChanged(function(user) {
    if (user) {
        currentUser = user;
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userName').textContent = user.email.split('@')[0];
        loadDashboard();
        setupEventListeners();
        
        // Check if onboarding needs to be shown
        checkAndShowOnboarding(user);
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
            
            // Update display name with first name
            if (userData.firstName) {
                document.getElementById('userName').textContent = userData.firstName;
            }
        } else {
            await createOrUpdateUser(currentUser.uid, {
                email: currentUser.email,
                tier: 'free'
            });
            currentUserTier = 'free';
        }
        
        const planEl = document.getElementById('planType');
        if (planEl) {
            // Display friendly tier names (handle both old and new tier values)
            const tierDisplayNames = {
                'free': 'Discover',
                'discover': 'Discover',
                'essential': 'Curate',
                'curate': 'Curate'
            };
            planEl.textContent = tierDisplayNames[currentUserTier] || 'Discover';
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
        await loadUserData();
        
        const people = await getPeopleForUser(currentUser.uid);
        
        const peopleWithReminders = await Promise.all(
            people.map(async function(person) {
                const reminders = await getRemindersForPerson(person.id);
                return Object.assign({}, person, { reminders: reminders });
            })
        );
        
        updateStats(peopleWithReminders);
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
    const dateBasedReminders = peopleWithReminders.reduce(function(total, person) {
        return total + person.reminders.filter(function(r) {
            return r.reminderType === 'date-based';
        }).length;
    }, 0);
    
    // Both free and discover have 5-reminder limit
    const limit = (currentUserTier === 'free' || currentUserTier === 'discover') ? 5 : '∞';
    document.getElementById('reminderCount').textContent = dateBasedReminders + '/' + limit;
    
    // Free tier users (free or discover) have 5-reminder limit
    if ((currentUserTier === 'free' || currentUserTier === 'discover') && dateBasedReminders >= 5) {
        document.getElementById('upgradeBanner').classList.remove('hidden');
    }
    
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
            return new Date(a.date) - new Date(b.date);
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
    const pastGiftsSection = document.getElementById('pastGiftsSection');
    const pastGiftsList = document.getElementById('pastGiftsList');
    
    if (peopleWithReminders.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No reminders yet. Click "Add Reminder" to get started!</p></div>';
        if (pastGiftsSection) pastGiftsSection.classList.add('hidden');
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let activeHtml = '';
    let pastHtml = '';
    let hasPastGifts = false;
    
    peopleWithReminders.forEach(function(person) {
        const jbBadge = person.hasJustBecause ? '<span class="jb-badge">✨ JB</span>' : '';
        
        // Split reminders into active and past
        const activeReminders = [];
        const pastReminders = [];
        
        person.reminders.forEach(function(reminder) {
            if (reminder.reminderType === 'date-based') {
                const reminderDate = new Date(reminder.date);
                reminderDate.setHours(0, 0, 0, 0);
                if (reminderDate < today) {
                    pastReminders.push(reminder);
                } else {
                    activeReminders.push(reminder);
                }
            } else {
                // Just Because reminders stay active (recurring)
                activeReminders.push(reminder);
            }
        });
        
        // Render active card
        if (activeReminders.length > 0 || person.reminders.length === 0) {
            const relationshipTag = person.relationship ? '<span class="relationship-tag">' + person.relationship + '</span>' : '';

            activeHtml += '<div class="person-card" data-person-id="' + person.id + '">';
            activeHtml += '<div class="person-header">';
            activeHtml += '<h3>' + person.personName + ' ' + relationshipTag + ' ' + jbBadge + '</h3>';
            activeHtml += '<div class="person-actions">';
            activeHtml += '<button class="btn-icon add-reminder-to-person" data-person-id="' + person.id + '" data-person-name="' + person.personName + '" data-relationship="' + (person.relationship || '') + '" title="Add reminder for this person">+</button>';
            activeHtml += '<button class="btn-icon delete-person" data-person-id="' + person.id + '" title="Delete person">🗑️</button>';
            activeHtml += '</div>';
            activeHtml += '</div>';
            
            if (activeReminders.length === 0) {
                activeHtml += '<p class="no-reminders">No upcoming reminders</p>';
            } else {
                activeHtml += '<div class="reminders-list">';
                activeReminders.forEach(function(reminder) {
                    if (reminder.reminderType === 'date-based') {
                        activeHtml += renderDateReminder(reminder, person.id);
                    } else if (reminder.reminderType === 'just-because') {
                        activeHtml += renderJustBecauseReminder(reminder, person.id);
                    }
                });
                activeHtml += '</div>';
            }
            activeHtml += '</div>';
        }
        
        // Render past gifts card
        if (pastReminders.length > 0) {
            hasPastGifts = true;
            pastHtml += '<div class="person-card past" data-person-id="' + person.id + '">';
            pastHtml += '<div class="person-header"><h3>' + person.personName + '</h3></div>';
            pastHtml += '<div class="reminders-list">';
            pastReminders.forEach(function(reminder) {
                pastHtml += renderPastReminder(reminder, person.id);
            });
            pastHtml += '</div>';
            pastHtml += '</div>';
        }
    });
    
    listEl.innerHTML = activeHtml;
    
    if (hasPastGifts && pastGiftsSection) {
        pastGiftsList.innerHTML = pastHtml;
        pastGiftsSection.classList.remove('hidden');
    } else if (pastGiftsSection) {
        pastGiftsSection.classList.add('hidden');
    }
    
    // Attach handlers
    document.querySelectorAll('.delete-person').forEach(function(btn) {
        btn.addEventListener('click', handleDeletePerson);
    });
    document.querySelectorAll('.edit-reminder').forEach(function(btn) {
        btn.addEventListener('click', handleEditReminder);
    });
    document.querySelectorAll('.delete-reminder').forEach(function(btn) {
        btn.addEventListener('click', handleDeleteReminder);
    });
    document.querySelectorAll('.mark-purchased').forEach(function(btn) {
        btn.addEventListener('click', handleMarkPurchased);
    });
    document.querySelectorAll('.undo-purchase').forEach(function(btn) {
        btn.addEventListener('click', handleUndoPurchase);
    });
    document.querySelectorAll('.add-reminder-to-person').forEach(function(btn) {
    btn.addEventListener('click', handleAddReminderToPerson);
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
    
    const isPurchased = reminder.giftPurchased === true;
    const purchasedClass = isPurchased ? ' purchased' : '';
    const purchasedBadge = isPurchased ? '<span class="purchased-badge">✓ Purchased</span>' : '';
    
    let actionButtons = '';
    if (isPurchased) {
        actionButtons += '<button class="btn-icon undo-purchase" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Undo">↩️</button>';
    } else {
        actionButtons += '<button class="btn-icon mark-purchased" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Mark as purchased">✓</button>';
    }
    actionButtons += '<button class="btn-icon edit-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Edit">✏️</button>';
    actionButtons += '<button class="btn-icon delete-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Delete">🗑️</button>';
    
    let html = '<div class="reminder-item date-based' + purchasedClass + '" data-reminder-id="' + reminder.id + '">';
    html += '<div class="reminder-info">';
    html += '<span class="reminder-icon">' + icon + '</span>';
    html += '<div>';
    html += '<strong>' + capitalize(occasionLabel) + ' ' + purchasedBadge + '</strong>';
    html += '<small>' + dateStr + ' • ' + daysText + '</small>';
    html += '</div>';
    html += '</div>';
    html += '<div class="reminder-actions">' + actionButtons + '</div>';
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
    
    const isPurchased = reminder.giftPurchased === true;
    const purchasedClass = isPurchased ? ' purchased' : '';
    const purchasedBadge = isPurchased ? '<span class="purchased-badge">✓ Purchased</span>' : '';
    
    let actionButtons = '';
    if (isPurchased) {
        actionButtons += '<button class="btn-icon undo-purchase" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Undo">↩️</button>';
    } else {
        actionButtons += '<button class="btn-icon mark-purchased" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Mark as purchased">✓</button>';
    }
    actionButtons += '<button class="btn-icon edit-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Edit">✏️</button>';
    actionButtons += '<button class="btn-icon delete-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Delete">🗑️</button>';
    
    let html = '<div class="reminder-item just-because' + purchasedClass + '" data-reminder-id="' + reminder.id + '">';
    html += '<div class="reminder-info">';
    html += '<span class="reminder-icon">✨</span>';
    html += '<div>';
    html += '<strong>Just Because ' + purchasedBadge + '</strong>';
    html += '<small>' + frequencyText;
    if (nextDateText) {
        html += ' • Next: ' + nextDateText;
    }
    html += '</small>';
    html += '</div>';
    html += '</div>';
    html += '<div class="reminder-actions">' + actionButtons + '</div>';
    html += '</div>';
    
    return html;
}

// ============================================================
// SETUP EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    const addBtn = document.getElementById('addReminderBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function() {
            // Check reminder limit for free tier (free or discover)
            if (currentUserTier === 'free' || currentUserTier === 'discover') {
                const dateBasedCount = countDateBasedReminders();
                if (dateBasedCount >= 5) {
                    if (confirm('You\'ve reached the Discover tier limit of 5 reminders. Upgrade to Curate for unlimited reminders?')) {
                        window.location.href = 'upgrade.html';
                    }
                    return;
                }
            }
            document.getElementById('addReminderModal').classList.remove('hidden');
        });
    }
    
    document.querySelectorAll('.modal-close').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modalId = btn.dataset.modal || 'addReminderModal';
            document.getElementById(modalId).classList.add('hidden');
            if (modalId === 'addReminderModal') {
                resetForm();
            }
        });
    });
    
    const addModal = document.getElementById('addReminderModal');
    if (addModal) {
        addModal.addEventListener('click', function(e) {
            if (e.target.id === 'addReminderModal') {
                addModal.classList.add('hidden');
                resetForm();
            }
        });
    }
    
    const editModal = document.getElementById('editReminderModal');
    if (editModal) {
        editModal.addEventListener('click', function(e) {
            if (e.target.id === 'editReminderModal') {
                editModal.classList.add('hidden');
            }
        });
    }
    
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
    
    const editOccasionSelect = document.getElementById('editOccasion');
    if (editOccasionSelect) {
        editOccasionSelect.addEventListener('change', function(e) {
            const customGroup = document.getElementById('editCustomOccasion');
            if (e.target.value === 'custom') {
                customGroup.classList.remove('hidden');
            } else {
                customGroup.classList.add('hidden');
            }
        });
    }

    // Real-time validation for Add Reminder modal
    setupFieldValidation('newName', function(value) {
        return validateRequired(value, 'Name');
    });

    setupFieldValidation('newDate', function(value) {
        return validateFutureDate(value, true);
    });

    // Real-time validation for Edit Reminder modal (date-based)
    setupFieldValidation('editDate', function(value) {
        if (!value) return { valid: false, message: 'Please select a date' };
        return { valid: true, message: '' };
    });

    // Relationship change handler
    const relationshipSelect = document.getElementById('newRelationship');
    if (relationshipSelect) {
        relationshipSelect.addEventListener('change', function(e) {
            const customGroup = document.getElementById('newCustomRelationship');
            if (e.target.value === 'Other') {
                customGroup.classList.remove('hidden');
            } else {
                customGroup.classList.add('hidden');
            }
        });
    }
    
    const nameInput = document.getElementById('newName');
    if (nameInput) {
        nameInput.addEventListener('input', function(e) {
            const name = e.target.value.trim() || 'this person';
            document.getElementById('justBecausePersonName').textContent = name;
        });
    }
    
    const enableJBCheckbox = document.getElementById('enableJustBecause');
    if (enableJBCheckbox) {
        enableJBCheckbox.addEventListener('change', function(e) {
            const options = document.getElementById('justBecauseOptions');
            const upgradePrompt = document.getElementById('jbUpgradePrompt');
            const configSection = document.getElementById('jbConfigSection');
            
            if (e.target.checked) {
                options.classList.remove('hidden');
                
                if (currentUserTier === 'free' || currentUserTier === 'discover') {
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
    
    const form = document.getElementById('newReminderForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    const editForm = document.getElementById('editReminderForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }
}

// ============================================================
// HANDLE FORM SUBMIT (ADD REMINDER)
// ============================================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Clear previous errors
    clearAllErrors('newReminderForm');
    
    // Check reminder limit for free tier (free or discover)
    if (currentUserTier === 'free' || currentUserTier === 'discover') {
        const dateBasedCount = countDateBasedReminders();
        if (dateBasedCount >= 5) {
            alert('You\'ve reached the Discover tier limit of 5 reminders. Please upgrade to Curate to add more.');
            document.getElementById('addReminderModal').classList.add('hidden');
            window.location.href = 'upgrade.html';
            return;
        }
    }
    
    const enableJB = document.getElementById('enableJustBecause').checked;
    
    if (enableJB && (currentUserTier === 'free' || currentUserTier === 'discover')) {
        alert('Just Because reminders require Curate tier. Please upgrade or uncheck the Just Because option.');
        return;
    }
    
    // Get all values for validation
    const personName = document.getElementById('newName').value.trim();
    const relationshipValue = document.getElementById('newRelationship').value;
    const customRelationship = document.getElementById('newCustomRelationshipName').value.trim();
    const relationship = relationshipValue === 'Other' ? customRelationship : relationshipValue;
    
    const occasion = document.getElementById('newOccasion').value;
    const customOccasionName = document.getElementById('newCustomOccasionName').value.trim();
    const occasionDate = document.getElementById('newDate').value;
    const notes = document.getElementById('newNotes').value.trim();
    
    // Validate
    let hasErrors = false;
    
    const nameCheck = validateRequired(personName, 'Name');
    if (!nameCheck.valid) {
        showFieldError('newName', nameCheck.message);
        hasErrors = true;
    }
    
    if (!relationshipValue) {
        showFieldError('newRelationship', 'Please select a relationship');
        hasErrors = true;
    } else if (relationshipValue === 'Other' && !customRelationship) {
        showFieldError('newCustomRelationshipName', 'Please specify the relationship');
        hasErrors = true;
    }
    
    if (!occasion) {
        showFieldError('newOccasion', 'Please select an occasion');
        hasErrors = true;
    } else if (occasion === 'custom' && !customOccasionName) {
        showFieldError('newCustomOccasionName', 'Please specify the occasion');
        hasErrors = true;
    }
    
    const dateCheck = validateFutureDate(occasionDate, true);
    if (!dateCheck.valid) {
        showFieldError('newDate', dateCheck.message);
        hasErrors = true;
    }
    
    if (hasErrors) {
        // Focus first error field
        const firstError = document.querySelector('#newReminderForm .field-error');
        if (firstError) {
            firstError.focus();
        }
        return;
    }
    
    // Set loading state
    setButtonLoading('submitReminderBtn', 'Adding...');
    
    try {
        const existingPersonId = document.getElementById('newReminderForm').dataset.existingPersonId;
        
        let personId;
        
        // Smart matching logic
        const existingPeople = await getPeopleForUser(currentUser.uid);
        const match = existingPeople.find(function(p) {
            return p.personName.toLowerCase() === personName.toLowerCase() && 
                   (p.relationship || '').toLowerCase() === relationship.toLowerCase();
        });
        
        if (match) {
            personId = match.id;
        } else if (existingPersonId) {
            const originalPerson = existingPeople.find(function(p) { 
                return p.id === existingPersonId; 
            });
            
            const nameChanged = originalPerson && 
                originalPerson.personName.toLowerCase() !== personName.toLowerCase();
            const relationshipChanged = originalPerson && 
                (originalPerson.relationship || '').toLowerCase() !== relationship.toLowerCase();
            
            if (nameChanged || relationshipChanged) {
                personId = await createPerson(currentUser.uid, personName, relationship);
            } else {
                personId = existingPersonId;
            }
        } else {
            personId = await createPerson(currentUser.uid, personName, relationship);
        }
        
        if (enableJB && currentUserTier !== 'free') {
            await updatePerson(personId, { hasJustBecause: true });
        }
        
        await createDateBasedReminder(personId, {
            occasion: occasion,
            customOccasionName: occasion === 'custom' ? customOccasionName : null,
            date: occasionDate,
            notes: notes
        });
        
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
                smsEnabled: currentUserTier !== 'free' && currentUserTier !== 'discover'
            });
        }
        
        document.getElementById('addReminderModal').classList.add('hidden');
        resetForm();
        loadDashboard();
        
    } catch (error) {
        console.error('Error adding reminder:', error);
        alert('Error adding reminder. Please try again.');
    } finally {
        resetButton('submitReminderBtn');
    }
}

// ============================================================
// HANDLE EDIT REMINDER (Opens edit modal with current data)
// ============================================================

async function handleEditReminder(e) {
    const reminderId = e.target.dataset.reminderId;
    const personId = e.target.dataset.personId;
    
    try {
        // Get person and reminder data
        const people = await getPeopleForUser(currentUser.uid);
        const person = people.find(function(p) { return p.id === personId; });
        
        const reminders = await getRemindersForPerson(personId);
        const reminder = reminders.find(function(r) { return r.id === reminderId; });
        
        if (!reminder) {
            alert('Reminder not found');
            return;
        }
        
        const reminderType = reminder.reminderType;
        
        // Set hidden inputs
        document.getElementById('editReminderId').value = reminderId;
        document.getElementById('editPersonId').value = personId;
        document.getElementById('editReminderType').value = reminderType;
        
        // Set person display (read-only)
        const personName = person ? person.personName : '';
        const relationship = person && person.relationship ? person.relationship : '';
        
        document.getElementById('editPersonDisplay').textContent = personName;
        document.getElementById('editRelationshipDisplay').textContent = relationship || '';
        document.getElementById('editRelationshipDisplay').style.display = relationship ? 'inline-block' : 'none';
        
        // Show appropriate fields based on type
        const dateFields = document.getElementById('editDateFields');
        const jbFields = document.getElementById('editJBFields');
        
        if (reminderType === 'date-based') {
            dateFields.classList.remove('hidden');
            jbFields.classList.add('hidden');
            
            document.getElementById('editOccasion').value = reminder.occasion || 'birthday';
            
            if (reminder.occasion === 'custom' && reminder.customOccasionName) {
                document.getElementById('editCustomOccasion').classList.remove('hidden');
                document.getElementById('editCustomOccasionName').value = reminder.customOccasionName;
            } else {
                document.getElementById('editCustomOccasion').classList.add('hidden');
            }
            
            if (reminder.date) {
                document.getElementById('editDate').value = reminder.date;
            }
            
            document.getElementById('editNotes').value = reminder.notes || '';
            
        } else if (reminderType === 'just-because') {
            dateFields.classList.add('hidden');
            jbFields.classList.remove('hidden');
            
            document.getElementById('editJBFrequency').value = reminder.frequency || 'every_6_weeks';
        }
        
        // Show the modal
        document.getElementById('editReminderModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading reminder for edit:', error);
        alert('Error loading reminder. Please try again.');
    }
}

// ============================================================
// HANDLE EDIT SUBMIT (Saves changes from edit modal)
// ============================================================

async function handleEditSubmit(e) {
    e.preventDefault();
    
    // Clear previous errors
    clearAllErrors('editReminderForm');
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const btnId = submitBtn.id || 'editSaveBtn';
    if (!submitBtn.id) submitBtn.id = btnId;
    
    const reminderId = document.getElementById('editReminderId').value;
    const personId = document.getElementById('editPersonId').value;
    const reminderType = document.getElementById('editReminderType').value;
    
    let hasErrors = false;
    
    if (reminderType === 'date-based') {
        const editDate = document.getElementById('editDate').value;
        
        if (!editDate) {
            showFieldError('editDate', 'Please select a date');
            hasErrors = true;
        }
        
        const occasion = document.getElementById('editOccasion').value;
        const customOccasionName = document.getElementById('editCustomOccasionName').value.trim();
        
        if (occasion === 'custom' && !customOccasionName) {
            showFieldError('editCustomOccasionName', 'Please specify the occasion');
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        const firstError = document.querySelector('#editReminderForm .field-error');
        if (firstError) {
            firstError.focus();
        }
        return;
    }
    
    setButtonLoading(btnId, 'Saving...');
    
    try {
        if (reminderType === 'date-based') {
            const occasion = document.getElementById('editOccasion').value;
            const customOccasionName = document.getElementById('editCustomOccasionName').value.trim();
            const date = document.getElementById('editDate').value;
            const notes = document.getElementById('editNotes').value.trim();
    
            await updateReminder(personId, reminderId, {
                occasion: occasion,
                customOccasionName: occasion === 'custom' ? customOccasionName : null,
                date: date,
                notes: notes
            });
    
        } else if (reminderType === 'just-because') {
            const frequency = document.getElementById('editJBFrequency').value;
    
            await updateReminder(personId, reminderId, {
                frequency: frequency
            });
        }
        
        document.getElementById('editReminderModal').classList.add('hidden');
        loadDashboard();
        
    } catch (error) {
        console.error('Error updating reminder:', error);
        alert('Error updating reminder. Please try again.');
    } finally {
        resetButton(btnId);
    }
}

// ============================================================
// HANDLE ADD REMINDER TO EXISTING PERSON
// ============================================================

function handleAddReminderToPerson(e) {
    const personId = e.target.dataset.personId;
    const personName = e.target.dataset.personName;
    const relationship = e.target.dataset.relationship;
    
    // Pre-fill the Add Reminder modal
    document.getElementById('newName').value = personName;
    document.getElementById('newRelationship').value = relationship;
    document.getElementById('justBecausePersonName').textContent = personName;
    
    // Store the existing person ID so we know to add to them, not create new
    document.getElementById('newReminderForm').dataset.existingPersonId = personId;
    
    // Open the modal
    document.getElementById('addReminderModal').classList.remove('hidden');
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
// HANDLE DELETE REMINDER
// ============================================================

async function handleDeleteReminder(e) {
    const personId = e.target.dataset.personId;
    const reminderId = e.target.dataset.reminderId;
    
    if (!confirm('Are you sure you want to delete this reminder?')) {
        return;
    }
    
    try {
        await deleteReminder(personId, reminderId);
        loadDashboard();
    } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Error deleting reminder. Please try again.');
    }
}

// ============================================================
// RESET FORM
// ============================================================

function resetForm() {
    document.getElementById('newReminderForm').reset();
    document.getElementById('newReminderForm').removeAttribute('data-existing-person-id');
    document.getElementById('newCustomOccasion').classList.add('hidden');
    document.getElementById('newCustomRelationship').classList.add('hidden');
    document.getElementById('justBecauseOptions').classList.add('hidden');
    document.getElementById('customMonthsGroup').classList.add('hidden');
    document.getElementById('randomPerYearGroup').classList.add('hidden');
    document.getElementById('jbStartDateGroup').classList.add('hidden');
    document.getElementById('jbUpgradePrompt').classList.add('hidden');
    document.getElementById('jbConfigSection').classList.remove('disabled');
    document.getElementById('justBecausePersonName').textContent = 'this person';
    
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
// RENDER PAST REMINDER (simplified for history)
// ============================================================

function renderPastReminder(reminder, personId) {
    const date = new Date(reminder.date);
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
    
    const isPurchased = reminder.giftPurchased === true;
    const purchasedBadge = isPurchased 
        ? '<span class="purchased-badge">✓ Purchased</span>' 
        : '<span class="not-purchased-badge">Not purchased</span>';
    
    let html = '<div class="reminder-item past">';
    html += '<div class="reminder-info">';
    html += '<span class="reminder-icon">' + icon + '</span>';
    html += '<div>';
    html += '<strong>' + capitalize(occasionLabel) + ' ' + purchasedBadge + '</strong>';
    html += '<small>' + dateStr + '</small>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    return html;
}

// ============================================================
// HANDLE MARK PURCHASED
// ============================================================

async function handleMarkPurchased(e) {
    const personId = e.target.dataset.personId;
    const reminderId = e.target.dataset.reminderId;
    
    try {
        await updateReminder(personId, reminderId, {
            giftPurchased: true,
            purchasedDate: new Date().toISOString()
        });
        loadDashboard();
    } catch (error) {
        console.error('Error marking as purchased:', error);
        alert('Error marking as purchased. Please try again.');
    }
}

// ============================================================
// HANDLE UNDO PURCHASE
// ============================================================

async function handleUndoPurchase(e) {
    const personId = e.target.dataset.personId;
    const reminderId = e.target.dataset.reminderId;
    
    try {
        await updateReminder(personId, reminderId, {
            giftPurchased: false,
            purchasedDate: null
        });
        loadDashboard();
    } catch (error) {
        console.error('Error undoing purchase:', error);
        alert('Error undoing purchase. Please try again.');
    }
}

// ============================================================
// EXPORT FOR GLOBAL ACCESS
// ============================================================

window.loadDashboard = loadDashboard;
