const logger = require('../config/logger');

/**
 * Not found middleware
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  // Set status code
  const statusCode = (typeof res.statusCode === 'number' && res.statusCode !== 200) ? res.statusCode : 500;
  
  // Determine error code
  let errorCode = 'SERVER_ERROR';
  
  if (statusCode === 404) {
    errorCode = 'RESOURCE_NOT_FOUND';
  } else if (err.name === 'ValidationError') {
    errorCode = 'VALIDATION_ERROR';
  } else if (err.code === 'BLOCKCHAIN_ERROR') {
    errorCode = 'BLOCKCHAIN_ERROR';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: errorCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = {
  notFound,
  errorHandler
}; 