const moment = require('moment-timezone')

/** Custom Require **/
const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const nodemailer = require('../../../services/nodemailer');
const aws = require("../../../services/aws");
const socialLoginService = require('../../../services/socialLogin');
const stripeService = require('../../../services/stripe');

const UserModel = require('./users.model');
const GoalModel = require('../goals/goals.model');
const UserMealModel = require('../user_meals/user_meals.model');
const TodayWorkoutModel = require('../today_workouts/today_workouts.model');
const SubscriptionModel = require('../subscriptions/subscriptions.model')
const UserStreakModel = require('../user_streaks/user_streaks.model');
const ExercisesModel = require('../exercises/exercises.model');
const UserTokensModel = require('../user_tokens/user_tokens.model')
const ReferralTrackModel = require('../referral_track/referral_tracks.model');
const PayoutsModel = require('../payouts/payouts.model')

const verificationTemplate = require('../../../emailTemplates/v1/verification');
const forgotPasswordTemplate = require("../../../emailTemplates/v1/forgotPassword");

class UserController {

    createOne = async (req, res) => {
        console.log('UsersController@createOne');

        /* Collect the user input  */
        const {
            // first_name, 
            // last_name, 
            email,
            password,
            phone_number,
            phone_code,
            referral_code
        } = req.body;

        /** Check that the user already exist or not with the provided email */
        if (email) {
            const isUserExist = await UserModel.isUserExist('email', email);
            console.log('isUserExist', isUserExist);
            if (isUserExist) {
                return response.conflict('error.emailExist', res, false);
            }
        }

        if (phone_number) {
            const isPhoneNumberExist = await UserModel.isPhoneNumberExist(phone_code, phone_number);
            if (isPhoneNumberExist) {
                return response.conflict('error.phoneNumberExist', res, false);
            }
        }

        /* Convert password string into a hash  */
        const hashedPassword = await dataHelper.hashPassword(password);

        /* Generate OTP to verify the user email  */
        const verificationOtp = await dataHelper.generateSecureOTP(6);

        /* Formated the data to insert in DB */
        let userData = {
            password: hashedPassword,
            // user_info: {
            //     first_name: first_name,
            //     last_name: last_name
            // },
        }

        if (email) {
            userData = {
                ...userData,
                email: email,
                otp: {
                    email_verification: verificationOtp
                }
            }
        }

        if (phone_code && phone_number) {
            userData = {
                ...userData,
                phone_code: phone_code,
                phone_number: phone_number,
                otp: {
                    phone_verification: verificationOtp
                }
            }
        }

        // Create a referral code for user
        let referralCodeForNewUser = "";
        let isUnique = false;

        while (!isUnique) {
            // Generate random 10-character alphanumeric code
            referralCodeForNewUser = await dataHelper.generateReferralCode(10);

            // Ensure it doesn't already exist
            const existingUser = await UserModel.getOneByColumnNameAndValue('referral_code', referralCodeForNewUser);
            if (!existingUser) {
                isUnique = true;
            }
        }

        userData = {
            ...userData,
            referral_code: referralCodeForNewUser
        }

        // If referrer code is provided, find the user and set referred_by field
        if (referral_code && referral_code.trim() !== "") {
            const referrerUser = await UserModel.getOneByColumnNameAndValue('referral_code', referral_code);
            // console.log('referrerUser', referrerUser);

            if (referrerUser) {
                userData = {
                    ...userData,
                    referred_by: referrerUser._id
                }
            }
        }

        /* Insert the data into DB */
        const userObj = await UserModel.createOne(userData);
        if (!userObj) {
            return response.exception("error.serverError", res, false);
        }

        // Generate user's weekly fitness plan with default values
        const splits = Object.keys(ExercisesModel.fitnessPlanMuscles); // ['Push', 'Pull', 'Legs']
        const weeklySchedule = [];

        for (let day = 1; day <= 7; day++) {
            let split;
            let targetMuscles = [];

            if (day === 7) {
                weeklySchedule.push({ day, custom_muscles: [], workouts: [] });
                continue;
            } else {
                const splitIndex = (day - 1) % splits.length;
                split = splits[splitIndex];
                targetMuscles = ExercisesModel.fitnessPlanMuscles[split] || [];
            }

            let defaultExerciseTime = ExercisesModel.defaultExerciseTime.time
            let filterObj = {
                time: defaultExerciseTime,
                muscles: targetMuscles
            };

            const exercises = await ExercisesModel.generateExercises(filterObj);
            let setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate;

            weeklySchedule.push({
                day: day,
                time: defaultExerciseTime,
                custom_muscles: targetMuscles,
                workouts: (exercises || []).map(item => ({ ...item, set_and_reps: setAndReps, is_completed: false }))
            });
        }

        const fitnessPlanData = {
            'weekly_fitness_plan.weekly_schedule': weeklySchedule
        }

        await UserModel.upsertFitnessPlan(userObj._id, fitnessPlanData);
        
        let successMessage;
        /** Send verification OTP */
        if (email) {
            try {
                const subject = "Account Verification"
                const html = await verificationTemplate(verificationOtp);
                nodemailer.sendMail(email, subject, html);
            } catch (error) {
                console.log("Error while sending verification email: ", error);
            }

            if (process.env.NODE_ENV === 'development') {
                // Development: include the verification code in the message
                successMessage = res.__('auth.emailCodeSentWithOtp', { code: verificationOtp });
            } else {
                // Production: standard message without exposing the code
                successMessage = res.__('auth.emailCodeSent');
            }
        }
        else if (phone_code && phone_number) {
            // To Do send otp to the phone number

            if (process.env.NODE_ENV === 'development') {
                // Development: include the verification code in the message
                successMessage = res.__('auth.phoneCodeSentWithOtp', { code: verificationOtp });
            } else {
                // Production: standard message without exposing the code
                successMessage = res.__('auth.phoneCodeSent');
            }
        }

        return response.created(successMessage, res, true);
    }

