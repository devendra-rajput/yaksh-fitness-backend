/**
 * Routes Bootstrap
 * Automatically discovers and registers all API routes
 */

const fs = require('fs').promises;
const path = require('path');

/* eslint-disable security/detect-non-literal-require, import/no-dynamic-require, global-require */

/**
 * Recursively walk directory to find all route files
 */
const walkDirectory = async (dir) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const files = await fs.readdir(dir);

  const results = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(dir, file);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const stat = await fs.stat(filePath);

      return stat.isDirectory() ? walkDirectory(filePath) : filePath;
    }),
  );

  return results.flat();
};

/**
 * Extract route name from file path
 */
const getRouteName = (filePath) => path.basename(filePath, '.js');

/**
 * Register a single route
 */
const registerRoute = (app, routeName, routeFilePath) => {
  try {
    const routeHandler = require(routeFilePath);
    app.use(`/api/v1/${routeName}`, routeHandler);
  } catch (error) {
    console.error(`Failed to register route from ${routeFilePath}:`, error.message);
  }
};

/**
 * Register all API routes from routes directory
 */
const registerApiRoutes = async (app, routesPath) => {
  const allFiles = await walkDirectory(routesPath);

  allFiles.forEach((file) => {
    const routeName = getRouteName(file);
    registerRoute(app, routeName, file);
  });
};

/**
 * Register root route
 */
const registerRootRoute = (app) => {
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'Everything is working fine.',
      host: req.get('host'),
      version: process.env.API_VER || 'v1',
      environment: process.env.NODE_ENV || 'development',
    });
  });
};

/**
 * Register health check route
 */
const registerHealthRoute = (app) => {
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
};

/**
 * Register load test route
 */
const registerLoadTestRoute = (app) => {
  app.get('/load-test', (req, res) => {
    res.status(200).send('OK');
  });
};

/**
 * Register static page routes (terms, privacy)
 */
const registerStaticPageRoutes = (app) => {
  // Terms of Service page
  app.get('/terms', (req, res) => {
    res.render('terms', {
      title: 'Terms of Service | Node JS Boilerplate',
      headerTitle: 'Terms of Service',
      description: 'Terms and conditions for using our service.',
      companyName: 'Node JS Boilerplate',
    });
  });

  // Privacy Policy page
  app.get('/privacy', (req, res) => {
    res.render('privacy', {
      title: 'Privacy Policy | Node JS Boilerplate',
      headerTitle: 'Privacy Policy',
      description: 'Privacy policy for our service.',
      companyName: 'Node JS Boilerplate',
    });
  });
};

/**
 * Register 404 handler (must be last)
 */
const register404Handler = (app) => {
  app.use((req, res) => {
    res.status(404).json({
      statusCode: 404,
      message: 'Route not found',
      error: `'${req.originalUrl}' is not a valid endpoint. Please check the request URL and try again.`,
    });
  });
};

/**
 * Main route setup function
 */
const setupRoutes = async (app) => {
  const routesPath = path.join(__dirname, '../routes');

  // Register routes in order
  registerRootRoute(app);
  registerHealthRoute(app);
  registerLoadTestRoute(app);
  registerStaticPageRoutes(app);
  await registerApiRoutes(app, routesPath);
  register404Handler(app); // Must be last
};

module.exports = setupRoutes;
