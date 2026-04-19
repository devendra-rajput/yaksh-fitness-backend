const mongoose = require('mongoose');
Schema = mongoose.Schema

const GoalsSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    slug: { type: String, default: '' },
    is_default: { type: Boolean, default: false },
    default_nutrition: {
        calorie_modifier: { type: Number },  // e.g. -0.2 or +0.15
        protein_per_lb: { type: Number },
        carbs_percent: { type: Number },
        fat_percent: { type: Number }
    },
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

const Goals = mongoose.model("goals", GoalsSchema, 'goals');

module.exports = Goals;