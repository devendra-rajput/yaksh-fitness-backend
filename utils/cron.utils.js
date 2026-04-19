const cron = require('node-cron');
const SubscriptionModel = require('../resources/v1/subscriptions/subscriptions.model');
const ReferralTrackModel = require('../resources/v1/referral_track/referral_tracks.model');
const UserModel = require('../resources/v1/users/users.model');
const PayoutsModel = require('../resources/v1/payouts/payouts.model')
// const revenueCatService = require('../services/revenuecat');
const nodemailer = require('../services/nodemailer');
// const stripeService = require('../services/stripe');
const getStripeService = () => require('../services/stripe');
const referralPayoutAdminNotificationTemplate = require('../emailTemplates/v1/referralPayoutAdminNotification');
const referralPayoutUserNotificationTemplate = require('../emailTemplates/v1/referralPayoutUserNotification');

const startCronJob = async () => {

    // ──────────────────────────────────────────────────────────────────────────
    // CRON 1: Referral payout eligibility
    // Runs every 10 min (test mode) or daily at 1:00 AM (production)
    // ──────────────────────────────────────────────────────────────────────────
    const isTestMode = process.env.STREAK_MILESTONE_TEST_MODE === "true";
    const cronString1 = isTestMode ? '*/10 * * * *' : '0 1 * * *';

    cron.schedule(cronString1, async () => {
        console.log("[Cron] Referral payout eligibility check started");
        try {
            const pendingReferrals = await ReferralTrackModel.getPendingReferralsToMarkAsEligible();

            await Promise.all(
                pendingReferrals.map(async (referral) => {
                    if (!referral?.user_id) 
                        return;

                    const user = await UserModel.getOneByColumnNameAndValue("_id", referral.user_id);
                    if (user?.active_subscription?.plan_type === SubscriptionModel.planTypes.YEARLY) {

                        await ReferralTrackModel.updateOne(referral._id, {
                            reward_status: ReferralTrackModel.statuses.ELIGIBLE
                        });

                        if(referral.reward_type == ReferralTrackModel.rewardTypes.REFERRER){
                            await UserModel.updateOne(
                                { _id: referral.referrer_id },
                                {
                                    $inc: {
                                        total_referrer_amount: Number(referral.reward_amount),
                                        available_referrer_amount: Number(referral.reward_amount)
                                    }
                                }
                            );
                        }
                        else if(referral.reward_type == ReferralTrackModel.rewardTypes.REFERRAL){
                            await UserModel.updateOne(
                                { _id: referral.referrer_id },
                                {
                                    $inc: {
                                        total_referral_amount: Number(referral.reward_amount),
                                        available_referral_amount: Number(referral.reward_amount)
                                    }
                                }
                            );
                        }
                        
                    }
                })
            );
            console.log("[Cron] Referral eligibility: all records processed");
        } catch (err) {
            console.error('[Cron] Referral eligibility error:', err.stack);
        }
        return;
    });


    // ──────────────────────────────────────────────────────────────────────────
    // CRON 2: Local DB expiry sweep
    // Runs every 2 minutes — marks locally-expired ACTIVE subs as EXPIRED
    // and activates SCHEDULED subs once their start date is reached.
    // This is a fast safety net that does NOT call RevenueCat.
    // ──────────────────────────────────────────────────────────────────────────
    const cronString2 = '*/2 * * * *';
    cron.schedule(cronString2, async () => {
        console.log("[Cron] Local subscription expiry sweep started");
        try {
            const now = new Date();
            const activeSubscriptions = await SubscriptionModel.getAllSubscriptions({
                status: SubscriptionModel.statuses.ACTIVE
            });

            for (const subscription of activeSubscriptions) {
                if (now > new Date(subscription.current_period_end)) {

                    await SubscriptionModel.updateOne(subscription._id, {
                        status: SubscriptionModel.statuses.EXPIRED
                    });
                    console.log(`[Cron] Subscription ${subscription._id} expired (local sweep)`);

                    // Activate a pending SCHEDULED subscription for this user if its start date arrived
                    const userId = subscription?.user_id;
                    const scheduledSub = await SubscriptionModel.getOneByColumnNameAndValue(
                        "user_id", userId, { status: SubscriptionModel.statuses.SCHEDULED }
                    );
                    if (scheduledSub && now >= new Date(scheduledSub.current_period_start)) {
                        await SubscriptionModel.updateOne(scheduledSub._id, {
                            status: SubscriptionModel.statuses.ACTIVE
                        });
                        console.log(`[Cron] Scheduled subscription ${scheduledSub._id} activated for user ${userId}`);
                    }
                }
            }
        } catch (err) {
            console.error('[Cron] Local expiry sweep error:', err.message);
        }
        return;
    });


    // ──────────────────────────────────────────────────────────────────────────
    // CRON 3: RevenueCat background sync
    //
    // This is the KEY cron that makes the system webhook-independent.
    // Every 30 minutes (production) or every 5 minutes (test mode) it:
    //   1. Fetches all users who have a non-expired subscription in our DB
    //   2. Calls RevenueCat REST API for each (with a small delay to avoid rate limits)
    //   3. Updates the DB to match RC's source of truth
    //
    // RC API rate limit: ~150 req/min. We add a 500ms delay between calls
    // so for up to ~90 concurrent active subscribers this runs safely.
    // For larger user bases, increase the cron interval or batch in smaller chunks.
    //
    // Runs: every 30 min (prod) | every 5 min (test)
    // ──────────────────────────────────────────────────────────────────────────

    // const cronString3 = isTestMode ? '*/5 * * * *' : '*/30 * * * *';
    // const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID || 'premium';
    // const RC_CALL_DELAY_MS = 500; // ms pause between RC API calls to avoid rate limiting

    // cron.schedule(cronString3, async () => {
    //     console.log("[Cron] RevenueCat background sync started");
    //     try {
    //         // Collect users who have a subscription that might need checking:
    //         // ACTIVE, IN_GRACE, ON_HOLD, or CANCELED (still within period)
    //         const subsToCheck = await SubscriptionModel.getAllSubscriptions({
    //             status: {
    //                 $in: [
    //                     SubscriptionModel.statuses.ACTIVE,
    //                     SubscriptionModel.statuses.IN_GRACE,
    //                     SubscriptionModel.statuses.ON_HOLD,
    //                     SubscriptionModel.statuses.CANCELED
    //                 ]
    //             }
    //         });

    //         if (!subsToCheck || !subsToCheck.length) {
    //             console.log("[Cron] RC sync: no subscriptions to check");
    //             return;
    //         }

    //         // De-duplicate by user_id — only one RC call per user
    //         const uniqueUserIds = [...new Set(subsToCheck.map(s => s.user_id?.toString()).filter(Boolean))];
    //         console.log(`[Cron] RC sync: checking ${uniqueUserIds.length} unique users`);

    //         let processed = 0;
    //         let updated = 0;

    //         for (const userId of uniqueUserIds) {
    //             try {
    //                 // ── Call RevenueCat REST API ──────────────────────────────
    //                 const { status: rcOk, data: subscriber } =
    //                     await revenueCatService.getSubscriber(userId);

    //                 if (!rcOk || !subscriber) {
    //                     console.warn(`[Cron] RC sync: API call failed for user ${userId} — skipping`);
    //                     continue;
    //                 }

    //                 // ── Map RC response → our status ──────────────────────────
    //                 const rcData = revenueCatService.resolveSubscriptionStatus(subscriber, entitlementId);

    //                 if (!rcData.status) {
    //                     // RC has no record of this user — leave DB as-is
    //                     continue;
    //                 }

    //                 const storeMap = {
    //                     'app_store': SubscriptionModel.platforms.APP_STORE,
    //                     'play_store': SubscriptionModel.platforms.PLAY_STORE,
    //                     'stripe': SubscriptionModel.platforms.APP_STORE
    //                 };
    //                 const platform = storeMap[rcData.store?.toLowerCase()] || SubscriptionModel.platforms.APP_STORE;

    //                 // ── Update the DB record ──────────────────────────────────
    //                 const whereCondition = {
    //                     user_id: userId,
    //                     status: {
    //                         $in: [
    //                             SubscriptionModel.statuses.ACTIVE,
    //                             SubscriptionModel.statuses.IN_GRACE,
    //                             SubscriptionModel.statuses.ON_HOLD,
    //                             SubscriptionModel.statuses.CANCELED
    //                         ]
    //                     }
    //                 };

    //                 const dbUpdated = await SubscriptionModel.findOneAndUpdate(whereCondition, {
    //                     status: rcData.status,
    //                     plan_type: rcData.planType,
    //                     product_id: rcData.productId,
    //                     current_period_end: rcData.currentPeriodEnd,
    //                     current_period_start: rcData.currentPeriodStart,
    //                     cancel_at_period_end: rcData.cancelAtPeriodEnd,
    //                     platform: platform
    //                 });

    //                 if (dbUpdated) {
    //                     updated++;
    //                     console.log(`[Cron] RC sync: user ${userId} → status="${rcData.status}", plan="${rcData.planType}"`);
    //                 }

    //                 processed++;

    //                 // ── Rate limit guard: pause between RC API calls ──────────
    //                 await new Promise(resolve => setTimeout(resolve, RC_CALL_DELAY_MS));

    //             } catch (userError) {
    //                 console.error(`[Cron] RC sync: error processing user ${userId}:`, userError.message);
    //                 // Continue to next user even if one fails
    //             }
    //         }

    //         console.log(`[Cron] RC sync complete — ${processed} checked, ${updated} DB records updated`);

    //     } catch (err) {
    //         console.error('[Cron] RC sync error:', err.message);
    //     }
    // });


    // ──────────────────────────────────────────────────────────────────────────
    // CRON 4: Referral payout admin notification
    // Runs every hour — finds eligible referral records (reward_status: eligible,
    // payout_email_sent_at: null, reward_type: referrer), groups by referrer,
    // emails the admin, and marks the records as email-sent.
    // ──────────────────────────────────────────────────────────────────────────
    const cronString4 = isTestMode ? '*/1 * * * *' : '0 0 1 * * *'; // Schedule to run at 1:00 ('0 0 1 * * *') am everyday
    cron.schedule(cronString4, async () => {
        console.log("[Cron] Referral payout admin notification check started");
        try {
            // Filter all the referral track records where reward status is eligible and email is not sent to admin for those records
            let filterObj = {
                payout_email_sent_at: null,
                reward_type: ReferralTrackModel.rewardTypes.REFERRER
            }

            const eligibleRecords = await ReferralTrackModel.getReferralsForPayout(filterObj);
            if (!eligibleRecords?.length) {
                console.log("[Cron] Referral payout: no eligible records found");
                return;
            }

            const referralsToPayout = eligibleRecords.map((referralTrack) => {
                                            const referrerInfo = referralTrack.referred_by || {};
                                            return {
                                                name: referrerInfo?.first_name ? `${referrerInfo.first_name} ${referrerInfo?.last_name || ''}`.trim() : '',
                                                totalAmount: Number(referralTrack.totalAmount || 0),
                                                ids: referralTrack.referrals.map((referral) => referral._id)
                                            };
                                        }).filter(item => item.totalAmount > 0);

            const grandTotal = referralsToPayout.reduce((sum, item) => sum + item.totalAmount, 0); // Total amount of all the users to be debited from admin account

            const debitTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
            const adminName = `Elevyn`
            const emailHtml = await referralPayoutAdminNotificationTemplate(referralsToPayout, grandTotal, debitTime, adminName);

            const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPPORT_MAIL;
            const subject = 'Referral Payout Notification — Action Required'
            
            try {
                nodemailer.sendMail(adminEmail, subject, emailHtml);
            } catch (error) {
                console.error('[Cron] Referral payout admin notification error:', error.stack);   
            }

            // Mark all records as email sent
            const referralTrackIds = referralsToPayout.flatMap((item) => item.ids);
            await ReferralTrackModel.updateMany(referralTrackIds,  {payout_email_sent_at: new Date()});

            console.log(`[Cron] Referral payout: ${referralTrackIds.length} records marked as email-sent`);

        } catch (err) {
            console.error('[Cron] Referral payout admin notification error:', err.stack);
        }
        return;
    });


    // ──────────────────────────────────────────────────────────────────────────
    // CRON 5: Referral payout Stripe transfer
    // Finds referral records where admin email has been sent
    // (payout_email_sent_at != null), validates the referrer's Stripe
    // connected account, transfers the reward amount, and marks records
    // as paid. Each referrer is processed independently so one failure
    // does not block others.
    // ──────────────────────────────────────────────────────────────────────────
    const cronString5 = isTestMode ? '*/1 * * * *' : '0 0 1 * * *'; // Schedule to run at 1:00 ('0 0 1 * * *') am everyday
    cron.schedule(cronString5, async () => {// Schedule to run at 1:00 am everyday
        console.log("[Cron] Referral payout Stripe transfer started");
        try {

            const stripeService = getStripeService();
            // Fetch eligible records where admin email has already been sent
            const filterObj = {
                payout_email_sent_at: { 
                    $ne: null 
                },
                reward_type: ReferralTrackModel.rewardTypes.REFERRER,
            };

            const referralsForPayout = await ReferralTrackModel.getReferralsForPayout(filterObj);
            if (!referralsForPayout?.length) {
                console.log("[Cron] Stripe transfer: no records found to payout");
                return;
            }

            // Check Stripe balance before transfer
            const { availableBalance: adminAvailableBalance, pendingBalance: adminPendingBalance } = await stripeService.getAdminAccountBalance();
            let adminAvailableBalanceUSD = adminAvailableBalance?.amount ? adminAvailableBalance.amount / 100 : 0; // Converted cents into dollars

            let totalTransferred = 0;
            let totalSkipped = 0;
            let totalFailed = 0;

            for (const referralForPayoutObj of referralsForPayout) {
                const referrerId = referralForPayoutObj.referrer_id;
                const referrerName = referralForPayoutObj.referred_by
                    ? `${referralForPayoutObj.referred_by.first_name} ${referralForPayoutObj.referred_by.last_name}`.trim()
                    : 'Unknown';
                const amountToPayout = Number(referralForPayoutObj.totalAmount || 0);
                const referralTrackIds = referralForPayoutObj.referrals.map((r) => r._id);

                try {
                    // Validate amount
                    if (!amountToPayout || amountToPayout <= 0.5) {
                        console.warn(`[Cron] Stripe transfer: skipping ${referrerName} — invalid amount ($${amountToPayout})`);
                        await ReferralTrackModel.updateMany(referralTrackIds, {
                            payout_status: PayoutsModel.PayoutStatuses.FAILED,
                            payout_status_description: `Invalid payout amount ($${amountToPayout})`
                        });
                        totalSkipped++;
                        continue;
                    }

                    // Check Stripe account exists in DB
                    if (!referralForPayoutObj.stripe_account_id) {
                        console.warn(`[Cron] Stripe transfer: skipping ${referrerName} — no stripe_account_id`);
                        await ReferralTrackModel.updateMany(referralTrackIds, {
                            payout_status: PayoutsModel.PayoutStatuses.FAILED,
                            payout_status_description: 'Missing stripe connected account ID'
                        });
                        totalSkipped++;
                        continue;
                    }

                    // Check onboarding status in DB
                    if (referralForPayoutObj.stripe_onboarding_status !== 'true') {
                        console.warn(`[Cron] Stripe transfer: skipping ${referrerName} — onboarding status is '${referralForPayoutObj.stripe_onboarding_status}'`);
                        await ReferralTrackModel.updateMany(referralTrackIds, {
                            payout_status: PayoutsModel.PayoutStatuses.FAILED,
                            payout_status_description: 'Stripe onboarding incomplete'
                        });
                        totalSkipped++;
                        continue;
                    }

                    if (adminAvailableBalanceUSD < amountToPayout) {
                        console.warn(`[Cron] Stripe transfer: skipping ${referrerName} — insufficient live balance ($${adminAvailableBalanceUSD} < $${amountToPayout})`);
                        await ReferralTrackModel.updateMany(referralTrackIds, {
                            payout_status: PayoutsModel.PayoutStatuses.FAILED,
                            payout_status_description: 'Insufficient admin balance'
                        });
                        totalSkipped++;
                        continue;
                    }

                    // Execute the transfer
                    const payoutResult = await stripeService.createPayout(amountToPayout, referralForPayoutObj.stripe_account_id);

                    if (!payoutResult || !payoutResult.success) {
                        // Transfer failed — mark records with payout error status
                        const errorMsg = payoutResult?.error || 'Unknown transfer error';
                        console.error(`[Cron] Stripe transfer FAILED for ${referrerName}: ${errorMsg}`);

                        await ReferralTrackModel.updateMany(referralTrackIds, { 
                            payout_status: PayoutsModel.PayoutStatuses.STRIPE_ERROR,
                            payout_status_description: errorMsg
                        });
                        totalFailed++;
                        continue;
                    }

                    adminAvailableBalanceUSD -= amountToPayout;

                    // Success — update referral track records to 'paid'
                    await ReferralTrackModel.updateMany(referralTrackIds, 
                        {
                            reward_status: ReferralTrackModel.statuses.PAID,
                            payout_status: PayoutsModel.PayoutStatuses.PAID,
                            payout_status_description: ''
                        }
                    );

                    // Create a payout entry in payouts collection
                    await PayoutsModel.createOne({
                        user_id: referrerId,
                        referral_track_ids: referralTrackIds,
                        amount: amountToPayout,
                        currency: 'USD',
                        status: PayoutsModel.PayoutStatuses.PAID,
                        processed_at: new Date(),
                        transaction_reference: payoutResult?.transfer?.id || ''
                    });

                    // Update the referrer's balance in the users collection
                    await UserModel.updateOne(
                        { _id: referrerId },
                        {
                            $inc: {
                                paid_referrer_amount: amountToPayout,
                            }
                        }
                    );

                    // Send email to the referrer about the payout
                    if (referralForPayoutObj?.referrer?.referrer_email) {
                        try {
                            const currentYear = new Date().getFullYear();
                            const userEmailHtml = await referralPayoutUserNotificationTemplate(referrerName, amountToPayout, currentYear);
                            const userSubject = 'Referral Payout Successful — Funds Transferred';
                            nodemailer.sendMail(referralForPayoutObj.referrer.referrer_email, userSubject, userEmailHtml);
                            console.log(`[Cron] User notification email sent to ${referralForPayoutObj.referrer.referrer_email}`);
                        } catch (error) {
                            console.error(`[Cron] Failed to send user notification email to ${referralForPayoutObj.referrer.referrer_email}:`, error.message);
                        }
                    }

                    totalTransferred++;
                    console.log(`[Cron] Stripe transfer SUCCESS: $${amountToPayout} → ${referrerName} (${referralTrackIds.length} records)`);

                } 
                catch (errMsg) {
                    // Per-user error — log and continue to next referrer
                    console.error(`[Cron] Stripe transfer error for ${referrerName}:`, errMsg.message);

                    // Mark records as failed so they aren't retried immediately
                    try {
                        await ReferralTrackModel.updateMany(
                            { _id: { $in: referralTrackIds } },
                            { $set: { payout_status: 'failed' } }
                        );
                    } catch (updateErr) {
                        console.error(`[Cron] Failed to update payout_status for ${referrerName}:`, updateErr.message);
                    }
                    totalFailed++;
                }
            }

            console.log(`[Cron] Stripe transfer complete — transferred: ${totalTransferred}, skipped: ${totalSkipped}, failed: ${totalFailed}`);

        } catch (err) {
            console.error('[Cron] Referral payout Stripe transfer error:', err.stack);
        }
    });

}

module.exports = { startCronJob };