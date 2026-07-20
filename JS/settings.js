// ============================================================
// SETTINGS PAGE LOGIC
// Profile, Security, Subscription, Account Deletion
// ============================================================

import { 
    getUser,
    createOrUpdateUser
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
    const subscriptionStatus = currentUserData.subscriptionStatus || null;
    
    // Hide all sections first
    document.getElementById('freeUserSection').classList.add('hidden');
    document.getElementById('essentialUserSection').classList.add('hidden');
    document.getElementById('cancellationPendingSection').classList.add('hidden');
    
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
        
        // Check if cancellation is pending
        if (subscriptionStatus === 'cancelling' && currentUserData.cancellationDate) {
            const cancelDate = new Date(currentUserData.cancellationDate);
            const cancelDateStr = cancelDate.toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
            
            document.getElementById('nextBillingDate').textContent = 'Cancelling on ' + cancelDateStr;
            document.getElementById('cancellationDate').textContent = 
                'Your Curate plan will end on ' + cancelDateStr;
            document.getElementById('cancellationPendingSection').classList.remove('hidden');
        } else {
            // Active subscription
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
        }
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
    document.getElementById('confirmCancelBtn').addEventListener('click', handleCancelSubscription);
    
    // Reactivate subscription
    const reactivateBtn = document.getElementById('reactivateSubscriptionBtn');
    if (reactivateBtn) {
        reactivateBtn.addEventListener('click', handleReactivateSubscription);
    }
    
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

async function handleCancelSubscription() {
    const confirmBtn = document.getElementById('confirmCancelBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Cancelling...';
    
    try {
        // NOTE: this currently cancels immediately with no reminder-keeping
        // step. The "pick 5 reminders to keep" flow is a separate piece
        // still to be wired in — once built, that picker will run first
        // and pass its selection through as keepReminderIds below.
        const response = await fetch('/.netlify/functions/cancel-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                subscriptionId: currentUserData.subscriptionId
                // keepReminderIds: [...]  // TODO: wire in once picker modal exists
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to cancel subscription');
        }
        
        const result = await response.json();
        
        // Close modal
        document.getElementById('cancelSubscriptionModal').classList.add('hidden');
        
        // Reload data to show updated status
        await loadUserData();
        
        alert('Your Curate subscription has ended and your account is now on the Discover plan. Your reminders and their data are still saved, and everything picks back up if you upgrade again.');
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        alert('Error cancelling subscription. Please try again or contact support.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Cancel Subscription';
    }
}

// ============================================================
// HANDLE REACTIVATE SUBSCRIPTION
// Revolut subscriptions can't be un-cancelled once ended — this
// sends the member back through the normal upgrade/checkout flow
// to start a fresh subscription, rather than resuming the old one.
// ============================================================

function handleReactivateSubscription() {
    window.location.href = 'upgrade.html';
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
