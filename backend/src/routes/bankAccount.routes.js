const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccount.controller');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

/**
 * @route POST /api/bank-accounts
 * @desc Register a new bank account
 * @access Private (Charity Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(['charity_admin']),
  [
    body('account_name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Account name must be between 2 and 100 characters'),
    
    body('account_number')
      .trim()
      .isLength({ min: 5, max: 30 })
      .withMessage('Account number must be between 5 and 30 characters')
      .matches(/^[0-9]+$/)
      .withMessage('Account number must contain only digits'),
    
    body('routing_number')
      .trim()
      .isLength({ min: 5, max: 20 })
      .withMessage('Routing number must be between 5 and 20 characters')
      .matches(/^[0-9]+$/)
      .withMessage('Routing number must contain only digits'),
    
    body('bank_name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Bank name must be between 2 and 100 characters'),
    
    body('bank_country')
      .trim()
      .isLength({ min: 2, max: 2 })
      .isISO31661Alpha2()
      .withMessage('Bank country must be a valid ISO 3166-1 alpha-2 country code'),
    
    body('bank_address')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Bank address must not exceed 200 characters'),
    
    body('swift_code')
      .optional()
      .trim()
      .isLength({ min: 8, max: 11 })
      .withMessage('SWIFT code must be between 8 and 11 characters')
      .matches(/^[A-Z0-9]+$/)
      .withMessage('SWIFT code must contain only uppercase letters and digits'),
    
    body('purpose')
      .trim()
      .isIn(['donations', 'operational', 'general'])
      .withMessage('Purpose must be one of: donations, operational, general')
  ],
  bankAccountController.registerBankAccount
);

/**
 * @route GET /api/bank-accounts
 * @desc List user's bank accounts
 * @access Private
 */
router.get(
  '/',
  authenticate,
  bankAccountController.listBankAccounts
);

/**
 * @route GET /api/bank-accounts/project/:id
 * @desc Get project bank accounts
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
  bankAccountController.getProjectBankAccounts
);

/**
 * @route PUT /api/bank-accounts/:id/verify
 * @desc Verify a bank account (admin only)
 * @access Private (Admin)
 */
router.put(
  '/:id/verify',
  authenticate,
  authorize(['admin']),
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Bank account ID must be a positive integer'),
    
    body('verified')
      .isBoolean()
      .withMessage('Verified status must be a boolean'),
    
    body('verification_notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Verification notes must not exceed 500 characters')
  ],
  bankAccountController.verifyBankAccount
);

module.exports = router; 