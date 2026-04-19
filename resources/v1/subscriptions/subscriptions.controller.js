// controllers/subscriptionController.js
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const SubscriptionModel = require("./subscriptions.model");
const ReferralTrackModel = require('../referral_track/referral_tracks.model');
const UserModel = require('../users/users.model');
const revenueCatService = require('../../../services/revenuecat');


class SubscriptionController {

  // =========================================================================
  // Admin: list subscriptions with pagination
  // =========================================================================
  getAllWithPagination = async (req, res) => {
    console.log('SubscriptionController@getAllWithPagination');

    const { page, limit } = await dataHelper.getPageAndLimit(req.query);
    const { status } = req.query;

    const filterObj = { status };
    const result = await SubscriptionModel.getAllWithPagination(page, limit, filterObj);

    if (!result?.data?.length) {
      return response.success("success.noRecordsFound", res, result);
    }
    return response.success("success.subscriptionsData", res, result);
  }


  // =========================================================================
  // GET /api/v1/subscriptions/active  — Auth required (any user)
  //
  // Returns the user's current active subscription from our local DB.
  // Lightweight — DB only, no external RC call. Use this for regular app
  // screens that just need to know "is the user subscribed?".
  // =========================================================================
  getActiveSubscription = async (req, res) => {
    console.log('SubscriptionController@getActiveSubscription');

    try {
      const userId = req.user._id.toString();

      // Fetch full user (which includes active_subscription via aggregate lookup)
      const user = await UserModel.getOneByColumnNameAndValue('_id', userId);
      if (!user) {
        return response.badRequest('error.userNotFound', res, false);
      }

      const activeSub = user?.active_subscription || {};
      const isActive = !!(activeSub?._id && activeSub?.status === SubscriptionModel.statuses.ACTIVE);

      return response.success('success.subscriptionData', res, {
        is_subscribed: isActive,
        active_subscription: activeSub
      });

    } catch (error) {
      console.error('SubscriptionController@getActiveSubscription error:', error);
      return response.badRequest('error.serverError', res, error);
    }
  }


