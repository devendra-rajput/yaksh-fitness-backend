/**
 * Application Entry Point
 *
 * Main entry file that initializes and starts the server.
 * Following functional programming principles:
 * - Pure functions where possible
 * - Composition for server setup
 * - Clear error handling
 *
 * @module index
 */

/**
 * Load environment variables FIRST before any other imports
 * This ensures all modules have access to process.env
 */
const dotenv = require('dotenv');

try {
  const env = process.env.NODE_ENV || 'development';
  dotenv.config({
    path: `.env.${env}`,
  });
  console.log(`✅ Environment loaded: ${env}`);
} catch (err) {
  console.error('❌ Error loading .env file:');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}

// Disable logs if configured
if (process.env.LOG_DISABLE === 'true') {
  console.log = function noop() { };
}

const { createServer } = require('./bootstrap/serverHandlers');
const { setupProcessHandlers } = require('./bootstrap/processHandlers');

/**
 * Main application function
 * Initializes and starts the server
 */
const main = async () => {
  try {
    // Create and start server
    const server = await createServer();

    // Setup process handlers for graceful shutdown
    setupProcessHandlers(server);
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
};

// Start the application
main();
