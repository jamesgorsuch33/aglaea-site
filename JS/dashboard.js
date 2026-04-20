/* ============================================================
   DASHBOARD LOGIC
   ============================================================ */

// State
let currentUser = null;
let userReminders = [];
let editingReminderId = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const dashboardMain = document.getElementById('dashboardMain');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const reminderCount = document.getElementById('reminderCount');
const nextReminder = document.getElementById('nextReminder');
const userPlan = document.getElementById('userPlan');
const remindersList = document.getElementById('remindersList');
const emptyState = document.getElementById('emptyState');
const upgradeBanner = document.getElementById('upgradeBanner');
const addReminderBtn = document.getElementById('addReminderBtn');
const logoutBtn = document.getElementById('logoutBtn');
const reminderModal = document.getElementById('reminderModal');
const deleteModal = document.getElementById('deleteModal');
const reminderForm = document.getElementById('reminderForm');
const modalTitle = document.getElementById('modalTitle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Check Authentication
function checkAuth() {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserData();
        } else {
            // Not logged in - redirect to home
            window.location.href = 'index.html';
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Add reminder
    addReminderBtn.addEventListener('click', showAddReminderModal);
    
    // Reminder form
    reminderForm.addEventListener('submit', handleReminderSubmit);
    
    // Occasion change
    document.getElementById('reminderOccasion').addEventListener('change', handleOccasionChange);
}

// Load User Data
async function loadUserData() {
    try {
        // Get user profile
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            userName.textContent = userData.firstName || 'there';
            userEmail.textContent = currentUser.email;
            userPlan.textContent = userData.plan === 'essential' ? 'Essential' : 'Free';
        }
        
        // Load reminders
        await loadReminders();
        
        // Show dashboard
        loadingState.classList.add('hidden');
        dashboardMain.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Failed to load dashboard. Please refresh the page.');
    }
}

// Load Reminders
async function loadReminders() {
    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('reminders')
            .get();
        
        userReminders = [];
        snapshot.forEach(doc => {
            userReminders.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by date (nearest first)
        userReminders.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Update UI
        updateStats();
        renderReminders();
        
    } catch (error) {
        console.error('Error loading reminders:', error);
    }
}

// Update Stats
function updateStats() {
    const count = userReminders.length;
    reminderCount.textContent = `${count}/5`;
    
    // Show/hide upgrade banner
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
        if (daysUntil >= 0) {
            nextReminder.textContent = `${next.name} in ${daysUntil} days`;
        } else {
            nextReminder.textContent = `${next.name} (past)`;
        }
    } else {
        nextReminder.textContent = '—';
    }
}

