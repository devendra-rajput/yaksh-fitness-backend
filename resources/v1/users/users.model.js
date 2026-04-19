/** Custom Require **/
const mongoose = require("mongoose");
const User = require('./user.schema');
const UserFitnessPlan = require('./user_fitness_plan.schema');
const dataHelper = require('../../../helpers/v1/data.helpers');
const SubscriptionModel = require('../subscriptions/subscriptions.model')

const IN_ACTIVE = '0';
const ACTIVE = '1';
const BLOCKED = '2';
const DELETED = '3';
const statuses = Object.freeze({
    IN_ACTIVE,
    ACTIVE,
    BLOCKED,
    DELETED
});

const USER = 'user';
const ADMIN = 'admin';
const roles = Object.freeze({
    USER,
    ADMIN
});

const MALE = 'Male';
const FEMALE = 'Female';
const genders = Object.freeze({
    MALE,
    FEMALE
});

const KG = 'Kgs';
const LB = 'Lbs';
const weightUnits = Object.freeze({
    KG,
    LB
});

const CM = 'cm';
const FT = 'ft';
const IN = 'in';
const heightUnits = Object.freeze({
    CM,
    FT,
    IN
});

const STEP_NAME = '1';
const STEP_FITNESS_EXPERIENCE = '2';
const STEP_LOOPING_VIDEO = '3';
const STEP_TRAINING_LOCATION = '4'; // Gym, Home, Both, Outdoor, Other
const STEP_EQUIPMENT_ACCESS = '5';
const STEP_RESULTS_SPEED = '6';
const STEP_3D_BODY_SCAN = '7';
const STEP_TRACK_NUTRITION = '8';
const STEP_TRANSFORMATION = '9';
const STEP_ACTIVE = '10';
const STEP_GOAL = '11';
const STEP_STORY_BEGINS = '12';
const STEP_AGE = '13';
const STEP_HEIGHT = '14';
const STEP_WEIGHT = '15';
const STEP_GENDER = '16';
const STEP_LOOPING_VIDEO_2 = '17';
const STEP_SUBSCRIBE = '18';
const steps = Object.freeze({
    STEP_NAME,
    STEP_FITNESS_EXPERIENCE,
    STEP_LOOPING_VIDEO,
    STEP_TRAINING_LOCATION,
    STEP_EQUIPMENT_ACCESS,
    STEP_RESULTS_SPEED,
    STEP_3D_BODY_SCAN,
    STEP_TRACK_NUTRITION,
    STEP_TRANSFORMATION,
    STEP_ACTIVE,
    STEP_GOAL,
    STEP_STORY_BEGINS,
    STEP_AGE,
    STEP_HEIGHT,
    STEP_WEIGHT,
    STEP_GENDER,
    STEP_LOOPING_VIDEO_2,
    STEP_SUBSCRIBE
});

const BEGINNER = 'Beginner';
const INTERMEDIATE = 'Intermediate';
const ADVANCED = 'Advanced';
const experienceLevels = Object.freeze({ BEGINNER, INTERMEDIATE, ADVANCED });
const cookingSkills = Object.freeze({ BEGINNER, INTERMEDIATE, ADVANCED });

const LOW = 'Low';
const MEDIUM = 'Medium';
const HIGH = 'High';
const variabilities = Object.freeze({ LOW, MEDIUM, HIGH });
const spiceTolerances = Object.freeze({ LOW, MEDIUM, HIGH });

const FULL_GYM = 'Full Gym';
const SMALL_GYM = 'Small Gym';
const HOME_GYM = 'Home Gym';
const NO_EQUIPMENT = 'No Equipment';
const OTHER = 'Other';
const trainingLocations = Object.freeze({ FULL_GYM, SMALL_GYM, HOME_GYM, NO_EQUIPMENT, OTHER });

const GRADUAL = 'Gradual';
const FAST = 'Fast';
const resultsSpeedPref = Object.freeze({ GRADUAL, FAST });

