/**
 * User Routes
 * Defines all user-related API endpoints
 */

const express = require('express');
const userController = require('../resources/v1/users/users.controller');
const UserModel = require('../resources/v1/users/users.model');
const userValidation = require('../resources/v1/users/users.validation');
const { auth } = require('../middleware/v1/authorize');
const uploadUtils = require('../utils/upload');
const aws = require('../services/aws');

/**
 * Upload configuration constants
 */
const UPLOAD_CONFIG = {
  validExtensions: /jpg|jpeg|png|heic/,
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  maxBulkFiles: 5,
};

/**
 * Get upload directory path
 */
const getUploadDirectory = () => {
  const date = new Date();
  return `uploads/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

/**
 * Create file upload middleware
 */
const createUploadMiddleware = (directory, fieldName = 'image', isMultiple = false) => {
  const upload = uploadUtils.uploadFile(
    UPLOAD_CONFIG.validExtensions,
    UPLOAD_CONFIG.maxFileSize,
    directory,
  );

  return isMultiple
    ? upload.array(fieldName, UPLOAD_CONFIG.maxBulkFiles)
    : upload.single(fieldName);
};

/**
 * Authentication Routes (Public)
 */
const createAuthRoutes = (router) => {
  // User registration
  router.post(
    '/create',
    [
      createUploadMiddleware(getUploadDirectory()),
      userValidation.createOne,
    ],
    userController.createOne,
  );

  // Resend OTP
  router.post(
    '/resend-otp',
    [userValidation.resendOtp],
    userController.resendOtp,
  );

  // Verify OTP
  router.post(
    '/verify',
    [userValidation.verifyOtp],
    userController.verifyOtp,
  );

  // User login
  router.post(
    '/login',
    [userValidation.userLogin],
    userController.userLogin,
  );

  // Forgot password
  router.post(
    '/forgot-password',
    [userValidation.forgotPassword],
    userController.forgotPassword,
  );

  // Verify forgot password OTP
  router.post(
    '/forgot-password/verify-otp',
    [userValidation.verifyForgotPasswordOTP],
    userController.verifyForgotPasswordOTP,
  );

  // Reset password
  router.post(
    '/reset-password',
    [userValidation.resetPassword],
    userController.resetPassword,
  );

  return router;
};

/**
 * Protected User Routes
 */
const createProtectedUserRoutes = (router) => {
  // Get user profile
  router.get(
    '/profile',
    [auth()],
    userController.getUserProfile,
  );

  // Change password
  router.post(
    '/change-password',
    [auth(), userValidation.changePassword],
    userController.changePassword,
  );

  // Logout
  router.get(
    '/logout',
    [auth()],
    userController.logout,
  );

  // Delete account
  router.delete(
    '/',
    [auth()],
    userController.deleteOne,
  );

  return router;
};

/**
 * Image Upload Routes
 */
const createImageUploadRoutes = (router) => {
  const uploadDir = getUploadDirectory();

  // Upload single image (local)
  router.post(
    '/upload-image',
    [
      auth(),
      createUploadMiddleware(uploadDir),
    ],
    userController.uploadImage,
  );

  // Upload multiple images (local)
  router.post(
    '/upload-bulk-images',
    [
      auth(),
      uploadUtils.setMaxFileLimit(UPLOAD_CONFIG.maxBulkFiles),
      createUploadMiddleware(uploadDir, 'images', true),
    ],
    userController.uploadBulkImages,
  );

  // Delete image
  router.post(
    '/delete-image',
    [userValidation.deleteImage],
    userController.deleteImage,
  );

  return router;
};

/**
 * AWS S3 Upload Routes
 */
const createAWSUploadRoutes = (router) => {
  // Upload image to AWS S3
  router.post(
    '/upload-image-aws',
    [
      auth(),
      createUploadMiddleware('uploads/temp'),
      aws.uploadFile,
    ],
    userController.uploadImageAWS,
  );

  // Delete image from AWS S3
  router.post(
    '/delete-image-aws',
    [userValidation.deleteImageAWS],
    userController.deleteImageAWS,
  );

  // Generate AWS presigned URL
  router.post(
    '/generate-aws-presigned-url',
    [auth(), userValidation.generatePresignedUrl],
    userController.generatePresignedUrl,
  );

  return router;
};

/**
 * Admin Routes
 */
const createAdminRoutes = (router) => {
  // Get all users with pagination
  router.get(
    '/',
    [auth(UserModel.roles.ADMIN)],
    userController.getAllWithPagination,
  );

  return router;
};

/**
 * Initialize all user routes
 */
const initializeUserRoutes = () => {
  const router = express.Router();

  // Register route groups
  createAuthRoutes(router);
  createProtectedUserRoutes(router);
  createImageUploadRoutes(router);
  createAWSUploadRoutes(router);
  createAdminRoutes(router);

  return router;
};

/**
 * Export configured router
 */
module.exports = initializeUserRoutes();
