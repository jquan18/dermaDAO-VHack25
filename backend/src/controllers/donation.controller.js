const db = require('../config/database');
const logger = require('../config/logger');
const blockchainService = require('../services/blockchain.service');
const { AppError } = require('../utils/appError');
const httpStatus = require('http-status');

const donationController = {
  // Get all donations
  getAllDonations: async (req, res) => {
    try {
      const donations = await db.query(`
        SELECT d.*, p.title as project_title, u.email as user_email
        FROM donations d
        JOIN projects p ON d.project_id = p.id
        LEFT JOIN users u ON d.user_id = u.id
        ORDER BY d.created_at DESC
      `);
      
      res.json({
        success: true,
        data: donations.rows
      });
    } catch (error) {
      logger.error('Error fetching donations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch donations',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get donation by ID
  getDonationById: async (req, res) => {
    try {
      const { id } = req.params;
      const donation = await db.query(`
        SELECT d.*, p.title as project_title, u.email as user_email
        FROM donations d
        JOIN projects p ON d.project_id = p.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.id = $1
      `, [id]);
      
      if (donation.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Donation not found',
            code: 'NOT_FOUND'
          }
        });
      }

      res.json({
        success: true,
        data: donation.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching donation:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch donation',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get donations by project
  getDonationsByProject: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
      
      console.log(`Fetching donations for project ${projectId}, page ${page}, limit ${limit}`);
      
      // Check if project exists
      const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
      if (projectCheck.rows.length === 0) {
        console.log(`Project ${projectId} not found`);
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Get paginated donations including quadratic funding pool transactions
      const donations = await db.query(`
        SELECT 
          d.id, 
          d.amount, 
          d.transaction_hash, 
          d.created_at,
          CASE 
            WHEN d.transaction_hash LIKE '0xBE7a74B66EBA3E612041467f04bCB86d18951044%' THEN 'Quadratic Funding Pool'
            WHEN u.id IS NULL THEN 'Anonymous'
            ELSE u.full_name 
          END as donor,
          CASE 
            WHEN d.transaction_hash LIKE '0xBE7a74B66EBA3E612041467f04bCB86d18951044%' THEN true
            ELSE false
          END as is_quadratic_funding
        FROM donations d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.project_id = $1
        ORDER BY d.created_at DESC
        LIMIT $2 OFFSET $3
      `, [projectId, limit, offset]);
      
      console.log(`Found ${donations.rows.length} donations for project ${projectId}`);
      
      // Get total count including quadratic funding
      const countQuery = await db.query(
        'SELECT COUNT(*) FROM donations WHERE project_id = $1',
        [projectId]
      );
      const total = parseInt(countQuery.rows[0].count, 10);
      
      // Get total amount raised including quadratic funding
      const totalQuery = await db.query(
        'SELECT SUM(amount) as total FROM donations WHERE project_id = $1',
        [projectId]
      );
      const totalRaised = parseFloat(totalQuery.rows[0].total || 0);
      
      console.log(`Total donations: ${total}, Total raised: ${totalRaised}`);
      
      res.json({
        success: true,
        data: {
          donations: donations.rows,
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total_raised: totalRaised
        }
      });
    } catch (error) {
      console.error('Error fetching project donations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch donations',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get donations by user
  getDonationsByUser: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user exists
      const user = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (user.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Check if user is requesting their own donations or if admin
      if (req.user.id !== userId && !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Unauthorized access',
            code: 'UNAUTHORIZED'
          }
        });
      }

      const donations = await db.query(`
        SELECT d.*, p.title as project_title
        FROM donations d
        JOIN projects p ON d.project_id = p.id
        WHERE d.user_id = $1
        ORDER BY d.created_at DESC
      `, [userId]);
      
      res.json({
        success: true,
        data: donations.rows
      });
    } catch (error) {
      logger.error('Error fetching donations by user:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch donations',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Create new donation
  createDonation: async (req, res) => {
    try {
      const { amount, project_id, transaction_hash } = req.body;
      const user_id = req.user.id;
      
      // Check if project exists and get wallet address
      const projectResult = await db.query(
        'SELECT id, wallet_address FROM projects WHERE id = $1', 
        [project_id]
      );
      
      if (projectResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'PROJECT_NOT_FOUND'
          }
        });
      }
      
      const projectWalletAddress = projectResult.rows[0].wallet_address;
      
      // Get user wallet address
      const userResult = await db.query(
        'SELECT wallet_address FROM users WHERE id = $1',
        [user_id]
      );
      
      if (userResult.rows.length === 0 || !userResult.rows[0].wallet_address) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'User wallet not found',
            code: 'WALLET_NOT_FOUND'
          }
        });
      }
      
      const userWalletAddress = userResult.rows[0].wallet_address;
      
      // Check if user has sufficient balance (optional, can be skipped if needed)
      try {
        const balance = await blockchainService.getWalletBalance(userWalletAddress);
        if (parseFloat(balance) < parseFloat(amount)) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Insufficient balance',
              code: 'INSUFFICIENT_BALANCE'
            }
          });
        }
      } catch (error) {
        logger.error('Error checking balance:', error);
        // Continue with the donation even if balance check fails
      }
      
      // Use provided transaction hash or make a real blockchain donation
      let finalTransactionHash;
      if (transaction_hash) {
        finalTransactionHash = transaction_hash;
        logger.info(`Using provided transaction hash: ${finalTransactionHash}`);
      } else {
        try {
          // Log the complete user object for debugging
          logger.info(`User object for donation: ${JSON.stringify(req.user)}`);
          
          // Get the user's Worldcoin verification status
          const isWorldcoinVerified = req.user.is_worldcoin_verified || false;
          logger.info(`User Worldcoin verification status: ${isWorldcoinVerified}`);
          
          // Double-check the database directly
          const userCheck = await db.query(
            'SELECT is_worldcoin_verified FROM users WHERE id = $1',
            [req.user.id]
          );
          
          const dbVerificationStatus = userCheck.rows[0]?.is_worldcoin_verified || false;
          logger.info(`Database Worldcoin verification status: ${dbVerificationStatus}`);
          
          // Use the value directly from the database
          const verificationStatus = dbVerificationStatus;
          
          // Make the actual blockchain donation
          finalTransactionHash = await blockchainService.makeDonation(
            userWalletAddress,
            projectWalletAddress,
            amount,
            project_id,
            verificationStatus  // Pass the verified status from database
          );
          logger.info(`Blockchain donation successful. Transaction hash: ${finalTransactionHash}`);
        } catch (blockchainError) {
          logger.error('Error making donation on blockchain:', blockchainError);
          return res.status(500).json({
            success: false,
            error: {
              message: 'Failed to process donation on blockchain',
              code: 'BLOCKCHAIN_ERROR'
            }
          });
        }
      }
      
      // Get the project's pool ID from the database
      const projectQuery = await db.query('SELECT pool_id FROM projects WHERE id = $1', [project_id]);
      if (projectQuery.rows.length === 0) {
        throw new Error('Project not found for donation');
      }
      const poolId = projectQuery.rows[0].pool_id;

      // Check if the pool is active (optional, depends on business logic)
      let isPoolActive = false;
      if (poolId !== null) {
          const poolQuery = await db.query('SELECT is_active FROM funding_pools WHERE id = $1', [poolId]);
          isPoolActive = poolQuery.rows.length > 0 && poolQuery.rows[0].is_active;
      }
      
      // Determine if the donation is eligible for quadratic funding
      const isQuadraticEligible = poolId !== null && isPoolActive && req.user.is_worldcoin_verified;

      // Save donation in database, using pool_id instead of round_id
      const donation = await db.query(
        `INSERT INTO donations (amount, project_id, user_id, transaction_hash, pool_id, quadratic_eligible, donation_type) 
         VALUES ($1, $2, $3, $4, $5, $6, 'project') 
         RETURNING *`,
        [amount, project_id, user_id, finalTransactionHash, poolId, isQuadraticEligible]
      );

      res.status(201).json({
        success: true,
        data: donation.rows[0]
      });
    } catch (error) {
      logger.error('Error creating donation:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create donation',
          code: 'CREATE_ERROR'
        }
      });
    }
  },

  // Delete donation (admin only)
  deleteDonation: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Only admins can delete donations
      if (!req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Only administrators can delete donations',
            code: 'UNAUTHORIZED'
          }
        });
      }

      // Get the donation details first for the amount
      const donationCheck = await db.query(
        'SELECT amount, project_id FROM donations WHERE id = $1',
        [id]
      );

      if (donationCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Donation not found',
            code: 'NOT_FOUND'
          }
        });
      }

      const { amount, project_id } = donationCheck.rows[0];

      // Delete the donation
      const donation = await db.query('DELETE FROM donations WHERE id = $1 RETURNING *', [id]);

      // Update project raised amount
      await db.query(
        `UPDATE projects 
         SET raised_amount = GREATEST(COALESCE(raised_amount, 0) - $1, 0)
         WHERE id = $2`,
        [amount, project_id]
      );

      res.json({
        success: true,
        message: 'Donation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting donation:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete donation',
          code: 'DELETE_ERROR'
        }
      });
    }
  },

  // Get donations for a user
  getUserDonations: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const donations = await db.query(`
        SELECT d.*, p.name as project_name, c.name as charity_name
        FROM donations d
        JOIN projects p ON d.project_id = p.id
        JOIN charities c ON p.charity_id = c.id
        WHERE d.user_id = $1
        ORDER BY d.created_at DESC
      `, [userId]);
      
      // Get total amount donated
      const totalQuery = await db.query(`
        SELECT SUM(amount) as total
        FROM donations
        WHERE user_id = $1
      `, [userId]);
      
      const totalDonated = parseFloat(totalQuery.rows[0].total || 0);
      
      res.json({
        success: true,
        data: {
          donations: donations.rows,
          total_donated: totalDonated,
          donation_count: donations.rows.length
        }
      });
    } catch (error) {
      logger.error('Error fetching user donations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch donations',
          code: 'FETCH_ERROR'
        }
      });
    }
  },
  
  // Get donation statistics
  getDonationStats: async (req, res) => {
    try {
      // Get overall donation stats
      const statsQuery = await db.query(`
        SELECT 
          COUNT(DISTINCT user_id) as unique_donors,
          COUNT(*) as total_donations,
          SUM(amount) as total_amount,
          AVG(amount) as average_donation
        FROM donations
      `);
      
      // Get top projects
      const topProjectsQuery = await db.query(`
        SELECT p.id, p.name, COUNT(*) as donation_count, SUM(d.amount) as total_donations
        FROM donations d
        JOIN projects p ON d.project_id = p.id
        GROUP BY p.id, p.name
        ORDER BY total_donations DESC
        LIMIT 5
      `);
      
      // Get recent trend (last 30 days)
      const trendQuery = await db.query(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as donation_count,
          SUM(amount) as daily_amount
        FROM donations
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `);
      
      res.json({
        success: true,
        data: {
          stats: statsQuery.rows[0],
          top_projects: topProjectsQuery.rows,
          trend: trendQuery.rows
        }
      });
    } catch (error) {
      logger.error('Error fetching donation stats:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch donation statistics',
          code: 'FETCH_ERROR'
        }
      });
    }
  }
};

module.exports = donationController; 