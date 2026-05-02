/**
 * User Schema
 * Mongoose schema definition for User model.
 *
 * Changes vs original:
 *  - Added `onboarding_step` to track multi-step registration flow
 *  - OTPs (email & forgot-password) are now stored in Redis, not DB
 *  - `tokens.refresh_token` array enables multi-device refresh token rotation
 *  - `google_id` supports Google OAuth sign-in
 *  - Compound indexes tuned for common query patterns
 */

const mongoose = require('mongoose');
const leanVirtuals = require('mongoose-lean-virtuals');
const { ONBOARDING_STEPS } = require('../../../constants/onboarding');

/**
 * User status enum
 */
const USER_STATUS = Object.freeze({
  INACTIVE: '0',
  ACTIVE: '1',
  BLOCKED: '2',
});

/**
 * User role enum
 */
const USER_ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

/**
 * Gender enum
 */
const USER_GENDER = Object.freeze({
  MALE: 'Male',
  FEMALE: 'Female',
  NON_BINARY: 'Non-binary',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
});

/**
 * Fitness Goal enum
 */
const FITNESS_GOAL = Object.freeze({
  LOSE_WEIGHT: 'Lose Weight',
  BUILD_MUSCLE: 'Build Muscle',
  ENDURANCE: 'Endurance',
  STAY_ACTIVE: 'Stay Active',
  FLEXIBILITY: 'Flexibility',
  SPORT_PERFORMANCE: 'Sport Performance',
});

/**
 * Fitness level enum
 */
const FITNESS_LEVEL = Object.freeze({
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
});

/**
 * Training location enum
 */
const TRAINING_LOCATION = Object.freeze({
  GYM: 'Gym',
  HOME: 'Home',
  BOTH: 'Both',
  OUTDOOR: 'Outdoor',
});

/**
 * Activity level enum
 */
const ACTIVITY_LEVEL = Object.freeze({
  SEDENTARY: 'Sedentary',
  LIGHTLY_ACTIVE: 'Lightly Active',
  MODERATELY_ACTIVE: 'Moderately Active',
  VERY_ACTIVE: 'Very Active',
  EXTREMELY_ACTIVE: 'Extremely Active',
});

/**
 * User Schema Definition
 */
const UserSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true, // allows null for Google-only users without email
      index: true,
    },
    password: {
      type: String,
      select: false, // excluded from all queries by default
    },
    google_id: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },

    // ── Profile (Step 3) ────────────────────────────────────
    user_info: {
      first_name: { type: String, default: '', trim: true },
      last_name: { type: String, default: '', trim: true },
    },
    dob: { type: String, default: '' },
    height: { type: Number, default: null },
    height_unit: { type: String, enum: ['cm', 'ft', 'in'], default: 'cm' },
    weight: { type: Number, default: null },
    weight_unit: { type: String, enum: ['kg', 'lbs'], default: 'kg' },
    gender: {
      type: String,
      enum: {
        values: Object.values(USER_GENDER),
        message: '{VALUE} is not a valid gender',
      },
      default: USER_GENDER.PREFER_NOT_TO_SAY,
    },
    phone_code: { type: String, default: '', trim: true },
    phone_number: {
      type: String, default: '', trim: true, index: true,
    },
    profile_picture: { type: String, default: '' },

    // ── Goals (Step 4) ──────────────────────────────────────
    goal: {
      type: String,
      enum: {
        values: Object.values(FITNESS_GOAL),
        message: '{VALUE} is not a valid fitness goal',
      },
      default: FITNESS_GOAL.STAY_ACTIVE,
    },
    fitness_level: {
      type: String,
      enum: {
        values: Object.values(FITNESS_LEVEL),
        message: '{VALUE} is not a valid fitness level',
      },
      default: FITNESS_LEVEL.INTERMEDIATE,
    },

    // ── Training Setup (Step 5) ─────────────────────────────
    training_location: {
      type: String,
      enum: {
        values: Object.values(TRAINING_LOCATION),
        message: '{VALUE} is not a valid training location',
      },
      default: TRAINING_LOCATION.GYM,
    },
    equipments: {
      type: [String],
      default: [],
    },
    activity_level: {
      type: String,
      enum: {
        values: Object.values(ACTIVITY_LEVEL),
        message: '{VALUE} is not a valid activity level',
      },
      default: ACTIVITY_LEVEL.MODERATELY_ACTIVE,
    },

    // ── Status & Role ────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: Object.values(USER_STATUS),
        message: '{VALUE} is not a valid status',
      },
      default: USER_STATUS.ACTIVE,
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: Object.values(USER_ROLES),
        message: '{VALUE} is not a valid role',
      },
      default: USER_ROLES.USER,
      index: true,
    },

    // ── Verification ─────────────────────────────────────────
    is_email_verified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ── Onboarding ───────────────────────────────────────────
    onboarding_step: {
      type: String,
      enum: Object.values(ONBOARDING_STEPS),
      default: ONBOARDING_STEPS.REGISTER,
      index: true,
    },

    // ── Tokens ───────────────────────────────────────────────
    // fcm_token for push notifications; refresh tokens live in Redis.
    tokens: {
      fcm_token: { type: String, default: '' },
      auth_token: {
        type: String,
        default: '',
        select: false,
      },
    },

    // ── Workout Builder v4.0 Fields ─────────────────────────
    // Rule 24 — user-flagged injury/limitation conditions
    injuries: {
      type: [{
        type: { type: String, enum: ['knee', 'lower_back', 'shoulder', 'wrist', 'pregnancy'], required: true },
        status: { type: String, enum: ['current', 'past'], default: 'current' },
      }],
      default: [],
    },
    // Rule 24.3 — active pregnancy trimester (1|2|3); null if not pregnant
    pregnancy_trimester: {
      type: Number,
      enum: [1, 2, 3, null],
      default: null,
    },
    // Rule 30.2 — opt-in to circuit format for fat-loss sessions
    circuit_preference: {
      type: Boolean,
      default: false,
    },
    // Rule 18 — preferred weekly split
    split_preference: {
      type: String,
      enum: ['ppl', 'upper_lower', 'bro'],
      default: 'ppl',
    },
    // Rule 25.3 — show tempo string; null = auto (false for beginner, true for intermediate+)
    tempo_display: {
      type: Boolean,
      default: null,
    },

    // ── Soft delete ──────────────────────────────────────────
    deleted_at: { type: String, default: '', index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const out = { ...ret };
        delete out.password;
        delete out.__v;
        return out;
      },
    },
    toObject: { virtuals: true },
  },
);

