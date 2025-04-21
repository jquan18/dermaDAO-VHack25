const companyService = require('../services/company.service');
const logger = require('../config/logger');

const companyController = {
  // Create a new company
  createCompany: async (req, res) => {
    try {
      const { name, description, website, logo_url } = req.body;
      const userId = req.user.id;
      
      // Check if user already has a company
      const existingCompany = await companyService.getCompanyByUserId(userId);
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'User already has a company',
            code: 'COMPANY_EXISTS'
          }
        });
      }
      
      // Create company
      const company = await companyService.createCompany(
        { name, description, website, logo_url },
        userId
      );
      
      // Create audit log
      await require('../config/database').query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'CREATE_COMPANY',
          'company',
          company.id,
          JSON.stringify({ name }),
          req.ip
        ]
      );
      
      res.status(201).json({
        success: true,
        data: company
      });
    } catch (error) {
      logger.error('Error creating company:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create company',
          code: 'COMPANY_CREATION_ERROR'
        }
      });
    }
  },
  
  // Get company by user ID
  getMyCompany: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const company = await companyService.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Company not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      logger.error('Error fetching company:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch company',
          code: 'FETCH_ERROR'
        }
      });
    }
  },
  
  // Get company by ID
  getCompanyById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const company = await companyService.getCompanyById(id);
      
      if (!company) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Company not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      logger.error('Error fetching company:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch company',
          code: 'FETCH_ERROR'
        }
      });
    }
  },
  
  // Update company
  updateCompany: async (req, res) => {
    try {
      const { name, description, website, logo_url } = req.body;
      const userId = req.user.id;
      
      // Get company by user ID
      const company = await companyService.getCompanyByUserId(userId);
      
      if (!company) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Company not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Update company
      const updatedCompany = await companyService.updateCompany(
        company.id,
        { name, description, website, logo_url }
      );
      
      // Create audit log
      await require('../config/database').query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'UPDATE_COMPANY',
          'company',
          company.id,
          JSON.stringify({ name }),
          req.ip
        ]
      );
      
      res.json({
        success: true,
        data: updatedCompany
      });
    } catch (error) {
      logger.error('Error updating company:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update company',
          code: 'UPDATE_ERROR'
        }
      });
    }
  }
};

module.exports = companyController; 