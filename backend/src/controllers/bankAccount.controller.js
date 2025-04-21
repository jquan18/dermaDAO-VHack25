const { validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const blockchain = require('../services/blockchain.service');

/**
 * Register a new bank account
 * @route POST /api/bank-accounts
 * @access Private (Charity Admin)
 */
const registerBankAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        }
      });
    }

    const { 
      account_name, 
      account_number, 
      routing_number, 
      bank_name, 
      bank_country, 
      bank_address, 
      swift_code, 
      purpose 
    } = req.body;
    
    // Check if account already exists for this user
    const existingAccount = await db.query(
      'SELECT id FROM bank_accounts WHERE user_id = $1 AND account_number = $2',
      [req.user.id, account_number]
    );
    
    if (existingAccount.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Bank account with this number already exists',
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    // Create bank account in database
    const result = await db.query(
      `INSERT INTO bank_accounts (
        user_id,
        account_name,
        account_number,
        routing_number,
        bank_name,
        bank_country,
        bank_address,
        swift_code,
        purpose,
        is_verified,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, account_name, bank_name, is_verified, created_at`,
      [
        req.user.id,
        account_name,
        account_number,
        routing_number,
        bank_name,
        bank_country,
        bank_address || null,
        swift_code || null,
        purpose,
        false // Not verified by default
      ]
    );
    
    const bankAccount = result.rows[0];
    
    // Create audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        req.user.id,
        'REGISTER_BANK_ACCOUNT',
        'bank_accounts',
        bankAccount.id,
        JSON.stringify({ 
          account_name, 
          bank_name, 
          bank_country,
          purpose
        }),
        req.ip
      ]
    );
    
    // Return success response
    res.status(201).json({
      success: true,
      data: {
        bank_account_id: bankAccount.id,
        account_name: bankAccount.account_name,
        bank_name: bankAccount.bank_name,
        status: bankAccount.is_verified ? 'verified' : 'pending_verification',
        created_at: bankAccount.created_at
      }
    });
  } catch (error) {
    logger.error('Bank account registration error:', error);
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
 * List user's bank accounts
 * @route GET /api/bank-accounts
 * @access Private
 */
const listBankAccounts = async (req, res) => {
  try {
    // Get user's bank accounts
    const { rows } = await db.query(
      `SELECT 
        id, account_name, account_number, bank_name, purpose,
        is_verified, created_at, updated_at 
       FROM bank_accounts 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    
    // Mask account numbers for security
    const bankAccounts = rows.map(account => ({
      ...account,
      account_number: maskAccountNumber(account.account_number)
    }));
    
    // Return success response
    res.json({
      success: true,
      data: {
        bank_accounts: bankAccounts
      }
    });
  } catch (error) {
    logger.error('List bank accounts error:', error);
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
 * Get project bank accounts
 * @route GET /api/bank-accounts/project/:id
 * @access Private
 */
const getProjectBankAccounts = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Check if project exists
    const projectResult = await db.query(
      `SELECT p.id, p.charity_id, c.admin_id
       FROM projects p
       JOIN charities c ON p.charity_id = c.id
       WHERE p.id = $1`,
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const project = projectResult.rows[0];
    
    // Check if user is authorized
    const isAdmin = req.user.is_admin;
    const isCharityAdmin = project.admin_id === req.user.id;
    
    if (!isAdmin && !isCharityAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You are not authorized to view bank accounts for this project',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    // Get verified bank accounts for the charity admin
    const { rows } = await db.query(
      `SELECT 
        ba.id, ba.account_name, ba.bank_name, ba.purpose,
        ba.is_verified
       FROM bank_accounts ba
       JOIN users u ON ba.user_id = u.id
       JOIN charities c ON u.id = c.admin_id
       JOIN projects p ON c.id = p.charity_id
       WHERE p.id = $1 AND ba.is_verified = TRUE
       ORDER BY ba.created_at DESC`,
      [projectId]
    );
    
    // Return success response
    res.json({
      success: true,
      data: {
        bank_accounts: rows
      }
    });
  } catch (error) {
    logger.error('Get project bank accounts error:', error);
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
 * Verify a bank account (admin only)
 * @route PUT /api/bank-accounts/:id/verify
 * @access Private (Admin)
 */
const verifyBankAccount = async (req, res) => {
  try {
    const bankAccountId = req.params.id;
    const { verified, verification_notes } = req.body;
    
    // Check if bank account exists
    const bankAccountResult = await db.query(
      'SELECT id, user_id, account_name, bank_name FROM bank_accounts WHERE id = $1',
      [bankAccountId]
    );
    
    if (bankAccountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Bank account not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const bankAccount = bankAccountResult.rows[0];
    
    // Update bank account in database
    await db.query(
      `UPDATE bank_accounts SET 
        is_verified = $1,
        verification_notes = $2,
        updated_at = CURRENT_TIMESTAMP,
        verified_at = $3
       WHERE id = $4`,
      [
        verified,
        verification_notes || null,
        verified ? 'CURRENT_TIMESTAMP' : null,
        bankAccountId
      ]
    );
    
    // Verify bank account on blockchain if necessary
    // This is a placeholder for actual blockchain integration
    try {
      const txHash = await blockchain.verifyBankAccount(
        bankAccount.id.toString(), // Using ID as an address placeholder
        verified
      );
      
      logger.info(`Bank account ${bankAccountId} verified on blockchain: ${txHash}`);
    } catch (error) {
      logger.error('Blockchain bank account verification error:', error);
      // Continue even if blockchain verification fails
    }
    
    // Create audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        req.user.id,
        verified ? 'VERIFY_BANK_ACCOUNT' : 'UNVERIFY_BANK_ACCOUNT',
        'bank_accounts',
        bankAccountId,
        JSON.stringify({ 
          verified,
          verification_notes
        }),
        req.ip
      ]
    );
    
    // Return success response
    res.json({
      success: true,
      data: {
        bank_account_id: bankAccountId,
        is_verified: verified
      }
    });
  } catch (error) {
    logger.error('Bank account verification error:', error);
    
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
 * Mask account number for security
 * @param {string} accountNumber - Account number to mask
 * @returns {string} - Masked account number
 */
const maskAccountNumber = (accountNumber) => {
  if (!accountNumber) return '';
  
  const length = accountNumber.length;
  
  if (length <= 4) {
    return '*'.repeat(length);
  }
  
  const visibleDigits = 4;
  const maskedPart = '*'.repeat(length - visibleDigits);
  const visiblePart = accountNumber.slice(length - visibleDigits);
  
  return maskedPart + visiblePart;
};

module.exports = {
  registerBankAccount,
  listBankAccounts,
  getProjectBankAccounts,
  verifyBankAccount
}; 