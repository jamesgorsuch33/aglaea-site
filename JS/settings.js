// ============================================================
// SETTINGS PAGE LOGIC
// Profile, Security, Subscription, Account Deletion
// ============================================================

import { 
    getUser,
    createOrUpdateUser,
    getPeopleForUser,
    getRemindersForPerson
} from './firebase-config-v2.js';

import { 
    updateEmail,
    updatePassword,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const auth = window.firebaseAuth;

let currentUser = null;
let currentUserData = null;

// ============================================================
// INITIALIZATION
// ============================================================

auth.onAuthStateChanged(async function(user) {
    if (user) {
        currentUser = user;
        await loadUserData();
        setupEventListeners();
    } else {
        window.location.href = 'signin.html';
    }
});

// ============================================================
// LOAD USER DATA
// ============================================================

async function loadUserData() {
    try {
        currentUserData = await getUser(currentUser.uid);
        
        if (!currentUserData) {
            console.error('User document not found');
            return;
        }
        
        // Populate profile fields
        document.getElementById('settingsFirstName').value = currentUserData.firstName || '';
        document.getElementById('settingsLastName').value = currentUserData.lastName || '';
        document.getElementById('settingsEmail').value = currentUser.email || '';
        document.getElementById('settingsPhone').value = currentUserData.phone || '';
        
        // Populate subscription details
        displaySubscriptionDetails();
        
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Error loading your settings. Please refresh the page.');
    }
}

// ============================================================
// DISPLAY SUBSCRIPTION DETAILS
// ============================================================

function displaySubscriptionDetails() {
    const tier = currentUserData.tier || 'discover';
    
    // Hide all sections first
    document.getElementById('freeUserSection').classList.add('hidden');
    document.getElementById('essentialUserSection').classList.add('hidden');
    
    if (tier === 'discover') {
        // Show free/Discover user upgrade options
        document.getElementById('currentPlan').textContent = 'Discover';
        document.getElementById('billingRow').classList.add('hidden');
        document.getElementById('nextBillingRow').classList.add('hidden');
        document.getElementById('freeUserSection').classList.remove('hidden');
        
    } else if (tier === 'curate' || tier === 'essential') {
        document.getElementById('currentPlan').textContent = 'Curate';
        document.getElementById('billingRow').classList.remove('hidden');
        document.getElementById('nextBillingRow').classList.remove('hidden');
        document.getElementById('billingAmount').textContent = '£4.99/month';
        
        if (currentUserData.nextBillingDate) {
            const nextDate = new Date(currentUserData.nextBillingDate);
            document.getElementById('nextBillingDate').textContent = 
                nextDate.toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                });
        } else {
            document.getElementById('nextBillingDate').textContent = 'Active';
        }
        document.getElementById('essentialUserSection').classList.remove('hidden');
        
    } else {
        // Unrecognised tier value — fail visibly rather than leaving
        // the card stuck on "Loading..." forever with no explanation
        document.getElementById('currentPlan').textContent = 'Unknown';
        console.error(`Unrecognised tier value: "${tier}"`);
    }
}

// ============================================================
// SETUP EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // Profile form
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    
    // Password form
    document.getElementById('passwordForm').addEventListener('submit', handlePasswordUpdate);
    
    // Cancel subscription
    document.getElementById('cancelSubscriptionBtn').addEventListener('click', function() {
        showCancelSubscriptionModal();
    });
    document.getElementById('confirmCancelBtn').addEventListener('click', handleCancelConfirm);
    document.getElementById('confirmReminderSelectionBtn').addEventListener('click', handleReminderSelectionConfirm);
    
    // Delete account
    document.getElementById('deleteAccountBtn').addEventListener('click', function() {
        document.getElementById('deleteAccountModal').classList.remove('hidden');
        document.getElementById('deleteConfirmInput').value = '';
        document.getElementById('confirmDeleteBtn').disabled = true;
    });
    
    document.getElementById('deleteConfirmInput').addEventListener('input', function(e) {
        document.getElementById('confirmDeleteBtn').disabled = e.target.value.trim() !== 'DELETE';
    });
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', handleDeleteAccount);
    
    // Modal close handlers
    document.querySelectorAll('.modal-close').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modalId = btn.dataset.modal;
            if (modalId) {
                document.getElementById(modalId).classList.add('hidden');
            }
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

