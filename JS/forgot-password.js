// ============================================================
// FORGOT PASSWORD - Uses our custom Netlify function
// for fully branded AGLAEA email via Resend
// ============================================================

import {
    showFieldError,
    clearFieldError,
    validateEmail,
    setButtonLoading,
    resetButton
} from './form-validation.js';

// ============================================================
// SETUP REAL-TIME VALIDATION
// ============================================================

const emailInput = document.getElementById('email');
emailInput.addEventListener('blur', function() {
    const value = emailInput.value.trim();
    if (!value) {
        clearFieldError('email');
    } else if (!validateEmail(value)) {
        showFieldError('email', 'Please enter a valid email address');
    } else {
        clearFieldError('email');
    }
});

emailInput.addEventListener('input', function() {
    if (emailInput.value.trim() && validateEmail(emailInput.value.trim())) {
        clearFieldError('email');
    }
});

// ============================================================
// HANDLE FORM SUBMISSION
// ============================================================

const form = document.getElementById('forgotPasswordForm');

form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    // Validate
    if (!email) {
        showFieldError('email', 'Please enter your email address');
        emailInput.focus();
        return;
    }
    
    if (!validateEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        emailInput.focus();
        return;
    }
    
    clearFieldError('email');
    
    // Set loading state
    setButtonLoading('submitBtn', 'Sending...');
    
    try {
        // Call our Netlify function to send branded email
        const response = await fetch('/.netlify/functions/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        
        const result = await response.json();
        
        // Always show success message (security best practice)
        // Function returns success even if email doesn't exist
        showSuccessMessage(email);
        
    } catch (error) {
        console.error('Password reset error:', error);
        // For security, show success even on errors
        showSuccessMessage(email);
    }
});

// ============================================================
// SHOW SUCCESS MESSAGE
// ============================================================

function showSuccessMessage(email) {
    const formView = document.getElementById('formView');
    const successView = document.getElementById('successView');
    const sentEmail = document.getElementById('sentEmail');
    
    sentEmail.textContent = email;
    
    formView.style.display = 'none';
    successView.style.display = 'block';
}

// ============================================================
// RESEND LINK HANDLER
// ============================================================

document.getElementById('resendLink').addEventListener('click', function(e) {
    e.preventDefault();
    
    const formView = document.getElementById('formView');
    const successView = document.getElementById('successView');
    
    successView.style.display = 'none';
    formView.style.display = 'block';
    
    resetButton('submitBtn');
    document.getElementById('submitBtn').textContent = 'Send Reset Link';
    
    emailInput.focus();
});
