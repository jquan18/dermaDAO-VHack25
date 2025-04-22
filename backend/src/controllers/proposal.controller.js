const { validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const blockchain = require('../services/blockchain.service');
const aiService = require('../services/ai.service');
const bankTransferService = require('../services/bankTransfer.service');

/**
 * Create a withdrawal proposal
 * @route POST /api/proposals
 * @access Private (Charity Admin)
 */
const createProposal = async (req, res) => {
  try {
    logger.info('Creating proposal with data:', JSON.stringify(req.body));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors:', JSON.stringify(errors.array()));
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
      project_id, 
      description, 
      evidence_ipfs_hash, 
      amount, 
      transfer_type = 'bank', // Default to bank transfer if not specified
      bank_account_id, 
      crypto_address,
      milestone_index 
    } = req.body;
    
    logger.info(`Processing proposal for project ${project_id} with transfer type: ${transfer_type}`);
    
    // Check if project exists and belongs to the charity admin
    const projectResult = await db.query(
      `SELECT p.id, p.charity_id, p.wallet_address, p.is_active, c.admin_id 
       FROM projects p
       JOIN charities c ON p.charity_id = c.id
       WHERE p.id = $1`,
      [project_id]
    );
    
    if (projectResult.rows.length === 0) {
      logger.warn(`Project not found: ${project_id}`);
      return res.status(404).json({
        success: false,
        error: {
          message: 'Project not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const project = projectResult.rows[0];
    
    // Check if user is the charity admin for this project
    if (project.admin_id !== req.user.id && !req.user.is_admin) {
      logger.warn(`User ${req.user.id} attempted to create proposal for project ${project_id} without permission`);
      return res.status(403).json({
        success: false,
        error: {
          message: 'You are not authorized to create proposals for this project',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    // Check if project is active
    if (!project.is_active) {
      logger.warn(`Attempted to create proposal for inactive project: ${project_id}`);
      return res.status(400).json({
        success: false,
        error: {
          message: 'Project is not active',
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    let bankAccount = null;
    
    // Validate transfer type-specific requirements
    if (transfer_type === 'bank') {
      // For bank transfers, check if bank account exists and is verified
      if (!bank_account_id) {
        logger.warn('Bank account ID is required for bank transfers');
        return res.status(400).json({
          success: false,
          error: {
            message: 'Bank account ID is required for bank transfers',
            code: 'VALIDATION_ERROR'
          }
        });
      }
      
      const bankAccountResult = await db.query(
        'SELECT id, account_name, bank_name, is_verified FROM bank_accounts WHERE id = $1 AND user_id = $2',
        [bank_account_id, req.user.id]
      );
      
      if (bankAccountResult.rows.length === 0) {
        logger.warn(`Bank account not found: ${bank_account_id}`);
        return res.status(404).json({
          success: false,
          error: {
            message: 'Bank account not found',
            code: 'RESOURCE_NOT_FOUND'
          }
        });
      }
      
      bankAccount = bankAccountResult.rows[0];
      
      if (!bankAccount.is_verified) {
        logger.warn(`Attempted to use unverified bank account: ${bank_account_id}`);
        return res.status(400).json({
          success: false,
          error: {
            message: 'Bank account is not verified',
            code: 'VALIDATION_ERROR'
          }
        });
      }
      
      logger.info(`Using bank account ${bank_account_id} (${bankAccount.bank_name} - ${bankAccount.account_name})`);
    } else if (transfer_type === 'crypto') {
      // For crypto transfers, validate the crypto address
      if (!crypto_address) {
        logger.warn('Crypto address is required for crypto transfers');
        return res.status(400).json({
          success: false,
          error: {
            message: 'Crypto address is required for crypto transfers',
            code: 'VALIDATION_ERROR'
          }
        });
      }
      
      // Simple validation that the address is properly formatted 
      // (starts with 0x and has the correct length)
      if (!crypto_address.startsWith('0x') || crypto_address.length !== 42) {
        logger.warn(`Invalid Ethereum address format: ${crypto_address}`);
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid Ethereum address format',
            code: 'VALIDATION_ERROR'
          }
        });
      }
      
      logger.info(`Using crypto address: ${crypto_address}`);
    } else {
      // Invalid transfer type
      logger.warn(`Invalid transfer type: ${transfer_type}`);
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid transfer type. Must be either "bank" or "crypto"',
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    // Get milestone if milestone_index is provided
    let milestoneId = null;
    let milestoneName = null;
    
    if (milestone_index !== undefined) {
      const milestoneResult = await db.query(
        'SELECT id, title FROM milestones WHERE project_id = $1 AND id = $2',
        [project_id, milestone_index]
      );
      
      if (milestoneResult.rows.length > 0) {
        milestoneId = milestoneResult.rows[0].id;
        milestoneName = milestoneResult.rows[0].title;
        logger.info(`Associated with milestone: ${milestoneName} (ID: ${milestoneId})`);
      }
    }
    
    // Create proposal on blockchain
    let contractProposalId;
    let blockchainSuccess = false;
    try {
      // Get recipient address based on transfer type
      const recipientAddress = transfer_type === 'bank' 
        ? process.env.DEFAULT_BANK_TRANSFER_ADDRESS || '0xE01aA1e53d13E5f735118f7019f5D00Fb449143C'
        : crypto_address;
      
      logger.info(`Using recipient address for blockchain: ${recipientAddress}`);
      
      // Create proposal on blockchain with retry mechanism
      contractProposalId = await blockchain.createWithdrawalProposal(
        project_id,
        project.wallet_address,
        description,
        evidence_ipfs_hash,
        amount,
        recipientAddress
      );
      
      // Check if we got a valid proposal ID from blockchain
      if (typeof contractProposalId === 'object' && contractProposalId.success === false) {
        throw new Error(contractProposalId.error || 'Failed to create proposal on blockchain');
      }
      
      // Any valid proposal ID from the blockchain is acceptable, including 0
      // We just check if it's not undefined/null and is a valid number
      if (contractProposalId === undefined || contractProposalId === null || isNaN(Number(contractProposalId))) {
        throw new Error(`Invalid contract proposal ID received: ${contractProposalId}`);
      }
      
      logger.info(`Successfully created proposal on blockchain with ID ${contractProposalId}`);
      blockchainSuccess = true;
    } catch (blockchainError) {
      // Log the error but don't throw yet - we'll return a useful error message to the client
      logger.error(`Blockchain proposal creation failed:`, blockchainError);
      blockchainSuccess = false;
      
      return res.status(500).json({
        success: false,
        error: {
          message: `Failed to create proposal on blockchain: ${blockchainError.message}`,
          code: 'BLOCKCHAIN_ERROR',
          details: 'The proposal could not be created on the blockchain. Please try again later.'
        }
      });
    }
    
    // Only create proposal in database if blockchain transaction succeeded
    if (!blockchainSuccess) {
      return; // We already sent an error response above
    }
    
    logger.info(`Created proposal on blockchain with ID ${contractProposalId}, proceeding with database storage`);
    
    // Create proposal in database
    const result = await db.query(
      `INSERT INTO proposals (
        project_id, 
        milestone_id, 
        description, 
        evidence_ipfs_hash, 
        amount, 
        bank_account_id,
        contract_proposal_id,
        status,
        ai_verification_score,
        ai_verification_notes,
        transfer_type,
        crypto_address,
        created_at,
        required_approvals,
        current_approvals
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14) 
      RETURNING *`,
      [
        project_id,
        milestoneId,
        description,
        evidence_ipfs_hash,
        amount,
        transfer_type === 'bank' ? bank_account_id : null,
        contractProposalId,
        'pending_verification', // Changed from 'pending_donor_approval' to 'pending_verification'
        null, // AI verification score will be null initially
        null, // AI verification notes will be null initially
        transfer_type,
        transfer_type === 'crypto' ? crypto_address : null,
        0, // Required approvals - set to 0 since we're not using donor voting
        0 // Current approvals start at 0
      ]
    );
    
    const proposal = result.rows[0];
    
    // Create audit log
    await db.query(
      `INSERT INTO audit_logs 
        (user_id, action, entity_type, entity_id, details, ip_address) 
        VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        'CREATE_PROPOSAL',
        'proposal',
        proposal.id,
        JSON.stringify({
          project_id,
          milestone_id: milestoneId,
          amount,
          contract_proposal_id: contractProposalId
        }),
        req.ip
      ]
    );
    
    // Trigger AI verification to automatically approve or reject the proposal
    await triggerAiVerification(proposal.id);
    
    res.status(201).json({
      success: true,
      data: {
        ...proposal
      }
    });
  } catch (error) {
    logger.error('Error creating proposal:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create proposal',
        code: 'PROPOSAL_CREATION_ERROR'
      }
    });
  }
};

/**
 * Trigger AI verification for a proposal
 * @param {number} proposalId - Proposal ID
 */
const triggerAiVerification = async (proposalId) => {
  try {
    logger.info(`Triggering AI verification for proposal ${proposalId}`);
    
    // Get proposal data
    const result = await db.query('SELECT * FROM proposals WHERE id = $1', [proposalId]);
    if (result.rows.length === 0) {
      logger.warn(`Proposal not found for AI verification: ${proposalId}`);
      return;
    }
    
    const proposal = result.rows[0];
    
    // Get project data for context
    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1', [proposal.project_id]);
    if (projectResult.rows.length === 0) {
      logger.warn(`Project not found for proposal ${proposalId}`);
      return;
    }
    
    const project = projectResult.rows[0];
    
    // Prepare proposal data for AI evaluation
    const proposalData = {
      ...proposal,
      project_name: project.name,
      project_description: project.description
    };
    
    // Call AI service for evaluation
    const aiService = require('../services/ai.service');
    const evaluation = await aiService.evaluateProposal(proposalId, proposalData);
    
    // Update proposal with AI verification results
    // Now we automatically set status based on AI verification result
    const newStatus = evaluation.verified ? 'approved' : 'rejected';
    
    await db.query(
      `UPDATE proposals 
       SET ai_verification_score = $1, ai_verification_notes = $2, status = $3 
       WHERE id = $4`,
      [evaluation.score, evaluation.notes, newStatus, proposalId]
    );
    
    logger.info(`AI verification completed for proposal ${proposalId}: Score ${evaluation.score}, Verified: ${evaluation.verified}, Status: ${newStatus}`);
    
    // If the proposal was approved by AI, automatically process it for execution
    if (evaluation.verified) {
      // Process the approved proposal
      await processVerifiedProposal(proposalId, proposal);
    }
    
  } catch (error) {
    logger.error(`Error in AI verification for proposal ${proposalId}:`, error);
    // Don't throw here since this is an internal process
  }
};

/**
 * Process a verified proposal (blockchain verification and bank transfer)
 * @param {number} proposalId - Proposal ID
 * @param {Object} proposal - Proposal data
 */
const processVerifiedProposal = async (proposalId, proposal) => {
  try {
    // Get the contract proposal ID from the database
    const proposalResult = await db.query(
      `SELECT contract_proposal_id FROM proposals WHERE id = $1`,
      [proposalId]
    );
    
    if (proposalResult.rows.length === 0) {
      logger.error(`Proposal not found with ID ${proposalId}`);
      return;
    }
    
    const contractProposalId = proposalResult.rows[0].contract_proposal_id;
    
    if (contractProposalId === null || contractProposalId === undefined) {
      logger.error(`No contract proposal ID found for proposal ${proposalId}`);
      // Update proposal with error status
      await db.query(
        `UPDATE proposals SET 
          status = 'processing_error',
          error_message = 'No contract proposal ID found',
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [proposalId]
      );
      return;
    }
    
    logger.info(`Using contract proposal ID: ${contractProposalId} for proposal ${proposalId}`);
    
    // Verify proposal on blockchain using the contract proposal ID (the 0-based index from the contract)
    const verificationResult = await blockchain.verifyProposal(
      proposal.project_id,
      contractProposalId,
      true
    );
    
    // Check if verification was successful
    if (typeof verificationResult === 'object' && verificationResult.success === false) {
      logger.error(`Blockchain verification failed for proposal ${proposalId}: ${verificationResult.error}`);
      
      // Update proposal with error status
      await db.query(
        `UPDATE proposals SET 
          status = 'verification_error',
          error_message = $1,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [verificationResult.error, proposalId]
      );
      
      return;
    }
    
    // If verification was successful, verificationResult is the transaction hash
    const transactionHash = verificationResult;
    
    // Update proposal with verification details
    await db.query(
      `UPDATE proposals SET 
        status = 'approved',
        transaction_hash = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [transactionHash, proposalId]
    );
    
    logger.info(`Proposal ${proposalId} verified successfully, transaction hash: ${transactionHash}`);
    
    // If it's a bank transfer, start processing it
    if (proposal.transfer_type === 'bank') {
      // Schedule bank transfer processing
      // In a real app, this would involve interacting with a banking API
      logger.info(`Bank transfer needs to be initiated for proposal ${proposalId}`);
      
      // Update status to indicate bank transfer is in progress
      await db.query(
        `UPDATE proposals SET 
          status = 'transfer_initiated',
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [proposalId]
      );
    }
  } catch (error) {
    logger.error(`Error processing verified proposal ${proposalId}:`, error);
    // Update proposal with error status
    try {
      await db.query(
        `UPDATE proposals SET 
          status = 'processing_error',
          error_message = $1,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, proposalId]
      );
    } catch (dbError) {
      logger.error(`Failed to update proposal error status:`, dbError);
    }
  }
};

/**
 * Execute a verified proposal on the blockchain to transfer funds
 * @param {number} proposalId - Database proposal ID
 * @param {Object} proposal - Proposal data
 */
const executeVerifiedProposal = async (proposalId, proposal) => {
  try {
    // Check if the proposal is already in the right state
    const { rows } = await db.query(
      `SELECT status, contract_proposal_id, crypto_address, transfer_type, amount 
       FROM proposals 
       WHERE id = $1`,
      [proposalId]
    );
    
    if (rows.length === 0) {
      logger.error(`Proposal not found with ID ${proposalId}`);
      return;
    }
    
    const dbProposal = rows[0];
    
    // Only execute proposals that are in 'approved' status
    if (dbProposal.status !== 'approved') {
      logger.warn(`Cannot execute proposal ${proposalId} with status ${dbProposal.status}`);
      return;
    }
    
    const contractProposalId = dbProposal.contract_proposal_id;
    
    if (contractProposalId === null || contractProposalId === undefined) {
      logger.error(`No contract proposal ID found for proposal ${proposalId}`);
      return;
    }
    
    logger.info(`Executing proposal ${proposalId} (contract ID: ${contractProposalId}) via platform contract`);
    
    // Execute the proposal on the blockchain using the contract proposal ID
    const transactionHash = await blockchain.executeProposal(
      proposal.project_id,
      contractProposalId,
      true // Approved = true
    );
    
    // Update proposal with execution details
    await db.query(
      `UPDATE proposals SET 
        status = 'executed',
        executed_at = CURRENT_TIMESTAMP,
        transaction_hash = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [transactionHash, proposalId]
    );
    
    logger.info(`Proposal ${proposalId} executed successfully with transaction hash ${transactionHash}`);
    
  } catch (error) {
    logger.error(`Error executing proposal ${proposalId}:`, error);
    // Update proposal with error status
    try {
      await db.query(
        `UPDATE proposals SET 
          status = 'execution_error',
          error_message = $1,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, proposalId]
      );
    } catch (dbError) {
      logger.error(`Failed to update proposal error status:`, dbError);
    }
  }
};

/**
 * Get all proposals for a project
 * @route GET /api/proposals/project/:id
 * @access Private
 */
const getProjectProposals = async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Check if project exists
    const projectResult = await db.query(
      'SELECT id, charity_id FROM projects WHERE id = $1',
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
    
    // Check if user is authorized to view this project's proposals
    // Admin can view all, charity admin can view their own
    if (!req.user.is_admin) {
      const charityResult = await db.query(
        'SELECT id FROM charities WHERE id = $1 AND admin_id = $2',
        [project.charity_id, req.user.id]
      );
      
      if (charityResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to view proposals for this project',
            code: 'PERMISSION_DENIED'
          }
        });
      }
    }
    
    // Get proposals
    const { rows } = await db.query(
      `SELECT 
        p.id, p.description, p.evidence_ipfs_hash, p.amount, p.status, 
        p.ai_verification_score, p.transaction_hash, p.created_at, p.executed_at,
        m.title as milestone_title,
        ba.bank_name, ba.account_name
       FROM proposals p
       LEFT JOIN milestones m ON p.milestone_id = m.id
       LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
       WHERE p.project_id = $1
       ORDER BY p.created_at DESC`,
      [projectId]
    );
    
    // Return success response
    res.json({
      success: true,
      data: {
        proposals: rows
      }
    });
  } catch (error) {
    logger.error('Get project proposals error:', error);
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
 * Get proposal status
 * @route GET /api/proposals/:id/status
 * @access Private
 */
const getProposalStatus = async (req, res) => {
  try {
    const proposalId = req.params.id;
    
    // Get comprehensive proposal details with all necessary joins
    const { rows } = await db.query(
      `SELECT 
        p.id, p.project_id, p.contract_proposal_id as proposal_id, p.description, 
        p.evidence_ipfs_hash, p.amount, p.status, p.ai_verification_score, 
        p.ai_verification_notes, p.transaction_hash, p.created_at, p.updated_at, 
        p.executed_at, p.milestone_id, p.bank_account_id,
        m.title as milestone_title,
        ba.bank_name, ba.account_name, ba.account_number, ba.routing_number,
        proj.name as project_name,
        bt.status as bank_transfer_status, bt.provider_reference, 
        bt.created_at as transfer_created_at, bt.completed_at as transfer_completed_at
       FROM proposals p
       LEFT JOIN milestones m ON p.milestone_id = m.id
       LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
       LEFT JOIN projects proj ON p.project_id = proj.id
       LEFT JOIN bank_transfers bt ON bt.proposal_id = p.id
       WHERE p.id = $1`,
      [proposalId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Proposal not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const proposal = rows[0];
    
    // Check if user is authorized to view this proposal
    // Admin can view all, charity admin can view their own, donors can view projects they donated to
    if (!req.user.is_admin) {
      const projectResult = await db.query(
        `SELECT p.id, c.admin_id 
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.id = $1`,
        [proposal.project_id]
      );
      
      // If user is charity admin, allow access
      const isCharityAdmin = projectResult.rows.length > 0 && projectResult.rows[0].admin_id === req.user.id;
      
      // Check if user is a donor for this project
      const isDonor = await hasUserDonated(req.user.id, proposal.project_id);
      
      // Only proceed if the user is either the charity admin or a donor
      if (!isCharityAdmin && !isDonor) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to view this proposal',
            code: 'PERMISSION_DENIED'
          }
        });
      }
    }
    
    // Prepare bank transfer data if available
    let bankTransfer = null;
    if (proposal.bank_transfer_status) {
      bankTransfer = {
        status: proposal.bank_transfer_status,
        reference: proposal.provider_reference,
        created_at: proposal.transfer_created_at,
        completed_at: proposal.transfer_completed_at
      };
      
      // Remove the fields from the proposal object
      delete proposal.bank_transfer_status;
      delete proposal.provider_reference;
      delete proposal.transfer_created_at;
      delete proposal.transfer_completed_at;
    }
    
    // Format bank account data
    const bankAccount = proposal.bank_account_id ? {
      id: proposal.bank_account_id,
      bank_name: proposal.bank_name,
      account_name: proposal.account_name,
      account_number: proposal.account_number ? 
        `****${proposal.account_number.slice(-4)}` : null,
      routing_number: proposal.routing_number ? 
        `****${proposal.routing_number.slice(-4)}` : null
    } : null;
    
    // Remove raw bank account fields
    delete proposal.bank_name;
    delete proposal.account_name;
    delete proposal.account_number;
    delete proposal.routing_number;
    
    // Return success response with comprehensive data
    res.json({
      success: true,
      data: {
        ...proposal,
        bank_account: bankAccount,
        bank_transfer: bankTransfer
      }
    });
  } catch (error) {
    logger.error('Get proposal status error:', error);
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
 * Admin verification of a proposal
 * @route POST /api/proposals/:id/ai-verify
 * @access Private (System only)
 */
const aiVerifyProposal = async (req, res) => {
  try {
    // This endpoint should only be accessible to the system
    // For demonstration purposes, we'll allow admins to trigger it
    if (!req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Only system or admin can trigger AI verification',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    const proposalId = req.params.id;
    
    // Get proposal details
    const { rows } = await db.query(
      `SELECT 
        p.id, p.project_id, p.milestone_id, p.description, 
        p.evidence_ipfs_hash, p.amount, p.bank_account_id,
        p.status
       FROM proposals p
       WHERE p.id = $1`,
      [proposalId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Proposal not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const proposal = rows[0];
    
    // Check if proposal is in a state that can be verified
    if (proposal.status !== 'pending_verification' && proposal.status !== 'verification_error') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Proposal cannot be verified in its current state',
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    // Evaluate proposal with AI
    const aiResult = await aiService.evaluateProposal(proposalId, proposal);
    
    // Update proposal with AI verification result
    const newStatus = aiResult.verified ? 'approved' : 'rejected';
    
    await db.query(
      `UPDATE proposals SET 
        ai_verification_score = $1, 
        ai_verification_notes = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [
        aiResult.score,
        aiResult.notes,
        newStatus,
        proposalId
      ]
    );
    
    // If proposal is approved, process it for execution
    if (aiResult.verified) {
      // Process the approved proposal
      await processVerifiedProposal(proposalId, proposal);
    }
    
    // Return success response
    res.json({
      success: true,
      data: {
        proposal_id: proposalId,
        verification_score: aiResult.score,
        verified: aiResult.verified,
        verification_notes: aiResult.notes,
        status: newStatus
      }
    });
  } catch (error) {
    logger.error('AI verification error:', error);
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
 * Record a blockchain transaction for a proposal
 * @route POST /api/proposals/record-transaction
 * @access Private (Charity Admin)
 */
const recordTransaction = async (req, res) => {
  try {
    logger.info('Recording transaction for proposal with data:', JSON.stringify(req.body));
    
    const { 
      proposal_id, 
      transaction_hash, 
      transfer_type, 
      recipient_address 
    } = req.body;
    
    if (!proposal_id || !transaction_hash) {
      logger.warn('Missing required fields: proposal_id or transaction_hash');
      return res.status(400).json({
        success: false,
        error: {
          message: 'Proposal ID and transaction hash are required',
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    // Get the proposal
    const proposalResult = await db.query(
      `SELECT p.id, p.project_id, p.status, p.transfer_type, pr.charity_id, c.admin_id 
       FROM proposals p
       JOIN projects pr ON p.project_id = pr.id
       JOIN charities c ON pr.charity_id = c.id
       WHERE p.id = $1`,
      [proposal_id]
    );
    
    if (proposalResult.rows.length === 0) {
      logger.warn(`Proposal not found: ${proposal_id}`);
      return res.status(404).json({
        success: false,
        error: {
          message: 'Proposal not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const proposal = proposalResult.rows[0];
    
    // Check if user is the charity admin for this project or an admin
    if (proposal.admin_id !== req.user.id && !req.user.is_admin) {
      logger.warn(`User ${req.user.id} attempted to record transaction for proposal ${proposal_id} without permission`);
      return res.status(403).json({
        success: false,
        error: {
          message: 'You are not authorized to record transactions for this proposal',
          code: 'PERMISSION_DENIED'
        }
      });
    }
    
    // Check if proposal is in a valid state for executing a transaction
    if (proposal.status !== 'approved' && proposal.status !== 'pending_verification') {
      logger.warn(`Cannot record transaction for proposal with status: ${proposal.status}`);
      return res.status(400).json({
        success: false,
        error: {
          message: `Cannot record transaction for proposal with status: ${proposal.status}`,
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    // Verify if the transfer type matches the proposal's transfer type
    if (transfer_type && transfer_type !== proposal.transfer_type) {
      logger.warn(`Transfer type mismatch: proposal has ${proposal.transfer_type}, but transaction has ${transfer_type}`);
      return res.status(400).json({
        success: false,
        error: {
          message: 'Transfer type does not match the proposal',
          code: 'VALIDATION_ERROR'
        }
      });
    }
    
    logger.info(`Recording transaction hash ${transaction_hash} for proposal ${proposal_id}`);
    
    // Update the proposal status
    const updateResult = await db.query(
      `UPDATE proposals
       SET status = 'transfer_initiated', 
           transaction_hash = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, project_id, description, amount, transfer_type, transaction_hash, status, updated_at`,
      [transaction_hash, proposal_id]
    );
    
    const updatedProposal = updateResult.rows[0];
    logger.info(`Updated proposal status to transfer_initiated: ${proposal_id}`);
    
    // Create audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        req.user.id,
        'RECORD_TRANSACTION',
        'proposals',
        proposal_id,
        JSON.stringify({ 
          transaction_hash, 
          transfer_type: proposal.transfer_type,
          recipient_address
        }),
        req.ip
      ]
    );
    
    // For bank transfers, initiate the bank transfer process
    if (proposal.transfer_type === 'bank') {
      logger.info(`Initiating bank transfer process for proposal ${proposal_id}`);
      
      // This would typically be handled by a separate process,
      // but for now we'll just log it
      logger.info(`Bank transfer initiated for proposal ${proposal_id}, transaction hash ${transaction_hash}`);
    }
    
    // Return success response
    res.status(200).json({
      success: true,
      data: {
        proposal: updatedProposal,
        transaction_hash: updatedProposal.transaction_hash,
        message: 'Transaction recorded successfully'
      }
    });
  } catch (error) {
    logger.error('Transaction recording error:', error);
    
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
 * @route POST /api/proposals/:id/execute
 * @desc Execute a verified proposal to transfer funds on the blockchain
 * @access Private (Charity Admin)
 */
const executeProposal = async (req, res) => {
  try {
    const proposalId = req.params.id;
    logger.info(`Request to execute proposal ${proposalId}`);

    // Check if the proposal exists and get its details
    const { rows } = await db.query(
      `SELECT 
        p.id, p.project_id, p.description, p.evidence_ipfs_hash, 
        p.amount, p.status, p.contract_proposal_id, p.transfer_type,
        p.crypto_address, p.bank_account_id
       FROM proposals p
       WHERE p.id = $1`,
      [proposalId]
    );

    if (rows.length === 0) {
      logger.warn(`Proposal not found: ${proposalId}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Proposal not found' 
      });
    }

    const proposal = rows[0];

    // Check if proposal is in an executable state
    if (proposal.status !== 'approved') {
      logger.warn(`Cannot execute proposal with status: ${proposal.status}`);
      return res.status(400).json({
        success: false,
        error: `Proposal must be in 'approved' status to execute, current status: ${proposal.status}`
      });
    }

    // Execute the proposal using platform contract
    await executeVerifiedProposal(proposalId, proposal);

    // Return success response
    return res.status(200).json({ 
      success: true,
      message: 'Proposal execution initiated via platform contract',
      data: {
        proposal_id: proposalId,
        project_id: proposal.project_id,
        status: 'executing'
      }
    });

  } catch (error) {
    logger.error(`Error in executeProposal controller:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get detailed proposal information
 * @route GET /api/proposals/:id
 * @access Private
 */
const getProposalDetails = async (req, res) => {
  try {
    const proposalId = req.params.id;
    
    // Get comprehensive proposal details with all necessary joins
    const { rows } = await db.query(
      `SELECT 
        p.id, p.project_id, p.contract_proposal_id, p.description, 
        p.evidence_ipfs_hash, p.amount, p.status, p.ai_verification_score, 
        p.ai_verification_notes, p.transaction_hash, p.created_at, p.updated_at, 
        p.executed_at, p.milestone_id, p.bank_account_id, p.transfer_type, 
        p.crypto_address, p.error_message,
        m.title as milestone_title, m.description as milestone_description,
        ba.bank_name, ba.account_name, ba.account_number, ba.routing_number,
        proj.name as project_name, proj.wallet_address as project_wallet,
        bt.id as transfer_id, bt.status as bank_transfer_status, bt.provider_reference, 
        bt.transaction_fee, bt.currency as transfer_currency,
        bt.created_at as transfer_created_at, bt.completed_at as transfer_completed_at
       FROM proposals p
       LEFT JOIN milestones m ON p.milestone_id = m.id
       LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
       LEFT JOIN projects proj ON p.project_id = proj.id
       LEFT JOIN bank_transfers bt ON bt.proposal_id = p.id
       WHERE p.id = $1`,
      [proposalId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Proposal not found',
          code: 'RESOURCE_NOT_FOUND'
        }
      });
    }
    
    const proposal = rows[0];
    
    // Check if user is authorized to view this proposal
    // Admin can view all, charity admin can view their own, donors can view projects they donated to
    if (!req.user.is_admin) {
      const projectResult = await db.query(
        `SELECT p.id, c.admin_id 
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.id = $1`,
        [proposal.project_id]
      );
      
      // If user is charity admin, allow access
      const isCharityAdmin = projectResult.rows.length > 0 && projectResult.rows[0].admin_id === req.user.id;
      
      // Check if user is a donor for this project
      const isDonor = await hasUserDonated(req.user.id, proposal.project_id);
      
      // Only proceed if the user is either the charity admin or a donor
      if (!isCharityAdmin && !isDonor) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to view this proposal',
            code: 'PERMISSION_DENIED'
          }
        });
      }
    }
    
    // Prepare bank transfer data if available
    let bankTransfer = null;
    if (proposal.bank_transfer_status) {
      bankTransfer = {
        id: proposal.transfer_id,
        status: proposal.bank_transfer_status,
        reference: proposal.provider_reference,
        transaction_fee: proposal.transaction_fee,
        currency: proposal.transfer_currency || 'USD',
        created_at: proposal.transfer_created_at,
        completed_at: proposal.transfer_completed_at
      };
    }
    
    // Format bank account data
    const bankAccount = proposal.bank_account_id ? {
      id: proposal.bank_account_id,
      bank_name: proposal.bank_name,
      account_name: proposal.account_name,
      account_number: proposal.account_number ? 
        `****${proposal.account_number.slice(-4)}` : null,
      routing_number: proposal.routing_number ? 
        `****${proposal.routing_number.slice(-4)}` : null
    } : null;
    
    // Format milestone data
    const milestone = proposal.milestone_id ? {
      id: proposal.milestone_id,
      title: proposal.milestone_title,
      description: proposal.milestone_description
    } : null;
    
    // Create a well-formatted response object
    const formattedProposal = {
      id: proposal.id,
      proposal_id: proposal.contract_proposal_id,
      project_id: proposal.project_id,
      project_name: proposal.project_name,
      project_wallet: proposal.project_wallet,
      description: proposal.description,
      evidence_ipfs_hash: proposal.evidence_ipfs_hash,
      amount: parseFloat(proposal.amount) || 0,
      status: proposal.status,
      ai_verification_score: proposal.ai_verification_score,
      ai_verification_notes: proposal.ai_verification_notes,
      transaction_hash: proposal.transaction_hash,
      transfer_type: proposal.transfer_type || 'bank',
      crypto_address: proposal.crypto_address,
      error_message: proposal.error_message,
      created_at: proposal.created_at,
      updated_at: proposal.updated_at,
      executed_at: proposal.executed_at,
      milestone: milestone,
      bank_account: bankAccount,
      bank_transfer: bankTransfer
    };
    
    // Return success response with comprehensive data
    res.json({
      success: true,
      data: formattedProposal
    });
  } catch (error) {
    logger.error('Get proposal details error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Server error',
        code: 'SERVER_ERROR'
      }
    });
  }
};

// First, let's add a new function to check if a user has donated to a project
const hasUserDonated = async (userId, projectId) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM donations WHERE user_id = $1 AND project_id = $2',
      [userId, projectId]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  } catch (error) {
    logger.error(`Error checking if user ${userId} has donated to project ${projectId}:`, error);
    return false;
  }
};

// Add this function to get all donors for a project
const getProjectDonors = async (projectId) => {
  try {
    const result = await db.query(
      'SELECT DISTINCT user_id FROM donations WHERE project_id = $1',
      [projectId]
    );
    return result.rows.map(row => row.user_id);
  } catch (error) {
    logger.error(`Error getting donors for project ${projectId}:`, error);
    return [];
  }
};

// Add this function to allow donors to vote on proposals
const voteOnProposal = async (req, res) => {
  // Old voting implementation removed...
};

// Add this function to get votes for a proposal
const getProposalVotes = async (req, res) => {
  // Old vote retrieval implementation removed...
};

/**
 * Get all proposals with pagination
 * @route GET /api/proposals
 * @access Private
 */
const getAllProposals = async (req, res) => {
  try {
    logger.info('Fetching all proposals');
    
    // Extract pagination parameters from the query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Construct the SQL query with pagination
    let query = `
      SELECT 
        p.id, 
        p.description, 
        p.evidence_ipfs_hash, 
        p.amount, 
        p.bank_account_id, 
        p.crypto_address, 
        p.transfer_type,
        p.status, 
        p.created_at, 
        p.updated_at,
        p.current_approvals,
        p.required_approvals,
        pr.id as project_id,
        pr.name as project_name,
        pr.charity_id, 
        c.name as charity_name
      FROM proposals p
      JOIN projects pr ON p.project_id = pr.id
      JOIN charities c ON pr.charity_id = c.id
    `;
    
    // Get total count first
    const countResult = await db.query('SELECT COUNT(*) FROM proposals');
    const total = parseInt(countResult.rows[0].count);
    
    // Add pagination to the query
    query += ` ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`;
    
    const result = await db.query(query, [limit, offset]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    logger.info(`Retrieved ${result.rows.length} proposals (page ${page}/${totalPages})`);
    
    return res.json({
      success: true,
      data: {
        proposals: result.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching all proposals:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Server error',
        code: 'SERVER_ERROR'
      }
    });
  }
};

// Make sure all functions are properly exported
module.exports = {
  createProposal,
  getProjectProposals,
  getProposalStatus,
  getProposalDetails,
  aiVerifyProposal,
  recordTransaction,
  executeProposal,
  voteOnProposal,
  getProposalVotes,
  triggerAiVerification,
  processVerifiedProposal,
  executeVerifiedProposal,
  hasUserDonated,
  getProjectDonors,
  getAllProposals
}; 