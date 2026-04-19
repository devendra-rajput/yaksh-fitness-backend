/**
 * MongoDB Configuration
 * Handles Mongoose connection and events
 */

const mongoose = require('mongoose');
const { logger } = require('../../utils/logger');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    // Connect to MongoDB using connection string from environment
    await mongoose.connect(process.env.DATABASE_URL, {
      // Connection options can be added here if needed
      // maxPoolSize: 10,
      // serverSelectionTimeoutMS: 5000,
      // socketTimeoutMS: 45000,
    });

    const db = mongoose.connection;

    // Event listener for connection errors
    db.on('error', (error) => {
      logger.error('Database Connection Error:', error);
    });

    // Event listener for successful connection
    db.once('open', () => {
      logger.info('✅ Database Connected Successfully!');
    });

    // Event listener for disconnection
    db.on('disconnected', () => {
      logger.warn('⚠️  Database Disconnected');
    });

    // Event listener for reconnection
    db.on('reconnected', () => {
      logger.info('✅ Database Reconnected');
    });

    // Uncomment to enable Mongoose debug mode (logs all queries)
    // mongoose.set('debug', true);

    return db;
  } catch (err) {
    logger.error('MongoDB Connection Error:', err);
    logger.error('Error Message:', err.message);
    logger.error('Stack Trace:', err.stack);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB database
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('✅ Database connection closed');
  } catch (err) {
    logger.error('Error closing database connection:', err);
    throw err;
  }
};

/**
 * Get current database connection status
 */
const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

// Export database functions
module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
};