  // =========================================================================
  // POST /api/v1/subscriptions/sync  — Auth required (any user)
  //
  // Called by the frontend AFTER a purchase / on every app launch.
  // Hits the RevenueCat REST API directly, maps the result, and upserts
  // the subscription record in our DB. Returns the up-to-date status.
  //
  // This makes the system independent of webhooks — if a webhook was
  // missed, this call will catch it and heal the DB automatically.
  // =========================================================================
  syncSubscription = async (req, res) => {
    console.log('SubscriptionController@syncSubscription');

    try {
      const userId = req.user._id.toString();

      const entitlement = process.env.REVENUECAT_ENTITLEMENT_ID || 'premium';

      // ── 1. Call RevenueCat REST API ───────────────────────────────────────
      const { status: rcStatus, data: subscriber, message } = await revenueCatService.getSubscriber(userId);

      if (!rcStatus || !subscriber) {
        console.warn(`[Sync] RC API call failed for user ${userId}: ${message}`);
        // Fall back to returning whatever we have in DB — never block the user
        const user = await UserModel.getOneByColumnNameAndValue('_id', userId);
        const activeSub = user?.active_subscription || {};
        return response.success('success.subscriptionData', res, {
          is_subscribed: !!(activeSub?._id),
          active_subscription: activeSub,
          synced_from_rc: false
        });
      }

      // console.log('subscriber======>', subscriber);
      // ── 2. Map RC response to our status model ────────────────────────────
      const rcData = revenueCatService.resolveSubscriptionStatus(subscriber, entitlement);
      // console.log('rcData======>', rcData);

      // ── 3. Upsert our local DB record ─────────────────────────────────────
      // Key: user_id + product_id
      // This is the atomic write that prevents sync ↔ webhook race conditions.
      // Whether sync or webhook ran first, both will resolve to the same document.
      if (rcData.status && rcData.productId) {
        const storeMap = {
          'app_store': SubscriptionModel.platforms.APP_STORE,
          'play_store': SubscriptionModel.platforms.PLAY_STORE,
          'stripe': SubscriptionModel.platforms.APP_STORE
        };
        const platform = storeMap[rcData.store?.toLowerCase()] || SubscriptionModel.platforms.APP_STORE;

        // Match on user_id + product_id so sync and webhook target the same row.
        // We intentionally do NOT filter on `status` here — we want to find the
        // record regardless of its current status and bring it up to date.
        const matchFilter = {
          user_id: userId,
          product_id: rcData.productId
        };

        const setData = {
          status: rcData.status,
          plan_type: rcData.planType,
          is_trial_plan: rcData.isTrialPlan,
          current_period_end: rcData.currentPeriodEnd,
          current_period_start: rcData.currentPeriodStart,
          cancel_at_period_end: rcData.cancelAtPeriodEnd,
          platform: platform,
          subscription_id: rcData.subscriptionId,
          price: rcData.price,
          product_identifier: rcData.productIdentifier,
          rc_synced_at: new Date()   // version timestamp
        };

        // Fields only written when CREATING a brand-new doc (not overwritten on update).
        // platform is already in setData so it is set on both create and update paths.
        const setOnInsertData = {
          user_id: userId,
          product_id: rcData.productId
        };
        // console.log('matchFilter======>', matchFilter);
        // console.log('setData======>', setData);
        // console.log('setOnInsertData======>', setOnInsertData);

        const hasSubscriptionUpdated = await SubscriptionModel.upsertSubscription(matchFilter, setData, setOnInsertData);

        if (hasSubscriptionUpdated && !setData.is_trial_plan && setData.plan_type === SubscriptionModel.planTypes.YEARLY) {
          // ── Referral payout date ──────────────────────────────────────────
          const eligibleToPayoutAt = process.env.STREAK_MILESTONE_TEST_MODE === "true"
                                      ? moment().add(30, 'minutes').endOf('minute').toDate()
                                      : moment().add(30, 'days').endOf('day').toDate();

          const eligibleToReferralPayoutAt = process.env.STREAK_MILESTONE_TEST_MODE === "true"
                                              ? moment().add(7, 'minutes').endOf('minute').toDate()
                                              : moment().add(7, 'days').endOf('day').toDate();
          await this._handleReferralTracking(userId, eligibleToPayoutAt, eligibleToReferralPayoutAt);
        }
      }

      // ── 4. Re-fetch the user so active_subscription is freshly computed ───
      const updatedUser = await UserModel.getOneByColumnNameAndValue('_id', userId);
      const activeSub = updatedUser?.active_subscription || {};

      return response.success('success.subscriptionSynced', res, {
        is_subscribed: rcData.isActive,
        active_subscription: activeSub,
        synced_from_rc: true
      });

    } catch (error) {
      console.error('SubscriptionController@syncSubscription error:', error);
      return response.badRequest('error.serverError', res, error);
    }
  }