const AUTOMATIC = 'Automatic';
const MANUAL = 'Manual';
const NOT_SURE = 'Not Sure';
const trackNutrition = Object.freeze({ AUTOMATIC, MANUAL, NOT_SURE });

class UserModel {

    constructor() {
        this.roles = roles;
        this.statuses = statuses;
        this.steps = steps;
        this.genders = genders;
        this.weightUnits = weightUnits;
        this.heightUnits = heightUnits;
        this.experienceLevels = experienceLevels;
        this.variabilities = variabilities;
        this.cookingSkills = cookingSkills;
        this.spiceTolerances = spiceTolerances;
        this.trainingLocations = trainingLocations;
        this.resultsSpeedPref = resultsSpeedPref;
        this.trackNutrition = trackNutrition;
    }

    createOne = async (data) => {
        console.log('UsersModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            // Insert the user data 
            let user = await User.create(data);
            if (!user) {
                return false;
            }

            return user;

        } catch (error) {
            console.log("Error UserModel@createOne: ", error);
            return false;
        }

    }

    // getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
    //     console.log('UsersModel@getOneByColumnNameAndValue');

    //     try {
    //         let dbQuery = {
    //             [columnName]: columnValue,
    //             deleted_at: {
    //                 $in: [null, '', ' ']
    //             } // Check for null, empty string, or space
    //         }

    //         if(filterObj?.role){
    //             dbQuery = {
    //                 ...dbQuery,
    //                 role: filterObj.role
    //             }
    //         }

    //         let result = await User.findOne(dbQuery)
    //                                 .collation({ locale: 'en', strength: 2 });    
    //         if (!result) {
    //             return false;
    //         }

    //         return result;

    //     } catch (error) {
    //         console.log("Error UserModel@getOneByColumnNameAndValue: ", error);
    //         return false;
    //     }
    // }

    getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
        console.log('UsersModel@getOneByColumnNameAndValue');

        // try {

            let dbQuery = {
                deleted_at: { $in: [null, '', ' '] }
            };

            if (columnName === '_id') {
                // If already ObjectId → use as-is
                if (columnValue instanceof mongoose.Types.ObjectId) {
                    dbQuery._id = columnValue;

                    // If string → validate and then convert
                } else if (
                    typeof columnValue === 'string' &&
                    dataHelper.isValidMongoDBId(columnValue)
                ) {
                    dbQuery._id = new mongoose.Types.ObjectId(columnValue);
                } else {
                    return false;
                }

            } else {
                dbQuery[columnName] = columnValue;
            }

            if (filterObj?.role) {
                dbQuery = {
                    ...dbQuery,
                    role: filterObj.role
                }
            }

