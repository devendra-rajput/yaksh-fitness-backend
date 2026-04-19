/**
 * Redis Configuration
 * Handles Redis connection and client options
 */

const Redis = require('ioredis');
const { logger } = require('../../utils/logger');

/**
 * Construct Redis connection URL
 * Format: redis://host:port
 */
const redisUrl = `redis://${process.env.REDIS_URL}:${process.env.REDIS_PORT}`;

/**
 * Create Redis client instance with configuration
 */
const redisClient = new Redis(redisUrl, {
  lazyConnect: true, // Don't connect immediately
  retryStrategy: (times) => {
    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis reconnecting... Attempt ${times}, delay: ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3, // Maximum retry attempts per command
  enableReadyCheck: true, // Check if Redis is ready before sending commands
  enableOfflineQueue: true, // Queue commands when disconnected
});

/**
 * Connect to Redis server
 */
const connectRedis = async () => {
  try {
    await redisClient.connect();
    // logger.info('✅ Redis connected successfully!');
  } catch (error) {
    logger.error('Redis Connection Error:', error);
    logger.error('Error Message:', error.message);
    logger.error('Stack Trace:', error.stack);
    process.exit(1);
  }
};

// /**
//  * Event listener: Redis is ready to accept commands
//  */
// redisClient.on('ready', () => {
//   logger.info('✅ Redis is ready!');
// });

// /**
//  * Event listener: Redis connection established
//  */
// redisClient.on('connect', () => {
//   logger.info('🔌 Redis connection established');
// });

/**
 * Event listener: Redis reconnecting after disconnection
 */
redisClient.on('reconnecting', () => {
  logger.warn('⚠️  Redis reconnecting...');
});

/**
 * Event listener: Redis connection error
 */
redisClient.on('error', (error) => {
  logger.error('Redis Error:', error.message);
});

/**
 * Event listener: Redis connection closed
 */
redisClient.on('close', () => {
  logger.warn('⚠️  Redis connection closed');
});

/**
 * Event listener: Redis connection ended
 */
redisClient.on('end', () => {
  logger.warn('⚠️  Redis connection ended');
});

/**
 * Get Redis client status
 */
const getRedisStatus = () => redisClient.status;

/**
 * Check if Redis is connected and ready
 */
const isRedisReady = () => redisClient.status === 'ready';

// Export Redis client and connection function
module.exports = {
  redisClient,
  connectRedis,
  getRedisStatus,
  isRedisReady,
};
