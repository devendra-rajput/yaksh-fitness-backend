const mongoose = require('mongoose');

const FavouritesSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ['meal', 'workout'], default: 'workout' },
    workout_id: { type: mongoose.Schema.Types.ObjectId, ref: "Workout" },
    deleted_at: { type: String, default: '' }
}, { 
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at' 
    } 
})

const UserMeals = mongoose.model("favourite", FavouritesSchema, 'favourites');

module.exports = UserMeals;