const mongoose = require('mongoose');

const ExerciseLogSchema = new mongoose.Schema(
  {
    exercise_id: { type: mongoose.Schema.Types.ObjectId, ref: 'exercises', default: null },
    slug: { type: String, default: '' },
    sets_completed: { type: Number, default: 0 },
    reps_per_set: { type: [Number], default: [] },
    load_kg_per_set: { type: [Number], default: [] },
    last_set_rir: { type: Number, default: null },
  },
  { _id: false },
);

const WorkoutHistorySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true,
      index: true,
    },
    workout_date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    session_type: { type: String, default: 'strength' },
    muscle_groups: { type: [String], default: [] },
    is_deload: { type: Boolean, default: false },
    calories_burned: { type: Number, default: 0 },
    exercises: { type: [ExerciseLogSchema], default: [] },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

WorkoutHistorySchema.index({ user_id: 1, workout_date: -1 });
WorkoutHistorySchema.index({ user_id: 1, muscle_groups: 1, workout_date: -1 });

const WorkoutHistory = mongoose.model('workout_histories', WorkoutHistorySchema, 'workout_histories');

module.exports = { WorkoutHistory };