    resendOtp = async (req, res) => {
        console.log('UsersController@resendOtp');

        const { email, phone_code, phone_number } = req.body;

        /** Find the user by given email/phone number */
        let user;

        if (email) {
            user = await UserModel.getOneByColumnNameAndValue('email', email);
            if (!user) {
                return response.badRequest("error.invalidEmail", res, false);
            }

            if (user.is_email_verified) {
                return response.badRequest("error.emailAlreadyVerified", res, false);
            }
        }
        else if (phone_code && phone_number) {
            user = await UserModel.getOneByPhoneCodeAndNumber(phone_code, phone_number);
            if (!user) {
                return response.badRequest("error.invalidPhone", res, false);
            }

            if (user.is_phone_verified) {
                return response.badRequest("error.phoneAlreadyVerified", res, false);
            }
        }

        /* Generate OTP to verify the user email  */
        const verificationOtp = await dataHelper.generateSecureOTP(6);

        const userDataToUpdate = {
            otp: {
                ...user.otp,
                ...(email && { email_verification: verificationOtp }),
                ...(phone_number && { phone_verification: verificationOtp }),
            },
        }
        const hasUpdated = await UserModel.updateOne(user._id, userDataToUpdate);
        if (!hasUpdated) {
            return response.exception('error.serverError', res, null);
        }

        /** Send verification OTP */
        let successMessage;
        if (email) {
            try {
                const subject = "Account Verification"
                const html = await verificationTemplate(verificationOtp);
                nodemailer.sendMail(email, subject, html);
            } catch (error) {
                console.log("Error while sending verification email: ", error);
            }

            if (process.env.NODE_ENV === 'development') {
                // Development: include the verification code in the message
                successMessage = res.__('auth.emailCodeSentWithOtp', { code: verificationOtp });
            } else {
                // Production: standard message without exposing the code
                successMessage = res.__('auth.emailCodeSent');
            }
        }
        else if (phone_code && phone_number) {
            // To Do send otp to the phone number

            if (process.env.NODE_ENV === 'development') {
                // Development: include the verification code in the message
                successMessage = res.__('auth.phoneCodeSentWithOtp', { code: verificationOtp });
            } else {
                // Production: standard message without exposing the code
                successMessage = res.__('auth.phoneCodeSent');
            }
        }

        return response.success(successMessage, res, true);
    }

    verifyOtp = async (req, res) => {
        console.log('UsersController@verifyOtp');

        const { email, phone_code, phone_number, otp } = req.body;

        /** Find the user by given email/phone number */
        let user;
        if (email) {
            user = await UserModel.getOneByColumnNameAndValue('email', email);
            if (!user) {
                return response.badRequest("error.invalidEmail", res, false);
            }

            if (
                (!user?.otp?.email_verification || user.otp.email_verification != otp)
                // && (process.env.NODE_ENV != 'development')
            ) {
                return response.badRequest("error.invalidOtp", res, false);
            }
        }
        else if (phone_code && phone_number) {
            user = await UserModel.getOneByPhoneCodeAndNumber(phone_code, phone_number);
            if (!user) {
                return response.badRequest("error.invalidPhone", res, false);
            }

            if (
                (!user?.otp?.phone_verification || user.otp.phone_verification != otp)
                // && (process.env.NODE_ENV != 'development')
            ) {
                return response.badRequest("error.invalidOtp", res, false);
            }
        }

        /** Generate the JWT token and insert it into the DB */
        const tokenData = {
            user_id: user._id,
            role: user.role
        };
        let token = await dataHelper.generateJWTToken(tokenData);

        const userDataToUpdate = {
            tokens: {
                auth_token: token,
                fcm_token: req.headers['fcm-token']
            },
            otp: {
                ...user.otp,
                ...(email && { email_verification: "" }),
                ...(phone_number && { phone_verification: "" }),
            }
        }

        if (email) {
            userDataToUpdate.is_email_verified = true
        }

        if (phone_number) {
            userDataToUpdate.is_phone_verified = true
        }

        const updatedUser = await UserModel.updateOne(user._id, userDataToUpdate);
        if (!updatedUser) {
            return response.exception('error.serverError', res, null);
        }

        const formatedUserData = await UserModel.getFormattedData(updatedUser);

        const result = {
            token: token,
            user: formatedUserData
        };

        return response.success("auth.otpVerified", res, result);
    }

