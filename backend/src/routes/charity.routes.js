const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { authenticate, authorizeAdmin, authorizeCharity } = require('../middleware/auth');

// Import controllers (to be implemented)
const charityController = require('../controllers/charity.controller');

// Validation middleware
const charityValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('website').optional().isURL().withMessage('Must be a valid URL'),
  validateRequest
];

const verificationValidation = [
  body('verified').isBoolean().withMessage('Verified must be a boolean'),
  body('verification_score').isInt({ min: 0, max: 100 }).withMessage('Verification score must be between 0 and 100'),
  validateRequest
];

// Routes
router.get('/', charityController.getAllCharities);
router.get('/:id', charityController.getCharityById);
router.post('/', authenticate, charityValidation, charityController.createCharity);
router.put('/:id', authenticate, charityValidation, charityController.updateCharity);
router.delete('/:id', authenticate, charityController.deleteCharity);

// Verification routes
router.get('/:id/verification', authenticate, charityController.getVerificationStatus);
router.put('/:id/verify', authenticate, authorizeAdmin, verificationValidation, charityController.verifyCharity);

module.exports = router; 