/**
 * RevenueCat REST API Service
 *
 * Docs: https://www.revenuecat.com/docs/api-v1
 *
 * Required env vars:
 *   REVENUECAT_API_KEY          — Secret API key from RC Dashboard → API Keys
 *   REVENUECAT_ENTITLEMENT_ID   — The entitlement identifier (e.g. "premium")
 */
require('dotenv').config();
const axios = require('axios');
const SubscriptionModel = require("../resources/v1/subscriptions/subscriptions.model");

const RC_BASE_URL = 'https://api.revenuecat.com/v1';

class RevenueCatService {

    /**
     * Fetches the full subscriber object from RevenueCat for a given app_user_id.
     *
     * @param {string} appUserId  - The user's MongoDB _id (must match what the app sets in RC)
     * @returns {{ status: boolean, data: object|null, message: string }}
     */
    getSubscriber = async (appUserId) => {
        console.log('RevenueCatService@getSubscriber', appUserId);

        try {
            const apiKey = process.env.REVENUECAT_API_KEY;
            if (!apiKey) {
                throw new Error('REVENUECAT_API_KEY is not set in environment variables.');
            }

            const url = `${RC_BASE_URL}/subscribers/${encodeURIComponent(appUserId)}`;

            const { data } = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Platform': 'stripe'  // required by RC REST API v1
                },
                timeout: 10000
            });

            return { status: true, data: data?.subscriber || null, message: 'success' };

        } catch (error) {
            const rcError = error?.response?.data;
            const message = rcError?.message || error.message || 'RevenueCat API error';
            console.error('RevenueCatService@getSubscriber error:', message, rcError || '');
            return { status: false, data: null, message };
        }
    }

    /**
     * Resolves the current subscription status for a subscriber object returned by RC.
     *
     * Priority order:
     *   1. Active entitlement present + not expired  → ACTIVE
     *   2. Grace period active                        → IN_GRACE
     *   3. Billing issue detected                     → ON_HOLD
     *   4. Subscription exists but expires in past    → EXPIRED
     *   5. Unsubscribe detected but hasn't expired    → ACTIVE (cancel_at_period_end = true)
     *   6. No subscriptions at all                    → null (no subscription found)
     */
    resolveSubscriptionStatus = (subscriber, entitlementId) => {
        console.log('RevenueCatService@resolveSubscriptionStatus');

        const now = new Date();
        const result = {
            isActive: false,
            status: null,
            productId: null,
            planType: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            store: null,
            isSandbox: false
        };
        // console.log(JSON.stringify(subscriber), '=======subscriber');
        // ── 1. Check active entitlement (most reliable RC signal) ─────────────
        const entitlement = subscriber?.entitlements?.[entitlementId];
        // console.log('entitlement====/==>', entitlement);
        let activeProductId = null;

        if (entitlement) {
            const entitlementExpiry = entitlement.expires_date
                ? new Date(entitlement.expires_date)
                : null;

            // expires_date null means lifetime — always active
            if (!entitlementExpiry || entitlementExpiry > now) {
                result.isActive = true;
                result.status = 'active';
                activeProductId = entitlement.product_identifier;
                result.productId = activeProductId;
            }
        }

        // ── 2. Dig into the individual subscription for richer metadata ────────
        const subscriptions = subscriber?.subscriptions || {};
        // console.log('subscriptions======>', subscriptions);
        const productKey = activeProductId || Object.keys(subscriptions)[0];
        // console.log('productKey======>', productKey);
        const sub = subscriptions[productKey];
        // console.log('sub======>', sub);
        // console.log('result======>', result);
        if (!sub && !result.isActive) {
            // No subscriptions at all
            return result;
        }

        if (sub) {
            const expiresDate = sub.expires_date ? new Date(sub.expires_date) : null;
            const gracePeriod = sub.grace_period_expires_date
                ? new Date(sub.grace_period_expires_date) : null;
            const billingIssue = sub.billing_issues_detected_at
                ? new Date(sub.billing_issues_detected_at) : null;
            const unsubscribed = !!sub.unsubscribe_detected_at;

            let planType = SubscriptionModel.planTypes.MONTHLY;
            const productIdLower = productKey.toLowerCase();
            const productPlanIdentifierLower = sub?.product_plan_identifier ? sub?.product_plan_identifier.toLowerCase() : null;
            if (
                productIdLower.includes("yearly") ||
                productIdLower.includes("annual") ||
                productIdLower.endsWith("gascia_sub") || // iOS yearly product
                (productPlanIdentifierLower && productPlanIdentifierLower.includes("yearly")) ||
                (productPlanIdentifierLower && productPlanIdentifierLower.includes("annual")) || 
                (productPlanIdentifierLower && productPlanIdentifierLower.endsWith("gascia_sub"))
            ) {
                planType = SubscriptionModel.planTypes.YEARLY
            } 
            // else if (
            //     productIdLower.includes("monthly") ||
            //     productIdLower.includes("month") ||
            //     productIdLower.endsWith(".gascia") || // iOS monthly product
            //     productPlanIdentifierLower.includes("monthly") ||
            //     productPlanIdentifierLower.includes("month") || 
            //     productPlanIdentifierLower.endsWith("gascia")
            // ) {
            //     planType = SubscriptionModel.planTypes.MONTHLY
            // }

            result.productId = productKey;
            result.productIdentifier = sub?.product_plan_identifier || null;
            result.store = sub.store;              // "app_store" | "play_store" | "stripe"
            result.isSandbox = !!sub.is_sandbox;
            result.currentPeriodStart = sub.original_purchase_date || sub.purchase_date || null;
            result.currentPeriodEnd = sub.expires_date || null;
            result.cancelAtPeriodEnd = unsubscribed;
            result.subscriptionId = sub?.store_transaction_id || null;
            result.price = sub?.price || null;
            result.planType = planType;
            result.isTrialPlan = sub?.period_type === "trial" ? true : false;

            // Grace period — payment failed but still has access
            if (gracePeriod && gracePeriod > now) {
                result.isActive = true;
                result.status = 'in_grace';
            }
            // Billing issue — payment failed, no grace period left
            else if (billingIssue && (!expiresDate || expiresDate <= now)) {
                result.isActive = false;
                result.status = 'on_hold';
            }
            // Already expired
            else if (expiresDate && expiresDate <= now && !result.isActive) {
                result.isActive = false;
                result.status = 'expired';
            }
        }

        return result;
    }
}

module.exports = new RevenueCatService;
