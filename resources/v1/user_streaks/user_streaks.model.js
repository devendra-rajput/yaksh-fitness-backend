const mongoose = require("mongoose");
const moment = require('moment-timezone');

/** Custom Require **/
const UserStreak = require('./user_streak.schema');
const UserTokens = require('../user_tokens/user_tokens.schema');
const GoalModel = require('../goals/goals.model');
const UserMealModel = require('../user_meals/user_meals.model');
const UserWorkoutModel = require('../user_workouts/user_workouts.model');
const UserModel = require('../users/users.model');
const dataHelpers = require("../../../helpers/v1/data.helpers");
const UserTokenModel = require('../user_tokens/user_tokens.model');
const UsersModel = require('../users/users.model');

class UserStreakModel {

    constructor() {
        // 
    }

    _addMilestoneTokens = async (userId, timezone, milestoneType) => {
        console.log('UserStreakModel@addMilestoneTokens');

        // Normalize date to User's local start-of-day in UTC
        const { startOfWeek, endOfWeek, startOfDay } = await dataHelpers.getStartDateTimes(timezone);
        const tokensPath = `milestones.${milestoneType}`;
        const tokensCountPerMilestone = 50;

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
            },
            {
                $setOnInsert: { user_id: userId, activity_date: startOfDay },
                $inc: {
                    total_daily_tokens: tokensCountPerMilestone,
                    [tokensPath]: tokensCountPerMilestone
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
                        total_activity_tokens: tokensCountPerMilestone,
                        available_activity_tokens: tokensCountPerMilestone
                    }
                }
            );

            // Update 50 tokens this week milestone count
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
            const weeklyTokensCount = weeklyTokensResult.length > 0 ? weeklyTokensResult[0].total : 0;
            console.log(weeklyTokensCount, '========weeklyTokensCount');

            if (weeklyTokensCount >= 50) {
                await this.trackTokenMilestones(userId, timezone);
            }

            return { success: true, data: userTokenObj };
        }

        return { success: false, message: "Daily limit reached for this activity" };
    };

    _checkAndResetWeeklyCounters = async (userStreak, timezone = 'UTC') => {

        const { startOfWeek } = await dataHelpers.getStartDateTimes(timezone);
        const lastReset = userStreak?.last_weekly_reset_date ? moment(userStreak.last_weekly_reset_date).tz(timezone) : null;

        if (!lastReset || lastReset.isBefore(startOfWeek)) {
            userStreak.app_open_count_this_week = 0;
            userStreak.workout_count_this_week = 0;
            userStreak.body_scan_count_this_week = 0;
            userStreak.menu_scan_count_this_week = 0;
            userStreak.food_scan_count_this_week = 0;
            userStreak.meal_log_count_this_week = 0;
            userStreak.tokens_earned_this_week = 0;
            userStreak.voice_log_count_this_week = 0;
            userStreak.protein_hit_count_this_week = 0;
            userStreak.macro_hit_count_this_week = 0;
            userStreak.ninety_percent_macro_hit_count_this_week = 0;
            userStreak.fifty_tokens_count_this_week = 0;

            userStreak.last_weekly_reset_date = startOfWeek;
        }
        return userStreak;
    }

    getOneByColumnNameAndValue = async (filterObj = {}) => {
        console.log('UserStreakModel@getOneByColumnNameAndValue');

        try {

            const { user_id } = filterObj;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                }
            }

            if (user_id) {
                dbQuery.user_id = new mongoose.Types.ObjectId(user_id);
            }

            let result = await UserStreak.findOne(dbQuery);
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error UserStreakModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    trackAppOpen = async (userId, timezone = 'UTC') => {
        console.log('UserStreakModel@trackAppOpen');
        try {

            const { dayUnit } = await dataHelpers.getStartDateTimes(timezone);
            const now = moment().tz(timezone);

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = await this._checkAndResetWeeklyCounters({}, timezone);

                userStreak = await UserStreak.create({
                    user_id: userId,
                    last_open_date: now.toDate(),
                    app_open_count_this_week: 1
                });
                return userStreak;
            }

            // 1. Perform weekly (or 7-minute) reset if needed
            const initialResetDate = userStreak.last_weekly_reset_date ? userStreak.last_weekly_reset_date.getTime() : 0;

            // Pass isTestMode to your helper if possible, otherwise we handle reset logic here
            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            const currentResetDate = userStreak.last_weekly_reset_date ? userStreak.last_weekly_reset_date.getTime() : 0;
            const resetHappened = initialResetDate !== currentResetDate;

            // 2. Check if we already counted this "day" (or minute)
            const lastOpen = userStreak.last_open_date ? moment(userStreak.last_open_date).tz(timezone) : null;

            // Use the dynamic dayUnit here ('minute' or 'day')
            if (lastOpen && lastOpen.isSame(now, dayUnit)) {
                if (resetHappened) await userStreak.save();
                return userStreak;
            }

            // 3. Increment count
            userStreak.app_open_count_this_week += 1;
            userStreak.last_open_date = now.toDate();

            // 4. Milestone Check
            if (userStreak.app_open_count_this_week === 5) {
                // Ensure milestones object exists
                if (!userStreak.milestones)
                    userStreak.milestones = { five_time_open_count: 0 };

                userStreak.milestones.five_time_open_count += 1;
                this._addMilestoneTokens(userId, timezone, 'five_time_open_tokens');
            }

            await userStreak.save();
            return userStreak;

        } catch (error) {
            console.log("Error UserStreakModel@trackAppOpen: ", error);
            return false;
        }
    }

    trackMealMilestones = async (userId, timezone = 'UTC') => {
        console.log('UserStreakModel@trackMealMilestones');
        try {

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = {};
            };

            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            const weeklyCount = await UserMealModel.countLoggedDaysThisWeek(userId, timezone);
            const consecutiveCount = await UserMealModel.countConsecutiveLoggedDays(userId, timezone, userStreak.last_meal_consecutive_reset_date);

            // Milestone: Log food every day this week
            if (weeklyCount > userStreak.meal_log_count_this_week) {
                userStreak.meal_log_count_this_week = weeklyCount;
                if (weeklyCount === 7) {
                    userStreak.milestones.every_day_meal_log_count += 1;
                    this._addMilestoneTokens(userId, timezone, 'every_day_meal_log_tokens');
                }
            }

            // Milestone: Log meals 5 days in a row
            userStreak.consecutive_meal_log_count = consecutiveCount;
            if (consecutiveCount === 5) {
                userStreak.milestones.consecutive_five_day_meal_log_count += 1;
                userStreak.last_meal_consecutive_reset_date = moment().tz(timezone).toDate();
                this._addMilestoneTokens(userId, timezone, 'consecutive_five_day_meal_log_tokens');
            }

            await userStreak.save();
            return true;
        } catch (error) {
            console.log("Error UserStreakModel@trackMealMilestones: ", error);
            return false;
        }
    }

    trackNutritionMilestones = async (userId, user, timezone = 'UTC') => {
        console.log('UserStreakModel@trackNutritionMilestones');
        try {
            const now = moment().tz(timezone);
            const { dayUnit, startOfDay, endOfDay, startOfDayObj } = await dataHelpers.getStartDateTimes(timezone);

            const dailyNutrition = await UserMealModel.getDailyNutrition(userId, startOfDay, endOfDay);

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = {};
            };

            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            /** Protein Goal Check (Hit 100% of protein goal) */
            const goalObj = await GoalModel.getOneByColumnNameAndValue('_id', user?.goal?.id);
            let nutrition = goalObj?.default_nutrition || {};

            // Convert user height into CM
            let userHeightInCm;
            switch (user.height_unit) {
                case UserModel.heightUnits.FT:
                    userHeightInCm = Number(user.height) * 30.48; // 1 foot = 30.48 cm
                    break;

                case UserModel.heightUnits.IN:
                    userHeightInCm = Number(user.height) * 2.54; // 1 inch = 2.54 cm
                    break;

                default:
                    userHeightInCm = user.height;
                    break;
            }

            // Convert user weight into Kgs
            let userWeightInKg = user.weight;
            if (user.weight_unit == UserModel.weightUnits.LB) {
                userWeightInKg = Number(user.weight) * 0.453592 // 1 lb = 0.453592 kg
            }

            /** Calculate target macros on the basis of user age, weight, and height */
            const userParams = {
                age: user.age,
                gender: user.gender,
                heightInCm: userHeightInCm,
                weightInKg: userWeightInKg
            }

            const targetMacros = await dataHelpers.calculateMacros(userParams, nutrition);

            // /** Goal Calculation */
            // const userWeight = parseFloat(user?.weight || 0);
            // const weightUnit = user?.weight_unit?.toLowerCase() || 'lb';

            // // 1. Convert weight to lbs if necessary
            // const weightInLbs = weightUnit === UserModel.weightUnits.KG ? userWeight * 2.20462 : userWeight;

            // // 2. Extract Goal Parameters
            // const calorieModifier = parseFloat(goalObj?.default_nutrition?.calorie_modifier || 0);
            // const proteinPerLb = parseFloat(goalObj?.default_nutrition?.protein_per_lb || 0);
            // const carbsPercent = parseFloat(goalObj?.default_nutrition?.carbs_percent || 0);
            // const fatPercent = parseFloat(goalObj?.default_nutrition?.fat_percent || 0);

            // const baseCalories = dataHelpers.calculateTDEE(user);
            // const targetCalories = baseCalories * (1 + calorieModifier);


            // Priority: User's manual meal_settings OR calculation from goal formula
            const calorieGoal = parseFloat(targetMacros?.target_calories || 0);
            const proteinGoal = parseFloat(targetMacros?.protein_grams || 0);
            const carbGoal = parseFloat(targetMacros?.carbs_grams || 0);
            const fatGoal = parseFloat(targetMacros?.fat_grams || 0);

            console.log('calorieGoal: ', calorieGoal);
            console.log('proteinGoal: ', proteinGoal);
            console.log('carbGoal: ', carbGoal);
            console.log('fatGoal: ', fatGoal);
            console.log('dailyNutrition: ', dailyNutrition);

            const currentProtein = dailyNutrition?.protein || 0;

            /** Hit protein goal 3 times this week */
            const lastProteinHit = userStreak.last_protein_hit_date ? moment(userStreak.last_protein_hit_date).tz(timezone) : null;
            if (proteinGoal > 0 && currentProtein >= proteinGoal) {
                if (!lastProteinHit || !lastProteinHit.isSame(startOfDayObj, dayUnit)) {
                    userStreak.protein_hit_count_this_week += 1;
                    userStreak.last_protein_hit_date = now.toDate();

                    // Milestone: Hit protein goal 3 times
                    if (userStreak.protein_hit_count_this_week === 3) {
                        userStreak.milestones.three_time_protein_count += 1;
                        this._addMilestoneTokens(userId, timezone, 'three_time_protein_tokens');
                    }
                }
            }

            /** Macro Goal Check (100% threshold for Calories, Protein, Carbs, Fats) */
            const isMacroFulfilled = (
                (calorieGoal > 0 && dailyNutrition.calories >= calorieGoal) &&
                (proteinGoal > 0 && dailyNutrition.protein >= proteinGoal) &&
                (carbGoal > 0 && dailyNutrition.carbs >= carbGoal) &&
                (fatGoal > 0 && dailyNutrition.fats >= fatGoal)
            );

            const lastMacroHit = userStreak.last_macro_hit_date ? moment(userStreak.last_macro_hit_date).tz(timezone) : null;

            if (isMacroFulfilled) {
                if (!lastMacroHit || !lastMacroHit.isSame(startOfDayObj, dayUnit)) {
                    userStreak.macro_hit_count_this_week += 1;
                    userStreak.last_macro_hit_date = now.toDate();

                    // Milestone: Fulfill macros every day 
                    if (userStreak.macro_hit_count_this_week === 7) {
                        userStreak.milestones.every_day_macros_fulfill_count += 1;
                        this._addMilestoneTokens(userId, timezone, 'every_day_macros_fulfill_tokens');
                    }
                }

                await UserTokenModel.addActivityTokens(userId, timezone, 'daily_macros');
                await this.updateStreakCount(userId, timezone);
            }

            /** Macro Goal Check (90% threshold for Calories, Protein, Carbs, Fats) */
            const hitThreshold = 0.9;
            const ninetyPercentMacroFulfilled = (
                (calorieGoal > 0 && dailyNutrition.calories >= calorieGoal * hitThreshold) &&
                (proteinGoal > 0 && dailyNutrition.protein >= proteinGoal * hitThreshold) &&
                (carbGoal > 0 && dailyNutrition.carbs >= carbGoal * hitThreshold) &&
                (fatGoal > 0 && dailyNutrition.fats >= fatGoal * hitThreshold)
            );
            
            const lastNinetyPercentMacroHit = userStreak.last_ninety_percent_macro_hit_date ? moment(userStreak.last_ninety_percent_macro_hit_date).tz(timezone) : null;
            console.log(lastNinetyPercentMacroHit,  '========lastNinetyPercentMacroHit');
            console.log(ninetyPercentMacroFulfilled, "============ninetyPercentMacroFulfilled");

            if (ninetyPercentMacroFulfilled) {
                if (!lastNinetyPercentMacroHit || !lastNinetyPercentMacroHit.isSame(startOfDayObj, dayUnit)) {
                    userStreak.ninety_percent_macro_hit_count_this_week += 1;
                    userStreak.last_ninety_percent_macro_hit_date = now.toDate();

                    // Milestone: Hit 90% macros twice
                    if (userStreak.ninety_percent_macro_hit_count_this_week === 2) {
                        userStreak.milestones.ninety_percent_macros_twice_count += 1;
                        this._addMilestoneTokens(userId, timezone, 'ninety_percent_macros_twice_tokens');
                    }
                }
            }

            // Milestone: Macros fulfill 7 days in a row
            const goalsData = { calorieGoal, proteinGoal, carbGoal, fatGoal };
            const consecutiveMacrosFulfillCount = await UserMealModel.countConsecutiveMacrosFulfillDays(userId, goalsData, timezone, userStreak.last_macro_consecutive_reset_date);
            userStreak.consecutive_macros_fulfill_count = consecutiveMacrosFulfillCount;
            if (consecutiveMacrosFulfillCount === 7) {
                userStreak.milestones.consecutive_seven_day_macros_fulfill_count += 1;
                userStreak.last_macro_consecutive_reset_date = now.toDate();
                this._addMilestoneTokens(userId, timezone, 'consecutive_seven_day_macros_fulfill_tokens');
            }

            await userStreak.save();

            return true;
        } catch (error) {
            console.log("Error UserStreakModel@trackNutritionMilestones: ", error);
            return false;
        }
    }

    trackScanMilestones = async (userId, type, timezone = 'UTC') => {
        console.log(`UserStreakModel@trackScanMilestones: ${type}`);
        try {
            const ScanModel = require('../scans/scans.model');

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = {};
            };

            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            if (type === 'body') {
                const count = await ScanModel.countScansThisWeek(userId, 'body', timezone);

                if (count > userStreak.body_scan_count_this_week) {
                    userStreak.body_scan_count_this_week = count;
                    if (count === 1) {
                        userStreak.milestones.one_body_scan_count += 1;
                        this._addMilestoneTokens(userId, timezone, 'one_body_scan_tokens');
                    }
                }
            } else if (type === 'food') {
                const count = await ScanModel.countScansThisWeek(userId, 'food', timezone);

                if (count > userStreak.food_scan_count_this_week) {
                    userStreak.food_scan_count_this_week = count;
                    if (count === 7) {
                        userStreak.milestones.seven_foods_scan_count += 1;
                        this._addMilestoneTokens(userId, timezone, 'seven_foods_scan_tokens');
                    }
                }
            } else if (type === 'menu') {
                const count = await ScanModel.countScansThisWeek(userId, 'menu', timezone);

                if (count > userStreak.menu_scan_count_this_week) {
                    userStreak.menu_scan_count_this_week = count;
                    if (count === 1) {
                        userStreak.milestones.menu_scan_count += 1;
                        this._addMilestoneTokens(userId, timezone, 'menu_scan_tokens');
                    }
                }
            }

            await userStreak.save();
            return true;
        } catch (error) {
            console.log("Error UserStreakModel@trackScanMilestones: ", error);
            return false;
        }
    }

    trackTokenMilestones = async (userId, timezone = 'UTC') => {
        console.log('UserStreakModel@trackTokenMilestones');
        try {

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = {};
            };

            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            userStreak.fifty_tokens_count_this_week += 1;
            if (userStreak.fifty_tokens_count_this_week === 1) {
                userStreak.milestones.fifty_tokens_count += 1;
            }

            await userStreak.save();
            return true;

        } catch (error) {
            console.log("Error UserStreakModel@trackTokenMilestones: ", error);
            return false;
        }
    }

    trackWorkoutMilestones = async (userId, timezone = 'UTC') => {
        console.log('UserStreakModel@trackWorkoutMilestones');
        try {

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = {};
            };

            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            const workoutCount = await UserWorkoutModel.countWorkoutsThisWeek(userId, timezone);
            console.log('UserStreakModel@trackWorkoutMilestones: workout_count_this_week', userStreak.workout_count_this_week);

            // Only process if count has increased
            if (workoutCount > userStreak.workout_count_this_week) {
                userStreak.workout_count_this_week = workoutCount;

                if (workoutCount === 3) {
                    userStreak.milestones.three_workout_count += 1;
                    this._addMilestoneTokens(userId, timezone, 'three_workout_tokens');
                } else if (workoutCount === 5) {
                    userStreak.milestones.five_workout_count += 1;
                    this._addMilestoneTokens(userId, timezone, 'five_workout_tokens');
                }

                if (workoutCount === 7) {
                    userStreak.milestones.every_day_workout_count += 1;
                    this._addMilestoneTokens(userId, timezone, 'every_day_workout_tokens');
                }
            }

            await userStreak.save();
            return true;
        } catch (error) {
            console.log("Error UserStreakModel@trackWorkoutMilestones: ", error);
            return false;
        }
    }

    trackSixtySecondsWorkout = async (userId, timezone = 'UTC') => {
        console.log('UserStreakModel@trackSixtySecondsWorkout');
        try {
            const now = moment().tz(timezone);

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = {};
            };

            // 1. Perform weekly reset if needed
            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            // 2. Determine the start of the current weekly boundary (or 7-minute test boundary)
            const { startOfWeekObj } = await dataHelpers.getStartDateTimes(timezone);

            // Milestone: Start workout within 60s (Limit: ONCE per week)
            const lastHit = userStreak.last_workout_speed_milestone_date ? moment(userStreak.last_workout_speed_milestone_date).tz(timezone) : null;

            // If never hit OR last hit was before the current slot boundary
            if (!lastHit || lastHit.isBefore(startOfWeekObj)) {
                userStreak.milestones.sixty_seconds_workout_count += 1;
                userStreak.last_workout_speed_milestone_date = now.toDate(); // Mark as awarded for the current week
                await userStreak.save();

                this._addMilestoneTokens(userId, timezone, 'sixty_seconds_workout_tokens');
            }

            return true;
        } catch (error) {
            console.log("Error UserStreakModel@trackSixtySecondsWorkout: ", error);
            return false;
        }
    }

    trackVoiceMilestones = async (userId, timezone = 'UTC') => {
        console.log('UserStreakModel@trackVoiceMilestones');
        try {
            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                userStreak = {};
            };

            userStreak = await this._checkAndResetWeeklyCounters(userStreak, timezone);

            // Milestone: Log via voice once a week
            if (userStreak.voice_log_count_this_week < 1) {
                userStreak.voice_log_count_this_week += 1;
                userStreak.milestones.voice_log_count += 1;
                await userStreak.save();
                this._addMilestoneTokens(userId, timezone, 'voice_log_tokens');
            }

            await this.trackMealMilestones(userId, timezone);

            return true;
        } catch (error) {
            console.log("Error UserStreakModel@trackVoiceMilestones: ", error);
            return false;
        }
    }

    updateStreakCount = async (userId, timezone = 'UTC') => {
        console.log('UserStreakModel@updateStreakCount');

        try {
            const { slotSizeMs } = await dataHelpers.getStartDateTimes(timezone);

            const now = moment().tz(timezone);
            const currentSlot = Math.floor(now.valueOf() / slotSizeMs);
            const previousSlot = currentSlot - 1;

            let userStreak = await UserStreak.findOne({
                user_id: new mongoose.Types.ObjectId(userId),
                deleted_at: { $in: [null, '', ' '] }
            });

            if (!userStreak) {
                // First ever workout
                userStreak = await UserStreak.create({
                    user_id: userId,
                    streak_count: 1,
                    // milestone_count: 0,
                    last_completed_date: now.toDate(),
                    streak_start_date: now.toDate(),
                    completions: [now.toDate()]
                });
                return userStreak;
            }

            const lastSlot = userStreak.last_completed_date ?
                Math.floor(moment(userStreak.last_completed_date).valueOf() / slotSizeMs) : null;

            if (lastSlot === currentSlot) {
                // Already updated in this slot, skip
                return userStreak;
            }

            if (lastSlot === previousSlot) {
                // Consecutive slot
                userStreak.streak_count += 1;

                // // If they hit 3 consecutive slots, increase milestone (testing)
                // if (userStreak.streak_count % 3 === 0) {
                //     userStreak.milestone_count += 1;
                // }

                // Milestone: Keep your streak alive for 3+ days (3+ slots in testing)
                if (userStreak.streak_count === 3) {
                    userStreak.milestones.three_plus_day_streak_count += 1;
                    this._addMilestoneTokens(userId, timezone, 'three_plus_day_streak_tokens');
                }
            } else {
                // Missed one or more slots, reset streak to 1 and clear completions
                userStreak.streak_count = 1;
                userStreak.completions = [];
                userStreak.streak_start_date = now.toDate(); // New streak starts now
            }

            userStreak.last_completed_date = now.toDate();
            userStreak.completions.push(now.toDate());

            // Keep only the last 30 completions to avoid bloating the document
            if (userStreak.completions.length > 30) {
                userStreak.completions = userStreak.completions.slice(-30);
            }

            await userStreak.save();

            return userStreak;

        } catch (error) {
            console.log("Error UserStreakModel@updateStreakCount: ", error);
            return false;
        }
    }

    getFormattedData = async (streakObj, timezone = 'UTC') => {
        console.log('UserStreakModel@getFormattedData');

        if (!streakObj)
            return null;

        const { startOfWeek, dayUnit, slotSizeMs } = await dataHelpers.getStartDateTimes(timezone);

        const now = moment().tz(timezone);
        // const currentSlot = Math.floor(now.valueOf() / slotSizeMs);
        const lastSlot = streakObj.last_completed_date ?
            Math.floor(moment(streakObj.last_completed_date).valueOf() / slotSizeMs) : null;

        let displayStreak = streakObj.streak_count;
        let expiresAt = null;

        if (lastSlot !== null) {
            // The streak is valid for the current slot AND the next slot.
            // It expires at the start of currentSlot + 2 relative to the last workout.
            const expiryTimestamp = (lastSlot + 2) * slotSizeMs;
            expiresAt = new Date(expiryTimestamp);

            // If current time has already passed the expiry, display 0
            if (now.valueOf() >= expiryTimestamp) {
                displayStreak = 0;
            }
        }

        // Generate Weekly Report (Monday to Sunday)
        const weeklyReport = [];
        for (let i = 0; i < 7; i++) {
            const day = moment(startOfWeek).add(i, dayUnit);
            const dayName = day.format('dddd');

            // If the streak is broken (displayStreak == 0), we don't show completions
            // even if they worked out earlier this week, to reflect the "reset" state.
            const isCompleted = (displayStreak > 0) && streakObj.completions.some(date =>
                moment(date).tz(timezone).isSame(day, 'day')
            );

            weeklyReport.push({
                day: dayName,
                date: day.format('YYYY-MM-DD'),
                is_completed: isCompleted
            });
        }

        return {
            id: streakObj._id,
            user_id: streakObj.user_id,
            streak_count: displayStreak,
            // milestone_count: streakObj.milestone_count,
            streak_start_date: streakObj.streak_start_date,
            last_completed_date: streakObj.last_completed_date,
            streak_expires_at: expiresAt,
            weekly_report: weeklyReport,
            milestones: streakObj.milestones || {},
            created_at: streakObj.created_at,
            updated_at: streakObj.updated_at
        };
    }
}

module.exports = new UserStreakModel();
