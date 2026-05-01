// FAQ Accordion Functionality

document.addEventListener('DOMContentLoaded', function() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close other open items (optional - remove if you want multiple open at once)
            const wasActive = item.classList.contains('active');
            
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Toggle current item
            if (!wasActive) {
                item.classList.add('active');
            }
        });
    });
    
    // Optional: Open first item by default
    if (faqItems.length > 0) {
        faqItems[0].classList.add('active');
    }
});
