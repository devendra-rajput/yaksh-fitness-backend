const mongoose = require("mongoose");
const moment = require('moment-timezone')

/** Custom Require **/
const UserMeal = require('./user_meal.schema');
const dataHelper = require('../../../helpers/v1/data.helpers');

class UserMealModel {

    constructor() {
        // 
    }

    createOne = async (data) => {
        console.log('UserMealModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            let userMeal = await UserMeal.create(data);
            if (!userMeal) {
                return false;
            }

            return userMeal;

        } catch (error) {
            console.log("Error UserMealModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('UserMealModel@getOneByColumnNameAndValue');

        try {
            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await UserMeal.findOne(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error UserMealModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('UserMealModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let userMeal = await UserMeal.findByIdAndUpdate(id, data, { new: true })
            if (!userMeal) {
                return false;
            }

            return userMeal;

        } catch (error) {
            console.log("Error UserMealModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("UserMealModel@deleteOne");

        try {
            let result = await UserMeal.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error UserMealModel@deleteOne: ", error);
            return false;
        }
    }

    getAll = async (filterObj = {}) => {
        console.log('UsersResources@getAll');

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

            if (filterObj?.need_today) {
                const tz = filterObj.timezone ?? "UTC";

                const { startOfDay, endOfDay } = await dataHelper.getStartDateTimes(tz);

                // const start = moment.tz(tz).startOf('day').utc().toDate();
                // const end = moment.tz(tz).endOf('day').utc().toDate();
                dbQuery = {
                    ...dbQuery,
                    created_at: {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            }

            let userMeals = await UserMeal.aggregate([
                { $match: dbQuery }
            ])
                .sort({ title: 1 });

            if (!userMeals) {
                results = [];
            }
            else {
                results = userMeals;
            }

            return results;

        } catch (error) {
            console.log("Error UserMealModel@getAll: ", error);
            return [];
        }

    }

    deleteOneByScanFoodId = async (id) => {
        console.log("UserMealModel@deleteOneByScanFoodId");

        try {
            let result = await UserMeal.deleteOne({ scan_food_id: id });
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error UserMealModel@deleteOneByScanFoodId: ", error);
            return false;
        }
    }

    // countLoggedDaysThisWeek = async (userId, timezone = 'UTC') => {
    //     console.log('UserMealModel@countLoggedDaysThisWeek');
    //     try {
    //         const { startOfWeek, endOfWeek } = await dataHelper.getStartDateTimes(timezone);
            
    //         const count = await UserMeal.countDocuments({
    //             user_id: new mongoose.Types.ObjectId(userId),
    //             created_at: { $gte: startOfWeek, $lte: endOfWeek },
    //             deleted_at: { $in: [null, '', ' '] }
    //         });

    //         console.log("countLoggedDaysThisWeek count: ", count);

    //         return count;

    //     } catch (error) {
    //         console.log("Error UserMealModel@countLoggedDaysThisWeek: ", error);
    //         return 0;
    //     }
    // }

    countLoggedDaysThisWeek = async (userId, timezone = 'UTC') => {
        console.log('UserMealModel@countLoggedDaysThisWeek');
        try {
            const { startOfWeek, endOfWeek } = await dataHelper.getStartDateTimes(timezone);
            
            const result = await UserMeal.aggregate([
                {
                    // 1. Filter the documents (same logic as your countDocuments)
                    $match: {
                        user_id: new mongoose.Types.ObjectId(userId),
                        created_at: { $gte: startOfWeek, $lte: endOfWeek },
                        deleted_at: { $in: [null, '', ' '] }
                    }
                },
                {
                    // 2. Group by the date part of created_at
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: timezone }
                        }
                    }
                },
                {
                    // 3. Count the number of unique groups (days)
                    $count: "uniqueDaysCount"
                }
            ]);

            // If no records found, result will be an empty array
            const count = result.length > 0 ? result[0].uniqueDaysCount : 0;

            console.log("countLoggedDaysThisWeek (unique days): ", count);
            return count;

        } catch (error) {
            console.log("Error UserMealModel@countLoggedDaysThisWeek: ", error);
            return 0;
        }
    }

    countConsecutiveLoggedDays = async (userId, timezone = 'UTC', sinceDate = null) => {
        console.log('UserMealModel@countConsecutiveLoggedDays');
        try {
            let consecutiveCount = 0;
            const { isTestMode, dayUnit } = await dataHelper.getStartDateTimes(timezone);

            // This is our moving pointer
            let checkDate = moment().tz(timezone);
            const sinceMoment = sinceDate ? moment(sinceDate).tz(timezone) : null;

            while (true) {
                // If we've moved before the reset date, stop counting
                if (sinceMoment && checkDate.isSameOrBefore(sinceMoment, dayUnit)) break;

                let startOfWindow, endOfWindow;

                if (isTestMode) {
                    // In Test Mode, each "day" is a 1-minute slot
                    startOfWindow = checkDate.clone().startOf('minute').toDate();
                    endOfWindow = checkDate.clone().endOf('minute').toDate();
                } else {
                    // In Production, each "day" is a full calendar day
                    startOfWindow = checkDate.clone().startOf('day').toDate();
                    endOfWindow = checkDate.clone().endOf('day').toDate();
                }

                const logExists = await UserMeal.findOne({
                    user_id: new mongoose.Types.ObjectId(userId),
                    created_at: { $gte: startOfWindow, $lte: endOfWindow },
                    deleted_at: { $in: [null, '', ' '] }
                });

                if (logExists) {
                    consecutiveCount++;
                    checkDate.subtract(1, dayUnit);
                } else {
                    // No log found for this window? The streak is broken.
                    break;
                }

                if (consecutiveCount > 365) break;
            }

            return consecutiveCount;

        } catch (error) {
            console.log("Error UserMealModel@countConsecutiveLoggedDays: ", error);
            return 0;
        }
    }

    countConsecutiveMacrosFulfillDays = async (userId, goalsData = {}, timezone = 'UTC', sinceDate = null) => {
        console.log('UserMealModel@countConsecutiveMacrosFulfillDays');
        try {
            let consecutiveCount = 0;
            const { isTestMode, dayUnit } = await dataHelper.getStartDateTimes(timezone);
            const { calorieGoal, carbGoal, fatGoal, proteinGoal } = goalsData;

            // This is our moving pointer
            let checkDate = moment().tz(timezone);
            const sinceMoment = sinceDate ? moment(sinceDate).tz(timezone) : null;

            while (true) {
                // If we've moved before the reset date, stop counting
                if (sinceMoment && checkDate.isSameOrBefore(sinceMoment, dayUnit)) break;

                let startOfWindow, endOfWindow;

                if (isTestMode) {
                    // In Test Mode, each "day" is a 1-minute slot
                    startOfWindow = checkDate.clone().startOf('minute').toDate();
                    endOfWindow = checkDate.clone().endOf('minute').toDate();
                } else {
                    // In Production, each "day" is a full calendar day
                    startOfWindow = checkDate.clone().startOf('day').toDate();
                    endOfWindow = checkDate.clone().endOf('day').toDate();
                }

                const { calories, protein, carbs, fats } = await this.getDailyNutrition(userId, startOfWindow, endOfWindow);

                const isMacroFulfilled = calories >= calorieGoal && protein >= proteinGoal && carbs >= carbGoal && fats >= fatGoal;
                if (isMacroFulfilled) {
                    consecutiveCount++;
                    checkDate.subtract(1, dayUnit);
                } else {
                    // No log found for this window? The streak is broken.
                    break;
                }

                if (consecutiveCount > 365) break;
            }

            return consecutiveCount;

        } catch (error) {
            console.log("Error UserMealModel@countConsecutiveMacrosFulfillDays: ", error);
            return 0;
        }
    }

    getDailyNutrition = async (userId, startDate = new Date(), endDate = new Date()) => {
        console.log('UserMealModel@getDailyNutrition');
        try {

            const result = await UserMeal.aggregate([
                {
                    $match: {
                        user_id: new mongoose.Types.ObjectId(userId),
                        created_at: { $gte: startDate, $lte: endDate },
                        deleted_at: { $in: [null, '', ' '] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        calories: { $sum: { $toDouble: { $ifNull: ["$nutrition.calories", 0] } } },
                        protein: { $sum: { $toDouble: { $ifNull: ["$nutrition.protein", 0] } } },
                        carbs: { $sum: { $toDouble: { $ifNull: ["$nutrition.carbs", 0] } } },
                        fats: { $sum: { $toDouble: { $ifNull: ["$nutrition.fat", 0] } } }
                    }
                }
            ]);

            return result?.length > 0 ? result[0] : { calories: 0, protein: 0, carbs: 0, fats: 0 };

        } catch (error) {
            console.log("Error UserMealModel@getDailyNutrition: ", error);
            return { calories: 0, protein: 0, carbs: 0, fats: 0 };
        }
    }
}

module.exports = new UserMealModel;
