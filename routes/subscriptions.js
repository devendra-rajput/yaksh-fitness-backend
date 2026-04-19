const express = require('express');
const routes = express.Router();

const { roles: userRoles } = require('../resources/v1/users/users.model');

/** Controllers **/
const subscriptionController = require('../resources/v1/subscriptions/subscriptions.controller');

/** Validations **/
const subscriptionValidation = require("../resources/v1/subscriptions/subscriptions.validation");

/** Middleware **/
const authMiddleware = require("../middleware/v1/authorize");
const verifyRevenueCatWebhook = require("../middleware/v1/revenueCatWebhook");

// ─── Admin Routes ──────────────────────────────────────────────────────────────

// Admin: list all subscriptions with pagination
routes.get(
    '/',
    [authMiddleware.auth(userRoles.ADMIN), subscriptionValidation.getAllWithPagination],
    subscriptionController.getAllWithPagination
);

// ─── User Routes ───────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's active subscription from local DB.
 */
routes.get(
    '/active',
    [authMiddleware.auth()],
    subscriptionController.getActiveSubscription
);

/**
 * Calls the RevenueCat REST API, fetches live subscription status for the
 * authenticated user, updates the local DB, and returns the result.
*/
routes.post(
    '/sync',
    [authMiddleware.auth()],
    subscriptionController.syncSubscription
);

/**
 * Receives RevenueCat real-time events. Not the primary sync mechanism —
 * the /sync endpoint and background cron are the primary sources of truth.
 * Webhooks are kept as a "fast path" bonus signal.
 */
routes.post(
    '/revenuecat-webhook',
    [verifyRevenueCatWebhook],
    subscriptionController.handleRevenueCatWebhook
);

module.exports = routes;