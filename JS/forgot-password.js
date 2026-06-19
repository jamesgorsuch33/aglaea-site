// ============================================================
// FORGOT PASSWORD - Uses Firebase Auth directly
// Firebase sends the email (customized in Firebase Console)
// ============================================================

import { auth } from './firebase-config-v2.js';
import { 
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

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
        // Use Firebase to send password reset email
        await sendPasswordResetEmail(auth, email);
        
        // Show success message
        showSuccessMessage(email);
        
    } catch (error) {
        console.error('Password reset error:', error);
        
        // For security: show success message even if email doesn't exist
        // This prevents attackers from discovering valid user emails
        if (error.code === 'auth/user-not-found') {
            // Still show success - don't reveal that user doesn't exist
            showSuccessMessage(email);
        } else if (error.code === 'auth/invalid-email') {
            showFieldError('email', 'Please enter a valid email address');
            resetButton('submitBtn');
            document.getElementById('submitBtn').textContent = 'Send Reset Link';
        } else if (error.code === 'auth/too-many-requests') {
            showFieldError('email', 'Too many requests. Please try again later.');
            resetButton('submitBtn');
            document.getElementById('submitBtn').textContent = 'Send Reset Link';
        } else {
            // For other errors, still show success for security
            showSuccessMessage(email);
        }
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
