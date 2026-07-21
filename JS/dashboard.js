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
    calculateNextJustBecauseDate,
    formatDate,
    updatePerson,
    updateReminder,
    deletePerson,
    deleteReminder,
    getUser,
    createOrUpdateUser,
    auth
} from './firebase-config-v2.js';

let currentUser = null;
let currentUserTier = 'free';
let currentDateBasedCount = 0;  // Track count for limit checks

// ============================================================
// INITIALIZATION
// ============================================================

auth.onAuthStateChanged(function(user) {
    if (user) {
        currentUser = user;
        const emailEl = document.getElementById('userEmail');
        if (emailEl) emailEl.textContent = user.email;
        // Use first name only for welcome message
        const displayName = user.displayName || user.email.split('@')[0];
        const firstName = displayName.split(' ')[0];
        document.getElementById('userName').textContent = firstName;
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
            currentUserTier = userData.tier || 'discover';
            
            // Update welcome message with Firestore firstName (more reliable than displayName)
            if (userData.firstName) {
                document.getElementById('userName').textContent = userData.firstName;
            }
            
            // Check if there's a pending subscription (user just returned from Revolut)
            if (userData.pendingSubscriptionId && currentUserTier !== 'curate' && currentUserTier !== 'essential') {
                console.log('Pending subscription detected - checking status...');
                await checkSubscriptionStatus();
            }
        } else {
            await createOrUpdateUser(currentUser.uid, {
                email: currentUser.email,
                tier: 'discover'
            });
            currentUserTier = 'discover';
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
        
        const upgradeActionCard = document.getElementById('upgradeActionCard');
        if (upgradeActionCard) {
            const isUpgraded = currentUserTier === 'curate' || currentUserTier === 'essential';
            upgradeActionCard.classList.toggle('hidden', isUpgraded);
        }
        
        const addPhoneAction = document.getElementById('addPhoneAction');
        if (addPhoneAction) {
            const hasPhone = Boolean(userData && userData.phone);
            addPhoneAction.classList.toggle('hidden', hasPhone);
        }
        
    } catch (error) {
        console.error('Error loading user data:', error);
        currentUserTier = 'discover';
    }
}

// ============================================================
// CHECK SUBSCRIPTION STATUS (Revolut fallback)
// ============================================================
// Called when user returns from Revolut checkout
// Polls Revolut API to confirm subscription is active
// Updates tier to 'curate' if confirmed

async function checkSubscriptionStatus() {
    try {
        const response = await fetch('/.netlify/functions/check-subscription-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.uid })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Subscription check result:', result);
            
            if (result.upgraded) {
                console.log('Successfully upgraded to Curate!');
                currentUserTier = 'curate';
                
                // Show success message
                setTimeout(function() {
                    alert('✅ Welcome to AGLAEA Curate! Your upgrade is complete.');
                }, 500);
            }
        }
    } catch (error) {
        console.error('Subscription status check failed:', error);
        // Don't fail - user can refresh page later
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
    
    // Save count globally for limit checks
    currentDateBasedCount = dateBasedReminders;
    
    const limit = (currentUserTier === 'free' || currentUserTier === 'discover') ? 5 : '∞';
    document.getElementById('reminderCount').textContent = dateBasedReminders + '/' + limit;
    
    if (currentUserTier === 'free' && dateBasedReminders >= 5) {
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
    
    if (peopleWithReminders.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No reminders yet. Click "Add Reminder" to get started!</p></div>';
        return;
    }
    
    let html = '';
    
    peopleWithReminders.forEach(function(person) {
        const jbBadge = person.hasJustBecause ? '<span class="jb-badge">✨ JB</span>' : '';
        
        html += '<div class="person-card" data-person-id="' + person.id + '">';
        html += '<div class="person-header">';
        html += '<div class="person-name-wrapper">';
        html += '<h3>' + person.personName + ' ' + jbBadge + '</h3>';
        if (person.relationship) {
            html += '<span class="person-relationship">' + person.relationship + '</span>';
        }
        html += '</div>';
        html += '<div class="person-header-actions">';
        html += '<button class="btn-icon add-reminder-for-person" data-person-id="' + person.id + '" data-person-name="' + person.personName + '" title="Add reminder for this person">➕</button>';
        html += '<button class="btn-icon add-just-because-for-person" data-person-id="' + person.id + '" data-person-name="' + person.personName + '" title="Set up Just Because reminders for this person">✨</button>';
        html += '<button class="btn-icon delete-person" data-person-id="' + person.id + '" title="Delete person">🗑️</button>';
        html += '</div>';
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
    
    document.querySelectorAll('.delete-person').forEach(function(btn) {
        btn.addEventListener('click', handleDeletePerson);
    });
    
    document.querySelectorAll('.edit-reminder').forEach(function(btn) {
        btn.addEventListener('click', handleEditReminder);
    });
    
    document.querySelectorAll('.delete-reminder').forEach(function(btn) {
        btn.addEventListener('click', handleDeleteReminder);
    });
    
    // NEW: Add reminder for specific person
    document.querySelectorAll('.add-reminder-for-person').forEach(function(btn) {
        btn.addEventListener('click', handleAddReminderForPerson);
    });
    
    // NEW: Add Just Because for specific person
    document.querySelectorAll('.add-just-because-for-person').forEach(function(btn) {
        btn.addEventListener('click', handleAddJustBecauseForPerson);
    });
}

// ============================================================
// HELPER: Set up Just Because modal based on user tier + recipients
// ============================================================
async function setupJustBecauseModal(lockedPersonId, lockedPersonName) {
    const upgradePrompt = document.getElementById('jbModalUpgradePrompt');
    const configSection = document.getElementById('jbModalConfigSection');
    const submitBtn = document.getElementById('submitJustBecauseBtn');
    const select = document.getElementById('jbPersonSelect');
    const noRecipientsHelper = document.getElementById('jbNoRecipientsHelper');
    
    if (!upgradePrompt || !configSection || !select) return;
    
    const isLocked = currentUserTier === 'free' || currentUserTier === 'discover';
    
    if (isLocked) {
        upgradePrompt.classList.remove('hidden');
        configSection.classList.add('disabled');
        submitBtn.disabled = true;
        return;
    }
    
    upgradePrompt.classList.add('hidden');
    configSection.classList.remove('disabled');
    submitBtn.disabled = false;
    
    // Populate recipient dropdown from existing people
    const people = await getPeopleForUser(currentUser.uid);
    select.innerHTML = '<option value="">Select a recipient</option>';
    
    people.forEach(function(person) {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.personName + (person.relationship ? ' (' + person.relationship + ')' : '');
        select.appendChild(option);
    });
    
    noRecipientsHelper.style.display = people.length === 0 ? 'block' : 'none';
    submitBtn.disabled = people.length === 0;
    
    if (lockedPersonId) {
        // Opened via a specific person's card — pre-select and lock
        select.value = lockedPersonId;
        select.disabled = true;
        select.dataset.locked = 'true';
    } else {
        select.disabled = false;
        delete select.dataset.locked;
    }
}

// ============================================================
// HANDLE ADD REMINDER FOR SPECIFIC PERSON
// ============================================================
function handleAddReminderForPerson(e) {
    const personName = e.currentTarget.dataset.personName;
    const personId = e.currentTarget.dataset.personId;
    
    // Check reminder limit for free/discover tier
    if ((currentUserTier === 'free' || currentUserTier === 'discover') && currentDateBasedCount >= 5) {
        if (confirm('You\'ve reached the Discover tier limit of 5 reminders. Upgrade to Curate for unlimited reminders?')) {
            window.location.href = 'upgrade.html';
        }
        return;
    }
    
    // Open the add reminder modal
    const modal = document.getElementById('addReminderModal');
    if (modal) {
        // Pre-fill the person name and mark as existing person
        document.getElementById('newName').value = personName;
        document.getElementById('newName').readOnly = true;
        document.getElementById('newName').dataset.existingPersonId = personId;
        
        // Hide relationship field for existing person
        const relationshipGroup = document.getElementById('newRelationshipGroup');
        if (relationshipGroup) {
            relationshipGroup.style.display = 'none';
        }
        
        // Reset other fields
        document.getElementById('newOccasion').value = '';
        document.getElementById('newDate').value = '';
        document.getElementById('newNotes').value = '';
        
        modal.classList.remove('hidden');
    }
}

// ============================================================
// HANDLE ADD JUST BECAUSE FOR SPECIFIC PERSON
// ============================================================
async function handleAddJustBecauseForPerson(e) {
    const personId = e.currentTarget.dataset.personId;
    const personName = e.currentTarget.dataset.personName;
    
    const modal = document.getElementById('justBecauseModal');
    if (!modal) return;
    
    resetJustBecauseForm();
    await setupJustBecauseModal(personId, personName);
    modal.classList.remove('hidden');
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
    html += '<div class="reminder-text">';
    html += '<strong>' + capitalize(occasionLabel) + '</strong>';
    html += '<span class="reminder-separator"> • </span>';
    html += '<span class="reminder-date-text">' + dateStr + '</span>';
    html += '<span class="reminder-separator"> • </span>';
    html += daysText;
    html += '</div>';
    html += '</div>';
    html += '<div class="reminder-actions">';
    html += '<button class="btn-icon edit-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Edit">✏️</button>';
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
    html += '<div class="reminder-text">';
    html += '<strong>Just Because</strong>';
    html += '<span class="reminder-separator"> • </span>';
    html += '<span class="reminder-date-text">' + frequencyText + '</span>';
    if (nextDateText) {
        html += '<span class="reminder-separator"> • </span>';
        html += '<span class="reminder-date-text">Next: ' + nextDateText + '</span>';
    }
    html += '</div>';
    html += '</div>';
    html += '<div class="reminder-actions">';
    html += '<button class="btn-icon edit-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Edit">✏️</button>';
    html += '<button class="btn-icon delete-reminder" data-person-id="' + personId + '" data-reminder-id="' + reminder.id + '" title="Delete">🗑️</button>';
    html += '</div>';
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
            // Check reminder limit for free/discover tier
            if ((currentUserTier === 'free' || currentUserTier === 'discover') && currentDateBasedCount >= 5) {
                if (confirm('You\'ve reached the Discover tier limit of 5 reminders. Upgrade to Curate for unlimited reminders?')) {
                    window.location.href = 'upgrade.html';
                }
                return;
            }
            // Reset form for new person
            document.getElementById('newName').value = '';
            document.getElementById('newName').readOnly = false;
            delete document.getElementById('newName').dataset.existingPersonId;
            
            // Show relationship field for new person
            const relationshipGroup = document.getElementById('newRelationshipGroup');
            if (relationshipGroup) {
                relationshipGroup.style.display = '';
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
            } else if (modalId === 'justBecauseModal') {
                resetJustBecauseForm();
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
    
    const editJBModal = document.getElementById('editJustBecauseModal');
    if (editJBModal) {
        editJBModal.addEventListener('click', function(e) {
            if (e.target.id === 'editJustBecauseModal') {
                editJBModal.classList.add('hidden');
            }
        });
    }
    
    const editJBForm = document.getElementById('editJustBecauseForm');
    if (editJBForm) {
        editJBForm.addEventListener('submit', handleEditJustBecauseSubmit);
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
    
    const form = document.getElementById('newReminderForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    const editForm = document.getElementById('editReminderForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }
    
    // Just Because modal
    const jbBtn = document.getElementById('addJustBecauseBtn');
    if (jbBtn) {
        jbBtn.addEventListener('click', async function() {
            resetJustBecauseForm();
            await setupJustBecauseModal(null, null);
            document.getElementById('justBecauseModal').classList.remove('hidden');
        });
    }
    
    const jbModal = document.getElementById('justBecauseModal');
    if (jbModal) {
        jbModal.addEventListener('click', function(e) {
            if (e.target.id === 'justBecauseModal') {
                jbModal.classList.add('hidden');
                resetJustBecauseForm();
            }
        });
    }
    
    const jbForm = document.getElementById('justBecauseForm');
    if (jbForm) {
        jbForm.addEventListener('submit', handleJustBecauseFormSubmit);
    }
}

// ============================================================
// HANDLE FORM SUBMIT (ADD REMINDER)
// ============================================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Check reminder limit for free/discover tier (defense in depth)
    if ((currentUserTier === 'free' || currentUserTier === 'discover') && currentDateBasedCount >= 5) {
        alert('You\'ve reached the Discover tier limit of 5 reminders. Please upgrade to Curate to add more.');
        document.getElementById('addReminderModal').classList.add('hidden');
        window.location.href = 'upgrade.html';
        return;
    }
    
    const submitBtn = document.getElementById('submitReminderBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    
    try {
        const personName = document.getElementById('newName').value.trim();
        const relationship = document.getElementById('newRelationship').value;
        const occasion = document.getElementById('newOccasion').value;
        const customOccasionName = document.getElementById('newCustomOccasionName').value.trim();
        const occasionDate = document.getElementById('newDate').value;
        const notes = document.getElementById('newNotes').value.trim();
        
        // Check if we're adding to an existing person (from the + button on their card)
        const existingPersonId = document.getElementById('newName').dataset.existingPersonId;
        let personId;
        if (existingPersonId) {
            personId = existingPersonId;
        } else {
            personId = await createPerson(currentUser.uid, personName);
            // Save relationship if provided (only for new people)
            if (relationship) {
                await updatePerson(personId, { relationship: relationship });
            }
        }
        
        await createDateBasedReminder(personId, {
            occasion: occasion,
            customOccasionName: occasion === 'custom' ? customOccasionName : null,
            date: occasionDate,
            notes: notes
        });
        // Note: if this person has an active Just Because reminder,
        // createDateBasedReminder automatically re-checks its date
        // against this new reminder and shifts it forward if needed.
        
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
// HANDLE JUST BECAUSE FORM SUBMIT
// ============================================================

async function handleJustBecauseFormSubmit(e) {
    e.preventDefault();
    
    if (currentUserTier === 'free' || currentUserTier === 'discover') {
        alert('Just Because reminders require Curate tier. Please upgrade to enable this.');
        return;
    }
    
    const personId = document.getElementById('jbPersonSelect').value;
    if (!personId) {
        alert('Please select who this Just Because reminder is for.');
        return;
    }
    
    const frequencyRadio = document.querySelector('input[name="jbModalFrequency"]:checked');
    const frequency = frequencyRadio ? frequencyRadio.value : 'every_6_weeks';
    
    const submitBtn = document.getElementById('submitJustBecauseBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Setting up...';
    
    try {
        await createJustBecauseReminder(personId, {
            frequency: frequency,
            smsEnabled: currentUserTier !== 'free'
        });
        
        document.getElementById('justBecauseModal').classList.add('hidden');
        resetJustBecauseForm();
        loadDashboard();
        
    } catch (error) {
        console.error('Error setting up Just Because reminder:', error);
        alert('Error setting up Just Because reminder. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Set up Just Because';
    }
}

// ============================================================
// HANDLE EDIT REMINDER
// ============================================================

async function handleEditReminder(e) {
    const personId = e.target.dataset.personId;
    const reminderId = e.target.dataset.reminderId;
    
    try {
        const reminders = await getRemindersForPerson(personId);
        const reminder = reminders.find(function(r) { return r.id === reminderId; });
        
        if (!reminder) {
            alert('Reminder not found');
            return;
        }
        
        if (reminder.reminderType === 'just-because') {
            document.getElementById('editJBReminderId').value = reminderId;
            document.getElementById('editJBPersonId').value = personId;
            document.getElementById('editJBFrequency').value = reminder.frequency || 'every_6_weeks';
            
            document.getElementById('editJustBecauseModal').classList.remove('hidden');
            return;
        }
        
        // Date-based reminder
        const people = await getPeopleForUser(currentUser.uid);
        const person = people.find(function(p) { return p.id === personId; });
        
        document.getElementById('editReminderId').value = reminderId;
        document.getElementById('editPersonId').value = personId;
        document.getElementById('editName').value = person ? person.personName : '';
        document.getElementById('editOccasion').value = reminder.occasion || 'birthday';
        document.getElementById('editDate').value = reminder.date || '';
        document.getElementById('editNotes').value = reminder.notes || '';
        
        if (reminder.occasion === 'custom') {
            document.getElementById('editCustomOccasion').classList.remove('hidden');
            document.getElementById('editCustomOccasionName').value = reminder.customOccasionName || '';
        } else {
            document.getElementById('editCustomOccasion').classList.add('hidden');
        }
        
        document.getElementById('editReminderModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading reminder for edit:', error);
        alert('Error loading reminder. Please try again.');
    }
}

// ============================================================
// HANDLE EDIT SUBMIT (DATE-BASED REMINDERS)
// ============================================================

async function handleEditSubmit(e) {
    e.preventDefault();
    
    const reminderId = document.getElementById('editReminderId').value;
    const personId = document.getElementById('editPersonId').value;
    const personName = document.getElementById('editName').value.trim();
    
    try {
        await updatePerson(personId, { personName: personName });
        
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
        
        document.getElementById('editReminderModal').classList.add('hidden');
        loadDashboard();
        
    } catch (error) {
        console.error('Error updating reminder:', error);
        alert('Error updating reminder. Please try again.');
    }
}

// ============================================================
// HANDLE EDIT JUST BECAUSE SUBMIT
// ============================================================

async function handleEditJustBecauseSubmit(e) {
    e.preventDefault();
    
    const reminderId = document.getElementById('editJBReminderId').value;
    const personId = document.getElementById('editJBPersonId').value;
    const frequency = document.getElementById('editJBFrequency').value;
    
    try {
        // Recalculate the next date for the new frequency, anchored
        // from today, applying the same conflict-avoidance as creation.
        const nextDate = await calculateNextJustBecauseDate(personId, frequency, new Date());
        
        await updateReminder(personId, reminderId, {
            frequency: frequency,
            nextReminderDate: formatDate(nextDate)
        });
        
        document.getElementById('editJustBecauseModal').classList.add('hidden');
        loadDashboard();
        
    } catch (error) {
        console.error('Error updating Just Because reminder:', error);
        alert('Error updating reminder. Please try again.');
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
    document.getElementById('newCustomOccasion').classList.add('hidden');
    
    // Clear readonly and existing person tracking
    document.getElementById('newName').readOnly = false;
    delete document.getElementById('newName').dataset.existingPersonId;
}

function resetJustBecauseForm() {
    const form = document.getElementById('justBecauseForm');
    if (form) form.reset();
    
    delete document.getElementById('jbPersonSelect').dataset.locked;
    document.getElementById('jbPersonSelect').disabled = false;
    
    const defaultRadio = document.querySelector('input[name="jbModalFrequency"][value="every_6_weeks"]');
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
