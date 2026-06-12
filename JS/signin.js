// ============================================================
// SIGN IN - With Inline Validation + Loading States
// ============================================================

import { auth } from './firebase-config-v2.js';
import { 
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    showFieldError,
    clearFieldError,
    clearAllErrors,
    validateEmail,
    validateRequired,
    setButtonLoading,
    resetButton,
    setupFieldValidation
} from './form-validation.js';

// ============================================================
// AUTO-REDIRECT IF ALREADY LOGGED IN
// ============================================================

onAuthStateChanged(auth, function(user) {
    if (user) {
        window.location.href = 'dashboard.html';
    }
});

// ============================================================
// REAL-TIME VALIDATION
// ============================================================

setupFieldValidation('email', function(value) {
    return validateEmail(value);
});

setupFieldValidation('password', function(value) {
    return validateRequired(value, 'Password');
});

// ============================================================
// SIGN IN FORM SUBMIT
// ============================================================

const signinForm = document.getElementById('signinForm');
if (signinForm) {
    signinForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        clearAllErrors('signinForm');
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        let hasErrors = false;
        
        // Validate
        const emailCheck = validateEmail(email);
        if (!emailCheck.valid) {
            showFieldError('email', emailCheck.message);
            hasErrors = true;
        }
        
        const passwordCheck = validateRequired(password, 'Password');
        if (!passwordCheck.valid) {
            showFieldError('password', passwordCheck.message);
            hasErrors = true;
        }
        
        if (hasErrors) {
            return;
        }
        
        // Set loading state
        setButtonLoading('signinBtn', 'Signing in...');
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Redirect happens via onAuthStateChanged
            window.location.href = 'dashboard.html';
            
        } catch (error) {
            console.error('Sign in error:', error);
            
            resetButton('signinBtn');
            
            // Show field-specific errors
            switch (error.code) {
                case 'auth/user-not-found':
                    showFieldError('email', 'No account found with this email. Please sign up first.');
                    document.getElementById('email').focus();
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    showFieldError('password', 'Incorrect password. Please try again.');
                    document.getElementById('password').focus();
                    document.getElementById('password').select();
                    break;
                case 'auth/invalid-email':
                    showFieldError('email', 'Please enter a valid email address');
                    break;
                case 'auth/too-many-requests':
                    showFieldError('password', 'Too many failed attempts. Please try again later or reset your password.');
                    break;
                case 'auth/network-request-failed':
                    showFieldError('email', 'Network error. Please check your connection and try again.');
                    break;
                default:
                    showFieldError('password', 'Sign in failed. Please try again.');
            }
        }
    });
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

const forgotPasswordLink = document.getElementById('forgotPasswordLink');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async function(e) {
        e.preventDefault();
        
        clearAllErrors('signinForm');
        
        const email = document.getElementById('email').value.trim();
        
        // Validate email first
        const emailCheck = validateEmail(email);
        if (!emailCheck.valid) {
            showFieldError('email', 'Please enter your email address first');
            document.getElementById('email').focus();
            return;
        }
        
        try {
            await sendPasswordResetEmail(auth, email);
            alert('Password reset email sent! Please check your inbox (and spam folder).');
        } catch (error) {
            console.error('Reset email error:', error);
            
            if (error.code === 'auth/user-not-found') {
                showFieldError('email', 'No account found with this email');
            } else {
                showFieldError('email', 'Failed to send reset email. Please try again.');
            }
        }
    });
}
