const { Pool } = require('pg');
const logger = require('./logger');

// Load environment variables
require('dotenv').config();

// Create a new Pool instance with connection details from environment variables
const pool = new Pool({
  connectionString: process.env.NEON_CONNECTION_STRING
});

// Test database connection on startup
const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Database connection established successfully');
    client.release();
    return true;
  } catch (error) {
    logger.error('Error connecting to database:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query: (text, params) => {
    return pool.query(text, params);
  },
  testConnection
}; 