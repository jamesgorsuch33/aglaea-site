// ============================================================
// SIGNUP LOGIC - CLEAN VERSION
// 2-step flow: Account Details + Add Reminders
// Creates user with tier: 'free' and reminders in people/ collection
// ============================================================

// Form data storage
const formData = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    reminders: []
};

let reminderCount = 1;
const maxReminders = 5;

// ============================================================
// STEP 1: ACCOUNT DETAILS FORM
// ============================================================

document.getElementById('accountForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Collect step 1 data
    formData.firstName = document.getElementById('firstName').value.trim();
    formData.lastName = document.getElementById('lastName').value.trim();
    formData.email = document.getElementById('email').value.trim();
    formData.password = document.getElementById('password').value;
    formData.phone = document.getElementById('phone').value.trim();
    
    // Move to step 2
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    
    // Update progress indicator
    document.querySelector('[data-step="1"]').classList.add('completed');
    document.querySelector('[data-step="2"]').classList.add('active');
});

// ============================================================
// BACK BUTTON (Step 2 -> Step 1)
// ============================================================

document.getElementById('backBtn').addEventListener('click', function() {
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step1').classList.remove('hidden');
    
    document.querySelector('[data-step="2"]').classList.remove('active');
});

// ============================================================
// OCCASION CHANGE - Show/Hide Custom Field
// ============================================================

function handleOccasionChange(reminderNum) {
    const occasionSelect = document.getElementById('occasion' + reminderNum);
    const customInput = document.getElementById('customOccasion' + reminderNum);
    
    if (occasionSelect && customInput) {
        if (occasionSelect.value === 'other') {
            customInput.classList.remove('hidden');
            customInput.required = true;
        } else {
            customInput.classList.add('hidden');
            customInput.required = false;
        }
    }
}

// Attach handler to reminder 1's occasion select
document.getElementById('occasion1').addEventListener('change', function() {
    handleOccasionChange(1);
});

// ============================================================
// ADD ANOTHER REMINDER BUTTON
// ============================================================

document.getElementById('addReminderBtn').addEventListener('click', function() {
    if (reminderCount >= maxReminders) {
        alert('You can add up to 5 reminders during signup. You can add more from your dashboard after signing up.');
        return;
    }
    
    reminderCount++;
    
    const container = document.getElementById('remindersContainer');
    
    const reminderHtml = 
        '<div class="reminder-input" data-reminder="' + reminderCount + '">' +
            '<div class="reminder-header">' +
                '<h3>Reminder ' + reminderCount + '</h3>' +
                '<button type="button" class="remove-reminder-btn" onclick="removeReminder(' + reminderCount + ')" title="Remove this reminder">×</button>' +
            '</div>' +
            '<div class="form-group">' +
                '<label for="name' + reminderCount + '">Person\'s Name</label>' +
                '<input type="text" id="name' + reminderCount + '" placeholder="e.g. Mum, Sarah, Best Friend" required>' +
            '</div>' +
            '<div class="form-row">' +
                '<div class="form-group">' +
                    '<label for="occasion' + reminderCount + '">Occasion</label>' +
                    '<select id="occasion' + reminderCount + '" required>' +
                        '<option value="">Select occasion</option>' +
                        '<option value="birthday">Birthday</option>' +
                        '<option value="anniversary">Anniversary</option>' +
                        '<option value="valentines">Valentine\'s Day</option>' +
                        '<option value="mothers-day">Mother\'s Day</option>' +
                        '<option value="fathers-day">Father\'s Day</option>' +
                        '<option value="christmas">Christmas</option>' +
                        '<option value="other">Other (type your own)</option>' +
                    '</select>' +
                    '<input type="text" id="customOccasion' + reminderCount + '" class="custom-occasion hidden" placeholder="Enter occasion name">' +
                '</div>' +
                '<div class="form-group">' +
                    '<label for="date' + reminderCount + '">Date</label>' +
                    '<input type="date" id="date' + reminderCount + '" required>' +
                '</div>' +
            '</div>' +
            '<p class="date-helper">💡 Enter the actual date of the occasion (we\'ll remind you 10 days before)</p>' +
        '</div>';
    
    container.insertAdjacentHTML('beforeend', reminderHtml);
    
    // Attach occasion change handler to new reminder
    const newOccasion = document.getElementById('occasion' + reminderCount);
    if (newOccasion) {
        newOccasion.addEventListener('change', function() {
            handleOccasionChange(reminderCount);
        });
    }
    
    updateReminderCount();
});

// ============================================================
// REMOVE REMINDER
// ============================================================

function removeReminder(reminderNum) {
    const reminderEl = document.querySelector('[data-reminder="' + reminderNum + '"]');
    if (reminderEl) {
        reminderEl.remove();
        updateReminderCount();
    }
}

