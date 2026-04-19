const mongoose = require('mongoose');

/** This schema/module is for adding the workout in tracker. It does not have any relation with workouts table */

const UserWorkoutsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    workouts: {
        type: [Object],
        _id: false,   // <-- disables automatic _id
        default: [] 
    },
    deleted_at: { type: String, default: '' }
}, { 
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at' 
    } 
})

const UserWorkouts = mongoose.model("user_workout", UserWorkoutsSchema, 'user_workouts');

module.exports = UserWorkouts;