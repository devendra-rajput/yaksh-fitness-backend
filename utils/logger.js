/**
 * Logger Utility
 * Winston-based logging with daily rotation and formatting
 */

const winston = require('winston');
require('winston-daily-rotate-file');

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';
const serviceName = process.env.LOG_SERVICE_NAME || 'user-service';

/**
 * Development format - Human-readable with colors
 */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({
    timestamp, level, message, stack, ...meta
  }) => {
    const metaStr = Object.keys(meta).length && meta.service !== serviceName
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}${stackStr}`;
  }),
);

/**
 * Production format - JSON for log aggregation
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

/**
 * Console transport - Always enabled
 */
const consoleTransport = new winston.transports.Console({
  format: isProd ? prodFormat : devFormat,
});

/**
 * Error log file transport - Only errors
 */
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/error/error-%DATE%.log',
  level: 'error',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
});

/**
 * Combined log file transport - All levels
 */
const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/combined/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: {
    service: serviceName,
    env: process.env.NODE_ENV || 'development',
    version: process.env.API_VER || '1.0.0',
  },
  transports: [
    consoleTransport,
    errorFileTransport,
    combinedFileTransport,
  ],
  exitOnError: false,
});

/**
 * Helper functions for common logging patterns
 */

/**
 * Log startup message
 */
const logStartup = (message) => {
  logger.info(`🚀 ${message}`);
};

/**
 * Log success message
 */
const logSuccess = (message) => {
  logger.info(`✅ ${message}`);
};

/**
 * Log error message
 */
const logError = (message, error = null) => {
  if (error) {
    logger.error(`❌ ${message}`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
  } else {
    logger.error(`❌ ${message}`);
  }
};

/**
 * Log warning message
 */
const logWarning = (message) => {
  logger.warn(`⚠️  ${message}`);
};

/**
 * Log info message
 */
const logInfo = (message) => {
  logger.info(message);
};

/**
 * Log debug message
 */
const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

/**
 * Stream for Morgan HTTP logging
 */
const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Export logger and helper functions
module.exports = {
  logger,
  logStartup,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logDebug,
  stream,
};
