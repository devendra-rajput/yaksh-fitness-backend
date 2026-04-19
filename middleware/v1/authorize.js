/**
 * Authorization Middleware
 * Handles JWT authentication and role-based authorization
 */

const jwt = require('jsonwebtoken');
const response = require('../../helpers/v1/response.helpers');
const UserModel = require('../../resources/v1/users/users.model');

/**
 * Verify JWT token
 */
const verifyToken = (token) => new Promise((resolve, reject) => {
  jwt.verify(token, process.env.JWT_TOKEN_KEY, (err, decoded) => {
    if (err) {
      return reject(err);
    }
    resolve(decoded);
  });
});

/**
 * Extract token from Authorization header
 */
const extractToken = (req) => {
  let token = req.headers.authorization;

  if (!token) {
    return null;
  }

  // Remove 'Bearer ' prefix if present
  if (token.startsWith('Bearer ')) {
    [, token] = token.split(' ');
  }

  return token;
};

/**
 * Validate user exists and is active
 */
const validateUser = (user) => {
  if (!user) {
    return { key: 'error.userNotFound' };
  }

  if (user.status !== UserModel.statuses.ACTIVE) {
    return {
      key: 'auth.accountBlocked',
      params: { supportEmail: process.env.SUPPORT_MAIL },
    };
  }

  return null;
};

/**
 * Validate token matches stored token
 */
const validateTokenMatch = (user, token) => user?.tokens?.auth_token === token;

/**
 * Validate user role
 */
const validateRole = (user, requiredRole) => {
  if (!requiredRole) {
    return true; // No role requirement
  }

  const validRoles = [UserModel.roles.ADMIN, UserModel.roles.USER];

  if (!validRoles.includes(requiredRole)) {
    return false; // Invalid role specified
  }

  return user.role === requiredRole;
};

/**
 * Authenticate user from token
 */
const authenticateUser = async (token) => {
  // Verify token
  const decoded = await verifyToken(token);

  // Find user by decoded user_id
  const user = await UserModel.getOneByColumnNameAndValue('_id', decoded.user_id, true);

  return user;
};

/**
 * Authorization middleware factory
 * Creates middleware with optional role validation
 */
const auth = (requiredRole = null) => async (req, res, next) => {
  try {
    // Extract token from header
    const token = extractToken(req);
    if (!token) {
      return response.unauthorized('auth.unauthorizedRequest', res, false);
    }

    // Authenticate user
    const user = await authenticateUser(token);

    // Validate user exists and is active
    const userValidation = validateUser(user);
    if (userValidation) {
      const message = userValidation.params
        ? res.__(userValidation.key, userValidation.params)
        : userValidation.key;
      return response.unauthorized(message, res, false);
    }

    // Validate token matches stored token
    if (!validateTokenMatch(user, token)) {
      return response.unauthorized('auth.tokenMismatch', res, false);
    }

    // Validate role if required
    if (!validateRole(user, requiredRole)) {
      return response.badRequest('auth.unauthorizedRole', res, false);
    }

    // Attach user to request
    req.user = user;

    // Proceed to next middleware
    next();
  } catch (error) {
    return response.unauthorized(error.message, res, false);
  }
};

/**
 * Convenience middleware for admin-only routes
 */
const adminOnly = auth(UserModel.roles.ADMIN);

/**
 * Convenience middleware for user-only routes
 */
const userOnly = auth(UserModel.roles.USER);

module.exports = {
  auth,
  adminOnly,
  userOnly,
  // Export utilities for testing
  extractToken,
  validateUser,
  validateTokenMatch,
  validateRole,
};
