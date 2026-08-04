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
                    We use cookies to make AGLAEA work properly, and — only with your permission — to understand how the site is used.
                    Essential cookies can't be turned off, as the site won't function without them.
                    See our <a href="/cookie-policy.html">Cookie Policy</a> for details.
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
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 3000;
                background: var(--charcoal, #2c2c2c);
                color: var(--cream, #faf7f2);
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
                font-family: var(--font-body, 'Inter', sans-serif);
            }
            .cookie-consent-inner {
                max-width: 1200px;
                margin: 0 auto;
                padding: 1.25rem 1.5rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1.5rem;
                flex-wrap: wrap;
            }
            .cookie-consent-text {
                flex: 1;
                min-width: 260px;
                font-size: 0.875rem;
                line-height: 1.5;
                margin: 0;
                color: rgba(250, 247, 242, 0.9);
            }
            .cookie-consent-text a {
                color: var(--gold, #c9a870);
                text-decoration: underline;
            }
            .cookie-consent-actions {
                display: flex;
                gap: 0.75rem;
                flex-shrink: 0;
            }
            .cookie-consent-btn {
                padding: 0.625rem 1.25rem;
                border-radius: 4px;
                font-size: 0.875rem;
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
                .cookie-consent-inner {
                    flex-direction: column;
                    align-items: stretch;
                }
                .cookie-consent-actions {
                    justify-content: stretch;
                }
                .cookie-consent-btn {
                    flex: 1;
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
