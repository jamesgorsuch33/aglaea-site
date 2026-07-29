/* ============================================================
   NAV AUTH STATE
   ============================================================
   Shared across every marketing page. Swaps the header's
   "Sign In" + "Get Started" links for a single "Dashboard" link
   when the visitor is already signed in — so someone who's
   logged in never gets sent back to sign-in from the header,
   regardless of which page they're on.

   Requires: Firebase App + Auth compat SDKs and js/firebase-config.js
   loaded before this script, and the header nav to have
   id="mainNav" (already the case on every canonical header built
   this project) with the Sign In / Get Started links pointing at
   signin.html / signup.html (root-relative or ../-prefixed, both
   handled).

   Does nothing if the visitor is logged out, or if the expected
   links/nav container aren't found — safe to include on any page,
   including ones that don't have this specific nav pattern (e.g.
   dashboard.html), where it will simply no-op.
   ============================================================ */

firebase.auth().onAuthStateChanged((user) => {
    if (!user) return; // logged out — leave the default nav as-is

    const nav = document.getElementById('mainNav');
    if (!nav) return;

    // Match by href ending, so this works identically whether the
    // page links to "signin.html" (root pages) or "../signin.html"
    // (e.g. individual blog posts in the blog/ subfolder).
    const signInLink = nav.querySelector('a[href$="signin.html"]');
    const getStartedLink = nav.querySelector('a[href$="signup.html"]');

    if (signInLink) {
        // Derive the correct relative path to dashboard.html from
        // whatever prefix the existing signin.html link already
        // uses, rather than hardcoding root-relative paths that
        // would break on pages in a subfolder.
        const currentHref = signInLink.getAttribute('href');
        const prefix = currentHref.replace('signin.html', '');
        signInLink.textContent = 'Dashboard';
        signInLink.setAttribute('href', prefix + 'dashboard.html');
    }

    if (getStartedLink) {
        getStartedLink.remove();
    }
});
