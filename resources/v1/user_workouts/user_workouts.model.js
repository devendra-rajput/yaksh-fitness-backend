const mongoose = require("mongoose");
const moment = require('moment-timezone')

/** Custom Require **/
const UserWorkout = require('./user_workout.schema');
const dataHelper = require('../../../helpers/v1/data.helpers');

class UserWorkoutModel {

    constructor() {
        // 
    }

    createOne = async (data) => {
        console.log('UserWorkoutModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            let userWorkout = await UserWorkout.create(data);
            if (!userWorkout) {
                return false;
            }

            return userWorkout;

        } catch (error) {
            console.log("Error UserWorkoutModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('UserWorkoutModel@getOneByColumnNameAndValue');

        try {
            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await UserWorkout.findOne(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error UserWorkoutModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('UserWorkoutModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let userWorkout = await UserWorkout.findByIdAndUpdate(id, data, { new: true })
            if (!userWorkout) {
                return false;
            }

            return userWorkout;

        } catch (error) {
            console.log("Error UserWorkoutModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("UserWorkoutModel@deleteOne");

        try {
            let result = await UserWorkout.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error UserWorkoutModel@deleteOne: ", error);
            return false;
        }
    }

    getAll = async (filterObj = {}) => {
        console.log('UserWorkoutModel@getAll');

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
                dbQuery = {
                    ...dbQuery,
                    created_at: {
                        $gte: moment().startOf('day').toDate(),
                        $lte: moment().endOf('day').toDate()
                    }
                }
            }

            let userWorkouts = await UserWorkout.aggregate([
                { $match: dbQuery }
            ])
                .sort({ title: 1 });

            if (!userWorkouts) {
                results = [];
            }
            else {
                results = userWorkouts;
            }

            return results;

        } catch (error) {
            console.log("Error UserWorkoutModel@getAll: ", error);
            return [];
        }
    }

    // countWorkoutsThisWeek = async (userId, timezone = 'UTC') => {
    //     console.log('UserWorkoutModel@countWorkoutsThisWeek');

    //     try {

    //         const { startOfWeek, endOfWeek } = await dataHelper.getStartDateTimes(timezone);

    //         const count = await UserWorkout.countDocuments({
    //             user_id: new mongoose.Types.ObjectId(userId),
    //             created_at: { $gte: startOfWeek, $lte: endOfWeek },
    //             deleted_at: { $in: [null, '', ' '] }
    //         });

    //         console.log("countWorkoutsThisWeek count: ", count);

    //         return count;

    //     } catch (error) {
    //         console.log("Error UserWorkoutModel@countWorkoutsThisWeek: ", error);
    //         return 0;
    //     }
    // }

    countWorkoutsThisWeek = async (userId, timezone = 'UTC') => {
        console.log('UserWorkoutModel@countWorkoutsThisWeek');
        try {
            const { startOfWeek, endOfWeek } = await dataHelper.getStartDateTimes(timezone);
            
            const result = await UserWorkout.aggregate([
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

            console.log("countWorkoutsThisWeek (unique days): ", count);
            return count;

        } catch (error) {
            console.log("Error UserWorkoutModel@countWorkoutsThisWeek: ", error);
            return 0;
        }
    }

    createOrUpdateTodayWorkout = async (data = {}, timezone = 'UTC') => {
        console.log('UserWorkoutModel@createOrUpdateTodayWorkout');

        const { startOfDay, endOfDay } = await dataHelper.getStartDateTimes(timezone);

        const userWorkoutObj = await UserWorkout.findOne({
            user_id: data.userId,
            created_at: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        })
            .collation({ locale: 'en', strength: 2 });

        /** If user today workout data does not exist then create new one otherwise update the expiry of existed data */
        if (!userWorkoutObj?._id) {
            await UserWorkout.create({
                workouts: data.workouts,
                user_id: data.userId
            })
        }
        else {
            await UserWorkout.findByIdAndUpdate(userWorkoutObj._id, { workouts: data.workouts })
        }
    }
}

module.exports = new UserWorkoutModel;
