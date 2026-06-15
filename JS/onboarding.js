// ============================================================
// ONBOARDING FLOW
// Welcome modal + 3-step interactive tour for new users
// ============================================================

import { 
    getUser,
    createOrUpdateUser
} from './firebase-config-v2.js';

let currentTourStep = 0;
let onboardingUser = null;

// Tour step configuration
const tourSteps = [
    {
        targetSelector: '.stats-grid',
        title: 'Track Your Reminders',
        message: 'View all your active reminders here. Free plan lets you save up to 5 — upgrade anytime for unlimited.',
        position: 'bottom'
    },
    {
        targetSelector: '#addReminderBtn',
        title: 'Add New Reminders',
        message: 'Click here anytime to add a new reminder. You can also set up Just Because moments for surprise gifts (Essential plan).',
        position: 'bottom'
    },
    {
        targetSelector: '.person-card, .empty-state',
        title: 'People-Centric Reminders',
        message: 'Each person gets their own card showing all their reminders. Click the + button to add more reminders for that person, or ✏️ to edit existing ones.',
        position: 'bottom'
    }
];

// ============================================================
// CHECK IF USER NEEDS ONBOARDING
// ============================================================

export async function checkAndShowOnboarding(user) {
    onboardingUser = user;
    
    try {
        const userData = await getUser(user.uid);
        
        if (!userData) return;
        
        // Show onboarding only if user hasn't completed it
        if (!userData.onboardingCompleted) {
            // Small delay to let dashboard render first
            setTimeout(function() {
                showWelcomeModal(userData.firstName || 'there');
            }, 500);
        }
        
    } catch (error) {
        console.error('Error checking onboarding status:', error);
    }
}

// ============================================================
// WELCOME MODAL
// ============================================================

function showWelcomeModal(firstName) {
    const modal = document.createElement('div');
    modal.id = 'onboardingWelcomeModal';
    modal.className = 'onboarding-modal';
    
    modal.innerHTML = `
        <div class="onboarding-modal-content">
            <div class="onboarding-welcome-icon">✨</div>
            <h2>Welcome to Aglaea, ${firstName}!</h2>
            <p>You're all set up. Here's a quick tour to help you get the most out of your account — it'll only take 30 seconds.</p>
            <div class="onboarding-modal-actions">
                <button class="btn btn-secondary" id="onboardingSkipBtn">Skip</button>
                <button class="btn btn-primary" id="onboardingStartBtn">Start Tour →</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fade in
    setTimeout(function() {
        modal.classList.add('visible');
    }, 10);
    
    // Event listeners
    document.getElementById('onboardingSkipBtn').addEventListener('click', skipOnboarding);
    document.getElementById('onboardingStartBtn').addEventListener('click', startTour);
}

// ============================================================
// START TOUR
// ============================================================

function startTour() {
    // Remove welcome modal
    const welcomeModal = document.getElementById('onboardingWelcomeModal');
    if (welcomeModal) {
        welcomeModal.classList.remove('visible');
        setTimeout(function() {
            welcomeModal.remove();
        }, 300);
    }
    
    currentTourStep = 0;
    setTimeout(function() {
        showTourStep(0);
    }, 300);
}

// ============================================================
// SHOW TOUR STEP
// ============================================================

function showTourStep(stepIndex) {
    if (stepIndex >= tourSteps.length) {
        completeOnboarding();
        return;
    }
    
    const step = tourSteps[stepIndex];
    
    // Find target element
    let target = null;
    const selectors = step.targetSelector.split(',').map(function(s) { return s.trim(); });
    
    for (let i = 0; i < selectors.length; i++) {
        target = document.querySelector(selectors[i]);
        if (target) break;
    }
    
    if (!target) {
        // Target not found - skip this step
        showTourStep(stepIndex + 1);
        return;
    }
    
    // Scroll target into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Wait for scroll, then show tooltip
    setTimeout(function() {
        createTooltip(target, step, stepIndex);
    }, 400);
}

// ============================================================
// CREATE TOOLTIP
// ============================================================

function createTooltip(target, step, stepIndex) {
    // Remove existing tooltip
    removeTooltip();
    
    // Add highlight to target
    target.classList.add('onboarding-highlight');
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'onboardingOverlay';
    overlay.className = 'onboarding-overlay';
    document.body.appendChild(overlay);
    
    // Get target position
    const rect = target.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'onboardingTooltip';
    tooltip.className = 'onboarding-tooltip';
    
    const isLastStep = stepIndex === tourSteps.length - 1;
    const buttonText = isLastStep ? 'Finish' : 'Next →';
    
    tooltip.innerHTML = `
        <div class="onboarding-tooltip-content">
            <div class="onboarding-step-indicator">Step ${stepIndex + 1} of ${tourSteps.length}</div>
            <h3>${step.title}</h3>
            <p>${step.message}</p>
            <div class="onboarding-tooltip-actions">
                <button class="btn btn-text" id="onboardingSkipTourBtn">Skip tour</button>
                <button class="btn btn-primary btn-small" id="onboardingNextBtn">${buttonText}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip below target
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let top = rect.bottom + scrollTop + 15;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    
    // Keep on screen
    if (left < 20) left = 20;
    if (left + tooltipRect.width > window.innerWidth - 20) {
        left = window.innerWidth - tooltipRect.width - 20;
    }
    
    // If tooltip would be off bottom of screen, position above target instead
    if (top + tooltipRect.height > scrollTop + window.innerHeight - 20) {
        top = rect.top + scrollTop - tooltipRect.height - 15;
        tooltip.classList.add('tooltip-above');
    }
    
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    
    // Fade in
    setTimeout(function() {
        tooltip.classList.add('visible');
    }, 10);
    
    // Event listeners
    document.getElementById('onboardingNextBtn').addEventListener('click', function() {
        target.classList.remove('onboarding-highlight');
        showTourStep(stepIndex + 1);
    });
    
    document.getElementById('onboardingSkipTourBtn').addEventListener('click', function() {
        target.classList.remove('onboarding-highlight');
        completeOnboarding();
    });
}

