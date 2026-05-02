/**
 * OTP Redis Helper
 *
 * Centralises all Redis-based OTP operations:
 *   - Store OTP with expiry
 *   - Retrieve & verify OTP
 *   - Track failed attempt count (brute-force protection)
 *   - Resend cooldown enforcement
 *
 * No OTPs are stored in MongoDB – Redis is the sole source of truth.
 */

const redis = require('../../services/redis');
const dataHelper = require('./data.helpers');
const { OTP_CONFIG, ONBOARDING_REDIS_KEYS } = require('../../constants/onboarding');
const { FORGOT_PASSWORD_CONFIG, AUTH_REDIS_KEYS } = require('../../constants/auth');

/* ─────────────────────────────────────────────────────────────────────────────
   Generic low-level helpers
───────────────────────────────────────────────────────────────────────────── */

/**
 * Store an OTP in Redis with a TTL.
 * @param {string} key     - Full Redis key
 * @param {string} otp     - The OTP value
 * @param {number} ttlSecs - Time-to-live in seconds
 */
const storeOtp = (key, otp, ttlSecs) => redis.setKey(key, { otp }, ttlSecs);

/**
 * Retrieve OTP data from Redis.
 * @param {string} key
 * @returns {{ otp: string } | false}
 */
const getOtpData = (key) => redis.getKey(key);

/**
 * Delete OTP from Redis (after successful verification).
 * @param {string} key
 */
const deleteOtp = (key) => redis.clearKey(key);

/* ─────────────────────────────────────────────────────────────────────────────
   Attempt tracking (brute-force protection)
───────────────────────────────────────────────────────────────────────────── */

/**
 * Increment failed attempt counter.
 * Returns { count, isLocked } where isLocked = count >= maxAttempts.
 *
 * @param {string} attemptsKey  - Redis key for attempt counter
 * @param {number} maxAttempts  - Max allowed failures before lock
 * @param {number} lockTtlSecs  - How long to hold the lock
 */
const incrementAttempt = async (attemptsKey, maxAttempts, lockTtlSecs) => {
  const existing = await redis.getKey(attemptsKey);
  const count = existing ? existing.count + 1 : 1;
  const isLocked = count >= maxAttempts;

  // Reset TTL each time (sliding window): on lock, use lockTtlSecs
  await redis.setKey(attemptsKey, { count }, isLocked ? lockTtlSecs : lockTtlSecs);
  return { count, isLocked };
};

/**
 * Check if an identifier is currently locked out.
 * @param {string} attemptsKey
 * @param {number} maxAttempts
 * @returns {boolean}
 */
const isLockedOut = async (attemptsKey, maxAttempts) => {
  const data = await redis.getKey(attemptsKey);
  return data && data.count >= maxAttempts;
};

/**
 * Clear attempt counter after a successful verification.
 * @param {string} attemptsKey
 */
const clearAttempts = (attemptsKey) => redis.clearKey(attemptsKey);

/* ─────────────────────────────────────────────────────────────────────────────
   Resend cooldown
───────────────────────────────────────────────────────────────────────────── */

/**
 * Check whether a resend cooldown is active.
 * @param {string} cooldownKey
 * @returns {boolean}
 */
const isCooldownActive = async (cooldownKey) => {
  const data = await redis.getKey(cooldownKey);
  return !!data;
};

/**
 * Set a resend cooldown.
 * @param {string} cooldownKey
 * @param {number} ttlSecs
 */
const setCooldown = (cooldownKey, ttlSecs) => redis.setKey(cooldownKey, { active: true }, ttlSecs);

/* ─────────────────────────────────────────────────────────────────────────────
   High-level domain operations: Onboarding Email OTP
───────────────────────────────────────────────────────────────────────────── */

/**
 * Generate and persist a new email-verification OTP for onboarding.
 * Enforces resend cooldown.
 *
 * @param {string} email
 * @returns {{ otp: string } | { cooldown: true }}
 */
const createEmailVerificationOtp = async (email) => {
  const cooldownKey = `${ONBOARDING_REDIS_KEYS.emailOtp}cooldown:${email}`;
  const onCooldown = await isCooldownActive(cooldownKey);
  if (onCooldown) {
    return { cooldown: true };
  }

  const otp = dataHelper.generateSecureOTP(OTP_CONFIG.length);
  const otpKey = `${ONBOARDING_REDIS_KEYS.emailOtp}${email}`;

  await storeOtp(otpKey, otp, OTP_CONFIG.expirySeconds);
  await setCooldown(cooldownKey, OTP_CONFIG.resendCooldownSeconds);

  return { otp };
};

/**
 * Verify an email-verification OTP.
 *
 * @param {string} email
 * @param {string} submittedOtp
 * @returns {{ success: true } | { invalid: true } | { locked: true } | { expired: true }}
 */
