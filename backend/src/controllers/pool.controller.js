const db = require('../config/database');
const logger = require('../config/logger');
const blockchainService = require('../services/blockchain.service');
const blockchainConfig = require('../config/blockchain');
const { Pool } = require('pg');

const poolController = {
  // Get all funding pools with filtering and pagination
  getAllPools: async (req, res) => {
    try {
      const { sponsor_id, is_active, page = 1, limit = 100, search } = req.query;
      const offset = (page - 1) * limit;
      const requestingUser = req.user; // Get the authenticated user info

      let query = `
        SELECT p.id, p.name, p.description, p.theme, p.sponsor_id, p.is_active, 
               p.company_id, p.admin_id, p.contract_pool_id, p.logo_image, 
               p.banner_image, p.matching_ratio, p.start_date, p.end_date, 
               COALESCE(p.total_funds, 0) as total_funds, p.created_at, p.updated_at,
               p.is_shariah_compliant, u.full_name as sponsor_name 
        FROM funding_pools p
        LEFT JOIN users u ON p.sponsor_id = u.id
        WHERE 1=1
      `;

      const queryParams = [];
      let paramCounter = 1;

      // Automatic filtering for corporate users
      if (requestingUser && requestingUser.role === 'corporate') {
        query += ` AND p.sponsor_id = $${paramCounter++}`;
        queryParams.push(requestingUser.id);
        logger.info(`Corporate user ${requestingUser.id} requesting pools. Filtering by sponsor_id.`);
      }
      // Allow overriding filter if sponsor_id is explicitly provided in query (optional, could be removed)
      else if (sponsor_id) {
        query += ` AND p.sponsor_id = $${paramCounter++}`;
        queryParams.push(sponsor_id);
      }

      if (is_active !== undefined) {
        query += ` AND p.is_active = $${paramCounter++}`;
        queryParams.push(is_active === 'true');
      }

      if (search) {
        query += ` AND (p.name ILIKE $${paramCounter} OR p.description ILIKE $${paramCounter} OR p.theme ILIKE $${paramCounter})`;
        queryParams.push(`%${search}%`);
        paramCounter++;
      }

      // Get total count
      const countQuery = query.replace(/SELECT.*FROM/s, 'SELECT COUNT(p.id) FROM');
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count, 10);

      // Add pagination and include pool with ID 0
      query += ` ORDER BY p.created_at DESC LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
      queryParams.push(limit);
      queryParams.push(offset);

      logger.info(`Executing pools query: ${query} with params: ${queryParams}`);
      const pools = await db.query(query, queryParams);
      
      logger.info(`Found ${pools.rows.length} pools`);

      // Get project counts for each pool
      const poolIds = pools.rows.map(p => p.id);
      
      // Add project counts only if there are pools
      let poolsWithCounts = pools.rows;
      if (poolIds.length > 0) {
        const projectCountQuery = `
          SELECT pool_id, COUNT(id) as project_count
          FROM projects
          WHERE pool_id IN (${poolIds.map((_, i) => `$${i + 1}`).join(',')})
          GROUP BY pool_id
        `;
        
        const projectCounts = await db.query(projectCountQuery, poolIds);
        
        // Create a map of pool_id to project count
        const projectCountMap = {};
        projectCounts.rows.forEach(row => {
          projectCountMap[row.pool_id] = parseInt(row.project_count, 10);
        });
        
        // Add project count to each pool
        poolsWithCounts = pools.rows.map(pool => ({
          ...pool,
          project_count: projectCountMap[pool.id] || 0
        }));
      } else {
        // If no pools, just add 0 as project count
        poolsWithCounts = pools.rows.map(pool => ({
          ...pool,
          project_count: 0
        }));
      }

      res.json({
        success: true,
        data: poolsWithCounts,
        pagination: {
          totalItems: parseInt(total, 10),
          currentPage: page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching pools:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch pools',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get pool by ID
  getPoolById: async (req, res) => {
    try {
      const { id } = req.params;

      // Get pool details
      const poolQuery = `
        SELECT p.id, p.name, p.description, p.theme, p.sponsor_id, p.is_active, 
               p.company_id, p.admin_id, p.contract_pool_id, p.logo_image, 
               p.banner_image, p.matching_ratio, p.start_date, p.end_date, 
               COALESCE(p.total_funds, 0) as total_funds, p.created_at, p.updated_at, 
               p.is_shariah_compliant, u.full_name as sponsor_name, c.name as company_name
        FROM funding_pools p
        LEFT JOIN users u ON p.sponsor_id = u.id
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE p.id = $1
      `;
      const pool = await db.query(poolQuery, [id]);

      if (pool.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Pool not found',
            code: 'NOT_FOUND'
          }
        });
      }

      // Get projects in this pool
      const projectsQuery = `
        SELECT p.id, p.name, p.description, p.is_active, p.verification_score,
               p.funding_goal as raised_amount, p.is_shariah_compliant, -- Include is_shariah_compliant
               c.name as charity_name
        FROM projects p
        JOIN charities c ON p.charity_id = c.id
        WHERE p.pool_id = $1
        ORDER BY p.created_at DESC
      `;
      const projects = await db.query(projectsQuery, [id]);

      // Get total donations made directly to this pool
      const poolDonationsQuery = `
        SELECT SUM(amount) as total_donated_to_pool
        FROM donations
        WHERE pool_id = $1 AND project_id IS NULL AND donation_type = 'pool'
      `;
      const poolDonations = await db.query(poolDonationsQuery, [id]);
      const totalDonatedDirectly = parseFloat(poolDonations.rows[0]?.total_donated_to_pool || 0);

      // Construct the detailed pool object
      const poolData = {
        ...pool.rows[0],
        projects: projects.rows,
        total_donated_directly: totalDonatedDirectly
      };
      
      // Log the pool data for debugging
      logger.info(`Pool ${id} data fetched: ${JSON.stringify({
        ...poolData,
        projects: poolData.projects.length + ' projects'
      })}`);

      res.json({
        success: true,
        data: poolData
      });
    } catch (error) {
      logger.error('Error fetching pool:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch pool',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Create a new funding pool
  createPool: async (req, res) => {
    try {
      const {
        name, description, theme, sponsor_id, admin_id, company_id, company_name,
        logo_image, banner_image, matching_ratio, start_date, end_date, is_shariah_compliant
      } = req.body;
      const userId = req.user.id;

      // If company_id is not provided directly, check if user has a company
      let finalCompanyId = company_id;
      
      if (!finalCompanyId && req.user.role === 'corporate') {
        try {
          const companyQuery = await db.query(
            'SELECT id FROM companies WHERE user_id = $1',
            [req.user.id]
          );
          
          if (companyQuery.rows.length > 0) {
            finalCompanyId = companyQuery.rows[0].id;
            logger.info(`Using company ID ${finalCompanyId} for corporate user ${req.user.id}`);
          }
        } catch (companyError) {
          logger.error(`Failed to get company for corporate user ${req.user.id}:`, companyError);
          // Continue without company if lookup fails
        }
      }

      // Find the maximum existing pool ID to determine the next one
      const maxPoolIdResult = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM funding_pools WHERE id != 0');
      const nextPoolId = parseInt(maxPoolIdResult.rows[0].max_id, 10) + 1;

      // Fetch the user's wallet address from the database
      const userQuery = await db.query('SELECT wallet_address FROM users WHERE id = $1', [userId]);
      const userWalletAddress = userQuery.rows.length > 0 ? userQuery.rows[0].wallet_address : null;
      
      // Make sure we have a valid wallet address for the sponsor
      const sponsorAddress = userWalletAddress || blockchainConfig.ADMIN_WALLET_ADDRESS;
      
      if (!sponsorAddress || sponsorAddress === '0x0' || !sponsorAddress.startsWith('0x')) {
        logger.error(`No valid sponsor wallet address found for user ${userId}`);
        return res.status(500).json({ 
          success: false, 
          error: { 
            message: 'Failed to create pool: no valid wallet address for sponsor', 
            code: 'INVALID_WALLET_ADDRESS' 
          } 
        });
      }

      logger.info(`Attempting to create pool on blockchain with intended DB ID: ${nextPoolId}, sponsor: ${sponsorAddress}`);

      // Set duration in seconds (86400 seconds per day)
      const durationInSeconds = end_date 
        ? Math.floor((new Date(end_date) - new Date()) / 1000) 
        : 30 * 86400; // Default 30 days in seconds
      
      if (durationInSeconds <= 0) {
        logger.error(`Invalid duration: ${durationInSeconds} seconds`);
        return res.status(400).json({ 
          success: false, 
          error: { 
            message: 'End date must be in the future', 
            code: 'INVALID_END_DATE' 
          } 
        });
      }

      // Create pool on blockchain
      const blockchainResult = await blockchainService.createPoolOnContract({
        poolId: nextPoolId, // Pass the intended DB ID to the contract
        name: name,
        description: description || "No description provided",
        sponsor: sponsorAddress,
        duration: durationInSeconds
      });

      if (!blockchainResult.success || !blockchainResult.data?.pool_id) {
        logger.error('Failed to create pool on blockchain:', blockchainResult.error);
        return res.status(500).json({ success: false, error: { message: `Failed to create pool on blockchain: ${blockchainResult.error}`, code: 'BLOCKCHAIN_ERROR' } });
      }

      const contractPoolId = blockchainResult.data.pool_id;
      logger.info(`Pool created on blockchain with contract ID: ${contractPoolId}, linking to DB ID: ${nextPoolId}`);

      // Insert pool into database with explicit ID and extended fields
      const result = await db.query(
        `INSERT INTO funding_pools 
         (id, name, description, theme, sponsor_id, admin_id, company_id, contract_pool_id, 
          logo_image, banner_image, matching_ratio, start_date, end_date, total_funds, is_active, 
          is_shariah_compliant, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, true, $14, NOW(), NOW()) 
         RETURNING *`, // Return the full pool object
        [
          nextPoolId, // Use the determined ID
          name,
          description,
          theme,
          sponsor_id || userId, // Default sponsor to creator if not provided
          admin_id || userId,   // Default admin to creator if not provided
          finalCompanyId || null,
          contractPoolId,     // Store the ID returned by the contract
          logo_image || null,
          banner_image || null,
          matching_ratio || 1,
          start_date,         // Store provided start date
          end_date,           // Store provided end date
          is_shariah_compliant || false // Default to false if not provided
        ]
      );

      const newPool = result.rows[0];
      logger.info(`Successfully created pool in DB with ID ${newPool.id}`);

      // Log the action
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 'CREATE_POOL', 'funding_pool', newPool.id, JSON.stringify({ name, theme }), req.ip]
      );

      res.status(201).json({ success: true, data: newPool });
    } catch (error) {
      logger.error('Error creating pool:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create funding pool',
          code: 'SERVER_ERROR',
          details: error.message
        }
      });
    }
  },

  // Update a funding pool
  updatePool: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, theme, is_active, is_shariah_compliant } = req.body;
      const userId = req.user.id;

      // Check if pool exists and user is authorized
      const poolCheck = await db.query(
        `SELECT * FROM funding_pools WHERE id = $1`,
        [id]
      );

      if (poolCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Pool not found',
            code: 'NOT_FOUND'
          }
        });
      }

      // Check if user is sponsor or admin
      if (poolCheck.rows[0].sponsor_id !== userId && 
          poolCheck.rows[0].admin_id !== userId && 
          !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to update this pool',
            code: 'PERMISSION_DENIED'
          }
        });
      }

      // Check if any update fields provided
      if (!name && !description && !theme && is_active === undefined && is_shariah_compliant === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No update fields provided',
            code: 'INVALID_REQUEST'
          }
        });
      }

      // Build update query parts and values
      const updateParts = [];
      const updateValues = [];
      let paramCounter = 1;

      if (name) {
        updateParts.push(`name = $${paramCounter++}`);
        updateValues.push(name);
      }

      if (description) {
        updateParts.push(`description = $${paramCounter++}`);
        updateValues.push(description);
      }

      if (theme) {
        updateParts.push(`theme = $${paramCounter++}`);
        updateValues.push(theme);
      }

      if (is_active !== undefined) {
        updateParts.push(`is_active = $${paramCounter++}`);
        updateValues.push(is_active);
      }

      if (is_shariah_compliant !== undefined) {
        updateParts.push(`is_shariah_compliant = $${paramCounter++}`);
        updateValues.push(is_shariah_compliant);
      }

      // Add updated_at timestamp
      updateParts.push(`updated_at = NOW()`);
      
      // Construct and execute update query
      const updateQuery = `
        UPDATE funding_pools 
        SET ${updateParts.join(', ')} 
        WHERE id = $${paramCounter++} 
        RETURNING *
      `;
      updateValues.push(id);

      const result = await db.query(updateQuery, updateValues);

      // Create audit log
      await db.query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id,
          'UPDATE_POOL',
          'funding_pool',
          id,
          JSON.stringify({
            name: name || poolCheck.rows[0].name,
            is_active: is_active !== undefined ? is_active : poolCheck.rows[0].is_active,
            is_shariah_compliant: is_shariah_compliant !== undefined ? is_shariah_compliant : poolCheck.rows[0].is_shariah_compliant
          }),
          req.ip
        ]
      );

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error updating pool:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update pool',
          code: 'UPDATE_ERROR'
        }
      });
    }
  },

  // Delete a funding pool
  deletePool: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if pool exists and user is authorized
      const poolCheck = await db.query(
        `SELECT * FROM funding_pools WHERE id = $1`,
        [id]
      );

      if (poolCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Pool not found',
            code: 'NOT_FOUND'
          }
        });
      }

      // Check if user is sponsor or admin
      if (poolCheck.rows[0].sponsor_id !== userId && poolCheck.rows[0].admin_id !== userId && !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to delete this pool',
            code: 'PERMISSION_DENIED'
          }
        });
      }

      // Check if pool has projects
      const projectsCheck = await db.query(
        'SELECT COUNT(*) FROM projects WHERE pool_id = $1',
        [id]
      );

      if (parseInt(projectsCheck.rows[0].count, 10) > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot delete pool with existing projects',
            code: 'PROJECTS_EXIST'
          }
        });
      }

      // Delete the pool
      await db.query('DELETE FROM funding_pools WHERE id = $1', [id]);

      // Create audit log
      await db.query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id,
          'DELETE_POOL',
          'funding_pool',
          id,
          JSON.stringify({
            pool_name: poolCheck.rows[0].name,
            contract_pool_id: poolCheck.rows[0].contract_pool_id
          }),
          req.ip
        ]
      );

      res.json({
        success: true,
        data: {
          message: 'Pool deleted successfully'
        }
      });
    } catch (error) {
      logger.error('Error deleting pool:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete pool',
          code: 'DELETE_ERROR'
        }
      });
    }
  },

  // Donate directly to a funding pool (handles on-chain transfer)
  donateToPool: async (req, res) => {
    const poolDbId = req.params.id; // Pool ID from URL parameter
    const { amount } = req.body;    // Amount from request body
    const userId = req.user.id;       // User ID from authenticated request

    try {
      if (!amount) {
        return res.status(400).json({ success: false, error: { message: 'Amount is required', code: 'MISSING_AMOUNT' } });
      }

      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        return res.status(400).json({ success: false, error: { message: 'Invalid amount', code: 'INVALID_AMOUNT' } });
      }

      // 1. Verify Pool Exists, is Active, and get Contract Pool ID
      const poolQuery = await db.query(
        'SELECT name, start_date, end_date, is_active, contract_pool_id FROM funding_pools WHERE id = $1',
        [poolDbId]
      );
      if (poolQuery.rows.length === 0) {
        return res.status(404).json({ success: false, error: { message: 'Funding pool not found', code: 'POOL_NOT_FOUND' } });
      }

      const pool = poolQuery.rows[0];
      const contractPoolId = pool.contract_pool_id; // The ID used on the blockchain contract
      const now = new Date();
      const startDate = pool.start_date ? new Date(pool.start_date) : null;
      const endDate = pool.end_date ? new Date(pool.end_date) : null;

      if (!contractPoolId) {
         logger.error(`Pool ${poolDbId} is missing contract_pool_id.`);
         return res.status(500).json({ success: false, error: { message: 'Pool configuration error: missing contract ID', code: 'POOL_CONFIG_ERROR' } });
      }

      if (!pool.is_active || (startDate && now < startDate) || (endDate && now > endDate)) {
         logger.warn(`Donation attempt to inactive/outside date range pool ${poolDbId}. Name: ${pool.name}`);
         return res.status(400).json({ success: false, error: { message: 'Donations are not currently accepted for this pool', code: 'POOL_INACTIVE' } });
      }

      // 2. Verify User Exists and get eligibility info
      const userQuery = await db.query('SELECT id, is_worldcoin_verified FROM users WHERE id = $1', [userId]);
      if (userQuery.rows.length === 0) {
        // This shouldn't happen if authenticate middleware is working
        return res.status(404).json({ success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
      }
      const isWorldcoinVerified = userQuery.rows[0].is_worldcoin_verified;

      // 3. Initiate On-Chain Transfer via Blockchain Service
      logger.info(`Initiating transfer of ${amountValue} to pool contract ID ${contractPoolId} for user ${userId}`);
      
      // Get user's wallet address
      const userWalletQuery = await db.query(
        'SELECT wallet_address FROM users WHERE id = $1',
        [userId]
      );
      
      if (userWalletQuery.rows.length === 0 || !userWalletQuery.rows[0].wallet_address) {
        logger.error(`No wallet address found for user ${userId}`);
        return res.status(400).json({
          success: false,
          error: {
            message: 'User wallet address not found',
            code: 'WALLET_NOT_FOUND'
          }
        });
      }
      
      const userWalletAddress = userWalletQuery.rows[0].wallet_address;
      
      // Call the correct blockchain service function with the proper parameters
      const blockchainResult = await blockchainService.donateToFundingPool(
        userWalletAddress,
        poolDbId,
        amountValue.toString(),
        isWorldcoinVerified,
        false // isPoolOwner - set to false by default, could be determined by checking if userId === pool.sponsor_id
      );

      // The donateToFundingPool function returns a transaction hash directly, not a result object
      if (!blockchainResult) {
        logger.error(`Blockchain transfer failed for pool ${poolDbId} donation: No transaction hash returned`);
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to complete blockchain transaction',
            code: 'BLOCKCHAIN_TRANSFER_FAILED'
          }
        });
      }
      
      const finalTransactionHash = blockchainResult;
      logger.info(`Blockchain transfer successful for pool ${poolDbId}. Tx Hash: ${finalTransactionHash}`);

      // --- Transaction successful, now update database --- 
      
      // Use a database transaction for atomicity
      const client = await db.pool.connect(); 
      try {
          await client.query('BEGIN');
          
          // 4. Record the Donation in DB
          const donationResult = await client.query(
            `INSERT INTO donations (
              amount, 
              project_id, 
              user_id, 
              transaction_hash, 
              pool_id, 
              donation_type, 
              quadratic_eligible 
            ) VALUES ($1, NULL, $2, $3, $4, 'pool', $5) 
            RETURNING *`,
            [amountValue, userId, finalTransactionHash, poolDbId, isWorldcoinVerified]
          );
          const newDonation = donationResult.rows[0];

          // 5. Update Pool's Total Funds in DB
          await client.query(
            `UPDATE funding_pools 
             SET total_funds = COALESCE(total_funds, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [amountValue, poolDbId]
          );
          
          // 6. Log the action in DB
          await client.query(
            `INSERT INTO audit_logs 
             (user_id, action, entity_type, entity_id, details, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              userId,
              'DONATE_TO_POOL',
              'funding_pool',
              poolDbId,
              JSON.stringify({
                amount: amountValue,
                pool_name: pool.name,
                transaction_hash: finalTransactionHash
              }),
              req.ip
            ]
          );
          
          await client.query('COMMIT');
          
          res.status(201).json({
            success: true,
            data: {
              ...newDonation,
              pool_name: pool.name
            }
          });

      } catch (dbError) {
          await client.query('ROLLBACK');
          logger.error('Database error during pool donation recording:', { 
            message: dbError.message, 
            stack: dbError.stack, 
            poolId: poolDbId,
            userId: userId,
            txHash: finalTransactionHash
          });
          // Attempt to compensate? Or just report error?
          // For now, report that blockchain tx succeeded but DB failed.
          res.status(500).json({
            success: false,
            error: {
              message: 'Blockchain transaction succeeded, but failed to record donation in database.',
              code: 'DATABASE_RECORDING_FAILED',
              details: dbError.message,
              transaction_hash: finalTransactionHash // Include hash so it can be tracked
            }
          });
      } finally {
           client.release();
      }

    } catch (error) { // Catches errors before blockchain call or DB transaction start
      // Handle potential duplicate transaction hash error (unique constraint on donations table)
      // This might still happen if retried after blockchain success but before DB commit?
      // The DB transaction helps, but edge cases might exist.
      if (error.code === '23505' && error.constraint && error.constraint.includes('donations_transaction_hash')) { 
         logger.warn(`Duplicate donation transaction hash attempted: ${error.detail || finalTransactionHash}`); // Use finalTransactionHash if available
         return res.status(409).json({ success: false, error: { message: 'This transaction hash has already been recorded', code: 'DUPLICATE_TRANSACTION' } });
      }
      
      logger.error('Unhandled error in donateToPool:', { 
        message: error.message, 
        stack: error.stack, 
        poolId: poolDbId,
        userId: userId,
        requestBody: req.body 
      });
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to process donation to pool', 
          code: 'SERVER_ERROR',
          details: error.message
        }
      });
    }
  },
  
  // Add a project to a pool
  addProjectToPool: async (req, res) => {
    try {
      const { id } = req.params;
      const { project_id } = req.body;
      
      // Check if pool exists
      const poolResult = await db.query(
        'SELECT id FROM funding_pools WHERE id = $1', 
        [id]
      );
      
      if (poolResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Funding pool not found',
            code: 'POOL_NOT_FOUND'
          }
        });
      }
      
      // Check if project exists
      const projectResult = await db.query(
        'SELECT id, name FROM projects WHERE id = $1', 
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
      
      // Update the project's pool_id
      await db.query(
        'UPDATE projects SET pool_id = $1, updated_at = NOW() WHERE id = $2',
        [id, project_id]
      );
      
      // Log the action
      await db.query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id,
          'ADD_PROJECT_TO_POOL',
          'project',
          project_id,
          JSON.stringify({
            pool_id: id,
            project_name: projectResult.rows[0].name
          }),
          req.ip
        ]
      );
      
      res.json({
        success: true,
        data: {
          pool_id: id,
          project_id,
          project_name: projectResult.rows[0].name
        }
      });
    } catch (error) {
      logger.error('Error adding project to pool:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to add project to pool',
          code: 'UPDATE_ERROR'
        }
      });
    }
  },
  
  // Get projects in a pool
  getPoolProjects: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if pool exists
      const poolResult = await db.query(
        'SELECT id, name FROM funding_pools WHERE id = $1', 
        [id]
      );
      
      if (poolResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Funding pool not found',
            code: 'POOL_NOT_FOUND'
          }
        });
      }
      
      // Get all projects in this pool
      const projectsResult = await db.query(`
        SELECT 
          p.id, 
          p.name, 
          p.description, 
          p.funding_goal,
          p.verification_score,
          p.is_active,
          p.is_verified,
          c.id as charity_id,
          c.name as charity_name,
          COUNT(d.id) as donation_count,
          COALESCE(SUM(d.amount), 0) as funds_raised
        FROM 
          projects p
          JOIN charities c ON p.charity_id = c.id
          LEFT JOIN donations d ON d.project_id = p.id
        WHERE 
          p.pool_id = $1
        GROUP BY 
          p.id, c.id
        ORDER BY 
          p.name
      `, [id]);
      
      res.json({
        success: true,
        data: {
          pool_id: id,
          pool_name: poolResult.rows[0].name,
          projects: projectsResult.rows
        }
      });
    } catch (error) {
      logger.error('Error fetching pool projects:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch pool projects',
          code: 'FETCH_ERROR'
        }
      });
    }
  },
};

module.exports = poolController; 