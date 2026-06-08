(function() {
    document.addEventListener('DOMContentLoaded', function() {
        const toggleBtn = document.getElementById('mobileMenuToggle');
        const closeBtn = document.getElementById('mobileMenuClose');
        const nav = document.getElementById('mainNav');
        const backdrop = document.getElementById('mobileMenuBackdrop');
        
        // DEBUG: Show what was found
        alert('Toggle: ' + (toggleBtn ? 'FOUND' : 'MISSING') + '\nNav: ' + (nav ? 'FOUND' : 'MISSING') + '\nBackdrop: ' + (backdrop ? 'FOUND' : 'MISSING'));
        
        if (!toggleBtn || !nav) return;
        
        function openMenu() {
            alert('OPEN MENU CLICKED');
            nav.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
            document.body.classList.add('menu-open');
        }
        
        function closeMenu() {
            nav.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
        
        toggleBtn.addEventListener('click', openMenu);
        
        if (closeBtn) closeBtn.addEventListener('click', closeMenu);
        if (backdrop) backdrop.addEventListener('click', closeMenu);
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeMenu();
        });
    });
})();
