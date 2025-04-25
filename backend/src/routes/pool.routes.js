const express = require('express');
const { body } = require('express-validator');
const poolController = require('../controllers/pool.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

// Validation middleware for pool creation
const validatePoolCreate = [
  body('name')
    .notEmpty().withMessage('Pool name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Pool name must be between 3 and 100 characters'),
  body('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('theme')
    .notEmpty().withMessage('Theme is required')
    .isLength({ min: 3, max: 100 }).withMessage('Theme must be between 3 and 100 characters'),
  body('start_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Start date must be a valid date'),
  body('end_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (req.body.start_date && new Date(value) <= new Date(req.body.start_date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('matching_ratio').optional().isInt({ min: 1 }).withMessage('Matching ratio must be a positive integer'),
  body('company_id').optional().isInt().withMessage('Company ID must be an integer'),
  body('sponsor_id').optional().isInt().withMessage('Sponsor ID must be an integer'),
  body('admin_id').optional().isInt().withMessage('Admin ID must be an integer'),
  body('is_shariah_compliant').optional().isBoolean().withMessage('Is Shariah compliant must be a boolean'),
  validateRequest
];

// Validation middleware for pool updates (similar to create but optional)
const validatePoolUpdate = [
  body('name').optional().isLength({ min: 3, max: 100 }),
  body('description').optional().isLength({ min: 10 }),
  body('theme').optional().isLength({ min: 3, max: 100 }),
  body('is_active').optional().isBoolean(),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601()
    .custom((value, { req }) => {
        // Ensure end date is after start date if both are provided or one already exists
        // This logic might need refinement based on how partial updates are handled
        const startDate = req.body.start_date || req.poolData?.start_date; // Assuming poolData is fetched in middleware
        if (startDate && new Date(value) <= new Date(startDate)) {
           throw new Error('End date must be after start date');
        }
        return true;
    }),
  body('matching_ratio').optional().isInt({ min: 1 }),
  body('is_shariah_compliant').optional().isBoolean(),
  // Add other updatable fields as needed
  validateRequest
];

// Validation middleware for pool donations
const validatePoolDonation = [
  body('amount')
    .isFloat({ min: 0.000001 }).withMessage('Amount must be a positive number'),
  validateRequest
];

// GET /api/pools - Get all funding pools
router.get('/', poolController.getAllPools);

// POST /api/pools - Create a new funding pool (Admin or Sponsor role? Check authorization)
router.post('/', authenticate, authorize(['admin', 'sponsor', 'corporate']), validatePoolCreate, poolController.createPool);

// GET /api/pools/:id - Get a specific pool by ID
router.get('/:id', poolController.getPoolById);

// PUT /api/pools/:id - Update a specific pool (Admin or Sponsor?)
router.put('/:id', authenticate, authorize(['admin', 'sponsor']), validatePoolUpdate, poolController.updatePool);

// DELETE /api/pools/:id - Delete a specific pool (Admin or Sponsor?)
router.delete('/:id', authenticate, authorize(['admin', 'sponsor']), poolController.deletePool);

// POST /api/pools/:id/donate - Donate directly to a pool
router.post('/:id/donate', authenticate, validatePoolDonation, poolController.donateToPool);

// POST /api/pools/:id/projects - Add a project to a pool (Admin or Sponsor?)
router.post('/:id/projects', authenticate, authorize(['admin', 'sponsor']), body('project_id').isInt(), validateRequest, poolController.addProjectToPool);

// GET /api/pools/:id/projects - Get projects within a pool
router.get('/:id/projects', poolController.getPoolProjects);

module.exports = router; 