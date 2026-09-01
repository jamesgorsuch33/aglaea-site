/* ============================================================
   AGLAEA — COOKIE CONSENT
   ============================================================
   Shared across every page. Shows a bottom banner on first visit
   with "Accept All" / "Essential Only" — matches the Cookie Policy
   page's own existing wording ("Essential cookies cannot be
   rejected as they are strictly necessary"), so there's no third
   "reject everything" option, since that's not actually meaningful
   for cookies the site genuinely needs to function (e.g. staying
   signed in).

   Persists the choice in localStorage, so the banner only shows
   once. A small "Cookie Preferences" link (added to the footer)
   lets someone reopen it later to change their mind.

   Other scripts (e.g. AWIN's affiliate tracking snippet) should
   check window.aglaeaCookieConsent.hasConsent() before firing, and
   can listen for the 'aglaeaCookieConsent' event to react the
   moment a choice is made without needing a page reload.
   ============================================================ */

(function () {
    const STORAGE_KEY = 'aglaea_cookie_consent';
    const CONSENT_VERSION = 1;

    function getStoredConsent() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function storeConsent(accepted) {
        const record = {
            accepted: accepted,
            timestamp: new Date().toISOString(),
            version: CONSENT_VERSION
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        } catch (e) {
            console.error('Could not store cookie consent:', e);
        }
        window.dispatchEvent(new CustomEvent('aglaeaCookieConsent', { detail: record }));
    }

    // Public API for other scripts to check before firing anything
    // non-essential (analytics, affiliate tracking, etc.)
    window.aglaeaCookieConsent = {
        hasConsent: function () {
            const stored = getStoredConsent();
            return !!(stored && stored.accepted);
        },
        getChoice: function () {
            return getStoredConsent();
        },
        reopen: function () {
            showBanner();
        }
    };

    function buildBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookieConsentBanner';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.innerHTML = `
            <div class="cookie-consent-inner">
                <p class="cookie-consent-text">
                    We use cookies to run AGLAEA, and — only with permission — to understand site usage.
                    <a href="/cookie-policy.html">Cookie Policy</a>
                </p>
                <div class="cookie-consent-actions">
                    <button type="button" id="cookieConsentEssential" class="cookie-consent-btn cookie-consent-btn-secondary">Essential Only</button>
                    <button type="button" id="cookieConsentAccept" class="cookie-consent-btn cookie-consent-btn-primary">Accept All</button>
                </div>
            </div>
        `;
        return banner;
    }

    function injectStyles() {
        if (document.getElementById('cookieConsentStyles')) return;
        const style = document.createElement('style');
        style.id = 'cookieConsentStyles';
        style.textContent = `
            #cookieConsentBanner {
                position: fixed;
                left: 20px;
                bottom: 20px;
                z-index: 3000;
                max-width: 380px;
                background: var(--charcoal, #2c2c2c);
                color: var(--cream, #faf7f2);
                border-radius: 10px;
                box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
                font-family: var(--font-body, 'Inter', sans-serif);
            }
            .cookie-consent-inner {
                padding: 1rem 1.15rem;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            .cookie-consent-text {
                font-size: 0.8rem;
                line-height: 1.5;
                margin: 0;
                color: rgba(250, 247, 242, 0.9);
            }
            .cookie-consent-text a {
                color: var(--gold, #c9a870);
                text-decoration: underline;
                white-space: nowrap;
            }
            .cookie-consent-actions {
                display: flex;
                gap: 0.6rem;
            }
            .cookie-consent-btn {
                flex: 1;
                padding: 0.5rem 0.9rem;
                border-radius: 4px;
                font-size: 0.8rem;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid transparent;
                white-space: nowrap;
                font-family: inherit;
            }
            .cookie-consent-btn-primary {
                background: var(--gold, #c9a870);
                color: var(--charcoal, #2c2c2c);
            }
            .cookie-consent-btn-primary:hover {
                background: var(--deep-gold, #b8976a);
            }
            .cookie-consent-btn-secondary {
                background: transparent;
                color: var(--cream, #faf7f2);
                border-color: rgba(250, 247, 242, 0.35);
            }
            .cookie-consent-btn-secondary:hover {
                background: rgba(250, 247, 242, 0.1);
            }
            @media (max-width: 640px) {
                #cookieConsentBanner {
                    left: 12px;
                    right: 12px;
                    bottom: 12px;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function showBanner() {
        if (document.getElementById('cookieConsentBanner')) return; // already showing
        injectStyles();
        const banner = buildBanner();
        document.body.appendChild(banner);

        document.getElementById('cookieConsentAccept').addEventListener('click', function () {
            storeConsent(true);
            hideBanner();
        });
        document.getElementById('cookieConsentEssential').addEventListener('click', function () {
            storeConsent(false);
            hideBanner();
        });
    }

    function hideBanner() {
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) banner.remove();
    }

    document.addEventListener('DOMContentLoaded', function () {
        const existing = getStoredConsent();
        if (!existing || existing.version !== CONSENT_VERSION) {
            showBanner();
        }

        // Wire up any "Cookie Preferences" link on the page (e.g. in
        // the footer) to reopen the banner on demand.
        document.querySelectorAll('[data-reopen-cookie-consent]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                showBanner();
            });
        });
    });
})();
