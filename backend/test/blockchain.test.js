const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
// Use mock instead of real module
const blockchainConfig = require('./mocks/blockchain-config.mock');
const crypto = require('crypto');
const { fail } = require('jest-fail-on-console');
const { generateDeterministicAddress } = require('../src/utils/blockchain-utils');

// Load environment variables
require('dotenv').config();

describe('Blockchain Integration Tests', () => {
  // Test provider connection
  describe('Provider Connection', () => {
    it('should connect to the blockchain provider', async () => {
      try {
        const provider = blockchainConfig.getProvider();
        const network = await provider.getNetwork();
        
        console.log(`Connected to network: ${network.name} (ChainID: ${network.chainId})`);
        console.log(`Network URL: ${blockchainConfig.rpcUrl}`);
        
        expect(network.chainId).toBeDefined();
      } catch (error) {
        console.error(`Blockchain connection failed: ${error.message}`);
        fail(`Blockchain connection failed: ${error.message}`);
      }
    });
    
    it('should connect to the correct network', async () => {
      try {
        const provider = blockchainConfig.getProvider();
        const network = await provider.getNetwork();
        
        // Scroll networks have specific chainIDs
        // Testnet (Sepolia): 534351
        // Mainnet: 534352
        expect([534351, 534352]).toContain(Number(network.chainId));
      } catch (error) {
        console.error(`Network connection failed: ${error.message}`);
        fail(`Network connection failed: ${error.message}`);
      }
    });
    
    it('should have a funded signer account', async () => {
      try {
        const wallet = blockchainConfig.getSigner();
        const balance = await wallet.provider.getBalance(wallet.address);
        
        console.log(`Signer address: ${wallet.address}`);
        console.log(`Signer balance: ${ethers.formatEther(balance)} ETH`);
        
        // Convert to number for easier comparison
        const balanceInEth = Number(ethers.formatEther(balance));
        expect(balanceInEth).toBeGreaterThan(0);
      } catch (error) {
        console.error(`Signer account check failed: ${error.message}`);
        fail(`Signer account check failed: ${error.message}`);
      }
    });
  });
  
  // Test contract loading
  describe('Contract Loading', () => {
    it('should load the platform contract', () => {
      try {
        const platformContract = blockchainConfig.getReadContract(blockchainConfig.platformContract);
        expect(platformContract.target).toBe(blockchainConfig.platformContract);
        
        console.log(`Platform contract address: ${platformContract.target}`);
      } catch (error) {
        console.error(`Failed to load platform contract: ${error.message}`);
        fail(`Failed to load platform contract: ${error.message}`);
      }
    });
    
    it('should get the contract owner', async () => {
      try {
        const platformContract = blockchainConfig.getReadContract(blockchainConfig.platformContract);
        
        // Check if the contract has an owner() function
        if (platformContract.owner) {
          const owner = await platformContract.owner();
          console.log(`Platform contract owner: ${owner}`);
          expect(ethers.isAddress(owner)).toBe(true);
        } else {
          console.log('Contract does not have an owner() function, skipping test');
        }
      } catch (error) {
        console.warn(`Could not get contract owner: ${error.message}`);
      }
    });
  });
  
  // Test wallet creation
  describe('Wallet Creation', () => {
    it('should create a deterministic wallet address', () => {
      try {
        // Generate random test data
        const testEmail = `test-${Date.now()}@example.com`;
        const testSalt = Math.floor(Math.random() * 1000000);
        
        // Hash the email (similar to how the backend would do it)
        const hashedEmail = '0x' + crypto.createHash('sha256')
          .update(testEmail)
          .digest('hex');
        
        // Use the blockchain utility to generate a deterministic address
        const address = generateDeterministicAddress(hashedEmail, testSalt);
        
        console.log(`Test email: ${testEmail}`);
        console.log(`Hashed email: ${hashedEmail}`);
        console.log(`Salt: ${testSalt}`);
        console.log(`Deterministic address: ${address}`);
        
        expect(ethers.isAddress(address)).toBe(true);
      } catch (error) {
        console.error(`Deterministic address generation failed: ${error.message}`);
        fail(`Deterministic address generation failed: ${error.message}`);
      }
    });
  });
  
  // Test contract reads
  describe('Contract Read Operations', () => {
    // Only run this test if we have registered test accounts
    it('should read existing wallet addresses from contract', async () => {
      try {
        const platformContract = blockchainConfig.getReadContract(blockchainConfig.platformContract);
        // Use a mock email hash
        const testEmailHash = '0x' + crypto.createHash('sha256')
          .update('test@example.com')
          .digest('hex');
        
        console.log(`Looking up address for email hash: ${testEmailHash}`);
        const walletAddress = await platformContract.getUserAccount(testEmailHash);
        
        console.log(`Found wallet address: ${walletAddress}`);
        expect(walletAddress).not.toBe(ethers.ZeroAddress);
        expect(ethers.isAddress(walletAddress)).toBe(true);
      } catch (error) {
        console.warn(`Error reading from contract: ${error.message}`);
        fail(`Error reading from contract: ${error.message}`);
      }
    });
  });
  
  // Test balance query
  describe('Balance Queries', () => {
    it('should get the balance of a wallet', async () => {
      try {
        // Use platform contract address as a test (it should have funds)
        const testAddress = blockchainConfig.platformContract;
        
        // Get provider directly
        const provider = blockchainConfig.getProvider();
        const balance = await provider.getBalance(testAddress);
        
        console.log(`Test address: ${testAddress}`);
        console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
        
        expect(balance).toBeDefined();
      } catch (error) {
        console.error(`Failed to get wallet balance: ${error.message}`);
        fail(`Failed to get wallet balance: ${error.message}`);
      }
    });
  });
}); 