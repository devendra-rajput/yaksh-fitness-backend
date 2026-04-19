const mongoose = require("mongoose");
const moment = require('moment-timezone')

/** Custom Require **/
const UserTokens = require('./user_tokens.schema');
const UsersModel = require('../users/users.model');
const dataHelpers = require("../../../helpers/v1/data.helpers");

const TOKEN_CONFIG = {
    workout: { activity: "workout", limit: 1, value: 20 },
    food_scan: { activity: "food_scan", limit: 4, value: 10 },
    voice_log: { activity: "voice_log", limit: 4, value: 10 },
    body_scan: { activity: "body_scan", limit: 1, value: 5 },
    daily_macros: { activity: "daily_macros", limit: 1, value: 10 }
};

class UserTokensModel {

    constructor() {
        this.tokensConfig = TOKEN_CONFIG;
    }

    getWeeklyTokensCount = async (userId, timezone = 'UTC') => {
        try {
            const { startOfWeek, endOfWeek } = await dataHelpers.getStartDateTimes(timezone);
            const weeklyTokensResult = await UserTokens.aggregate([
                {
                    $match: {
                        user_id: new mongoose.Types.ObjectId(userId),
                        activity_date: {
                            $gte: startOfWeek,
                            $lte: endOfWeek
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: "$total_daily_tokens"
                        }
                    }
                }
            ]);
            return weeklyTokensResult.length > 0 ? weeklyTokensResult[0].total : 0;
        } catch (error) {
            console.log("Error UserTokensModel@getWeeklyTokensCount: ", error);
            return 0;
        }
    }

    addActivityTokens = async (userId, timezone, activityType) => {
        console.log('UserTokensModel@addActivityTokens');

        const activityConfig = this.tokensConfig[activityType];
        if (!activityConfig)
            return { success: false, message: "Invalid activity" };

        // Normalize date to User's local start-of-day in UTC
        const { startOfDay } = await dataHelpers.getStartDateTimes(timezone);
        const countPath = `activities.${activityType}.count`;
        const tokensPath = `activities.${activityType}.tokens`;

        /**
         * LOGIC: 
         * 1. Try to update only if the count is < activityConfig.limit.
         * 2. If no document matches (either count is already >= 2 OR doc doesn't exist),
         * we handle the "upsert" vs "limit reached" logic.
         */
        const userTokenObj = await UserTokens.findOneAndUpdate(
            {
                user_id: userId,
                activity_date: startOfDay,
                [countPath]: { $lt: activityConfig.limit } // Only update if tokens haven't been capped
            },
            {
                $setOnInsert: { user_id: userId, activity_date: startOfDay },
                $inc: {
                    total_daily_tokens: activityConfig.value,
                    [countPath]: 1,
                    [tokensPath]: activityConfig.value
                }
            },
            {
                upsert: true, // Creates doc if it doesn't exist
                new: true,
                setDefaultsOnInsert: true
            }
        ).catch(err => {
            // Handle MongoDB E11000 duplicate key error if two requests hit at once
            if (err.code === 11000)
                return null;

            return false;
        });

        // 2. If the update happened, sync the global user totals
        if (userTokenObj) {
            // Update tokens count in user profile
            await UsersModel.updateOne(
                { _id: userId },
                {
                    $inc: {
                        total_activity_tokens: activityConfig.value,
                        available_activity_tokens: activityConfig.value
                    }
                }
            );

            // Update 50 tokens this week milestone count
            const weeklyTokensCount = await this.getWeeklyTokensCount(userId, timezone);
            console.log(weeklyTokensCount, '========weeklyTokensCount');
            if (weeklyTokensCount >= 50) {
                // Don't try to include this at the top of the file
                const UserStreakModel = require('../user_streaks/user_streaks.model');
                await UserStreakModel.trackTokenMilestones(userId, timezone);
            }

            return { success: true, data: userTokenObj };
        }

        return { success: false, message: "Daily limit reached for this activity" };
    };

    getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
        console.log('UserTokensModel@getOneByColumnNameAndValue');

        try {

            const { activity_date } = filterObj;

            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            if (activity_date) {
                dbQuery.activity_date = activity_date;
            }

            let result = await UserTokens.findOne(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error UserTokensModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }


    getAll = async (filterObj = {}) => {
        console.log('UserTokensModel@getAll');

        try {
            let results;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if (filterObj?.user_id) {
                dbQuery = {
                    ...dbQuery,
                    user_id: new mongoose.Types.ObjectId(filterObj.user_id)
                }
            }

            let userTokens = await UserTokens.aggregate([
                { $match: dbQuery }
            ])
                .sort({ title: 1 });

            if (!userTokens) {
                results = [];
            }
            else {
                results = userTokens;
            }

            return results;

        } catch (error) {
            console.log("Error UserTokensModel@getAll: ", error);
            return [];
        }
    }


    getLeaderboardUsers = async (timezone = 'UTC') => {
        console.log('UserTokensModel@getLeaderboardUsers');

        try {
            const now = moment().tz(timezone);
            const startDate = process.env.STREAK_MILESTONE_TEST_MODE === "true" 
                                ? now.clone().subtract(14, 'minutes').startOf('minute').toDate()
                                : now.clone().subtract(7, 'days').startOf('day').toDate();
            const endDate = process.env.STREAK_MILESTONE_TEST_MODE === "true" 
                                ? now.clone().endOf('minute').toDate()
                                : now.clone().endOf('day').toDate();

            const userTokens = await UserTokens.aggregate([
                {
                    $match: {
                        activity_date: {
                            $gte: startDate,
                            $lte: endDate,
                        },
                    },
                },
                {
                    $group: {
                        _id: "$user_id",
                        totalTokens: { $sum: "$total_daily_tokens" },
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "userProfile",
                    },
                },
                {
                    $unwind: "$userProfile",
                },
                {
                    $sort: { totalTokens: -1 },
                },
                {
                    $project: {
                        _id: 0,
                        userId: "$_id",
                        first_name: "$userProfile.user_info.first_name",
                        last_name: "$userProfile.user_info.last_name",
                        profile_picture: "$userProfile.profile_picture",
                        tokensEarned: "$totalTokens",
                    },
                },
            ]);

            return userTokens;

        } catch (error) {
            console.log("Error UserTokensModel@getLeaderboardUsers: ", error);
            return [];
        }
    };

}

module.exports = new UserTokensModel;
