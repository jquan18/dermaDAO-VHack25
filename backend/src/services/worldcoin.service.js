const logger = require('../config/logger');
const db = require('../config/database');
const worldcoinConfig = require('../config/worldcoin');
const axios = require('axios');
const crypto = require('crypto');
const blockchain = require('./blockchain.service');

/**
 * Generate a secure state and nonce for OAuth flow
 * @returns {Object} state and nonce values
 */
const generateOAuthSecurityParams = () => {
  return {
    state: crypto.randomBytes(16).toString('hex'),
    nonce: crypto.randomBytes(16).toString('hex')
  };
};

/**
 * Generate a Worldcoin authorization URL
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Auth URL and state
 */
const generateAuthUrl = async (userId) => {
  try {
    const { state, nonce } = generateOAuthSecurityParams();
    
    // Store the state and nonce in the database for verification
    await db.query(
      `INSERT INTO worldcoin_oauth_states 
       (user_id, state, nonce, created_at, expires_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '10 minutes')`,
      [userId, state, nonce]
    );
    
    // Generate the authorization URL
    const authUrl = worldcoinConfig.getAuthorizationUrl(state, nonce);
    
    return {
      auth_url: authUrl,
      state: state
    };
  } catch (error) {
    logger.error(`Error generating Worldcoin auth URL: ${error.message}`, error);
    throw new Error(`Failed to generate authorization URL: ${error.message}`);
  }
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from Worldcoin
 * @param {string} state - State parameter for security validation
 * @returns {Promise<Object>} OAuth tokens and user data
 */
const exchangeCodeForTokens = async (code, state) => {
  try {
    // Verify state parameter exists in our database
    const stateCheck = await db.query(
      `SELECT user_id, nonce FROM worldcoin_oauth_states 
       WHERE state = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [state]
    );
    
    if (stateCheck.rows.length === 0) {
      throw new Error('Invalid or expired state parameter');
    }
    
    const userId = stateCheck.rows[0].user_id;
    const nonce = stateCheck.rows[0].nonce;
    
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      worldcoinConfig.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: worldcoinConfig.redirectUri,
        client_id: worldcoinConfig.clientId,
        client_secret: worldcoinConfig.clientSecret
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, id_token } = tokenResponse.data;
    
    // Get user information using the access token
    const userInfoResponse = await axios.get(worldcoinConfig.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    // Extract verification level from the user info
    const userInfo = userInfoResponse.data;
    const verificationLevel = userInfo["https://id.worldcoin.org/v1"]?.verification_level || 'unknown';
    
    // Delete the used state from the database
    await db.query(
      'DELETE FROM worldcoin_oauth_states WHERE state = $1',
      [state]
    );
    
    return {
      user_id: userId,
      worldcoin_id: userInfo.sub,
      verification_level: verificationLevel,
      access_token,
      id_token
    };
  } catch (error) {
    logger.error(`Error exchanging code for tokens: ${error.message}`, error);
    throw new Error(`Failed to verify with Worldcoin: ${error.message}`);
  }
};

/**
 * Complete the verification process for a user
 * @param {number} userId - User ID
 * @param {Object} worldcoinData - Data from Worldcoin verification
 * @returns {Promise<boolean>} - Whether verification was successful
 */
const completeVerification = async (userId, worldcoinData) => {
  try {
    // Check the verification level
    // Example: 'orb' is the highest level, 'device' is lower
    const isVerified = worldcoinData.verification_level === 'orb';
    
    if (!isVerified) {
      logger.warn(`User ${userId} has insufficient verification level: ${worldcoinData.verification_level}`);
      return false;
    }
    
    // Update the user in the database
    await db.query(
      `UPDATE users SET 
       is_worldcoin_verified = TRUE, 
       worldcoin_id = $1, 
       worldcoin_verification_level = $2,
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [worldcoinData.worldcoin_id, worldcoinData.verification_level, userId]
    );
    
    // Get user's wallet address
    const userResult = await db.query(
      'SELECT wallet_address FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].wallet_address) {
      throw new Error('User wallet address not found');
    }
    
    const walletAddress = userResult.rows[0].wallet_address;
    
    // Update verification status on blockchain
    try {
      await blockchain.verifyUserWithWorldcoin(walletAddress, true);
      logger.info(`User ${userId} (${walletAddress}) verified on blockchain with Worldcoin`);
    } catch (blockchainError) {
      logger.error(`Blockchain verification failed for user ${userId}:`, blockchainError);
      // Continue with verification process even if blockchain update fails
    }
    
    // Create audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        userId,
        'WORLDCOIN_VERIFY',
        'users',
        userId,
        JSON.stringify({ 
          verified: true, 
          worldcoin_id: worldcoinData.worldcoin_id,
          verification_level: worldcoinData.verification_level 
        })
      ]
    );
    
    logger.info(`User ${userId} successfully verified with Worldcoin at level: ${worldcoinData.verification_level}`);
    return true;
  } catch (error) {
    logger.error('Worldcoin verification completion error:', error);
    throw new Error(`Failed to complete verification: ${error.message}`);
  }
};

/**
 * Legacy function to verify a user with Worldcoin proof
 * @param {number} userId - User ID
 * @param {string} worldcoinProof - Worldcoin proof
 * @returns {Promise<boolean>} - Whether verification was successful
 */
const verifyUser = async (userId, worldcoinProof) => {
  try {
    // This is now a legacy function that redirects to the OAuth flow
    // The worldcoinProof parameter is ignored
    logger.info(`Legacy verification requested for user ${userId}`);
    
    // Generate auth URL for the OAuth flow
    const { auth_url } = await generateAuthUrl(userId);
    
    // Return information about the OAuth flow
    return { 
      success: false,
      needsOAuth: true,
      auth_url,
      message: "OAuth verification required" 
    };
  } catch (error) {
    logger.error('Worldcoin verification error:', error);
    throw new Error(`Failed to verify with Worldcoin: ${error.message}`);
  }
};

module.exports = {
  verifyUser,
  generateAuthUrl,
  exchangeCodeForTokens,
  completeVerification
}; 