/**
 * Error Handling Middleware
 * Centralized error handling with classification and logging
 */

const multer = require('multer');
const i18n = require('../config/i18n');

/**
 * Error types classification
 */
const ERROR_TYPES = {
  OPERATIONAL: 'operational', // Expected errors (4xx)
  PROGRAMMING: 'programming', // Unexpected errors (5xx)
};

/**
 * Classify error as operational or programming
 */
const classifyError = (statusCode) => (
  statusCode < 500 ? ERROR_TYPES.OPERATIONAL : ERROR_TYPES.PROGRAMMING
);

/**
 * Extract status code from error
 */
const getErrorStatusCode = (err) => err.statusCode || err.status || 500;

/**
 * Create error log object
 */
const createErrorLog = (err, req) => ({
  message: err.message,
  stack: err.stack,
  method: req.method,
  url: req.originalUrl,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  requestId: req.id,
  timestamp: new Date().toISOString(),
});

/**
 * Handle Multer-specific errors
 */
const handleMulterError = (err, req, res) => {
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      statusCode: 400,
      message: i18n.__('error.tooManyFilesUploaded'),
      error: i18n.__('error.maxFileLimit', {
        maxFileCount: req.maxFileCount || 5,
      }),
    });
  }

  return res.status(400).json({
    statusCode: 400,
    message: i18n.__('error.multerError'),
    error: err.message,
  });
};

/**
 * Handle general errors
 */
const handleGeneralError = (err, statusCode, res) => {
  const errorMessage = typeof err === 'string' ? err : err.message;

  return res.status(statusCode).json({
    statusCode,
    message: i18n.__('error.serverError'),
    error: errorMessage || i18n.__('error.internalServerError'),
  });
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, _next) => {
  // Extract status code and classify error
  const statusCode = getErrorStatusCode(err);
  const errorType = classifyError(statusCode);

  // Log programming errors (5xx) only
  if (errorType === ERROR_TYPES.PROGRAMMING) {
    const errorLog = createErrorLog(err, req);
    console.error('Server Error:', JSON.stringify(errorLog, null, 2));
  }

  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    return handleMulterError(err, req, res);
  }

  // Handle general errors
  return handleGeneralError(err, statusCode, res);
};

module.exports = errorHandler;
