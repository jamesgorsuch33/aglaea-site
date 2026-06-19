// ============================================================
// SIGNUP FLOW - With Inline Validation + Loading States
// Step 1: Account Details
// Step 2: First Reminder
// ============================================================

import { auth } from './firebase-config-v2.js';
import { 
    createUserWithEmailAndPassword,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    createOrUpdateUser,
    createPerson,
    createDateBasedReminder
} from './firebase-config-v2.js';

import {
    showFieldError,
    clearFieldError,
    clearAllErrors,
    validateEmail,
    validatePassword,
    validateRequired,
    validatePhone,
    validateFutureDate,
    setButtonLoading,
    resetButton,
    setupFieldValidation
} from './form-validation.js';

// ============================================================
// STEP NAVIGATION
// ============================================================

function showStep(step) {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const successStep = document.getElementById('successStep');
    
    if (step1) step1.classList.toggle('hidden', step !== 1);
    if (step2) step2.classList.toggle('hidden', step !== 2);
    if (successStep) successStep.classList.add('hidden');
    
    // Update progress indicator
    const progressSteps = document.querySelectorAll('.progress-step');
    progressSteps.forEach(function(progressStep) {
        const stepNum = parseInt(progressStep.dataset.step);
        progressStep.classList.toggle('active', stepNum === step);
        progressStep.classList.toggle('completed', stepNum < step);
    });
    
    window.scrollTo(0, 0);
}

// ============================================================
// STEP 1 - REAL-TIME VALIDATION
// ============================================================

// Set up real-time validation for all step 1 fields
setupFieldValidation('firstName', function(value) {
    return validateRequired(value, 'First name');
});

setupFieldValidation('lastName', function(value) {
    return validateRequired(value, 'Last name');
});

setupFieldValidation('email', function(value) {
    return validateEmail(value);
});

setupFieldValidation('password', function(value) {
    return validatePassword(value);
});

setupFieldValidation('phone', function(value) {
    return validatePhone(value);
});

// ============================================================
// STEP 1 - ACCOUNT DETAILS FORM SUBMIT
// ============================================================

const accountForm = document.getElementById('accountForm');
if (accountForm) {
    accountForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Clear previous errors
        clearAllErrors('accountForm');
        
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
        
        let hasErrors = false;
        
        // Validate each field
        const firstNameCheck = validateRequired(firstName, 'First name');
        if (!firstNameCheck.valid) {
            showFieldError('firstName', firstNameCheck.message);
            hasErrors = true;
        }
        
        const lastNameCheck = validateRequired(lastName, 'Last name');
        if (!lastNameCheck.valid) {
            showFieldError('lastName', lastNameCheck.message);
            hasErrors = true;
        }
        
        const emailCheck = validateEmail(email);
        if (!emailCheck.valid) {
            showFieldError('email', emailCheck.message);
            hasErrors = true;
        }
        
        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            showFieldError('password', passwordCheck.message);
            hasErrors = true;
        }
        
        if (phone) {
            const phoneCheck = validatePhone(phone);
            if (!phoneCheck.valid) {
                showFieldError('phone', phoneCheck.message);
                hasErrors = true;
            }
        }
        
        if (hasErrors) {
            // Scroll to first error
            const firstError = document.querySelector('.field-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
            return;
        }
        
        // Store data for Step 2
        window.signupData = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password,
            phone: phone
        };
        
        // Move to Step 2
        showStep(2);
    });
}

// ============================================================
// STEP 2 - REAL-TIME VALIDATION
// ============================================================

setupFieldValidation('name1', function(value) {
    return validateRequired(value, 'Name');
});

setupFieldValidation('date1', function(value) {
    return validateFutureDate(value, true);
});

// ============================================================
// RELATIONSHIP DROPDOWN HANDLER
// ============================================================

const relationshipSelect = document.getElementById('signupRelationship');
if (relationshipSelect) {
    relationshipSelect.addEventListener('change', function(e) {
        clearFieldError('signupRelationship');
        
        const customGroup = document.getElementById('signupCustomRelationship');
        if (customGroup) {
            if (e.target.value === 'Other') {
                customGroup.classList.remove('hidden');
            } else {
                customGroup.classList.add('hidden');
            }
        }
    });
}

// ============================================================
// OCCASION DROPDOWN HANDLER (custom occasion)
// ============================================================

const occasionSelect = document.getElementById('occasion1');
if (occasionSelect) {
    occasionSelect.addEventListener('change', function(e) {
        clearFieldError('occasion1');
        
        const customInput = document.getElementById('customOccasion1');
        if (customInput) {
            if (e.target.value === 'other') {
                customInput.classList.remove('hidden');
                customInput.required = true;
            } else {
                customInput.classList.add('hidden');
                customInput.required = false;
                clearFieldError('customOccasion1');
            }
        }
    });
}

// ============================================================
// STEP 2 - CREATE ACCOUNT + FIRST REMINDER
// ============================================================

