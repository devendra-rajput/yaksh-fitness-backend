const mongoose = require("mongoose");
const moment = require('moment-timezone')

/** Custom Require **/ 
const TodayWorkout = require('./today_workout.schema');

class TodayWorkoutModel {

    constructor() {
        // 
    }

    createOne = async (data) => {
        console.log('TodayWorkoutModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            let todayWorkout = await TodayWorkout.create(data);
            if (!todayWorkout) {
                return false;
            }

            return todayWorkout;

        } catch (error) {
            console.log("Error TodayWorkoutModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
        console.log('TodayWorkoutModel@getOneByColumnNameAndValue');

        try {

            const { excluded_exercises = [], exclude_completed } = filterObj;

            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await TodayWorkout.findOne(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            result.workouts = result.workouts.filter((w) => {
                    let isValidRecord = true;

                    if(exclude_completed){
                        isValidRecord = isValidRecord && (w.is_completed === undefined || w.is_completed === false);
                    }

                    if(excluded_exercises?.length){
                        isValidRecord = isValidRecord && !excluded_exercises.some(id => id.equals(w._id));
                    }

                    return isValidRecord;
                }
            );

            return result;

        } catch (error) {
            console.log("Error TodayWorkoutModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('TodayWorkoutModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let todayWorkout = await TodayWorkout.findByIdAndUpdate(id, data, { new: true })
            if (!todayWorkout) {
                return false;
            }

            return todayWorkout;

        } catch (error) {
            console.log("Error TodayWorkoutModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("TodayWorkoutModel@deleteOne");

        try {
            let result = await TodayWorkout.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error TodayWorkoutModel@deleteOne: ", error);
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

            if(filterObj?.user_id){
                dbQuery = {
                    ...dbQuery,
                    user_id: new mongoose.Types.ObjectId(filterObj.user_id)
                }
            }

            if(filterObj?.need_today){
                dbQuery = {
                    ...dbQuery,
                    created_at: {
                        $gte: moment().startOf('day').toDate(),
                        $lte: moment().endOf('day').toDate()
                    }
                }
            }

            let todayWorkouts = await TodayWorkout.aggregate([
                                                { $match: dbQuery}
                                            ])
                                            .sort({ title: 1});
            
            if (!todayWorkouts) {
                results = [];
            }
            else {
                results = todayWorkouts;
            }

            return results;

        } catch (error) {
            console.log("Error TodayWorkoutModel@getAll: ", error);
            return [];
        }
    }


    completeTodayWorkout = async (userId) => {
        console.log('TodayWorkoutModel@completeTodayWorkout');

        try {
            // 1. First, attempt to update the existing record
            let updatedWorkout = await TodayWorkout.findOneAndUpdate(
                { user_id: userId, deleted_at: '' },
                { 
                    $set: { 
                        "workouts.$[].is_completed": true,
                        filter: {} 
                    } 
                },
                { new: true }
            );

            // 2. If no record was found, create a new one (The "Upsert" manual fallback)
            if (!updatedWorkout) {
                updatedWorkout = await TodayWorkout.create({
                    user_id: userId,
                    workouts: [], // Starts empty, so nothing to mark "complete"
                    filter: {},
                    is_setting_updated: false,
                    deleted_at: ''
                });
            }
            
            console.log("updatedWorkout: ", updatedWorkout);
            if (!updatedWorkout) {
                return false;
            }
            return updatedWorkout;
        } catch (error) {
            console.log("Error TodayWorkoutModel@completeTodayWorkout: ", error);
            return false;
        }
    };

}

module.exports = new TodayWorkoutModel;
