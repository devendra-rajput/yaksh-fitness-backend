/** Custom Require **/
const dataHelper = require('../../../helpers/v1/data.helpers');
const response = require('../../../helpers/v1/response.helpers');
const ReferralTrackModel = require('./referral_tracks.model');
const UserModel = require('../users/users.model')
const StripeService = require('../../../services/stripe')

class ReferralTrackController {

    getAllWithPagination = async (req, res) => {
        console.log('ReferralTrackController@getAllWithPagination');

        /** Extract the page and limt from query param */
        const user = req.user;
        const { status } = req.query;
        const { page, limit } = await dataHelper.getPageAndLimit(req.query);

        const filterObj = {
            status: status,
            user_id: user._id,
            request_from_user: true
        }

        const result = await ReferralTrackModel.getAllWithPagination(page, limit, filterObj);
        if (!result?.data?.length) {
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.referralsData", res, result);

    }

    getAllWithPaginationForAdmin = async (req, res) => {
        console.log('ReferralTrackController@getAllWithPaginationForAdmin');

        /** Extract the page and limt from query param */
        const { status, referrer_id } = req.query;
        const { page, limit } = await dataHelper.getPageAndLimit(req.query);

        const filterObj = {
            status: status,
            referrer_id: referrer_id
        }

        const result = await ReferralTrackModel.getAllWithPagination(page, limit, filterObj);
        if (!result?.data?.length) {
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.referralsData", res, result);

    }

    initiateReferralPayout = async (req, res) => {
        console.log('ReferralTrackController@initiateReferralPayout');

        try {
            const { referred_by, referral_track_ids } = req.body;
            const referrerId = req.referrerId;
            let isPayoutEnable = false;

            const referrerDetails = await UserModel.getOneByColumnNameAndValue('_id', referrerId);
            const referrerStripeAccountId = referrerDetails?.stripe_account_id;
            if(referrerStripeAccountId){
                const stripeAccountStatus = await StripeService.getAccountStatus(referrerStripeAccountId);
                if(stripeAccountStatus?.transfer_status){
                    isPayoutEnable = true;
                }
            }

            const filterObj = { referred_by, referral_track_ids };
            const referrals = await ReferralTrackModel.getReferralsForPayout(filterObj);

            return response.success("success.referralsData", res, {
                data: referrals,
                is_payout_enable: isPayoutEnable
            });
        } catch (error) {
            console.log("Error ReferralTrackController@initiateReferralPayout: ", error);
            const errorMessage = typeof error === "string" ? error : error.message;
            return response.exception(errorMessage, res, false);
        }
    }

    confirmReferralPayout = async (req, res) => {
        console.log('ReferralTrackController@confirmReferralPayout');

        try {
            const { referred_by, referral_track_ids } = req.body;
            const referrerId = req.referrerId;

            const referrerDetails = await UserModel.getOneByColumnNameAndValue('_id', referrerId);
            const referrerStripeAccountId = referrerDetails?.stripe_account_id;
            if(!referrerStripeAccountId) {
                return response.badRequest("error.stripeAccountNotConnected", res, false)
            }

            const stripeAccountStatus = await StripeService.getAccountStatus(referrerStripeAccountId);
            if(!stripeAccountStatus?.transfer_status){
                return response.badRequest("error.stripeAccountNotConnected", res, false)
            }

            // Fetch referrals for payout
            const filterObj = { referred_by, referral_track_ids };
            const referrals = await ReferralTrackModel.getReferralsForPayout(filterObj);
            
            if (!referrals?.length) {
                return response.badRequest("error.noRecordsFound", res, false);
            }

            const amountToPayout = referrals[0].totalAmount;
            const { success, transfer, error} = await StripeService.createPayout(amountToPayout, referrerStripeAccountId);
            if(!success){
                return response.badRequest(error ?? "error.payoutFailed", res, false);
            }

            // Need to update referral track payout details

            // const payoutId = transfer?.id;
            // const payoutStatus = transfer?.status;
            // const payoutAmount = transfer?.amount;
            // const payoutCurrency = transfer?.currency;
            // const payoutDestination = transfer?.destination;

            // const updateObj = {
            //     payout_id: payoutId,
            //     payout_status: payoutStatus,
            //     payout_amount: payoutAmount,
            //     payout_currency: payoutCurrency,
            //     payout_destination: payoutDestination
            // }

            // const result = await ReferralTrackModel.updateManyByColumnNameAndValue("referral_track_ids", referral_track_ids, updateObj);

            // Need to insert data in payouts table

            return response.success("success.payoutSucceded", res, transfer);

        } catch (error) {
            console.log("Error ReferralTrackController@confirmReferralPayout: ", error);
            const errorMessage = typeof error === "string" ? error : error.message;
            return response.exception(errorMessage, res, false);
        }
    }
}

module.exports = new ReferralTrackController;
