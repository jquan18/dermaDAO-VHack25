const express = require('express');
const { param } = require('express-validator');
const router = express.Router();
const bankTransferController = require('../controllers/bankTransfer.controller');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

/**
 * @route GET /api/bank-transfers/:reference
 * @desc Get bank transfer status
 * @access Private
 */
router.get(
  '/:reference',
  authenticate,
  [
    param('reference')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Transfer reference must be a valid string')
  ],
  bankTransferController.getTransferStatus
);

/**
 * @route GET /api/bank-transfers/project/:id
 * @desc List all transfers for a project
 * @access Private (Charity Admin or Admin)
 */
router.get(
  '/project/:id',
  authenticate,
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Project ID must be a positive integer')
  ],
  bankTransferController.listProjectTransfers
);

module.exports = router; 