// ── Compound Indexes ─────────────────────────────────────────────────────────
UserSchema.index({ email: 1, deleted_at: 1 });
UserSchema.index({ google_id: 1, deleted_at: 1 });
UserSchema.index({ phone_code: 1, phone_number: 1, deleted_at: 1 });
UserSchema.index({ role: 1, status: 1, deleted_at: 1 });

// ── Virtuals ─────────────────────────────────────────────────────────────────
UserSchema.virtual('full_name').get(function getFullName() {
  const first = this.user_info?.first_name || '';
  const last = this.user_info?.last_name || '';
  return `${first} ${last}`.trim();
});

// ── Instance Methods ──────────────────────────────────────────────────────────
UserSchema.methods.isActive = function isActive() {
  return this.status === USER_STATUS.ACTIVE && !this.deleted_at;
};
UserSchema.methods.isAdmin = function isAdmin() {
  return this.role === USER_ROLES.ADMIN;
};

// ── Query Helpers ─────────────────────────────────────────────────────────────
UserSchema.query.notDeleted = function queryNotDeleted() {
  return this.where({ deleted_at: { $in: [null, '', ' '] } });
};
UserSchema.query.active = function queryActive() {
  return this.where({ status: USER_STATUS.ACTIVE, deleted_at: { $in: [null, '', ' '] } });
};
UserSchema.query.byEmail = function queryByEmail(email) {
  return this.where({ email: email.toLowerCase() });
};
UserSchema.query.byPhone = function queryByPhone(code, number) {
  return this.where({
    phone_code: code,
    phone_number: number,
    status: USER_STATUS.ACTIVE,
    deleted_at: { $in: [null, '', ' '] },
  });
};

// ── Hooks ─────────────────────────────────────────────────────────────────────
UserSchema.pre('save', function preSaveHook() {
  if (this.isModified('email') && this.email) {
    this.email = this.email.toLowerCase();
  }
});

UserSchema.plugin(leanVirtuals);

const User = mongoose.model('users', UserSchema, 'users');

module.exports = {
  User,
  USER_STATUS,
  USER_ROLES,
  USER_GENDER,
  FITNESS_GOAL,
  FITNESS_LEVEL,
  TRAINING_LOCATION,
  ACTIVITY_LEVEL,
};
