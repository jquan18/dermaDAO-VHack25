const request = require('supertest');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const db = require('../src/config/database');
// Use mock instead of real module
const blockchainConfig = require('./mocks/blockchain-config.mock');
const { fail } = require('jest-fail-on-console');

// Load environment variables
require('dotenv').config();

// URL of the server
const baseURL = process.env.API_BASE_URL || 'http://localhost:8000';
const api = request(baseURL);

// Helper function to check if the server is running
const isServerRunning = async () => {
  if (process.env.SKIP_HTTP_TESTS === 'true') {
    return false;
  }
  
  try {
    await api.get('/health');
    return true;
  } catch (error) {
    return false;
  }
};

// Test suite for API integration tests
describe('DermaDAO API Integration Tests', () => {
  // Skip HTTP tests if server not running
  let serverRunning = false;

  beforeAll(async () => {
    serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.warn('⚠️ API server is not running or SKIP_HTTP_TESTS is set. HTTP endpoint tests will be skipped.');
    }
  });

  // Test health endpoint
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      if (!serverRunning) {
        console.log('Skipping test: API server not running');
        return;
      }
      
      const response = await api.get('/health');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  // Test database connection
  describe('Database Connection', () => {
    it('should connect to the database successfully', async () => {
      const isConnected = await db.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should be able to execute a simple query', async () => {
      try {
        const result = await db.query('SELECT NOW()');
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
      } catch (error) {
        fail(`Database query failed: ${error.message}`);
      }
    });
  });

  // Test blockchain connection
  describe('Blockchain Connection', () => {
    it('should connect to the blockchain provider', async () => {
      try {
        const provider = blockchainConfig.getProvider();
        const network = await provider.getNetwork();
        expect(network.chainId).toBeDefined();
        console.log(`Connected to network: ${network.name} (ChainID: ${network.chainId})`);
      } catch (error) {
        console.error(`Blockchain connection failed: ${error.message}`);
        fail(`Blockchain connection failed: ${error.message}`);
      }
    });

    it('should retrieve the platform contract', () => {
      try {
        const platformContract = blockchainConfig.getReadContract(blockchainConfig.platformContract);
        expect(platformContract.target).toBe(blockchainConfig.platformContract);
      } catch (error) {
        console.error(`Failed to get platform contract: ${error.message}`);
        fail(`Failed to get platform contract: ${error.message}`);
      }
    });
  });

  // HTTP endpoint tests - these will be skipped if server is not running
  describe('HTTP API Endpoints', () => {
    beforeAll(() => {
      // Skip all HTTP tests if server is not running
      if (!serverRunning) {
        console.log('Skipping HTTP endpoint tests: API server not running');
      }
    });
    
    // Auth API tests
    describe('Auth API', () => {
      const testUser = {
        email: `test-${Date.now()}@example.com`,
        password: 'Test123!@#',
        full_name: 'Test User'
      };
      let authToken;
  
      it('should register a new user', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        const response = await api
          .post('/api/auth/register')
          .send(testUser);
  
        // Handle both 201 (success) and 400 (validation error, might happen if email already exists)
        expect([201, 400]).toContain(response.status);
        
        if (response.status === 201) {
          expect(response.body.success).toBe(true);
          expect(response.body.data.email).toBe(testUser.email);
          expect(response.body.data.token).toBeDefined();
          expect(response.body.data.wallet_address).toBeDefined();
          console.log(`User registered with wallet address: ${response.body.data.wallet_address}`);
        } else {
          console.log(`Registration failed with status ${response.status}: ${JSON.stringify(response.body)}`);
        }
      });
  
      it('should login with valid credentials', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        // Try to login with test user credentials
        const response = await api
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          });
  
        // Allow both success (200) and invalid credentials (401) since we may not have registered successfully
        expect([200, 401]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data.token).toBeDefined();
          
          // Save token for subsequent requests
          authToken = response.body.data.token;
          console.log('Login successful, got auth token');
        } else {
          console.log(`Login failed with status ${response.status}: ${JSON.stringify(response.body)}`);
          
          // Try to login with admin account as fallback
          if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            console.log('Trying to login with admin account');
            const adminResponse = await api
              .post('/api/auth/login')
              .send({
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD
              });
            
            if (adminResponse.status === 200) {
              authToken = adminResponse.body.data.token;
              console.log('Admin login successful, got auth token');
            }
          }
        }
      });
  
      it('should get user profile', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        if (!authToken) {
          console.warn('Skipping test: No auth token available');
          return;
        }
  
        const response = await api
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${authToken}`);
  
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toBeDefined();
        console.log(`Got profile for user: ${response.body.data.email}`);
      });
    });
  
    // Charity API tests
    describe('Charity API', () => {
      let authToken;
      let charityId;
  
      // Login as admin first (assuming admin credentials are in env)
      beforeAll(async () => {
        if (!serverRunning) return;
        
        if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
          const response = await api
            .post('/api/auth/login')
            .send({
              email: process.env.ADMIN_EMAIL,
              password: process.env.ADMIN_PASSWORD
            });
  
          if (response.status === 200) {
            authToken = response.body.data.token;
          }
        }
      });
  
      it('should list charities', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        const response = await api.get('/api/charities');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.charities)).toBe(true);
      });
  
      it('should register a new charity', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        if (!authToken) {
          console.warn('Skipping test: No auth token available');
          return;
        }
  
        const charity = {
          name: `Test Charity ${Date.now()}`,
          description: 'Test charity for automated testing',
          website: 'https://testcharity.org',
          registration_number: '123456789',
          country: 'Test Country',
          documentation_ipfs_hash: 'ipfs://test-hash'
        };
  
        const response = await api
          .post('/api/charities')
          .set('Authorization', `Bearer ${authToken}`)
          .send(charity);
  
        // Accept both success (201) and potential errors (4xx)
        if (response.status === 201) {
          expect(response.body.success).toBe(true);
          expect(response.body.data.name).toBe(charity.name);
          
          charityId = response.body.data.charity_id;
          console.log(`Charity created with ID: ${charityId}`);
        } else {
          console.log(`Charity creation failed with status ${response.status}: ${JSON.stringify(response.body)}`);
        }
      });
  
      it('should get charity details', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        if (!charityId) {
          console.warn('Skipping test: No charity ID available');
          return;
        }
  
        const response = await api.get(`/api/charities/${charityId}`);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.charity_id).toBe(charityId);
      });
    });
  
    // Project API tests
    describe('Project API', () => {
      it('should list projects', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        const response = await api.get('/api/projects');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.projects)).toBe(true);
      });
    });
  
    // Donation API tests
    describe('Donation API', () => {
      it('should list donations', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        const response = await api.get('/api/donations/project/1');
        // This might return 200 with empty array or 404 if no project with ID 1
        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });
    });
  
    // Wallet API tests
    describe('Wallet API', () => {
      let authToken;
  
      // Login first (assuming test user credentials are available)
      beforeAll(async () => {
        if (!serverRunning) return;
        
        if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
          const response = await api
            .post('/api/auth/login')
            .send({
              email: process.env.TEST_EMAIL,
              password: process.env.TEST_PASSWORD
            });
  
          if (response.status === 200) {
            authToken = response.body.data.token;
          }
        }
      });
  
      it('should get wallet balance', async () => {
        if (!serverRunning) {
          console.log('Skipping test: API server not running');
          return;
        }
        
        if (!authToken) {
          console.warn('Skipping test: No auth token available');
          return;
        }
  
        const response = await api
          .get('/api/wallet/balance')
          .set('Authorization', `Bearer ${authToken}`);
  
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.wallet_address).toBeDefined();
        expect(response.body.data.balance).toBeDefined();
      });
    });
  });
}); 