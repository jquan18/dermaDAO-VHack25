const express = require('express');
const { check } = require('express-validator');
const { 
  createProposal, 
  getProjectProposals, 
  getProposalStatus, 
  aiVerifyProposal,
  recordTransaction,
  executeProposal,
  getProposalDetails,
  voteOnProposal,
  getProposalVotes,
  getAllProposals
} = require('../controllers/proposal.controller');
const { authenticate, authorizeAdmin, authorizeCharity } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body } = require('express-validator');

const router = express.Router();

/**
 * @route POST /api/proposals
 * @desc Create a withdrawal proposal
 * @access Private (Charity Admin)
 */
router.post(
  '/',
  [
    authenticate,
    authorizeCharity,
    check('project_id', 'Project ID is required').isInt(),
    check('description', 'Description is required').not().isEmpty().trim(),
    check('evidence_ipfs_hash', 'Evidence IPFS hash is required').not().isEmpty().trim(),
    check('amount', 'Amount is required and must be a positive number').isFloat({ min: 0 }),
    check('bank_account_id', 'Bank account ID is required').optional({ checkFalsy: true }).isInt(),
    check('transfer_type', 'Transfer type must be either "bank" or "crypto"').optional().isIn(['bank', 'crypto']),
    check('crypto_address', 'Crypto address format is invalid').optional().custom(value => {
      if (!value) return true;
      return value.startsWith('0x') && value.length === 42;
    }),
    check('milestone_index', 'Milestone index must be an integer').optional().isInt(),
    validateRequest
  ],
  createProposal
);

/**
 * @route POST /api/proposals/create
 * @desc Create a withdrawal proposal (alias for POST /)
 * @access Private (Charity Admin)
 */
router.post(
  '/create',
  [
    authenticate,
    authorizeCharity,
    check('project_id', 'Project ID is required').isInt(),
    check('description', 'Description is required').not().isEmpty().trim(),
    check('evidence_ipfs_hash', 'Evidence IPFS hash is required').not().isEmpty().trim(),
    check('amount', 'Amount is required and must be a positive number').isFloat({ min: 0 }),
    check('transfer_type', 'Transfer type must be either "bank" or "crypto"').optional().isIn(['bank', 'crypto']),
    check('bank_account_id', 'Bank account ID is required for bank transfers').optional({ checkFalsy: true }).isInt(),
    check('crypto_address', 'Crypto address format is invalid').optional().custom(value => {
      if (!value) return true;
      return value.startsWith('0x') && value.length === 42;
    }),
    check('milestone_index', 'Milestone index must be an integer').optional().isInt(),
    validateRequest
  ],
  createProposal
);

/**
 * @route POST /api/proposals/record-transaction
 * @desc Record a blockchain transaction for a proposal
 * @access Private (Charity Admin)
 */
router.post(
  '/record-transaction',
  [
    authenticate,
    authorizeCharity,
    check('proposal_id', 'Proposal ID is required').isInt(),
    check('transaction_hash', 'Transaction hash is required').not().isEmpty().trim(),
    check('transfer_type', 'Transfer type must be either "bank" or "crypto"').optional().isIn(['bank', 'crypto']),
    check('recipient_address', 'Recipient address format is invalid').optional().custom(value => {
      if (!value) return true;
      return value.startsWith('0x') && value.length === 42;
    }),
    validateRequest
  ],
  recordTransaction
);

/**
 * @route GET /api/proposals
 * @desc Get all proposals with pagination
 * @access Private
 */
router.get('/', authenticate, getAllProposals);

/**
 * @route GET /api/proposals/project/:id
 * @desc Get all proposals for a project
 * @access Private
 */
router.get('/project/:id', authenticate, getProjectProposals);

/**
 * @route GET /api/proposals/:id
 * @desc Get detailed information for a proposal
 * @access Private
 */
router.get('/:id', authenticate, getProposalDetails);

/**
 * @route GET /api/proposals/:id/status
 * @desc Get the status of a proposal
 * @access Private
 */
router.get('/:id/status', authenticate, getProposalStatus);

/**
 * @route POST /api/proposals/:id/verify
 * @desc Trigger AI verification for a proposal (admin only)
 * @access Private (Admin)
 */
router.post(
  '/:id/verify',
  [
    authenticate,
    authorizeAdmin
  ],
  aiVerifyProposal
);

/**
 * @route POST /api/proposals/:id/execute
 * @desc Execute a verified proposal to transfer funds
 * @access Private (Charity Admin)
 */
router.post(
  '/:id/execute',
  [
    authenticate,
    authorizeCharity
  ],
  executeProposal
);

/**
 * @route POST /api/proposals/:id/vote
 * @description Vote on a proposal (for donors only)
 * @access Private (Donors)
 */
router.post('/:id/vote',
  authenticate,
  [
    body('vote').isBoolean().withMessage('Vote must be a boolean'),
    body('comment').optional().isString().withMessage('Comment must be a string')
  ],
  voteOnProposal
);

/**
 * @route GET /api/proposals/:id/votes
 * @description Get all votes for a proposal
 * @access Private
 */
router.get('/:id/votes',
  authenticate,
  getProposalVotes
);

module.exports = router; 