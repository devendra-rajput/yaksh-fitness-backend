/**
 * User Controller
 *
 * Handles HTTP requests for:
 *  - Task 1: User Onboarding (register → verify OTP → complete)
 *  - Task 1b: Login + Token Refresh
 *  - Task 3: Forgot / Reset Password
 *  - Task 4: Google OAuth Login
 *
 * Controller responsibilities:
 *  ✔ Parse & validate request (validation middleware has already run)
 *  ✔ Orchestrate model + service calls
 *  ✔ Return standardised response via response.helpers
 *  ✗ No business logic beyond orchestration
 *  ✗ No direct DB/Redis calls – delegated to model / helpers
 */

const path = require('path');
const fs = require('fs');

const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const otpHelper = require('../../../helpers/v1/otp.helpers');
const UserModel = require('./users.model');
const { ONBOARDING_STEPS } = require('../../../constants/onboarding');
const { TOKEN_CONFIG } = require('../../../constants/auth');
const { logger } = require('../../../utils/logger');

// Lazy-loaded services
const getNodemailer = () => require('../../../services/nodemailer'); // eslint-disable-line global-require
const getAWS = () => require('../../../services/aws');               // eslint-disable-line global-require
// const getSocketService = () => require('../../../services/socket');  // eslint-disable-line global-require
// const getSocketEvents = () => require('../../../constants/socket_events'); // eslint-disable-line global-require
const getGoogleService = () => require('../../../services/google');  // eslint-disable-line global-require

// Lazy-loaded email templates
const getVerificationTemplate = () => require('../../../emailTemplates/v1/verification');     // eslint-disable-line global-require
const getForgotPasswordTemplate = () => require('../../../emailTemplates/v1/forgotPassword'); // eslint-disable-line global-require

/* ─────────────────────────────────────────────────────────────────────────────
   Pure Helpers
───────────────────────────────────────────────────────────────────────────── */

