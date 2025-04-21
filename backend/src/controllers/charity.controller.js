const db = require('../config/database');
const logger = require('../config/logger');
const blockchainService = require('../services/blockchain.service');
const { AppError } = require('../utils/appError');
const httpStatus = require('http-status');

const charityController = {
  // Get all charities
  getAllCharities: async (req, res) => {
    try {
      const { verified, page = 1, limit = 10, search } = req.query;
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT c.*, u.full_name as admin_name
        FROM charities c
        LEFT JOIN users u ON c.admin_id = u.id
        WHERE 1=1
      `;
      
      const queryParams = [];
      let paramCounter = 1;
      
      if (verified !== undefined) {
        query += ` AND c.is_verified = $${paramCounter++}`;
        queryParams.push(verified === 'true');
      }
      
      if (search) {
        query += ` AND c.name ILIKE $${paramCounter++}`;
        queryParams.push(`%${search}%`);
      }
      
      // Get total count
      const countQuery = query.replace('c.*, u.full_name as admin_name', 'COUNT(c.id)');
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count, 10);
      
      // Add pagination
      query += ` ORDER BY c.created_at DESC LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
      queryParams.push(limit);
      queryParams.push(offset);
      
      const charities = await db.query(query, queryParams);
      
      res.json({
        success: true,
        data: {
          charities: charities.rows,
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10)
        }
      });
    } catch (error) {
      logger.error('Error fetching charities:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch charities',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get charity by ID with detailed information
  getCharityById: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get charity details
      const charityQuery = `
        SELECT c.*, u.full_name as admin_name, u.id as admin_user_id, u.email as admin_email
        FROM charities c
        LEFT JOIN users u ON c.admin_id = u.id
        WHERE c.id = $1
      `;
      const charity = await db.query(charityQuery, [id]);
      
      if (charity.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Charity not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Get charity projects
      const projectsQuery = `
        SELECT id, name, description, wallet_address, funding_goal, is_active, verification_score, 
               start_date, end_date, created_at
        FROM projects
        WHERE charity_id = $1
        ORDER BY created_at DESC
      `;
      const projects = await db.query(projectsQuery, [id]);
      
      // Get total donations for charity
      const donationsQuery = `
        SELECT SUM(d.amount) as total_donations, COUNT(DISTINCT d.user_id) as unique_donors
        FROM donations d
        JOIN projects p ON d.project_id = p.id
        WHERE p.charity_id = $1
      `;
      const donations = await db.query(donationsQuery, [id]);
      
      const charityData = {
        ...charity.rows[0],
        projects: projects.rows,
        donations: {
          total: parseFloat(donations.rows[0].total_donations || 0),
          unique_donors: parseInt(donations.rows[0].unique_donors || 0, 10)
        }
      };

      res.json({
        success: true,
        data: charityData
      });
    } catch (error) {
      logger.error('Error fetching charity:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch charity',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Create new charity
  createCharity: async (req, res) => {
    try {
      const { name, description, website, registration_number, country, documentation_ipfs_hash } = req.body;
      const userId = req.user.id;
      
      // Check if user already has a charity
      const existingCharity = await db.query('SELECT id FROM charities WHERE admin_id = $1', [userId]);
      if (existingCharity.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'User already has a registered charity',
            code: 'DUPLICATE_CHARITY'
          }
        });
      }
      
      const charity = await db.query(
        `INSERT INTO charities (
          name, description, website, registration_number, country, 
          documentation_ipfs_hash, admin_id, is_verified, verification_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [name, description, website, registration_number, country, documentation_ipfs_hash, userId, true, 100]
      );

      // Register charity on blockchain (if available)
      try {
        // Call blockchain service to register charity
        // This would be implemented in blockchain.service.js
        await blockchainService.registerCharity(name, description, userId);
      } catch (blockchainError) {
        logger.error('Error registering charity on blockchain:', blockchainError);
        // Continue with database registration even if blockchain registration fails
      }

      res.status(201).json({
        success: true,
        data: charity.rows[0]
      });
    } catch (error) {
      logger.error('Error creating charity:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create charity',
          code: 'CREATE_ERROR'
        }
      });
    }
  },

  // Update charity
  updateCharity: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, website, registration_number, country, documentation_ipfs_hash } = req.body;
      const userId = req.user.id;
      
      // Check if charity exists and user is the admin
      const charityCheck = await db.query(
        'SELECT id, admin_id FROM charities WHERE id = $1',
        [id]
      );
      
      if (charityCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Charity not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Check if user is admin of this charity or global admin
      if (charityCheck.rows[0].admin_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to update this charity',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      const charity = await db.query(
        `UPDATE charities 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             website = COALESCE($3, website),
             registration_number = COALESCE($4, registration_number),
             country = COALESCE($5, country),
             documentation_ipfs_hash = COALESCE($6, documentation_ipfs_hash),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 
         RETURNING *`,
        [name, description, website, registration_number, country, documentation_ipfs_hash, id]
      );

      res.json({
        success: true,
        data: charity.rows[0]
      });
    } catch (error) {
      logger.error('Error updating charity:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update charity',
          code: 'UPDATE_ERROR'
        }
      });
    }
  },

  // Verify charity (admin only) - now just updates notes since charities are auto-verified
  verifyCharity: async (req, res) => {
    try {
      const { id } = req.params;
      const { verification_notes } = req.body;
      
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Only administrators can manage charity verification notes',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Check if charity exists
      const charityCheck = await db.query('SELECT id FROM charities WHERE id = $1', [id]);
      if (charityCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Charity not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Since charities are auto-verified now, we're only updating notes
      const charity = await db.query(
        `UPDATE charities 
         SET verification_notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 
         RETURNING *`,
        [verification_notes, id]
      );

      res.json({
        success: true,
        message: "Charity notes updated. Note that all charities are now automatically verified on registration.",
        data: charity.rows[0]
      });
    } catch (error) {
      logger.error('Error updating charity verification notes:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update charity',
          code: 'UPDATE_ERROR'
        }
      });
    }
  },

  // Get verification status and suggestions
  getVerificationStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check if charity exists and user is the admin
      const charity = await db.query(
        `SELECT c.*, u.full_name as admin_name
         FROM charities c
         LEFT JOIN users u ON c.admin_id = u.id
         WHERE c.id = $1`,
        [id]
      );
      
      if (charity.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Charity not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Check if user is admin of this charity or global admin
      if (charity.rows[0].admin_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to view this charity',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Get verification logs
      const logsQuery = `
        SELECT * FROM ai_verification_logs
        WHERE entity_type = 'charity' AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `;
      const logs = await db.query(logsQuery, [id]);
      
      // Generate improvement suggestions based on verification score
      const suggestions = [];
      const score = charity.rows[0].verification_score || 0;
      
      if (score < 50) {
        suggestions.push('Submit official registration documentation');
        suggestions.push('Provide detailed charity background and mission');
        suggestions.push('Add verified contact information');
      } else if (score < 75) {
        suggestions.push('Add more details about your governance structure');
        suggestions.push('Provide financial transparency documentation');
        suggestions.push('Add project implementation examples');
      } else if (score < 90) {
        suggestions.push('Include additional external verification references');
        suggestions.push('Add more details about impact measurement');
        suggestions.push('Provide team member credentials');
      }
      
      res.json({
        success: true,
        data: {
          verification: {
            score: charity.rows[0].verification_score,
            is_verified: charity.rows[0].is_verified,
            verified_at: charity.rows[0].verified_at,
            notes: charity.rows[0].verification_notes
          },
          logs: logs.rows,
          suggestions
        }
      });
    } catch (error) {
      logger.error('Error getting verification status:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get verification status',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Delete charity
  deleteCharity: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check if charity exists and user is admin
      const charityCheck = await db.query(
        'SELECT id, admin_id FROM charities WHERE id = $1',
        [id]
      );
      
      if (charityCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Charity not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Check if user is admin of this charity or global admin
      if (charityCheck.rows[0].admin_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to delete this charity',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Check for active projects
      const projectsCheck = await db.query(
        'SELECT COUNT(*) FROM projects WHERE charity_id = $1 AND is_active = true',
        [id]
      );
      
      if (parseInt(projectsCheck.rows[0].count, 10) > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot delete charity with active projects',
            code: 'ACTIVE_PROJECTS'
          }
        });
      }
      
      const charity = await db.query('DELETE FROM charities WHERE id = $1 RETURNING *', [id]);

      res.json({
        success: true,
        message: 'Charity deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting charity:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete charity',
          code: 'DELETE_ERROR'
        }
      });
    }
  }
};

module.exports = charityController; 