    updateOne = async (req, res) => {
        console.log('UsersController@updateOne');

        /* Collect the user input  */
        const {
            first_name,
            last_name,
            email,
            dob,
            experience_level,
            preferred_training_location,
            available_equipments,
            results_speed_pref,
            track_nutrition,
            activity,
            goal_id,
            age,
            weight,
            weight_unit,
            height,
            height_unit,
            gender,
            step
        } = req.body;

        const user = await UserModel.getOneByColumnNameAndValue("_id", req.params.id);
        if (!user) {
            return response.badRequest("error.userNotExist", res, false);
        }

        let goalObj;
        if (goal_id) {
            goalObj = await GoalModel.getOneByColumnNameAndValue('_id', goal_id);
            if (!goalObj) {
                return response.badRequest("error.invalidGoalId", res, false);
            }
        }

        let userData = {};
        let fitnessPlanData = {};

        if (first_name != null) {
            userData['user_info.first_name'] = first_name;
        }

        if (last_name != null) {
            userData['user_info.last_name'] = last_name;
        }

        if (experience_level != null) {
            userData['workout_settings.experience_level'] = experience_level;

            if (experience_level !== UserModel.experienceLevels.INTERMEDIATE) {
                let difficulty;
                let setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate;

                switch (experience_level) {
                    case UserModel.experienceLevels.BEGINNER:
                        difficulty = UserModel.experienceLevels.BEGINNER;
                        setAndReps = ExercisesModel.setAndRepsConfiguration.beginner;
                        break;

                    case UserModel.experienceLevels.ADVANCED:
                        difficulty = UserModel.experienceLevels.ADVANCED;
                        setAndReps = ExercisesModel.setAndRepsConfiguration.advanced;
                        break;
                }

                const userFitnessPlan = await UserModel.getFitnessPlan(user._id);
                if (userFitnessPlan?.weekly_fitness_plan && Array.isArray(userFitnessPlan.weekly_fitness_plan?.weekly_schedule)) {
                    fitnessPlanData['weekly_fitness_plan.weekly_schedule'] =
                        userFitnessPlan.weekly_fitness_plan.weekly_schedule.map(day => ({
                            ...day,
                            difficulty,
                            workouts: (day.workouts || []).map(item => ({ ...item, set_and_reps: setAndReps, is_completed: false }))
                        }));
                }
            }
        }

        if (preferred_training_location != null) {
            userData['workout_settings.preferred_training_location'] = preferred_training_location;
        }

        if (available_equipments != null) {
            userData['workout_settings.available_equipments'] = available_equipments ? available_equipments.split(",") : [];
        }

        userData = {
            ...userData,
            ...(dob != null && { dob: dob }),
            ...(age != null && { age: age }),
            ...(results_speed_pref != null && { results_speed_pref: results_speed_pref }),
            ...(track_nutrition != null && { track_nutrition: track_nutrition }),
            ...(activity != null && { activity: activity }),
            ...(weight != null && { weight: weight }),
            ...(weight_unit != null && { weight_unit: weight_unit }),
            ...(height != null && { height: height }),
            ...(height_unit != null && { height_unit: height_unit }),
            ...(gender != null && { gender: gender }),
            ...(step != null && { step: step })
        }

        if (goalObj) {
            userData = {
                ...userData,
                goal: {
                    id: goalObj._id,
                    title: goalObj.title
                },
                goal_updated_at: moment().format('YYYY-MM-DD hh:mm:ss')
            }
            // console.log(userData, "=======userData");
        }
        else if (goal_id != null) {
            userData = {
                ...userData,
                goal: {
                    id: "",
                    title: ""
                },
                goal_updated_at: ""
            }
        }

        let emailVerificationOtp;
        /** Check that the user already exist or not with the provided email */
        if (email && email !== user.email) {

            const isUserExist = await UserModel.isUserExist('email', email, user._id);
            if (isUserExist) {
                return response.conflict('error.emailExist', res, false);
            }

            /* Generate OTP to verify the user email  */
            emailVerificationOtp = await dataHelper.generateSecureOTP(4);
            userData = {
                ...userData,
                email: email,
                otp: {
                    email_verification: emailVerificationOtp
                },
                is_email_verified: false
            }
        }

        if (req.image_url) {
            /** If profile picture url given  */
            userData = {
                ...userData,
                profile_picture: req.image_url
            }
        }

        /* Insert the data into DB */
        let updatedUserObj = await UserModel.updateOne(user._id, userData);
        if (!updatedUserObj) {

            /** If unable to update user then delete the uploaded file */
            if (userData?.profile_picture) {
                await aws.deleteFile(image_url)
            }

            return response.exception("error.serverError", res, false);
        }

        /** If the profile picture has been updated then delete the previous profile picture*/
        if (user?.profile_picture && user.profile_picture != updatedUserObj.profile_picture) {
            await aws.deleteFile(user.profile_picture)
        }

        if(Object.keys(fitnessPlanData).length > 0) {
            await UserModel.upsertFitnessPlan(user._id, fitnessPlanData);
        }

        /** Send verification email */
        if (emailVerificationOtp) {
            try {
                const subject = "Account Verification"
                const html = await verificationTemplate(emailVerificationOtp);
                nodemailer.sendMail(email, subject, html);
            } catch (error) {
                console.log("Error while sending verification email: ", error);
            }
        }

        let successMessage;
        if (process.env.NODE_ENV === 'development') {
            // Development: include the verification code in the message
            successMessage = emailVerificationOtp ? res.__('auth.emailCodeSentWithOtp', { code: emailVerificationOtp }) : res.__('auth.profileUpdated');
        } else {
            // Production: standard message without exposing the code
            successMessage = emailVerificationOtp ? res.__('auth.emailCodeSentWithOtp') : res.__('auth.profileUpdated');
        }

        updatedUserObj.active_subscription = user?.active_subscription
        const formatedUserData = await UserModel.getFormattedData(updatedUserObj);

        return response.created(successMessage, res, formatedUserData);
    }

    updateLabData = async (req, res) => {
        console.log('UsersController@updateLabData');

        /* Collect the user input  */
        const { workout_settings, meal_settings } = req.body;

        const user = await UserModel.getOneByColumnNameAndValue("_id", req.params.id);
        if (!user) {
            return response.badRequest("error.userNotExist", res, false);
        }

        let userData = {};

        /** Map workout settings */
        if (workout_settings && Object.keys(workout_settings).length > 0) {
            if (workout_settings?.goal_id) {
                const goalObj = await GoalModel.getOneByColumnNameAndValue('_id', workout_settings.goal_id);
                if (!goalObj) {
                    return response.badRequest("error.invalidGoalId", res, false);
                }
                userData = {
                    ...userData,
                    goal: {
                        id: goalObj._id,
                        title: goalObj.title
                    },
                    goal_updated_at: moment().format('YYYY-MM-DD hh:mm:ss')
                }
            }

            const {
                workout_time, days_per_week, experience_level, available_equipments,
                training_preferences, variability, cardio, warm_up, cool_down, activity
            } = workout_settings;

            const workoutSettings = {
                ...user.workout_settings,
                ...(workout_time != null && { workout_time: workout_time }),
                ...(days_per_week != null && { days_per_week: days_per_week }),
                ...(experience_level != null && { experience_level: experience_level }),
                ...(available_equipments != null && { available_equipments: available_equipments }),
                ...(training_preferences != null && { training_preferences: training_preferences }),
                ...(variability != null && { variability: variability }),
                ...(cardio != null && { cardio: cardio }),
                ...(warm_up != null && { warm_up: warm_up }),
                ...(cool_down != null && { cool_down: cool_down })
            }

            if (workoutSettings && Object.keys(workoutSettings).length > 0) {
                userData = {
                    ...userData,
                    workout_settings: workoutSettings
                }
            }

            if (activity != null) {
                userData = {
                    ...userData,
                    activity: activity
                }
            }
        }
        /** End map workout settings */

        /** Map meal settings */
        if (meal_settings && Object.keys(meal_settings).length > 0) {
            const {
                calories, protein, carbs, fats, meals_per_day, diet_style,
                exclude_gluten, exclude_dairy, exclude_nuts, exclude_soy, exclude_shellfish, exclude_eggs,
                dislike_foods, meal_style_preferences, cooking_skill, intermittent_fasting, post_workout_emphasis,
                late_night_carbs, cuisines, spice_tolerance, sweeteners, alcohol_policy
            } = meal_settings;

            const mealSettings = {
                ...user.meal_settings,
                ...(calories != null && { calories: calories }),
                ...(protein != null && { protein: protein }),
                ...(carbs != null && { carbs: carbs }),
                ...(fats != null && { fats: fats }),
                ...(meals_per_day != null && { meals_per_day: meals_per_day }),
                ...(diet_style != null && { diet_style: diet_style }),
                ...(exclude_gluten != null && { exclude_gluten: exclude_gluten }),
                ...(exclude_dairy != null && { exclude_dairy: exclude_dairy }),
                ...(exclude_nuts != null && { exclude_nuts: exclude_nuts }),
                ...(exclude_soy != null && { exclude_soy: exclude_soy }),
                ...(exclude_shellfish != null && { exclude_shellfish: exclude_shellfish }),
                ...(exclude_eggs != null && { exclude_eggs: exclude_eggs }),
                ...(dislike_foods != null && { dislike_foods: dislike_foods }),
                ...(meal_style_preferences != null && { meal_style_preferences: meal_style_preferences }),
                ...(cooking_skill != null && { cooking_skill: cooking_skill }),
                ...(intermittent_fasting != null && { intermittent_fasting: intermittent_fasting }),
                ...(post_workout_emphasis != null && { post_workout_emphasis: post_workout_emphasis }),
                ...(late_night_carbs != null && { late_night_carbs: late_night_carbs }),
                ...(cuisines != null && { cuisines: cuisines }),
                ...(spice_tolerance != null && { spice_tolerance: spice_tolerance }),
                ...(sweeteners != null && { sweeteners: sweeteners }),
                ...(alcohol_policy != null && { alcohol_policy: alcohol_policy }),
            }

            if (mealSettings && Object.keys(mealSettings).length > 0) {
                userData = {
                    ...userData,
                    meal_settings: mealSettings
                }

                if (calories || protein || carbs || fats) {
                    userData = {
                        ...userData,
                        nutrition_updated_at: moment().format('YYYY-MM-DD hh:mm:ss')
                    }
                    // console.log(userData, "=======userData");
                }
            }
        }

        /** End map meal settings */

        /* Insert the data into DB */
        let updatedUserObj = user;
        if (userData && Object.keys(userData).length > 0) {
            updatedUserObj = await UserModel.updateOne(user._id, userData);
            if (!updatedUserObj) {
                return response.exception("error.serverError", res, false);
            }
        }

        const userTodayWorkoutObj = await TodayWorkoutModel.getOneByColumnNameAndValue('user_id', req.user._id);
        if (userTodayWorkoutObj?._id) {
            await TodayWorkoutModel.updateOne(userTodayWorkoutObj._id, { is_setting_updated: true });
        }

        const formatedUserData = await UserModel.getFormattedData(updatedUserObj);

        return response.created("success.userProfile", res, formatedUserData);
    }

