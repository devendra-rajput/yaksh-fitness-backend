/**
 * Auth Constants
 * JWT, refresh token, and password reset constants.
 */

const AUTH_REDIS_KEYS = Object.freeze({
  refreshToken: 'auth:refresh:',        // auth:refresh:<userId>
  forgotOtp: 'auth:forgot:otp:',        // auth:forgot:otp:<email>
  forgotAttempts: 'auth:forgot:attempts:', // auth:forgot:attempts:<email>
  resendCooldown: 'auth:resend:cooldown:',  // auth:resend:cooldown:<email>
});

const TOKEN_CONFIG = Object.freeze({
  accessTokenExpiresIn: '15m',     // Short-lived access token
  refreshTokenExpiresIn: '30d',    // Long-lived refresh token (stored in Redis too)
  refreshTokenTTL: 30 * 24 * 60 * 60, // 30 days in seconds (Redis TTL)
});

const FORGOT_PASSWORD_CONFIG = Object.freeze({
  otpLength: 6,
  otpExpirySeconds: 10 * 60,       // 10 minutes
  maxAttempts: 5,
  lockDurationSeconds: 15 * 60,    // 15 minutes brute-force lock
  resendCooldownSeconds: 60,
});

const GOOGLE_CONFIG = Object.freeze({
  clientId: process.env.GOOGLE_CLIENT_ID,
});

module.exports = {
  AUTH_REDIS_KEYS,
  TOKEN_CONFIG,
  FORGOT_PASSWORD_CONFIG,
  GOOGLE_CONFIG,
};
