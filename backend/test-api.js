/**
 * DermaDAO API Test Script
 * 
 * This script tests the backend API for proper functionality,
 * including database and blockchain connectivity.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

/**
 * Execute tests and collect results
 */
function runTests() {
  console.log('\n👋 Starting DermaDAO API Tests...\n');
  
  // Ensure the test directory exists
  if (!fs.existsSync(path.join(__dirname, 'test'))) {
    console.error('❌ Test directory not found. Please create test files first.');
    process.exit(1);
  }
  
  // Check if the server is running
  let serverRunning = false;
  try {
    // Try a simple curl to the health endpoint
    execSync('curl -s http://localhost:8000/health > /dev/null');
    serverRunning = true;
    console.log('✅ API server is running - will test HTTP endpoints');
  } catch (error) {
    console.warn('⚠️ API server is not running - HTTP endpoint tests will be skipped');
    console.warn('⚠️ Start the server with: npm run dev');
    
    // Set an environment variable to skip HTTP tests
    process.env.SKIP_HTTP_TESTS = 'true';
  }
  
  // Test types to run, each corresponding to a file in the test directory
  const testTypes = [
    { name: 'Database', file: 'database.test.js' },
    { name: 'Blockchain', file: 'blockchain.test.js' },
    { name: 'API', file: 'api.test.js' }
  ];
  
  const results = [];
  
  // Run each test and collect results
  for (const test of testTypes) {
    console.log(`\n🧪 Running ${test.name} tests...\n`);
    
    try {
      // Run Jest for the specific test file with more flags
      execSync(`npx jest test/${test.file} --verbose --runInBand --forceExit`, { 
        stdio: 'inherit',
        cwd: __dirname,
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });
      
      results.push({
        type: test.name,
        success: true,
        message: `✅ ${test.name} tests passed`
      });
    } catch (error) {
      results.push({
        type: test.name,
        success: false,
        message: `❌ ${test.name} tests failed`
      });
    }
  }
  
  // Display summary
  console.log('\n📋 Test Summary:');
  console.log('----------------');
  
  let allPassed = true;
  
  for (const result of results) {
    console.log(result.message);
    if (!result.success) {
      allPassed = false;
    }
  }
  
  console.log('\n');
  
  if (allPassed) {
    console.log('✅ All tests passed! The backend API is functioning properly.');
    
    if (!serverRunning) {
      console.log('ℹ️ Note: API server was not running during tests - HTTP endpoints were not fully tested.');
      console.log('   Start the server with "npm run dev" and run tests again for complete coverage.');
    }
  } else {
    console.log('⚠️ Some tests failed. Please check the logs above for details.');
    
    if (!serverRunning) {
      console.log('ℹ️ HTTP endpoint tests were skipped because the API server was not running.');
      console.log('   Start the server with "npm run dev" and run tests again for complete coverage.');
    }
  }
  
  return allPassed;
}

// Execute the tests
const success = runTests();

// Exit with appropriate code
process.exit(success ? 0 : 1); 