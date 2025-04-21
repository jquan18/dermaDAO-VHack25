/**
 * Test utilities for DermaDAO API tests
 */

const request = require('supertest');
const crypto = require('crypto');

// Base URL for API requests
const baseURL = process.env.API_BASE_URL || 'http://localhost:8000';

/**
 * Create a test API client
 * @returns {object} Supertest instance
 */
const getApiClient = () => {
  return request(baseURL);
};

/**
 * Generate a random test user
 * @returns {object} User object with test data
 */
const generateTestUser = () => {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: `Test${timestamp}!`,
    full_name: `Test User ${timestamp}`
  };
};

/**
 * Register a test user and get auth token
 * @returns {Promise<object>} Object with user data and token
 */
const registerTestUser = async () => {
  const api = getApiClient();
  const testUser = generateTestUser();
  
  const response = await api
    .post('/api/auth/register')
    .send(testUser);
  
  if (response.status !== 201) {
    throw new Error(`Failed to register test user: ${JSON.stringify(response.body)}`);
  }
  
  return {
    user: testUser,
    token: response.body.data.token,
    wallet_address: response.body.data.wallet_address
  };
};

/**
 * Login with user credentials
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} Auth token
 */
const loginUser = async (email, password) => {
  const api = getApiClient();
  
  const response = await api
    .post('/api/auth/login')
    .send({ email, password });
  
  if (response.status !== 200) {
    throw new Error(`Failed to login: ${JSON.stringify(response.body)}`);
  }
  
  return response.body.data.token;
};

/**
 * Generate a hash for email (similar to how the backend does it)
 * @param {string} email - Email to hash
 * @returns {string} Hashed email
 */
const hashEmail = (email) => {
  return '0x' + crypto.createHash('sha256')
    .update(email)
    .digest('hex');
};

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  getApiClient,
  generateTestUser,
  registerTestUser,
  loginUser,
  hashEmail,
  sleep
}; 