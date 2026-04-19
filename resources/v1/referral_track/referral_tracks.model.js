const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

/** Custom Require **/
const dataHelper = require('../../../helpers/v1/data.helpers');
const ReferralTrack = require('./referral_track.schema');

const PENDING = 'pending';
const ELIGIBLE = 'eligible';
const PAID = 'paid';
const CANCELLED = 'cancelled';
const statuses = Object.freeze({ PENDING, ELIGIBLE, PAID, CANCELLED });

const REFERRAL = 'referral';
const REFERRER = 'referrer';
const rewardTypes = Object.freeze({ REFERRAL, REFERRER });

const REFERRAL_RANKS = Object.freeze([
    {
        key: "BRONZE",
        title: "Bronze Referrer",
        min_referrals: 0,
        max_referrals: 4
    },
    {
        key: "SILVER",
        title: "Silver Achiever",
        min_referrals: 5,
        max_referrals: 14
    },
    {
        key: "GOLD",
        title: "Gold Champ",
        min_referrals: 15,
        max_referrals: 49
    },
    {
        key: "LEGEND",
        title: "Master Legend",
        min_referrals: 50,
        max_referrals: Infinity
    }
]);

class ReferralTrackModel {

    constructor() {
        this.statuses = statuses;
        this.rewardTypes = rewardTypes;
        this.ranks = REFERRAL_RANKS;
    }

