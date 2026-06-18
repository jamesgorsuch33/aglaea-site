// ============================================================
// AGLAEA - CORE SEND EMAIL FUNCTION
// Handles all transactional emails via Resend API
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@aglaea.co.uk';
const SITE_URL = process.env.SITE_URL || 'https://aglaea.co.uk';

// ============================================================
// EMAIL TEMPLATE LIBRARY
// All 10 templates embedded as functions that take data
// ============================================================

const templates = {
    
    // ============================================================
    // 01 - WELCOME EMAIL
    // ============================================================
    welcome: (data) => ({
        subject: `Welcome to AGLAEA, ${data.firstName || 'there'}`,
        html: buildEmail({
            preheader: 'The art of thoughtful gifting starts here.',
            content: `
                <tr>
                    <td class="hero" style="text-align: center; padding: 0 32px 48px 32px;">
                        <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 36px; font-weight: 400; color: #2a2a2a; line-height: 1.2; margin: 0 0 16px 0;">
                            Welcome, ${escapeHtml(data.firstName || 'friend')}.
                        </h1>
                        <p style="font-size: 16px; color: #6b6b6b; margin: 0; font-style: italic; font-family: 'Cormorant Garamond', Georgia, serif;">
                            You're in the right place.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td class="content" style="padding: 0 32px 0 32px;">
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            Thank you for joining us. We're so glad you're here.
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            From this moment on, the people you love will never quietly slip from your calendar. Birthdays, anniversaries, and those small, considered moments in between — we'll hold the space for them, so you can focus on what truly matters: the thought, the gesture, the meaning behind every gift.
                        </p>
                        <div style="background-color: #f9f5ed; padding: 32px; margin: 32px 0; border-radius: 4px;">
                            <div style="padding: 12px 0; border-bottom: 1px solid rgba(201, 168, 112, 0.15);">
                                <span style="display: inline-block; font-size: 20px; margin-right: 12px; vertical-align: middle; color: #c9a870;">✦</span>
                                <span style="display: inline-block; font-size: 15px; color: #2a2a2a; vertical-align: middle; font-weight: 500;">Thoughtful reminders, three weeks in advance</span>
                            </div>
                            <div style="padding: 12px 0; border-bottom: 1px solid rgba(201, 168, 112, 0.15);">
                                <span style="display: inline-block; font-size: 20px; margin-right: 12px; vertical-align: middle; color: #c9a870;">✦</span>
                                <span style="display: inline-block; font-size: 15px; color: #2a2a2a; vertical-align: middle; font-weight: 500;">A curated edit of gifts from exceptional brand partners</span>
                            </div>
                            <div style="padding: 12px 0;">
                                <span style="display: inline-block; font-size: 20px; margin-right: 12px; vertical-align: middle; color: #c9a870;">✦</span>
                                <span style="display: inline-block; font-size: 15px; color: #2a2a2a; vertical-align: middle; font-weight: 500;">'Just Because' moments, planned with intention</span>
                            </div>
                        </div>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            Your first reminder is already in place. We'll be in touch three weeks before the occasion — quietly, considerately, with everything you need to make it feel effortless.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="text-align: center; padding: 32px 16px;">
                        <p style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-style: italic; color: #c9a870; line-height: 1.4; margin: 0;">
                            "You don't need a reason to spoil someone."
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="text-align: center; padding: 48px 32px; background-color: #2a2a2a;">
                        <h2 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; color: #ffffff; margin: 0 0 12px 0;">
                            Ready to add your loved ones?
                        </h2>
                        <p style="color: rgba(255, 255, 255, 0.85); font-size: 15px; margin: 0 0 24px 0;">
                            Take a moment to add the people who matter most.
                        </p>
                        <a href="${SITE_URL}/dashboard.html" style="display: inline-block; background-color: #c9a870; color: #ffffff; text-decoration: none; padding: 14px 40px; font-size: 15px; font-weight: 500; letter-spacing: 0.05em; border-radius: 2px;">
                            Visit Your Dashboard
                        </a>
                    </td>
                </tr>
            `
        })
    }),
    
    // ============================================================
    // PASSWORD RESET EMAIL
    // ============================================================
    passwordReset: (data) => ({
        subject: 'Reset your AGLAEA password',
        html: buildEmail({
            preheader: 'A secure link to reset your password.',
            content: `
                <tr>
                    <td class="hero" style="text-align: center; padding: 0 32px 48px 32px;">
                        <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 36px; font-weight: 400; color: #2a2a2a; line-height: 1.2; margin: 0 0 16px 0;">
                            Reset your password.
                        </h1>
                        <p style="font-size: 16px; color: #6b6b6b; margin: 0; font-style: italic; font-family: 'Cormorant Garamond', Georgia, serif;">
                            We'll have you back in no time.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 32px 0 32px;">
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            Hello ${escapeHtml(data.firstName || 'there')},
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            We received a request to reset the password for your AGLAEA account. To set a new password, simply click the button below.
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            This link will expire in one hour for your security.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="text-align: center; padding: 32px;">
                        <a href="${escapeHtml(data.resetUrl)}" style="display: inline-block; background-color: #c9a870; color: #ffffff; text-decoration: none; padding: 14px 40px; font-size: 15px; font-weight: 500; letter-spacing: 0.05em; border-radius: 2px;">
                            Reset Password
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 32px 48px 32px;">
                        <p style="font-size: 14px; line-height: 1.6; color: #6b6b6b; margin: 0 0 12px 0;">
                            If the button above doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="font-size: 13px; line-height: 1.5; color: #c9a870; word-break: break-all; margin: 0 0 24px 0;">
                            ${escapeHtml(data.resetUrl)}
                        </p>
                        <p style="font-size: 14px; line-height: 1.6; color: #6b6b6b; margin: 0; padding-top: 24px; border-top: 1px solid rgba(201, 168, 112, 0.2);">
                            If you didn't request this password reset, you can safely ignore this email — your password will remain unchanged.
                        </p>
                    </td>
                </tr>
            `
        })
    }),
    
    // ============================================================
    // UPGRADE CONFIRMATION EMAIL
    // ============================================================
    upgradeConfirmation: (data) => ({
        subject: `Welcome to AGLAEA Essential, ${data.firstName || 'there'}`,
        html: buildEmail({
            preheader: 'Unlimited reminders, Just Because moments, and more.',
            content: `
                <tr>
                    <td class="hero" style="text-align: center; padding: 0 32px 48px 32px;">
                        <p style="font-size: 12px; color: #c9a870; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 16px 0; font-weight: 600;">
                            Welcome to Essential
                        </p>
                        <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 36px; font-weight: 400; color: #2a2a2a; line-height: 1.2; margin: 0;">
                            Thank you, ${escapeHtml(data.firstName || 'friend')}.
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 32px 0 32px;">
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            We're delighted to welcome you to AGLAEA Essential. Your upgrade is now active, and the full experience is yours to enjoy.
                        </p>
                        <div style="background-color: #f9f5ed; padding: 32px; margin: 32px 0; border-radius: 4px;">
                            <p style="font-size: 14px; color: #c9a870; letter-spacing: 0.2em; text-transform: uppercase; margin: 0 0 16px 0; font-weight: 600;">
                                What's included
                            </p>
                            <div style="padding: 12px 0; border-bottom: 1px solid rgba(201, 168, 112, 0.15);">
                                <span style="display: inline-block; font-size: 20px; margin-right: 12px; vertical-align: middle; color: #c9a870;">✦</span>
                                <span style="display: inline-block; font-size: 15px; color: #2a2a2a; vertical-align: middle; font-weight: 500;">Unlimited reminders</span>
                            </div>
                            <div style="padding: 12px 0; border-bottom: 1px solid rgba(201, 168, 112, 0.15);">
                                <span style="display: inline-block; font-size: 20px; margin-right: 12px; vertical-align: middle; color: #c9a870;">✦</span>
                                <span style="display: inline-block; font-size: 15px; color: #2a2a2a; vertical-align: middle; font-weight: 500;">Just Because moments</span>
                            </div>
                            <div style="padding: 12px 0; border-bottom: 1px solid rgba(201, 168, 112, 0.15);">
                                <span style="display: inline-block; font-size: 20px; margin-right: 12px; vertical-align: middle; color: #c9a870;">✦</span>
                                <span style="display: inline-block; font-size: 15px; color: #2a2a2a; vertical-align: middle; font-weight: 500;">SMS reminders</span>
                            </div>
                            <div style="padding: 12px 0;">
                                <span style="display: inline-block; font-size: 20px; margin-right: 12px; vertical-align: middle; color: #c9a870;">✦</span>
                                <span style="display: inline-block; font-size: 15px; color: #2a2a2a; vertical-align: middle; font-weight: 500;">Priority gift recommendations</span>
                            </div>
                        </div>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            Your next billing date will be <strong style="color: #c9a870;">${escapeHtml(data.nextBillingDate || 'soon')}</strong>. You can manage your subscription anytime from your account settings.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="text-align: center; padding: 48px 32px; background-color: #2a2a2a;">
                        <h2 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; color: #ffffff; margin: 0 0 12px 0;">
                            Make every moment count.
                        </h2>
                        <p style="color: rgba(255, 255, 255, 0.85); font-size: 15px; margin: 0 0 24px 0;">
                            Start by adding a Just Because moment.
                        </p>
                        <a href="${SITE_URL}/dashboard.html" style="display: inline-block; background-color: #c9a870; color: #ffffff; text-decoration: none; padding: 14px 40px; font-size: 15px; font-weight: 500; letter-spacing: 0.05em; border-radius: 2px;">
                            Visit Your Dashboard
                        </a>
                    </td>
                </tr>
            `
        })
    }),
    
    // ============================================================
    // REMINDER EMAILS - 21, 14, 10, 7, 3 days
    // ============================================================
    reminder21Days: (data) => buildReminderEmail({
        ...data,
        eyebrow: 'On the horizon',
        daysText: 'three weeks away',
        copy1: `A friendly, early heads-up — ${escapeHtml(data.recipientName)}'s ${escapeHtml(data.occasion)} is coming up on ${escapeHtml(data.occasionDate)}. There's no rush at all. We just wanted to put it on your radar.`,
        copy2: `We'll be in touch again as the date draws closer — and in the meantime, you might enjoy browsing our latest gift edit for inspiration.`,
        ctaTitle: null,
        ctaText: 'Browse Gift Inspiration'
    }),
    
    reminder14Days: (data) => buildReminderEmail({
        ...data,
        eyebrow: 'Two weeks to go',
        daysText: 'two weeks',
        copy1: `Two weeks until ${escapeHtml(data.recipientName)}'s ${escapeHtml(data.occasion)}. Still plenty of time to find something thoughtful — and the perfect moment to start exploring.`,
        copy2: `We've gathered some beautiful pieces from our partner brands that we think you'll love.`,
        ctaTitle: 'Browse the AGLAEA edit.',
        ctaText: 'Browse Gifts'
    }),
    
    reminder10Days: (data) => buildReminderEmail({
        ...data,
        eyebrow: 'A gentle reminder',
        daysText: '10 days',
        copy1: `You have ten days to choose a gift for ${escapeHtml(data.recipientName)}. We hope you'll take a moment to find something that feels right — something that tells them, in your own way, that they've been on your mind.`,
        copy2: `We've gathered a thoughtful selection from our partner brands to help. Beautiful pieces, considered choices, all in one place — so you can browse with the time and care a meaningful gift deserves.`,
        ctaTitle: 'Browse the AGLAEA edit.',
        ctaText: 'Browse Gifts'
    }),
    
    reminder7Days: (data) => buildReminderEmail({
        ...data,
        eyebrow: 'One week away',
        daysText: '7 days away',
        copy1: `One week to go. If you've already found the perfect gift, wonderful. If not, there's still time — and we're here to help.`,
        copy2: `Take a look at our latest edit. Something beautiful is waiting to be chosen.`,
        ctaTitle: 'Find the perfect gift.',
        ctaText: 'Browse Gifts'
    }),
    
    reminder3Days: (data) => buildReminderEmail({
        ...data,
        eyebrow: 'Three days left',
        daysText: '3 days',
        copy1: `The final stretch. Just three days until ${escapeHtml(data.recipientName)}'s ${escapeHtml(data.occasion)} — and if you haven't yet found the perfect gift, now's the time.`,
        copy2: `Many of our partner brands offer express delivery. We've made it easy to find something beautiful in time.`,
        ctaTitle: 'Make it happen.',
        ctaText: 'Browse Gifts'
    }),
    
    reminderDayOf: (data) => ({
        subject: `Today is ${data.recipientName}'s ${data.occasion}`,
        html: buildEmail({
            preheader: "A final, gentle nudge from AGLAEA.",
            content: `
                <tr>
                    <td class="hero" style="text-align: center; padding: 0 32px 48px 32px;">
                        <p style="font-size: 12px; color: #c9a870; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 16px 0; font-weight: 600;">
                            Today
                        </p>
                        <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 36px; font-weight: 400; color: #2a2a2a; line-height: 1.2; margin: 0;">
                            It's ${escapeHtml(data.recipientName)}'s<br><em style="color: #c9a870;">${escapeHtml(data.occasion)}</em>.
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 32px 48px 32px;">
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            ${escapeHtml(data.firstName || 'Hello')},
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            Today is the day. We hope you've found something perfect for ${escapeHtml(data.recipientName)} — and if you haven't, there's still time.
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 0 0;">
                            However you choose to mark the day, we hope it's a beautiful one.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="text-align: center; padding: 0 32px 48px 32px;">
                        <a href="${SITE_URL}/products.html" style="display: inline-block; background-color: #c9a870; color: #ffffff; text-decoration: none; padding: 14px 40px; font-size: 15px; font-weight: 500; letter-spacing: 0.05em; border-radius: 2px;">
                            Browse Last-Minute Gifts
                        </a>
                    </td>
                </tr>
            `
        })
    }),
    
    // ============================================================
    // JUST BECAUSE REMINDER
    // ============================================================
    reminderJustBecause: (data) => ({
        subject: `A moment for ${data.recipientName}`,
        html: buildEmail({
            preheader: 'No occasion. No reason. Just because.',
            content: `
                <tr>
                    <td class="hero" style="text-align: center; padding: 0 32px 48px 32px;">
                        <p style="font-size: 12px; color: #c9a870; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 16px 0; font-weight: 600;">
                            ✨ A Just Because moment
                        </p>
                        <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 36px; font-weight: 400; color: #2a2a2a; line-height: 1.2; margin: 0;">
                            A moment for<br><em style="color: #c9a870;">${escapeHtml(data.recipientName)}</em>.
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 32px 0 32px;">
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            ${escapeHtml(data.firstName || 'Hello')},
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            There's no birthday this week. No anniversary on the horizon. Just an opportunity — to do something kind, simply because you can.
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            We've set this Just Because moment aside for ${escapeHtml(data.recipientName)}. The smallest gestures often mean the most. A gift arriving unexpectedly. A note that says <em style="color: #c9a870; font-family: 'Cormorant Garamond', Georgia, serif;">I was thinking of you.</em>
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 0 0;">
                            Take your time to find something that feels right. They'll feel it the moment it arrives.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="text-align: center; padding: 32px 16px;">
                        <p style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-style: italic; color: #c9a870; line-height: 1.4; margin: 0;">
                            "You don't need a reason to spoil someone."
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="text-align: center; padding: 48px 32px; background-color: #2a2a2a;">
                        <h2 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; color: #ffffff; margin: 0 0 12px 0;">
                            Find something beautiful.
                        </h2>
                        <p style="color: rgba(255, 255, 255, 0.85); font-size: 15px; margin: 0 0 24px 0;">
                            Curated gifts from our partner brands.
                        </p>
                        <a href="${SITE_URL}/products.html" style="display: inline-block; background-color: #c9a870; color: #ffffff; text-decoration: none; padding: 14px 40px; font-size: 15px; font-weight: 500; letter-spacing: 0.05em; border-radius: 2px;">
                            Browse Gifts
                        </a>
                    </td>
                </tr>
            `
        })
    })
};

