const mongoose = require('mongoose');

const UserTokensSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    activity_date: { type: Date, required: true },
    total_daily_tokens: { type: Number, default: 0 },
    activities: {
        workout: {
            count: { type: Number, default: 0 },
            tokens: { type: Number, default: 0 }
        },
        food_scan: {
            count: { type: Number, default: 0 },
            tokens: { type: Number, default: 0 }
        },
        body_scan: {
            count: { type: Number, default: 0 },
            tokens: { type: Number, default: 0 }
        },
        voice_log: {
            count: { type: Number, default: 0 },
            tokens: { type: Number, default: 0 }
        },
        daily_macros: {
            count: { type: Number, default: 0 },
            tokens: { type: Number, default: 0 }
        }
    },
    milestones: {
        three_workout_tokens: { type: Number, default: 0 },
        sixty_seconds_workout_tokens: { type: Number, default: 0 },
        five_workout_tokens: { type: Number, default: 0 },
        every_day_workout_tokens: { type: Number, default: 0 },
        one_body_scan_tokens: { type: Number, default: 0 },
        seven_foods_scan_tokens: { type: Number, default: 0 },
        menu_scan_tokens: { type: Number, default: 0 },
        voice_log_tokens: { type: Number, default: 0 },
        every_day_meal_log_tokens: { type: Number, default: 0 },
        three_time_protein_tokens: { type: Number, default: 0 },
        consecutive_five_day_meal_log_tokens: { type: Number, default: 0 },
        ninety_percent_macros_twice_tokens: { type: Number, default: 0 },
        every_day_macros_fulfill_tokens: { type: Number, default: 0 },
        consecutive_seven_day_macros_fulfill_tokens: { type: Number, default: 0 },
        five_time_open_tokens: { type: Number, default: 0 },
        three_plus_day_streak_tokens: { type: Number, default: 0 }
    },
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Indexes for performance
UserTokensSchema.index({ "user_id": 1, "activity_date": 1 }, { unique: true });

const UserTokens = mongoose.model("user_token", UserTokensSchema, 'user_tokens');

module.exports = UserTokens;