/**
 * Jest configuration for DermaDAO API tests
 */

module.exports = {
  // Jest environment configuration
  testEnvironment: 'node',
  
  // Longer timeout for blockchain tests
  testTimeout: 60000,
  
  // Test coverage collection
  collectCoverage: false,
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  
  // Set verbose output
  verbose: true,
  
  // Continue tests when one fails
  bail: 0,
  
  // Wait for all promises to resolve before considering a test done
  testRunner: 'jest-circus/runner',
  
  // Run setup before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Custom reporter for better logging
  reporters: ['default'],
  
  // Automatically clear mock calls and instances between tests
  clearMocks: true,
  
  // Set max workers
  maxWorkers: 1,
  
  // Add additional globals
  globals: {
    API_URL: process.env.API_BASE_URL || 'http://localhost:8000'
  }
}; 