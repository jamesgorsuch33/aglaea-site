// ============================================================
// SIGNUP FLOW - Two Step Process
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

// ============================================================
// STEP NAVIGATION
// ============================================================

let currentStep = 1;

function showStep(step) {
    document.getElementById('step1').classList.toggle('hidden', step !== 1);
    document.getElementById('step2').classList.toggle('hidden', step !== 2);
    
    // Update progress indicator if present
    const progress1 = document.getElementById('progress1');
    const progress2 = document.getElementById('progress2');
    
    if (progress1) {
        progress1.classList.toggle('active', step === 1);
        progress1.classList.toggle('completed', step > 1);
    }
    if (progress2) {
        progress2.classList.toggle('active', step === 2);
    }
    
    currentStep = step;
    window.scrollTo(0, 0);
}

// ============================================================
// STEP 1 - ACCOUNT DETAILS
// ============================================================

document.getElementById('step1Form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('signupFirstName').value.trim();
    const lastName = document.getElementById('signupLastName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    
    // Validation
    if (!firstName || !lastName || !email || !password) {
        alert('Please fill in all required fields.');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Passwords do not match.');
        return;
    }
    
    // Store data in form for Step 2 to use
    window.signupData = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password
    };
    
    // Move to Step 2
    showStep(2);
});

// ============================================================
// STEP 2 - RELATIONSHIP DROPDOWN HANDLER
// ============================================================

const relationshipSelect = document.getElementById('signupRelationship');
if (relationshipSelect) {
    relationshipSelect.addEventListener('change', function(e) {
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
// STEP 2 - OCCASION DROPDOWN HANDLER (for custom occasion)
// ============================================================

const occasionSelect = document.getElementById('signupOccasion');
if (occasionSelect) {
    occasionSelect.addEventListener('change', function(e) {
        const customGroup = document.getElementById('signupCustomOccasion');
        if (customGroup) {
            if (e.target.value === 'custom') {
                customGroup.classList.remove('hidden');
            } else {
                customGroup.classList.add('hidden');
            }
        }
    });
}

// ============================================================
// STEP 2 - CREATE ACCOUNT + FIRST REMINDER
// ============================================================

document.getElementById('step2Form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('createAccountBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating your account...';
    
    try {
        // Get reminder details
        const personName = document.getElementById('signupName').value.trim();
        const relationshipValue = relationshipSelect ? relationshipSelect.value : '';
        const customRelationship = document.getElementById('signupCustomRelationshipName') 
            ? document.getElementById('signupCustomRelationshipName').value.trim() 
            : '';
        const relationship = relationshipValue === 'Other' ? customRelationship : relationshipValue;
        
        const occasion = document.getElementById('signupOccasion').value;
        const customOccasionName = document.getElementById('signupCustomOccasionName')
            ? document.getElementById('signupCustomOccasionName').value.trim()
            : '';
        const occasionDate = document.getElementById('signupDate').value;
        const notes = document.getElementById('signupNotes') 
            ? document.getElementById('signupNotes').value.trim() 
            : '';
        
        // Validate
        if (!personName || !occasion || !occasionDate) {
            alert('Please fill in all required fields.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create My Account';
            return;
        }
        
        if (!relationship) {
            alert('Please select a relationship.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create My Account';
            return;
        }
        
        if (occasion === 'custom' && !customOccasionName) {
            alert('Please specify the custom occasion name.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create My Account';
            return;
        }
        
        // Get account data from Step 1
        const accountData = window.signupData;
        
        if (!accountData) {
            alert('Account details missing. Please go back to Step 1.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create My Account';
            showStep(1);
            return;
        }
        
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
            tier: 'free',
            createdAt: new Date().toISOString()
        });
        
        // Step D: Create the person (recipient)
        const personId = await createPerson(user.uid, personName, relationship);
        
        // Step E: Create the date-based reminder
        await createDateBasedReminder(personId, {
            occasion: occasion,
            customOccasionName: occasion === 'custom' ? customOccasionName : null,
            date: occasionDate,
            notes: notes
        });
        
        // Success! Redirect to dashboard
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        console.error('Signup error:', error);
        
        let message = 'Error creating account. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            message = 'An account with this email already exists. Please sign in instead.';
            showStep(1);
        } else if (error.code === 'auth/invalid-email') {
            message = 'Please enter a valid email address.';
            showStep(1);
        } else if (error.code === 'auth/weak-password') {
            message = 'Password is too weak. Please use at least 6 characters.';
            showStep(1);
        } else if (error.code === 'auth/network-request-failed') {
            message = 'Network error. Please check your connection and try again.';
        }
        
        alert(message);
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create My Account';
    }
});

// ============================================================
// BACK BUTTON (Step 2 to Step 1)
// ============================================================

const backBtn = document.getElementById('backToStep1');
if (backBtn) {
    backBtn.addEventListener('click', function() {
        showStep(1);
    });
}

// ============================================================
// INITIALIZE
// ============================================================

// Start at step 1
showStep(1);
