/**
 * Response Helper
 * Standardized HTTP response functions (Pure Functional)
 */

const i18n = require('../../config/i18n');

/**
 * HTTP Status Codes
 * Centralized status code constants for better maintainability
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  MOVED_TEMPORARILY: 302,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * Create response body object
 */
const createResponseBody = (statusCode, message, data = null) => {
  const body = {
    statusCode,
    api_ver: process.env.API_VER || 'v1',
    message: i18n.__(message),
  };

  // Only add data property if data exists
  if (data !== null && data !== undefined) {
    body.data = data;
  }

  return body;
};

/**
 * Set CORS headers on response
 */
const setCORSHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS');
  return res;
};

/**
 * Send HTTP response
 */
const sendResponse = (statusCode, message, res, data = null) => {
  const body = createResponseBody(statusCode, message, data);
  setCORSHeaders(res);
  return res.status(statusCode).send(body);
};

/**
 * Create response function factory
 */
const createResponseFunction = (statusCode) => (
  (message, res, data = null) => sendResponse(statusCode, message, res, data)
);

// Success Responses (2xx)
const success = createResponseFunction(HTTP_STATUS.OK);
const created = createResponseFunction(HTTP_STATUS.CREATED);
const noContent = createResponseFunction(HTTP_STATUS.NO_CONTENT);

// Client Error Responses (4xx)
const badRequest = createResponseFunction(HTTP_STATUS.BAD_REQUEST);
const unauthorized = createResponseFunction(HTTP_STATUS.UNAUTHORIZED);
const forbidden = createResponseFunction(HTTP_STATUS.FORBIDDEN);
const notFound = createResponseFunction(HTTP_STATUS.NOT_FOUND);
const disallowed = createResponseFunction(HTTP_STATUS.METHOD_NOT_ALLOWED);
const conflict = createResponseFunction(HTTP_STATUS.CONFLICT);
const validationError = createResponseFunction(HTTP_STATUS.UNPROCESSABLE_ENTITY);

// Server Error Responses (5xx)
const exception = createResponseFunction(HTTP_STATUS.INTERNAL_SERVER_ERROR);

/**
 * Send custom status code response
 */
const custom = (statusCode, message, res, data = null) => (
  sendResponse(statusCode, message, res, data)
);

/**
 * Send redirect response
 */
const redirect = (url, res) => res.status(HTTP_STATUS.MOVED_TEMPORARILY).send({
  api_ver: process.env.API_VER || 'v1',
  redirect_to: url,
});

/**
 * Send two-factor authentication enabled response
 */
const twoFactorEnabled = (res) => {
  setCORSHeaders(res);
  return res.status(HTTP_STATUS.OK).send({
    api_ver: process.env.API_VER || 'v1',
    message: i18n.__('auth.twoFactorEnabled'),
    two_factor: true,
  });
};

/**
 * Export all response functions
 */
module.exports = {
  // Core functions
  sendResponse,
  createResponseBody,

  // Success responses
  success,
  created,
  noContent,

  // Client error responses
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  disallowed,
  conflict,
  validationError,

  // Server error responses
  exception,

  // Specialized responses
  custom,
  redirect,
  twoFactorEnabled,

  // Constants
  HTTP_STATUS,
};