// ============================================================
// HELPER: Build reminder email (shared structure for 21/14/10/7/3)
// ============================================================
function buildReminderEmail(data) {
    return {
        subject: `${data.recipientName}'s ${data.occasion} is in ${data.daysText}`,
        html: buildEmail({
            preheader: `A gentle nudge from AGLAEA.`,
            content: `
                <tr>
                    <td class="hero" style="text-align: center; padding: 0 32px 48px 32px;">
                        <p style="font-size: 12px; color: #c9a870; letter-spacing: 0.3em; text-transform: uppercase; margin: 0 0 16px 0; font-weight: 600;">
                            ${escapeHtml(data.eyebrow)}
                        </p>
                        <h1 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 36px; font-weight: 400; color: #2a2a2a; line-height: 1.2; margin: 0;">
                            ${escapeHtml(data.recipientName)}'s ${escapeHtml(data.occasion)}<br>is in <em style="color: #c9a870;">${escapeHtml(data.daysText)}</em>.
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 32px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9f5ed; border-radius: 4px;">
                            <tr>
                                <td style="padding: 40px 32px; text-align: center;">
                                    <p style="font-size: 14px; color: #6b6b6b; margin: 0 0 12px 0; letter-spacing: 0.05em;">
                                        ${escapeHtml(data.recipientName)}
                                    </p>
                                    <p style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 40px; color: #2a2a2a; margin: 0 0 8px 0; font-weight: 400; line-height: 1.1;">
                                        ${escapeHtml(data.occasionDate)}
                                    </p>
                                    <p style="font-size: 14px; color: #6b6b6b; margin: 0; font-style: italic; font-family: 'Cormorant Garamond', Georgia, serif;">
                                        ${escapeHtml(data.occasion)}
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 48px 32px 48px 32px;">
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            ${escapeHtml(data.firstName || 'Hello')},
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 20px 0;">
                            ${data.copy1}
                        </p>
                        <p style="font-size: 16px; line-height: 1.7; color: #2a2a2a; margin: 0 0 0 0;">
                            ${data.copy2}
                        </p>
                    </td>
                </tr>
                ${data.ctaTitle ? `
                <tr>
                    <td style="text-align: center; padding: 48px 32px; background-color: #2a2a2a;">
                        <h2 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; color: #ffffff; margin: 0 0 12px 0;">
                            ${escapeHtml(data.ctaTitle)}
                        </h2>
                        <p style="color: rgba(255, 255, 255, 0.85); font-size: 15px; margin: 0 0 24px 0;">
                            Curated gifts for every occasion.
                        </p>
                        <a href="${SITE_URL}/products.html" style="display: inline-block; background-color: #c9a870; color: #ffffff; text-decoration: none; padding: 14px 40px; font-size: 15px; font-weight: 500; letter-spacing: 0.05em; border-radius: 2px;">
                            ${escapeHtml(data.ctaText)}
                        </a>
                    </td>
                </tr>
                ` : `
                <tr>
                    <td style="text-align: center; padding: 0 32px 48px 32px;">
                        <a href="${SITE_URL}/products.html" style="display: inline-block; background-color: #c9a870; color: #ffffff; text-decoration: none; padding: 14px 40px; font-size: 15px; font-weight: 500; letter-spacing: 0.05em; border-radius: 2px;">
                            ${escapeHtml(data.ctaText)}
                        </a>
                    </td>
                </tr>
                `}
            `
        })
    };
}

