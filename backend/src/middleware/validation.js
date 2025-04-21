const { validationResult } = require('express-validator');

/**
 * Validate request middleware
 * Use with express-validator checks
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      }
    });
  }
  
  next();
};

module.exports = {
  validateRequest
}; 