const mongoose = require('mongoose');

const UserStreakSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
        unique: true
    },
    streak_count: {
        type: Number,
        default: 0
    },
    // milestone_count: {
    //     type: Number,
    //     default: 0
    // },
    last_completed_date: {
        type: Date,
        default: null
    },
    last_open_date: {
        type: Date,
        default: null
    },
    app_open_count_this_week: {
        type: Number,
        default: 0
    },
    last_protein_hit_date: {
        type: Date,
        default: null
    },
    last_macro_hit_date: {
        type: Date,
        default: null
    },
    last_ninety_percent_macro_hit_date: {
        type: Date,
        default: null
    },
    protein_hit_count_this_week: {
        type: Number,
        default: 0
    },
    macro_hit_count_this_week: {
        type: Number,
        default: 0
    },
    ninety_percent_macro_hit_count_this_week: {
        type: Number,
        default: 0
    },
    workout_count_this_week: {
        type: Number,
        default: 0
    },
    body_scan_count_this_week: {
        type: Number,
        default: 0
    },
    menu_scan_count_this_week: {
        type: Number,
        default: 0
    },
    food_scan_count_this_week: {
        type: Number,
        default: 0
    },
    meal_log_count_this_week: {
        type: Number,
        default: 0
    },
    fifty_tokens_count_this_week: {
        type: Number,
        default: 0
    },
    consecutive_meal_log_count: {
        type: Number,
        default: 0
    },
    consecutive_macros_fulfill_count: {
        type: Number,
        default: 0
    },
    last_meal_consecutive_reset_date: {
        type: Date,
        default: null
    },
    last_macro_consecutive_reset_date: {
        type: Date,
        default: null
    },
    tokens_earned_this_week: {
        type: Number,
        default: 0
    },
    voice_log_count_this_week: {
        type: Number,
        default: 0
    },
    last_workout_speed_milestone_date: {
        type: Date,
        default: null
    },
    streak_start_date: {
        type: Date,
        default: null
    },
    completions: {
        type: [Date],
        default: []
    },
    milestones: {
        three_workout_count: { type: Number, default: 0 },
        sixty_seconds_workout_count: { type: Number, default: 0 },
        five_workout_count: { type: Number, default: 0 },
        every_day_workout_count: { type: Number, default: 0 },
        one_body_scan_count: { type: Number, default: 0 },
        seven_foods_scan_count: { type: Number, default: 0 },
        menu_scan_count: { type: Number, default: 0 },
        voice_log_count: { type: Number, default: 0 },
        every_day_meal_log_count: { type: Number, default: 0 },
        three_time_protein_count: { type: Number, default: 0 },
        consecutive_five_day_meal_log_count: { type: Number, default: 0 },
        ninety_percent_macros_twice_count: { type: Number, default: 0 },
        every_day_macros_fulfill_count: { type: Number, default: 0 },
        consecutive_seven_day_macros_fulfill_count: { type: Number, default: 0 },
        five_time_open_count: { type: Number, default: 0 },
        three_plus_day_streak_count: { type: Number, default: 0 },
        fifty_tokens_count: { type: Number, default: 0 }
    },
    last_weekly_reset_date: {
        type: Date,
        default: null
    },
    deleted_at: {
        type: String,
        default: ''
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

UserStreakSchema.index({ user_id: 1 });

const UserStreak = mongoose.model("user_streak", UserStreakSchema, 'user_streaks');

module.exports = UserStreak;