    userLogin = async (req, res) => {
        console.log('UsersController@userlogin');

        const { email, phone_code, phone_number, password } = req.body;

        /** Find the user by given email/phone number */
        let user;
        if (email) {
            user = await UserModel.getOneByColumnNameAndValue('email', email);
        }
        else if (phone_code && phone_number) {
            user = await UserModel.getOneByPhoneCodeAndNumber(phone_code, phone_number);
        }

        if (!user) {
            return response.badRequest("auth.invalidCredentails", res, false);
        }

        /** Validate the password */
        const isValidPassword = await dataHelper.validatePassword(password, user.password);
        if (!isValidPassword) {
            return response.badRequest("auth.invalidCredentails", res, false);
        }

        /** Check status */
        if (user.status == UserModel.statuses.BLOCKED) {
            return response.badRequest("auth.accountSuspended", res, false);
        }

        /** Generate the JWT token and insert it into the DB */
        const tokenData = {
            user_id: user._id,
            role: user.role
        };
        let token = await dataHelper.generateJWTToken(tokenData);

        const userData = {
            tokens: {
                auth_token: token,
                fcm_token: req.headers['fcm-token']
            }
        }
        let updatedUser = await UserModel.updateOne(user._id, userData);
        if (!updatedUser) {
            return response.exception('error.serverError', res, null);
        }
        updatedUser.active_subscription = user?.active_subscription
        const formatedUserData = await UserModel.getFormattedData(updatedUser);

        const result = {
            token: token,
            user: formatedUserData
        };
        return response.success("auth.loggedIn", res, result);
    }

    changePassword = async (req, res) => {
        console.log("UsersController@changePassword");

        const { new_password } = req.body;
        const user = req.user;

        /* Convert password string into a hash  */
        const hashedPassword = await dataHelper.hashPassword(new_password);

        /** Update new password in DB */
        const userDataToUpdate = {
            password: hashedPassword
        }
        const hasUpdated = await UserModel.updateOne(user._id, userDataToUpdate);
        if (!hasUpdated) {
            return response.exception('error.serverError', res, null);
        }

        return response.success("auth.passwordChanged", res, true);
    }

    forgotPassword = async (req, res) => {
        console.log("UsersController@forgotPassword");

        const { email, phone_code, phone_number } = req.body;

        /** Find the user by given email/phone number */
        let user;
        if (email) {
            user = await UserModel.getOneByColumnNameAndValue('email', email);
            if (!user) {
                return response.badRequest("error.invalidEmail", res, false);
            }
        }
        else if (phone_code && phone_number) {
            user = await UserModel.getOneByPhoneCodeAndNumber(phone_code, phone_number);
            if (!user) {
                return response.badRequest("error.invalidPhone", res, false);
            }
        }

        /* Generate OTP to verify the user email  */
        const forgotPasswordVerificationOtp = await dataHelper.generateSecureOTP(6);

        const userDataToUpdate = {
            otp: {
                ...user.otp,
                forgot_password: forgotPasswordVerificationOtp,
            }
        };
        const hasUpdated = await UserModel.updateOne(user._id, userDataToUpdate);
        if (!hasUpdated) {
            return response.exception("error.serverError", res, null);
        }

        /** Send verification OTP */
        let successMessage;
        if (email) {
            try {
                const subject = "Forgot Password Verification";
                const html = await forgotPasswordTemplate(forgotPasswordVerificationOtp);
                nodemailer.sendMail(email, subject, html);
            } catch (error) {
                console.log("Error while sending verification email: ", error);
            }

            if (process.env.NODE_ENV === "development") {
                // Development: include the verification code in the message
                successMessage = res.__("auth.emailCodeSentWithOtp", {
                    code: forgotPasswordVerificationOtp,
                });
            } else {
                // Production: standard message without exposing the code
                successMessage = res.__("auth.emailCodeSent");
            }
        }
        else if (phone_code && phone_number) {
            // To Do send otp to the phone number

            if (process.env.NODE_ENV === 'development') {
                // Development: include the verification code in the message
                successMessage = res.__('auth.phoneCodeSentWithOtp', { code: forgotPasswordVerificationOtp });
            } else {
                // Production: standard message without exposing the code
                successMessage = res.__('auth.phoneCodeSent');
            }
        }

        return response.success(successMessage, res, true);
    };

