/* ============================================================
   SIGNUP PAGE LOGIC
   ============================================================ */

// State
let currentStep = 1;
let reminderCount = 1;
let formData = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    reminders: []
};

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const successStep = document.getElementById('successStep');
const accountForm = document.getElementById('accountForm');
const remindersForm = document.getElementById('remindersForm');
const addReminderBtn = document.getElementById('addReminderBtn');
const backBtn = document.getElementById('backBtn');
const progressSteps = document.querySelectorAll('.progress-step');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupOccasionListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Account form submission
    accountForm.addEventListener('submit', handleAccountSubmit);
    
    // Reminders form submission
    remindersForm.addEventListener('submit', handleRemindersSubmit);
    
    // Add reminder button
    addReminderBtn.addEventListener('click', addReminderField);
    
    // Back button
    backBtn.addEventListener('click', goToStep1);
}

// Handle Account Form Submission
function handleAccountSubmit(e) {
    e.preventDefault();
    
    // Collect form data
    formData.firstName = document.getElementById('firstName').value;
    formData.lastName = document.getElementById('lastName').value;
    formData.email = document.getElementById('email').value;
    formData.password = document.getElementById('password').value;
    formData.phone = document.getElementById('phone').value;
    
    // Go to step 2
    goToStep2();
}

// Handle Reminders Form Submission
async function handleRemindersSubmit(e) {
    e.preventDefault();
    
    // Collect reminders data
    formData.reminders = [];
    for (let i = 1; i <= reminderCount; i++) {
        const nameInput = document.getElementById(`name${i}`);
        const occasionSelect = document.getElementById(`occasion${i}`);
        const customOccasionInput = document.getElementById(`customOccasion${i}`);
        const dateInput = document.getElementById(`date${i}`);
        
        if (nameInput && nameInput.value) {
            const occasion = occasionSelect.value === 'other' 
                ? customOccasionInput.value 
                : occasionSelect.value;
            
            formData.reminders.push({
                name: nameInput.value,
                occasion: occasion,
                date: dateInput.value
            });
        }
    }
    
    // Create account
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
        
        // Create user document in Firestore
        await firebase.firestore().collection('users').doc(user.uid).set({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone || '',
            plan: 'free',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add reminders to Firestore
        const batch = firebase.firestore().batch();
        formData.reminders.forEach(reminder => {
            const docRef = firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .collection('reminders')
                .doc();
            
            batch.set(docRef, {
                ...reminder,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        
        // TODO: Send to Mailchimp
        // await addToMailchimp(formData);
        
        // Show success
        showSuccess();
        
    } catch (error) {
        console.error('Signup error:', error);
        alert(getErrorMessage(error.code));
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

// Add Reminder Field
function addReminderField() {
    if (reminderCount >= 5) {
        alert('You can add up to 5 reminders on the free plan. Upgrade to Essential for unlimited reminders!');
        return;
    }
    
    reminderCount++;
    
    const container = document.getElementById('remindersContainer');
    const reminderDiv = document.createElement('div');
    reminderDiv.className = 'reminder-input';
    reminderDiv.dataset.reminder = reminderCount;
    
    reminderDiv.innerHTML = `
        <div class="reminder-header">
            <h3>Reminder ${reminderCount}</h3>
            <button type="button" class="remove-reminder" onclick="removeReminder(${reminderCount})">✕</button>
        </div>
        
        <div class="form-group">
            <label for="name${reminderCount}">Person's Name</label>
            <input type="text" id="name${reminderCount}" placeholder="e.g. Mum, Sarah, Best Friend">
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="occasion${reminderCount}">Occasion</label>
                <select id="occasion${reminderCount}" onchange="handleOccasionChange(${reminderCount})">
                    <option value="">Select occasion</option>
                    <option value="birthday">Birthday</option>
                    <option value="anniversary">Anniversary</option>
                    <option value="valentines">Valentine's Day</option>
                    <option value="mothers-day">Mother's Day</option>
                    <option value="fathers-day">Father's Day</option>
                    <option value="christmas">Christmas</option>
                    <option value="other">Other (type your own)</option>
                </select>
                <input type="text" id="customOccasion${reminderCount}" class="custom-occasion hidden" placeholder="Enter occasion name">
            </div>
            
            <div class="form-group">
                <label for="date${reminderCount}">Date</label>
                <input type="date" id="date${reminderCount}">
            </div>
        </div>
        
        <p class="date-helper">💡 Enter the actual date of the occasion (we'll remind you 10 days before)</p>
    `;
    
    container.appendChild(reminderDiv);
    updateReminderCount();
    
    // Disable button if at max
    if (reminderCount >= 5) {
        addReminderBtn.disabled = true;
        addReminderBtn.textContent = '✓ Maximum reminders added (5/5)';
    }
}

// Remove Reminder Field
function removeReminder(number) {
    const reminderDiv = document.querySelector(`.reminder-input[data-reminder="${number}"]`);
    if (reminderDiv) {
        reminderDiv.remove();
        reminderCount--;
        updateReminderCount();
        
        // Re-enable add button
        if (reminderCount < 5) {
            addReminderBtn.disabled = false;
            addReminderBtn.innerHTML = `+ Add Another Reminder <span class="reminder-count">(${reminderCount}/5)</span>`;
        }
    }
}

// Update Reminder Count
function updateReminderCount() {
    const countSpan = document.querySelector('.reminder-count');
    if (countSpan) {
        countSpan.textContent = `(${reminderCount}/5)`;
    }
}

// Setup Occasion Listeners
function setupOccasionListeners() {
    const occasion1 = document.getElementById('occasion1');
    occasion1.addEventListener('change', () => handleOccasionChange(1));
}

// Handle Occasion Change (show custom input if "Other" selected)
function handleOccasionChange(number) {
    const occasionSelect = document.getElementById(`occasion${number}`);
    const customInput = document.getElementById(`customOccasion${number}`);
    
    if (occasionSelect.value === 'other') {
        customInput.classList.remove('hidden');
        customInput.required = true;
    } else {
        customInput.classList.add('hidden');
        customInput.required = false;
    }
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

// Make functions globally available
window.removeReminder = removeReminder;
window.handleOccasionChange = handleOccasionChange;
