// ============================================================
// REVOLUT MERCHANT CHECKOUT - CREATE SUBSCRIPTION
// ============================================================
// Creates a Revolut subscription checkout session
// Replaces the previous Stripe checkout flow
// ============================================================

const REVOLUT_API_URL = process.env.REVOLUT_ENV === 'production'
    ? 'https://merchant.revolut.com/api'
    : 'https://sandbox-merchant.revolut.com/api';

const SITE_URL = process.env.SITE_URL || 'https://aglaea.co.uk';

exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request body
        const { userId, userEmail, userName } = JSON.parse(event.body);

        if (!userId || !userEmail) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'userId and userEmail are required' })
            };
        }

        console.log('Creating Revolut subscription for:', userEmail);

        // Step 1: Create or find customer
        const customer = await createOrFindCustomer(userEmail, userName);
        console.log('Customer ID:', customer.id);

        // Step 2: Create subscription with hosted checkout
        const subscription = await createSubscription(
            customer.id,
            userId,
            userEmail
        );

        console.log('Subscription created:', subscription.id);
        console.log('Full response:', JSON.stringify(subscription));

        // Step 2b: Retrieve the setup order to get its checkout_url
        if (!subscription.setup_order_id) {
            console.error('No setup_order_id in subscription response. Available fields:', Object.keys(subscription));
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'No setup_order_id in subscription response',
                    availableFields: Object.keys(subscription),
                    fullResponse: subscription
                })
            };
        }

        const order = await retrieveOrder(subscription.setup_order_id);
        console.log('Order retrieved:', order.id, 'state:', order.state, 'redirect_url:', order.redirect_url);

        const checkoutUrl = order.checkout_url;

        if (!checkoutUrl) {
            console.error('No checkout_url on retrieved order. Available fields:', Object.keys(order));
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'No checkout_url in order response',
                    availableFields: Object.keys(order),
                    fullResponse: order
                })
            };
        }

        // Save pending subscription ID to Firebase so we can check its status later
        try {
            const admin = require('firebase-admin');
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                    })
                });
            }
            const db = admin.firestore();
            await db.collection('users').doc(userId).set({
                pendingSubscriptionId: subscription.id,
                pendingSubscriptionCreatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log('Saved pending subscription ID to Firebase');
        } catch (firebaseErr) {
            console.error('Failed to save pending subscription:', firebaseErr);
            // Don't fail the whole request - checkout can still proceed
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                checkoutUrl: checkoutUrl,
                subscriptionId: subscription.id
            })
        };

    } catch (error) {
        console.error('Revolut checkout error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to create checkout',
                message: error.message
            })
        };
    }
};

// ============================================================
// Create or find customer in Revolut
// ============================================================
async function createOrFindCustomer(email, name) {
    // Try to find existing customer first
    const searchResponse = await fetch(
        `${REVOLUT_API_URL}/customers?email=${encodeURIComponent(email)}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
                'Revolut-Api-Version': '2026-04-20',
                'Accept': 'application/json'
            }
        }
    );

    if (searchResponse.ok) {
        const data = await searchResponse.json();
        if (data.customers && data.customers.length > 0) {
            console.log('Existing customer found');
            return data.customers[0];
        }
    }

    // Create new customer
    const createResponse = await fetch(`${REVOLUT_API_URL}/customers`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
            'Revolut-Api-Version': '2026-04-20',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email,
            full_name: name || email.split('@')[0]
        })
    });

    if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create customer: ${errorText}`);
    }

    return await createResponse.json();
}

// ============================================================
// Create subscription with hosted checkout page
// ============================================================
async function createSubscription(customerId, userId, userEmail) {
    const planVariationId = process.env.REVOLUT_CURATE_PLAN_ID;
    
    if (!planVariationId) {
        throw new Error('REVOLUT_CURATE_PLAN_ID environment variable not set');
    }

    const response = await fetch(`${REVOLUT_API_URL}/subscriptions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
            'Revolut-Api-Version': '2026-04-20',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            plan_variation_id: planVariationId,
            customer_id: customerId,
            external_reference: userId,  // Our Firebase user ID
            redirect_url: `${SITE_URL}/dashboard.html?upgrade=success`,
            metadata: {
                userId: userId,
                userEmail: userEmail,
                source: 'aglaea_upgrade_flow'
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create subscription: ${errorText}`);
    }

    return await response.json();
}

// ============================================================
// Retrieve an order to get its checkout_url
// ============================================================
async function retrieveOrder(orderId) {
    const response = await fetch(`${REVOLUT_API_URL}/orders/${orderId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
            'Revolut-Api-Version': '2026-04-20',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to retrieve order: ${errorText}`);
    }

    return await response.json();
}
