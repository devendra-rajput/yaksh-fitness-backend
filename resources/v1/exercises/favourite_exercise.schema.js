const mongoose = require('mongoose');

const FavouriteExerciseSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true,
  },
  exercise_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'exercises',
    required: true,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

FavouriteExerciseSchema.index({ user_id: 1, exercise_id: 1 }, { unique: true });

const FavouriteExercise = mongoose.model('favourite_exercises', FavouriteExerciseSchema, 'favourite_exercises');
module.exports = { FavouriteExercise };
