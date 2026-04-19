/**
 * User Routes
 *
 * Defines all user-related API endpoints.
 * Route groups:
 *  - Onboarding (public)     POST /register, /resend-otp, /verify-email
 *  - Auth (public)           POST /login, /refresh-token, /forgot-password, ...
 *  - Google OAuth (public)   POST /google-login
 *  - Protected user routes   GET  /profile, POST /change-password, GET /logout, DELETE /
 *  - Image uploads           POST /upload-image, /upload-bulk-images, /delete-image, ...
 *  - Admin                   GET  /
 */

const express = require('express');
const userController = require('../resources/v1/users/users.controller');
const UserModel = require('../resources/v1/users/users.model');
const userValidation = require('../resources/v1/users/users.validation');
const { auth } = require('../middleware/v1/authorize');

/* ─── Route groups ───────────────────────────────────────────────────────── */

/**
 * Task 1 – Onboarding (all public)
 */
const createOnboardingRoutes = (router) => {
  // Step 1: Register new user (profile picture optional)
  router.post(
    '/register',
    [userValidation.register],
    userController.register,
  );

  // Step 2: Resend email OTP (rate-limited via Redis cooldown)
  router.post('/resend-otp', [userValidation.resendOtp], userController.resendOtp);

  // Step 3: Verify email OTP → returns token pair
  router.post('/verify-email', [userValidation.verifyEmail], userController.verifyEmail);

  // Step 4, 5, 6: Protected onboarding steps (requires access token from step 3)
  router.post('/onboarding/profile', [auth(), userValidation.onboardingProfile], userController.onboardingProfile);
  router.post('/onboarding/goals', [auth(), userValidation.onboardingGoals], userController.onboardingGoals);
  router.post('/onboarding/training', [auth(), userValidation.onboardingTraining], userController.onboardingTraining);

  return router;
};

/**
 * Task 1b / 3 – Auth & Password Management (all public)
 */
const createAuthRoutes = (router) => {
  // Login → returns access + refresh tokens
  router.post('/login', [userValidation.login], userController.login);

  // Refresh token rotation
  router.post('/refresh-token', [userValidation.refreshToken], userController.refreshToken);

  // Forgot password flow
  router.post('/forgot-password', [userValidation.forgotPassword], userController.forgotPassword);
  router.post('/forgot-password/verify-otp', [userValidation.verifyForgotPasswordOTP], userController.verifyForgotPasswordOTP);
  router.post('/reset-password', [userValidation.resetPassword], userController.resetPassword);

  return router;
};

/**
 * Task 4 – Google OAuth (public)
 */
const createGoogleRoutes = (router) => {
  router.post('/google-login', [userValidation.googleLogin], userController.googleLogin);
  return router;
};

/**
 * Protected – requires valid access token
 */
const createProtectedUserRoutes = (router) => {
  router.get('/profile', [auth()], userController.getUserProfile);
  router.put('/profile', [auth(), userValidation.updateProfile], userController.updateProfile);
  router.post('/change-password', [auth(), userValidation.changePassword], userController.changePassword);
  router.get('/logout', [auth()], userController.logout);
  router.delete('/', [auth()], userController.deleteOne);
  return router;
};

/**
 * Image upload routes (protected)
 */
const createImageUploadRoutes = (router) => {
  // AWS S3
  router.post('/delete-image-aws', [userValidation.deleteImageAWS], userController.deleteImageAWS);
  router.post('/generate-aws-presigned-url', [auth(), userValidation.generatePresignedUrl], userController.generatePresignedUrl);

  return router;
};

/**
 * Admin-only routes
 */
const createAdminRoutes = (router) => {
  router.get('/', [auth(UserModel.roles.ADMIN)], userController.getAllWithPagination);
  return router;
};

/* ─── Initialise ─────────────────────────────────────────────────────────── */

const initializeUserRoutes = () => {
  const router = express.Router();

  createOnboardingRoutes(router);
  createAuthRoutes(router);
  createGoogleRoutes(router);
  createProtectedUserRoutes(router);
  createImageUploadRoutes(router);
  createAdminRoutes(router);

  return router;
};

module.exports = initializeUserRoutes();
