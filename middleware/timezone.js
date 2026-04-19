/**
 * Timezone Middleware
 * Extracts and validates timezone from request headers
 */

const moment = require('moment-timezone');

/**
 * Default timezone constant
 */
const DEFAULT_TIMEZONE = 'UTC';

/**
 * Extract timezone from request headers
 */
const extractTimezone = (req) => req.headers['x-timezone'] || DEFAULT_TIMEZONE;

/**
 * Check if timezone is valid
 */
const isValidTimezone = (timezone) => moment.tz.zone(timezone) !== null;

/**
 * Get validated timezone or default
 */
const getValidatedTimezone = (timezone) => (
  isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE
);

/**
 * Timezone middleware
 */
const timezoneMiddleware = (req, res, next) => {
  const timezone = extractTimezone(req);
  req.timezone = getValidatedTimezone(timezone);
  next();
};

module.exports = timezoneMiddleware;