// ============================================================
// UPDATE REMINDER COUNT
// ============================================================

function updateReminderCount() {
    const remindersInContainer = document.querySelectorAll('#remindersContainer .reminder-input').length;
    const countDisplay = document.querySelector('.reminder-count');
    if (countDisplay) {
        countDisplay.textContent = '(' + remindersInContainer + '/' + maxReminders + ')';
    }
}

// ============================================================
// STEP 2: REMINDERS FORM SUBMIT
// ============================================================

document.getElementById('remindersForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Find the submit button and disable it (prevent double-submit)
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';
    }
    
    try {
        // Collect all reminders from the form
        formData.reminders = [];
        
        const reminderInputs = document.querySelectorAll('#remindersContainer .reminder-input');
        
        reminderInputs.forEach(function(reminderEl) {
            const num = reminderEl.dataset.reminder;
            const name = document.getElementById('name' + num).value.trim();
            const occasion = document.getElementById('occasion' + num).value;
            const date = document.getElementById('date' + num).value;
            const customOccasionEl = document.getElementById('customOccasion' + num);
            const customOccasionName = customOccasionEl ? customOccasionEl.value.trim() : '';
            
            if (name && occasion && date) {
                formData.reminders.push({
                    personName: name,
                    occasion: occasion === 'other' ? 'custom' : occasion,
                    customOccasionName: occasion === 'other' ? customOccasionName : null,
                    date: date,
                    notes: ''
                });
            }
        });
        
        if (formData.reminders.length === 0) {
            alert('Please add at least one reminder.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create My Account';
            }
            return;
        }
        
        // Create the account
        await createAccount();
        
    } catch (error) {
        console.error('Submit error:', error);
        alert('Error: ' + error.message);
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create My Account';
        }
    }
});

// ============================================================
// CREATE ACCOUNT
// ============================================================

async function createAccount() {
    try {
        // Step 1: Create user in Firebase Auth
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(
            formData.email,
            formData.password
        );
        
        const user = userCredential.user;
        
        // Step 2: Create user document in Firestore
        await firebase.firestore().collection('users').doc(user.uid).set({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone || '',
            tier: 'free',
            stripeCustomerId: null,
            subscriptionId: null,
            subscriptionStatus: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Step 3: Create reminders in people/ collection (new structure)
        for (let i = 0; i < formData.reminders.length; i++) {
            const reminder = formData.reminders[i];
            
            // Create person document
            const personRef = await firebase.firestore().collection('people').add({
                userId: user.uid,
                personName: reminder.personName,
                relationship: null,
                hasJustBecause: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Create date-based reminder in subcollection
            await firebase.firestore()
                .collection('people')
                .doc(personRef.id)
                .collection('reminders')
                .add({
                    reminderType: 'date-based',
                    occasion: reminder.occasion,
                    customOccasionName: reminder.customOccasionName,
                    date: reminder.date,
                    notes: reminder.notes || '',
                    giftPurchased: false,
                    purchasedDate: null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        }
        
        // Step 4: Sync to Mailchimp (optional, don't block on failure)
        try {
            await syncToMailchimp(user.uid);
        } catch (mailchimpError) {
            console.error('Mailchimp sync error (non-blocking):', mailchimpError);
        }
        
        // Step 5: Show success and redirect
        showSuccess();
        
    } catch (error) {
        console.error('Error creating account:', error);
        
        let userMessage = 'Error creating account. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            userMessage = 'This email is already in use. Please sign in instead, or use a different email.';
        } else if (error.code === 'auth/weak-password') {
            userMessage = 'Password is too weak. Please use at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            userMessage = 'Please enter a valid email address.';
        }
        
        alert(userMessage);
        
        // Re-enable submit button
        const submitBtn = document.querySelector('#remindersForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create My Account';
        }
        
        throw error;
    }
}

// ============================================================
// MAILCHIMP SYNC
// ============================================================

async function syncToMailchimp(userId) {
    if (formData.reminders.length === 0) {
        return;
    }
    
    try {
        await fetch('/.netlify/functions/mailchimp-sync-reminders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: formData.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                reminders: formData.reminders
            })
        });
    } catch (error) {
        console.error('Mailchimp sync failed:', error);
        // Don't throw - this shouldn't block signup
    }
}

// ============================================================
// SHOW SUCCESS
// ============================================================

function showSuccess() {
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('successStep').classList.remove('hidden');
    
    // Update progress
    document.querySelector('[data-step="2"]').classList.add('completed');
    
    // Auto-redirect to dashboard after 3 seconds
    setTimeout(function() {
        window.location.href = 'dashboard.html';
    }, 3000);
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY (for inline onclick handlers)
// ============================================================

window.removeReminder = removeReminder;
window.handleOccasionChange = handleOccasionChange;
