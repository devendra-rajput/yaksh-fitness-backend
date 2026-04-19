const Joi = require('joi').extend(require('@joi/date'));

/** Custom Require **/

const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const ReferralTrackModel = require('../referral_track/referral_tracks.model');
const UserModel = require('./users.model');

class UserValidation {

    /** Validate the create user data **/
    createOne = async (req, res, next) => {
        console.log('UsersValidation@createOne');

        let schema = {
            // first_name: Joi.string().optional(),
            // last_name: Joi.string().optional(),
            email: Joi.string().email().optional(),
            phone_number: Joi.number().when('email', {
                is: Joi.exist(),
                then: Joi.number().optional(),
                otherwise: Joi.number().required()
            }),
            phone_code: Joi.string().when('phone_number', {
                is: Joi.exist(),
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
            password: Joi.string().required(),
            confirm_password: Joi.string().required(),
            referral_code: Joi.string().optional()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        let passwordCheck = await dataHelper.checkPasswordRegex(req.body.password);
        if (!passwordCheck) {
            return response.validationError('validation.strongPassword', res, false);
        }

        if (req.body.password !== req.body.confirm_password) {
            return response.validationError('validation.confirmPasswordNotMatch', res, false);
        }

        next();
    }

    /** Validate the resend-otp request **/
    resendOtp = async (req, res, next) => {
        console.log('UsersValidation@resendOtp');

        let schema = {
            email: Joi.string().email().optional(),
            phone_number: Joi.number().when('email', {
                is: Joi.exist(),
                then: Joi.number().optional(),
                otherwise: Joi.number().required()
            }),
            phone_code: Joi.string().when('phone_number', {
                is: Joi.exist(),
                then: Joi.string().required(),
                otherwise: Joi.string().optional()
            })
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    /** Validate the otp verification request **/
    verifyOtp = async (req, res, next) => {
        console.log('UsersValidation@verifyOtp');

        let schema = {
            email: Joi.string().email().optional(),
            phone_number: Joi.number().when('email', {
                is: Joi.exist(),
                then: Joi.number().optional(),
                otherwise: Joi.number().required()
            }),
            phone_code: Joi.string().when('phone_number', {
                is: Joi.exist(),
                then: Joi.string().required(),
                otherwise: Joi.string().optional()
            }),
            otp: Joi.number().integer().required()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    /** Validate the update user data **/
    updateOne = async (req, res, next) => {
        console.log('UsersValidation@updateOne');

        if (!req.params.id) {
            return response.validationError("validation.userIdRequired", res, false);
        }

        const isValidMongoDBId = await dataHelper.isValidMongoDBId(req.params.id);
        if (!isValidMongoDBId) {
            return response.validationError("validation.invalidId", res, false);
        }

        let schema = {
            first_name: Joi.string().optional().allow(""),
            last_name: Joi.string().optional().allow(""),
            email: Joi.string().email().optional().allow(""),
            dob: Joi.date().format("YYYY-MM-DD").optional(),
            image_url: Joi.string().optional().allow(""),
            experience_level: Joi.string().valid(...Object.values(UserModel.experienceLevels)).optional().allow(""),
            preferred_training_location: Joi.string().valid(...Object.values(UserModel.trainingLocations)).optional().allow(""),
            track_nutrition: Joi.string().valid(...Object.values(UserModel.trackNutrition)).optional().allow(""),
            available_equipments: Joi.string().optional().allow(""),
            results_speed_pref: Joi.string().valid(...Object.values(UserModel.resultsSpeedPref)).optional().allow(""),
            activity: Joi.string().optional().allow(""),
            goal_id: Joi.string().optional().allow(""),
            age: Joi.number().optional(),
            weight: Joi.number().optional(),
            weight_unit: Joi.string().valid(UserModel.weightUnits.KG, UserModel.weightUnits.LB).optional(),
            height: Joi.number().optional(),
            height_unit: Joi.string().valid(UserModel.heightUnits.CM, UserModel.heightUnits.FT, UserModel.heightUnits.IN).optional(),
            gender: Joi.string().valid(UserModel.genders.MALE, UserModel.genders.FEMALE).optional(),
            step: Joi.string()
                .valid(...Object.values(UserModel.steps))
                .optional()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        if (req.body?.password) {
            let passwordCheck = await dataHelper.checkPasswordRegex(req.body.password);
            if (!passwordCheck) {
                return response.validationError('validation.strongPassword', res, false);
            }

            if (req.body.password !== req.body.confirm_password) {
                return response.validationError('validation.confirmPasswordNotMatch', res, false);
            }
        }

        next();
    }

    /** Validate the update lab data **/
    updateLabData = async (req, res, next) => {
        console.log('UsersValidation@updateLabData');

        if (!req.params.id) {
            return response.validationError("validation.userIdRequired", res, false);
        }

        const isValidMongoDBId = await dataHelper.isValidMongoDBId(req.params.id);
        if (!isValidMongoDBId) {
            return response.validationError("validation.invalidId", res, false);
        }

        let schema = {
            workout_settings: Joi.object().keys({
                workout_time: Joi.number().integer().optional().allow(""), // 15 / 30 / 45 / 60 / 90 min (in minutes)
                days_per_week: Joi.number().integer().optional().allow(""), //  1 / 2/ 3 / 4 / 5 / 6 / 7
                experience_level: Joi.string().valid(UserModel.experienceLevels.BEGINNER, UserModel.experienceLevels.INTERMEDIATE, UserModel.experienceLevels.ADVANCED).optional().allow(""), // Beginner / Intermediate / Advanced
                goal_id: Joi.string().optional().allow(""),
                available_equipments: Joi.array().optional().items(
                    Joi.string().optional()
                ),
                training_preferences: Joi.array().optional().items(
                    Joi.string().optional()
                ),
                variability: Joi.string().valid(UserModel.variabilities.LOW, UserModel.variabilities.MEDIUM, UserModel.variabilities.HIGH).optional().allow(""), // Low / Medium / High
                cardio: Joi.boolean().optional(),
                warm_up: Joi.boolean().optional(),
                cool_down: Joi.boolean().optional(),
                activity: Joi.string().optional().allow("")
            }),
            meal_settings: Joi.object().keys({
                calories: Joi.string().optional().allow(""),
                protein: Joi.string().optional().allow(""),
                carbs: Joi.string().optional().allow(""),
                fats: Joi.string().optional().allow(""),
                meals_per_day: Joi.string().valid("1", "2", "3", "4", "5", "6").optional().allow(""), // 1 / 2 / 3 / 4 / 5 / 6
                diet_style: Joi.string().optional().allow(""),
                exclude_gluten: Joi.boolean().optional(),
                exclude_dairy: Joi.boolean().optional(),
                exclude_nuts: Joi.boolean().optional(),
                exclude_soy: Joi.boolean().optional(),
                exclude_shellfish: Joi.boolean().optional(),
                exclude_eggs: Joi.boolean().optional(),
                dislike_foods: Joi.array().optional().items(
                    Joi.string().optional()
                ),
                meal_style_preferences: Joi.string().valid("On-the-Go", "Meal Prep Friendly", "Budget Friendly").optional().allow(""),
                cooking_skill: Joi.string().valid(UserModel.cookingSkills.BEGINNER, UserModel.cookingSkills.INTERMEDIATE, UserModel.cookingSkills.ADVANCED).optional().allow(""),
                intermittent_fasting: Joi.string().valid("Off", "12:12", "14:10", "16:8").optional().allow(""),
                post_workout_emphasis: Joi.boolean().optional(),
                late_night_carbs: Joi.string().valid("Allow", "Reduce After 8 PM").optional().allow(""),
                cuisines: Joi.array().optional().items(
                    Joi.string().optional()
                ),
                spice_tolerance: Joi.string().valid(UserModel.spiceTolerances.LOW, UserModel.spiceTolerances.MEDIUM, UserModel.spiceTolerances.HIGH).optional().allow(""), // Low / Medium / High
                sweeteners: Joi.string().valid("Allow", "Avoid").optional().allow(""),
                alcohol_policy: Joi.string().valid("None", "1-2 Drinks Weekends").optional().allow("")
            })
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    /** Validate the user login data **/
    userLogin = async (req, res, next) => {
        console.log('UsersValidation@userLogin');

        let schema = {
            email: Joi.string().email().optional(),
            phone_number: Joi.number().when('email', {
                is: Joi.exist(),
                then: Joi.number().optional(),
                otherwise: Joi.number().required()
            }),
            phone_code: Joi.string().when('phone_number', {
                is: Joi.exist(),
                then: Joi.string().required(),
                otherwise: Joi.string().optional()
            }),
            password: Joi.string().required()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    /** Validate the change password request **/
    changePassword = async (req, res, next) => {
        console.log('UsersValidation@changePassword');

        let schema = {
            old_password: Joi.string().required(),
            new_password: Joi.string().required(),
            confirm_new_password: Joi.string().required(),
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        let passwordCheck = await dataHelper.checkPasswordRegex(req.body.new_password);
        if (!passwordCheck) {
            return response.validationError('validation.strongPassword', res, false);
        }

        if (req.body.new_password !== req.body.confirm_new_password) {
            return response.validationError('validation.confirmPasswordNotMatch', res, false);
        }

        if (req.body.new_password == req.body.old_password) {
            return response.validationError('validation.newAndOldPasswordSame', res, false);
        }

        /** Validate the old password */
        const isOldPasswordValid = await dataHelper.validatePassword(req.body.old_password, req.user.password);
        if (!isOldPasswordValid) {
            return response.badRequest("validation.invalidOldPassword", res, false);
        }

        next();
    }

    /** Validate the forgot password request **/
    forgotPassword = async (req, res, next) => {
        console.log("UsersValidation@forgotPassword");

        let schema = {
            email: Joi.string().email().optional(),
            phone_number: Joi.number().when('email', {
                is: Joi.exist(),
                then: Joi.number().optional(),
                otherwise: Joi.number().required()
            }),
            phone_code: Joi.string().when('phone_number', {
                is: Joi.exist(),
                then: Joi.string().required(),
                otherwise: Joi.string().optional()
            })
        };

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    };

    /** Validate the forgot password OTP verification request **/
    verifyForgotPasswordOTP = async (req, res, next) => {
        console.log("UsersValidation@verifyForgotPasswordOTP");

        let schema = {
            email: Joi.string().email().optional(),
            phone_number: Joi.number().when('email', {
                is: Joi.exist(),
                then: Joi.number().optional(),
                otherwise: Joi.number().required()
            }),
            phone_code: Joi.string().when('phone_number', {
                is: Joi.exist(),
                then: Joi.string().required(),
                otherwise: Joi.string().optional()
            }),
            otp: Joi.number().integer().required(),
        };

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    };

    /** Validate the reset password request **/
    resetPassword = async (req, res, next) => {
        console.log("UsersValidation@resetPassword");

        let schema = {
            password: Joi.string().required(),
            confirm_password: Joi.string().required(),
            user_id: Joi.string().required()
        };

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        let passwordCheck = await dataHelper.checkPasswordRegex(req.body.password);
        if (!passwordCheck) {
            return response.validationError("validation.strongPassword", res, false);
        }

        if (req.body.password !== req.body.confirm_password) {
            return response.validationError("validation.confirmPasswordNotMatch", res, false);
        }

        next();
    };

    // /** Validate the delete image data **/
    // deleteImage = async (req, res, next) => {
    //     console.log('UsersValidation@deleteImage');

    //     let schema = {
    //         image_url: Joi.string().uri().required()
    //     }

    //     let errors = await dataHelper.joiValidation(req.body, schema);
    //     if (errors?.length) {
    //         return response.validationError(errors[0], res, errors);
    //     }

    //     next();
    // }

    // /** Validate the delete image data **/
    // deleteImageAWS = async (req, res, next) => {
    //     console.log('UsersValidation@deleteImageAWS');

    //     let schema = {
    //         image_url: Joi.string().uri().required()
    //     }

    //     let errors = await dataHelper.joiValidation(req.body, schema);
    //     if (errors?.length) {
    //         return response.validationError(errors[0], res, errors);
    //     }
    //     next();
    // }

    /** Validate the change status data **/
    changeStatus = async (req, res, next) => {
        console.log('UsersValidation@changeStatus');

        if (!req.params.id) {
            return response.validationError("validation.userIdRequired", res, false);
        }

        const isValidMongoDBId = await dataHelper.isValidMongoDBId(req.params.id);
        if (!isValidMongoDBId) {
            return response.validationError("validation.invalidId", res, false);
        }

        let schema = {
            status: Joi.string()
                .valid(UserModel.statuses.IN_ACTIVE, UserModel.statuses.ACTIVE, UserModel.statuses.BLOCKED)
                .required()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    /** Validate the get one data **/
    getOne = async (req, res, next) => {
        console.log('UsersValidation@getOne');

        if (!req.params.id) {
            return response.validationError("validation.userIdRequired", res, false);
        }

        const isValidMongoDBId = await dataHelper.isValidMongoDBId(req.params.id);
        if (!isValidMongoDBId) {
            return response.validationError("validation.invalidId", res, false);
        }

        next();
    }

    socialLogin = async (req, res, next) => {
        console.log("UsersValidation@socialLogin");

        let schema = {
            token: Joi.string().required(),
            provider: Joi.string().valid('google', 'apple').required()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next()
    }

    updateReferralsCount = async (req, res, next) => {
        console.log('UsersValidation@updateReferralsCount');

        let schema = {
            referrals_sent_count: Joi.number().integer().required()
        }

        let errors = await dataHelper.joiValidation(req.body, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

    getReferralHistory = async (req, res, next) => {
        console.log('UsersValidation@getReferralHistory');

        let schema = {
            type: Joi.string().valid("invite_sent", "invite_received").optional()
        }

        let errors = await dataHelper.joiValidation(req.query, schema);
        if (errors?.length) {
            return response.validationError(errors[0], res, errors);
        }

        next();
    }

}

module.exports = new UserValidation;
