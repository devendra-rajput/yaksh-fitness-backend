/**
 * User Validation Middleware
 * Validates user-related requests using Joi schemas.
 *
 * Pattern: each exported validator is created by the `createValidator` factory.
 * Custom cross-field checks (password match, strength) are passed as a second argument.
 */

const Joi = require('joi');

const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const {
  USER_GENDER,
  FITNESS_GOAL,
  FITNESS_LEVEL,
  TRAINING_LOCATION,
  ACTIVITY_LEVEL,
} = require('./user.schema');

/* ─── Reusable Joi primitives ───────────────────────────────────────────── */

const SCHEMAS = Object.freeze({
  email: Joi.string().email().lowercase().trim().required(),
  emailOptional: Joi.string().email().optional(),
  password: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'OTP must be exactly 6 digits',
    'string.pattern.base': 'OTP must contain only digits',
  }),
  phoneNumber: Joi.string().pattern(/^\d+$/).optional(),
  phoneCode: Joi.string().when('phone_number', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  firstName: Joi.string().min(1).max(50).trim().required(),
  lastName: Joi.string().max(50).trim().optional(),
  imageUrl: Joi.string().uri().required(),
  fileName: Joi.string().required(),
  fileType: Joi.string().required(),
  folder: Joi.string().optional(),
  userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid user ID format',
  }),
  resetToken: Joi.string().required(),
  refreshToken: Joi.string().required(),
  googleIdToken: Joi.string().required(),
  // Onboarding specific
  fullName: Joi.string().trim().required(),
  dob: Joi.date().iso().required().custom((value, helpers) => {
    const minAgeDate = new Date();
    minAgeDate.setFullYear(minAgeDate.getFullYear() - 10);
    if (new Date(value) > minAgeDate) {
      return helpers.message('You must be at least 10 years old to use this application');
    }
    return value;
  }),
  height: Joi.number().positive().required(),
  heightUnit: Joi.string().valid('cm', 'ft', 'in').required(),
  weight: Joi.number().positive().required(),
  weightUnit: Joi.string().valid('kg', 'lbs').required(),
  gender: Joi.string().valid(...Object.values(USER_GENDER)).required(),
  goal: Joi.string().valid(...Object.values(FITNESS_GOAL)).required(),
  fitnessLevel: Joi.string().valid(...Object.values(FITNESS_LEVEL)).required(),
  trainingLocation: Joi.string().valid(...Object.values(TRAINING_LOCATION)).required(),
  equipments: Joi.array().items(Joi.string()).required(),
  activityLevel: Joi.string().valid(...Object.values(ACTIVITY_LEVEL)).required(),
});

/* ─── Validation schemas ────────────────────────────────────────────────── */

const validationSchemas = Object.freeze({
  // Onboarding
  register: {
    email: SCHEMAS.email,
    password: SCHEMAS.password,
    confirm_password: SCHEMAS.password,
    phone_number: SCHEMAS.phoneNumber,
    phone_code: SCHEMAS.phoneCode,
  },
  verifyEmail: {
    email: SCHEMAS.email,
    otp: SCHEMAS.otp,
  },
  resendOtp: {
    email: SCHEMAS.email,
  },
  onboardingProfile: {
    full_name: SCHEMAS.fullName,
    dob: SCHEMAS.dob,
    height: SCHEMAS.height,
    height_unit: SCHEMAS.heightUnit,
    weight: SCHEMAS.weight,
    weight_unit: SCHEMAS.weightUnit,
    gender: SCHEMAS.gender,
  },
  onboardingGoals: {
    goal: SCHEMAS.goal,
    fitness_level: SCHEMAS.fitnessLevel,
  },
  onboardingTraining: {
    training_location: SCHEMAS.trainingLocation,
    equipments: SCHEMAS.equipments,
    activity_level: SCHEMAS.activityLevel,
  },
  updateProfile: {
    full_name: SCHEMAS.fullName.optional(),
    dob: SCHEMAS.dob.optional(),
    height: SCHEMAS.height.optional(),
    height_unit: SCHEMAS.heightUnit.optional(),
    weight: SCHEMAS.weight.optional(),
    weight_unit: SCHEMAS.weightUnit.optional(),
    gender: SCHEMAS.gender.optional(),
    goal: SCHEMAS.goal.optional(),
    fitness_level: SCHEMAS.fitnessLevel.optional(),
    training_location: SCHEMAS.trainingLocation.optional(),
    equipments: SCHEMAS.equipments.optional(),
    activity_level: SCHEMAS.activityLevel.optional(),
  },

  // Auth
  login: {
    email: SCHEMAS.email,
    password: SCHEMAS.password,
  },
  refreshToken: {
    refresh_token: SCHEMAS.refreshToken,
  },

  // Forgot / Reset password
  forgotPassword: {
    email: SCHEMAS.email,
  },
  verifyForgotPasswordOTP: {
    email: SCHEMAS.email,
    otp: SCHEMAS.otp,
  },
  resetPassword: {
    password: SCHEMAS.newPassword,
    confirm_password: SCHEMAS.newPassword,
    reset_token: SCHEMAS.resetToken,
  },
  changePassword: {
    old_password: SCHEMAS.password,
    new_password: SCHEMAS.newPassword,
    confirm_new_password: SCHEMAS.newPassword,
  },

  // Google OAuth
  googleLogin: {
    id_token: SCHEMAS.googleIdToken,
  },

  // Uploads
  deleteImage: { image_url: SCHEMAS.imageUrl },
  deleteImageAWS: { image_url: SCHEMAS.imageUrl },
  generatePresignedUrl: {
    file_name: SCHEMAS.fileName,
    file_type: SCHEMAS.fileType,
    folder: SCHEMAS.folder,
  },
});

