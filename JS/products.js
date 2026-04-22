/* ============================================================
   PRODUCTS PAGE LOGIC
   ============================================================ */

// TODO: Replace these with YOUR actual Awin/Rakuten affiliate links
// Structure: https://www.awin1.com/cread.php?awinmid=MERCHANT_ID&awinaffid=YOUR_PUBLISHER_ID&p=BRAND_HOMEPAGE

const AFFILIATE_LINKS = {
    nicchiaLuxury: 'https://www.nicchialuxury.com', // Replace with your affiliate link
    joLoves: 'https://www.joloves.com', // Replace with your affiliate link
    vilebrequin: 'https://www.vilebrequin.com/uk', // Replace with your affiliate link
    mappinWebb: 'https://www.mappinandwebb.com', // Replace with your affiliate link
    purelyDiamonds: 'https://www.purelydiamonds.co.uk', // Replace with your affiliate link
    normanWalsh: 'https://www.normanwalshfootwear.com', // Replace with your affiliate link
    deanMorrisCards: 'https://www.deanmorriscards.co.uk', // Replace with your affiliate link
    scribbler: 'https://www.scribbler.com' // Replace with your affiliate link
};

// Brand Data
const brands = [
    {
        id: 'nicchia-luxury',
        name: 'Nicchia Luxury Fragrances',
        icon: '🌿',
        description: 'Exclusive niche fragrances and luxury scents',
        priceRange: 'From £45',
        priceMin: 45,
        link: AFFILIATE_LINKS.nicchiaLuxury,
        occasions: ['birthday', 'anniversary', 'mothers-day', 'valentines', 'christmas', 'just-because', 'all']
    },
    {
        id: 'jo-loves',
        name: 'Jo Loves',
        icon: '🕯️',
        description: 'Luxury fragrances, candles, and bath products by Jo Malone',
        priceRange: 'From £28',
        priceMin: 28,
        link: AFFILIATE_LINKS.joLoves,
        occasions: ['birthday', 'mothers-day', 'valentines', 'anniversary', 'christmas', 'just-because', 'all']
    },
    {
        id: 'vilebrequin',
        name: 'Vilebrequin',
        icon: '🏖️',
        description: 'Luxury swimwear and resort wear from St. Tropez',
        priceRange: 'From £50',
        priceMin: 50,
        link: AFFILIATE_LINKS.vilebrequin,
        occasions: ['birthday', 'fathers-day', 'anniversary', 'just-because', 'all']
    },
    {
        id: 'mappin-webb',
        name: 'Mappin & Webb',
        icon: '💍',
        description: 'Fine jewelry, watches, and luxury gifts since 1775',
        priceRange: 'From £100',
        priceMin: 100,
        link: AFFILIATE_LINKS.mappinWebb,
        occasions: ['anniversary', 'birthday', 'valentines', 'mothers-day', 'just-because', 'all']
    },
    {
        id: 'purely-diamonds',
        name: 'Purely Diamonds',
        icon: '💎',
        description: 'Stunning diamond jewelry and engagement rings',
        priceRange: 'From £150',
        priceMin: 150,
        link: AFFILIATE_LINKS.purelyDiamonds,
        occasions: ['anniversary', 'valentines', 'birthday', 'just-because', 'all']
    },
    {
        id: 'norman-walsh',
        name: 'Norman Walsh',
        icon: '👟',
        description: 'Handcrafted British footwear and running shoes',
        priceRange: 'From £85',
        priceMin: 85,
        link: AFFILIATE_LINKS.normanWalsh,
        occasions: ['birthday', 'fathers-day', 'christmas', 'just-because', 'all']
    },
    {
        id: 'dean-morris',
        name: 'Dean Morris Cards',
        icon: '✉️',
        description: 'Unique and humorous greeting cards',
        priceRange: 'From £3',
        priceMin: 3,
        link: AFFILIATE_LINKS.deanMorrisCards,
        occasions: ['birthday', 'anniversary', 'mothers-day', 'fathers-day', 'valentines', 'christmas', 'just-because', 'all']
    },
    {
        id: 'scribbler',
        name: 'Scribbler',
        icon: '💌',
        description: 'Fun and quirky cards and small gifts',
        priceRange: 'From £3',
        priceMin: 3,
        link: AFFILIATE_LINKS.scribbler,
        occasions: ['birthday', 'anniversary', 'mothers-day', 'fathers-day', 'valentines', 'christmas', 'just-because', 'all']
    }
];

// State
let filteredBrands = [...brands];
let currentOccasion = 'all';
let currentSort = 'recommended';

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const occasionFilter = document.getElementById('occasionFilter');
const sortFilter = document.getElementById('sortFilter');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check URL params for occasion filter (from dashboard "Shop Gifts" button)
    const urlParams = new URLSearchParams(window.location.search);
    const occasionParam = urlParams.get('occasion');
    if (occasionParam) {
        occasionFilter.value = occasionParam;
        currentOccasion = occasionParam;
    }
    
    renderProducts();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    occasionFilter.addEventListener('change', (e) => {
        currentOccasion = e.target.value;
        filterAndSort();
    });
    
    sortFilter.addEventListener('change', (e) => {
        currentSort = e.target.value;
        filterAndSort();
    });
}

