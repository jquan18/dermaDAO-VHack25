/**
 * Test setup file for Jest
 * This runs before all tests
 */

// Load environment variables
require('dotenv').config();

// Set longer timeout for blockchain operations
jest.setTimeout(30000);

// Global console log capture to reduce noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

// This is for debugging only - uncomment to silence logs during tests
/*
console.log = (...args) => {
  // Disable or filter console logs in tests
  // originalConsoleLog(...args);
};

console.warn = (...args) => {
  // Keep warnings but mark them
  originalConsoleWarn('⚠️', ...args);
};
*/

// Global setup before all tests
beforeAll(() => {
  console.log('🚀 Starting DermaDAO API tests');
  console.log('📊 Environment:', process.env.NODE_ENV || 'development');
  console.log('📅 Test run started at:', new Date().toISOString());
  console.log('-'.repeat(50));
});

// Global cleanup after all tests
afterAll(() => {
  console.log('-'.repeat(50));
  console.log('🏁 All tests completed at:', new Date().toISOString());
}); 