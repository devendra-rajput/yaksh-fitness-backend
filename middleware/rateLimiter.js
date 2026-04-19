/**
 * Rate Limiter Middleware
 * Prevents API abuse using Redis-based rate limiting
 */

const { RateLimiterRedis } = require('rate-limiter-flexible');
const { redisClient } = require('../config/v1/redis');
const i18n = require('../config/i18n');

/**
 * Rate limiter configuration
 */
const RATE_LIMIT_CONFIG = Object.freeze({
  points: parseInt(process.env.RATE_LIMIT_POINTS, 10) || 200,
  duration: parseInt(process.env.RATE_LIMIT_DURATION, 10) || 1,
  blockDuration: process.env.RATE_LIMIT_BLOCK_DURATION
    ? parseInt(process.env.RATE_LIMIT_BLOCK_DURATION, 10)
    : 10, // Default block duration is 10 seconds
  keyPrefix: 'rate-limiter',
});

/**
 * Rate limiter instance (lazy initialized)
 */
let rateLimiter = null;

/**
 * Initialize rate limiter instance
 */
const initRateLimiter = () => {
  if (!rateLimiter) {
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: RATE_LIMIT_CONFIG.keyPrefix,
      points: RATE_LIMIT_CONFIG.points,
      duration: RATE_LIMIT_CONFIG.duration,
      blockDuration: RATE_LIMIT_CONFIG.blockDuration,
    });
  }
  return rateLimiter;
};

/**
 * Get client identifier from request
 */
const getClientIdentifier = (req) => req.ip || req.connection.remoteAddress || 'unknown';

/**
 * Send rate limit exceeded response
 */
const sendRateLimitResponse = (res, retryAfter = 0) => {
  const retryAfterSeconds = Math.ceil(retryAfter / 1000);

  res.set('Retry-After', String(retryAfterSeconds));

  return res.status(429).json({
    statusCode: 429,
    message: i18n.__('error.tooManyRequests'),
    retryAfter: retryAfterSeconds,
  });
};

/**
 * Rate limiter middleware
 */
const rateLimiterMiddleware = async (req, res, next) => {
  // Lazy initialize rate limiter
  const limiter = rateLimiter || initRateLimiter();

  // Get client identifier
  const clientId = getClientIdentifier(req);

  try {
    // Consume 1 point for this request
    await limiter.consume(clientId);

    // Request allowed, proceed
    next();
  } catch (rateLimiterRes) {
    // Rate limit exceeded
    const retryAfter = rateLimiterRes?.msBeforeNext || 0;

    // Send rate limit response
    return sendRateLimitResponse(res, retryAfter);
  }
};

module.exports = rateLimiterMiddleware;
