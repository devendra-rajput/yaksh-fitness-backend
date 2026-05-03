const mongoose = require('mongoose');

const PlanExerciseSchema = new mongoose.Schema({
  exercise_id: { type: mongoose.Schema.Types.ObjectId, ref: 'exercises', required: true },
  title: { type: String, default: '' },
  slug: { type: String, default: '' },
  thumbnail_url: { type: String, default: '' },
  video_url: { type: String, default: '' },
  mechanic: { type: String, default: '' },
  primary_muscles: { type: [String], default: [] },
  role: { type: String, enum: ['warmup', 'main', 'cooldown'], default: 'main' },
  order: { type: Number, default: 0 },
  sets: { type: Number, default: 3, min: 1 },
  reps: { type: String, default: '10-12' },
  rest_seconds: { type: Number, default: 60, min: 0 },
  is_time_based: { type: Boolean, default: false },
  notes: { type: String, default: '' },
}, { _id: false });

const DayPlanSchema = new mongoose.Schema({
  day_index: {
    type: Number, required: true, min: 0, max: 6,
  },
  day_name: { type: String, default: '' },
  is_rest: { type: Boolean, default: false },
  session_type: { type: String, enum: ['strength', 'cardio', 'yoga', 'stretching', 'rest', 'active_recovery'], default: 'strength' },
  split_label: { type: String, default: '' },
  target_muscles: { type: [String], default: [] },
  estimated_duration: { type: Number, default: 0 },
  exercises: { type: [PlanExerciseSchema], default: [] },
}, { _id: false });

const PreferencesSchema = new mongoose.Schema({
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  duration_min: { type: Number, enum: [30, 45, 60], default: 45 },
  location: { type: String, enum: ['no_equipment', 'home_gym', 'small_gym', 'large_gym'], default: 'large_gym' },
  days_per_week: {
    type: Number, min: 3, max: 6, default: 6,
  },
  muscles: { type: [String], default: [] },
}, { _id: false });

const WeeklyPlanSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, unique: true,
  },
  type: { type: String, enum: ['ai', 'manual'], default: 'ai' },
  status: { type: String, enum: ['draft', 'active'], default: 'draft' },
  generated_at: { type: Date, default: null },
  preferences: { type: PreferencesSchema, default: () => ({}) },
  days: { type: [DayPlanSchema], default: [] },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

const WeeklyPlan = mongoose.model('weekly_plans', WeeklyPlanSchema, 'weekly_plans');
module.exports = { WeeklyPlan };
