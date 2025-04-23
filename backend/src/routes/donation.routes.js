const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { authenticate } = require('../middleware/auth');

// Import controllers
const donationController = require('../controllers/donation.controller');

// Validation middleware
const donationValidation = [
  body('amount').isFloat({ min: 0.001 }).withMessage('Amount must be a positive number'),
  body('project_id').isInt({ min: 0 }).withMessage('Valid project ID is required'),
  body('user_id').optional().isUUID().withMessage('User ID must be a valid UUID'),
  body('transaction_hash').optional().isString().withMessage('Transaction hash must be a string'),
  validateRequest
];

// Routes
router.get('/', donationController.getAllDonations);
router.get('/stats', donationController.getDonationStats);
router.get('/user', authenticate, donationController.getUserDonations);
router.get('/by-project/:projectId', donationController.getDonationsByProject);
router.get('/by-user/:userId', authenticate, donationController.getDonationsByUser);
router.get('/:id', donationController.getDonationById);
router.post('/', authenticate, donationValidation, donationController.createDonation);
router.delete('/:id', authenticate, donationController.deleteDonation);

module.exports = router; 