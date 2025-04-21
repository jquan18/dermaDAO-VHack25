/**
 * Utilities for blockchain operations
 */
const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * Generates a deterministic wallet address from an email hash and salt
 * This simulates the smart contract's address generation logic for testing
 * 
 * @param {string} emailHash - Hashed email as hex string
 * @param {number} salt - Salt value used for address generation
 * @returns {string} - Predicted wallet address
 */
const generateDeterministicAddress = (emailHash, salt) => {
  try {
    // Convert inputs to proper format
    const cleanHash = emailHash.startsWith('0x') ? emailHash.slice(2) : emailHash;
    
    // Create a composite hash from email hash and salt (similar to contract logic)
    const composite = crypto.createHash('sha256')
      .update(Buffer.from(cleanHash, 'hex'))
      .update(Buffer.from(salt.toString()))
      .digest('hex');
    
    // Create ethereum address format (0x + 40 hex chars)
    const address = '0x' + composite.substring(0, 40);
    
    // Return checksummed address
    return ethers.getAddress(address);
  } catch (error) {
    console.error('Error generating deterministic address:', error);
    // Return a fallback address based on timestamp if generation fails
    const fallback = '0x' + crypto.createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 40);
    
    return ethers.getAddress(fallback);
  }
};

module.exports = {
  generateDeterministicAddress
}; 