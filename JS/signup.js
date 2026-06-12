// ============================================================
// SIGNUP FLOW - Two Step Process
// Matches signup.html actual structure
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
// STEP 1 - ACCOUNT DETAILS FORM
// ============================================================

const accountForm = document.getElementById('accountForm');
if (accountForm) {
    accountForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
        
        // Validation
        if (!firstName || !lastName || !email || !password) {
            alert('Please fill in all required fields.');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters.');
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
// RELATIONSHIP DROPDOWN HANDLER
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
// OCCASION DROPDOWN HANDLER (custom occasion)
// ============================================================

const occasionSelect = document.getElementById('occasion1');
if (occasionSelect) {
    occasionSelect.addEventListener('change', function(e) {
        const customInput = document.getElementById('customOccasion1');
        if (customInput) {
            if (e.target.value === 'other') {
                customInput.classList.remove('hidden');
                customInput.required = true;
            } else {
                customInput.classList.add('hidden');
                customInput.required = false;
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
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating your account...';
        
        try {
            // Get reminder details
            const personName = document.getElementById('name1').value.trim();
            const relationshipValue = relationshipSelect ? relationshipSelect.value : '';
            const customRelationshipInput = document.getElementById('signupCustomRelationshipName');
            const customRelationship = customRelationshipInput ? customRelationshipInput.value.trim() : '';
            const relationship = relationshipValue === 'Other' ? customRelationship : relationshipValue;
            
            const occasion = document.getElementById('occasion1').value;
            const customOccasionInput = document.getElementById('customOccasion1');
            const customOccasionName = customOccasionInput ? customOccasionInput.value.trim() : '';
            const occasionDate = document.getElementById('date1').value;
            
            // Validate
            if (!personName || !occasion || !occasionDate) {
                alert('Please fill in all required fields.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }
            
            if (!relationship) {
                alert('Please select a relationship.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }
            
            if (occasion === 'other' && !customOccasionName) {
                alert('Please specify the occasion name.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }
            
            // Get account data from Step 1
            const accountData = window.signupData;
            
            if (!accountData) {
                alert('Account details missing. Please go back to Step 1.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
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
                phone: accountData.phone || '',
                tier: 'free',
                createdAt: new Date().toISOString()
            });
            
            // Step D: Create the person (recipient)
            const personId = await createPerson(user.uid, personName, relationship);
            
            // Step E: Create the date-based reminder
            // Map 'other' occasion to 'custom' for consistency with dashboard
            const occasionType = occasion === 'other' ? 'custom' : occasion;
            
            await createDateBasedReminder(personId, {
                occasion: occasionType,
                customOccasionName: occasion === 'other' ? customOccasionName : null,
                date: occasionDate,
                notes: ''
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
            submitBtn.textContent = originalBtnText;
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
