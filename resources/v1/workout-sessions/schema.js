const mongoose = require('mongoose');

const SetLogSchema = new mongoose.Schema({
  reps: { type: Number, default: null },
  load_kg: { type: Number, default: null },
  completed: { type: Boolean, default: false },
  completed_at: { type: Date, default: null },
}, { _id: false });

const SessionExerciseSchema = new mongoose.Schema({
  exercise_id: { type: mongoose.Schema.Types.ObjectId, ref: 'exercises', default: null },
  title: { type: String, default: '' },
  slug: { type: String, default: '' },
  mechanic: { type: String, default: '' },
  is_bodyweight: { type: Boolean, default: false },
  video_url: { type: String, default: '' },
  thumbnail_url: { type: String, default: '' },
  primary_muscles: { type: [String], default: [] },
  role: { type: String, default: null },
  format: { type: String, default: 'straight' },
  planned_sets: { type: String, default: '3' },
  planned_reps: { type: String, default: '10' },
  planned_rest_seconds: { type: Number, default: 60 },
  planned_load_kg: { type: Number, default: null },
  sets: { type: [SetLogSchema], default: [] },
  is_skipped: { type: Boolean, default: false },
  is_completed: { type: Boolean, default: false },
}, { _id: false });

const WorkoutSessionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true,
    index: true,
  },
  saved_plan_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  workout_name: { type: String, default: 'Workout' },
  session_type: { type: String, default: 'strength' },
  difficulty: { type: String, default: 'intermediate' },
  muscles: { type: [String], default: [] },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
    index: true,
  },
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null },
  current_exercise_index: { type: Number, default: 0 },
  calories_burned: { type: Number, default: 0 },
  exercises: { type: [SessionExerciseSchema], default: [] },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

WorkoutSessionSchema.index({ user_id: 1, status: 1 });
WorkoutSessionSchema.index({ user_id: 1, created_at: -1 });

const WorkoutSession = mongoose.model('workout_sessions', WorkoutSessionSchema, 'workout_sessions');
module.exports = { WorkoutSession };
