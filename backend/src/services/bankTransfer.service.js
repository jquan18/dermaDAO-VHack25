const logger = require('../config/logger');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Initiate a bank transfer
 * @param {number} proposalId - Proposal ID
 * @param {number} bankAccountId - Bank account ID
 * @param {string} amount - Amount to transfer
 * @param {Object} bankAccount - Bank account details
 * @returns {Promise<{reference: string}>} - Transfer reference
 */
const initiateTransfer = async (proposalId, bankAccountId, amount, bankAccount) => {
  try {
    logger.info(`Initiating bank transfer for proposal ${proposalId} to bank account ${bankAccountId}: ${amount}`);
    
    // Generate unique reference for the transfer
    const reference = `WISE${uuidv4().substring(0, 8).toUpperCase()}`;
    
    // Create transfer record in database
    const result = await db.query(
      `INSERT INTO bank_transfers (
        proposal_id,
        bank_account_id,
        amount,
        currency,
        status,
        provider,
        provider_reference,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, provider_reference`,
      [
        proposalId,
        bankAccountId,
        amount,
        'USD', // Default currency for now
        'pending',
        'wise',
        reference
      ]
    );
    
    const transfer = result.rows[0];
    
    // In a real implementation, this would call the Wise API to initiate the transfer
    // For demonstration purposes, we'll simulate an API call
    
    // Simulate delay for API call
    setTimeout(async () => {
      await processTransfer(transfer.id, reference);
    }, 5000);
    
    logger.info(`Bank transfer initiated: ${reference}`);
    
    return { reference };
  } catch (error) {
    logger.error('Bank transfer initiation error:', error);
    throw new Error(`Failed to initiate bank transfer: ${error.message}`);
  }
};

/**
 * Process a bank transfer (simulate API processing)
 * @param {number} transferId - Transfer ID
 * @param {string} reference - Transfer reference
 * @returns {Promise<void>}
 */
const processTransfer = async (transferId, reference) => {
  try {
    logger.info(`Processing bank transfer ${transferId}: ${reference}`);
    
    // Simulate transfer processing
    const processingTime = Math.floor(Math.random() * 10000) + 5000; // 5-15 seconds
    
    // Update transfer status to processing
    await db.query(
      `UPDATE bank_transfers SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ['processing', transferId]
    );
    
    // Simulate API processing
    setTimeout(async () => {
      await completeTransfer(transferId, reference);
    }, processingTime);
  } catch (error) {
    logger.error(`Bank transfer processing error for ${transferId}:`, error);
    
    // Update transfer status to failed
    await db.query(
      `UPDATE bank_transfers SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ['failed', transferId]
    );
  }
};

/**
 * Complete a bank transfer (simulate successful transfer)
 * @param {number} transferId - Transfer ID
 * @param {string} reference - Transfer reference
 * @returns {Promise<void>}
 */
const completeTransfer = async (transferId, reference) => {
  try {
    logger.info(`Completing bank transfer ${transferId}: ${reference}`);
    
    // Update transfer status to completed
    await db.query(
      `UPDATE bank_transfers SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP,
        completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ['completed', transferId]
    );
    
    // Get proposal ID for this transfer
    const { rows } = await db.query(
      'SELECT proposal_id FROM bank_transfers WHERE id = $1',
      [transferId]
    );
    
    if (rows.length > 0) {
      const proposalId = rows[0].proposal_id;
      
      // Update proposal status to completed
      await db.query(
        `UPDATE proposals SET 
          status = $1,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['completed', proposalId]
      );
      
      logger.info(`Proposal ${proposalId} marked as completed`);
    }
    
    logger.info(`Bank transfer ${transferId} completed successfully`);
  } catch (error) {
    logger.error(`Bank transfer completion error for ${transferId}:`, error);
    
    // Update transfer status to failed
    await db.query(
      `UPDATE bank_transfers SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ['failed', transferId]
    );
  }
};

/**
 * Get transfer status
 * @param {string} reference - Transfer reference
 * @returns {Promise<Object>} - Transfer status and details
 */
const getTransferStatus = async (reference) => {
  try {
    const { rows } = await db.query(
      `SELECT 
        bt.id, bt.proposal_id, bt.status, bt.amount, bt.currency,
        bt.provider, bt.provider_reference, bt.created_at, bt.completed_at,
        ba.bank_name, ba.account_name
       FROM bank_transfers bt
       JOIN bank_accounts ba ON bt.bank_account_id = ba.id
       WHERE bt.provider_reference = $1`,
      [reference]
    );
    
    if (rows.length === 0) {
      throw new Error(`Transfer not found: ${reference}`);
    }
    
    return rows[0];
  } catch (error) {
    logger.error('Transfer status error:', error);
    throw new Error(`Failed to get transfer status: ${error.message}`);
  }
};

/**
 * Handle Wise webhook for transfer status updates
 * @param {Object} webhookData - Webhook data from Wise
 * @returns {Promise<void>}
 */
const handleWiseWebhook = async (webhookData) => {
  try {
    logger.info(`Received Wise webhook: ${JSON.stringify(webhookData)}`);
    
    const { resource, event } = webhookData;
    
    if (resource.type !== 'TRANSFER' || !resource.id) {
      logger.warn('Webhook not for a transfer, ignoring');
      return;
    }
    
    // Map Wise event to our status
    let status;
    switch (event) {
      case 'TRANSFER.FUNDS_CONVERTED':
        status = 'processing';
        break;
      case 'TRANSFER.OUTGOING_PAYMENT_SENT':
        status = 'sent';
        break;
      case 'TRANSFER.COMPLETED':
        status = 'completed';
        break;
      case 'TRANSFER.CANCELLED':
      case 'TRANSFER.FAILED':
        status = 'failed';
        break;
      default:
        logger.warn(`Unknown Wise event: ${event}, ignoring`);
        return;
    }
    
    // Update transfer status
    await db.query(
      `UPDATE bank_transfers SET 
        status = $1,
        updated_at = CURRENT_TIMESTAMP
        ${status === 'completed' ? ', completed_at = CURRENT_TIMESTAMP' : ''}
       WHERE provider_reference = $2`,
      [status, resource.id]
    );
    
    logger.info(`Transfer ${resource.id} updated to ${status}`);
    
    // If transfer is completed, update proposal status
    if (status === 'completed') {
      const { rows } = await db.query(
        'SELECT proposal_id FROM bank_transfers WHERE provider_reference = $1',
        [resource.id]
      );
      
      if (rows.length > 0) {
        const proposalId = rows[0].proposal_id;
        
        await db.query(
          `UPDATE proposals SET 
            status = 'completed',
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [proposalId]
        );
        
        logger.info(`Proposal ${proposalId} marked as completed`);
      }
    }
  } catch (error) {
    logger.error('Wise webhook handling error:', error);
  }
};

module.exports = {
  initiateTransfer,
  getTransferStatus,
  handleWiseWebhook
}; 