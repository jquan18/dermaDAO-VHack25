const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<boolean>} - Whether passwords match
 */
const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Create a JWT token for a user
 * @param {Object|string|number} user - User object with id or user ID directly
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
  // Check if user is an object with an id or just an id
  const userId = typeof user === 'object' && user !== null ? user.id : user;
  
  // Make sure we have a valid userId
  if (!userId) {
    throw new Error('Invalid user ID for token generation');
  }
  
  return jwt.sign(
    { user: { id: userId } },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Hash an email for blockchain references
 * @param {string} email - User email
 * @returns {string} - Hashed email
 */
const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
};

/**
 * Generate a random salt for wallet creation
 * @returns {number} - Random salt value between 1 and 1,000,000
 */
const generateWalletSalt = () => {
  // Use a smaller value range to avoid overflows
  // when the salt is used in contract functions
  return Math.floor(Math.random() * 1000000) + 1;
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  hashEmail,
  generateWalletSalt
}; 