/* ============================================================
   UPGRADE PAGE LOGIC - REVOLUT MERCHANT
   ============================================================ */

// State
let isAnnual = false;
let currentUser = null;

// DOM Elements
const billingToggle = document.getElementById('billingToggle');
const curatePrice = document.getElementById('curatePrice');
const curatePeriod = document.getElementById('curatePeriod');
const curateAnnual = document.getElementById('curateAnnual');
const discoverPlanBtn = document.getElementById('discoverPlanBtn');
const upgradeToCurateBtn = document.getElementById('upgradeToCurate');
const premiumWaitlistBtn = document.getElementById('premiumWaitlistBtn');
const premiumWaitlistModal = document.getElementById('premiumWaitlistModal');
const joinWaitlistModalBtn = document.getElementById('joinWaitlistModalBtn');
const waitlistModalMessage = document.getElementById('waitlistModalMessage');

// Initialize
firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        checkUserPlan();
    } else {
        // Logged out: Discover reads as a real call to action (signup),
        // Curate button stays as-is (clicking it will prompt sign-in
        // first, same as before).
        if (discoverPlanBtn) {
            discoverPlanBtn.textContent = 'Get Started';
            discoverPlanBtn.disabled = false;
        }
    }
});

// Billing Toggle
if (billingToggle) {
    billingToggle.addEventListener('change', (e) => {
        isAnnual = e.target.checked;
        updatePricing();
    });
}

// Update Pricing Display
function updatePricing() {
    if (isAnnual) {
        curatePrice.textContent = '£49.99';
        curatePeriod.textContent = '/year';
        curateAnnual.textContent = 'Just £4.17/month — Save £10';
    } else {
        curatePrice.textContent = '£4.99';
        curatePeriod.textContent = '/month';
        curateAnnual.textContent = '';
    }
}

// Check User Plan — updates BOTH cards based on actual tier, rather
// than only ever touching the Curate button while Discover stays
// permanently hardcoded to "Current Plan" regardless of reality.
async function checkUserPlan() {
    try {
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();
        
        const userData = userDoc.exists ? userDoc.data() : {};
        const tier = userData.tier || userData.plan || 'discover';
        const isCurate = tier === 'essential' || tier === 'curate';
        
        if (isCurate) {
            upgradeToCurateBtn.textContent = 'Current Plan';
            upgradeToCurateBtn.disabled = true;
            
            if (discoverPlanBtn) {
                // They're not actually on Discover — downgrading happens
                // via Settings' Cancel Subscription flow, not from here.
                discoverPlanBtn.textContent = 'Downgrade in Settings';
                discoverPlanBtn.disabled = true;
            }
        } else {
            // Genuinely on Discover
            if (discoverPlanBtn) {
                discoverPlanBtn.textContent = 'Current Plan';
                discoverPlanBtn.disabled = true;
            }
        }
        
        // Check Atelier waitlist status
        if (userData.premiumWaitlist && premiumWaitlistBtn) {
            premiumWaitlistBtn.textContent = 'On Waitlist';
            premiumWaitlistBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error checking user plan:', error);
    }
}

// Discover button click (logged-out state only — logged-in states are
// always disabled, so this only ever fires as the "Get Started" CTA)
if (discoverPlanBtn) {
    discoverPlanBtn.addEventListener('click', () => {
        if (!currentUser) {
            window.location.href = 'signup.html';
        }
    });
}

// Upgrade to Curate via Revolut
upgradeToCurateBtn.addEventListener('click', async () => {
    console.log('=== UPGRADE BUTTON CLICKED (Revolut) ===');
    
    if (!currentUser) {
        alert('Please sign in first to upgrade');
        window.location.href = 'signin.html';
        return;
    }
    
    // Disable button and show loading state
    upgradeToCurateBtn.disabled = true;
    upgradeToCurateBtn.textContent = 'Preparing checkout...';
    
    try {
        // Get user info for personalized checkout
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();
        
        const userData = userDoc.exists ? userDoc.data() : {};
        const userName = userData.firstName 
            ? `${userData.firstName} ${userData.lastName || ''}`.trim()
            : currentUser.email.split('@')[0];
        
        // Call Netlify function to create Revolut checkout
        console.log('Creating Revolut checkout session...');
        const response = await fetch('/.netlify/functions/revolut-create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.uid,
                userEmail: currentUser.email,
                userName: userName,
                isAnnual: isAnnual
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create checkout');
        }
        
        const data = await response.json();
        console.log('Checkout URL received');
        
        if (data.checkoutUrl) {
            // Redirect to Revolut hosted checkout
            console.log('Redirecting to Revolut checkout...');
            window.location.href = data.checkoutUrl;
        } else {
            throw new Error('No checkout URL received');
        }
        
    } catch (error) {
        console.error('Upgrade error:', error);
        alert('Sorry, we couldn\'t start the upgrade process. Please try again or contact support.');
        upgradeToCurateBtn.disabled = false;
        upgradeToCurateBtn.textContent = 'Upgrade to Curate';
    }
});

// Atelier Waitlist
if (premiumWaitlistBtn) {
    premiumWaitlistBtn.addEventListener('click', () => {
        if (!currentUser) {
            // Not a current user — they need a Discover account before
            // they can join the waitlist, not just a sign-in.
            window.location.href = 'signup.html';
            return;
        }
        // Logged in: this IS the "tick box" exercise — open the modal
        // (previously toggled the wrong element and never opened at all).
        premiumWaitlistModal.classList.remove('hidden');
    });
}

if (joinWaitlistModalBtn) {
    joinWaitlistModalBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        
        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUser.uid)
                .set({
                    premiumWaitlist: true,
                    premiumWaitlistAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            
            waitlistModalMessage.textContent = 'You\'re on the list! We\'ll be in touch soon.';
            waitlistModalMessage.classList.remove('hidden');
            premiumWaitlistBtn.textContent = 'On Waitlist';
            premiumWaitlistBtn.disabled = true;
            
            setTimeout(() => {
                premiumWaitlistModal.classList.add('hidden');
            }, 2000);
        } catch (error) {
            console.error('Waitlist error:', error);
            waitlistModalMessage.textContent = 'Something went wrong. Please try again.';
            waitlistModalMessage.classList.remove('hidden');
        }
    });
}

// Close modals — fixed selector (was ".close-modal", actual class is
// ".modal-close") so the × button and Cancel button now actually work.
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
    });
});

// Check URL for upgrade success
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('upgrade') === 'success') {
    alert('✅ Welcome to Curate! Your upgrade is being processed. You\'ll receive confirmation shortly.');
    // Remove the URL parameter
    window.history.replaceState({}, document.title, window.location.pathname);
}
