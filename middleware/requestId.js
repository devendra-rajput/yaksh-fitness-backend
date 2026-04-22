const { v4: uuidv4 } = require('uuid');

/**
 * Attaches a unique request ID to every incoming request.
 * Uses the X-Request-ID header if provided by a gateway/load balancer;
 * otherwise generates a new UUID v4.
 *
 * Downstream code can read req.id for structured logging and error reports.
 */
const requestIdMiddleware = (req, _res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  next();
};

module.exports = requestIdMiddleware;
