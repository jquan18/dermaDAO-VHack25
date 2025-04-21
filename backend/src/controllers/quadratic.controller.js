const db = require('../config/database');
const logger = require('../config/logger');
const blockchainService = require('../services/blockchain.service');

const quadraticController = {
  // Get all projects eligible for quadratic funding
  getAllProjects: async (req, res) => {
    try {
      const projects = await db.query(`
        SELECT p.*, c.name as charity_name,
               COUNT(DISTINCT d.user_id) as vote_count,
               SUM(d.amount) as total_votes
        FROM projects p
        JOIN charities c ON p.charity_id = c.id
        LEFT JOIN donations d ON p.id = d.project_id AND d.quadratic_eligible = true
        WHERE p.is_active = true
        GROUP BY p.id, c.name
        ORDER BY total_votes DESC NULLS LAST
      `);
      
      res.json({
        success: true,
        data: projects.rows
      });
    } catch (error) {
      logger.error('Error fetching quadratic projects:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch projects',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get project details with quadratic funding info
  getProjectDetails: async (req, res) => {
    try {
      const { id } = req.params;
      
      const project = await db.query(`
        SELECT p.*, c.name as charity_name,
               COUNT(DISTINCT d.user_id) as vote_count,
               SUM(d.amount) as total_votes,
               json_agg(DISTINCT jsonb_build_object(
                 'user_id', d.user_id,
                 'amount', d.amount,
                 'created_at', d.created_at
               )) as votes
        FROM projects p
        JOIN charities c ON p.charity_id = c.id
        LEFT JOIN donations d ON p.id = d.project_id AND d.quadratic_eligible = true
        WHERE p.id = $1
        GROUP BY p.id, c.name
      `, [id]);
      
      if (project.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }

      res.json({
        success: true,
        data: project.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching project details:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch project details',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Submit a quadratic vote (now records as a donation with quadratic_eligible flag)
  vote: async (req, res) => {
    try {
      const { project_id, amount } = req.body;
      const user_id = req.user.id;

      if (!project_id || amount === undefined || amount === null) {
         return res.status(400).json({ success: false, error: { message: 'project_id and amount are required', code: 'MISSING_FIELDS' }});
      }
      const amountValue = parseFloat(amount);
       if (isNaN(amountValue) || amountValue < 0) { // Allow 0 amount?
         return res.status(400).json({ success: false, error: { message: 'Invalid amount', code: 'INVALID_AMOUNT' } });
       }

      // 1. Check if project exists and get its associated pool_id
      const projectQuery = await db.query(
        'SELECT id, pool_id FROM projects WHERE id = $1 AND is_active = true',
        [project_id]
      );

      if (projectQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'Project not found or not active', code: 'PROJECT_NOT_FOUND' }
        });
      }

      const pool_id = projectQuery.rows[0].pool_id;
      if (pool_id === null || pool_id === undefined) {
         // Project must belong to a pool to receive QF-eligible donations
         return res.status(400).json({ success: false, error: { message: 'Project is not associated with a funding pool', code: 'PROJECT_NOT_IN_POOL' }});
      }

      // 2. Check if the associated funding pool is currently active
      const poolQuery = await db.query(
         'SELECT id FROM funding_pools WHERE id = $1 AND is_active = true AND start_date <= NOW() AND end_date >= NOW()',
         [pool_id]
      );

      if (poolQuery.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'The funding pool for this project is not currently active', code: 'POOL_INACTIVE' }
        });
      }

      // 4. Record the donation with quadratic_eligible flag and pool_id
      // REMOVED: round_id from INSERT and VALUES
      const donation = await db.query(
        `INSERT INTO donations (user_id, project_id, amount, pool_id, quadratic_eligible, donation_type) 
         VALUES ($1, $2, $3, $4, true, 'project') 
         RETURNING *`,
        [user_id, project_id, amountValue, pool_id]
      );

      // 5. Optional: Update project's total raised amount (if funding_goal tracks this)
       await db.query(
          `UPDATE projects 
           SET funding_goal = COALESCE(funding_goal, 0) + $1 
           WHERE id = $2`,
           [amountValue, project_id]
       );

       // 6. Log audit event
       await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)`,
        [user_id, 'QF_VOTE', 'donation', donation.rows[0].id, JSON.stringify({ project_id, amount: amountValue, pool_id }), req.ip]
       );


      res.status(201).json({
        success: true,
        data: donation.rows[0]
      });
    } catch (error) {
      logger.error('Error recording quadratic donation (vote):', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to record donation',
          code: 'DONATION_ERROR'
        }
      });
    }
  },

  // Get voting results for a project
  getVotingResults: async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Get project details
      const project = await db.query(
        'SELECT * FROM projects WHERE id = $1',
        [projectId]
      );
      
      if (project.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }

      // Get voting statistics
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT user_id) as total_voters,
          SUM(amount) as total_votes,
          AVG(amount) as average_vote,
          MIN(amount) as min_vote,
          MAX(amount) as max_vote
        FROM donations
        WHERE project_id = $1 AND quadratic_eligible = true
      `, [projectId]);

      // Get vote distribution
      const distribution = await db.query(`
        SELECT 
          CASE 
            WHEN amount <= 10 THEN '0-10'
            WHEN amount <= 50 THEN '11-50'
            WHEN amount <= 100 THEN '51-100'
            ELSE '100+'
          END as range,
          COUNT(*) as count
        FROM donations
        WHERE project_id = $1 AND quadratic_eligible = true
        GROUP BY 
          CASE 
            WHEN amount <= 10 THEN '0-10'
            WHEN amount <= 50 THEN '11-50'
            WHEN amount <= 100 THEN '51-100'
            ELSE '100+'
          END
        ORDER BY range
      `, [projectId]);

      res.json({
        success: true,
        data: {
          project: project.rows[0],
          statistics: stats.rows[0],
          distribution: distribution.rows
        }
      });
    } catch (error) {
      logger.error('Error fetching voting results:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch voting results',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get funding pool balance
  getPoolBalance: async (req, res) => {
    try {
      // Get pool balance from blockchain service
      const balance = await blockchainService.getQuadraticPoolBalance();
      
      res.json({
        success: true,
        data: {
          pool_balance: balance
        }
      });
    } catch (error) {
      logger.error('Error fetching pool balance:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch pool balance',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Distribute quadratic funding based on pool lifetime
  distributeQuadraticFunding: async (req, res) => {
    try {
      const { pool_id, force_distribution } = req.body; // Added force_distribution parameter

      if (!pool_id) {
        return res.status(400).json({
          success: false,
          error: { message: 'pool_id is required', code: 'MISSING_POOL_ID' }
        });
      }

      logger.info(`Attempting quadratic funding distribution for pool ${pool_id}${force_distribution ? ' (forced)' : ''}`);

      // 1. Get Pool Details and Check Status
      const poolQuery = await db.query(
        'SELECT id, name, start_date, end_date, is_active, total_funds, is_distributed FROM funding_pools WHERE id = $1',
        [pool_id]
      );

      if (poolQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: `Funding pool with ID ${pool_id} not found`, code: 'POOL_NOT_FOUND' }
        });
      }

      const pool = poolQuery.rows[0];
      logger.info(`Found pool ${pool.name} (ID: ${pool.id}) for distribution.`);

      // Check if pool has already been distributed
      if (pool.is_distributed) {
        return res.status(400).json({
          success: false,
          error: { message: 'Pool has already been distributed', code: 'ALREADY_DISTRIBUTED' }
        });
      }

      // Check if pool is active
      if (!pool.is_active) {
        return res.status(400).json({
          success: false,
          error: { message: 'Pool is not active', code: 'POOL_INACTIVE' }
        });
      }

      // Check if pool has ended, unless force_distribution is true
      const now = new Date();
      const endDate = pool.end_date ? new Date(pool.end_date) : null;
      
      if (endDate && now < endDate && !force_distribution) {
        return res.status(400).json({
          success: false,
          error: { 
            message: 'Pool has not ended yet. Use force_distribution=true to distribute anyway.', 
            code: 'POOL_NOT_ENDED' 
          }
        });
      }

      // If it's a forced distribution and the pool hasn't ended yet, end it now
      if (force_distribution && endDate && now < endDate) {
        logger.info(`Forcing early end for pool ${pool_id} due to manual distribution request`);
        
        // Update end_date to now in the database
        await db.query(
          'UPDATE funding_pools SET end_date = NOW() WHERE id = $1',
          [pool_id]
        );
        
        // Update our local pool object
        pool.end_date = now;
        logger.info(`Pool ${pool_id} end date updated to current time due to manual distribution`);
      }

      // 2. Fetch Eligible Donations for the Pool's Lifetime
      // Assuming donations table now has pool_id directly
      const donationsQuery = await db.query(`
        SELECT 
          d.user_id, 
          d.project_id, 
          SUM(d.amount) as total_donation, 
          COUNT(DISTINCT d.id) as donation_count,
          u.wallet_address as donor_wallet,
          u.is_worldcoin_verified
        FROM donations d
        JOIN users u ON d.user_id = u.id
        WHERE d.pool_id = $1 
          AND d.quadratic_eligible = true 
          AND d.created_at >= $2 
          AND d.created_at <= $3 -- Consider pool start/end dates
        GROUP BY d.user_id, d.project_id, u.wallet_address, u.is_worldcoin_verified
      `, [pool_id, pool.start_date, pool.end_date]);

      if (donationsQuery.rows.length === 0) {
        logger.warn(`No eligible donations found for pool ${pool_id} distribution.`);
        // Decide if this is an error or just means no distribution occurs
        // return res.status(400).json({ success: false, error: { message: 'No eligible donations found for this pool', code: 'NO_DONATIONS' }});
      }

      logger.info(`Found ${donationsQuery.rows.length} donation records for QF calculation in pool ${pool_id}.`);
      
      // Prepare data for blockchain service (structure might need adjustment based on contract needs)
      const projectContributions = {};
      donationsQuery.rows.forEach(donation => {
        if (!projectContributions[donation.project_id]) {
          projectContributions[donation.project_id] = { totalDonated: 0, contributors: new Set() };
        }
        projectContributions[donation.project_id].totalDonated += parseFloat(donation.total_donation);
        projectContributions[donation.project_id].contributors.add(donation.user_id); // Or donor_wallet if needed by contract
      });

      const projectsForDistribution = Object.entries(projectContributions).map(([projectId, data]) => ({
        projectId: parseInt(projectId),
        totalDonated: data.totalDonated,
        uniqueContributors: data.contributors.size,
        // Add other required fields for the blockchain service if needed
      }));
      
      logger.info(`Prepared ${projectsForDistribution.length} projects for blockchain distribution.`);

      // 3. Call the blockchain service to distribute funding for the pool
      logger.info(`Calling blockchain service to distribute funding for pool ${pool_id}`);
      // Assuming blockchainService.distributeQuadraticFunding now takes poolId and project data
      // The `createNewRound` parameter is removed.
      const result = await blockchainService.distributeQuadraticFunding(pool_id, projectsForDistribution);

      if (!result || !result.success) {
        logger.error(`Blockchain distribution failed for pool ${pool_id}:`, result?.error);
        return res.status(500).json({
          success: false,
          error: {
            message: `Failed to distribute quadratic funding: ${result?.error || 'Unknown error'}`,
            code: 'DISTRIBUTION_FAILED'
          }
        });
      }

      logger.info(`Distribution successful for pool ${pool_id}. Transaction hash: ${result.transactionHash}`);
      logger.info(`Found ${result.distributions?.length || 0} project allocations from event logs.`);

      // 4. Record Allocations (Optional: Replace round_allocations)
      // Option A: Add an `is_distributed` flag and `distribution_tx_hash` to funding_pools
      await db.query(`
        UPDATE funding_pools 
        SET is_distributed = true, 
            distributed_at = NOW(),
            distribution_tx_hash = $1 
            -- Maybe store result.distributions JSONB here too?
        WHERE id = $2
      `, [result.transactionHash, pool_id]);
      logger.info(`Marked pool ${pool_id} as distributed.`);

      // Option B: Log detailed allocations if needed (e.g., in audit_logs or a new table)
      if (result.distributions && result.distributions.length > 0) {
        for (const item of result.distributions) {
          if (item.projectId !== undefined && item.amount) {
            logger.info(`Recording allocation for project ${item.projectId} in pool ${pool_id}: ${item.amount} ETH`);
            
            // Get project details
            const projectDetails = await db.query(
              'SELECT name FROM projects WHERE id = $1',
              [item.projectId]
            );
            const projectName = projectDetails.rows[0]?.name || 'Unknown Project';

            // Insert into a new simplified allocation table or log (example: audit_logs)
            await db.query(`
              INSERT INTO audit_logs 
              (user_id, action, entity_type, entity_id, details, ip_address) 
              VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                null, // System action
                'QF_ALLOCATION',
                'project',
                item.projectId,
                JSON.stringify({
                  pool_id: pool_id,
                  allocated_amount: parseFloat(item.amount),
                  transaction_hash: result.transactionHash,
                  // Add uniqueContributors, donationSum if available from `result.distributions`
                }),
                req.ip // Or null if run by a script
              ]
            );
            
            // Update project raised amount (assuming funding_goal represents total raised)
            await db.query(`
              UPDATE projects 
              SET funding_goal = COALESCE(funding_goal, 0) + $1 
              WHERE id = $2
            `, [parseFloat(item.amount), item.projectId]);

            // Record the distribution transaction (as before)
            await db.query(`
              INSERT INTO wallet_transactions 
              (user_id, type, amount, currency, transaction_hash, status, related_entity_type, related_entity_id, completed_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
              null, // System distribution
              'quadratic_distribution',
              parseFloat(item.amount),
              'ETH',
              result.transactionHash,
              'completed',
              'project',
              item.projectId
            ]);
            
            logger.info(`Successfully recorded allocation for ${projectName} (${item.amount} ETH) in pool ${pool_id}`);
          }
        }
      } else {
          logger.warn(`No allocation details found in blockchain result for pool ${pool_id}`);
      }


      res.json({
        success: true,
        data: {
          pool_id: pool_id,
          transaction_hash: result.transactionHash,
          distributions: result.distributions || [],
          message: `Distribution for pool ${pool_id} processed.`
        }
      });

    } catch (error) {
      logger.error('Error distributing quadratic funding:', {
        message: error.message,
        stack: error.stack,
        pool_id: req.body.pool_id
      });
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to distribute quadratic funding',
          code: 'SERVER_ERROR',
          details: error.message
        }
      });
    }
  },

  // Record an external contribution (e.g., direct sponsor top-up)
  recordExternalContribution: async (req, res) => {
    try {
      const {
        transaction_hash,
        amount,
        pool_id, // Require pool_id instead of round_id
        contributor_address,
        contributor_name,
      } = req.body;

      if (!transaction_hash || !amount || !pool_id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required fields: transaction_hash, amount, pool_id',
            code: 'MISSING_FIELDS'
          }
        });
      }

      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid amount', code: 'INVALID_AMOUNT' }
        });
      }

      // Check if pool exists
      const poolQuery = await db.query(
        'SELECT id FROM funding_pools WHERE id = $1',
        [pool_id]
      );

      if (poolQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: `Funding pool with ID ${pool_id} not found`, code: 'POOL_NOT_FOUND' }
        });
      }

      // Check if transaction hash is unique
      const existingTx = await db.query(
        'SELECT id FROM external_contributions WHERE transaction_hash = $1',
        [transaction_hash]
      );

      if (existingTx.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: { message: 'Transaction hash already recorded', code: 'DUPLICATE_TRANSACTION' }
        });
      }

      // Record the external contribution
      // REMOVED round_id from INSERT and VALUES
      const result = await db.query(`
        INSERT INTO external_contributions
        (transaction_hash, amount, contributor_address, contributor_name, pool_id, recorded_by, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, transaction_hash, amount, contributor_address, contributor_name, pool_id, recorded_at
      `, [
        transaction_hash,
        amountValue,
        contributor_address || null,
        contributor_name || null,
        pool_id,
        req.user.id // Assuming admin user performs this
      ]);

      // Update pool's total funds
      await db.query(
        `UPDATE funding_pools SET total_funds = COALESCE(total_funds, 0) + $1 WHERE id = $2`,
        [amountValue, pool_id]
      );

      // Log the action
      await db.query(
        `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id,
          'RECORD_EXTERNAL_CONTRIBUTION',
          'external_contribution',
          result.rows[0].id,
          JSON.stringify({
            transaction_hash,
            amount: amountValue,
            pool_id: pool_id // Log pool_id instead of round_id
          }),
          req.ip
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      logger.error('Error recording external contribution:', {
        message: error.message,
        stack: error.stack,
        requestBody: req.body
      });
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to record external contribution',
          code: 'SERVER_ERROR',
          details: error.message
        }
      });
    }
  },
};

module.exports = quadraticController; 