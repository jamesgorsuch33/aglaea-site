/* ============================================================
   DASHBOARD LOGIC
   ============================================================ */

let currentUser = null;
let currentUserData = null;
let userReminders = [];

// DOM Elements
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const reminderCount = document.getElementById('reminderCount');
const nextReminder = document.getElementById('nextReminder');
const planType = document.getElementById('planType');
const remindersList = document.getElementById('remindersList');
const addReminderBtn = document.getElementById('addReminderBtn');
const addReminderModal = document.getElementById('addReminderModal');
const newReminderForm = document.getElementById('newReminderForm');
const upgradeBanner = document.getElementById('upgradeBanner');

// Initialize
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        await loadReminders();
    } else {
        // Not logged in, redirect to sign in
        window.location.href = 'signin.html';
    }
});

// Load User Data
async function loadUserData() {
    try {
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();
        
        if (userDoc.exists) {
            const data = userDoc.data();
            currentUserData = data; // Store for Mailchimp sync
            userName.textContent = data.firstName || 'there';
            userEmail.textContent = currentUser.email;
            planType.textContent = data.plan === 'essential' ? 'Essential' : 'Free';
        } else {
            userEmail.textContent = currentUser.email;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load Reminders
async function loadReminders() {
    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('reminders')
            .orderBy('date', 'asc')
            .get();
        
        userReminders = [];
        snapshot.forEach(doc => {
            userReminders.push({ id: doc.id, ...doc.data() });
        });
        
        updateStats();
        renderReminders();
    } catch (error) {
        console.error('Error loading reminders:', error);
        remindersList.innerHTML = '<div class="error">Failed to load reminders. Please refresh the page.</div>';
    }
}

// Update Stats
function updateStats() {
    const count = userReminders.length;
    reminderCount.textContent = `${count}/5`;
    
    // Show upgrade banner if at limit
    if (count >= 5) {
        upgradeBanner.classList.remove('hidden');
        addReminderBtn.disabled = true;
        addReminderBtn.textContent = 'Limit Reached';
    } else {
        upgradeBanner.classList.add('hidden');
        addReminderBtn.disabled = false;
        addReminderBtn.textContent = '+ Add Reminder';
    }
    
    // Next reminder
    if (userReminders.length > 0) {
        const next = userReminders[0];
        const daysUntil = getDaysUntil(next.date);
        nextReminder.textContent = `${next.name} (${daysUntil})`;
    } else {
        nextReminder.textContent = '-';
    }
}

// Render Reminders
function renderReminders() {
    if (userReminders.length === 0) {
        remindersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎁</div>
                <p>No reminders yet. Add your first one!</p>
            </div>
        `;
        return;
    }
    
    remindersList.innerHTML = userReminders.map(reminder => {
        const daysUntil = getDaysUntil(reminder.date);
        const daysNum = parseInt(daysUntil);
        const isUrgent = daysNum <= 7;
        
        return `
            <div class="reminder-item ${isUrgent ? 'urgent' : ''}">
                <div class="reminder-info">
                    <h3>${reminder.name}</h3>
                    <p>${capitalizeFirst(reminder.occasion)} • ${formatDate(reminder.date)}</p>
                    <span class="reminder-countdown ${isUrgent ? 'urgent' : ''}">
                        ${daysUntil}
                    </span>
                </div>
                <div class="reminder-actions">
                    <button onclick="shopGifts('${reminder.occasion}')">Shop Gifts</button>
                    <button class="delete-btn" onclick="deleteReminder('${reminder.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Calculate Days Until
function getDaysUntil(dateString) {
    const reminderDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    reminderDate.setHours(0, 0, 0, 0);
    
    const diffTime = reminderDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 0) {
        return 'Today!';
    } else if (diffDays === 1) {
        return 'Tomorrow';
    } else if (diffDays <= 30) {
        return `${diffDays} days away`;
    } else if (diffDays <= 60) {
        return `${Math.round(diffDays / 30)} month away`;
    } else {
        return `${Math.round(diffDays / 30)} months away`;
    }
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Capitalize First Letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await firebase.auth().signOut();
        window.location.href = 'index.html';
    } catch (error) {
        alert('Failed to sign out');
    }
});

// Add Reminder Modal
addReminderBtn.addEventListener('click', () => {
    if (userReminders.length >= 5) {
        if (confirm('You\'ve reached the free limit of 5 reminders. Upgrade to Essential for unlimited reminders?')) {
            window.location.href = 'upgrade.html';
        }
        return;
    }
    addReminderModal.classList.remove('hidden');
});

// Close Modal
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        addReminderModal.classList.add('hidden');
        newReminderForm.reset();
    });
});

// Close modal on outside click
addReminderModal.addEventListener('click', (e) => {
    if (e.target === addReminderModal) {
        addReminderModal.classList.add('hidden');
        newReminderForm.reset();
    }
});

// Occasion Change
document.getElementById('newOccasion').addEventListener('change', (e) => {
    const customInput = document.getElementById('newCustomOccasion');
    if (e.target.value === 'other') {
        customInput.classList.remove('hidden');
        customInput.required = true;
    } else {
        customInput.classList.add('hidden');
        customInput.required = false;
    }
});

// Add New Reminder
newReminderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (userReminders.length >= 5) {
        alert('You\'ve reached the free limit. Please upgrade to Essential.');
        return;
    }
    
    const occasionSelect = document.getElementById('newOccasion');
    const customOccasion = document.getElementById('newCustomOccasion');
    
    const newReminder = {
        name: document.getElementById('newName').value,
        occasion: occasionSelect.value === 'other' ? customOccasion.value : occasionSelect.value,
        date: document.getElementById('newDate').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('reminders')
            .add(newReminder);
        
        // Reload reminders
        await loadReminders();
        
        // Sync to Mailchimp
        await syncRemindersToMailchimp();
        
        // Close modal
        addReminderModal.classList.add('hidden');
        newReminderForm.reset();
        
        alert('✅ Reminder added successfully!');
    } catch (error) {
        console.error('Error adding reminder:', error);
        alert('Failed to add reminder. Please try again.');
    }
});

// Delete Reminder
async function deleteReminder(id) {
    if (!confirm('Delete this reminder?')) return;
    
    try {
        await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('reminders')
            .doc(id)
            .delete();
        
        await loadReminders();
        
        // Sync to Mailchimp
        await syncRemindersToMailchimp();
    } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Failed to delete reminder.');
    }
}

// Shop Gifts
function shopGifts(occasion) {
    window.location.href = `products.html?occasion=${occasion}`;
}

// Sync Reminders to Mailchimp
async function syncRemindersToMailchimp() {
    if (!currentUser) return;
    
    try {
        // Get fresh user data
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();
        
        if (!userDoc.exists) return;
        
        const userData = userDoc.data();
        
        await fetch('/.netlify/functions/mailchimp-sync-reminders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: userData.email || currentUser.email,
                reminders: userReminders.map(r => ({
                    name: r.name,
                    occasion: r.occasion,
                    date: r.date
                })),
            }),
        });
    } catch (error) {
        console.error('Mailchimp sync error:', error);
        // Don't fail the operation if Mailchimp sync fails
    }
}

// Make functions globally available
window.deleteReminder = deleteReminder;
window.shopGifts = shopGifts;
