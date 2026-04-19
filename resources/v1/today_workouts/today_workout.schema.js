const mongoose = require('mongoose');

const TodayWorkoutsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    filter: { type: Object, default: {} }, // Object of filter
    workouts: {
        type: [Object],
        _id: false,   // <-- disables automatic _id
        default: [] 
    }, // Array of workouts objects
    is_setting_updated: { type: Boolean, default: false},
    expires_at: { type: Date },
    deleted_at: { type: String, default: '' }
}, { 
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at' 
    } 
})

const TodayMeals = mongoose.model("today_workout", TodayWorkoutsSchema, 'today_workouts');

module.exports = TodayMeals;