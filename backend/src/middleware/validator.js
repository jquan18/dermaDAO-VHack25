const { validationResult } = require('express-validator');
const logger = require('../config/logger');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error('Validation error:', {
      errors: errors.array(),
      body: req.body
    });
    
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      }
    });
  }
  next();
};

module.exports = {
  validateRequest
}; 