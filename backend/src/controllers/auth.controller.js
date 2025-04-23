const { validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  hashEmail,
  generateWalletSalt
} = require('../utils/crypto');
const blockchain = require('../services/blockchain.service');
const crypto = require('crypto');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res) => {
  try {
    const { email, password, name, full_name, role = 'user', company_name, company_description, company_website } = req.body;
    
    // Use name if full_name is not provided
    const userFullName = full_name || name;
    
    // Check if user already exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'User already exists',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Hash email for blockchain reference
    const hashedEmail = hashEmail(email);
    
    // Generate salt for deterministic wallet creation
    const salt = generateWalletSalt();
    
    // Determine if user is admin based on role
    const isAdmin = role === 'admin';
    
    // Create user first without wallet address
    const result = await db.query(
      `INSERT INTO users (
        email, 
        password_hash, 
        full_name, 
        hashed_email,
        is_admin,
        role,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
      RETURNING id, email, full_name, is_admin, is_worldcoin_verified`,
      [email, hashedPassword, userFullName, hashedEmail, isAdmin, role]
    );
    
    const user = result.rows[0];
    
    // Add role to user object for frontend
    user.role = role;
    
    // Create wallet via blockchain service
    try {
      logger.info(`Creating wallet for user ${user.id}`);
      // Create the wallet through platform contract and get the address
      const walletAddress = await blockchain.createUserWallet(hashedEmail, salt);
      
      // Update user with wallet address
      await db.query(
        'UPDATE users SET wallet_address = $1, wallet_salt = $2 WHERE id = $3',
        [walletAddress, salt, user.id]
      );
      
      // Add wallet address to user object
      user.wallet_address = walletAddress;
      
      logger.info(`Wallet created for user ${user.id}: ${walletAddress}`);
    } catch (error) {
      logger.error(`Failed to create wallet for user ${user.id}:`, error);
      
      // Set specific error information to be stored
      let errorMessage = 'Blockchain unavailable - using placeholder address';
      let errorCode = 'BLOCKCHAIN_ERROR';
      
      // Provide more specific error information
      if (error.statusCode) {
        errorCode = error.status === 'fail' ? 'BLOCKCHAIN_OPERATION_FAILED' : 'BLOCKCHAIN_ERROR';
        errorMessage = error.message;
      } else if (error.code === 'INVALID_ARGUMENT' && error.argument === 'value') {
        errorCode = 'BLOCKCHAIN_VALUE_ERROR';
        errorMessage = 'Numeric overflow during wallet creation';
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        errorCode = 'BLOCKCHAIN_CONTRACT_ERROR';
        errorMessage = 'Smart contract rejected operation';
      } else if (error.code === 'NETWORK_ERROR') {
        errorCode = 'BLOCKCHAIN_NETWORK_ERROR';
        errorMessage = 'Blockchain network connection issue';
      }
      
      // If wallet creation fails in production, don't use predicted address
      // Instead, generate a unique placeholder address
      try {
        // Generate a unique placeholder address using user ID and timestamp
        const randomHash = crypto.createHash('sha256')
          .update(`${user.id}-${Date.now()}-${Math.random()}`)
          .digest('hex');
        
        // Format as Ethereum address (0x + first 40 chars of hash)
        const placeholderAddress = `0x${randomHash.substring(0, 40)}`;
        
        // Check if this address is already in use (unlikely, but to be safe)
        const addressCheck = await db.query('SELECT id FROM users WHERE wallet_address = $1', [placeholderAddress]);
        
        if (addressCheck.rows.length === 0) {
          // Update user with placeholder wallet address and detailed error information
          await db.query(
            'UPDATE users SET wallet_address = $1, wallet_creation_error = $2, wallet_error_code = $3 WHERE id = $4',
            [placeholderAddress, errorMessage, errorCode, user.id]
          );
          
          // Add placeholder wallet address to user object
          user.wallet_address = placeholderAddress;
          user.wallet_error = errorMessage;
          user.wallet_error_code = errorCode;
          
          logger.info(`Created placeholder wallet address for user ${user.id}: ${placeholderAddress} (Error: ${errorCode})`);
        } else {
          // In the extremely unlikely case of a collision, just leave as null
          logger.warn(`Could not create unique wallet address for user ${user.id}`);
          user.wallet_address = null;
          user.wallet_error = 'Failed to create wallet address';
        }
      } catch (dbError) {
        logger.error(`Failed to save placeholder wallet address for user ${user.id}:`, dbError);
        user.wallet_address = null;
        user.wallet_error = 'Failed to create wallet address';
      }
    }
    
    // Generate JWT token
    const token = generateToken(user.id);
    
    // Create charity if user is charity_admin
    if (role === 'charity_admin' && req.body.charity_name) {
      try {
        const charityResult = await db.query(
          `INSERT INTO charities (
            name, 
            description, 
            admin_id, 
            created_at, 
            updated_at
          ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
          RETURNING id`,
          [req.body.charity_name, req.body.charity_description || '', user.id]
        );
        
        if (charityResult.rows.length > 0) {
          user.charity_id = charityResult.rows[0].id;
          
          // Register charity on blockchain
          try {
            await blockchain.registerCharity(
              req.body.charity_name, 
              req.body.charity_description || '', 
              user.id
            );
            logger.info(`Registered charity for user ${user.id} on blockchain`);
          } catch (blockchainError) {
            logger.error(`Failed to register charity on blockchain for user ${user.id}:`, blockchainError);
            // Continue with registration even if blockchain call fails
          }
        }
      } catch (error) {
        logger.error(`Failed to create charity for user ${user.id}:`, error);
      }
    }
    
    // Create company if user is corporate
    if (role === 'corporate' && company_name) {
      try {
        logger.info(`Creating company for corporate user ${user.id}: ${company_name}`);
        
        const companyResult = await db.query(
          `INSERT INTO companies (
            name, 
            description, 
            website, 
            user_id, 
            created_at, 
            updated_at
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
          RETURNING id`,
          [company_name, company_description || '', company_website || '', user.id]
        );
        
        if (companyResult.rows.length > 0) {
          user.company_id = companyResult.rows[0].id;
          logger.info(`Created company for user ${user.id} with ID: ${user.company_id}`);
          
          // Create audit log for company creation
          await db.query(
            `INSERT INTO audit_logs 
             (user_id, action, entity_type, entity_id, details, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.id,
              'CREATE_COMPANY',
              'company',
              user.company_id,
              JSON.stringify({ name: company_name }),
              req.ip
            ]
          );
        }
      } catch (error) {
        logger.error(`Failed to create company for user ${user.id}:`, error);
        // Continue with registration even if company creation fails
      }
    }
    
    res.status(201).json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      }
    });
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get user from database
    const result = await db.query(
      `SELECT 
        users.id, users.email, users.password_hash, users.full_name, 
        users.wallet_address, users.is_admin, users.is_worldcoin_verified,
        users.role, charities.id as charity_id 
      FROM users 
      LEFT JOIN charities ON users.id = charities.admin_id 
      WHERE users.email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
          code: 'AUTH_REQUIRED'
        }
      });
    }
    
    const user = result.rows[0];
    
    // Check password
    const isMatch = await comparePassword(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
          code: 'AUTH_REQUIRED'
        }
      });
    }
    
    // Determine user role based on stored role, is_admin flag, or charity association
    let role = user.role || 'user';
    // If role is still 'user' but user has special status, upgrade it
    if (role === 'user') {
      if (user.is_admin) {
        role = 'admin';
      } else if (user.charity_id) {
        role = 'charity_admin';
      }
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    // Return success response
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email,
          full_name: user.full_name,
          wallet_address: user.wallet_address,
          is_admin: user.is_admin,
          is_verified: user.is_worldcoin_verified,
          is_worldcoin_verified: user.is_worldcoin_verified,
          charity_id: user.charity_id || null,
          role
        },
        token
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Login failed',
        code: 'LOGIN_ERROR'
      }
    });
  }
};

