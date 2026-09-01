/* ============================================================
   LANDING PAGE SANDBOX
   Lets a visitor pick a relationship + occasion and see a live
   sample of the kind of curated edit AGLAEA would actually send
   them — no account needed. Reads the same product-data.json
   used everywhere else on the site, so results are always real,
   current products, not a hardcoded demo set.
   ============================================================ */

(function () {
    const PRODUCT_DATA_URL = '/product-data.json';

    // Relationships with a clear, unambiguous gender association —
    // anything not listed here (Partner, Friend, Best Friend, Cousin,
    // etc.) is treated as ambiguous and shown products regardless of
    // forHer/forHim, rather than guessing.
    const HER_RELATIONSHIPS = new Set(['Mother', 'Sister', 'Daughter', 'Wife', 'Grandmother', 'Aunt', 'Niece']);
    const HIM_RELATIONSHIPS = new Set(['Father', 'Brother', 'Son', 'Husband', 'Grandfather', 'Uncle', 'Nephew']);

    const OCCASION_LABELS = {
        'birthday': 'Birthday',
        'anniversary': 'Anniversary',
        'wedding': 'Wedding',
        'mothers-day': "Mother's Day",
        'fathers-day': "Father's Day",
        'valentines': "Valentine's Day",
        'just-because': 'Just Because'
    };

    let allProducts = [];
    let productsLoadPromise = null;

    const relationshipSelect = document.getElementById('sandboxRelationship');
    const occasionSelect = document.getElementById('sandboxOccasion');
    const loadingEl = document.getElementById('sandboxLoading');
    const resultsEl = document.getElementById('sandboxResults');
    const headingEl = document.getElementById('sandboxResultsHeading');
    const gridEl = document.getElementById('sandboxGrid');
    const emptyEl = document.getElementById('sandboxEmpty');

    if (!relationshipSelect || !occasionSelect || !gridEl) return;

    function loadProducts() {
        if (productsLoadPromise) return productsLoadPromise;
        productsLoadPromise = fetch(PRODUCT_DATA_URL)
            .then(function (res) { return res.json(); })
            .then(function (data) { allProducts = Array.isArray(data) ? data : []; })
            .catch(function (err) {
                console.error('Sandbox: failed to load product data', err);
                allProducts = [];
            });
        return productsLoadPromise;
    }

    function shuffle(arr) {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = copy[i];
            copy[i] = copy[j];
            copy[j] = temp;
        }
        return copy;
    }

    function getGenderKey(relationship) {
        if (HER_RELATIONSHIPS.has(relationship)) return 'forHer';
        if (HIM_RELATIONSHIPS.has(relationship)) return 'forHim';
        return null;
    }

    function matchProducts(relationship, occasion) {
        // Valentine's Day has no dedicated product tagging in the
        // catalogue yet, so it borrows the birthday selection as a
        // reasonable stand-in rather than showing nothing at all.
        const effectiveOccasion = occasion === 'valentines' ? 'birthday' : occasion;
        const genderKey = getGenderKey(relationship);

        return allProducts.filter(function (p) {
            if (!p.occasions || p.occasions.indexOf(effectiveOccasion) === -1) return false;
            if (genderKey && !p[genderKey]) return false;
            return true;
        });
    }

    function escapeHtml(str) {
        if (str === undefined || str === null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, '&quot;');
    }

    function buildSandboxCard(product) {
        const a = document.createElement('a');
        a.href = product.affiliateUrl || '#';
        a.className = 'sandbox-card';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.innerHTML =
            '<div class="sandbox-card-image">' +
                '<img src="' + escapeAttr(product.imageUrl) + '" alt="' + escapeAttr(product.imageAlt || product.productName) + '" loading="lazy">' +
            '</div>' +
            '<div class="sandbox-card-info">' +
                '<p class="sandbox-card-brand">' + escapeHtml(product.brandName) + '</p>' +
                '<h3 class="sandbox-card-name">' + escapeHtml(product.productName) + '</h3>' +
                '<p class="sandbox-card-price">' + escapeHtml(product.priceText) + '</p>' +
            '</div>';
        return a;
    }

    function occasionLabel(occasion) {
        return OCCASION_LABELS[occasion] || occasion;
    }

    function render() {
        const relationship = relationshipSelect.value;
        const occasion = occasionSelect.value;

        resultsEl.classList.add('hidden');
        emptyEl.classList.add('hidden');
        gridEl.innerHTML = '';

        if (!relationship || !occasion) return;

        loadingEl.classList.remove('hidden');

        loadProducts().then(function () {
            loadingEl.classList.add('hidden');

            const matches = shuffle(matchProducts(relationship, occasion)).slice(0, 6);

            if (matches.length === 0) {
                emptyEl.classList.remove('hidden');
                return;
            }

            headingEl.innerHTML = 'Curated for your <em>' + escapeHtml(relationship) + "'s " + escapeHtml(occasionLabel(occasion)) + '</em>';

            const fragment = document.createDocumentFragment();
            const cardEls = [];
            matches.forEach(function (product) {
                const card = buildSandboxCard(product);
                cardEls.push(card);
                fragment.appendChild(card);
            });
            gridEl.appendChild(fragment);

            resultsEl.classList.remove('hidden');

            // Fade-in: wait a frame so the browser registers the cards'
            // starting (invisible) state before adding the class that
            // transitions them in — adding it in the same frame as
            // insertion would skip straight to the end state with no
            // visible animation. A small stagger per card reads better
            // than all six appearing at once.
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    cardEls.forEach(function (card, i) {
                        setTimeout(function () {
                            card.classList.add('sandbox-card-visible');
                        }, i * 60);
                    });
                });
            });
        });
    }

    relationshipSelect.addEventListener('change', render);
    occasionSelect.addEventListener('change', render);
})();
