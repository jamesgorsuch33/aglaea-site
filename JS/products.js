// Products Brands Page - Filtering & Sorting JavaScript

// Toggle mobile filters
function toggleMobileFilters() {
    const sidebar = document.querySelector('.filters-sidebar');
    sidebar.classList.toggle('mobile-active');
}

// Filter products based on selected checkboxes
function filterProducts() {
    const brandCards = document.querySelectorAll('.brand-card');
    const occasionFilters = Array.from(document.querySelectorAll('.filter-group:first-child input[type="checkbox"]:checked')).map(cb => cb.value);
    const brandFilters = Array.from(document.querySelectorAll('.filter-group:last-child input[type="checkbox"]:checked')).map(cb => cb.value);
    
    let visibleCount = 0;
    
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
        
        // Check brand filters
        if (brandFilters.length > 0) {
            if (!brandFilters.includes(cardBrand)) {
                showCard = false;
            }
        }
        
        // Show or hide card
        if (showCard) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Update count
    document.getElementById('product-count').textContent = visibleCount;
    
    // Show/hide no results message
    const noResults = document.getElementById('no-results');
    if (visibleCount === 0) {
        noResults.style.display = 'block';
    } else {
        noResults.style.display = 'none';
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
    
    // Show all brands
    filterProducts();
    sortProducts();
}

// Sort products
function sortProducts() {
    const grid = document.getElementById('brands-grid');
    const cards = Array.from(document.querySelectorAll('.brand-card'));
    const sortValue = document.getElementById('sort-select').value;
    
    let sortedCards;
    
    switch(sortValue) {
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
            // Default order (as in HTML)
            sortedCards = cards;
    }
    
    // Re-append in sorted order
    sortedCards.forEach(card => grid.appendChild(card));
}

// Close mobile filters when clicking outside
document.addEventListener('click', function(event) {
    const sidebar = document.querySelector('.filters-sidebar');
    const toggleButton = document.querySelector('.mobile-filters-toggle');
    
    if (sidebar && toggleButton) {
        if (!sidebar.contains(event.target) && !toggleButton.contains(event.target)) {
            sidebar.classList.remove('mobile-active');
        }
    }
});