  // =========================================================================
  // RevenueCat Webhook Handler
  //
  // DESIGN NOTES:
  //   • Fast-ACK: we respond 200 immediately so RevenueCat never times out,
  //     then process asynchronously.
  //   • Idempotency: we use a `rc_event_id` unique index in MongoDB instead
  //     of an in-memory Set, so it survives server restarts and scale-out.
  //   • app_user_id is validated as a MongoDB ObjectId before any DB writes.
  //   • Authorization header is verified by the revenueCatWebhook middleware
  //     (applied at the route level).
  // =========================================================================
  handleRevenueCatWebhook = async (req, res) => {
    console.log("SubscriptionController@handleRevenueCatWebhook");

    // ── Fast-ACK: tell RevenueCat we received it immediately ──────────────
    // Processing happens asynchronously after this point.
    res.status(200).send('OK');

    try {
      const payload = req.body;
      const eventData = payload?.event;
      const eventType = eventData.type;
      console.log(eventType, '=========eventType');

      if (!eventData) {
        console.warn('[RC Webhook] Received payload without event object — ignoring.');
        return;
      }

      const rawUserId = eventData.app_user_id;     // Could be ObjectId string or alias
      // ── Validate app_user_id is a real MongoDB ObjectId ───────────────
      //
      // RevenueCat stores whatever string you set as the app_user_id.
      // We only process events where it is a valid Mongo ObjectId —
      // all other values (RC anonymous IDs like "$RCAnonymousID:…") are
      // skipped so we never hit a Mongoose CastError and return 500.
      //
      if (!rawUserId || !mongoose.Types.ObjectId.isValid(rawUserId)) {
        console.warn(
          `[RC Webhook] Skipping event "${eventId}" — app_user_id "${rawUserId}" ` +
          `is not a valid MongoDB ObjectId (likely an anonymous RC user).`
        );
        return;
      }

      const userId = rawUserId; // confirmed valid ObjectId string
      const eventId = eventData.id;              // Unique per event delivery

      // ── DB-level idempotency check ─────────────────────────────────────
      // Replaces the in-memory Set that was wiped on every server restart.
      const alreadyProcessed = await SubscriptionModel.isEventAlreadyProcessed(eventId);
      if (alreadyProcessed) {
        console.log(`[RC Webhook] Event "${eventId}" already processed — skipping duplicate.`);
        return;
      }

      const entitlement = process.env.REVENUECAT_ENTITLEMENT_ID || 'premium';

      // ── 1. Call RevenueCat REST API ───────────────────────────────────────
      const { status: rcStatus, data: subscriber, message } = await revenueCatService.getSubscriber(userId);

      if (!rcStatus || !subscriber) {
        console.warn(`[Sync] RC API call failed for user ${userId}: ${message}`);
        // Fall back to returning whatever we have in DB — never block the user
        return;
      }

      // ── 2. Map RC response to our status model ────────────────────────────
      const rcData = revenueCatService.resolveSubscriptionStatus(subscriber, entitlement);

      // ── 3. Upsert our local DB record ─────────────────────────────────────
      // Key: user_id + product_id
      // This is the atomic write that prevents sync ↔ webhook race conditions.
      // Whether sync or webhook ran first, both will resolve to the same document.
      if (rcData.status && rcData.productId) {
        const storeMap = {
          'app_store': SubscriptionModel.platforms.APP_STORE,
          'play_store': SubscriptionModel.platforms.PLAY_STORE,
          'stripe': SubscriptionModel.platforms.APP_STORE
        };
        const platform = storeMap[rcData.store?.toLowerCase()] || SubscriptionModel.platforms.APP_STORE;

        // Match on user_id + product_id so sync and webhook target the same row.
        // We intentionally do NOT filter on `status` here — we want to find the
        // record regardless of its current status and bring it up to date.
        const matchFilter = {
          user_id: userId,
          product_id: rcData.productId
        };

        const setData = {
          status: rcData.status,
          plan_type: rcData.planType,
          is_trial_plan: rcData.isTrialPlan,
          current_period_end: rcData.currentPeriodEnd,
          current_period_start: rcData.currentPeriodStart,
          cancel_at_period_end: rcData.cancelAtPeriodEnd,
          platform: platform,
          subscription_id: rcData.subscriptionId,
          price: rcData.price,
          product_identifier: rcData.productIdentifier,
          rc_event_id: eventId,
          rc_synced_at: new Date()   // version timestamp
        };

        // Fields only written when CREATING a brand-new doc (not overwritten on update).
        // platform is already in setData so it is set on both create and update paths.
        const setOnInsertData = {
          user_id: userId,
          product_id: rcData.productId
        };
        // console.log('matchFilter======>', matchFilter);
        // console.log('setData======>', setData);
        // console.log('setOnInsertData======>', setOnInsertData);

        const hasSubscriptionUpdated = await SubscriptionModel.upsertSubscription(matchFilter, setData, setOnInsertData);

        if (hasSubscriptionUpdated && !setData.is_trial_plan && setData.plan_type === SubscriptionModel.planTypes.YEARLY) {
          // ── Referral payout date ──────────────────────────────────────────
          const eligibleToPayoutAt = process.env.STREAK_MILESTONE_TEST_MODE === "true"
                                      ? moment().add(30, 'minutes').endOf('minute').toDate()
                                      : moment().add(30, 'days').endOf('day').toDate();

          const eligibleToReferralPayoutAt = process.env.STREAK_MILESTONE_TEST_MODE === "true"
                                              ? moment().add(7, 'minutes').endOf('minute').toDate()
                                              : moment().add(7, 'days').endOf('day').toDate();

          await this._handleReferralTracking(userId, eligibleToPayoutAt, eligibleToReferralPayoutAt);
        }
      }

      return;

      // console.log(JSON.stringify(eventData), '=======eventData');

      // // ── Extract common event fields ───────────────────────────────────
      
      // const eventType = eventData.type;
      // const productId = eventData.product_id;
      // const store = eventData.store;           // "APP_STORE" | "PLAY_STORE"
      // const amount = eventData.price_in_purchased_currency;
      // const currency = eventData.currency;
      
      // const transactionId = eventData.original_transaction_id;
      // const metaData = eventData.metadata;

      // const purchaseDate = new Date(eventData?.purchased_at_ms);
      // const expiryDate = new Date(eventData?.expiration_at_ms);



      // let planType = productId?.includes('yearly') 
      //                                     ? SubscriptionModel.planTypes.YEARLY
      //                                     : SubscriptionModel.planTypes.MONTHLY;

      // // ── Referral payout date ──────────────────────────────────────────
      // const eligibleToPayoutAt = process.env.STREAK_MILESTONE_TEST_MODE === "true"
      //   ? moment().add(30, 'minutes').endOf('minute').toDate()
      //   : moment().add(30, 'days').endOf('day').toDate();

      // // ── Check if a SCHEDULED subscription already exists for this user ─
      // const isScheduledSubscriptionExist = await SubscriptionModel.getOneByColumnNameAndValue(
      //   "user_id", userId, { status: SubscriptionModel.statuses.SCHEDULED }
      // );

      // // ── Route event to the correct handler ────────────────────────────
      // switch (eventType) {

      //   case 'INITIAL_PURCHASE': {
      //     // Skip when user already has a scheduled (product-change) subscription pending.
      //     if (isScheduledSubscriptionExist) {
      //       console.log(`[RC Webhook] INITIAL_PURCHASE skipped — SCHEDULED sub exists for user ${userId}`);
      //       break;
      //     }

      //     // ── Build the subscription data object ──────────────────────────
      //     let setData = {
      //       user_id: userId,
      //       platform: store,
      //       purchase_token: eventId,
      //       subscription_id: transactionId,
      //       product_id: productId,
      //       current_period_start: purchaseDate.toISOString(),
      //       current_period_end: expiryDate.toISOString(),
      //       status: SubscriptionModel.statuses.ACTIVE,
      //       plan_type: planType,
      //       price: { amount, currency },
      //       metadata: metaData,
      //       rc_synced_at: new Date()
      //     };

      //     if (eventData.period_type === 'TRIAL') {
      //       setData.is_trial_plan = true;
      //       setData.trial_plan_offer_code = eventData?.offer_code || '';
      //     }

      //     // ── Atomic upsert keyed on user_id + subscription_id ────────────
      //     // If sync already created a record for this subscription (no rc_event_id),
      //     // this stamps rc_event_id onto it. If no record exists, creates one.
      //     // Either way — exactly ONE document per subscription_id per user.
      //     const matchFilter = { user_id: userId, subscription_id: transactionId };

      //     // rc_event_id is set via $setOnInsert (only on new doc creation).
      //     // On an UPDATE (sync-created doc), rc_event_id stays null until now —
      //     // we patch it here via setData so it gets the correct idempotency key.
      //     setData.rc_event_id = eventId;

      //     // Fields only written when CREATING a brand-new doc (not overwritten on update).
      //     // platform is already in setData so it is set on both create and update paths.
      //     const setOnInsertData = {
      //       user_id: userId,
      //       product_id: productId
      //     };
      //     console.log('matchFilter======>', matchFilter);
      //     console.log('setData======>', setData);
      //     console.log('setOnInsertData======>', setOnInsertData);

      //     const subscriptionObj = await SubscriptionModel.upsertSubscription(matchFilter, setData, setOnInsertData);
      //     if (!subscriptionObj) {
      //       console.error(`[RC Webhook] INITIAL_PURCHASE: DB write failed for user ${userId}`);
      //       break;
      //     }

      //     // Track referrals only for paid yearly plans
      //     if (!subscriptionObj.is_trial_plan && subscriptionObj.plan_type === SubscriptionModel.planTypes.YEARLY) {
      //       await this._handleReferralTracking(userId, eligibleToPayoutAt);
      //     }
      //     break;
      //   }

      //   case 'RENEWAL': {
      //     // ── RENEWAL creates a NEW subscription row intentionally ──────────
      //     // Each billing cycle is its own row (audit trail).
      //     // But if sync created a placeholder row for this transactionId, we
      //     // update that instead of creating a second row.
      //     const matchFilter = { user_id: userId, subscription_id: transactionId };

      //     const setData = {
      //       user_id: userId,
      //       platform: store,
      //       rc_event_id: eventId,
      //       purchase_token: eventId,
      //       subscription_id: transactionId,
      //       product_id: productId,
      //       current_period_start: purchaseDate.toISOString(),
      //       current_period_end: expiryDate.toISOString(),
      //       status: SubscriptionModel.statuses.ACTIVE,
      //       plan_type: planType,
      //       price: { amount, currency },
      //       metadata: metaData,
      //       rc_synced_at: new Date()
      //     };

      //     // Fields only written when CREATING a brand-new doc (not overwritten on update).
      //     // platform is already in setData so it is set on both create and update paths.
      //     const setOnInsertData = {
      //       user_id: userId,
      //       product_id: productId
      //     };
      //     console.log('matchFilter======>', matchFilter);
      //     console.log('setData======>', setData);
      //     console.log('setOnInsertData======>', setOnInsertData);

      //     const subscriptionObj = await SubscriptionModel.upsertSubscription(matchFilter, setData);
      //     if (!subscriptionObj) {
      //       console.error(`[RC Webhook] RENEWAL: DB write failed for user ${userId}`);
      //       break;
      //     }

      //     // Track referrals only for paid yearly renewals
      //     if (!subscriptionObj.is_trial_plan && subscriptionObj.plan_type === SubscriptionModel.planTypes.YEARLY) {
      //       await this._handleReferralTracking(userId, eligibleToPayoutAt);
      //     }
      //     break;
      //   }

      //   case 'CANCELLATION': {
      //     // Mark the active subscription's canceled_at.
      //     // Status remains ACTIVE until the period ends (cron or EXPIRATION event handles that).
      //     const whereCondition = {
      //       user_id: userId,
      //       subscription_id: transactionId,
      //       status: SubscriptionModel.statuses.ACTIVE
      //     };
      //     const updateData = {
      //       canceled_at: new Date(eventData?.event_timestamp_ms).toISOString(),
      //       cancel_at_period_end: true
      //     };

      //     const updated = await SubscriptionModel.findOneAndUpdate(whereCondition, updateData);
      //     if (!updated) {
      //       console.warn(`[RC Webhook] CANCELLATION: no ACTIVE record found for user ${userId}, txn ${transactionId}`);
      //     }
      //     break;
      //   }

      //   case 'EXPIRATION': {
      //     // Match ACTIVE or CANCELED (a user can cancel → then it expires)
      //     const whereCondition = {
      //       user_id: userId,
      //       subscription_id: transactionId,
      //       status: { $in: [SubscriptionModel.statuses.ACTIVE, SubscriptionModel.statuses.CANCELED] }
      //     };

      //     const updated = await SubscriptionModel.findOneAndUpdate(whereCondition, {
      //       status: SubscriptionModel.statuses.EXPIRED
      //     });

      //     if (!updated) {
      //       console.warn(`[RC Webhook] EXPIRATION: no ACTIVE/CANCELED record found for user ${userId}, txn ${transactionId}`);
      //     }
      //     break;
      //   }

      //   case 'PRODUCT_CHANGE': {
      //     // Downgrade/upgrade queued for next billing cycle — record as SCHEDULED.
      //     if (isScheduledSubscriptionExist) {
      //       console.log(`[RC Webhook] PRODUCT_CHANGE skipped — SCHEDULED sub already exists for user ${userId}`);
      //       break;
      //     }

      //     const subscriptionsData = {
      //       user_id: userId,
      //       platform: store,
      //       rc_event_id: eventId,       // idempotency key
      //       purchase_token: eventId,
      //       subscription_id: transactionId,
      //       product_id: eventData?.new_product_id,
      //       current_period_start: purchaseDate.toISOString(),
      //       current_period_end: expiryDate.toISOString(),
      //       status: SubscriptionModel.statuses.SCHEDULED,
      //       plan_type: planType,
      //       price: { amount, currency },
      //       metadata: metaData
      //     };

      //     const subscriptionObj = await SubscriptionModel.createOne(subscriptionsData);
      //     if (!subscriptionObj) {
      //       // FIX: was incorrectly referencing `eventData.event.app_user_id`
      //       console.error(`[RC Webhook] PRODUCT_CHANGE: DB write failed for user ${userId}`);
      //     }
      //     break;
      //   }

      //   case 'BILLING_ISSUE': {
      //     // Payment failed — move subscription to on_hold.
      //     const whereCondition = {
      //       user_id: userId,
      //       subscription_id: transactionId,
      //       status: SubscriptionModel.statuses.ACTIVE
      //     };

      //     const updated = await SubscriptionModel.findOneAndUpdate(whereCondition, {
      //       status: SubscriptionModel.statuses.ON_HOLD
      //     });

      //     if (!updated) {
      //       console.warn(`[RC Webhook] BILLING_ISSUE: no ACTIVE record found for user ${userId}, txn ${transactionId}`);
      //     }
      //     break;
      //   }

      //   case 'REFUND': {
      //     // User was refunded — mark the subscription as refunded.
      //     const whereCondition = {
      //       user_id: userId,
      //       subscription_id: transactionId,
      //       status: { $in: [SubscriptionModel.statuses.ACTIVE, SubscriptionModel.statuses.CANCELED] }
      //     };

      //     const updated = await SubscriptionModel.findOneAndUpdate(whereCondition, {
      //       status: SubscriptionModel.statuses.REFUNDED
      //     });

      //     if (!updated) {
      //       console.warn(`[RC Webhook] REFUND: no ACTIVE/CANCELED record found for user ${userId}, txn ${transactionId}`);
      //     }
      //     break;
      //   }

      //   case 'UNCANCELLATION': {
      //     // User re-subscribed before the period ended — remove cancellation markers.
      //     const whereCondition = {
      //       user_id: userId,
      //       subscription_id: transactionId,
      //       status: SubscriptionModel.statuses.ACTIVE
      //     };

      //     await SubscriptionModel.findOneAndUpdate(whereCondition, {
      //       canceled_at: '',
      //       cancel_at_period_end: false
      //     });
      //     break;
      //   }

      //   case 'SUBSCRIBER_ALIAS': {
      //     // RC merged two subscriber IDs — informational only, no action needed.
      //     console.log(`[RC Webhook] SUBSCRIBER_ALIAS received for user ${userId} — no DB action required.`);
      //     break;
      //   }

      //   default: {
      //     console.log(`[RC Webhook] Unhandled event type "${eventType}" for user ${userId} — ignoring.`);
      //     break;
      //   }
      // }

    } catch (error) {
      // We already sent 200, so we just log the error.
      console.error('[RC Webhook] Processing error:', error);
    }
  };


  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Creates a referral track entry if the user was referred and hasn't
   * already been tracked. Called for paid YEARLY INITIAL_PURCHASE and RENEWAL.
   *
   * @param {string} userId          - MongoDB ObjectId string of the subscriber
   * @param {Date}   eligibleToPayoutAt
   */
  _handleReferralTracking = async (userId, eligibleToPayoutAt, eligibleToReferralPayoutAt) => {
    try {
      const userDetails = await UserModel.getOneByColumnNameAndValue('_id', userId);
      const referredBy = userDetails?.referred_by;

      if (!referredBy) return;

      // Check the referred user hasn't already been tracked
      const existingTrack = await ReferralTrackModel.getOneByColumnNameAndValue('user_id', userId);
      if (existingTrack) return;

      const referrerUser = await UserModel.getOneByColumnNameAndValue('_id', referredBy);
      if (!referrerUser) return;

      const referrerTrackData = {
        user_id: userId,
        referrer_id: referredBy,
        reward_type: ReferralTrackModel.rewardTypes.REFERRER,
        referrer_code: referrerUser?.referral_code,
        eligible_to_payout_at: eligibleToPayoutAt,
        reward_amount: process.env.REFERRER_REWARD_AMOUNT ? Number(process.env.REFERRER_REWARD_AMOUNT) : 10
      };

      await ReferralTrackModel.createOne(referrerTrackData);

      const referralTrackData = {
        user_id: userId,
        referrer_id: referredBy,
        reward_type: ReferralTrackModel.rewardTypes.REFERRAL,
        referrer_code: referrerUser?.referral_code,
        eligible_to_payout_at: eligibleToReferralPayoutAt,
        reward_amount: process.env.REFERRAL_REWARD_AMOUNT ? Number(process.env.REFERRAL_REWARD_AMOUNT) : 3
      };

      await ReferralTrackModel.createOne(referralTrackData);

    } catch (error) {
      console.error('[RC Webhook] _handleReferralTracking error:', error);
    }
  };

}

module.exports = new SubscriptionController();
