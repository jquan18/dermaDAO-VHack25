const axios = require('axios');

/**
 * Simple script to test the debug endpoint
 * Usage: 
 * 1. Login to the application to get a JWT token
 * 2. Put the token in the authorization header below
 * 3. Run the script: node scripts/test-debug-endpoint.js
 */

const BASE_URL = 'http://localhost:8000'; // Change this if your server runs on a different port
const ACCESS_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with a valid JWT token

async function testDebugEndpoint() {
  try {
    console.log('Testing debug endpoint...');
    
    const response = await axios.get(`${BASE_URL}/api/debug/user-charity`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    });
    
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error testing debug endpoint:');
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    } else {
      // Something happened in setting up the request
      console.error('Error:', error.message);
    }
  }
}

testDebugEndpoint(); 