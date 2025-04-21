#!/usr/bin/env node

/**
 * Script to run database migrations
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Get migration name from command line
const migrationName = process.argv[2];

if (!migrationName) {
  logger.error('Migration name is required');
  console.log('Usage: node run-migration.js <migration-name>');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '../db/migrations');

// Check if the migration file exists
const migrationFile = path.join(migrationsDir, `${migrationName}.js`);

if (!fs.existsSync(migrationFile)) {
  logger.error(`Migration ${migrationName} not found`);
  
  // List available migrations
  const availableMigrations = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .map(file => file.replace('.js', ''));
  
  if (availableMigrations.length > 0) {
    logger.info('Available migrations:');
    availableMigrations.forEach(migration => {
      console.log(`- ${migration}`);
    });
  } else {
    logger.info('No migrations available');
  }
  
  process.exit(1);
}

// Run the migration
logger.info(`Running migration: ${migrationName}`);
const migration = require(migrationFile);

migration.runMigration()
  .then(() => {
    logger.info(`Migration ${migrationName} completed successfully`);
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Migration ${migrationName} failed:`, error);
    process.exit(1);
  }); 