const verifyEmailVerificationOtp = async (email, submittedOtp) => {
  const otpKey = `${ONBOARDING_REDIS_KEYS.emailOtp}${email}`;
  const attemptsKey = `${ONBOARDING_REDIS_KEYS.otpAttempts}${email}`;

  // Check lockout first
  const locked = await isLockedOut(attemptsKey, OTP_CONFIG.maxVerifyAttempts);
  if (locked) return { locked: true };

  const stored = await getOtpData(otpKey);
  if (!stored) return { expired: true };

  if (String(stored.otp) !== String(submittedOtp)) {
    const { maxVerifyAttempts, lockDurationSeconds } = OTP_CONFIG;
    await incrementAttempt(attemptsKey, maxVerifyAttempts, lockDurationSeconds);
    return { invalid: true };
  }

  // Success – clean up Redis
  await deleteOtp(otpKey);
  await clearAttempts(attemptsKey);

  return { success: true };
};

/* ─────────────────────────────────────────────────────────────────────────────
   High-level domain operations: Forgot Password OTP
───────────────────────────────────────────────────────────────────────────── */

/**
 * Generate and persist a forgot-password OTP.
 * @param {string} email
 * @returns {{ otp: string } | { cooldown: true }}
 */
const createForgotPasswordOtp = async (email) => {
  const cooldownKey = `${AUTH_REDIS_KEYS.resendCooldown}forgot:${email}`;
  const onCooldown = await isCooldownActive(cooldownKey);
  if (onCooldown) return { cooldown: true };

  const otp = dataHelper.generateSecureOTP(FORGOT_PASSWORD_CONFIG.otpLength);
  const otpKey = `${AUTH_REDIS_KEYS.forgotOtp}${email}`;

  await storeOtp(otpKey, otp, FORGOT_PASSWORD_CONFIG.otpExpirySeconds);
  await setCooldown(cooldownKey, FORGOT_PASSWORD_CONFIG.resendCooldownSeconds);

  return { otp };
};

/**
 * Verify a forgot-password OTP.
 * On success, the OTP is deleted; the caller must then issue a short-lived
 * "password-reset session token" from user data so the reset-password
 * endpoint can be gated.
 *
 * @param {string} email
 * @param {string} submittedOtp
 * @returns {{ success: true } | { invalid: true } | { locked: true } | { expired: true }}
 */
const verifyForgotPasswordOtp = async (email, submittedOtp) => {
  const otpKey = `${AUTH_REDIS_KEYS.forgotOtp}${email}`;
  const attemptsKey = `${AUTH_REDIS_KEYS.forgotAttempts}${email}`;

  const locked = await isLockedOut(attemptsKey, FORGOT_PASSWORD_CONFIG.maxAttempts);
  if (locked) return { locked: true };

  const stored = await getOtpData(otpKey);
  if (!stored) return { expired: true };

  if (String(stored.otp) !== String(submittedOtp)) {
    await incrementAttempt(
      attemptsKey,
      FORGOT_PASSWORD_CONFIG.maxAttempts,
      FORGOT_PASSWORD_CONFIG.lockDurationSeconds,
    );
    return { invalid: true };
  }

  await deleteOtp(otpKey);
  await clearAttempts(attemptsKey);

  return { success: true };
};

/* ─────────────────────────────────────────────────────────────────────────────
   Refresh token helpers (Redis-backed)
───────────────────────────────────────────────────────────────────────────── */

const { TOKEN_CONFIG } = require('../../constants/auth');

/**
 * Persist a refresh token for a user (keyed by userId + jti).
 * Storing jti enables single-token invalidation without killing all sessions.
 *
 * @param {string} userId
 * @param {string} jti - JWT ID (unique per token)
 * @param {string} token - The signed refresh token string
 */
const storeRefreshToken = (userId, jti, token) => {
  const key = `${AUTH_REDIS_KEYS.refreshToken}${userId}:${jti}`;
  return redis.setKey(key, { token }, TOKEN_CONFIG.refreshTokenTTL);
};

/**
 * Retrieve a refresh token by userId + jti.
 * @param {string} userId
 * @param {string} jti
 * @returns {{ token: string } | false}
 */
const getRefreshToken = (userId, jti) => {
  const key = `${AUTH_REDIS_KEYS.refreshToken}${userId}:${jti}`;
  return redis.getKey(key);
};

/**
 * Revoke a single refresh token (logout one device).
 * @param {string} userId
 * @param {string} jti
 */
const revokeRefreshToken = (userId, jti) => {
  const key = `${AUTH_REDIS_KEYS.refreshToken}${userId}:${jti}`;
  return redis.clearKey(key);
};

/**
 * Revoke ALL refresh tokens for a user (logout all devices).
 * @param {string} userId
 */
const revokeAllRefreshTokens = async (userId) => {
  const pattern = `${AUTH_REDIS_KEYS.refreshToken}${userId}:*`;
  const keys = await redis.getAllSpecificKeys(pattern.replace('*', ''));
  if (keys && keys.length) {
    await Promise.all(keys.map((k) => redis.clearKey(k)));
  }
};

module.exports = {
  // Email OTP
  createEmailVerificationOtp,
  verifyEmailVerificationOtp,

  // Forgot password OTP
  createForgotPasswordOtp,
  verifyForgotPasswordOtp,

  // Refresh token
  storeRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};
