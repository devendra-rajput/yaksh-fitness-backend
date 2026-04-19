/**
 * CORS Configuration
 * Configures Cross-Origin Resource Sharing settings
 */

/**
 * Parse allowed origins from environment variable
 */
const parseAllowedOrigins = () => {
  const origins = process.env.CORS_ORIGINS || '';
  return origins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

/**
 * CORS Configuration Object
 */
const corsConfig = {
  /**
   * Allowed Origins
   * List of origins that are permitted to access the API
   * Empty array means no browser-based cross-origin access is allowed
   */
  allowedOrigins: parseAllowedOrigins(),

  /**
   * Credentials Support
   * When true, allows cookies and authorization headers in cross-origin requests
   * Requires specific origin (cannot use '*' wildcard)
   */
  credentials: true,

  /**
   * Allowed HTTP Methods
   * HTTP methods that are permitted in cross-origin requests
   */
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  /**
   * Allowed Headers
   * Headers that the client is allowed to send in cross-origin requests
   * Common headers for authentication and content negotiation
   */
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-timezone', // Custom header for timezone support
    'x-language', // Custom header for i18n support
  ],

  /**
   * Exposed Headers
   * Headers that the browser is allowed to access in the response
   * By default, only simple response headers are exposed
   */
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'X-Total-Count', // Custom header for pagination
    'X-Page-Count', // Custom header for pagination
  ],

  /**
   * Preflight Cache Duration
   * How long (in seconds) the browser should cache preflight responses
   * Reduces the number of OPTIONS requests for the same resource
   */
  maxAge: 86400, // 24 hours (86400 seconds)

  /**
   * Preflight Continue
   * When false, the CORS middleware handles OPTIONS requests
   * When true, passes OPTIONS requests to the next handler
   */
  preflightContinue: false,

  /**
   * Success Status
   * HTTP status code to use for successful OPTIONS requests
   * 204 (No Content) is standard for OPTIONS responses
   */
  optionsSuccessStatus: 204,
};

/**
 * Validate CORS configuration
 */
const validateCorsConfig = () => {
  if (corsConfig.allowedOrigins.length === 0) {
    console.warn('⚠️  WARNING: No CORS origins configured. Browser-based cross-origin requests will be blocked.');
    console.warn('⚠️  Set CORS_ORIGINS environment variable to allow specific origins.');
  }

  if (process.env.NODE_ENV === 'production' && corsConfig.allowedOrigins.includes('*')) {
    console.warn('⚠️  WARNING: Wildcard (*) CORS origin in production is a security risk!');
  }
};

// Export CORS configuration
module.exports = {
  corsConfig,
  parseAllowedOrigins,
  validateCorsConfig,
};
