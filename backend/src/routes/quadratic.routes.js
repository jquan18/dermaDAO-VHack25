const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { authenticate, authorizeAdmin, authorizeCharity, authorizeProjectCharity } = require('../middleware/auth');

// Import controllers
const quadraticController = require('../controllers/quadratic.controller');

// Validation middleware
const quadraticValidation = [
  body('project_id').isUUID().withMessage('Valid project ID is required'),
  body('amount').isFloat({ min: 0.001 }).withMessage('Amount must be a positive number'),
  validateRequest
];

// Routes
router.get('/projects', quadraticController.getAllProjects);
router.get('/project/:id', quadraticController.getProjectDetails);
router.get('/pool-balance', quadraticController.getPoolBalance);
router.post('/vote', authenticate, quadraticValidation, quadraticController.vote);
router.get('/projects/:projectId/results', quadraticController.getVotingResults);
router.post('/external-contribution', authenticate, authorizeAdmin, quadraticController.recordExternalContribution);
router.post('/distribute', authenticate, authorizeAdmin, quadraticController.distributeQuadraticFunding);

module.exports = router; 