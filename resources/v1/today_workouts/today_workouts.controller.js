const moment = require('moment-timezone')
const mongoose = require("mongoose");

/** Custom Require **/
const response = require('../../../helpers/v1/response.helpers');
const TodayWorkoutModel = require('./today_workouts.model');
const UserStreakModel = require('../user_streaks/user_streaks.model');
const UserWorkoutModel = require('../user_workouts/user_workouts.model');
const UserTokenModel = require('../user_tokens/user_tokens.model');

class TodayWorkoutController {

    getTodayWorkouts = async (req, res) => {
        console.log('TodayWorkoutController@getTodayWorkouts');

        const user = req.user;

        let filterObj = {
            exclude_completed: true
        }

        //Check if user has any excluded exercise id and if exists, then remove the exercise from the response
        const excludedExercisesForUser = req.user.excluded_exercises
        if (excludedExercisesForUser?.length) {
            filterObj = {
                ...filterObj,
                excluded_exercises: excludedExercisesForUser
            }
        }

        /** Retrieve the today workouts of the loggedin user */
        const userTodayWorkoutObj = await TodayWorkoutModel.getOneByColumnNameAndValue('user_id', user._id, filterObj);

        // let workouts = userTodayWorkoutObj ?? {};
        // if(userTodayWorkoutObj?.workouts && userTodayWorkoutObj.expires_at > moment().toDate()){
        //     workouts = userTodayWorkoutObj.workouts;
        // }

        return response.success("success.todayWorkoutsData", res, userTodayWorkoutObj ?? {});
    }

    createWorkoutSets = async (req, res) => {
        console.log('TodayWorkoutController@createWorkoutSets');

        const { exercise_id, set_and_reps } = req.body;
        const user = req.user;

        /** Retrieve the today workouts of the loggedin user */
        const userTodayWorkoutObj = await TodayWorkoutModel.getOneByColumnNameAndValue('user_id', user._id);
        if (!userTodayWorkoutObj?.workouts?.length) {
            return response.badRequest("error.exercisesNotFound", res, false);
        }

        const workouts = userTodayWorkoutObj.workouts;
        const selectedWorkout = workouts.find(item => item._id == exercise_id);
        if (!selectedWorkout) {
            return response.badRequest("error.invalidExerciseId", res, false);
        }

        const updatedWorkouts = workouts.map(item =>
            item._id == exercise_id
                ? { ...item, set_and_reps: set_and_reps }
                : item
        );

        const hasUpdated = await TodayWorkoutModel.updateOne(userTodayWorkoutObj._id, { workouts: updatedWorkouts });
        if (!hasUpdated) {
            return response.exception("error.serverError", res, false);
        }

        return response.success("success.workoutUpdated", res, true);
    }

    addExercise = async (req, res) => {
        console.log('TodayWorkoutController@addExercise');

        const { exercises } = req.body;
        const user = req.user;

        /** Retrieve the today workouts of the loggedin user */
        const userTodayWorkoutObj = await TodayWorkoutModel.getOneByColumnNameAndValue('user_id', user._id);
        // if(!userTodayWorkoutObj?.workouts?.instances?.length){
        //     return response.badRequest("error.exercisesNotFound", res, false);
        // }

        let workoutList = userTodayWorkoutObj?.workouts?.length ? userTodayWorkoutObj.workouts : [];

        workoutList = [...exercises, ...workoutList];

        const uniqueWorkouts = [
            ...new Map(
                workoutList.map(w => [
                    String(w._id), // key only
                    {
                        ...w,
                        _id: mongoose.Types.ObjectId.isValid(w._id)
                            ? new mongoose.Types.ObjectId(w._id)
                            : w._id
                    }
                ])
            ).values()
        ];

        let hasUpdated = true;
        if (userTodayWorkoutObj?._id) {
            hasUpdated = await TodayWorkoutModel.updateOne(userTodayWorkoutObj._id, { workouts: uniqueWorkouts });
        }
        else {
            let todayWorkoutData = {
                user_id: user._id,
                expires_at: moment().endOf('day').toDate(),
                workouts: uniqueWorkouts,
                is_setting_updated: false
            }
            hasUpdated = await TodayWorkoutModel.createOne(todayWorkoutData)
        }

        if (!hasUpdated) {
            return response.exception("error.serverError", res, false);
        }

        return response.success("success.workoutUpdated", res, true);
    }

    replaceExercise = async (req, res) => {
        console.log('TodayWorkoutController@replaceExercise');

        const { exercise_id, replace_with } = req.body;
        const user = req.user;

        /** Retrieve the today workouts of the loggedin user */
        const userTodayWorkoutObj = await TodayWorkoutModel.getOneByColumnNameAndValue('user_id', user._id);
        if (!userTodayWorkoutObj?.workouts?.length) {
            return response.badRequest("error.exercisesNotFound", res, false);
        }

        let workouts = userTodayWorkoutObj.workouts;
        const workoutIndexToReplace = workouts.findIndex(item => item._id == exercise_id);
        if (workoutIndexToReplace < 0) {
            return response.badRequest("error.invalidExerciseId", res, false);
        }

        workouts[workoutIndexToReplace] = replace_with;

        const uniqueWorkouts = [
            ...new Map(
                workouts.map(w => [
                    String(w._id), // key only
                    {
                        ...w,
                        _id: mongoose.Types.ObjectId.isValid(w._id)
                            ? new mongoose.Types.ObjectId(w._id)
                            : w._id
                    }
                ])
            ).values()
        ];

        let hasUpdated = await TodayWorkoutModel.updateOne(userTodayWorkoutObj._id, { workouts: uniqueWorkouts });
        if (!hasUpdated) {
            return response.exception("error.serverError", res, false);
        }

        return response.success("success.workoutUpdated", res, true);
    }

    completeTodayWorkout = async (req, res) => {
        console.log('TodayWorkoutController@completeTodayWorkout');

        try {
            const userId = req.user._id;
            const timezone = req.timezone;

            const updatedWorkout = await TodayWorkoutModel.completeTodayWorkout(userId);
            if (!updatedWorkout) {
                return response.exception("error.serverError", res, false);
            }

            await UserWorkoutModel.createOrUpdateTodayWorkout(
                {
                    userId: userId,
                    workouts: updatedWorkout.workouts
                },
                timezone
            );

            // Update User Streak and Milestones
            await UserStreakModel.updateStreakCount(userId, timezone)
            await UserStreakModel.trackWorkoutMilestones(userId, timezone)

            await UserTokenModel.addActivityTokens(userId, timezone, 'workout');

            return response.success("success.workoutUpdated", res, true);
        } catch (error) {
            console.log(error, "=====error");
            return response.exception("error.serverError", res, false);
        }
    }

}

module.exports = new TodayWorkoutController;