    verifyForgotPasswordOTP = async (req, res) => {
        console.log("UsersController@verifyForgotPasswordOTP");

        const { email, phone_code, phone_number, otp } = req.body;

        /** Find the user by given email/phone number */
        let user;
        if (email) {
            user = await UserModel.getOneByColumnNameAndValue('email', email);
            if (!user) {
                return response.badRequest("error.invalidEmail", res, false);
            }
        }
        else if (phone_code && phone_number) {
            user = await UserModel.getOneByPhoneCodeAndNumber(phone_code, phone_number);
            if (!user) {
                return response.badRequest("error.invalidPhone", res, false);
            }
        }

        if (
            (!user?.otp?.forgot_password || user.otp.forgot_password != otp)
            // && (process.env.NODE_ENV != 'development')
        ) {
            return response.badRequest("error.invalidOtp", res, false);
        }

        const userDataToUpdate = {
            otp: {
                ...user.otp,
                ...(email && { email_verification: "" }),
                ...(phone_number && { phone_verification: "" }),
                forgot_password: null
            }
        };

        if (email) {
            userDataToUpdate.is_email_verified = true
        }

        if (phone_number) {
            userDataToUpdate.is_phone_verified = true
        }

        const hasUpdated = await UserModel.updateOne(user._id, userDataToUpdate);
        if (!hasUpdated) {
            return response.exception("error.serverError", res, null);
        }

        const result = {
            user: {
                id: user._id
            },
        };

        return response.success("auth.otpVerified", res, result);
    };

    resetPassword = async (req, res) => {
        console.log("UsersController@resetPassword");

        const { password, user_id } = req.body;

        const user = await UserModel.getOneByColumnNameAndValue("_id", user_id);
        if (!user) {
            return response.badRequest("error.userNotExist", res, false);
        }

        if (user?.otp?.forgot_password) {
            return response.badRequest("error.otpNotVerified", res, false);
        }

        /* Convert password string into a hash  */
        const hashedPassword = await dataHelper.hashPassword(password);

        /** Update new password in DB */
        const userDataToUpdate = {
            password: hashedPassword,
        };

        const hasUpdated = await UserModel.updateOne(user._id, userDataToUpdate);
        if (!hasUpdated) {
            return response.exception("error.serverError", res, null);
        }

        return response.success("auth.passwordChanged", res, true);
    };

    getUserProfile = async (req, res) => {
        console.log('UsersController@getUserProfile');

        let user = req.user;
        //Add user's active subscription data
        let active_subscription;
        let userActiveSubscription = await SubscriptionModel.getOneByColumnNameAndValue('user_id', user._id, { status: SubscriptionModel.statuses.ACTIVE })

        if (!userActiveSubscription) {
            active_subscription = {}
        } else {
            active_subscription = userActiveSubscription
        }
        user.active_subscription = active_subscription
        const formatedUserData = await UserModel.getFormattedData(user);

        return response.success("success.userProfile", res, formatedUserData);
    }

