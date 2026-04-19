/**
 * Data Helpers
 * Utility functions for validation, security, pagination, and formatting
 */

const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const moment = require('moment-timezone');

/**
 * Constants
 */
const PASSWORD_REGEX = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*[@$!%*?&]).{8,}/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONGODB_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Validation Functions
 */

/**
 * Validate request body against Joi schema
 */
const joiValidation = async (reqBody, schema) => {
  try {
    await Joi.object(schema).validateAsync(reqBody);
    return false; // No errors
  } catch (error) {
    if (error.details) {
      return error.details.map((e) => e.message.replace(/"/g, ''));
    }
    return false;
  }
};

/**
 * Check password strength
 */
const checkPasswordRegex = (password) => PASSWORD_REGEX.test(password);

/**
 * Validate email format
 */
const isValidEmail = (email) => EMAIL_REGEX.test(email);

/**
 * Validate MongoDB ObjectId
 */
const isValidMongoDBId = (id) => {
  if (!id || id === '') {
    return false;
  }
  return MONGODB_ID_REGEX.test(id);
};

/**
 * Password & Security Functions
 */

/**
 * Hash password using bcrypt
 */
const hashPassword = async (password) => {
  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  if (!hashedPassword) {
    throw new Error('Error generating password hash');
  }
  return hashedPassword;
};

/**
 * Validate password against hash
 */
const validatePassword = async (passwordString, passwordHash) => (
  bcrypt.compare(passwordString, passwordHash)
);

/**
 * Generate JWT token
 */
const generateJWTToken = (data) => {
  try {
    const token = jwt.sign(data, process.env.JWT_TOKEN_KEY, {
      expiresIn: process.env.JWT_TOKEN_EXPIRY || '30d',
    });
    return token || false;
  } catch (error) {
    console.error('JWT generation error:', error);
    return false;
  }
};

/**
 * Generate secure OTP
 */
const generateSecureOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i += 1) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
};

/**
 * Pagination Functions
 */

/**
 * Parse and validate page number
 */
const parsePage = (page) => {
  const pageNo = parseInt(page, 10);
  if (Number.isNaN(pageNo) || pageNo < 1) {
    return DEFAULT_PAGE;
  }
  return pageNo;
};

/**
 * Parse and validate limit
 */
const parseLimit = (limit) => {
  const limitVal = parseInt(limit, 10);
  if (Number.isNaN(limitVal) || limitVal < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(limitVal, MAX_LIMIT);
};

/**
 * Extract page and limit from query
 */
const getPageAndLimit = (reqQuery) => ({
  page: parsePage(reqQuery.page),
  limit: parseLimit(reqQuery.limit),
});

/**
 * Calculate pagination metadata
 */
const calculatePagination = (totalItems = 0, currentPage = DEFAULT_PAGE, limit = DEFAULT_LIMIT) => {
  const page = parsePage(currentPage);
  const limitVal = parseLimit(limit) || (totalItems > DEFAULT_LIMIT ? DEFAULT_LIMIT : totalItems);

  const totalPages = Math.max(Math.ceil(totalItems / limitVal), 1);
  const validPage = Math.min(page, totalPages);
  const offset = validPage > 1 ? (validPage - 1) * limitVal : 0;

  return {
    currentPage: validPage,
    totalPages,
    offset,
    limit: limitVal,
    totalItems,
  };
};

/**
 * Date & Time Functions
 */

/**
 * Convert date to specific timezone and format
 */
const convertDateTimezoneAndFormat = (date, timezone = 'UTC', format = 'YYYY-MM-DDTHH:mm:ssZ') => {
  if (!date) return null;

  try {
    return moment(date).tz(timezone).format(format);
  } catch (error) {
    console.error('Date conversion error:', error);
    return null;
  }
};

/**
 * Get current timestamp in specific timezone
 */
const getCurrentTimestamp = (timezone = 'UTC', format = 'YYYY-MM-DDTHH:mm:ssZ') => moment().tz(timezone).format(format);

/**
 * Utility Functions
 */

/**
 * Sanitize string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Generate random string
 */
const generateRandomString = (length = 32) => crypto.randomBytes(Math.ceil(length / 2))
  .toString('hex')
  .slice(0, length);

/**
 * Export all helper functions
 */
module.exports = {
  // Validation
  joiValidation,
  checkPasswordRegex,
  isValidEmail,
  isValidMongoDBId,

  // Password & Security
  hashPassword,
  validatePassword,
  generateJWTToken,
  generateSecureOTP,

  // Pagination
  getPageAndLimit,
  calculatePagination,
  parsePage,
  parseLimit,

  // Date & Time
  convertDateTimezoneAndFormat,
  getCurrentTimestamp,

  // Utilities
  sanitizeString,
  generateRandomString,

  // Constants (for external use)
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
