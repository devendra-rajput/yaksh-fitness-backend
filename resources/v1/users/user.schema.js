/**
 * User Schema
 * Mongoose schema definition for User model
 */

const mongoose = require('mongoose');
const leanVirtuals = require('mongoose-lean-virtuals');

/**
 * User status enum
 */
const USER_STATUS = Object.freeze({
  INACTIVE: '0',
  ACTIVE: '1',
  BLOCKED: '2',
  DELETED: '3',
});

/**
 * User role enum
 */
const USER_ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

/**
 * User Schema Definition
 */
const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      index: true, // Index for faster queries
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Don't include in queries by default
    },
    user_info: {
      first_name: {
        type: String,
        default: '',
        trim: true,
      },
      last_name: {
        type: String,
        default: '',
        trim: true,
      },
    },
    phone_code: {
      type: String,
      default: '',
      trim: true,
    },
    phone_number: {
      type: String,
      default: '',
      trim: true,
      index: true, // Index for faster queries
    },
    profile_picture: {
      type: String,
      default: '',
    },
    tokens: {
      auth_token: {
        type: String,
        default: '',
        select: false, // Don't include in queries by default
      },
      fcm_token: {
        type: String,
        default: '',
      },
    },
    otp: {
      email_verification: {
        type: String,
        default: '',
        select: false, // Don't include in queries by default
      },
      forgot_password: {
        type: String,
        default: '',
        select: false, // Don't include in queries by default
      },
    },
    status: {
      type: String,
      enum: {
        values: Object.values(USER_STATUS),
        message: '{VALUE} is not a valid status',
      },
      default: USER_STATUS.ACTIVE,
      index: true, // Index for faster queries
    },
    role: {
      type: String,
      enum: {
        values: Object.values(USER_ROLES),
        message: '{VALUE} is not a valid role',
      },
      default: USER_ROLES.USER,
      index: true, // Index for faster queries
    },
    is_email_verified: {
      type: Boolean,
      default: false,
      index: true, // Index for faster queries
    },
    deleted_at: {
      type: String,
      default: '',
      index: true, // Index for faster queries
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    // Optimize JSON output
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Remove sensitive fields from JSON output
        const sanitized = { ...ret };
        delete sanitized.password;
        delete sanitized.__v;
        return sanitized;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

/**
 * Performance Indexes
 */
// Compound index for common queries
UserSchema.index({ email: 1, deleted_at: 1 });
UserSchema.index({ phone_code: 1, phone_number: 1, deleted_at: 1 });
UserSchema.index({ role: 1, status: 1, deleted_at: 1 });

/**
 * Virtual Properties
 */
// Full name virtual property
UserSchema.virtual('full_name').get(function getFullName() {
  const firstName = this.user_info?.first_name || '';
  const lastName = this.user_info?.last_name || '';
  return `${firstName} ${lastName}`.trim();
});

/**
 * Instance Methods
 */
// Check if user is active
UserSchema.methods.isActive = function isActive() {
  return this.status === USER_STATUS.ACTIVE && !this.deleted_at;
};

// Check if user is admin
UserSchema.methods.isAdmin = function isAdmin() {
  return this.role === USER_ROLES.ADMIN;
};

/**
 * Query Helpers
 */
// Find active users
UserSchema.query.active = function queryActive() {
  return this.where({
    status: USER_STATUS.ACTIVE,
    deleted_at: { $in: [null, '', ' '] },
  });
};

// Find by email (case-insensitive)
UserSchema.query.byEmail = function queryByEmail(email) {
  return this.where({ email: email.toLowerCase() });
};

// Find by phone (case-insensitive)
UserSchema.query.byPhone = function queryByPhone(phoneCode, phoneNumber) {
  return this.where({
    phone_code: phoneCode,
    phone_number: phoneNumber,
    status: USER_STATUS.ACTIVE,
    deleted_at: { $in: [null, '', ' '] },
  });
};

// Find non-deleted users
UserSchema.query.notDeleted = function queryNotDeleted() {
  return this.where({
    deleted_at: { $in: [null, '', ' '] },
  });
};

/**
 * Pre-save middleware
 */
UserSchema.pre('save', async function preSaveHook() {
  // Only run this logic if the email field was actually changed
  if (!this.isModified('email')) return;

  if (this.email) {
    this.email = this.email.toLowerCase();
  }
});

/**
 * Plugin for lean virtuals
 */
UserSchema.plugin(leanVirtuals);

/**
 * Create and export User model
 */
const User = mongoose.model('users', UserSchema, 'users');

module.exports = {
  User,
  USER_STATUS,
  USER_ROLES,
};