            const result = await User.aggregate([
                {
                    $match: dbQuery
                },
                // 1. Convert String IDs to ObjectIds so $lookup works properly
                // {
                //     $set: {
                //         "workout_settings.available_equipments": {
                //             $map: {
                //                 input: { $ifNull: ["$workout_settings.available_equipments", []] },
                //                 as: "id",
                //                 in: { $toObjectId: "$$id" }
                //             }
                //         }
                //     }
                // },
                {
                    $set: {
                        "workout_settings.available_equipments": {
                            $filter: {
                                input: "$workout_settings.available_equipments",
                                as: "id",
                                cond: { $ne: ["$$id", null] }
                            }
                        }
                    }
                },
                // 2. Lookup equipment names
                {
                    $lookup: {
                        from: "equipments",
                        let: { 
                            // Use $ifNull to provide a fallback empty array
                            equipmentIds: { $ifNull: ["$workout_settings.available_equipments", []] } 
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $in: ["$_id", "$$equipmentIds"] }
                                }
                            },
                            { 
                                $project: { _id: 1, title: 1 } 
                            }
                        ],
                        as: "workout_settings.available_equipments_detail"
                    }
                },
                // 3. Existing Subscription lookup
                {
                    $lookup: {
                        from: "subscriptions",
                        let: { userId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$user_id", "$$userId"] },
                                            { $eq: ["$status", SubscriptionModel.statuses.ACTIVE] },
                                            {
                                                $gt: [
                                                    { $toDate: "$current_period_end" },
                                                    "$$NOW"
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            { $sort: { current_period_end: -1 } },
                            { $limit: 1 }
                        ],
                        as: "active_subscription"
                    }
                },
                {
                    $unwind: {
                        path: "$active_subscription",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $addFields: {
                        active_subscription: {
                            $ifNull: ["$active_subscription", {}]
                        }
                    }
                },
                { $limit: 1 }
            ]).collation({ locale: 'en', strength: 2 });

            return result[0] || false;

        // } catch (error) {
        //     console.log("Error UserModel@getOneByColumnNameAndValue: ", error);
        //     return false;
        // }
    }

    getOneByPhoneCodeAndNumber = async (phoneCode, phoneNumber) => {
        console.log('UsersModel@getOneByPhoneCodeAndNumber');

        try {
            let result = await User.findOne({
                phone_code: phoneCode,
                phone_number: phoneNumber,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            })
                .collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error UserModel@getOneByPhoneCodeAndNumber: ", error);
            return false;
        }

    }

    isUserExist = async (columnName, columnValue, userId = false) => {
        console.log('UsersModel@isUserExist');

        try {
            let query = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            if (userId) {
                query = {
                    ...query,
                    _id: {
                        $ne: userId
                    }
                }
            }
            let usersCount = await User.countDocuments(query).collation({ locale: 'en', strength: 2 });
            if (!usersCount || usersCount <= 0) {
                return false;
            }

            return true;

        } catch (error) {
            console.log("Error UserModel@isUserExist: ", error);
            return false;
        }
    }

    isPhoneNumberExist = async (phoneCode, phoneNumber, userId = false) => {
        console.log('UsersModel@isPhoneNumberExist');

        try {
            let query = {
                phone_code: phoneCode,
                phone_number: phoneNumber,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            if (userId) {
                query = {
                    ...query,
                    _id: {
                        $ne: userId
                    }
                }
            }
            let usersCount = await User.countDocuments(query).collation({ locale: 'en', strength: 2 });
            if (!usersCount || usersCount <= 0) {
                return false;
            }

            return true;

        } catch (error) {
            console.log("Error UserModel@isPhoneNumberExist: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('UsersModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let user = await User.findByIdAndUpdate(id, data, { new: true })
            if (!user) {
                return false;
            }

            return user;

        } catch (error) {
            console.log("Error UserModel@updateOne: ", error);
            return false;
        }
    }

    getFitnessPlan = async (userId) => {
        console.log('UsersModel@getFitnessPlan');

        try {
            if ((!userId || userId === '')) {
                return false;
            }

            let userFitnessPlan = await UserFitnessPlan.findOne({ user_id: userId }).collation({ locale: 'en', strength: 2 });
            if (!userFitnessPlan) {
                return false;
            }

            return userFitnessPlan;

        } catch (error) {
            console.log("Error UserModel@getFitnessPlan: ", error);
            return false;
        }
    }

    upsertFitnessPlan = async (userId, data) => {
        console.log('UsersModel@upsertFitnessPlan');

        try {
            if ((!userId || userId === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            const update = { 
                $set: data,
                $setOnInsert: {
                    user_id: userId
                } 
            };

            let userFitnessPlan = await UserFitnessPlan.findOneAndUpdate(
                { user_id: userId },
                update, 
                { 
                    new: true,      // Return the updated/newly created document
                    upsert: true,   // Create the document if it doesn't exist
                }
            )
            if (!userFitnessPlan) {
                return false;
            }

            return userFitnessPlan;

        } catch (error) {
            console.log("Error UserModel@upsertFitnessPlan: ", error);
            return false;
        }
    }

    updateCustomizedPlanDay = async (userId, customizedPlanData, existingFitnessPlan = false) => {
        console.log('UsersModel@updateCustomizedPlanDay');

        try {
            let userFitnessPlanObj = await UserFitnessPlan.findOne({ user_id: userId }).collation({ locale: 'en', strength: 2 });
            if (!userFitnessPlanObj) {
                // To handle the case of previous live users
                if(!existingFitnessPlan){
                    userFitnessPlanObj = await UserFitnessPlan.create(
                        {
                            user_id: userId,
                            weekly_fitness_plan: {
                                customized_plan: [customizedPlanData]
                            }
                        }
                    );
                    return userFitnessPlanObj || false;
                }
                else {
                    userFitnessPlanObj = await UserFitnessPlan.create(
                        {
                            user_id: userId,
                            weekly_fitness_plan: existingFitnessPlan
                        }
                    );
                }

            }

            // Remove the day if it exists to avoid duplicates
            await UserFitnessPlan.findByIdAndUpdate(
                userFitnessPlanObj._id, 
                {
                    $pull: { 'weekly_fitness_plan.customized_plan': { day: customizedPlanData.day } }
                }
            );

            // Push the new day data
            let result = await UserFitnessPlan.findByIdAndUpdate(
                userFitnessPlanObj._id,
                { $push: { 'weekly_fitness_plan.customized_plan': customizedPlanData } },
                { new: true }
            );
            return result || false;
        } catch (error) {
            console.log("Error UserModel@updateCustomizedPlanDay: ", error);
            return false;
        }
    }

    updateWeeklyWorkoutPlanDay = async (userId, updatedExerciseData, existingFitnessPlan = false) => {
        console.log('UsersModel@updateWeeklyWorkoutPlanDay');

        try {
            let userFitnessPlanObj = await UserFitnessPlan.findOne({ user_id: userId }).collation({ locale: 'en', strength: 2 });
            if (!userFitnessPlanObj) {
                // To handle the case of previous live users
                if(!existingFitnessPlan){
                    userFitnessPlanObj = await UserFitnessPlan.create(
                        {
                            user_id: userId,
                            weekly_fitness_plan: {
                                weekly_schedule: [updatedExerciseData]
                            }
                        }
                    );
                    return userFitnessPlanObj || false;
                }
                else {
                    userFitnessPlanObj = await UserFitnessPlan.create(
                        {
                            user_id: userId,
                            weekly_fitness_plan: existingFitnessPlan
                        }
                    );
                }
                
            }

            // Remove the day if it exists to avoid duplicates
            await UserFitnessPlan.findByIdAndUpdate(
                userFitnessPlanObj._id,
                {
                    $pull: { 'weekly_fitness_plan.weekly_schedule': { day: updatedExerciseData.day } }
                }
            );

            // Push the new day data
            let result = await UserFitnessPlan.findByIdAndUpdate(
                userFitnessPlanObj._id,
                { $push: { 'weekly_fitness_plan.weekly_schedule': updatedExerciseData } },
                { new: true }
            );
            return result || false;
        } catch (error) {
            console.log("Error UserModel@updateWeeklyWorkoutPlanDay: ", error);
            return false;
        }
    }

    getFormattedData = async (userObj = null) => {
        console.log('UsersModel@getFormattedData');

        if (!userObj || userObj === '') {
            throw new Error('userObj is required');
        }

        let result = {
            id: userObj._id,
            _id: userObj._id,
            first_name: userObj?.user_info?.first_name || null,
            last_name: userObj?.user_info?.last_name || null,
            email: userObj.email,
            role: userObj.role,
            status: userObj.status,
            phone_number: userObj.phone_number,
            phone_code: userObj.phone_code,
            profile_picture: userObj.profile_picture,
            age: userObj.age,
            height: userObj.height,
            height_unit: userObj.height_unit,
            weight: userObj.weight,
            weight_unit: userObj.weight_unit,
            gender: userObj.gender,
            activity: userObj.activity,
            goal: userObj.goal,
            results_speed_pref: userObj.results_speed_pref,
            track_nutrition: userObj.track_nutrition,
            workout_settings: userObj.workout_settings,
            meal_settings: userObj.meal_settings,
            is_email_verified: userObj.is_email_verified,
            is_phone_verified: userObj.is_phone_verified,
            step: userObj.step,
            goal_updated_at: userObj.goal_updated_at,
            nutrition_updated_at: userObj.nutrition_updated_at,
            referral_code: userObj.referral_code,
            created_at: userObj.created_at,
            updated_at: userObj.updated_at,
            deleted_at: userObj.deleted_at,
            active_subscription: userObj?.active_subscription || {status: "in-active"},
            // weekly_fitness_plan: userObj.weekly_fitness_plan,
            available_activity_tokens: userObj.available_activity_tokens,
            available_equipments_details: userObj.available_equipments_details,
            stripe_onboarding_status: userObj.stripe_onboarding_status,
            referrals_sent_count: userObj.referrals_sent_count
        };

        let userReferralCode = userObj?.referral_code ? userObj.referral_code : false;
        if (userReferralCode) {
            const referralLink = `${process.env.BRANCH_IO_BASE_URL}?referral_code=${userReferralCode}`;
            result.referral_link = referralLink;
        }

        return result
    }

    deleteOne = async (id) => {
        console.log("UsersModel@deleteOne");

        try {
            let result = await User.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error UserModel@deleteOne: ", error);
            return false;
        }
    }

    getAllWithPagination = async (page, limit, filterObj = {}) => {
        console.log('UsersResources@getAllWithPagination');

        try {
            let resObj;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if (filterObj?.role) {
                dbQuery = {
                    ...dbQuery,
                    role: filterObj.role
                };
            }

            if (filterObj?.search) {
                const searchRegex = new RegExp(filterObj.search, 'i'); // 'i' makes it case-insensitive

                dbQuery = {
                    ...dbQuery,
                    $or: [
                        { email: { $regex: searchRegex } },
                        { "user_info.first_name": { $regex: searchRegex } },
                        { "user_info.last_name": { $regex: searchRegex } }
                    ]
                };
            }

            let totalRecords = await User.countDocuments(dbQuery);

            let pagination = await dataHelper.calculatePagination(totalRecords, page, limit);

            let users = await User.aggregate([
                { $match: dbQuery },
                {
                    $project: {
                        password: 0,
                        auth_token: 0,
                        fcm_token: 0
                    }
                }
            ])
                .sort({ createdAt: -1 })
                .skip(pagination.offset)
                .limit(pagination.limit)

            if (!users) {
                resObj = {
                    data: []
                };
            }
            else {
                resObj = {
                    pagination: {
                        total: totalRecords,
                        current_page: pagination.currentPage,
                        total_pages: pagination.totalPages,
                        per_page: pagination.limit
                    },
                    data: users
                };
            }

            return resObj;

        } catch (error) {
            console.log("Error UserModel@getAllWithPagination: ", error);
            return false;
        }

    }

    countUsers = async (columnName, columnValue) => {
        console.log("UsersModel@countUsers");

        try {
            let query = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            let count = await User.countDocuments(query);
            return count;

        } catch (error) {
            console.log("Error UserModel@countUsers: ", error);
            return 0;
        }
    }

    getAllUsersByCondition = async (columnName, columnValue) => {
        console.log("UsersModel@getAllUsersByCondition");

        try {
            let query = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            let users = await User.find(query);
            return users;

        } catch (error) {
            console.log("Error UserModel@getAllUsersByCondition: ", error);
            return [];
        }
    }
}

module.exports = new UserModel;
