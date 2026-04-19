/**
 * RevenueCat Webhook Authorization Middleware
 *
 * RevenueCat lets you optionally set an "Authorization" header value in the
 * webhook configuration (Dashboard → Project → Integrations → Webhooks →
 * Authorization Header). This middleware verifies that header on every
 * inbound webhook request.
 *
 * Setup:
 *   1. Set REVENUECAT_WEBHOOK_SECRET in your .env
 *   2. Add the SAME value in the RevenueCat dashboard webhook config under
 *      "Authorization Header"
 *   3. Apply this middleware to the webhook route (already done in routes/subscriptions.js)
 *
 * If REVENUECAT_WEBHOOK_SECRET is not set, the middleware logs a warning and
 * passes through (so you can deploy without breaking existing behaviour while
 * you add the secret).
 */
const verifyRevenueCatWebhook = (req, res, next) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

    if (!secret) {
        console.warn(
            '[RevenueCat Webhook] WARNING: REVENUECAT_WEBHOOK_SECRET is not set. ' +
            'Skipping signature verification — set this variable to secure your webhook endpoint.'
        );
        return next();
    }

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        console.warn('[RevenueCat Webhook] Rejected: Missing Authorization header.');
        return res.status(401).json({ error: 'Unauthorized: Missing Authorization header.' });
    }

    // RevenueCat sends the value exactly as you configured it — plain string comparison.
    if (authHeader !== secret) {
        console.warn('[RevenueCat Webhook] Rejected: Authorization header mismatch.');
        return res.status(401).json({ error: 'Unauthorized: Invalid Authorization header.' });
    }

    next();
};

module.exports = verifyRevenueCatWebhook;
