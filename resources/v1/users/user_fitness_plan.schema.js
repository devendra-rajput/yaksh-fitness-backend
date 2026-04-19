const mongoose = require('mongoose');
Schema = mongoose.Schema

const UserFitnessPlanSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    weekly_fitness_plan: {
        weekly_schedule: [{
            day: { type: Number, min: 1, max: 7 },
            date: { type: String, default: '' },
            time: { type: Number, default: 0 },
            location: { type: String, default: '' },
            difficulty: { type: String, default: '' },
            custom_muscles: { type: [String], default: [] },
            difficulty: {
                type: String,
                enum: ['Beginner', 'Intermediate', 'Advanced'],
                default: 'Intermediate'
            },
            workouts: [new mongoose.Schema({
                set_and_reps: {
                    sets: { type: String, default: '' },
                    reps: { type: String, default: '' },
                    weight: { type: String, default: '' },
                    weight_unit: {
                        type: String,
                        enum: ['lbs', 'kg'],
                        default: 'lbs'
                    }
                },
                is_completed: { type: Boolean, default: false }
            }, { strict: false, _id: false })],
            _id: false
        }],
        customized_plan: [{
            day: { type: Number, min: 1, max: 7 },
            date: { type: String, default: '' },
            time: { type: Number, default: 0 },
            location: { type: String, default: '' },
            difficulty: { type: String, default: '' },
            custom_muscles: { type: [String], default: [] },
            difficulty: {
                type: String,
                enum: ['Beginner', 'Intermediate', 'Advanced'],
                default: 'Intermediate'
            },
            workouts: [new mongoose.Schema({
                set_and_reps: {
                    sets: { type: String, default: '' },
                    reps: { type: String, default: '' },
                    weight: { type: String, default: '' },
                    weight_unit: {
                        type: String,
                        enum: ['lbs', 'kg'],
                        default: 'lbs'
                    }
                },
                is_completed: { type: Boolean, default: false }
            }, { strict: false, _id: false })],
            _id: false
        }]
    },
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

const UserFitnessPlan = mongoose.model("user_fitness_plans", UserFitnessPlanSchema, 'user_fitness_plans');

module.exports = UserFitnessPlan;