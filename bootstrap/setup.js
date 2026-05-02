/**
 * Application Setup
 * Configures and bootstraps the Express application
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const expressLayouts = require('express-ejs-layouts');

const setupRoutes = require('./routes');
const swaggerSpecs = require('../config/swagger');
const i18n = require('../config/i18n');
const { corsConfig, validateCorsConfig } = require('../config/cors');
const { connectDB } = require('../config/v1/mongodb');
const { connectRedis } = require('../config/v1/redis');
const rateLimiterMiddleware = require('../middleware/rateLimiter');
const timezoneMiddleware = require('../middleware/timezone');
const requestIdMiddleware = require('../middleware/requestId');
const errorMiddleware = require('../middleware/error');
const { logger } = require('../utils/logger');
const { validateEnvironment: validateEnv } = require('../utils/envValidator');

/**
 * Validate environment variables
 */
const setupEnvironmentValidation = () => {
  logger.info('Validating environment variables...');
  validateEnv();
  logger.info('Environment validation passed');
};

/**
 * Connect to databases
 */
const setupDatabases = async () => {
  logger.info('Connecting to MongoDB...');
  await connectDB();
  logger.info('MongoDB connected');

  logger.info('Connecting to Redis...');
  await connectRedis();
  logger.info('Redis connected');
};

/**
 * Attach a unique request ID before any other middleware runs.
 */
const setupRequestId = (app) => {
  app.use(requestIdMiddleware);
};

/**
 * Setup body parsers
 */
const setupBodyParsers = (app) => {
  logger.info('Setting up body parsers...');
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: '50mb' }));
};

/**
 * Setup CORS configuration
 */
const setupCORS = (app) => {
  logger.info('Setting up CORS...');
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server or curl
        if (!origin) return callback(null, true);

        if (corsConfig.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Allow ngrok tunnels in development for mobile testing
        if (process.env.NODE_ENV !== 'production') {
          if (origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok.io') || origin.endsWith('.ngrok.app')) {
            return callback(null, true);
          }
        }

        logger.error('Blocked by CORS', { origin });
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: corsConfig.credentials,
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      exposedHeaders: corsConfig.exposedHeaders,
      maxAge: corsConfig.maxAge,
    }),
  );

  validateCorsConfig();
};

/**
 * Setup security headers
 */
const setupSecurity = (app) => {
  logger.info('Setting up security headers...');
  app.use(helmet());
  app.set('trust proxy', 'loopback');
};

/**
 * Setup internationalization
 */
const setupI18n = (app) => {
  logger.info('Setting up i18n...');
  app.use(i18n.init);
};

/**
 * Setup middleware
 */
const setupMiddleware = (app) => {
  logger.info('Setting up middleware...');
  app.use(timezoneMiddleware);
  app.use(rateLimiterMiddleware);
};

/**
 * Setup request logging
 */
const setupRequestLogging = (app) => {
  if (process.env.LOG_DISABLE === 'false') {
    logger.info('Setting up request logging...');
    app.use((req, res, next) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        requestId: req.id,
        timezone: req.timezone,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }
};

/**
 * Setup static file serving
 */
const setupStaticFiles = (app) => {
  logger.info('Setting up static file serving...');
  app.use('/public', express.static('public'));
  app.use('/uploads', express.static('uploads'));
};

/**
 * Setup view engine (EJS)
 */
const setupViewEngine = (app) => {
  logger.info('Setting up view engine...');
  app.set('view engine', 'ejs');
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.set('views', path.join(__dirname, '../', 'views'));
};

/**
 * Setup Swagger documentation
 */
const setupSwagger = (app) => {
  logger.info('Setting up Swagger documentation...');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
};

/**
 * Setup application routes
 */
const setupApplicationRoutes = async (app) => {
  logger.info('Setting up routes...');
  await setupRoutes(app);
  logger.info('Routes configured');
};

/**
 * Setup error handling middleware
 */
const setupErrorHandling = (app) => {
  logger.info('Setting up error handling...');
  app.use(errorMiddleware);
};

/**
 * Main application setup function
 */
const setupApplication = async (app) => {
  logger.info('Starting application bootstrap...');

  try {
    // Step 1: Validate environment
    setupEnvironmentValidation();

    // Step 2: Connect to databases
    await setupDatabases();

    // Step 3: Attach request ID (must be before all other middleware)
    setupRequestId(app);

    // Step 4: Setup body parsers
    setupBodyParsers(app);

    // Step 5: Setup CORS
    setupCORS(app);

    // Step 6: Setup security
    setupSecurity(app);

    // Step 7: Setup i18n
    setupI18n(app);

    // Step 8: Setup middleware
    setupMiddleware(app);

    // Step 9: Setup request logging
    setupRequestLogging(app);

    // Step 10: Setup static files
    setupStaticFiles(app);

    // Step 11: Setup view engine
    setupViewEngine(app);

    // Step 12: Setup Swagger
    setupSwagger(app);

    // Step 13: Setup routes
    await setupApplicationRoutes(app);

    // Step 14: Setup error handling (must be last)
    setupErrorHandling(app);

    logger.info('Application bootstrap completed successfully!');
  } catch (error) {
    logger.error('Application bootstrap failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

module.exports = {
  setupApplication,
};