// Render Reminders
function renderReminders() {
    if (userReminders.length === 0) {
        remindersList.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    remindersList.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    remindersList.innerHTML = userReminders.map(reminder => {
        const daysUntil = getDaysUntil(reminder.date);
        const countdown = getCountdownText(daysUntil);
        const urgencyClass = getUrgencyClass(daysUntil);
        const formattedDate = formatDate(reminder.date);
        const occasion = reminder.occasion === 'other' ? 'Special occasion' : reminder.occasion;
        
        return `
            <div class="reminder-card ${urgencyClass}">
                <div class="reminder-header">
                    <div class="reminder-info">
                        <h3>${reminder.name}</h3>
                        <p class="reminder-occasion">${occasion}</p>
                    </div>
                    <div class="reminder-countdown">
                        <div class="countdown-value">${countdown.value}</div>
                        <div class="countdown-label">${countdown.label}</div>
                    </div>
                </div>
                
                <p class="reminder-date">📅 ${formattedDate}</p>
                
                <div class="reminder-actions">
                    <button class="btn-icon" onclick="editReminder('${reminder.id}')">✏️ Edit</button>
                    <button class="btn-icon btn-delete" onclick="confirmDelete('${reminder.id}')">🗑️ Delete</button>
                    <button class="btn-icon btn-shop" onclick="window.location.href='products.html'">🎁 Shop Gifts</button>
                </div>
            </div>
        `;
    }).join('');
}

// Calculate Days Until Date
function getDaysUntil(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

// Get Countdown Text
function getCountdownText(days) {
    if (days < 0) {
        return { value: 'Past', label: 'This date has passed' };
    } else if (days === 0) {
        return { value: 'Today!', label: 'Happening today' };
    } else if (days === 1) {
        return { value: 'Tomorrow', label: 'Happening tomorrow' };
    } else if (days <= 7) {
        return { value: `${days} days`, label: 'Coming up soon' };
    } else if (days <= 30) {
        return { value: `${days} days`, label: 'Coming this month' };
    } else if (days <= 60) {
        const weeks = Math.floor(days / 7);
        return { value: `${weeks} weeks`, label: 'Coming soon' };
    } else {
        const months = Math.floor(days / 30);
        return { value: `${months} months`, label: 'Coming later' };
    }
}

// Get Urgency Class
function getUrgencyClass(days) {
    if (days < 0) return '';
    if (days <= 7) return 'urgent';
    if (days <= 14) return 'soon';
    return '';
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
}

// Show Add Reminder Modal
function showAddReminderModal() {
    if (userReminders.length >= 5) {
        alert('You\'ve reached the free limit of 5 reminders. Upgrade to Essential for unlimited reminders!');
        return;
    }
    
    editingReminderId = null;
    modalTitle.textContent = 'Add New Reminder';
    reminderForm.reset();
    document.getElementById('customOccasion').classList.add('hidden');
    reminderModal.classList.remove('hidden');
}

// Edit Reminder
function editReminder(id) {
    const reminder = userReminders.find(r => r.id === id);
    if (!reminder) return;
    
    editingReminderId = id;
    modalTitle.textContent = 'Edit Reminder';
    
    document.getElementById('reminderName').value = reminder.name;
    document.getElementById('reminderOccasion').value = reminder.occasion;
    document.getElementById('reminderDate').value = reminder.date;
    
    if (reminder.occasion === 'other') {
        document.getElementById('customOccasion').classList.remove('hidden');
        document.getElementById('customOccasion').value = reminder.customOccasion || '';
    }
    
    reminderModal.classList.remove('hidden');
}

// Close Reminder Modal
function closeReminderModal() {
    reminderModal.classList.add('hidden');
    reminderForm.reset();
    editingReminderId = null;
}

// Handle Occasion Change
function handleOccasionChange() {
    const occasion = document.getElementById('reminderOccasion').value;
    const customInput = document.getElementById('customOccasion');
    
    if (occasion === 'other') {
        customInput.classList.remove('hidden');
        customInput.required = true;
    } else {
        customInput.classList.add('hidden');
        customInput.required = false;
    }
}

// Handle Reminder Submit
async function handleReminderSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('reminderName').value;
    const occasion = document.getElementById('reminderOccasion').value;
    const customOccasion = document.getElementById('customOccasion').value;
    const date = document.getElementById('reminderDate').value;
    
    const reminderData = {
        name,
        occasion: occasion === 'other' ? customOccasion : occasion,
        date,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (editingReminderId) {
            // Update existing reminder
            await firebase.firestore()
                .collection('users')
                .doc(currentUser.uid)
                .collection('reminders')
                .doc(editingReminderId)
                .update(reminderData);
        } else {
            // Create new reminder
            reminderData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            
            await firebase.firestore()
                .collection('users')
                .doc(currentUser.uid)
                .collection('reminders')
                .add(reminderData);
        }
        
        // Reload reminders
        await loadReminders();
        
        // Close modal
        closeReminderModal();
        
    } catch (error) {
        console.error('Error saving reminder:', error);
        alert('Failed to save reminder. Please try again.');
    }
}

// Confirm Delete
function confirmDelete(id) {
    editingReminderId = id;
    deleteModal.classList.remove('hidden');
    
    // Set up confirm button
    document.getElementById('confirmDeleteBtn').onclick = async () => {
        await deleteReminder(id);
        closeDeleteModal();
    };
}

// Close Delete Modal
function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    editingReminderId = null;
}

// Delete Reminder
async function deleteReminder(id) {
    try {
        await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('reminders')
            .doc(id)
            .delete();
        
        // Reload reminders
        await loadReminders();
        
    } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Failed to delete reminder. Please try again.');
    }
}

// Handle Logout
async function handleLogout() {
    try {
        await firebase.auth().signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to sign out. Please try again.');
    }
}

// Make functions globally available
window.showAddReminderModal = showAddReminderModal;
window.closeReminderModal = closeReminderModal;
window.editReminder = editReminder;
window.confirmDelete = confirmDelete;
window.closeDeleteModal = closeDeleteModal;
