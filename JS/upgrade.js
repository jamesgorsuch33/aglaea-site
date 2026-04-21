/* ============================================================
   UPGRADE PAGE LOGIC
   ============================================================ */

// TODO: Replace with your actual Stripe Publishable Key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TOYGgR1KZpwXwShJWiAldqS1lviLdZt24pZLzkspDYONgr1M8jyTu0QneUBHYpDYnAI7xPsN3RT7ec86YbMFpqg00zpFIdihG';
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

// TODO: Replace with your Stripe Price IDs (create these in Stripe Dashboard)
const STRIPE_PRICES = {
    monthly: 'price_1TOYP9R1KZpwXwSh4PB0pQy6',
    annual: 'price_1TOYTcR1KZpwXwShbmzcvLF9'
};

// State
let isAnnual = false;
let currentUser = null;

// DOM Elements
const billingToggle = document.getElementById('billingToggle');
const essentialPrice = document.getElementById('essentialPrice');
const essentialPeriod = document.getElementById('essentialPeriod');
const essentialAnnual = document.getElementById('essentialAnnual');
const upgradeToEssentialBtn = document.getElementById('upgradeToEssential');
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
        essentialPrice.textContent = '£49.99';
        essentialPeriod.textContent = '/year';
        essentialAnnual.textContent = 'Just £4.17/month — Save £10';
    } else {
        essentialPrice.textContent = '£4.99';
        essentialPeriod.textContent = '/month';
        essentialAnnual.textContent = '';
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
            const plan = userDoc.data().plan || 'free';
            
            if (plan === 'essential') {
                upgradeToEssentialBtn.textContent = 'Current Plan';
                upgradeToEssentialBtn.disabled = true;
            }
            
            // Check Premium waitlist status
            if (userDoc.data().premiumWaitlist) {
                premiumWaitlistBtn.textContent = 'On Waitlist';
                premiumWaitlistBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error checking user plan:', error);
    }
}

// Upgrade to Essential
upgradeToEssentialBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Please sign in to upgrade');
        window.location.href = 'signin.html?redirect=upgrade';
        return;
    }
    
    upgradeToEssentialBtn.disabled = true;
    upgradeToEssentialBtn.textContent = 'Processing...';
    
    try {
        // TODO: Replace this with actual Stripe Checkout Session creation
        // You'll need to create a serverless function or backend endpoint
        
        // For now, we'll use Stripe's client-only approach
        const priceId = isAnnual ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly;
        
        // Redirect to Stripe Checkout
        const { error } = await stripe.redirectToCheckout({
            lineItems: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            successUrl: window.location.origin + '/dashboard.html?upgraded=true',
            cancelUrl: window.location.origin + '/upgrade.html',
            customerEmail: currentUser.email,
            clientReferenceId: currentUser.uid
        });
        
        if (error) {
            console.error('Stripe error:', error);
            alert('Payment failed. Please try again.');
            upgradeToEssentialBtn.disabled = false;
            upgradeToEssentialBtn.textContent = 'Upgrade to Essential';
        }
        
    } catch (error) {
        console.error('Upgrade error:', error);
        alert('Something went wrong. Please try again.');
        upgradeToEssentialBtn.disabled = false;
        upgradeToEssentialBtn.textContent = 'Upgrade to Essential';
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
    alert('✅ Welcome to Essential! Your upgrade is complete.');
}
