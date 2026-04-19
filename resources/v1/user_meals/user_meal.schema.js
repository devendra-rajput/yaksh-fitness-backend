const mongoose = require('mongoose');

/** This schema/module is for adding the meal in tracker. It does not have any relation with meals table */

const NutritionSchema = new mongoose.Schema({
    fiber: { type: Number, default: '' },
    fat: { type: Number, default: '' },
    carbs: { type: Number, default: '' },
    protein: { type: Number, default: '' },
    calories: { type: Number, default: '' },
    weight_qty: { type: Number, default: '' }, // Like as 20 grm fiber
    weight_unit: { type: String, default: '' },
    serving_qty: { type: Number, default: '' }, // Like as 2 slice or cup
    serving_unit: { type: String, default: '' }
}, { _id: false });

const UserMealsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    scan_food_id: { type: mongoose.Schema.Types.ObjectId },
    recognised_food_name: { type: String, default: '' },
    food_name: { type: String, default: '' },
    food_type: { type: String, default: '' },
    nutrition: { type: NutritionSchema, default: {} },
    score: { type: Number, default: '' },
    brand_name: { type: String, default: '' },
    tags: { type: [], default: '' },
    weight_grams: { type: Number, default: '' },
    portion_size: { type: String, default: '' }, // Like piece or cup
    meal_time: { type: String, default: '' }, // Lunch, Dinner, Breakfast
    consumed_qty: { type: Number, default: '' },
    deleted_at: { type: String, default: '' }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
})

const UserMeals = mongoose.model("user_meal", UserMealsSchema, 'user_meals');

module.exports = UserMeals;