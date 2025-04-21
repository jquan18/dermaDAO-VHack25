// This file configures Jest globally for all tests

// Increase timeout for blockchain operations
jest.setTimeout(30000);

// Add fail function to global scope for easier use in tests
global.fail = (message) => {
  throw new Error(message);
};

// Disable console error output during tests if needed
// const originalConsoleError = console.error;
// console.error = (...args) => {
//   if (process.env.DEBUG) {
//     originalConsoleError(...args);
//   }
// };

// Suppress excessive console output during tests (uncomment if needed)
/*
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args) => {
  if (process.env.DEBUG) {
    originalConsoleLog(...args);
  }
};

console.warn = (...args) => {
  if (process.env.DEBUG) {
    originalConsoleWarn(...args);
  }
};

console.error = (...args) => {
  // Always show errors
  originalConsoleError(...args);
};
*/

// Log test start
beforeAll(() => {
  console.log('Starting DermaDAO API tests');
  console.log(`Test environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Test timestamp: ${new Date().toISOString()}`);
  console.log('-'.repeat(50));
}); 