// ============================================================
// REMOVE TOOLTIP
// ============================================================

function removeTooltip() {
    const tooltip = document.getElementById('onboardingTooltip');
    if (tooltip) tooltip.remove();
    
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.remove();
    
    // Remove all highlights
    document.querySelectorAll('.onboarding-highlight').forEach(function(el) {
        el.classList.remove('onboarding-highlight');
    });
}

// ============================================================
// SKIP ONBOARDING
// ============================================================

async function skipOnboarding() {
    const welcomeModal = document.getElementById('onboardingWelcomeModal');
    if (welcomeModal) {
        welcomeModal.classList.remove('visible');
        setTimeout(function() {
            welcomeModal.remove();
        }, 300);
    }
    
    await markOnboardingComplete();
}

// ============================================================
// COMPLETE ONBOARDING
// ============================================================

async function completeOnboarding() {
    removeTooltip();
    
    // Show completion message briefly
    const completionMsg = document.createElement('div');
    completionMsg.className = 'onboarding-completion';
    completionMsg.innerHTML = `
        <div class="onboarding-completion-content">
            <div class="onboarding-completion-icon">🎉</div>
            <h3>You're all set!</h3>
            <p>Start adding reminders to never miss a special moment.</p>
        </div>
    `;
    document.body.appendChild(completionMsg);
    
    setTimeout(function() {
        completionMsg.classList.add('visible');
    }, 10);
    
    // Auto-dismiss after 2 seconds
    setTimeout(function() {
        completionMsg.classList.remove('visible');
        setTimeout(function() {
            completionMsg.remove();
        }, 300);
    }, 2500);
    
    await markOnboardingComplete();
}

// ============================================================
// MARK ONBOARDING COMPLETE IN FIRESTORE
// ============================================================

async function markOnboardingComplete() {
    if (!onboardingUser) return;
    
    try {
        await createOrUpdateUser(onboardingUser.uid, {
            onboardingCompleted: true,
            onboardingCompletedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error marking onboarding complete:', error);
    }
}
