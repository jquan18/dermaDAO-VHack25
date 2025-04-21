/**
 * Custom Application Error class
 * Extends the built-in Error class with additional properties for better error handling
 */
class AppError extends Error {
  /**
   * Creates a new AppError instance
   * 
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {boolean} isOperational - Whether this is an operational error that can be handled
   * @param {string} stack - Error stack trace
   */
  constructor(message, statusCode, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = {
  AppError
}; 