// ============================================================
// HANDLE PROFILE UPDATE
// ============================================================

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveProfileBtn');
    const successMsg = document.getElementById('profileSuccess');
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    successMsg.classList.add('hidden');
    
    try {
        const firstName = document.getElementById('settingsFirstName').value.trim();
        const lastName = document.getElementById('settingsLastName').value.trim();
        const email = document.getElementById('settingsEmail').value.trim();
        const phone = document.getElementById('settingsPhone').value.trim();
        
        // Update email in Firebase Auth if changed
        if (email !== currentUser.email) {
            await updateEmail(currentUser, email);
        }
        
        // Update Firestore user document
        await createOrUpdateUser(currentUser.uid, {
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: phone
        });
        
        // Update local data
        currentUserData.firstName = firstName;
        currentUserData.lastName = lastName;
        currentUserData.email = email;
        currentUserData.phone = phone;
        
        // Show success
        successMsg.classList.remove('hidden');
        setTimeout(function() {
            successMsg.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        
        let message = 'Error updating profile. Please try again.';
        if (error.code === 'auth/requires-recent-login') {
            message = 'For security reasons, please sign out and sign back in before changing your email.';
        } else if (error.code === 'auth/email-already-in-use') {
            message = 'This email is already in use by another account.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Please enter a valid email address.';
        }
        
        alert(message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

// ============================================================
// HANDLE PASSWORD UPDATE
// ============================================================

async function handlePasswordUpdate(e) {
    e.preventDefault();
    
    const updateBtn = document.getElementById('updatePasswordBtn');
    const successMsg = document.getElementById('passwordSuccess');
    
    const newPassword = document.getElementById('settingsNewPassword').value;
    const confirmPassword = document.getElementById('settingsConfirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        alert('Passwords do not match. Please try again.');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }
    
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';
    successMsg.classList.add('hidden');
    
    try {
        await updatePassword(currentUser, newPassword);
        
        // Clear fields
        document.getElementById('settingsNewPassword').value = '';
        document.getElementById('settingsConfirmPassword').value = '';
        
        // Show success
        successMsg.classList.remove('hidden');
        setTimeout(function() {
            successMsg.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('Error updating password:', error);
        
        let message = 'Error updating password. Please try again.';
        if (error.code === 'auth/requires-recent-login') {
            message = 'For security reasons, please sign out and sign back in before changing your password.';
        } else if (error.code === 'auth/weak-password') {
            message = 'Password is too weak. Please use a stronger password.';
        }
        
        alert(message);
    } finally {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update Password';
    }
}

// ============================================================
// HANDLE CANCEL SUBSCRIPTION
// ============================================================

function showCancelSubscriptionModal() {
    document.getElementById('cancelSubscriptionModal').classList.remove('hidden');
}

// Fetch every date-based reminder across all of this user's people —
// this is what decides whether the picker is needed at all, and what
// populates it if so.
async function fetchAllDateBasedReminders() {
    const people = await getPeopleForUser(currentUser.uid);
    const allReminders = [];
    
    for (const person of people) {
        const reminders = await getRemindersForPerson(person.id);
        reminders
            .filter(r => r.reminderType === 'date-based' && !r.paused)
            .forEach(r => allReminders.push({ ...r, personName: person.personName }));
    }
    
    return allReminders;
}

// Runs when "Yes, Cancel Subscription" is clicked on the initial warning
// modal. Decides whether the picker is actually needed — no point making
// someone choose 5 out of 5 or fewer.
async function handleCancelConfirm() {
    const confirmBtn = document.getElementById('confirmCancelBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Checking your reminders...';
    
    try {
        const reminders = await fetchAllDateBasedReminders();
        
        document.getElementById('cancelSubscriptionModal').classList.add('hidden');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Cancel Subscription';
        
        if (reminders.length <= 5) {
            // Already at or under the Discover cap — nothing to choose,
            // keep everything as-is.
            await performCancellation(reminders.map(r => r.id));
        } else {
            showReminderPicker(reminders);
        }
        
    } catch (error) {
        console.error('Error checking reminders before cancellation:', error);
        alert('Error checking your reminders. Please try again.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Cancel Subscription';
    }
}

// Populate and show the "choose 5 reminders to keep" picker.
function showReminderPicker(reminders) {
    const list = document.getElementById('reminderPickerList');
    list.innerHTML = '';
    
    reminders.forEach(reminder => {
        const label = document.createElement('label');
        label.className = 'reminder-picker-item';
        
        const dateStr = reminder.date
            ? new Date(reminder.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
            : '';
        
        label.innerHTML = `
            <input type="checkbox" class="reminder-picker-checkbox" data-reminder-id="${reminder.id}">
            <div class="reminder-picker-info">
                <div class="reminder-picker-name">${escapeHtml(reminder.personName)}</div>
                <div class="reminder-picker-meta">${escapeHtml(reminder.occasion || '')}${dateStr ? ' · ' + dateStr : ''}</div>
            </div>
        `;
        list.appendChild(label);
    });
    
    document.querySelectorAll('.reminder-picker-checkbox').forEach(cb => {
        cb.addEventListener('change', updateReminderPickerState);
    });
    
    updateReminderPickerState();
    document.getElementById('selectRemindersModal').classList.remove('hidden');
}

// Caps selection at 5 (disables further checkboxes once 5 are checked)
// and keeps the count text + confirm button in sync.
function updateReminderPickerState() {
    const checkboxes = Array.from(document.querySelectorAll('.reminder-picker-checkbox'));
    const checkedCount = checkboxes.filter(cb => cb.checked).length;
    
    checkboxes.forEach(cb => {
        if (!cb.checked) {
            cb.disabled = checkedCount >= 5;
        }
    });
    
    document.getElementById('reminderPickerCount').textContent = `${checkedCount} of 5 selected`;
    document.getElementById('confirmReminderSelectionBtn').disabled = checkedCount === 0;
}

async function handleReminderSelectionConfirm() {
    const keepReminderIds = Array.from(document.querySelectorAll('.reminder-picker-checkbox'))
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.reminderId);
    
    document.getElementById('selectRemindersModal').classList.add('hidden');
    await performCancellation(keepReminderIds);
}

// The actual cancellation call — shared by both the "already under 5"
// direct path and the picker-confirmed path.
async function performCancellation(keepReminderIds) {
    try {
        const response = await fetch('/.netlify/functions/cancel-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                subscriptionId: currentUserData.revolutSubscriptionId,
                keepReminderIds: keepReminderIds
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to cancel subscription');
        }
        
        const result = await response.json();
        
        // Reload data to show updated status
        await loadUserData();
        
        const pausedNote = result.remindersPaused > 0
            ? ` ${result.remindersPaused} other reminder${result.remindersPaused === 1 ? '' : 's'} ${result.remindersPaused === 1 ? 'has' : 'have'} been paused and will pick back up if you upgrade again.`
            : '';
        
        alert(`Your Curate subscription has ended and your account is now on the Discover plan.${pausedNote}`);
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        alert('Error cancelling subscription. Please try again or contact support.');
    }
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ============================================================
// HANDLE DELETE ACCOUNT
// ============================================================

async function handleDeleteAccount() {
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';
    
    try {
        // Call Netlify function to delete account (handles Revolut + Firestore cleanup)
        const response = await fetch('/.netlify/functions/delete-account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete account data');
        }
        
        // Delete Firebase Auth user (must be done from client)
        await deleteUser(currentUser);
        
        alert('Your account has been deleted. We are sorry to see you go.');
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Error deleting account:', error);
        
        let message = 'Error deleting account. Please try again or contact support.';
        if (error.code === 'auth/requires-recent-login') {
            message = 'For security, please sign out and sign back in, then try deleting your account.';
        }
        
        alert(message);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete My Account Permanently';
    }
}
