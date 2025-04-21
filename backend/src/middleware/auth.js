const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const db = require('../config/database');
const { AppError } = require('../utils/appError');
const httpStatus = require('http-status');

/**
 * Authentication middleware
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'No authentication token, access denied',
          code: 'AUTH_REQUIRED'
        }
      });
    }
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.user;
      
      // Optionally check if user still exists in database
      const user = await db.query('SELECT id, role, charity_id, is_admin, is_worldcoin_verified FROM users WHERE id = $1', [req.user.id]);
      
      if (user.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User no longer exists',
            code: 'INVALID_TOKEN'
          }
        });
      }
      
      // Update user info from database
      req.user.role = user.rows[0].role;
      req.user.charity_id = user.rows[0].charity_id;
      req.user.is_admin = user.rows[0].is_admin;
      req.user.is_worldcoin_verified = user.rows[0].is_worldcoin_verified;
      
      next();
    } catch (error) {
      logger.error('JWT verification failed:', error);
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token is invalid or expired',
          code: 'INVALID_TOKEN'
        }
      });
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Server error during authentication',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Admin authorization middleware
 */
const authorizeAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }
    
    // Check both role and is_admin flag
    if (req.user.role !== 'corporate') {
      logger.warn(`Admin access denied for user ${req.user.id}`, {
        user: {
          id: req.user.id,
          role: req.user.role,
          is_admin: req.user.is_admin
        },
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Admin privileges required',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error('Authorization error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Server error during authorization',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Charity admin authorization middleware
 */
const authorizeCharity = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }
    
    // Allow global admins or charity admins
    if (req.user.role === 'admin' || req.user.role === 'charity_admin') {
      next();
    } else {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Charity admin privileges required',
          code: 'PERMISSION_DENIED'
        }
      });
    }
  } catch (error) {
    logger.error('Authorization error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Server error during authorization',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Project-specific charity admin authorization middleware
 * Checks if user is admin of the charity that owns the project
 */
const authorizeProjectCharity = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }
    
    // Global admins can do anything
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if user is charity admin
    if (req.user.role !== 'charity_admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Charity admin privileges required',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    // Get project ID from params
    const projectId = req.params.id;
    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Project ID is required',
          code: 'INVALID_REQUEST'
        }
      });
    }
    
    // Check if project belongs to user's charity
    const projectQuery = await db.query(
      'SELECT charity_id FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'NOT_FOUND'
        }
      });
    }
    
    if (projectQuery.rows[0].charity_id !== req.user.charity_id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You do not have permission to access this project',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error('Authorization error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Server error during authorization',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Generic authorization middleware based on roles
 * @param {string[]} allowedRoles - Array of roles allowed to access the route
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED'
          }
        });
      }

      // Check if user has one of the allowed roles
      const userRole = req.user.role;
      let hasPermission = false;
      if (allowedRoles.includes(userRole)) {
        hasPermission = true;
      }
      if (userRole === 'corporate' && allowedRoles.includes('admin')) {
        hasPermission = true;
      }

      if (!hasPermission) {
        logger.warn(`Permission denied for user ${req.user.id} (Role: ${userRole}) for roles: ${allowedRoles.join(', ')}`, {
          user: {
            id: req.user.id,
            role: userRole
          },
          requiredRoles: allowedRoles,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to perform this action',
            code: 'PERMISSION_DENIED'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Server error during authorization',
          code: 'SERVER_ERROR'
        }
      });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeAdmin,
  authorizeCharity,
  authorizeProjectCharity
}; 