/**
 * Migration to add wallet error tracking columns to users table
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../../config/logger');

async function runMigration() {
  // Get database connection from environment variables
  const {
    PGUSER,
    PGHOST,
    PGPASSWORD,
    PGDATABASE,
    PGPORT,
    DATABASE_URL
  } = process.env;

  // Create a database connection pool
  const pool = new Pool(DATABASE_URL ? { connectionString: DATABASE_URL } : {
    user: PGUSER,
    host: PGHOST,
    database: PGDATABASE,
    password: PGPASSWORD,
    port: PGPORT
  });

  try {
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if columns already exist
      const checkResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('wallet_error_code', 'wallet_creation_error', 'wallet_salt')
      `);
      
      const existingColumns = checkResult.rows.map(row => row.column_name);
      
      // Add wallet_salt column if it doesn't exist
      if (!existingColumns.includes('wallet_salt')) {
        logger.info('Adding wallet_salt column to users table');
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN wallet_salt BIGINT
        `);
      }
      
      // Add wallet_creation_error column if it doesn't exist
      if (!existingColumns.includes('wallet_creation_error')) {
        logger.info('Adding wallet_creation_error column to users table');
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN wallet_creation_error TEXT
        `);
      }
      
      // Add wallet_error_code column if it doesn't exist
      if (!existingColumns.includes('wallet_error_code')) {
        logger.info('Adding wallet_error_code column to users table');
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN wallet_error_code VARCHAR(50)
        `);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      logger.info('Migration completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration }; 