// ============================================================
// HELPER: Build base email structure (header, footer, etc.)
// ============================================================
function buildEmail({ preheader, content }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>AGLAEA</title>
<style>
    :root {
        color-scheme: light only;
        supported-color-schemes: light;
    }
    
    /* CRITICAL: Force light mode on iOS Mail */
    u + .body .gmail-blend-screen { background: #f5f0e8; mix-blend-mode: screen; }
    u + .body .gmail-blend-difference { background: #ffffff; mix-blend-mode: difference; }
    
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f5f0e8 !important; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #2a2a2a !important; line-height: 1.6; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff !important; }
    
    /* Force ALL text colors regardless of mode */
    h1, h2, h3, p, td, span, a, div { -webkit-text-fill-color: inherit; }
    
    /* Force colors regardless of dark mode */
    .text-charcoal { color: #2a2a2a !important; }
    .text-slate { color: #6b6b6b !important; }
    .text-gold { color: #c9a870 !important; }
    .text-white { color: #ffffff !important; }
    .bg-white { background-color: #ffffff !important; }
    .bg-cream { background-color: #f5f0e8 !important; }
    .bg-light-cream { background-color: #f9f5ed !important; }
    .bg-charcoal { background-color: #2a2a2a !important; }
    .bg-gold { background-color: #c9a870 !important; }
    
    /* iOS Mail dark mode override */
    @media (prefers-color-scheme: dark) {
        body, .body, table, td { background-color: #f5f0e8 !important; }
        .email-container, .bg-white { background-color: #ffffff !important; }
        .bg-light-cream { background-color: #f9f5ed !important; }
        .bg-cream { background-color: #f5f0e8 !important; }
        .bg-charcoal { background-color: #2a2a2a !important; }
        h1, h2, h3, .text-charcoal { color: #2a2a2a !important; }
        p, span, td, div { color: #2a2a2a !important; }
        .text-slate { color: #6b6b6b !important; }
        .text-gold { color: #c9a870 !important; }
        .text-white { color: #ffffff !important; }
        .bg-charcoal h2, .bg-charcoal p, .bg-charcoal span { color: #ffffff !important; }
    }
    
    /* Force light mode on Outlook */
    [data-ogsc] body, [data-ogsb] body {
        background-color: #f5f0e8 !important;
        color: #2a2a2a !important;
    }
    [data-ogsc] .email-container, [data-ogsb] .email-container {
        background-color: #ffffff !important;
    }
    [data-ogsc] h1, [data-ogsc] h2, [data-ogsc] h3, [data-ogsc] p, [data-ogsc] td, [data-ogsc] span {
        color: #2a2a2a !important;
    }
    [data-ogsb] h1, [data-ogsb] h2, [data-ogsb] h3, [data-ogsb] p, [data-ogsb] td, [data-ogsb] span {
        color: #2a2a2a !important;
    }
    
    @media screen and (max-width: 600px) {
        .header { padding: 32px 20px 24px 20px !important; }
        .hero { padding: 0 20px 32px 20px !important; }
        .hero h1 { font-size: 28px !important; }
        .logo-img { max-width: 140px !important; } .logo-head-img { max-width: 60px !important; }
    }
</style>
</head>
<body class="body" style="margin: 0; padding: 0; background-color: #f5f0e8;">

<div style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(preheader)}</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f0e8;">
    <tr>
        <td align="center" style="padding: 40px 16px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; background-color: #ffffff;">
                
                <tr>
                    <td class="header" style="text-align: center; padding: 48px 32px 32px 32px; background-color: #ffffff;">
                        <img src="${SITE_URL}/images/logo-gold.png" alt="AGLAEA" class="logo-img" style="max-width: 180px; height: auto; display: block; margin: 0 auto;">
                        <img src="${SITE_URL}/images/logo-head-gold.png" alt="" class="logo-head-img" style="max-width: 80px; height: auto; display: block; margin: 0 auto;">
                    </td>
                </tr>
                
                <tr>
                    <td align="center">
                        <hr style="width: 60px; height: 1px; background-color: #c9a870; margin: 0 auto 32px auto; border: 0;">
                    </td>
                </tr>
                
                ${content}
                
                <tr>
                    <td style="text-align: center; padding: 32px; background-color: #f5f0e8; font-size: 13px; color: #6b6b6b;">
                        <p style="margin: 0 0 16px 0;">
                            <img src="${SITE_URL}/images/logo-gold.png" alt="AGLAEA" style="max-width: 100px; height: auto;">
                        </p>
                        <p style="margin: 0 0 16px 0;">Never miss another moment.</p>
                        <p style="margin: 0 0 8px 0;">
                            <a href="${SITE_URL}" style="color: #c9a870; text-decoration: none;">aglaea.co.uk</a>
                        </p>
                    </td>
                </tr>
                
            </table>
        </td>
    </tr>
</table>

</body>
</html>`;
}

// ============================================================
// HELPER: Escape HTML to prevent injection
// ============================================================
function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// MAIN HANDLER
// ============================================================
exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    // Check API key is configured
    if (!RESEND_API_KEY) {
        console.error('RESEND_API_KEY not configured');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Email service not configured' })
        };
    }
    
    try {
        const { emailType, to, data } = JSON.parse(event.body);
        
        // Validate required fields
        if (!emailType || !to) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing emailType or to' })
            };
        }
        
        // Check template exists
        if (!templates[emailType]) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `Unknown email type: ${emailType}` })
            };
        }
        
        // Generate email content from template
        const { subject, html } = templates[emailType](data || {});
        
        // Send via Resend API
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `AGLAEA <${FROM_EMAIL}>`,
                to: [to],
                subject: subject,
                html: html
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('Resend API error:', result);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: 'Email send failed', details: result })
            };
        }
        
        console.log(`Email sent: ${emailType} to ${to}, ID: ${result.id}`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true,
                emailId: result.id
            })
        };
        
    } catch (error) {
        console.error('Send email error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
};