    createOne = async (data) => {
        console.log('ReferralTrackModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            let referralTrackObj = await ReferralTrack.create(data);
            if (!referralTrackObj) {
                return false;
            }

            return referralTrackObj;

        } catch (error) {
            console.log("Error ReferralTrackModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
        console.log('ReferralTrackModel@getOneByColumnNameAndValue');

        try {
            const { reward_type, reward_status } = filterObj;

            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            if(reward_type){
                dbQuery.reward_type = reward_type;
            }

            if(reward_status){
                dbQuery.reward_status = reward_status;
            }

            let result = await ReferralTrack.findOne(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error ReferralTrackModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('ReferralTrackModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let referralTrackObj = await ReferralTrack.findByIdAndUpdate(id, data, { new: true })
            if (!referralTrackObj) {
                return false;
            }

            return referralTrackObj;

        } catch (error) {
            console.log("Error ReferralTrackModel@updateOne: ", error);
            return false;
        }
    }

    updateMany = async (ids, data) => {
        console.log('ReferralTrackModel@updateMany');

        try {
            if (!ids || !data) {
                throw new Error('filterQuery and data are required');
            }

            // console.log('ids: ', ids);
            let result = await ReferralTrack.updateMany(
                { _id: { $in: ids } },
                { $set: data }
            );
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error ReferralTrackModel@updateMany: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("ReferralTrackModel@deleteOne");

        try {
            let result = await ReferralTrack.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error ReferralTrackModel@deleteOne: ", error);
            return false;
        }
    }

    getAll = async (filterObj = {}) => {
        console.log('ReferralTrackModel@getAll');

        try {

            let { referred_by, ids } = filterObj;

            let results;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if (referred_by) {
                dbQuery.referrer_id = referred_by;
            }

            if (ids?.length > 0) {
                const idsArray = await ids.map((id) => {
                    return new ObjectId(id);
                })

                dbQuery._id = { $in: idsArray };
            }

            let referralTracks = await ReferralTrack.aggregate([
                { $match: dbQuery }
            ])
                .sort({ title: 1 });

            if (!referralTracks) {
                results = [];
            }
            else {
                results = referralTracks;
            }

            return results;

        } catch (error) {
            console.log("Error ReferralTrackModel@getAll: ", error);
            return [];
        }

    }

    // getAllWithPagination = async (page, limit, filterObj = {}) => {
    //     console.log('ReferralTrackModel@getAllWithPagination');

    //     try {
    //         const { referrer_id, user_id, request_from_user, status } = filterObj;
    //         let resObj;
    //         let dbQuery = {
    //             deleted_at: {
    //                 $in: [null, '', ' ']
    //             },  // Check for null, empty string, or space
    //         };

    //         if (referrer_id) {
    //             dbQuery.referrer_id = referrer_id;
    //         }

    //         if (status) {
    //             dbQuery.reward_status = status;
    //         }

    //         if(request_from_user){
    //             // Write or condition here
    //             dbQuery.$and =  [{ 
    //                 $or: [
    //                     { user_id: user_id }, 
    //                     { referrer_id: user_id }
    //                 ] 
    //             }]
    //         }

    //         let totalRecords = await ReferralTrack.countDocuments(dbQuery);

    //         let pagination = await dataHelper.calculatePagination(totalRecords, page, limit);

    //         let referralTracks = await ReferralTrack.aggregate([
    //             { $match: dbQuery },

    //             { $sort: { created_at: -1 } },
    //             { $skip: pagination.offset },
    //             { $limit: pagination.limit },

    //             // group by referrer_id
    //             {
    //                 $group: {
    //                     _id: "$referrer_id",
    //                     referrals: { $push: "$$ROOT" }
    //                 }
    //             },

    //             // get referrer user details
    //             {
    //                 $lookup: {
    //                     from: "users",
    //                     localField: "_id",
    //                     foreignField: "_id",
    //                     as: "referrer"
    //                 }
    //             },
    //             { $unwind: "$referrer" },

    //             // final shape
    //             {
    //                 $project: {
    //                     _id: 0,
    //                     reffer_by: "$referrer.user_info", // change field name if needed
    //                     referrals: 1
    //                 }
    //             }
    //         ])

    //         if (!referralTracks) {
    //             resObj = {
    //                 data: []
    //             };
    //         }
    //         else {
    //             resObj = {
    //                 data: referralTracks,
    //                 pagination: {
    //                     total: totalRecords,
    //                     current_page: pagination.currentPage,
    //                     total_pages: pagination.totalPages,
    //                     per_page: pagination.limit
    //                 }
    //             };
    //         }

    //         return resObj;

    //     } catch (error) {
    //         console.log("Error ReferralTrackModel@getAllWithPagination: ", error);
    //         return false;
    //     }
    // }

    getAllWithPagination = async (page, limit, filterObj = {}) => {
        console.log('ReferralTrackModel@getAllWithPagination');

        try {
            const { referrer_id, user_id, request_from_user, status } = filterObj;
            let resObj;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if (referrer_id) {
                dbQuery.referrer_id = referrer_id;
            }

            if (status) {
                dbQuery.reward_status = status;
            }

            if(request_from_user && user_id){
                // Write or condition here
                dbQuery.$and =  [{ 
                    $or: [
                        { user_id: user_id }, 
                        { referrer_id: user_id }
                    ] 
                }]
            }

            let totalRecords = await ReferralTrack.countDocuments(dbQuery);

            let pagination = await dataHelper.calculatePagination(totalRecords, page, limit);

            let referralTracks = await ReferralTrack.aggregate([
                { $match: dbQuery },

                { $sort: { created_at: -1 } },
                { $skip: pagination.offset },
                { $limit: pagination.limit },
            ])

            if (!referralTracks) {
                resObj = {
                    data: []
                };
            }
            else {
                resObj = {
                    data: referralTracks,
                    pagination: {
                        total: totalRecords,
                        current_page: pagination.currentPage,
                        total_pages: pagination.totalPages,
                        per_page: pagination.limit
                    }
                };
            }

            return resObj;

        } catch (error) {
            console.log("Error ReferralTrackModel@getAllWithPagination: ", error);
            return false;
        }
    }

    getReferralsForPayout = async (filterObj = {}) => {
        console.log('ReferralTrackModel@getReferralsForPayout');

        try {
            const { referred_by, referral_track_ids, payout_email_sent_at, reward_type } = filterObj;

            let dbQuery = {
                deleted_at: { $in: [null, '', ' '] },
                reward_status: statuses.ELIGIBLE
            };

            if (referred_by) {
                dbQuery.referrer_id = new ObjectId(referred_by);
            }

            if (payout_email_sent_at !== undefined) {
                dbQuery.payout_email_sent_at = payout_email_sent_at;
            }

            if (reward_type) {
                dbQuery.reward_type = reward_type;
            }

            if (!referred_by && Array.isArray(referral_track_ids)) {
                const idsArray = await referral_track_ids.map((id) => {
                    return new ObjectId(id);
                })
                dbQuery._id = {
                    $in: idsArray
                };
            }

            const pipeline = [
                { $match: dbQuery },
                { $sort: { created_at: -1 } },

                {
                    $lookup: {
                        from: "users",
                        localField: "user_id",
                        foreignField: "_id",
                        as: "user_details"
                    }
                },
                {
                    $unwind: {
                        path: "$user_details",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $project: {
                        referrer_id: 1,
                        reward_amount: 1,
                        created_at: 1,
                        user_details: "$user_details.user_info"
                    }
                },

                {
                    $group: {
                        _id: "$referrer_id",
                        referrals: { $push: "$$ROOT" },
                        totalAmount: { $sum: "$reward_amount" }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "referrer"
                    }
                },
                { $unwind: "$referrer" },
                {
                    $project: {
                        _id: 0,
                        referrer_id: "$_id",
                        referrer_email: "$referrer.email",
                        referred_by: "$referrer.user_info",
                        stripe_account_id: "$referrer.stripe_account_id",
                        stripe_onboarding_status: "$referrer.stripe_onboarding_status",
                        referrals: 1,
                        totalAmount: 1
                    }
                }
            ];

            const referrals = await ReferralTrack.aggregate(pipeline);

            return referrals ?? [];

        } catch (error) {
            console.log("Error ReferralTrackModel@getReferralsForPayout:", error);
            return [];
        }
    };

    getPendingReferralsToMarkAsEligible = async () => {
        console.log('ReferralTrackModel@getPendingReferralsToMarkAsEligible');

        try {

            let dbQuery = {
                reward_status: statuses.PENDING,
                eligible_to_payout_at: { $lt: new Date() },
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };


            let referralTracks = await ReferralTrack.aggregate([
                { $match: dbQuery }
            ])
                .sort({ _id: 1 });

            return referralTracks?.length ? referralTracks : [];

        } catch (error) {
            console.log("Error ReferralTrackModel@getPendingReferralsToMarkAsEligible: ", error);
            return [];
        }

    }

    // getWeeklyEarnedTokens = async (userId, timezone = 'UTC') => {
    //     console.log('ReferralTrackModel@getWeeklyEarnedTokens');
    //     try {
    //         const moment = require('moment-timezone');
    //         const startOfWeek = moment().tz(timezone).startOf('isoWeek').toDate();
    //         const endOfWeek = moment().tz(timezone).endOf('isoWeek').toDate();

    //         const result = await ReferralTrack.aggregate([
    //             {
    //                 $match: {
    //                     referrer_id: new mongoose.Types.ObjectId(userId),
    //                     created_at: { $gte: startOfWeek, $lte: endOfWeek },
    //                     deleted_at: { $in: [null, '', ' '] }
    //                 }
    //             },
    //             {
    //                 $group: {
    //                     _id: null,
    //                     total: { $sum: "$reward_amount" }
    //                 }
    //             }
    //         ]);

    //         return result?.length > 0 ? result[0].total : 0;

    //     } catch (error) {
    //         console.log("Error ReferralTrackModel@getWeeklyEarnedTokens: ", error);
    //         return 0;
    //     }
    // }

}

module.exports = new ReferralTrackModel;
