// ============================================================
// SETTINGS PAGE LOGIC - With Inline Validation + Loading States
// Profile, Security, Subscription, Account Deletion
// ============================================================

import { 
    getUser,
    createOrUpdateUser,
    updateUserTier,
    updateUserStripeInfo
} from './firebase-config-v2.js';

import { 
    updateEmail,
    updatePassword,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    showFieldError,
    clearFieldError,
    clearAllErrors,
    validateEmail,
    validatePassword,
    validateRequired,
    validatePhone,
    setButtonLoading,
    resetButton,
    setupFieldValidation,
    setupPasswordMatchValidation,
    showSuccess
} from './form-validation.js';

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
        setupValidation();
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
    const tier = currentUserData.tier || 'free';
    const subscriptionStatus = currentUserData.subscriptionStatus || null;
    
    document.getElementById('freeUserSection').classList.add('hidden');
    document.getElementById('essentialUserSection').classList.add('hidden');
    document.getElementById('cancellationPendingSection').classList.add('hidden');
    
    if (tier === 'free') {
        document.getElementById('currentPlan').textContent = 'Free';
        document.getElementById('billingRow').classList.add('hidden');
        document.getElementById('nextBillingRow').classList.add('hidden');
        document.getElementById('freeUserSection').classList.remove('hidden');
        
    } else if (tier === 'essential') {
        document.getElementById('currentPlan').textContent = 'Essential';
        document.getElementById('billingRow').classList.remove('hidden');
        document.getElementById('nextBillingRow').classList.remove('hidden');
        document.getElementById('billingAmount').textContent = '£4.99/month';
        
        if (subscriptionStatus === 'cancelling' && currentUserData.cancellationDate) {
            const cancelDate = new Date(currentUserData.cancellationDate);
            const cancelDateStr = cancelDate.toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
            
            document.getElementById('nextBillingDate').textContent = 'Cancelling on ' + cancelDateStr;
            document.getElementById('cancellationDate').textContent = 
                'Your Essential plan will end on ' + cancelDateStr;
            document.getElementById('cancellationPendingSection').classList.remove('hidden');
        } else {
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
    }
}

// ============================================================
// SETUP REAL-TIME VALIDATION
// ============================================================

function setupValidation() {
    // Profile form validation
    setupFieldValidation('settingsFirstName', function(value) {
        return validateRequired(value, 'First name');
    });
    
    setupFieldValidation('settingsLastName', function(value) {
        return validateRequired(value, 'Last name');
    });
    
    setupFieldValidation('settingsEmail', function(value) {
        return validateEmail(value);
    });
    
    setupFieldValidation('settingsPhone', function(value) {
        return validatePhone(value);
    });
    
    // Password form validation
    setupFieldValidation('settingsNewPassword', function(value) {
        return validatePassword(value);
    });
    
    // Password match validation
    setupPasswordMatchValidation('settingsNewPassword', 'settingsConfirmPassword');
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
    
    // Clear previous errors
    clearAllErrors('profileForm');
    
    const firstName = document.getElementById('settingsFirstName').value.trim();
    const lastName = document.getElementById('settingsLastName').value.trim();
    const email = document.getElementById('settingsEmail').value.trim();
    const phone = document.getElementById('settingsPhone').value.trim();
    
    let hasErrors = false;
    
    // Validate
    const firstNameCheck = validateRequired(firstName, 'First name');
    if (!firstNameCheck.valid) {
        showFieldError('settingsFirstName', firstNameCheck.message);
        hasErrors = true;
    }
    
    const lastNameCheck = validateRequired(lastName, 'Last name');
    if (!lastNameCheck.valid) {
        showFieldError('settingsLastName', lastNameCheck.message);
        hasErrors = true;
    }
    
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
        showFieldError('settingsEmail', emailCheck.message);
        hasErrors = true;
    }
    
    if (phone) {
        const phoneCheck = validatePhone(phone);
        if (!phoneCheck.valid) {
            showFieldError('settingsPhone', phoneCheck.message);
            hasErrors = true;
        }
    }
    
    if (hasErrors) {
        return;
    }
    
    // Set loading state
    setButtonLoading('saveProfileBtn', 'Saving...');
    
    try {
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
        resetButton('saveProfileBtn');
        showSuccess('profileSuccess', 'Saved successfully');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        
        resetButton('saveProfileBtn');
        
        if (error.code === 'auth/requires-recent-login') {
            showFieldError('settingsEmail', 'For security, please sign out and sign back in before changing your email.');
        } else if (error.code === 'auth/email-already-in-use') {
            showFieldError('settingsEmail', 'This email is already in use by another account.');
        } else if (error.code === 'auth/invalid-email') {
            showFieldError('settingsEmail', 'Please enter a valid email address.');
        } else {
            alert('Error updating profile. Please try again.');
        }
    }
}

