const { validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const bankTransferService = require('../services/bankTransfer.service');
const crypto = require('crypto');

/**
 * Process a Wise API webhook
 * @route POST /api/webhooks/wise
 * @access Public (protected by signature)
 */
const processWiseWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const isValid = verifyWiseSignature(req);
    
    if (!isValid) {
      logger.warn('Invalid Wise webhook signature', { 
        ip: req.ip, 
        headers: req.headers,
        body: req.body 
      });
      
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid signature',
          code: 'UNAUTHORIZED'
        }
      });
    }
    
    // Process the webhook
    const result = await bankTransferService.handleWiseWebhook(req.body);
    
    // Log the webhook processing
    logger.info('Processed Wise webhook', { 
      eventType: req.body.event_type,
      transferId: req.body.data?.resource?.id,
      result 
    });
    
    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('Wise webhook processing error:', error);
    
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
 * Get bank transfer status
 * @route GET /api/bank-transfers/:reference
 * @access Private
 */
const getTransferStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Get transfer details
    const transfer = await bankTransferService.getTransferStatus(reference);
    
    // Check if user is authorized to view this transfer
    const { rows } = await db.query(
      `SELECT 
        bt.id, bt.proposal_id, p.project_id, pr.charity_id, c.admin_id
       FROM bank_transfers bt
       JOIN proposals p ON bt.proposal_id = p.id
       JOIN projects pr ON p.project_id = pr.id
       JOIN charities c ON pr.charity_id = c.id
       WHERE bt.reference = $1`,
      [reference]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Transfer not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const transferData = rows[0];
    
    // Check if user is authorized
    const isAdmin = req.user.is_admin;
    const isCharityAdmin = transferData.admin_id === req.user.id;
    
    if (!isAdmin && !isCharityAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You are not authorized to view this transfer',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    // Return transfer details
    res.json({
      success: true,
      data: transfer
    });
  } catch (error) {
    logger.error('Get transfer status error:', error);
    
    if (error.message === 'Transfer not found') {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Transfer not found',
          code: 'RESOURCE_NOT_FOUND'
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
 * List all transfers for a project
 * @route GET /api/bank-transfers/project/:id
 * @access Private (Charity Admin or Admin)
 */
const listProjectTransfers = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Check if project exists
    const projectResult = await db.query(
      `SELECT p.id, p.charity_id, c.admin_id, p.name
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
          message: 'You are not authorized to view transfers for this project',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    // Get transfers for the project
    const { rows } = await db.query(
      `SELECT 
        bt.id, bt.reference, bt.amount, bt.currency, bt.status,
        bt.created_at, bt.updated_at, bt.completed_at,
        p.id as proposal_id, p.description as proposal_description,
        ba.account_name, ba.bank_name, p.milestone_index
       FROM bank_transfers bt
       JOIN proposals p ON bt.proposal_id = p.id
       JOIN bank_accounts ba ON p.bank_account_id = ba.id
       WHERE p.project_id = $1
       ORDER BY bt.created_at DESC`,
      [projectId]
    );
    
    // Format the response
    const transfers = rows.map(transfer => ({
      id: transfer.id,
      reference: transfer.reference,
      amount: transfer.amount,
      currency: transfer.currency,
      status: transfer.status,
      created_at: transfer.created_at,
      updated_at: transfer.updated_at,
      completed_at: transfer.completed_at,
      proposal: {
        id: transfer.proposal_id,
        description: transfer.proposal_description,
        milestone_index: transfer.milestone_index
      },
      bank_account: {
        account_name: transfer.account_name,
        bank_name: transfer.bank_name
      }
    }));
    
    // Return transfers
    res.json({
      success: true,
      data: {
        project_name: project.name,
        transfers
      }
    });
  } catch (error) {
    logger.error('List project transfers error:', error);
    
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
 * Verify Wise webhook signature
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether the signature is valid
 */
const verifyWiseSignature = (req) => {
  try {
    // Get the signature from the headers
    const signature = req.headers['x-signature'];
    
    if (!signature) {
      return false;
    }
    
    // Get the Wise webhook secret from environment variables
    const webhookSecret = process.env.WISE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error('WISE_WEBHOOK_SECRET not set in environment variables');
      return false;
    }
    
    // Create a HMAC using the secret
    const hmac = crypto.createHmac('sha256', webhookSecret);
    
    // Update with the request body
    hmac.update(JSON.stringify(req.body));
    
    // Generate the signature
    const calculatedSignature = hmac.digest('base64');
    
    // Compare with the received signature
    return signature === calculatedSignature;
  } catch (error) {
    logger.error('Wise signature verification error:', error);
    return false;
  }
};

module.exports = {
  processWiseWebhook,
  getTransferStatus,
  listProjectTransfers
}; 