    getAllWithPagination = async (req, res) => {
        console.log('UsersController@getAllWithPagination');

        /** Extract the page and limt from query param */
        const { page, limit } = await dataHelper.getPageAndLimit(req.query);
        const { search } = req.query;

        let filterObj = {
            role: UserModel.roles.USER,
            search: search
        };
        const result = await UserModel.getAllWithPagination(page, limit, filterObj);
        if (!result?.data?.length) {
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.usersData", res, result);
    }

    logout = async (req, res) => {
        console.log("UsersController@logout");

        const user = req.user;

        const dataToUpdate = {
            "tokens.auth_token": "",
            "tokens.fcm_token": "",
        }

        const hasUpdated = await UserModel.updateOne(user._id, dataToUpdate)
        if (!hasUpdated) {
            return response.exception("error.serverError", res, null);
        }

        return response.success("auth.logoutSuccess", res, true);
    }

    deleteOne = async (req, res) => {
        console.log("UsersController@logout");

        const user = req.user;
        const { reason, user_id } = req.body;
        const userId = user_id ?? user._id;

        //convert date into format example -2025-07-03T09:48:05.031+00:00
        const dataToUpdate = {
            deleted_at: new Date().toISOString().replace('Z', '+00:00'),
            delete_reason: reason,
            status: UserModel.statuses.DELETED
        }

        const hasDeleted = await UserModel.updateOne(userId, dataToUpdate)
        if (!hasDeleted) {
            return response.exception("error.serverError", res, null);
        }

        return response.success("auth.deleteAccount", res, true);
    }

    // uploadImage = async (req, res) => {
    //     console.log('UsersController@uploadImage');

    //     if (!req?.file?.path) {
    //         return response.badRequest("error.fileNotUploaded", res, false);
    //     }

    //     /** Convert file path into a public URL */
    //     const filePath = req.file.path.replace(/\\/g, '/');
    //     const fileUrl = `${req.protocol}://${req.get('host')}/${filePath}`;

    //     return response.success("success.fileUploaded", res, { image_url: fileUrl });
    // }

    // uploadBulkImages = async (req, res) => {
    //     console.log('UsersController@uploadBulkImages');

    //     const files = req.files;
    //     if (!files?.length) {
    //         return response.badRequest("error.fileNotUploaded", res, false);
    //     }

    //     /** Convert file paths into public URLs */
    //     const imageUrls = await files.map((file) => {
    //         const filePath = file.path.replace(/\\/g, '/');
    //         return `${req.protocol}://${req.get('host')}/${filePath}`
    //     });

    //     return response.success("success.fileUploaded", res, { image_urls: imageUrls });
    // }

    // deleteImage = async (req, res) => {
    //     console.log('UsersController@deleteImage');

    //     try {
    //         const { image_url } = req.body;

    //         const filePath = new URL(image_url).pathname; // e.g., /uploads/images/filename.jpg
    //         const localPath = path.join(process.cwd(), filePath); // adjust path as needed

    //         if (fs.existsSync(localPath)) {
    //             fs.unlinkSync(localPath);
    //             return response.success("success.fileDeleted", res, true);
    //         } else {
    //             return response.badRequest("error.fileNotFound", res, false);
    //         }

    //     } catch (err) {
    //         return response.exception("error.invalidFileUrlToDelete", res, false);
    //     }
    // }

    // uploadImageAWS = async (req, res) => {
    //     console.log('UsersController@uploadImageAWS');

    //     return response.success("success.fileUploaded", res, { image_url: req.image_url });
    // }

    // deleteImageAWS = async (req, res) => {
    //     console.log('UsersController@deleteImage');

    //     const { image_url } = req.body;

    //     const hasDeleted = await aws.deleteFile(image_url);
    //     if(!hasDeleted){
    //         return response.badRequest("error.fileNotFound", res, false);
    //     }
    //     return response.success("success.fileDeleted", res, true);
    // }

    socialLogin = async (req, res) => {
        console.log('UsersController@socialLogin');

        let { provider, token } = req.body
        let additionalData = {
            user: {
                name: {
                    firstName: await socialLoginService.generateRandomFirstName(),
                    lastName: await socialLoginService.generateRandomLastName()
                }
            }
        }

        try {
            let socialUser = await socialLoginService.validateToken(provider, token, additionalData);
            if (!socialUser || ['expire_token', 'used_before_time', 'invalid_sign', 'invalid_token', 'invalid_after_time', 'invalid'].includes(socialUser.status_code)) {
                return response.badRequest(socialUser?.message || "error.invalidSocialToken", res, {});
            }

            // Try to find the user by email first
            let user = await UserModel.getOneByColumnNameAndValue('email', socialUser.email, { role: UserModel.roles.USER });
            if (user) {
                // Update social login info if user exists
                let token = await dataHelper.generateJWTToken({ user_id: user._id, role: user.role })

                const dataToUpdate = {
                    provider_id: socialUser.social_id,
                    provider: socialUser.provider,
                    tokens: {
                        fcm_token: req.headers['fcm-token'],
                        auth_token: token
                    }
                };
                let updatedUser = await UserModel.updateOne(user._id, dataToUpdate);

                updatedUser.active_subscription = user?.active_subscription
                const formatedUserData = await UserModel.getFormattedData(updatedUser);

                const result = {
                    token: token,
                    user: formatedUserData
                };
                return response.success("auth.loggedIn", res, result);
            }

            // If not found by email, try to find by social provider ID
            user = await UserModel.getOneByColumnNameAndValue('provider_id', socialUser.social_id);
            if (user) {
                // Update social login info if user exists
                let token = await dataHelper.generateJWTToken({ user_id: user._id, role: user.role })

                let dataToUpdate = {
                    tokens: {
                        fcm_token: req.headers['fcm-token'],
                        auth_token: token
                    }
                };

                // Update email if changed on the social provider
                if (user.email !== socialUser.email) {
                    dataToUpdate = {
                        ...dataToUpdate,
                        email: socialUser.email,
                        is_email_verified: socialUser.emailVerified
                    }
                }

                let updatedUser = await UserModel.updateOne(user._id, dataToUpdate);

                updatedUser.active_subscription = user?.active_subscription
                const formatedUserData = await UserModel.getFormattedData(updatedUser);

                const result = {
                    token: token,
                    user: formatedUserData
                };

                return response.success("auth.loggedIn", res, result);
            }

            // If user does not exist then create new user
            let password = await dataHelper.generateRandomPassword();
            let hashedPassword = await dataHelper.hashPassword(password);

            const newUserData = {
                email: socialUser.email,
                is_email_verified: !!socialUser.emailVerified,
                password: hashedPassword,
                user_info: {
                    first_name: socialUser.first_name,
                    last_name: socialUser.last_name,
                },
                profile_picture: socialUser.picture,
                provider_id: socialUser.social_id,
                provider: socialUser.provider,
                is_private_email: socialUser?.is_private_email ?? false,
                step: UserModel.steps.STEP_NAME
            };

            const newUser = await UserModel.createOne(newUserData);
            if (!newUser) {
                return response.exception("error.serverError", res, false);
            }

            let authToken = await dataHelper.generateJWTToken({ user_id: newUser._id, role: newUser.role })

            let dataToUpdate = {
                tokens: {
                    fcm_token: req.headers['fcm-token'],
                    auth_token: authToken
                }
            };

            let updatedUser = await UserModel.updateOne(newUser._id, dataToUpdate);
            //Add user's active subscription data
            let active_subscription;
            let userActiveSubscription = await SubscriptionModel.getOneByColumnNameAndValue('user_id', updatedUser._id, { status: SubscriptionModel.statuses.ACTIVE })

            if (!userActiveSubscription) {
                active_subscription = {}
            } else {
                active_subscription = userActiveSubscription
            }

            updatedUser.active_subscription = active_subscription
            const formatedUserData = await UserModel.getFormattedData(updatedUser);

            const result = {
                token: authToken,
                user: formatedUserData
            };
            return response.success("auth.loggedIn", res, result);

        } catch (error) {
            return response.badRequest("error.serverError", res, error);
        }
    }

    changeStatus = async (req, res) => {
        console.log('UsersController@changeStatus');

        /* Collect the user input  */
        const { status } = req.body;

        const user = await UserModel.getOneByColumnNameAndValue("_id", req.params.id);
        if (!user) {
            return response.badRequest("error.userNotExist", res, false);
        }

        let userData = {
            status: status
        }

        /* Insert the data into DB */
        const updatedUserObj = await UserModel.updateOne(user._id, userData);
        if (!updatedUserObj) {
            return response.exception("error.serverError", res, false);
        }

        const formatedUserData = await UserModel.getFormattedData(updatedUserObj);

        return response.created("success.statusUpdated", res, formatedUserData);
    }

    getOne = async (req, res) => {
        console.log('UsersController@getOne');

        const user = await UserModel.getOneByColumnNameAndValue("_id", req.params.id);
        if (!user) {
            return response.badRequest("error.userNotExist", res, false);
        }

        const formatedUserData = await UserModel.getFormattedData(user);

        return response.created("success.usersData", res, formatedUserData);
    }

    getHomeData = async (req, res) => {
        console.log('UsersController@getHomeData');

        const tz = req.timezone || 'UTC';
        const user = req.user;
        if (!user?.goal?.id) {
            return response.badRequest("error.goalNotFound", res, false);
        }

        const goalObj = await GoalModel.getOneByColumnNameAndValue("_id", user.goal.id);
        if (!goalObj) {
            return response.badRequest("error.goalNotFound", res, false);
        }

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

        let nutrition = goalObj?.default_nutrition;
        let targetMacros;
        if (
            (user?.nutrition_updated_at && !user?.goal_updated_at) ||
            (
                user?.nutrition_updated_at &&
                user?.goal_updated_at &&
                moment(user.nutrition_updated_at).isSameOrAfter(moment(user.goal_updated_at))
            )
        ) {
            // nutrition = {
            //     calorie_modifier: user?.meal_settings?.calories ?? goalObj?.calorie_modifier,
            //     protein_per_lb: user?.meal_settings?.protein ?? goalObj?.protein_per_lb,
            //     carbs_percent: user?.meal_settings?.carbs ?? goalObj?.carbs_percent,
            //     fat_percent: user?.meal_settings?.fats ?? goalObj?.fat_percent
            // }

            targetMacros = await dataHelper.calculateMacros(userParams, nutrition);

            targetMacros = {
                target_calories: user?.meal_settings?.calories ?? targetMacros.target_calories,
                protein_grams: user?.meal_settings?.protein ?? targetMacros.protein_grams,
                fat_grams: user?.meal_settings?.fats ?? targetMacros.fat_grams,
                carbs_grams: user?.meal_settings?.carbs ?? targetMacros.carbs_grams
            }
        }
        else {
            targetMacros = await dataHelper.calculateMacros(userParams, nutrition);
        }

        let consumedMacros = {
            consumed_calories: 0,
            protein_grams: 0,
            fat_grams: 0,
            carbs_grams: 0
        }

        /** Calculate the consumed maccros today on the basis of user meals taken today */
        const userMeals = await UserMealModel.getAll({ user_id: user._id, need_today: true, timezone: tz })

        if (userMeals?.length) {
            let totalConsumedCalories = 0;
            let totalProtein = 0;
            let totalFat = 0;
            let totalCarbs = 0;

            for (let userMeal of userMeals) {
                const mealQty = userMeal?.consumed_qty || 1;
                // const consumedCaloris = userMeal?.nutrition?.calories ? userMeal.nutrition.calories * mealQty : 0;
                // const consumedProtein = userMeal?.nutrition?.protein ? userMeal.nutrition.protein * mealQty : 0;
                // const consumedFat = userMeal?.nutrition?.fat ? userMeal.nutrition.fat * mealQty : 0;
                // const consumedCarbs = userMeal?.nutrition?.carbs ? userMeal.nutrition.carbs * mealQty : 0;

                const consumedCaloris = userMeal?.nutrition?.calories ? userMeal.nutrition.calories : 0;
                const consumedProtein = userMeal?.nutrition?.protein ? userMeal.nutrition.protein : 0;
                const consumedFat = userMeal?.nutrition?.fat ? userMeal.nutrition.fat : 0;
                const consumedCarbs = userMeal?.nutrition?.carbs ? userMeal.nutrition.carbs : 0;

                totalConsumedCalories = totalConsumedCalories + consumedCaloris;
                totalProtein = totalProtein + consumedProtein;
                totalFat = totalFat + consumedFat;
                totalCarbs = totalCarbs + consumedCarbs;
            }

            consumedMacros = {
                ...consumedMacros,
                consumed_calories: totalConsumedCalories,
                protein_grams: totalProtein,
                fat_grams: totalFat,
                carbs_grams: totalCarbs
            }
        }

        let streakObj = await UserStreakModel.getOneByColumnNameAndValue({ user_id: user._id });

        if (!streakObj) {
            // Return 0 if no record exists yet
            streakObj = {
                streak_count: 0,
                // milestone_count: 0,
                last_completed_date: null
            }
        }
        else {
            const formattedData = await UserStreakModel.getFormattedData(streakObj, tz);
            streakObj = formattedData;
        }

        // Check whether the user has any customized daily workouts; if so, verify the workout date and delete it if the date is earlier than today.
        const userFitnessPlan = await UserModel.getFitnessPlan(req.user._id);
        const customizedPlan = userFitnessPlan?.weekly_fitness_plan?.customized_plan || [];
        if (customizedPlan.length) {
            const today = moment().tz(tz).endOf('day').format('YYYY-MM-DD');

            const filteredPlan = customizedPlan.filter(
                item => !item.date || item.date >= today
            );

            if (filteredPlan.length !== customizedPlan.length) {
                await UserModel.upsertFitnessPlan(
                    req.user._id, 
                    {
                        'weekly_fitness_plan.customized_plan': filteredPlan
                    }
                );
            }
        }

        const result = {
            target_macros: targetMacros,
            consume_macros: consumedMacros,
            streak_data: streakObj
        }

        return response.success("success.usersData", res, result);
    }

    getFitnessPlan = async (req, res) => {
        console.log('UsersController@getFitnessPlan');

        const user = req.user;

        let userFitnessPlan = await UserModel.getFitnessPlan(user._id);
        let result = {
            weekly_fitness_plan: userFitnessPlan?.weekly_fitness_plan || user.weekly_fitness_plan
        };

        return response.success("success.userFitnessPlan", res, result);
    }

    /** Start Stripe Functions */
    getStripeConnectUrl = async (req, res) => {
        console.log('UsersController@getStripeConnectUrl');

        const user = req.user;
        let stripeAccountId = user.stripe_account_id;

        if (stripeAccountId) {
            // VALIDATION: Check if this ID is associated with our current Stripe Keys
            const validation = await stripeService.validateAccountOwnership(stripeAccountId);

            if (!validation.isValid) {
                console.log("Existing Stripe ID is invalid for these keys. Resetting...");
                stripeAccountId = null; // Force creation of a new valid account
            }
        }

        // 1. Create account if it doesn't exist
        if (!stripeAccountId) {
            const userEmail = user.email || `user_${user._id}@yopmail.com`
            const { data, status, message } = await stripeService.createConnectAccount(userEmail);
            if (!status) {
                return response.exception(message || "error.unableToGenerateUrl", res, false);
            }
            stripeAccountId = data.id;

            await UserModel.updateOne(user._id, { stripe_account_id: stripeAccountId });
        }

        // 2. Generate the onboarding URL
        const clientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`
        const { status, message, url } = await stripeService.createOnboardingLink(stripeAccountId, clientUrl);
        if (!status) {
            return response.exception(message || "error.unableToGenerateUrl", res, false);
        }

        return response.success("success.onboardingUrl", res, { url: url });
    }

    verifyStripeConnect = async (req, res) => {
        console.log('UsersController@verifyStripeConnect');

        const user = req.user;
        const stripeAccountId = user.stripe_account_id;
        let accountStatus;

        // 1. Initial Check
        if (stripeAccountId) {
            accountStatus = await stripeService.getAccountStatus(stripeAccountId);
        }

        if (!accountStatus) {
            return response.success("success.onboardingStatus", res, { on_boarding_status: false });
        }

        // 2. Retry Logic: If status is false, wait 5 seconds and check one more time
        if (!accountStatus?.transfer_status) {
            console.log("Transfer status false, retrying in 3 seconds...");
            
            // Helper to pause execution
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            accountStatus = await stripeService.getAccountStatus(stripeAccountId);
        }

        // 3. Update Database with the latest status
        await UserModel.updateOne(
            { _id: user._id }, 
            { stripe_onboarding_status: accountStatus.transfer_status }
        );

        return response.success("success.onboardingStatus", res, { 
            on_boarding_status: accountStatus.transfer_status,
            due_informations: accountStatus.due_informations
        });
    }

    handleStripeWebhook = async (req, res) => {
        console.log('UsersController@handleStripeWebhook');

        const sign = req.headers['stripe-signature'];
        let event;

        try {
            // We pass req.body (which is a Buffer because of express.raw)
            event = await stripeService.constructEvent(req.body, sign);
        } catch (err) {
            console.error(`❌ Webhook Error: ${err.message}`);
            return response.badRequest(`Webhook Error: ${err.message}`, res, false);
        }

        // This event triggers when the user's account status changes
        if (event.type === 'account.updated') {
            const account = event.data.object;
            // console.log(account, '=====account');
            const userObj = await UserModel.getOneByColumnNameAndValue("stripe_account_id", account.id);
            if (userObj) {
                await UserModel.updateOne(userObj._id, {
                    stripe_onboarding_status: account.details_submitted && account.charges_enabled
                });
            }
            console.log(`User Account ${account.id} updated.`);
        }

        return response.success("Recieved", res, { received: true });
    }
    /** End Stripe Functions */

    getLeaderBoardUsers = async (req, res) => {
        console.log('UsersController@getLeaderBoardUsers');

        let timezone = req.timezone;
        const users = await UserTokensModel.getLeaderboardUsers(timezone);
        if (!users?.length) {
            return response.success("success.noRecordsFound", res, []);
        }

        return response.success("success.leaderboardList", res, users);
    }

    getReferralSummary = async (req, res) => {
        console.log('UsersController@getReferralSummary');

        const user = req.user;
        
        // Count of the users join by logged in user's referral code
        let friendsJoinedCount = await UserModel.countUsers('referred_by', user._id);
        const totalEarnings = user.paid_referrer_amount || 0;

        const referralRanks = ReferralTrackModel.ranks;
        let currentRank = referralRanks[0].key; // By default bronze rank 

        const rankMilestones = referralRanks.map(rank => {

            if (
                friendsJoinedCount >= rank.min_referrals &&
                friendsJoinedCount <= rank.max_referrals
            ) {
                currentRank = rank.key;
            }

            return {
                rank_key: rank.key,
                title: rank.title,
                min_referrals: rank.min_referrals,
                max_referrals: rank.max_referrals === Infinity ? null : rank.max_referrals,
            };
        });

        const result = {
            total_earnings: totalEarnings,
            friends_joined_count: friendsJoinedCount,
            rank: currentRank,
            rank_milestones: rankMilestones
        };

        return response.success("success.referralSummary", res, result);
    }

    getReferralHistory = async (req, res) => {
        console.log('UsersController@getReferralHistory');

        const user = req.user;
        const { type = "invite_sent" } = req.query;  // By default invites_sent

        const totalEarnings = user.paid_referrer_amount || 0;
        let result = {
            total_earnings: totalEarnings,
            referrer: {},
            referrals: [],
            reward: {}
        };

        if (type === "invite_sent") {
            const users = await UserModel.getAllUsersByCondition('referred_by', user._id);
            result.referrals = await Promise.all(users.map(users => UserModel.getFormattedData(users)));
        } 
        else if (type === "invite_received" && user.referred_by) {
            const referrer = await UserModel.getOneByColumnNameAndValue('_id', user.referred_by);
            result.referrer = referrer ? await UserModel.getFormattedData(referrer) : {};

            const filterObj = {
                reward_type: ReferralTrackModel.rewardTypes.REFERRAL
            }

            const referral = await ReferralTrackModel.getOneByColumnNameAndValue('user_id', user._id, filterObj);
            if (referral) {
                result.reward = {
                    amount: referral.reward_amount,
                    reward_status: referral.reward_status
                };
            }
        }

        return response.success("success.referralHistory", res, result);
    }

    withdrawReferralAmount = async (req, res) => {
        console.log('UsersController@withdrawReferralAmount');

        const user = req.user;

        const filterObj = {
            reward_type: ReferralTrackModel.rewardTypes.REFERRAL,
            reward_status: ReferralTrackModel.statuses.ELIGIBLE
        }
        const referral = await ReferralTrackModel.getOneByColumnNameAndValue('user_id', user._id, filterObj);
        if(!referral?.reward_amount){
            return response.error("error.referralNotEligible", res, false);
        }

        if(!user.stripe_account_id){
            return response.badRequest("error.stripeAccountNotConnected", res, false);
        }

        if(!user.stripe_onboarding_status){
            return response.badRequest("error.withdrawalNotEligible", res, false);
        }
        
        // Check Stripe balance before transfer
        const amountToPayout = Number(referral.reward_amount);
        const { availableBalance: adminAvailableBalance } = await stripeService.getAdminAccountBalance();
        let adminAvailableBalanceUSD = adminAvailableBalance?.amount ? adminAvailableBalance.amount / 100 : 0; // Converted cents into dollars
        
        if (adminAvailableBalanceUSD < amountToPayout) {
            return response.badRequest("error.insufficientBalance", res, false);
        }

        // Execute the transfer
        const payoutResult = await stripeService.createPayout(amountToPayout, user.stripe_account_id);
        if (!payoutResult || !payoutResult.success) {
            // Transfer failed — mark records with payout error status
            const errorMsg = payoutResult?.error || 'Unknown transfer error';
            return response.badRequest(errorMsg, res, false);
        }

        // Success — update referral track records to 'paid'
        await ReferralTrackModel.updateOne(referral._id, 
            {
                reward_status: ReferralTrackModel.statuses.PAID,
                payout_status: PayoutsModel.PayoutStatuses.PAID
            }
        );

        // Create a payout entry in payouts collection
        await PayoutsModel.createOne({
            user_id: user._id,
            referral_track_ids: referral._id,
            amount: amountToPayout,
            currency: 'USD',
            status: PayoutsModel.PayoutStatuses.PAID,
            processed_at: new Date(),
            transaction_reference: payoutResult?.transfer?.id || ''
        });
        
        // Update the referrer's balance in the users collection
        await UserModel.updateOne(
            { _id: user._id },
            {
                $inc: {
                    paid_referral_amount: amountToPayout,
                }
            }
        );
        
        return response.success("success.amountTransferedToStripe", res, true);
    }

}

module.exports = new UserController;