// ============================================================
// HANDLE PASSWORD UPDATE
// ============================================================

async function handlePasswordUpdate(e) {
    e.preventDefault();
    
    // Clear previous errors
    clearAllErrors('passwordForm');
    
    const newPassword = document.getElementById('settingsNewPassword').value;
    const confirmPassword = document.getElementById('settingsConfirmPassword').value;
    
    let hasErrors = false;
    
    // Validate new password
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
        showFieldError('settingsNewPassword', passwordCheck.message);
        hasErrors = true;
    }
    
    // Check passwords match
    if (newPassword !== confirmPassword) {
        showFieldError('settingsConfirmPassword', 'Passwords do not match');
        hasErrors = true;
    }
    
    if (hasErrors) {
        return;
    }
    
    // Set loading state
    setButtonLoading('updatePasswordBtn', 'Updating...');
    
    try {
        await updatePassword(currentUser, newPassword);
        
        // Clear fields
        document.getElementById('settingsNewPassword').value = '';
        document.getElementById('settingsConfirmPassword').value = '';
        
        // Show success
        resetButton('updatePasswordBtn');
        showSuccess('passwordSuccess', 'Password updated');
        
    } catch (error) {
        console.error('Error updating password:', error);
        
        resetButton('updatePasswordBtn');
        
        if (error.code === 'auth/requires-recent-login') {
            showFieldError('settingsNewPassword', 'For security, please sign out and sign back in before changing your password.');
        } else if (error.code === 'auth/weak-password') {
            showFieldError('settingsNewPassword', 'Password is too weak. Please use a stronger password.');
        } else {
            alert('Error updating password. Please try again.');
        }
    }
}

// ============================================================
// HANDLE CANCEL SUBSCRIPTION
// ============================================================

function showCancelSubscriptionModal() {
    if (currentUserData.nextBillingDate) {
        const endDate = new Date(currentUserData.nextBillingDate);
        const endDateStr = endDate.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        document.getElementById('cancelEndDate').textContent = endDateStr;
    }
    
    document.getElementById('cancelSubscriptionModal').classList.remove('hidden');
}

async function handleCancelSubscription() {
    setButtonLoading('confirmCancelBtn', 'Cancelling...');
    
    try {
        const response = await fetch('/.netlify/functions/cancel-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                subscriptionId: currentUserData.subscriptionId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to cancel subscription');
        }
        
        // Close modal
        document.getElementById('cancelSubscriptionModal').classList.add('hidden');
        
        // Reload data
        await loadUserData();
        
        resetButton('confirmCancelBtn');
        
        alert('Your subscription has been cancelled. You will keep access until your billing period ends.');
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        resetButton('confirmCancelBtn');
        alert('Error cancelling subscription. Please try again or contact support.');
    }
}

// ============================================================
// HANDLE REACTIVATE SUBSCRIPTION
// ============================================================

async function handleReactivateSubscription() {
    setButtonLoading('reactivateSubscriptionBtn', 'Reactivating...');
    
    try {
        const response = await fetch('/.netlify/functions/reactivate-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                subscriptionId: currentUserData.subscriptionId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to reactivate subscription');
        }
        
        await loadUserData();
        
        resetButton('reactivateSubscriptionBtn');
        
        alert('Your subscription has been reactivated. Welcome back!');
        
    } catch (error) {
        console.error('Error reactivating subscription:', error);
        resetButton('reactivateSubscriptionBtn');
        alert('Error reactivating subscription. Please try again or contact support.');
    }
}

// ============================================================
// HANDLE DELETE ACCOUNT
// ============================================================

async function handleDeleteAccount() {
    setButtonLoading('confirmDeleteBtn', 'Deleting...');
    
    try {
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
        
        // Delete Firebase Auth user
        await deleteUser(currentUser);
        
        alert('Your account has been deleted. We are sorry to see you go.');
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Error deleting account:', error);
        
        resetButton('confirmDeleteBtn');
        
        if (error.code === 'auth/requires-recent-login') {
            alert('For security, please sign out and sign back in, then try deleting your account.');
        } else {
            alert('Error deleting account. Please try again or contact support.');
        }
    }
}
