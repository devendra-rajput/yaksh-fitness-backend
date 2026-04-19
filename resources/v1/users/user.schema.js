const mongoose = require('mongoose');
Schema = mongoose.Schema

const UsersSchema = new mongoose.Schema({
    email: { type: String, default: '' },
    password: { type: String, required: true },
    user_info: {
        first_name: { type: String, default: '' },
        last_name: { type: String, default: '' },
    },
    phone_code: { type: String, default: '' },
    phone_number: { type: String, default: '' },
    profile_picture: { type: String, default: '' },
    tokens: {
        auth_token: { type: String, default: '' },
        fcm_token: { type: String, default: '' },
    },
    otp: {
        email_verification: { type: String, default: '' },
        phone_verification: { type: String, default: '' },
        forgot_password: { type: String, default: '' }
    },
    provider: { type: String, default: '' },
    provider_id: { type: String, default: '' },
    age: { type: Number, default: '' },
    height: { type: Number, default: '' },
    height_unit: { type: String, default: 'cm' },
    weight: { type: Number, default: '' },
    weight_unit: { type: String, default: 'Lbs' },
    gender: { type: String, enum: ['Male', 'Female'] },
    activity: { type: String, default: '' },
    goal: {
        id: { type: String, default: '' },
        title: { type: String, default: '' }
    },
    results_speed_pref: { type: String, default: '' },
    track_nutrition: { type: String, default: '' },
    workout_settings: {
        workout_time: { type: Number, default: '' },
        days_per_week: { type: Number, default: '' },
        experience_level: { type: String, default: '' },
        preferred_training_location: { type: String, default: '' },
        available_equipments: {
            type: [String],
            _id: false,   // <-- disables automatic _id
            default: []
        },
        training_preferences: {
            type: [String],
            _id: false,   // <-- disables automatic _id
            default: []
        },
        variability: { type: String, default: '' },
        cardio: { type: Boolean, default: false },
        warm_up: { type: Boolean, default: false },
        cool_down: { type: Boolean, default: false }
    },
    meal_settings: {
        calories: { type: String, default: '' },
        protein: { type: String, default: '' },
        carbs: { type: String, default: '' },
        fats: { type: String, default: '' },
        meals_per_day: { type: Number, default: '' },
        diet_style: { type: String, default: '' },
        exclude_gluten: { type: Boolean, default: false },
        exclude_dairy: { type: Boolean, default: false },
        exclude_nuts: { type: Boolean, default: false },
        exclude_soy: { type: Boolean, default: false },
        exclude_shellfish: { type: Boolean, default: false },
        exclude_eggs: { type: Boolean, default: false },
        dislike_foods: {
            type: [String],
            _id: false,   // <-- disables automatic _id
            default: []
        },
        meal_style_preferences: { type: String, default: '' },
        cooking_skill: { type: String, default: '' },
        intermittent_fasting: { type: String, default: '' },
        post_workout_emphasis: { type: Boolean, default: false },
        late_night_carbs: { type: String, default: '' },
        cuisines: {
            type: [String],
            _id: false,   // <-- disables automatic _id
            default: []
        },
        spice_tolerance: { type: String, default: '' },
        sweeteners: { type: String, default: '' },
        alcohol_policy: { type: String, default: '' },
    },
    status: { type: String, enum: ['0', '1', '2', '3'], default: '1' }, // 0 => In-active, 1 => Active, 2 => Blocked, 3 => Deleted
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    is_email_verified: { type: Boolean, default: false },
    is_phone_verified: { type: Boolean, default: false },
    is_private_email: { type: Boolean, default: false },
    step: { type: String, enum: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], default: '0' },
    delete_reason: { type: String, default: '' },
    goal_updated_at: { type: String, default: '' },
    nutrition_updated_at: { type: String, default: '' },
    excluded_exercises: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
    }],
    stripe_account_id: { type: String, default: null },
    stripe_onboarding_status: { type: String, default: null },
    referral_code: { type: String, unique: true, default: null, },
    referred_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    total_activity_tokens: { type: Number, default: 0 },
    used_activity_tokens: { type: Number, default: 0 },
    available_activity_tokens: { type: Number, default: 0 },
    /**
     * Referral sent count key
     */
    referrals_sent_count: { type: Number, default: 0 },
    /**
     * Referrer reward amount
     */
    total_referrer_amount: { type: Number, default: 0 },
    paid_referrer_amount: { type: Number, default: 0 },
    available_referrer_amount: { type: Number, default: 0 },
    /**
     * Referral reward amount
     */
    total_referral_amount: { type: Number, default: 0 },
    paid_referral_amount: { type: Number, default: 0 },
    available_referral_amount: { type: Number, default: 0 },
    // weekly_fitness_plan: {
    //     weekly_schedule: [{
    //         day: { type: Number, min: 1, max: 7 },
    //         date: { type: String, default: '' },
    //         time: { type: Number, default: 0 },
    //         location: { type: String, default: '' },
    //         difficulty: { type: String, default: '' },
    //         custom_muscles: { type: [String], default: [] },
    //         difficulty: {
    //             type: String,
    //             enum: ['Beginner', 'Intermediate', 'Advanced'],
    //             default: 'Intermediate'
    //         },
    //         workouts: [new mongoose.Schema({
    //             set_and_reps: {
    //                 sets: { type: String, default: '' },
    //                 reps: { type: String, default: '' },
    //                 weight: { type: String, default: '' },
    //                 weight_unit: {
    //                     type: String,
    //                     enum: ['lbs', 'kg'],
    //                     default: 'lbs'
    //                 }
    //             },
    //             is_completed: { type: Boolean, default: false }
    //         }, { strict: false, _id: false })],
    //         _id: false
    //     }],
    //     customized_plan: [{
    //         day: { type: Number, min: 1, max: 7 },
    //         date: { type: String, default: '' },
    //         time: { type: Number, default: 0 },
    //         location: { type: String, default: '' },
    //         difficulty: { type: String, default: '' },
    //         custom_muscles: { type: [String], default: [] },
    //         difficulty: {
    //             type: String,
    //             enum: ['Beginner', 'Intermediate', 'Advanced'],
    //             default: 'Intermediate'
    //         },
    //         workouts: [new mongoose.Schema({
    //             set_and_reps: {
    //                 sets: { type: String, default: '' },
    //                 reps: { type: String, default: '' },
    //                 weight: { type: String, default: '' },
    //                 weight_unit: {
    //                     type: String,
    //                     enum: ['lbs', 'kg'],
    //                     default: 'lbs'
    //                 }
    //             },
    //             is_completed: { type: Boolean, default: false }
    //         }, { strict: false, _id: false })],
    //         _id: false
    //     }]
    // },
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

const Users = mongoose.model("users", UsersSchema, 'users');

module.exports = Users;