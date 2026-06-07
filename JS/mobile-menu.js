// ============================================================
// MOBILE MENU TOGGLE
// Reusable across all pages with the header
// ============================================================

(function() {
    document.addEventListener('DOMContentLoaded', function() {
        const toggleBtn = document.getElementById('mobileMenuToggle');
        const closeBtn = document.getElementById('mobileMenuClose');
        const nav = document.getElementById('mainNav');
        const backdrop = document.getElementById('mobileMenuBackdrop');
        const body = document.body;
        
        if (!toggleBtn || !nav) return;
        
        function openMenu() {
            nav.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
            body.classList.add('menu-open');
        }
        
        function closeMenu() {
            nav.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            body.classList.remove('menu-open');
        }
        
        // Open menu when hamburger clicked
        toggleBtn.addEventListener('click', openMenu);
        
        // Close menu when X clicked
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMenu);
        }
        
        // Close menu when backdrop clicked
        if (backdrop) {
            backdrop.addEventListener('click', closeMenu);
        }
        
        // Close menu when ESC key pressed
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                closeMenu();
            }
        });
        
        // Close menu when nav link clicked (mobile)
        const navLinks = nav.querySelectorAll('a');
        navLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    closeMenu();
                }
            });
        });
    });
})();
