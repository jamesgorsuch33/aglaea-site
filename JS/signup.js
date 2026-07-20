/* ============================================================
   SIGNUP PAGE LOGIC
   ============================================================ */

// State
let currentStep = 1;
let isSubmitting = false;
let formData = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    reminder: null
};

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const successStep = document.getElementById('successStep');
const accountForm = document.getElementById('accountForm');
const remindersForm = document.getElementById('remindersForm');
const backBtn = document.getElementById('backBtn');
const progressSteps = document.querySelectorAll('.progress-step');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupOccasionListener();
});

// Setup Event Listeners
function setupEventListeners() {
    accountForm.addEventListener('submit', handleAccountSubmit);
    remindersForm.addEventListener('submit', handleReminderSubmit);
    backBtn.addEventListener('click', goToStep1);
}

// Handle Account Form Submission
function handleAccountSubmit(e) {
    e.preventDefault();
    
    formData.firstName = document.getElementById('firstName').value;
    formData.lastName = document.getElementById('lastName').value;
    formData.email = document.getElementById('email').value;
    formData.password = document.getElementById('password').value;
    formData.phone = document.getElementById('phone').value;
    
    goToStep2();
}

// Handle Reminder Form Submission
// Onboarding is deliberately limited to a single reminder — the person
// can add more once they're on the dashboard, matching the standard
// "add reminder" flow everyone else uses after signup.
async function handleReminderSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    isSubmitting = true;
    setSubmitLoading(true);
    
    const occasionSelect = document.getElementById('occasion1');
    const customOccasionInput = document.getElementById('customOccasion1');
    const occasion = occasionSelect.value === 'other'
        ? customOccasionInput.value
        : occasionSelect.value;
    
    formData.reminder = {
        name: document.getElementById('name1').value,
        relationship: document.getElementById('relationship1').value || null,
        occasion: occasion,
        date: document.getElementById('date1').value
    };
    
    await createAccount();
}

// Create Account in Firebase
async function createAccount() {
    try {
        // Create user in Firebase Auth
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(
            formData.email,
            formData.password
        );
        
        const user = userCredential.user;
        
        // Force a fresh ID token before any Firestore writes. Immediately
        // after account creation, there can be a brief window where
        // Firestore's connection is still using the previous (or no)
        // auth token — causing a permission-denied on the very first
        // write even when the security rules themselves are correct.
        await user.getIdToken(true);
        
        // Create user document in Firestore
        await firebase.firestore().collection('users').doc(user.uid).set({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone || '',
            tier: 'discover',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Create the person + their reminder — matches the exact schema
        // the dashboard reads: a "person" document at people/{personId},
        // with the reminder nested underneath at
        // people/{personId}/reminders/{reminderId}.
        //
        // NOTE: deliberately sequential, not batched. Security rules
        // that check a reminders-subcollection write by looking up its
        // parent person document's ownership evaluate against committed
        // state — a person doc created in the same atomic batch as its
        // reminder isn't visible to that lookup yet, causing a
        // permission-denied error even on a fully valid write.
        const personRef = await firebase.firestore().collection('people').add({
            userId: user.uid,
            personName: formData.reminder.name,
            relationship: formData.reminder.relationship,
            hasJustBecause: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await firebase.firestore()
            .collection('people')
            .doc(personRef.id)
            .collection('reminders')
            .add({
                reminderType: 'date-based',
                occasion: formData.reminder.occasion,
                date: formData.reminder.date,
                reminderDays: [7, 3, 0],
                smsEnabled: false,
                active: true,
                lastReminderSent: null,
                giftPurchased: false,
                purchaseDate: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Show success
        showSuccess();
        
    } catch (error) {
        console.error('Signup error:', error);
        alert(getErrorMessage(error.code));
        isSubmitting = false;
        setSubmitLoading(false);
    }
}

// Show/hide the loading state on the account-creation button. Disables
// both Create Account and Back while a submission is in flight, so
// there's no way to double-submit or navigate away mid-write.
function setSubmitLoading(isLoading) {
    const submitBtn = document.getElementById('createAccountBtn');
    if (!submitBtn) return;
    
    if (isLoading) {
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span>Creating your account…';
        if (backBtn) backBtn.disabled = true;
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Create My Account';
        if (backBtn) backBtn.disabled = false;
    }
}

// Navigation
function goToStep2() {
    currentStep = 2;
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    updateProgressBar();
}

function goToStep1() {
    currentStep = 1;
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    updateProgressBar();
}

function showSuccess() {
    step2.classList.add('hidden');
    successStep.classList.remove('hidden');
    
    // Auto-redirect to dashboard after 2 seconds
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 2000);
}

function updateProgressBar() {
    progressSteps.forEach((step, index) => {
        if (index + 1 <= currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

// Show custom occasion text input if "Other" is selected
function setupOccasionListener() {
    const occasion1 = document.getElementById('occasion1');
    const customInput = document.getElementById('customOccasion1');
    
    occasion1.addEventListener('change', () => {
        if (occasion1.value === 'other') {
            customInput.classList.remove('hidden');
            customInput.required = true;
        } else {
            customInput.classList.add('hidden');
            customInput.required = false;
        }
    });
}

// Error Messages
function getErrorMessage(code) {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please sign in instead.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        default:
            return 'An error occurred. Please try again.';
    }
}
