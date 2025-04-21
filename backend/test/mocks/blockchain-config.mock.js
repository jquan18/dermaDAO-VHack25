/**
 * Mock for blockchain configuration in tests
 */
const { ethers } = require('ethers');

// Mock provider with minimal functionality
const mockProvider = {
  getNetwork: async () => ({ 
    chainId: 534351, 
    name: 'scrollSepolia' 
  }),
  getBalance: async () => ethers.parseEther('1.0'),
  getCode: async () => '0x'
};

// A static wallet for testing
const testWallet = {
  address: '0x1234567890123456789012345678901234567890',
  provider: mockProvider
};

// Mock contract with minimal functionality
const mockContract = {
  target: '0x1234567890123456789012345678901234567890',
  getUserAccount: async () => '0x2345678901234567890123456789012345678901',
  owner: async () => '0x3456789012345678901234567890123456789012'
};

// Export mock functions that match the real blockchain-config interface
module.exports = {
  platformContract: '0x1234567890123456789012345678901234567890',
  rpcUrl: 'https://sepolia-rpc.scroll.io/',
  
  // Provider function
  getProvider: () => mockProvider,
  
  // Signer function
  getSigner: () => testWallet,
  
  // Contract functions
  getReadContract: () => mockContract,
  getSignedContract: () => mockContract
}; 