/**
 * Get current user
 * @route GET /api/auth/me
 * @access Private
 */
const getMe = async (req, res) => {
  try {
    // Get user from database
    const result = await db.query(
      `SELECT 
        users.id, users.email, users.full_name, users.wallet_address, 
        users.is_admin, users.is_worldcoin_verified, users.created_at, 
        users.last_login, charities.id as charity_id
      FROM users 
      LEFT JOIN charities ON users.id = charities.admin_id
      WHERE users.id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const user = result.rows[0];
    
    // Determine user role based on stored role or default values
    let role = user.role || 'user';
    // If role is still 'user' but user has special status, upgrade it
    if (role === 'user') {
      if (user.is_admin) {
        role = 'admin';
      } else if (user.charity_id) {
        role = 'charity_admin';
      }
    }
    
    // Get wallet balance if wallet_address exists
    let balance = "0.00";
    if (user.wallet_address) {
      try {
        balance = await blockchain.getWalletBalance(user.wallet_address);
      } catch (error) {
        logger.error('Error getting wallet balance:', error);
      }
    }
    
    // Return success response
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          wallet_address: user.wallet_address,
          is_admin: user.is_admin,
          is_worldcoin_verified: user.is_worldcoin_verified,
          created_at: user.created_at,
          last_login: user.last_login,
          charity_id: user.charity_id || null,
          wallet_balance: balance,
          role
        }
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    
    // Check if it's a blockchain error
    if (error.code === 'BLOCKCHAIN_ERROR') {
      return res.status(500).json({
        success: false,
        error: {
          message: error.message,
          code: 'BLOCKCHAIN_ERROR'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Server error',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Verify user with Worldcoin
 * @route POST /api/auth/worldcoin-verify
 * @access Private
 */
const worldcoinVerify = async (req, res) => {
  try {
    logger.info(`Worldcoin verification requested for user ID: ${req.user.id}`);
    
    // Initialize Worldcoin verification flow
    const verificationResult = await require('../services/worldcoin.service').verifyUser(req.user.id, req.body.proof || '');
    
    // If OAuth is needed, return the authorization URL
    if (verificationResult.needsOAuth) {
      return res.json({
        success: true,
        data: {
          needs_oauth: true,
          auth_url: verificationResult.auth_url,
          message: verificationResult.message
        }
      });
    }
    
    // If we got a direct success (legacy flow), return success
    res.json({
      success: true,
      data: {
        is_verified: true,
        message: "Verification successful"
      }
    });
  } catch (error) {
    logger.error('Worldcoin verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Server error',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Handle Worldcoin OAuth callback
 * @route GET /api/auth/worldcoin-callback
 * @access Public
 */
const worldcoinCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing code or state parameter',
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    // Exchange code for tokens
    const worldcoinService = require('../services/worldcoin.service');
    const tokenData = await worldcoinService.exchangeCodeForTokens(code, state);
    
    // Complete the verification process
    const verificationSuccess = await worldcoinService.completeVerification(
      tokenData.user_id,
      tokenData
    );
    
    if (!verificationSuccess) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Verification level not sufficient for quadratic funding',
          code: 'VERIFICATION_LEVEL_ERROR'
        }
      });
    }
    
    // Redirect to frontend with success message
    // This assumes your frontend has a route to handle this
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/verification-success`);
  } catch (error) {
    logger.error('Worldcoin callback error:', error);
    
    // Redirect to frontend with error message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/verification-error?message=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Get verification URL for Worldcoin
 * @route GET /api/auth/worldcoin-url
 * @access Private
 */
const getWorldcoinUrl = async (req, res) => {
  try {
    const worldcoinService = require('../services/worldcoin.service');
    const { auth_url, state } = await worldcoinService.generateAuthUrl(req.user.id);
    
    res.json({
      success: true,
      data: {
        auth_url,
        state
      }
    });
  } catch (error) {
    logger.error('Error generating Worldcoin URL:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Server error',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Get the charity associated with the authenticated user
 * @route GET /api/auth/my-charity
 * @access Private
 */
const getMyCharity = async (req, res) => {
  try {
    const userId = req.user.id;

    // First check if user is a charity admin
    const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    // If user is not a charity_admin, they won't have a charity
    if (userCheck.rows[0].role !== 'charity_admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'User is not associated with a charity',
          code: 'NOT_CHARITY_ADMIN'
        }
      });
    }

    // Get the charity associated with this user
    const result = await db.query(
      `SELECT c.* 
       FROM charities c
       WHERE c.admin_id = $1
       LIMIT 1`, 
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'No charity found for this user',
          code: 'CHARITY_NOT_FOUND'
        }
      });
    }

    // Return the charity data
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching user charity:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve charity information',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Verify user with Onfido
 * @route POST /api/auth/onfido-verify
 * @access Private
 */
const onfidoVerify = async (req, res) => {
  try {
    logger.info(`Onfido verification requested for user ID: ${req.user.id}`);
    
    // Initialize Onfido verification flow
    const verificationResult = await require('../services/onfido.service').initializeOnfidoVerification(req.user.id);
    
    // Return the SDK token for the frontend
    res.json({
      success: true,
      data: {
        sdk_token: verificationResult.data.sdk_token,
        applicant_id: verificationResult.data.applicant_id
      }
    });
  } catch (error) {
    logger.error('Onfido verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Server error',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Handle Onfido verification completion
 * @route POST /api/auth/onfido-callback
 * @access Private
 */
const onfidoCallback = async (req, res) => {
  try {
    logger.info(`Onfido verification completion for user ID: ${req.user.id}`);
    
    // Complete verification after frontend SDK flow
    const onfidoService = require('../services/onfido.service');
    const result = await onfidoService.manuallyCompleteVerification(req.user.id);
    
    res.json({
      success: true,
      data: {
        check_id: result.data.check_id,
        status: result.data.status,
        message: result.data.message
      }
    });
  } catch (error) {
    logger.error('Onfido callback error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Server error',
        code: 'SERVER_ERROR'
      }
    });
  }
};

/**
 * Handle Onfido webhook
 * @route POST /api/auth/onfido-webhook
 * @access Public
 */
const onfidoWebhook = async (req, res) => {
  try {
    logger.info('Onfido webhook received');
    
    // Handle the webhook
    const onfidoService = require('../services/onfido.service');
    await onfidoService.handleWebhook(req.body);
    
    res.status(200).end();
  } catch (error) {
    logger.error('Onfido webhook error:', error);
    res.status(500).end();
  }
};

module.exports = {
  register,
  login,
  getMe,
  worldcoinVerify,
  worldcoinCallback,
  getWorldcoinUrl,
  getMyCharity,
  onfidoVerify,
  onfidoCallback,
  onfidoWebhook
}; 