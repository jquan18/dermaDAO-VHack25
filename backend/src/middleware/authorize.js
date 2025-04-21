const logger = require('../config/logger');

/**
 * Role-based authorization middleware
 * @param {string[]} roles - Array of allowed roles
 */
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED'
          }
        });
      }

      // Check if user has required role
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Authorization failed',
          code: 'AUTH_ERROR'
        }
      });
    }
  };
};

module.exports = authorize; 