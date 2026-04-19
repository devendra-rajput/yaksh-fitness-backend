const mongoose = require('mongoose');

const ExercisesSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    instructions: { type: [String], default: [] },
    tips: { type: [String], default: [] },
    primary_muscle_groups: {
        type: [
            {
                id: { type: String },
                title: { type: String }
            }
        ],
        _id: false,   // <-- disables automatic _id
        default: []
    },
    secondary_muscle_groups: {
        type: [
            {
                id: { type: String },
                title: { type: String }
            }
        ],
        _id: false,   // <-- disables automatic _id
        default: []
    },
    equipments: {
        type: [
            {
                id: { type: String },
                title: { type: String }
            }
        ],
        _id: false,   // <-- disables automatic _id
        default: []
    },
    video_url: { type: String, default: '' },
    thumbnail_url: { type: String, default: '' },
    exercise_category: { type: String, default: '' }, // Compound, Isolation etc.
    workout_split_categrory: { type: String, default: '' }, // Pull, Legs, Push etc
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

const Exercises = mongoose.model("exercise", ExercisesSchema, 'exercises');

module.exports = Exercises;
