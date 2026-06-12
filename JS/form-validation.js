// ============================================================
// FORM VALIDATION HELPERS
// Reusable across all forms in the app
// ============================================================

/**
 * Show inline error message under a field
 * @param {string} fieldId - The input field ID
 * @param {string} message - Error message to display
 */
export function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Add error class to field
    field.classList.add('field-error');
    
    // Find or create error message element
    const errorId = fieldId + '-error';
    let errorEl = document.getElementById(errorId);
    
    if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.id = errorId;
        errorEl.className = 'field-error-message';
        
        // Insert after field (or after the form-helper if it exists)
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            const existingHelper = formGroup.querySelector('.form-helper');
            if (existingHelper) {
                existingHelper.parentNode.insertBefore(errorEl, existingHelper.nextSibling);
            } else {
                field.parentNode.insertBefore(errorEl, field.nextSibling);
            }
        }
    }
    
    errorEl.textContent = '⚠ ' + message;
    errorEl.style.display = 'block';
}

/**
 * Clear error from a field
 * @param {string} fieldId - The input field ID
 */
export function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.remove('field-error');
    }
    
    const errorEl = document.getElementById(fieldId + '-error');
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
    }
}

/**
 * Clear all errors in a form
 * @param {string} formId - The form ID
 */
export function clearAllErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.querySelectorAll('.field-error').forEach(function(field) {
        field.classList.remove('field-error');
    });
    
    form.querySelectorAll('.field-error-message').forEach(function(msg) {
        msg.style.display = 'none';
        msg.textContent = '';
    });
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} { valid: boolean, message: string }
 */
export function validateEmail(email) {
    if (!email || !email.trim()) {
        return { valid: false, message: 'Email is required' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, message: 'Please enter a valid email address' };
    }
    
    return { valid: true, message: '' };
}

/**
 * Validate password
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, message: string }
 */
export function validatePassword(password) {
    if (!password) {
        return { valid: false, message: 'Password is required' };
    }
    
    if (password.length < 6) {
        return { valid: false, message: 'Password must be at least 6 characters' };
    }
    
    return { valid: true, message: '' };
}

/**
 * Validate required field
 * @param {string} value - Value to check
 * @param {string} fieldName - Friendly field name for error message
 * @returns {object} { valid: boolean, message: string }
 */
export function validateRequired(value, fieldName) {
    if (!value || !value.toString().trim()) {
        return { valid: false, message: fieldName + ' is required' };
    }
    return { valid: true, message: '' };
}

/**
 * Validate UK phone number (optional)
 * @param {string} phone - Phone to validate
 * @returns {object} { valid: boolean, message: string }
 */
export function validatePhone(phone) {
    if (!phone || !phone.trim()) {
        return { valid: true, message: '' }; // Phone is optional
    }
    
    // Allow +44, 0, spaces, and dashes
    const phoneRegex = /^(\+44|0)[\d\s-]{9,14}$/;
    const cleaned = phone.replace(/\s+/g, '');
    
    if (!phoneRegex.test(cleaned)) {
        return { valid: false, message: 'Please enter a valid UK phone number' };
    }
    
    return { valid: true, message: '' };
}

/**
 * Validate date is in the future
 * @param {string} dateString - Date string
 * @param {boolean} allowToday - Whether today's date is allowed
 * @returns {object} { valid: boolean, message: string }
 */
export function validateFutureDate(dateString, allowToday) {
    if (!dateString) {
        return { valid: false, message: 'Please select a date' };
    }
    
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (allowToday) {
        if (date < today) {
            return { valid: false, message: 'Date must be today or in the future' };
        }
    } else {
        if (date <= today) {
            return { valid: false, message: 'Date must be in the future' };
        }
    }
    
    return { valid: true, message: '' };
}

/**
 * Set button to loading state
 * @param {string} buttonId - Button ID
 * @param {string} loadingText - Optional custom loading text (defaults to existing)
 */
export function setButtonLoading(buttonId, loadingText) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    // Store original text
    if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.textContent;
    }
    
    btn.disabled = true;
    btn.classList.add('btn-loading');
    
    const text = loadingText || 'Loading...';
    btn.innerHTML = '<span class="btn-spinner"></span>' + text;
}

/**
 * Reset button from loading state
 * @param {string} buttonId - Button ID
 */
export function resetButton(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    
    if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
    }
}

/**
 * Show success message
 * @param {string} elementId - Element ID where to show success
 * @param {string} message - Success message
 * @param {number} duration - How long to show in ms (default 3000)
 */
export function showSuccess(elementId, message, duration) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    el.textContent = '✓ ' + message;
    el.classList.remove('hidden');
    el.classList.add('success-visible');
    
    const showDuration = duration || 3000;
    
    setTimeout(function() {
        el.classList.add('hidden');
        el.classList.remove('success-visible');
    }, showDuration);
}

/**
 * Setup real-time validation on a field
 * @param {string} fieldId - Field ID to validate
 * @param {function} validatorFn - Function that returns {valid, message}
 */
export function setupFieldValidation(fieldId, validatorFn) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    let validationTimeout;
    
    function validate() {
        const result = validatorFn(field.value);
        if (result.valid) {
            clearFieldError(fieldId);
        } else {
            showFieldError(fieldId, result.message);
        }
    }
    
    // Validate on input (real-time) with small debounce
    field.addEventListener('input', function() {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(validate, 500);
    });
    
    // Validate immediately on blur
    field.addEventListener('blur', function() {
        clearTimeout(validationTimeout);
        validate();
    });
}

/**
 * Validate password match (for confirm password field)
 * @param {string} passwordFieldId - Original password field
 * @param {string} confirmFieldId - Confirm password field
 */
export function setupPasswordMatchValidation(passwordFieldId, confirmFieldId) {
    const passwordField = document.getElementById(passwordFieldId);
    const confirmField = document.getElementById(confirmFieldId);
    
    if (!passwordField || !confirmField) return;
    
    function checkMatch() {
        if (!confirmField.value) {
            clearFieldError(confirmFieldId);
            return;
        }
        
        if (passwordField.value !== confirmField.value) {
            showFieldError(confirmFieldId, 'Passwords do not match');
        } else {
            clearFieldError(confirmFieldId);
        }
    }
    
    confirmField.addEventListener('input', checkMatch);
    confirmField.addEventListener('blur', checkMatch);
    passwordField.addEventListener('input', function() {
        if (confirmField.value) checkMatch();
    });
}
