// ============================================================
// AGLAEA - FORGOT PASSWORD FUNCTION
// Uses Firebase Admin SDK to generate reset link
// Then sends branded email via send-email function
// ============================================================

const admin = require('firebase-admin');

// Initialize Firebase Admin (only once across function invocations)
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
        console.log('Firebase Admin initialized');
    } catch (initError) {
        console.error('Firebase Admin init error:', initError);
    }
}

const SITE_URL = process.env.SITE_URL || 'https://aglaea.co.uk';

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const { email } = JSON.parse(event.body);
        
        if (!email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Email required' })
            };
        }
        
        console.log('Password reset requested for:', email);
        
        // For security, we ALWAYS return success even if email doesn't exist
        // This prevents attackers from discovering valid user emails
        
        try {
            // Step 1: Check if user exists in Firebase Auth
            const userRecord = await admin.auth().getUserByEmail(email);
            console.log('User found:', userRecord.uid);
            
            // Step 2: Get user's first name from Firestore
            let firstName = 'there';
            try {
                const userDoc = await admin.firestore()
                    .collection('users')
                    .doc(userRecord.uid)
                    .get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    firstName = userData.firstName || 'there';
                }
            } catch (firestoreError) {
                console.warn('Could not fetch firstName:', firestoreError.message);
            }
            
            // Step 3: Generate Firebase password reset link
            const actionCodeSettings = {
                url: `${SITE_URL}/signin.html`,
                handleCodeInApp: false
            };
            
            const resetUrl = await admin.auth().generatePasswordResetLink(
                email, 
                actionCodeSettings
            );
            
            console.log('Reset link generated');
            
            // Step 4: Call send-email function to send branded email
            const emailResponse = await fetch(`${SITE_URL}/.netlify/functions/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailType: 'passwordReset',
                    to: email,
                    data: {
                        firstName: firstName,
                        resetUrl: resetUrl
                    }
                })
            });
            
            const emailResult = await emailResponse.json();
            
            if (emailResult.success) {
                console.log('Branded password reset email sent successfully');
            } else {
                console.error('Email send failed:', emailResult);
            }
            
        } catch (userError) {
            // User doesn't exist or other Firebase error
            console.log('Password reset attempt - user may not exist:', userError.code || userError.message);
        }
        
        // Always return success (security best practice)
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true,
                message: 'If an account exists, a reset email has been sent.'
            })
        };
        
    } catch (error) {
        console.error('Forgot password error:', error);
        // Even on error, return success for security
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true,
                message: 'If an account exists, a reset email has been sent.'
            })
        };
    }
};
