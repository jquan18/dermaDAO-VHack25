const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

// Debug the controller import
try {
  const companyController = require('../controllers/company.controller');
  
  // Import middleware
  const { validateRequest } = require('../middleware/validation');
  const { authenticate } = require('../middleware/auth');
  const { body } = require('express-validator');

  // Log controller methods for debugging
  logger.info(`Company controller loaded with methods: ${Object.keys(companyController).join(', ')}`);

  const createCompanyValidation = [
    body('name').notEmpty().withMessage('Company name is required'),
    body('description').optional(),
    body('website').optional().isURL().withMessage('Website must be a valid URL'),
    body('logo_url').optional().isURL().withMessage('Logo URL must be a valid URL')
  ];

  const updateCompanyValidation = [
    body('name').optional().notEmpty().withMessage('Company name cannot be empty'),
    body('description').optional(),
    body('website').optional().isURL().withMessage('Website must be a valid URL'),
    body('logo_url').optional().isURL().withMessage('Logo URL must be a valid URL')
  ];

  // Routes
  if (companyController.createCompany) {
    router.post(
      '/',
      authenticate,
      createCompanyValidation,
      validateRequest,
      companyController.createCompany
    );
  } else {
    logger.error('createCompany method not found in controller');
    router.post('/', (req, res) => {
      res.status(500).json({ error: 'Controller method not implemented' });
    });
  }

  if (companyController.getMyCompany) {
    router.get(
      '/me',
      authenticate,
      companyController.getMyCompany
    );
  } else {
    logger.error('getMyCompany method not found in controller');
    router.get('/me', (req, res) => {
      res.status(500).json({ error: 'Controller method not implemented' });
    });
  }

  if (companyController.getCompanyById) {
    router.get(
      '/:id',
      authenticate,
      companyController.getCompanyById
    );
  } else {
    logger.error('getCompanyById method not found in controller');
    router.get('/:id', (req, res) => {
      res.status(500).json({ error: 'Controller method not implemented' });
    });
  }

  if (companyController.updateCompany) {
    router.put(
      '/me',
      authenticate,
      updateCompanyValidation,
      validateRequest,
      companyController.updateCompany
    );
  } else {
    logger.error('updateCompany method not found in controller');
    router.put('/me', (req, res) => {
      res.status(500).json({ error: 'Controller method not implemented' });
    });
  }
} catch (error) {
  logger.error(`Failed to load company controller: ${error.message}`);
  
  // Fallback routes to prevent server crash
  router.post('/', (req, res) => {
    res.status(500).json({ error: 'Controller not available', details: error.message });
  });
  
  router.get('/me', (req, res) => {
    res.status(500).json({ error: 'Controller not available', details: error.message });
  });
  
  router.get('/:id', (req, res) => {
    res.status(500).json({ error: 'Controller not available', details: error.message });
  });
  
  router.put('/me', (req, res) => {
    res.status(500).json({ error: 'Controller not available', details: error.message });
  });
}

module.exports = router; 