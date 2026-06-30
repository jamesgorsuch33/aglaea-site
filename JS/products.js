// Products Brands Page - Filtering & Sorting JavaScript

// ============================================================
// CONFIG
// ============================================================
const PRODUCTS_PER_PAGE = 15;
let showingAll = false;

// ============================================================
// SESSION-STABLE RANDOM ORDER
// Each product card gets a "data-order-key" id (its own DOM
// position index) shuffled once per browser session. The shuffled
// order is stored in sessionStorage so that navigating back to
// this page later in the same session shows the same order.
// A brand-new session (new tab opened fresh, or sessionStorage
// cleared) will reshuffle.
// ============================================================
function getShuffledOrder(count) {
    const storageKey = 'aglaea-product-order';
    const stored = sessionStorage.getItem(storageKey);

    if (stored) {
        const parsed = JSON.parse(stored);
        // Use stored order only if it matches the current product count
        if (Array.isArray(parsed) && parsed.length === count) {
            return parsed;
        }
    }

    // Fisher-Yates shuffle of indices [0, 1, ..., count - 1]
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }

    sessionStorage.setItem(storageKey, JSON.stringify(order));
    return order;
}

// Tag every card with its original index, then reorder the DOM
// to match the session's shuffled order. Runs once on page load.
function applySessionShuffle() {
    const grid = document.getElementById('brands-grid');
    const cards = Array.from(document.querySelectorAll('.brand-card'));

    cards.forEach((card, i) => card.setAttribute('data-original-index', i));

    const order = getShuffledOrder(cards.length);

    order.forEach(originalIndex => {
        const card = cards[originalIndex];
        if (card) grid.appendChild(card);
    });
}

// Toggle mobile filters
function toggleMobileFilters() {
    const sidebar = document.querySelector('.filters-sidebar');
    sidebar.classList.toggle('mobile-active');
}

// Filter products based on selected checkboxes
function filterProducts() {
    const brandCards = document.querySelectorAll('.brand-card');

    // Each filter group is identified by its own checkbox values rather
    // than DOM position, so adding/removing filter groups (e.g. Recipient)
    // never breaks this logic.
    const occasionValues = ['birthday', 'anniversary', 'wedding', 'mothers-day', 'fathers-day', 'just-because'];
    const recipientValues = ['for-her', 'for-him'];

    const checkedValues = Array.from(document.querySelectorAll('.filter-group input[type="checkbox"]:checked')).map(cb => cb.value);

    const occasionFilters = checkedValues.filter(v => occasionValues.includes(v));
    const recipientFilters = checkedValues.filter(v => recipientValues.includes(v));
    const brandFilters = checkedValues.filter(v => !occasionValues.includes(v) && !recipientValues.includes(v));

    let matchedCards = [];

    brandCards.forEach(card => {
        const cardBrand = card.getAttribute('data-brand');
        const cardOccasions = card.getAttribute('data-occasions').split(',');

        let showCard = true;

        // Check occasion filters
        if (occasionFilters.length > 0) {
            const hasMatchingOccasion = occasionFilters.some(occasion => cardOccasions.includes(occasion));
            if (!hasMatchingOccasion) {
                showCard = false;
            }
        }

        // Check recipient filters (For Her / For Him)
        if (recipientFilters.length > 0) {
            const hasMatchingRecipient = recipientFilters.some(recipient => cardOccasions.includes(recipient));
            if (!hasMatchingRecipient) {
                showCard = false;
            }
        }

        // Check brand filters
        if (brandFilters.length > 0) {
            if (!brandFilters.includes(cardBrand)) {
                showCard = false;
            }
        }

        if (showCard) {
            matchedCards.push(card);
        } else {
            card.style.display = 'none';
        }
    });

    applyPagination(matchedCards);
}

// Show only the first PRODUCTS_PER_PAGE matched cards (in their current
// DOM/session order), unless "Show All" has been activated.
function applyPagination(matchedCards) {
    const limit = showingAll ? matchedCards.length : PRODUCTS_PER_PAGE;

    matchedCards.forEach((card, i) => {
        card.style.display = i < limit ? 'flex' : 'none';
    });

    document.getElementById('product-count').textContent = matchedCards.length;

    const noResults = document.getElementById('no-results');
    noResults.style.display = matchedCards.length === 0 ? 'block' : 'none';

    updateShowAllButton(matchedCards.length, limit);
}

// Show, hide, or update the "Show All" button depending on how many
// products are currently matched vs. how many are visible.
function updateShowAllButton(totalMatched, currentlyShown) {
    const btn = document.getElementById('show-all-btn');
    if (!btn) return;

    if (totalMatched <= PRODUCTS_PER_PAGE) {
        // Nothing to expand — hide the control entirely
        btn.style.display = 'none';
        return;
    }

    btn.style.display = 'inline-block';

    if (showingAll) {
        btn.textContent = `Show fewer products`;
    } else {
        const remaining = totalMatched - currentlyShown;
        btn.textContent = `Show all ${totalMatched} products (${remaining} more)`;
    }
}

// Toggle between paginated (15) and full product view
function toggleShowAll() {
    showingAll = !showingAll;
    filterProducts();

    if (!showingAll) {
        // Scroll back to the top of the grid when collapsing, so the
        // user isn't left stranded halfway down a now-shorter page
        document.getElementById('brands-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Clear all filters
function clearAllFilters() {
    // Uncheck all checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Reset sort to default
    document.getElementById('sort-select').value = 'default';

    // Reset pagination
    showingAll = false;

    // Show all brands (paginated)
    filterProducts();
}

// Sort products
function sortProducts() {
    const grid = document.getElementById('brands-grid');
    const cards = Array.from(document.querySelectorAll('.brand-card'));
    const sortValue = document.getElementById('sort-select').value;

    let sortedCards;

    switch (sortValue) {
        case 'name-asc':
            sortedCards = cards.sort((a, b) => {
                const nameA = a.querySelector('.brand-name').textContent;
                const nameB = b.querySelector('.brand-name').textContent;
                return nameA.localeCompare(nameB);
            });
            break;

        case 'name-desc':
            sortedCards = cards.sort((a, b) => {
                const nameA = a.querySelector('.brand-name').textContent;
                const nameB = b.querySelector('.brand-name').textContent;
                return nameB.localeCompare(nameA);
            });
            break;

        default:
            // "Featured" = this session's shuffled random order.
            // Re-sort by the original-index order stored in sessionStorage
            // so switching back to "Featured" restores the shuffle rather
            // than whatever order the DOM happens to be in.
            const order = getShuffledOrder(cards.length);
            const byOriginalIndex = new Map(cards.map(card => [Number(card.getAttribute('data-original-index')), card]));
            sortedCards = order.map(i => byOriginalIndex.get(i)).filter(Boolean);
    }

    // Re-append in sorted order
    sortedCards.forEach(card => grid.appendChild(card));

    // Re-apply current filters/pagination on top of the new order
    filterProducts();
}

// Close mobile filters when clicking outside
document.addEventListener('click', function (event) {
    const sidebar = document.querySelector('.filters-sidebar');
    const toggleButton = document.querySelector('.mobile-filters-toggle');

    if (sidebar && toggleButton) {
        if (!sidebar.contains(event.target) && !toggleButton.contains(event.target)) {
            sidebar.classList.remove('mobile-active');
        }
    }
});

// ============================================================
// INITIAL PAGE LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    applySessionShuffle();
    filterProducts();
});