// Filter and Sort
function filterAndSort() {
    // Filter by occasion
    if (currentOccasion === 'all') {
        filteredBrands = [...brands];
    } else {
        filteredBrands = brands.filter(brand => 
            brand.occasions.includes(currentOccasion)
        );
    }
    
    // Sort
    switch (currentSort) {
        case 'price-low':
            filteredBrands.sort((a, b) => a.priceMin - b.priceMin);
            break;
        case 'price-high':
            filteredBrands.sort((a, b) => b.priceMin - a.priceMin);
            break;
        case 'name':
            filteredBrands.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'recommended':
        default:
            // Keep original order (manually curated)
            break;
    }
    
    renderProducts();
}

// Render Products
function renderProducts() {
    if (filteredBrands.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">🔍</div>
                <p>No brands found for this occasion.</p>
                <p>Try selecting "All Occasions" to see all available brands.</p>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = filteredBrands.map(brand => `
        <div class="brand-card">
            <div class="brand-icon">${brand.icon}</div>
            <h3>${brand.name}</h3>
            <p class="brand-description">${brand.description}</p>
            <p class="price-range">${brand.priceRange}</p>
            <div class="occasion-tags">
                ${getOccasionTags(brand.occasions)}
            </div>
            <a href="${brand.link}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                Shop Now
            </a>
        </div>
    `).join('');
}

// Get Occasion Tags (show first 3)
function getOccasionTags(occasions) {
    const displayOccasions = occasions
        .filter(occ => occ !== 'all')
        .slice(0, 3)
        .map(occ => `<span>${formatOccasion(occ)}</span>`)
        .join('');
    
    return displayOccasions || '<span>All Occasions</span>';
}

// Format Occasion
function formatOccasion(occasion) {
    const formatted = {
        'birthday': 'Birthday',
        'anniversary': 'Anniversary',
        'mothers-day': "Mother's Day",
        'fathers-day': "Father's Day",
        'valentines': "Valentine's",
        'christmas': 'Christmas'
        'just-because': 'Just Because'
    };
    return formatted[occasion] || occasion;
}

// Track clicks (optional - for analytics)
productsGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-primary')) {
        const brandCard = e.target.closest('.brand-card');
        const brandName = brandCard.querySelector('h3').textContent;
        console.log(`User clicked: ${brandName}`);
        // TODO: Send to analytics if you have Google Analytics set up
    }
});

// Premium Waitlist Form
const premiumWaitlistForm = document.getElementById('premiumWaitlistForm');
const joinWaitlistBtn = document.getElementById('joinWaitlistBtn');
const waitlistMessage = document.getElementById('waitlistMessage');

if (premiumWaitlistForm) {
    premiumWaitlistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Check if user is logged in
        const user = firebase.auth().currentUser;
        
        if (!user) {
            showWaitlistMessage('Please sign in to join the waitlist', 'error');
            setTimeout(() => {
                window.location.href = 'signin.html?redirect=products';
            }, 1500);
            return;
        }
        
        // Disable button
        joinWaitlistBtn.disabled = true;
        joinWaitlistBtn.textContent = 'Joining...';
        
        try {
            // Add to Premium waitlist in Firestore
            await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .set({
                    premiumWaitlist: true,
                    premiumWaitlistDate: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            
            showWaitlistMessage('✅ You\'re on the list! We\'ll notify you when Premium launches.', 'success');
            joinWaitlistBtn.textContent = 'You\'re on the Waitlist';
            
        } catch (error) {
            console.error('Waitlist error:', error);
            showWaitlistMessage('Failed to join waitlist. Please try again.', 'error');
            joinWaitlistBtn.disabled = false;
            joinWaitlistBtn.textContent = 'Join Waitlist';
        }
    });
}

function showWaitlistMessage(message, type) {
    waitlistMessage.textContent = message;
    waitlistMessage.className = `waitlist-message ${type}`;
    waitlistMessage.classList.remove('hidden');
}

// Check if user is already on waitlist
firebase.auth().onAuthStateChanged(async (user) => {
    if (user && premiumWaitlistForm) {
        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(user.uid)
                .get();
            
            if (userDoc.exists && userDoc.data().premiumWaitlist) {
                joinWaitlistBtn.textContent = 'You\'re on the Waitlist';
                joinWaitlistBtn.disabled = true;
                showWaitlistMessage('✅ You\'re already on the Premium waitlist', 'success');
            }
        } catch (error) {
            console.error('Error checking waitlist status:', error);
        }
    }
});
