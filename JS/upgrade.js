/* ============================================================
   UPGRADE PAGE LOGIC
   ============================================================ */

// Stripe Publishable Key (safe to expose in client-side code)
// TODO: Replace with your actual Stripe Publishable Key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_REPLACE_WITH_YOUR_KEY';
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

// TODO: Replace with your Stripe Price IDs (from Stripe Dashboard → Products)
const STRIPE_PRICES = {
    monthly: 'price_MONTHLY_ID',  // Curate Monthly: £4.99/month
    annual: 'price_ANNUAL_ID'     // Curate Annual: £49.99/year
};

// State
let isAnnual = false;
let currentUser = null;

// DOM Elements
const billingToggle = document.getElementById('billingToggle');
const curatePrice = document.getElementById('curatePrice');
const curatePeriod = document.getElementById('curatePeriod');
const curateAnnual = document.getElementById('curateAnnual');
const upgradeToCurateBtn = document.getElementById('upgradeToCurate');
const premiumWaitlistBtn = document.getElementById('premiumWaitlistBtn');
const premiumWaitlistModal = document.getElementById('premiumWaitlistModal');
const premiumWaitlistFormModal = document.getElementById('premiumWaitlistFormModal');
const joinWaitlistModalBtn = document.getElementById('joinWaitlistModalBtn');
const waitlistModalMessage = document.getElementById('waitlistModalMessage');

// Initialize
firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        checkUserPlan();
    }
});

// Billing Toggle
billingToggle.addEventListener('change', (e) => {
    isAnnual = e.target.checked;
    updatePricing();
});

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

// Check User Plan
async function checkUserPlan() {
    try {
        const userDoc = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const tier = userData.tier || userData.plan || 'discover';
            
            if (tier === 'essential' || tier === 'curate') {
                upgradeToCurateBtn.textContent = 'Current Plan';
                upgradeToCurateBtn.disabled = true;
            }
            
            // Check Premium waitlist status
            if (userData.premiumWaitlist) {
                premiumWaitlistBtn.textContent = 'On Waitlist';
                premiumWaitlistBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error checking user plan:', error);
    }
}

// Upgrade to Curate
upgradeToCurateBtn.addEventListener('click', async () => {
    console.log('=== UPGRADE BUTTON CLICKED ===');
    
    if (!currentUser) {
        alert('Please sign in to upgrade');
        window.location.href = 'signin.html?redirect=upgrade';
        return;
    }
    
    console.log('User ID:', currentUser.uid);
    console.log('User Email:', currentUser.email);
    console.log('Is Annual:', isAnnual);
    
    upgradeToCurateBtn.disabled = true;
    upgradeToCurateBtn.textContent = 'Loading...';
    
    try {
        // Select price based on billing period
        const priceId = isAnnual ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly;
        console.log('Selected Price ID:', priceId);
        
        // Call Netlify Function to create checkout session
        console.log('Calling function at: /.netlify/functions/create-checkout-session');
        const response = await fetch('/.netlify/functions/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: priceId,
                customerId: currentUser.uid,
                userEmail: currentUser.email
            })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Function error:', errorData);
            throw new Error(errorData.error || 'Failed to create checkout session');
        }
        
        const data = await response.json();
        console.log('Session created:', data);
        
        const { sessionId } = data;
        console.log('Session ID:', sessionId);
        
        // Redirect to Stripe Checkout (opens as overlay/popup)
        console.log('Redirecting to Stripe Checkout...');
        const { error } = await stripe.redirectToCheckout({ sessionId });
        
        if (error) {
            console.error('Stripe redirect error:', error);
            throw new Error(error.message);
        }
        
    } catch (error) {
        console.error('=== CHECKOUT ERROR ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        alert('Payment setup failed: ' + error.message);
        upgradeToCurateBtn.disabled = false;
        upgradeToCurateBtn.textContent = 'Upgrade to Curate';
    }
});

// Premium Waitlist Modal
premiumWaitlistBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert('Please sign in to join the waitlist');
        window.location.href = 'signin.html?redirect=upgrade';
        return;
    }
    
    premiumWaitlistModal.classList.remove('hidden');
});

// Close Modal
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        premiumWaitlistModal.classList.add('hidden');
        waitlistModalMessage.classList.add('hidden');
    });
});

// Close modal on outside click
premiumWaitlistModal.addEventListener('click', (e) => {
    if (e.target === premiumWaitlistModal) {
        premiumWaitlistModal.classList.add('hidden');
        waitlistModalMessage.classList.add('hidden');
    }
});

// Premium Waitlist Form
premiumWaitlistFormModal.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        showWaitlistModalMessage('Please sign in to join the waitlist', 'error');
        return;
    }
    
    joinWaitlistModalBtn.disabled = true;
    joinWaitlistModalBtn.textContent = 'Joining...';
    
    try {
        await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .set({
                premiumWaitlist: true,
                premiumWaitlistDate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        
        showWaitlistModalMessage('✅ You\'re on the list! We\'ll notify you when Premium launches.', 'success');
        
        setTimeout(() => {
            premiumWaitlistModal.classList.add('hidden');
            premiumWaitlistBtn.textContent = 'On Waitlist';
            premiumWaitlistBtn.disabled = true;
        }, 2000);
        
    } catch (error) {
        console.error('Waitlist error:', error);
        showWaitlistModalMessage('Failed to join waitlist. Please try again.', 'error');
        joinWaitlistModalBtn.disabled = false;
        joinWaitlistModalBtn.textContent = 'Join Waitlist';
    }
});

function showWaitlistModalMessage(message, type) {
    waitlistModalMessage.textContent = message;
    waitlistModalMessage.className = `waitlist-message ${type}`;
    waitlistModalMessage.classList.remove('hidden');
}

// Handle successful upgrade redirect
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('upgraded') === 'true') {
    // TODO: Update user plan in Firestore
    // This should be done by a webhook from Stripe when payment succeeds
    alert('✅ Welcome to Curate! Your upgrade is complete.');
}
