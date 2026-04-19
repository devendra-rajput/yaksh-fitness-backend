/**
 * Onboarding Constants
 * Defines user onboarding flow steps as immutable enums.
 * These must stay in sync with the frontend onboarding stepper.
 */

/**
 * Ordered onboarding steps.
 * Order matters – each step must be completed before advancing.
 */
const ONBOARDING_STEPS = Object.freeze({
  REGISTER: 'register',         // Step 1 – collect email, password
  VERIFY_EMAIL: 'verify_email', // Step 2 – confirm OTP sent to email
  PROFILE: 'profile',           // Step 3 – full name, dob, height, weight, gender
  GOALS: 'goals',               // Step 4 – fitness goal, fitness level
  TRAINING: 'training',         // Step 5 – training location, equipment, activity level
  COMPLETE: 'complete',         // Onboarding fully complete
});

/**
 * Numeric order map for step comparison
 */
const ONBOARDING_STEP_ORDER = Object.freeze({
  [ONBOARDING_STEPS.REGISTER]: 1,
  [ONBOARDING_STEPS.VERIFY_EMAIL]: 2,
  [ONBOARDING_STEPS.PROFILE]: 3,
  [ONBOARDING_STEPS.GOALS]: 4,
  [ONBOARDING_STEPS.TRAINING]: 5,
  [ONBOARDING_STEPS.COMPLETE]: 6,
});

/**
 * Redis key namespace prefixes
 */
const ONBOARDING_REDIS_KEYS = Object.freeze({
  emailOtp: 'onboarding:otp:email:',    // onboarding:otp:email:<email>
  otpAttempts: 'onboarding:attempts:',  // onboarding:attempts:<email>
});

/**
 * OTP configuration
 */
const OTP_CONFIG = Object.freeze({
  length: 6,
  expirySeconds: 10 * 60,        // 10 minutes
  maxVerifyAttempts: 5,           // lock after 5 wrong tries
  lockDurationSeconds: 1 * 60,  // locked for 15 minutes
  resendCooldownSeconds: 60,      // min gap between resends
});

module.exports = {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_ORDER,
  ONBOARDING_REDIS_KEYS,
  OTP_CONFIG,
};