/* ─── Pure validation helpers ───────────────────────────────────────────── */

const validatePasswordStrength = (pwd) => dataHelper.checkPasswordRegex(pwd);
const validatePasswordMatch = (p1, p2) => p1 === p2;
const validatePasswordsDifferent = (newPwd, oldPwd) => newPwd !== oldPwd;

/* ─── Factory ────────────────────────────────────────────────────────────── */

/**
 * Creates an Express middleware that:
 *  1. Runs Joi schema validation on req.body
 *  2. Optionally runs a custom async validator
 */
const createValidator = (schema, customValidation = null) => async (req, res, next) => {
  const errors = await dataHelper.joiValidation(req.body, schema);
  if (errors?.length) {
    return response.validationError(errors[0], res, errors);
  }
  if (customValidation) {
    const customError = await customValidation(req, res);
    if (customError) return response.validationError(customError, res, false);
  }
  return next();
};

/* ─── Custom validators ──────────────────────────────────────────────────── */

const validateRegister = async (req) => {
  const { password, confirm_password } = req.body;
  if (!validatePasswordStrength(password)) return 'validation.strongPassword';
  if (!validatePasswordMatch(password, confirm_password)) return 'validation.confirmPasswordNotMatch';
  return null;
};

const validateResetPassword = async (req) => {
  const { password, confirm_password } = req.body;
  if (!validatePasswordStrength(password)) return 'validation.strongPassword';
  if (!validatePasswordMatch(password, confirm_password)) return 'validation.confirmPasswordNotMatch';
  return null;
};

const validateChangePassword = async (req) => {
  const { old_password, new_password, confirm_new_password } = req.body;
  if (!validatePasswordStrength(new_password)) return 'validation.strongPassword';
  if (!validatePasswordMatch(new_password, confirm_new_password)) return 'validation.confirmPasswordNotMatch';
  if (!validatePasswordsDifferent(new_password, old_password)) return 'validation.newAndOldPasswordSame';
  const isOldPasswordValid = await dataHelper.validatePassword(old_password, req.user.password);
  if (!isOldPasswordValid) return 'validation.invalidOldPassword';
  return null;
};

/* ─── Exports ────────────────────────────────────────────────────────────── */

module.exports = {
  // Onboarding
  register: createValidator(validationSchemas.register, validateRegister),
  verifyEmail: createValidator(validationSchemas.verifyEmail),
  resendOtp: createValidator(validationSchemas.resendOtp),
  onboardingProfile: createValidator(validationSchemas.onboardingProfile),
  onboardingGoals: createValidator(validationSchemas.onboardingGoals),
  onboardingTraining: createValidator(validationSchemas.onboardingTraining),
  updateProfile: createValidator(validationSchemas.updateProfile),

  // Auth
  login: createValidator(validationSchemas.login),
  refreshToken: createValidator(validationSchemas.refreshToken),

  // Forgot / Reset password
  forgotPassword: createValidator(validationSchemas.forgotPassword),
  verifyForgotPasswordOTP: createValidator(validationSchemas.verifyForgotPasswordOTP),
  resetPassword: createValidator(validationSchemas.resetPassword, validateResetPassword),
  changePassword: createValidator(validationSchemas.changePassword, validateChangePassword),

  // Google OAuth
  googleLogin: createValidator(validationSchemas.googleLogin),

  // Uploads
  deleteImage: createValidator(validationSchemas.deleteImage),
  deleteImageAWS: createValidator(validationSchemas.deleteImageAWS),
  generatePresignedUrl: createValidator(validationSchemas.generatePresignedUrl),
};