const remindersForm = document.getElementById('remindersForm');
if (remindersForm) {
    remindersForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        clearAllErrors('remindersForm');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const btnId = submitBtn.id || 'createAccountBtn';
        if (!submitBtn.id) submitBtn.id = btnId;
        
        // Get values
        const personName = document.getElementById('name1').value.trim();
        const relationshipValue = relationshipSelect ? relationshipSelect.value : '';
        const customRelationshipInput = document.getElementById('signupCustomRelationshipName');
        const customRelationship = customRelationshipInput ? customRelationshipInput.value.trim() : '';
        const relationship = relationshipValue === 'Other' ? customRelationship : relationshipValue;
        
        const occasion = document.getElementById('occasion1').value;
        const customOccasionInput = document.getElementById('customOccasion1');
        const customOccasionName = customOccasionInput ? customOccasionInput.value.trim() : '';
        const occasionDate = document.getElementById('date1').value;
        
        let hasErrors = false;
        
        // Validate person name
        const nameCheck = validateRequired(personName, 'Name');
        if (!nameCheck.valid) {
            showFieldError('name1', nameCheck.message);
            hasErrors = true;
        }
        
        // Validate relationship
        if (!relationshipValue) {
            showFieldError('signupRelationship', 'Please select a relationship');
            hasErrors = true;
        } else if (relationshipValue === 'Other' && !customRelationship) {
            showFieldError('signupCustomRelationshipName', 'Please specify the relationship');
            hasErrors = true;
        }
        
        // Validate occasion
        if (!occasion) {
            showFieldError('occasion1', 'Please select an occasion');
            hasErrors = true;
        } else if (occasion === 'other' && !customOccasionName) {
            showFieldError('customOccasion1', 'Please specify the occasion');
            hasErrors = true;
        }
        
        // Validate date
        const dateCheck = validateFutureDate(occasionDate, true);
        if (!dateCheck.valid) {
            showFieldError('date1', dateCheck.message);
            hasErrors = true;
        }
        
        if (hasErrors) {
            const firstError = document.querySelector('.field-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
            return;
        }
        
        // Get account data from Step 1
        const accountData = window.signupData;
        
        if (!accountData) {
            alert('Account details missing. Please go back to Step 1.');
            showStep(1);
            return;
        }
        
        // Set loading state
        setButtonLoading(btnId, 'Creating your account...');
        
        try {
            // Step A: Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(
                auth, 
                accountData.email, 
                accountData.password
            );
            const user = userCredential.user;
            
            // Step B: Update display name in Auth
            await updateProfile(user, {
                displayName: accountData.firstName + ' ' + accountData.lastName
            });
            
            // Step C: Create user document in Firestore
            await createOrUpdateUser(user.uid, {
                firstName: accountData.firstName,
                lastName: accountData.lastName,
                email: accountData.email,
                phone: accountData.phone || '',
                tier: 'free',
                createdAt: new Date().toISOString()
            });
            
            // Step D: Create the person (recipient)
            const personId = await createPerson(user.uid, personName, relationship);
            
            // Step E: Create the date-based reminder
            const occasionType = occasion === 'other' ? 'custom' : occasion;
            
            await createDateBasedReminder(personId, {
                occasion: occasionType,
                customOccasionName: occasion === 'other' ? customOccasionName : null,
                date: occasionDate,
                notes: ''
            });
            
            // Step F: Send welcome email (await to ensure it sends before redirect)
            await sendWelcomeEmail(accountData.email, accountData.firstName);
            
            // Success! Redirect to dashboard
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            console.error('Signup error:', error);
            
            resetButton(btnId);
            
            // Show error on appropriate field
            if (error.code === 'auth/email-already-in-use') {
                showStep(1);
                setTimeout(function() {
                    showFieldError('email', 'An account with this email already exists. Please sign in instead.');
                    document.getElementById('email').focus();
                }, 100);
            } else if (error.code === 'auth/invalid-email') {
                showStep(1);
                setTimeout(function() {
                    showFieldError('email', 'Please enter a valid email address');
                    document.getElementById('email').focus();
                }, 100);
            } else if (error.code === 'auth/weak-password') {
                showStep(1);
                setTimeout(function() {
                    showFieldError('password', 'Password is too weak. Please use at least 6 characters');
                    document.getElementById('password').focus();
                }, 100);
            } else if (error.code === 'auth/network-request-failed') {
                alert('Network error. Please check your connection and try again.');
            } else {
                alert('Error creating account. Please try again or contact support.');
            }
        }
    });
}

// ============================================================
// BACK BUTTON (Step 2 to Step 1)
// ============================================================

const backBtn = document.getElementById('backBtn');
if (backBtn) {
    backBtn.addEventListener('click', function() {
        showStep(1);
    });
}

// ============================================================
// SEND WELCOME EMAIL
// Awaited - but never blocks signup if it fails
// ============================================================

async function sendWelcomeEmail(email, firstName) {
    try {
        const response = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emailType: 'welcome',
                to: email,
                data: { firstName: firstName }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Welcome email sent successfully');
        } else {
            console.warn('Welcome email failed (non-blocking):', result);
        }
        
    } catch (error) {
        // Email failure should never block signup completion
        console.error('Welcome email error (non-blocking):', error);
    }
    
    // Always resolve - email is not critical to signup success
    return true;
}