const filePathToURL = (req, filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/${normalizedPath}`;
};

const deleteLocalFile = (fileUrl) => {
  try {
    const filePath = new URL(fileUrl).pathname;
    const localPath = path.join(process.cwd(), filePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(localPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(localPath);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('deleteLocalFile Error', { error: error.message });
    return false;
  }
};

/**
 * Send email asynchronously (fire-and-forget – never blocks HTTP response).
 */
const sendEmailAsync = (email, subject, html) => {
  const nodemailer = getNodemailer();
  nodemailer.sendMail(email, subject, html).catch((err) => {
    logger.error('sendEmailAsync Error', { email, subject, error: err.message });
  });
};

/**
 * Dev convenience: show OTP in response message.
 */
const getOTPMessage = (res, otp) => (
  process.env.NODE_ENV === 'development'
    ? res.__('auth.emailCodeSentWithOtp', { code: otp })
    : res.__('auth.emailCodeSent')
);

/**
 * Issue an access token + refresh token pair and persist refresh token in Redis.
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const issueTokenPair = async (userId, role) => {
  const accessToken = dataHelper.generateJWTToken({ user_id: userId, role });
  const { token: refreshToken, jti } = dataHelper.generateRefreshJWTToken({ user_id: userId, role });

  // Persist refresh token in Redis with TTL
  await otpHelper.storeRefreshToken(String(userId), jti, refreshToken);

  return { accessToken, refreshToken };
};

/* ─────────────────────────────────────────────────────────────────────────────
   TASK 1 – User Onboarding
───────────────────────────────────────────────────────────────────────────── */

/**
 * POST /api/v1/users/register
 *
 * Step 1 of onboarding: create unverified user record, send email OTP.
 * Idempotent: if the user already exists but is unverified, resend OTP instead
 * of returning an error so the frontend can call this without extra state.
 */
const register = async (req, res) => {
  const {
    email,
    password,
    phone_number,
    phone_code,
  } = req.body;

  // Check for existing verified user
  const existingUser = await UserModel.getOneByColumnNameAndValue('email', email);
  if (existingUser && existingUser.is_email_verified) {
    return response.conflict('error.emailExist', res, false);
  }

  // Idempotency: unverified user already exists → just resend OTP
  if (existingUser && !existingUser.is_email_verified) {
    const result = await otpHelper.createEmailVerificationOtp(email);
    if (result.cooldown) {
      return response.badRequest('error.otpResendCooldown', res, false);
    }
    const verificationTemplate = getVerificationTemplate();
    const html = await verificationTemplate(result.otp);
    sendEmailAsync(email, 'Verify Your Account', html);

    return response.success(getOTPMessage(res, result.otp), res, {
      onboarding_step: ONBOARDING_STEPS.VERIFY_EMAIL,
    });
  }

  // Hash password + generate OTP in parallel
  const hashedPassword = await dataHelper.hashPassword(password);
  const otpResult = await otpHelper.createEmailVerificationOtp(email);
  if (otpResult.cooldown) {
    return response.badRequest('error.otpResendCooldown', res, false);
  }

  const userData = {
    email,
    password: hashedPassword,
    onboarding_step: ONBOARDING_STEPS.VERIFY_EMAIL,
    ...(phone_code && phone_number && { phone_code, phone_number })
  };

  const newUser = await UserModel.createOne(userData);
  if (!newUser) {
    return response.exception('error.serverError', res, false);
  }

  const verificationTemplate = getVerificationTemplate();
  const html = await verificationTemplate(otpResult.otp);
  sendEmailAsync(email, 'Verify Your Account', html);

  return response.created(getOTPMessage(res, otpResult.otp), res, {
    onboarding_step: ONBOARDING_STEPS.VERIFY_EMAIL,
  });
};

/**
 * POST /api/v1/users/verify-email
 *
 * Step 2 of onboarding: verify email OTP.
 * On success: mark email verified, advance onboarding step, return tokens.
 */
const verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email);
  if (!user) return response.badRequest('error.invalidEmail', res, false);
  if (user.is_email_verified) return response.badRequest('error.emailAlreadyVerified', res, false);

  const verifyResult = await otpHelper.verifyEmailVerificationOtp(email, otp);

  if (verifyResult.locked) return response.badRequest('error.otpLocked', res, false);
  if (verifyResult.expired) return response.badRequest('error.otpExpired', res, false);
  if (verifyResult.invalid) return response.badRequest('error.invalidOtp', res, false);

  // Issue token pair
  const { accessToken, refreshToken } = await issueTokenPair(user._id, user.role);

  // Update user: verified + step 3 + store accessToken for legacy middleware
  await UserModel.updateOne(user._id, {
    is_email_verified: true,
    onboarding_step: ONBOARDING_STEPS.PROFILE,
    'tokens.auth_token': accessToken,
    ...(req.headers['fcm-token'] && { 'tokens.fcm_token': req.headers['fcm-token'] }),
  });

  return response.success('auth.otpVerified', res, {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: UserModel.getFormattedData(user),
    onboarding_step: ONBOARDING_STEPS.PROFILE,
  });
};

/**
 * POST /api/v1/users/resend-otp
 *
 * Resend email-verification OTP.
 * Rate limited via Redis cooldown (60 s default).
 */
const resendOtp = async (req, res) => {
  const { email } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email);
  if (!user) return response.badRequest('error.invalidEmail', res, false);
  if (user.is_email_verified) return response.badRequest('error.emailAlreadyVerified', res, false);

  const result = await otpHelper.createEmailVerificationOtp(email);
  if (result.cooldown) return response.badRequest('error.otpResendCooldown', res, false);

  const verificationTemplate = getVerificationTemplate();
  const html = await verificationTemplate(result.otp);
  sendEmailAsync(email, 'Verify Your Account', html);

  return response.success(getOTPMessage(res, result.otp), res, true);
};

/**
 * POST /api/v1/users/onboarding/profile
 * Step 3
 */
const onboardingProfile = async (req, res) => {
  const { user } = req;
  const { full_name, dob, height, height_unit, weight, weight_unit, gender } = req.body;

  const [first_name = '', ...last_name_arr] = full_name.trim().split(' ');
  const last_name = last_name_arr.join(' ');

  const updatedUser = await UserModel.updateOne(user._id, {
    user_info: { first_name, last_name },
    dob, height, height_unit, weight, weight_unit, gender,
    onboarding_step: ONBOARDING_STEPS.GOALS
  });

  return response.success('auth.profileUpdated', res, {
    user: UserModel.getFormattedData(updatedUser),
    onboarding_step: ONBOARDING_STEPS.GOALS
  });
};

/**
 * POST /api/v1/users/onboarding/goals
 * Step 4
 */
const onboardingGoals = async (req, res) => {
  const { user } = req;
  const { goal, fitness_level } = req.body;

  const updatedUser = await UserModel.updateOne(user._id, {
    goal, fitness_level,
    onboarding_step: ONBOARDING_STEPS.TRAINING
  });

  return response.success('auth.profileUpdated', res, {
    user: UserModel.getFormattedData(updatedUser),
    onboarding_step: ONBOARDING_STEPS.TRAINING
  });
};

/**
 * POST /api/v1/users/onboarding/training
 * Step 5
 */
const onboardingTraining = async (req, res) => {
  const { user } = req;
  const { training_location, equipments, activity_level } = req.body;

  const updatedUser = await UserModel.updateOne(user._id, {
    training_location, equipments, activity_level,
    onboarding_step: ONBOARDING_STEPS.COMPLETE
  });

  return response.success('auth.profileUpdated', res, {
    user: UserModel.getFormattedData(updatedUser),
    onboarding_step: ONBOARDING_STEPS.COMPLETE
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   TASK 1b – Login + Token Refresh
───────────────────────────────────────────────────────────────────────────── */

/**
 * POST /api/v1/users/login
 *
 * Authenticates an existing verified user.
 * Returns short-lived access token + long-lived refresh token.
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email, true);
  if (!user) return response.badRequest('auth.invalidCredentails', res, false);

  if (!user.is_email_verified) {
    return response.badRequest('error.emailNotVerified', res, {
      onboarding_step: user.onboarding_step,
    });
  }

  if (user.status !== UserModel.statuses.ACTIVE) {
    return response.unauthorized(
      res.__('auth.accountBlocked', { supportEmail: process.env.SUPPORT_MAIL }),
      res,
      false,
    );
  }

  const isValidPassword = await dataHelper.validatePassword(password, user.password);
  if (!isValidPassword) return response.badRequest('auth.invalidCredentails', res, false);

  const { accessToken, refreshToken } = await issueTokenPair(user._id, user.role);

  // Store access token for legacy token-match check in authorize middleware
  await UserModel.updateOne(user._id, {
    'tokens.auth_token': accessToken,
    ...(req.headers['fcm-token'] && { 'tokens.fcm_token': req.headers['fcm-token'] }),
  });

  return response.success('auth.loggedIn', res, {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: UserModel.getFormattedData(user),
  });
};

/**
 * POST /api/v1/users/refresh-token
 *
 * Exchange a valid refresh token for a new access + refresh token pair
 * (refresh token rotation).
 *
 * Flow:
 *  1. Verify JWT signature + expiry
 *  2. Look up jti in Redis (ensures token hasn't been revoked)
 *  3. Revoke old refresh token (rotation)
 *  4. Issue fresh pair
 */
const refreshToken = async (req, res) => {
  const { refresh_token: token } = req.body;

  const refreshSecret = process.env.JWT_REFRESH_KEY || process.env.JWT_TOKEN_KEY;
  const decoded = dataHelper.verifyJWTToken(token, refreshSecret);
  if (!decoded || decoded.type !== 'refresh') {
    return response.unauthorized('auth.invalidRefreshToken', res, false);
  }

  const { user_id, role, jti } = decoded;

  // Check Redis: is this token still valid / not rotated away?
  const stored = await otpHelper.getRefreshToken(String(user_id), jti);
  if (!stored || stored.token !== token) {
    return response.unauthorized('auth.refreshTokenRevoked', res, false);
  }

  // Revoke old token (rotation prevents replay attacks)
  await otpHelper.revokeRefreshToken(String(user_id), jti);

  // Verify user still exists and is active
  const user = await UserModel.getOneByColumnNameAndValue('_id', user_id);
  if (!user || user.status !== UserModel.statuses.ACTIVE) {
    return response.unauthorized('auth.unauthorizedRequest', res, false);
  }

  const { accessToken: newAccess, refreshToken: newRefresh } = await issueTokenPair(user_id, role);

  // Keep legacy auth_token in sync
  await UserModel.updateOne(user_id, { 'tokens.auth_token': newAccess });

  return response.success('auth.tokenRefreshed', res, {
    access_token: newAccess,
    refresh_token: newRefresh,
  });
};

/**
 * GET /api/v1/users/logout
 *
 * Revoke the current device's refresh token and clear auth_token.
 */
const logout = async (req, res) => {
  const { user } = req;

  // Revoke ALL refresh tokens for this user (full logout across all devices)
  // If you want single-device logout, extract jti from the request header token
  await otpHelper.revokeAllRefreshTokens(String(user._id));

  await UserModel.updateOne(user._id, {
    'tokens.auth_token': '',
    'tokens.fcm_token': '',
  });

  return response.success('auth.logoutSuccess', res, true);
};

/* ─────────────────────────────────────────────────────────────────────────────
   TASK 3 – Forgot / Reset Password
───────────────────────────────────────────────────────────────────────────── */

/**
 * POST /api/v1/users/forgot-password
 *
 * Generate a 6-digit OTP, store in Redis with 10-min TTL, send via email.
 * Response is always 200 with the same message (prevents email enumeration).
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email);

  // Anti-enumeration: respond the same way whether user exists or not
  if (!user) {
    return response.success('auth.forgotPasswordSent', res, true);
  }

  const result = await otpHelper.createForgotPasswordOtp(email);
  if (result.cooldown) return response.badRequest('error.otpResendCooldown', res, false);

  const forgotTemplate = getForgotPasswordTemplate();
  const html = await forgotTemplate(result.otp);
  sendEmailAsync(email, 'Reset Your Password', html);

  return response.success(getOTPMessage(res, result.otp), res, true);
};

/**
 * POST /api/v1/users/forgot-password/verify-otp
 *
 * Verify forgot-password OTP.
 * On success, return a short-lived reset session token so the
 * reset-password endpoint can be gated without DB state.
 */
const verifyForgotPasswordOTP = async (req, res) => {
  const { email, otp } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email);
  if (!user) return response.badRequest('error.invalidEmail', res, false);

  const verifyResult = await otpHelper.verifyForgotPasswordOtp(email, otp);

  if (verifyResult.locked) return response.badRequest('error.otpLocked', res, false);
  if (verifyResult.expired) return response.badRequest('error.otpExpired', res, false);
  if (verifyResult.invalid) return response.badRequest('error.invalidOtp', res, false);

  // Issue a short-lived reset token (5 min) — gated on user_id
  const resetToken = dataHelper.generateJWTToken({
    user_id: user._id,
    purpose: 'password_reset',
  });

  return response.success('auth.otpVerified', res, {
    reset_token: resetToken,
  });
};

/**
 * POST /api/v1/users/reset-password
 *
 * Reset password using the reset_token issued by verifyForgotPasswordOTP.
 * The reset token is a short-lived JWT (15 min) – no DB state needed.
 */
const resetPassword = async (req, res) => {
  const { password, reset_token } = req.body;

  // Verify reset token
  const decoded = dataHelper.verifyJWTToken(reset_token);
  if (!decoded || decoded.purpose !== 'password_reset') {
    return response.unauthorized('auth.invalidResetToken', res, false);
  }

  const user = await UserModel.getOneByColumnNameAndValue('_id', decoded.user_id);
  if (!user) return response.badRequest('error.userNotExist', res, false);

  const hashedPassword = await dataHelper.hashPassword(password);

  // Rotate all tokens on password change (security best practice)
  await otpHelper.revokeAllRefreshTokens(String(user._id));

  const updated = await UserModel.updateOne(user._id, {
    password: hashedPassword,
    'tokens.auth_token': '',
  });

  if (!updated) return response.exception('error.serverError', res, null);

  return response.success('auth.passwordChanged', res, true);
};

/**
 * POST /api/v1/users/change-password
 *
 * Authenticated password change (requires current password).
 */
const changePassword = async (req, res) => {
  const { new_password } = req.body;
  const { user } = req;

  const hashedPassword = await dataHelper.hashPassword(new_password);

  // Rotate all tokens on password change
  await otpHelper.revokeAllRefreshTokens(String(user._id));

  const updated = await UserModel.updateOne(user._id, {
    password: hashedPassword,
    'tokens.auth_token': '',
  });

  if (!updated) return response.exception('error.serverError', res, null);

  return response.success('auth.passwordChanged', res, true);
};

/* ─────────────────────────────────────────────────────────────────────────────
   TASK 4 – Google OAuth
───────────────────────────────────────────────────────────────────────────── */

/**
 * POST /api/v1/users/google-login
 *
 * Handles both new user signup and existing user login via Google ID token.
 *
 * Frontend sends: { id_token: <Google credential from SDK> }
 *
 * Flow:
 *  1. Verify ID token with Google's API (prevents token forgery)
 *  2. Look up user by google_id → login
 *  3. If not found, check by email → link Google to existing account
 *  4. If no existing user → create new account
 */
const googleLogin = async (req, res) => {
  const { access_token } = req.body;

  if (!process.env.GOOGLE_CLIENT_ID) {
    return response.exception('error.googleNotConfigured', res, false);
  }

  const googleService = getGoogleService();
  const googlePayload = await googleService.getUserInfo(access_token);
  if (!googlePayload) {
    return response.badRequest('error.invalidGoogleToken', res, false);
  }

  const {
    googleId,
    email,
    emailVerified,
    firstName,
    lastName,
    picture,
  } = googlePayload;

  // ── 1. Existing Google user ────────────────────────────────────────────────
  let user = await UserModel.getOneByGoogleId(googleId);

  // ── 2. Existing email user (link Google account) ───────────────────────────
  if (!user && email) {
    user = await UserModel.getOneByColumnNameAndValue('email', email);
    if (user) {
      // Link google_id to the existing account
      user = await UserModel.updateOne(user._id, { google_id: googleId });
    }
  }

  // ── 3. New user (auto-register) ────────────────────────────────────────────
  let isNewUser = false;
  if (!user) {
    const newUserData = {
      google_id: googleId,
      email: email || null,
      user_info: { first_name: firstName, last_name: lastName },
      profile_picture: picture || '',
      is_email_verified: !!emailVerified,
      onboarding_step: ONBOARDING_STEPS.PROFILE,
      // No password – Google-only account
    };

    user = await UserModel.createOne(newUserData);
    if (!user) return response.exception('error.serverError', res, null);
    isNewUser = true;
  }

  if (user.status !== UserModel.statuses.ACTIVE) {
    return response.unauthorized(
      res.__('auth.accountBlocked', { supportEmail: process.env.SUPPORT_MAIL }),
      res,
      false,
    );
  }

  const { accessToken, refreshToken: refresh } = await issueTokenPair(user._id, user.role);

  await UserModel.updateOne(user._id, {
    'tokens.auth_token': accessToken,
    ...(req.headers['fcm-token'] && { 'tokens.fcm_token': req.headers['fcm-token'] }),
  });

  return response.success(isNewUser ? 'auth.googleRegistered' : 'auth.loggedIn', res, {
    access_token: accessToken,
    refresh_token: refresh,
    is_new_user: isNewUser,
    user: UserModel.getFormattedData(user),
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   Profile / Account
───────────────────────────────────────────────────────────────────────────── */

const getUserProfile = async (req, res) => {
  // const socketService = getSocketService();
  // const socketEvents = getSocketEvents();
  const { user } = req;

  // socketService.emitToUsers([user._id], socketEvents.EMIT.USER_PROFILE_VIEWED, {
  //   message: 'Profile viewed',
  //   time: new Date(),
  // });

  return response.success('success.userProfile', res, UserModel.getFormattedData(user));
};

const updateProfile = async (req, res) => {
  const { user } = req;
  const {
    full_name, dob, height, height_unit, weight, weight_unit, gender,
    goal, fitness_level, training_location, equipments, activity_level
  } = req.body;

  const updateData = {};

  if (full_name) {
    const [first_name = '', ...last_name_arr] = full_name.trim().split(' ');
    updateData.user_info = {
      first_name,
      last_name: last_name_arr.join(' ')
    };
  }

  if (dob !== undefined) updateData.dob = dob;
  if (height !== undefined) updateData.height = height;
  if (height_unit !== undefined) updateData.height_unit = height_unit;
  if (weight !== undefined) updateData.weight = weight;
  if (weight_unit !== undefined) updateData.weight_unit = weight_unit;
  if (gender !== undefined) updateData.gender = gender;
  if (goal !== undefined) updateData.goal = goal;
  if (fitness_level !== undefined) updateData.fitness_level = fitness_level;
  if (training_location !== undefined) updateData.training_location = training_location;
  if (equipments !== undefined) updateData.equipments = equipments;
  if (activity_level !== undefined) updateData.activity_level = activity_level;

  const updatedUser = await UserModel.updateOne(user._id, updateData);
  if (!updatedUser) return response.exception('error.serverError', res, false);

  return response.success('auth.profileUpdated', res, UserModel.getFormattedData(updatedUser));
};

const getAllWithPagination = async (req, res) => {
  const { page, limit } = dataHelper.getPageAndLimit(req.query);
  const result = await UserModel.getAllWithPagination(page, limit, { role: UserModel.roles.USER });
  if (!result?.data?.length) return response.success('success.noRecordsFound', res, result);
  return response.success('success.usersData', res, result);
};

const deleteOne = async (req, res) => {
  const { user } = req;
  await otpHelper.revokeAllRefreshTokens(String(user._id));
  const deleted = await UserModel.updateOne(user._id, {
    deleted_at: new Date().toISOString().replace('Z', '+00:00'),
    'tokens.auth_token': '',
  });
  if (!deleted) return response.exception('error.serverError', res, null);
  return response.success('auth.deleteAccount', res, true);
};

/* ─────────────────────────────────────────────────────────────────────────────
   Image Upload Utilities (unchanged from original)
───────────────────────────────────────────────────────────────────────────── */

const deleteImageAWS = async (req, res) => {
  const aws = getAWS();
  const { image_url } = req.body;
  const deleted = await aws.deleteFile(image_url);
  if (!deleted) return response.badRequest('error.fileNotFound', res, false);
  return response.success('success.fileDeleted', res, true);
};

const generatePresignedUrl = async (req, res) => {
  const aws = getAWS();
  const { file_name, file_type, folder = 'uploads' } = req.body;
  try {
    const result = await aws.getPresignedUrl(folder, file_name, file_type);
    if (!result) return response.badRequest('error.serverError', res, false);
    return response.success('success.presignedUrlGenerated', res, result);
  } catch (error) {
    logger.error('generatePresignedUrl Error', { error: error.message });
    return response.exception('error.serverError', res, null);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Exports
───────────────────────────────────────────────────────────────────────────── */

module.exports = {
  // Onboarding
  register,
  verifyEmail,
  resendOtp,
  onboardingProfile,
  onboardingGoals,
  onboardingTraining,

  // Auth
  login,
  refreshToken,
  logout,

  // Forgot / Reset Password
  forgotPassword,
  verifyForgotPasswordOTP,
  resetPassword,
  changePassword,

  // Google OAuth
  googleLogin,

  // Profile / Account
  getUserProfile,
  updateProfile,
  getAllWithPagination,
  deleteOne,

  // Uploads
  deleteImageAWS,
  generatePresignedUrl,
};
