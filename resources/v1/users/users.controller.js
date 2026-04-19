/**
 * User Controller
 * Handles HTTP requests for user operations
 */

const path = require('path');
const fs = require('fs');

const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const UserModel = require('./users.model');

// Lazy load dependencies
// eslint-disable-next-line global-require
const getNodemailer = () => require('../../../services/nodemailer');
// eslint-disable-next-line global-require
const getAWS = () => require('../../../services/aws');
// eslint-disable-next-line global-require
const getSocketService = () => require('../../../services/socket');
// eslint-disable-next-line global-require
const getSocketEvents = () => require('../../../constants/socket_events');

// Lazy load email templates
// eslint-disable-next-line global-require
const getVerificationTemplate = () => require('../../../emailTemplates/v1/verification');
// eslint-disable-next-line global-require
const getForgotPasswordTemplate = () => require('../../../emailTemplates/v1/forgotPassword');

/**
 * Helper Functions
 */

/**
 * Convert file path to public URL
 */
const filePathToURL = (req, filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/${normalizedPath}`;
};

/**
 * Delete local file
 * @param {string} fileUrl - File URL to delete
 * @returns {boolean} True if deleted
 */
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
    console.error('Error deleting file:', error.message);
    return false;
  }
};

/**
 * Send email asynchronously (fire and forget)
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 */
const sendEmailAsync = (email, subject, html) => {
  const nodemailer = getNodemailer();
  nodemailer.sendMail(email, subject, html).catch((error) => {
    console.error('Error sending email:', error.message);
  });
};

/**
 * Get success message with OTP (development only)
 */
const getOTPMessage = (res, otp) => (process.env.NODE_ENV === 'development'
  ? res.__('auth.emailCodeSentWithOtp', { code: otp })
  : res.__('auth.emailCodeSent'));

/**
 * Controller Functions
 */

/**
 * Create new user
 */
const createOne = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    password,
    phone_number,
    phone_code,
  } = req.body;

  // Check if user exists
  const isUserExist = await UserModel.isUserExist('email', email);
  if (isUserExist) {
    return response.conflict('error.emailExist', res, false);
  }

  // Hash password and generate OTP
  const [hashedPassword, emailVerificationOtp] = await Promise.all([
    dataHelper.hashPassword(password),
    dataHelper.generateSecureOTP(6),
  ]);

  // Build user data
  const userData = {
    email,
    password: hashedPassword,
    user_info: { first_name, last_name },
    otp: { email_verification: emailVerificationOtp },
    ...(phone_code && phone_number && { phone_code, phone_number }),
    ...(req?.file?.path && { profile_picture: filePathToURL(req, req.file.path) }),
  };

  // Create user
  const hasCreated = await UserModel.createOne(userData);
  if (!hasCreated) {
    // Cleanup uploaded file if user creation failed
    if (userData.profile_picture) {
      deleteLocalFile(userData.profile_picture);
    }
    return response.exception('error.serverError', res, false);
  }

  // Send verification email asynchronously
  const verificationTemplate = getVerificationTemplate();
  const html = await verificationTemplate(emailVerificationOtp);
  sendEmailAsync(email, 'Account Verification', html);

  const message = getOTPMessage(res, emailVerificationOtp);
  return response.created(message, res, true);
};

/**
 * Resend OTP
 */
const resendOtp = async (req, res) => {
  const { email } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email);
  if (!user) {
    return response.badRequest('error.invalidEmail', res, false);
  }

  if (user.is_email_verified) {
    return response.badRequest('error.emailAlreadyVerified', res, false);
  }

  const emailVerificationOtp = await dataHelper.generateSecureOTP(6);

  const hasUpdated = await UserModel.updateOne(user._id, {
    otp: { email_verification: emailVerificationOtp },
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  // Send verification email asynchronously
  const verificationTemplate = getVerificationTemplate();
  const html = await verificationTemplate(emailVerificationOtp);
  sendEmailAsync(email, 'Account Verification', html);

  const message = getOTPMessage(res, emailVerificationOtp);
  return response.success(message, res, true);
};

/**
 * Verify OTP
 */
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email, true);
  if (!user) {
    return response.badRequest('error.invalidEmail', res, false);
  }

  if (!user?.otp?.email_verification || user.otp.email_verification !== String(otp)) {
    return response.badRequest('error.invalidOtp', res, false);
  }

  const token = await dataHelper.generateJWTToken({
    user_id: user._id,
    role: user.role,
  });

  const hasUpdated = await UserModel.updateOne(user._id, {
    tokens: {
      auth_token: token,
      fcm_token: req.headers['fcm-token'],
    },
    otp: { email_verification: null },
    is_email_verified: true,
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  const formattedUserData = UserModel.getFormattedData(user);

  return response.success('auth.otpVerified', res, {
    token,
    user: formattedUserData,
  });
};

/**
 * User login
 */
const userLogin = async (req, res) => {
  const { email, password } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email, true);
  if (!user) {
    return response.badRequest('auth.invalidCredentails', res, false);
  }

  const isValidPassword = await dataHelper.validatePassword(password, user.password);
  if (!isValidPassword) {
    return response.badRequest('auth.invalidCredentails', res, false);
  }

  const token = await dataHelper.generateJWTToken({
    user_id: user._id,
    role: user.role,
  });

  const hasUpdated = await UserModel.updateOne(user._id, {
    tokens: {
      auth_token: token,
      fcm_token: req.headers['fcm-token'],
    },
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  const formattedUserData = UserModel.getFormattedData(user);

  return response.success('auth.loggedIn', res, {
    token,
    user: formattedUserData,
  });
};

/**
 * Change password
 */
const changePassword = async (req, res) => {
  const { new_password } = req.body;
  const { user } = req;

  const hashedPassword = await dataHelper.hashPassword(new_password);

  const hasUpdated = await UserModel.updateOne(user._id, {
    password: hashedPassword,
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  return response.success('auth.passwordChanged', res, true);
};

/**
 * Forgot password
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email);
  if (!user) {
    return response.badRequest('error.invalidEmail', res, false);
  }

  const forgotPasswordOtp = await dataHelper.generateSecureOTP(6);

  const hasUpdated = await UserModel.updateOne(user._id, {
    otp: {
      ...user.otp,
      forgot_password: forgotPasswordOtp,
    },
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  // Send email asynchronously
  const forgotPasswordTemplate = getForgotPasswordTemplate();
  const html = await forgotPasswordTemplate(forgotPasswordOtp);
  sendEmailAsync(email, 'Forgot Password Verification', html);

  const message = getOTPMessage(res, forgotPasswordOtp);
  return response.success(message, res, true);
};

/**
 * Verify forgot password OTP
 */
const verifyForgotPasswordOTP = async (req, res) => {
  const { email, otp } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('email', email, true);
  if (!user) {
    return response.badRequest('error.invalidEmail', res, false);
  }

  if (!user?.otp?.forgot_password || user.otp.forgot_password !== String(otp)) {
    return response.badRequest('error.invalidOtp', res, false);
  }

  const hasUpdated = await UserModel.updateOne(user._id, {
    otp: {
      ...user.otp,
      email_verification: null,
      forgot_password: null,
    },
    is_email_verified: true,
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  return response.success('auth.otpVerified', res, {
    user: { id: user._id },
  });
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
  const { password, user_id } = req.body;

  const user = await UserModel.getOneByColumnNameAndValue('_id', user_id);
  if (!user) {
    return response.badRequest('error.userNotExist', res, false);
  }

  if (user?.otp?.forgot_password) {
    return response.badRequest('error.otpNotVerified', res, false);
  }

  const hashedPassword = await dataHelper.hashPassword(password);

  const hasUpdated = await UserModel.updateOne(user._id, {
    password: hashedPassword,
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  return response.success('auth.passwordChanged', res, true);
};

/**
 * Get user profile
 */
const getUserProfile = async (req, res) => {
  const socketService = getSocketService();
  const socketEvents = getSocketEvents();

  const { user } = req;

  // Emit socket event asynchronously
  socketService.emitToUsers([user._id], socketEvents.EMIT.USER_PROFILE_VIEWED, {
    message: 'Profile viewed',
    time: new Date(),
  });

  const formattedUserData = UserModel.getFormattedData(user);

  return response.success('success.userProfile', res, formattedUserData);
};

/**
 * Get all users with pagination
 */
const getAllWithPagination = async (req, res) => {
  const { page, limit } = dataHelper.getPageAndLimit(req.query);

  const result = await UserModel.getAllWithPagination(page, limit, {
    role: UserModel.roles.USER,
  });

  if (!result?.data?.length) {
    return response.success('success.noRecordsFound', res, result);
  }

  return response.success('success.usersData', res, result);
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  const { user } = req;

  const hasUpdated = await UserModel.updateOne(user._id, {
    'tokens.auth_token': '',
    'tokens.fcm_token': '',
  });

  if (!hasUpdated) {
    return response.exception('error.serverError', res, null);
  }

  return response.success('auth.logoutSuccess', res, true);
};

/**
 * Delete user account (soft delete)
 */
const deleteOne = async (req, res) => {
  const { user } = req;

  const hasDeleted = await UserModel.updateOne(user._id, {
    deleted_at: new Date().toISOString().replace('Z', '+00:00'),
  });

  if (!hasDeleted) {
    return response.exception('error.serverError', res, null);
  }

  return response.success('auth.deleteAccount', res, true);
};

/**
 * Upload single image
 */
const uploadImage = async (req, res) => {
  if (!req?.file?.path) {
    return response.badRequest('error.fileNotUploaded', res, false);
  }

  const fileUrl = filePathToURL(req, req.file.path);

  return response.success('success.fileUploaded', res, { image_url: fileUrl });
};

/**
 * Upload multiple images
 */
const uploadBulkImages = async (req, res) => {
  const { files } = req;
  if (!files?.length) {
    return response.badRequest('error.fileNotUploaded', res, false);
  }

  const imageUrls = files.map((file) => filePathToURL(req, file.path));

  return response.success('success.fileUploaded', res, { image_urls: imageUrls });
};

/**
 * Delete local image
 */
const deleteImage = async (req, res) => {
  try {
    const { image_url } = req.body;

    const deleted = deleteLocalFile(image_url);
    if (deleted) {
      return response.success('success.fileDeleted', res, true);
    }

    return response.badRequest('error.fileNotFound', res, false);
  } catch (error) {
    console.log('Error in deleteImage: ', error);
    return response.exception('error.invalidFileUrlToDelete', res, false);
  }
};

/**
 * Upload image to AWS S3
 */
const uploadImageAWS = async (req, res) => response.success('success.fileUploaded', res, { image_url: req.image_url });

/**
 * Delete image from AWS S3
 */
const deleteImageAWS = async (req, res) => {
  const aws = getAWS();

  const { image_url } = req.body;

  const hasDeleted = await aws.deleteFile(image_url);
  if (!hasDeleted) {
    return response.badRequest('error.fileNotFound', res, false);
  }

  return response.success('success.fileDeleted', res, true);
};

/**
 * Generate AWS S3 presigned URL
 */
const generatePresignedUrl = async (req, res) => {
  const aws = getAWS();

  const { file_name, file_type, folder = 'uploads' } = req.body;

  try {
    const result = await aws.getPresignedUrl(folder, file_name, file_type);
    if (!result) {
      return response.badRequest('error.serverError', res, false);
    }

    return response.success('success.presignedUrlGenerated', res, result);
  } catch (error) {
    console.log('Error in generatePresignedUrl: ', error);
    return response.exception('error.serverError', res, null);
  }
};

/**
 * Export controller functions
 */
module.exports = {
  createOne,
  resendOtp,
  verifyOtp,
  userLogin,
  changePassword,
  forgotPassword,
  verifyForgotPasswordOTP,
  resetPassword,
  getUserProfile,
  getAllWithPagination,
  logout,
  deleteOne,
  uploadImage,
  uploadBulkImages,
  deleteImage,
  uploadImageAWS,
  deleteImageAWS,
  generatePresignedUrl,
};
