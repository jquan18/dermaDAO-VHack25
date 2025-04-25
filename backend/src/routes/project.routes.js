const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { authenticate, authorizeAdmin, authorizeCharity } = require('../middleware/auth');

// Import controllers
const projectController = require('../controllers/project.controller');

// Validation middleware
const projectValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('charity_id').isInt().withMessage('Valid charity ID is required'),
  body('funding_goal').isNumeric().withMessage('Funding goal must be a number'),
  body('duration_days').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
  body('milestones').optional().isArray().withMessage('Milestones must be an array'),
  body('milestones.*.title').optional().notEmpty().withMessage('Milestone title is required'),
  body('milestones.*.description').optional().notEmpty().withMessage('Milestone description is required'),
  body('milestones.*.percentage').optional().isInt({ min: 1, max: 100 }).withMessage('Percentage must be between 1 and 100'),
  body('is_shariah_compliant').optional().isBoolean().withMessage('Is Shariah compliant must be a boolean'),
  validateRequest
];

const milestoneValidation = [
  body('milestones').isArray({ min: 1 }).withMessage('At least one milestone is required'),
  body('milestones.*.title').notEmpty().withMessage('Milestone title is required'),
  body('milestones.*.description').notEmpty().withMessage('Milestone description is required'),
  body('milestones.*.percentage').isInt({ min: 1, max: 100 }).withMessage('Percentage must be between 1 and 100'),
  validateRequest
];

// Routes
router.get('/', projectController.getAllProjects);
router.get('/charity/:charity_id', projectController.getCharityProjects);
router.get('/to-vote', authenticate, projectController.getProjectsToVote);
router.get('/:id/verification', authenticate, projectController.getVerificationStatus);
router.get('/:id/transactions', projectController.getProjectTransactions);
router.get('/:id', projectController.getProjectById);
router.post('/', authenticate, authorizeCharity, projectValidation, projectController.createProject);
router.put('/:id', authenticate, authorizeCharity, projectController.updateProject);
router.delete('/:id', authenticate, authorizeCharity, projectController.deleteProject);

// Milestone routes
router.put('/:id/milestones', authenticate, authorizeCharity, milestoneValidation, projectController.updateMilestones);

// Verify a project (admin only)
router.put('/:id/verify', authenticate, authorizeAdmin, projectController.verifyProject);

// Trigger AI evaluation for a project (admin only)
router.post('/:id/ai-evaluate', authenticate, authorizeAdmin, projectController.aiEvaluateProject);

// Vote on project verification (only verified users)
router.post('/:id/vote', authenticate, projectController.voteOnProject);
// Get votes for project verification
router.get('/:id/votes', authenticate, projectController.getProjectVotes);

module.exports = router; 