/**
 * Environment Validator
 * Validates required environment variables on startup
 */

const validateEnvironment = () => {
  const requiredEnvVars = ['NODE_ENV', 'APPLICATION_PORT', 'DATABASE_URL', 'MAIL_HOST', 'REDIS_URL', 'JWT_TOKEN_KEY'];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
  }

  const validEnvironments = ['development', 'production', 'staging', 'test'];
  if (!validEnvironments.includes(process.env.NODE_ENV)) {
    console.error('❌ Invalid NODE_ENV:', process.env.NODE_ENV);
    process.exit(1);
  }
};

module.exports = { validateEnvironment };
