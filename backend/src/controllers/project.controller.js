const db = require('../config/database');
const logger = require('../config/logger');
const blockchainService = require('../services/blockchain.service');
const { AppError } = require('../utils/appError');
const httpStatus = require('http-status');
const { ethers } = require('ethers');
const axios = require('axios');

// Format blockchain transaction
function formatBlockchainTransaction(tx, walletAddress) {
  const value = ethers.formatEther(tx.value || '0');
  const timestamp = parseInt(tx.timeStamp, 10) || Math.floor(Date.now() / 1000);
  const isIncoming = tx.to && tx.to.toLowerCase() === walletAddress.toLowerCase();
  const isOutgoing = tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase();
  
  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: value,
    timestamp: timestamp,
    blockNumber: tx.blockNumber,
    isIncoming,
    isOutgoing,
    gasUsed: tx.gasUsed,
    gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : '0',
    isInternal: tx.isInternalTransaction || false
  };
}

const projectController = {
  // Get all projects with pagination, filtering and search
  getAllProjects: async (req, res) => {
    try {
      const { charity_id, verified, active, page = 1, limit = 10, search } = req.query;
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT p.*, c.name as charity_name 
        FROM projects p 
        JOIN charities c ON p.charity_id = c.id
        WHERE 1=1
      `;
      
      const queryParams = [];
      let paramCounter = 1;
      
      if (charity_id) {
        query += ` AND p.charity_id = $${paramCounter++}`;
        queryParams.push(charity_id);
      }
      
      if (verified !== undefined) {
        const verificationThreshold = 50; // Minimum score to be considered verified
        query += verified === 'true' 
          ? ` AND p.verification_score >= $${paramCounter++}` 
          : ` AND p.verification_score < $${paramCounter++}`;
        queryParams.push(verificationThreshold);
      }
      
      if (active !== undefined) {
        query += ` AND p.is_active = $${paramCounter++}`;
        queryParams.push(active === 'true');
      }
      
      if (search) {
        query += ` AND (p.name ILIKE $${paramCounter} OR p.description ILIKE $${paramCounter})`;
        queryParams.push(`%${search}%`);
        paramCounter++;
      }
      
      // Get total count
      const countQuery = query.replace('p.*, c.name as charity_name', 'COUNT(p.id)');
      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count, 10);
      
      // Add pagination
      query += ` ORDER BY p.created_at DESC LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
      queryParams.push(limit);
      queryParams.push(offset);
      
      const projects = await db.query(query, queryParams);
      
      // Get funding progress for each project
      const projectIds = projects.rows.map(p => p.id);
      
      if (projectIds.length > 0) {
        const fundingQuery = `
          SELECT project_id, SUM(amount) as raised, COUNT(DISTINCT user_id) as donors_count
          FROM donations
          WHERE project_id IN (${projectIds.map((_, i) => `$${i + 1}`).join(',')})
          GROUP BY project_id
        `;
        
        const fundingResult = await db.query(fundingQuery, projectIds);
        
        // Create a map of project_id to funding data
        const fundingMap = {};
        fundingResult.rows.forEach(row => {
          fundingMap[row.project_id] = {
            raised: parseFloat(row.raised),
            donors_count: parseInt(row.donors_count, 10)
          };
        });
        
        // Add funding data to each project
        projects.rows = projects.rows.map(project => {
          const funding = fundingMap[project.id] || { raised: 0, donors_count: 0 };
          return {
            ...project,
            funding_progress: {
              goal: parseFloat(project.funding_goal),
              raised: funding.raised,
              donors_count: funding.donors_count
            }
          };
        });
      }
      
      res.json({
        success: true,
        data: {
          projects: projects.rows,
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10)
        }
      });
    } catch (error) {
      logger.error('Error fetching projects:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch projects',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get project by ID with detailed information
  getProjectById: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get project details including pool information
      const projectQuery = `
        SELECT p.*, c.name as charity_name, c.admin_id,
               fp.name as pool_name, fp.description as pool_description, 
               fp.theme as pool_theme, fp.id as pool_id, fp.is_shariah_compliant as pool_is_shariah_compliant
        FROM projects p 
        JOIN charities c ON p.charity_id = c.id
        LEFT JOIN funding_pools fp ON p.pool_id = fp.id 
        WHERE p.id = $1
      `;
      const project = await db.query(projectQuery, [id]);
      
      if (project.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Get milestone information
      const milestonesQuery = `
        SELECT * FROM milestones
        WHERE project_id = $1
        ORDER BY id
      `;
      const milestones = await db.query(milestonesQuery, [id]);
      
      // Get funding information
      const fundingQuery = `
        SELECT SUM(amount) as raised, COUNT(DISTINCT user_id) as donors_count
        FROM donations
        WHERE project_id = $1
      `;
      const funding = await db.query(fundingQuery, [id]);
      
      // Get proposals
      const proposalsQuery = `
        SELECT id, milestone_id, description, amount, evidence_ipfs_hash, status, created_at, executed_at
        FROM proposals
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;
      const proposals = await db.query(proposalsQuery, [id]);
      
      // Get quadratic funding allocation from the blockchain if applicable
      let quadraticMatchAmount = 0;
      const poolId = project.rows[0].pool_id;
      const projectId = id;
      
      if (poolId !== null && poolId !== undefined) {
        try {
          logger.info(`Fetching quadratic allocation for project ${projectId} in pool ${poolId}`);
          const allocationResult = await blockchainService.getProjectAllocation(poolId, projectId);
          quadraticMatchAmount = parseFloat(allocationResult || 0);
          logger.info(`Quadratic allocation for project ${projectId} in pool ${poolId}: ${quadraticMatchAmount}`);
        } catch (blockchainError) {
          logger.warn(`Unable to fetch quadratic funding allocation from blockchain for project ${projectId}, pool ${poolId}: ${blockchainError.message}`);
          // Continue with 0 allocation if blockchain call fails
        }
      } else {
        logger.info(`Project ${projectId} is not associated with a funding pool. Skipping quadratic allocation fetch.`);
      }

      // Extract pool information
      const poolInfo = project.rows[0].pool_id ? {
        id: project.rows[0].pool_id,
        name: project.rows[0].pool_name,
        description: project.rows[0].pool_description,
        theme: project.rows[0].pool_theme,
        is_shariah_compliant: project.rows[0].pool_is_shariah_compliant
      } : null;

      // Construct the detailed project object
      const projectData = {
        ...project.rows[0],
        milestones: milestones.rows,
        funding: {
          goal: parseFloat(project.rows[0].funding_goal),
          raised: parseFloat(funding.rows[0].raised || 0),
          donors_count: parseInt(funding.rows[0].donors_count || 0, 10),
          quadratic_match: quadraticMatchAmount // Use the amount fetched from blockchain
        },
        proposals: proposals.rows,
        pool: poolInfo
      };

      // Remove duplicate pool fields from the main object
      delete projectData.pool_name;
      delete projectData.pool_description;
      delete projectData.pool_theme;
      delete projectData.pool_is_shariah_compliant;

      res.json({
        success: true,
        data: projectData
      });
    } catch (error) {
      logger.error('Error fetching project:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch project',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Get projects for a charity
  getCharityProjects: async (req, res) => {
    try {
      const { charity_id } = req.params;
      
      // Check if charity exists
      const charityCheck = await db.query('SELECT id FROM charities WHERE id = $1', [charity_id]);
      if (charityCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Charity not found',
            code: 'CHARITY_NOT_FOUND'
          }
        });
      }
      
      // Get projects
      const projectsQuery = `
        SELECT p.*, 
               (SELECT SUM(amount) FROM donations WHERE project_id = p.id) as raised,
               (SELECT COUNT(DISTINCT user_id) FROM donations WHERE project_id = p.id) as donors_count
        FROM projects p
        WHERE p.charity_id = $1
        ORDER BY p.created_at DESC
      `;
      const projects = await db.query(projectsQuery, [charity_id]);
      
      // Format the response
      const formattedProjects = projects.rows.map(project => ({
        ...project,
        raised: parseFloat(project.raised || 0),
        donors_count: parseInt(project.donors_count || 0, 10),
        funding_goal: parseFloat(project.funding_goal)
      }));

      res.json({
        success: true,
        data: formattedProjects
      });
    } catch (error) {
      logger.error('Error fetching charity projects:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch charity projects',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  // Create new project with milestones
  createProject: async (req, res) => {
    try {
      const { charity_id, pool_id, name, description, ipfs_hash, funding_goal, duration_days, is_shariah_compliant } = req.body;
      
      // Validate required parameters
      if (!pool_id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Pool ID is required',
            code: 'MISSING_POOL_ID'
          }
        });
      }
      
      // Validate charity ownership
      const charityResult = await db.query(
        'SELECT admin_id FROM charities WHERE id = $1',
        [charity_id]
      );
      
      if (charityResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Charity not found',
            code: 'CHARITY_NOT_FOUND'
          }
        });
      }
      
      const charity = charityResult.rows[0];
      
      // Check if user is the charity admin
      if (charity.admin_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to create projects for this charity',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Check if pool exists
      const poolResult = await db.query(
        'SELECT id, name, contract_pool_id FROM funding_pools WHERE id = $1 AND is_active = true',
        [pool_id]
      );
      
      if (poolResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Funding pool not found or not active',
            code: 'POOL_NOT_FOUND'
          }
        });
      }
      
      // Get contract_pool_id (this is the ID on the blockchain)
      const contractPoolId = poolResult.rows[0].contract_pool_id !== null 
        ? poolResult.rows[0].contract_pool_id 
        : 0; // Fallback to 0 if null
      
      // Calculate end date based on duration
      const start_date = new Date(); // Current time
      const duration_days_int = parseInt(duration_days, 10) || 30; // Default to 30 days if invalid
      const end_date = new Date();
      end_date.setDate(end_date.getDate() + duration_days_int);
      
      logger.info(`Project dates: start=${start_date.toISOString()}, end=${end_date.toISOString()}, duration=${duration_days_int} days`);
      
      // Create wallet for project
      const walletAddress = await blockchainService.createProjectWallet(
        req.user.id, // adminId
        null, // projectId will be generated later, so pass null for now
        name, 
        description,
        charity_id,
        contractPoolId // Use contract_pool_id for blockchain
      );
      
      if (!walletAddress) {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to create project wallet',
            code: 'WALLET_CREATION_ERROR'
          }
        });
      }
      
      // Verify wallet address is in correct format
      if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        logger.error(`Invalid wallet address format: ${walletAddress}`);
        return res.status(500).json({
          success: false,
          error: {
            message: 'Invalid wallet address format returned from blockchain',
            code: 'INVALID_WALLET_ADDRESS'
          }
        });
      }
      
      // Insert project into database
      try {
        // Log all parameters to help debug any issues
        logger.info(`Inserting project into database with parameters:
          charity_id: ${charity_id}
          pool_id: ${pool_id}
          name: ${name}
          description: ${description.substring(0, 50)}...
          ipfs_hash: ${ipfs_hash || ''}
          funding_goal: ${funding_goal}
          duration_days: ${duration_days_int}
          wallet_address: ${walletAddress}
          start_date: ${start_date.toISOString()}
          end_date: ${end_date.toISOString()}
          is_shariah_compliant: ${is_shariah_compliant || false}
        `);
        
        const result = await db.query(
          `INSERT INTO projects 
           (charity_id, pool_id, name, description, ipfs_hash, funding_goal, duration_days, wallet_address, start_date, end_date, verification_score, is_active, is_shariah_compliant) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
           RETURNING id`,
          [
            charity_id,
            pool_id,
            name, 
            description, 
            ipfs_hash || '', // Ensure not null
            funding_goal, 
            duration_days_int, // Use the parsed integer
            walletAddress,
            start_date,
            end_date,
            0, // Initial verification score is 0
            true, // Project active by default, needs verification
            is_shariah_compliant || false // Default to false if not provided
          ]
        );
        
        const projectId = result.rows[0].id;
        logger.info(`Project inserted successfully with ID: ${projectId} (active but needs verification)`);
        
        // Immediately trigger AI verification (only record score and notes, do not auto-activate)
        const aiService = require('../services/ai.service');
        const projectData = { id: projectId, charity_id, pool_id, name, description, ipfs_hash, funding_goal, duration_days, wallet_address: walletAddress };
        const aiEvaluation = await aiService.evaluateProject(projectId, projectData);
        // Update only score and notes
        await db.query(
          `UPDATE projects
           SET verification_score = $1,
               verification_notes = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [aiEvaluation.score, aiEvaluation.notes, projectId]
        );
        // Create audit log (excluding auto-activation details)
        await db.query(
          `INSERT INTO audit_logs
           (user_id, action, entity_type, entity_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.user.id, 'CREATE_PROJECT', 'project', projectId, JSON.stringify({ project_name: name, charity_id, pool_id, ai_score: aiEvaluation.score }), req.ip]
        );
        
        // Explicitly set verification to false on blockchain (to ensure consistency)
        try {
          logger.info(`Explicitly setting project ${projectId} verification to false on blockchain`);
          await blockchainService.verifyProject(projectId, false);
        } catch (blockchainError) {
          logger.error(`Error setting project ${projectId} verification to false on blockchain:`, blockchainError);
          // Continue even if blockchain verification fails
        }
        
        // Return success with project ID
        res.status(201).json({ projectId });
      } catch (error) {
        logger.error('Error inserting project into database:', error);
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to insert project into database',
            code: 'DATABASE_ERROR',
            details: error.message
          }
        });
      }
    } catch (error) {
      logger.error('Error creating project:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create project',
          code: 'PROJECT_CREATION_ERROR',
          details: error.message
        }
      });
    }
  },

  // Update project
  updateProject: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, ipfs_hash, funding_goal, duration_days, is_active, is_shariah_compliant } = req.body;
      
      const userId = req.user.id;
      
      // Check if project exists and user is authorized
      const projectCheck = await db.query(
        `SELECT p.*, c.admin_id 
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.id = $1`,
        [id]
      );
      
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Check if user is admin of the charity or global admin
      if (projectCheck.rows[0].admin_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to update this project',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      if (name || description || ipfs_hash || funding_goal || duration_days !== undefined || is_active !== undefined || is_shariah_compliant !== undefined) {
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (name) {
          updates.push(`name = $${paramIndex++}`);
          values.push(name);
        }
        
        if (description) {
          updates.push(`description = $${paramIndex++}`);
          values.push(description);
        }
        
        if (ipfs_hash) {
          updates.push(`ipfs_hash = $${paramIndex++}`);
          values.push(ipfs_hash);
        }
        
        if (funding_goal) {
          updates.push(`funding_goal = $${paramIndex++}`);
          values.push(funding_goal);
        }
        
        if (duration_days !== undefined) {
          updates.push(`duration_days = $${paramIndex++}`);
          values.push(duration_days);
          
          // Update end date based on new duration if provided
          if (duration_days) {
            const currentDate = new Date();
            const newEndDate = new Date();
            newEndDate.setDate(currentDate.getDate() + parseInt(duration_days, 10));
            
            updates.push(`end_date = $${paramIndex++}`);
            values.push(newEndDate);
          }
        }
        
        if (is_active !== undefined) {
          updates.push(`is_active = $${paramIndex++}`);
          values.push(is_active);
        }
        
        if (is_shariah_compliant !== undefined) {
          updates.push(`is_shariah_compliant = $${paramIndex++}`);
          values.push(is_shariah_compliant);
        }
        
        updates.push(`updated_at = NOW()`);
        
        const project = await db.query(
          `UPDATE projects 
           SET ${updates.join(', ')}
           WHERE id = $${paramIndex} 
           RETURNING *`,
          [...values, id]
        );

        res.json({
          success: true,
          data: project.rows[0]
        });
      } else {
        res.json({
          success: true,
          data: projectCheck.rows[0]
        });
      }
    } catch (error) {
      logger.error('Error updating project:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update project',
          code: 'UPDATE_ERROR'
        }
      });
    }
  },

  // Update or add milestones
  updateMilestones: async (req, res) => {
    try {
      const { id } = req.params;
      const { milestones } = req.body;
      
      const userId = req.user.id;
      
      // Check if project exists and user is authorized
      const projectCheck = await db.query(
        `SELECT p.*, c.admin_id 
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.id = $1`,
        [id]
      );
      
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Check if user is admin of the charity
      if (projectCheck.rows[0].admin_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to update this project',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Validate milestones
      if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'At least one milestone is required',
            code: 'INVALID_MILESTONES'
          }
        });
      }
      
      // Check if milestone percentages sum to 100%
      const totalPercentage = milestones.reduce((sum, milestone) => sum + milestone.percentage, 0);
      if (totalPercentage !== 100) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Milestone percentages must sum to 100%',
            code: 'INVALID_MILESTONE_PERCENTAGES'
          }
        });
      }
      
      // Check if we can edit milestones (no proposals)
      const proposalsCheck = await db.query(
        'SELECT COUNT(*) FROM proposals WHERE project_id = $1',
        [id]
      );
      
      if (parseInt(proposalsCheck.rows[0].count, 10) > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot update milestones after proposals have been submitted',
            code: 'PROPOSALS_EXIST'
          }
        });
      }
      
      // Start a database transaction
      const client = await db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Delete existing milestones
        await client.query('DELETE FROM milestones WHERE project_id = $1', [id]);
        
        // Insert new milestones
        for (const milestone of milestones) {
          await client.query(
            `INSERT INTO milestones (
              project_id, title, description, percentage, status
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              id,
              milestone.title,
              milestone.description,
              milestone.percentage,
              'pending'
            ]
          );
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Get updated milestones
        const updatedMilestones = await db.query(
          'SELECT * FROM milestones WHERE project_id = $1 ORDER BY id',
          [id]
        );
        
        res.json({
          success: true,
          data: updatedMilestones.rows
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error updating milestones:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update milestones',
          code: 'UPDATE_ERROR'
        }
      });
    }
  },

  // Get project verification status
  getVerificationStatus: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get project details
      const project = await db.query(
        `SELECT p.*, c.admin_id 
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.id = $1`,
        [id]
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
      
      // Get verification logs
      const logsQuery = `
        SELECT * FROM ai_verification_logs
        WHERE entity_type = 'project' AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `;
      const logs = await db.query(logsQuery, [id]);
      
      // Generate improvement suggestions based on verification score
      const suggestions = [];
      const score = project.rows[0].verification_score || 0;
      
      if (score < 50) {
        suggestions.push('Provide more detailed project description');
        suggestions.push('Add clear milestone deliverables');
        suggestions.push('Include expected impact metrics');
      } else if (score < 75) {
        suggestions.push('Add more details on implementation methodology');
        suggestions.push('Include risk assessment and mitigation plans');
        suggestions.push('Add external references or past work examples');
      } else if (score < 90) {
        suggestions.push('Add more detailed budget allocation');
        suggestions.push('Include sustainability plan');
        suggestions.push('Add more detailed timeline');
      }
      
      res.json({
        success: true,
        data: {
          verification: {
            score: project.rows[0].verification_score,
            is_active: project.rows[0].is_active,
            notes: project.rows[0].verification_notes
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

  // Admin verification of a project
  verifyProject: async (req, res) => {
    try {
      const { id } = req.params;
      const { verification_score, verification_notes, is_active, is_shariah_compliant } = req.body;

      // Check if project exists
      const projectCheck = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
      
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }

      // Update verification status
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (verification_score !== undefined) {
        updateFields.push(`verification_score = $${paramIndex++}`);
        updateValues.push(verification_score);
      }

      if (verification_notes) {
        updateFields.push(`verification_notes = $${paramIndex++}`);
        updateValues.push(verification_notes);
      }

      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(is_active);
      }
      
      if (is_shariah_compliant !== undefined) {
        updateFields.push(`is_shariah_compliant = $${paramIndex++}`);
        updateValues.push(is_shariah_compliant);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(id);

      const result = await db.query(
        `UPDATE projects 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex} 
         RETURNING *`,
        updateValues
      );

      // Create audit log
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id, 
          'VERIFY_PROJECT', 
          'project', 
          id, 
          JSON.stringify({ 
            verification_score, 
            is_active,
            is_shariah_compliant 
          }), 
          req.ip
        ]
      );

      // Update verification on blockchain
      try {
        const verificationThreshold = 50; // Minimum score to be considered verified
        const isVerified = verification_score >= verificationThreshold;
        await blockchainService.verifyProject(id, isVerified);
        logger.info(`Project ${id} verification status set to ${isVerified} on blockchain`);
      } catch (blockchainError) {
        logger.error(`Error setting project ${id} verification on blockchain:`, blockchainError);
        // Continue even if blockchain verification fails
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error verifying project:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to verify project',
          code: 'VERIFICATION_ERROR'
        }
      });
    }
  },

  // Delete project
  deleteProject: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check if project exists and user is admin
      const projectCheck = await db.query(
        `SELECT p.*, c.admin_id 
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.id = $1`,
        [id]
      );
      
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Check if user is admin of the charity or global admin
      if (projectCheck.rows[0].admin_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You are not authorized to delete this project',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Check if project has donations
      const donationsCheck = await db.query(
        'SELECT COUNT(*) FROM donations WHERE project_id = $1',
        [id]
      );
      
      if (parseInt(donationsCheck.rows[0].count, 10) > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot delete project with existing donations',
            code: 'DONATIONS_EXIST'
          }
        });
      }
      
      // Start a database transaction
      const client = await db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Delete milestones
        await client.query('DELETE FROM milestones WHERE project_id = $1', [id]);
        
        // Delete project
        const project = await client.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
        
        // Commit transaction
        await client.query('COMMIT');
        
        res.json({
          success: true,
          message: 'Project deleted successfully'
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error deleting project:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete project',
          code: 'DELETE_ERROR'
        }
      });
    }
  },

  // Record a vote on project verification
  voteOnProject: async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      const userId = req.user.id;
      const { vote, comment } = req.body;
      // Check project exists
      const proj = await db.query('SELECT id, is_verified FROM projects WHERE id = $1', [projectId]);
      if (proj.rows.length === 0) {
        return res.status(404).json({ success: false, error: { message: 'Project not found', code: 'NOT_FOUND' } });
      }
      // Prevent voting on already verified projects
      if (proj.rows[0].is_verified) {
        return res.status(400).json({ success: false, error: { message: 'Project already verified', code: 'ALREADY_VERIFIED' } });
      }
      // Insert or update vote
      const existing = await db.query('SELECT id FROM project_verification_votes WHERE user_id = $1 AND project_id = $2', [userId, projectId]);
      if (existing.rows.length > 0) {
        await db.query('UPDATE project_verification_votes SET vote = $1, comment = $2, created_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND project_id = $4', [vote, comment || null, userId, projectId]);
      } else {
        await db.query('INSERT INTO project_verification_votes (user_id, project_id, vote, comment) VALUES ($1, $2, $3, $4)', [userId, projectId, vote, comment || null]);
      }
      // If vote is approve (true), mark project verified immediately
      if (vote) {
        await db.query('UPDATE projects SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [projectId]);
        // Also update the blockchain verification status
        try {
          // Call blockchain service to verify project
          await blockchainService.verifyProject(projectId, true);
        } catch (blockchainError) {
          logger.error(`Error verifying project ${projectId} on blockchain after user vote:`, blockchainError);
          // Continue with database update even if blockchain update fails
        }
      }
      res.json({ success: true, data: { project_id: projectId, voted: vote } });
    } catch (error) {
      logger.error('Error voting on project:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to record vote', code: 'VOTE_ERROR' } });
    }
  },

  // Get all votes for a project's verification
  getProjectVotes: async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      // Check project exists
      const proj = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
      if (proj.rows.length === 0) {
        return res.status(404).json({ success: false, error: { message: 'Project not found', code: 'NOT_FOUND' } });
      }
      const votes = await db.query(
        `SELECT v.user_id, u.full_name, v.vote, v.comment, v.created_at
         FROM project_verification_votes v
         JOIN users u ON v.user_id = u.id
         WHERE v.project_id = $1
         ORDER BY v.created_at DESC`, [projectId]
      );
      res.json({ success: true, data: votes.rows });
    } catch (error) {
      logger.error('Error fetching project votes:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to fetch votes', code: 'FETCH_ERROR' } });
    }
  },

  // List projects pending verification vote for the current donor
  getProjectsToVote: async (req, res) => {
    try {
      const userId = req.user.id;
      // Fetch all unverified projects regardless of donation history
      const result = await db.query(
        `SELECT p.id, p.name, p.description, p.verification_score, p.is_active, p.created_at,
         c.name as charity_name
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.is_verified = FALSE AND p.is_active = TRUE 
         ORDER BY p.created_at DESC`
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching projects to vote on:', error);
      res.status(500).json({ success: false, error: { message: 'Failed to fetch projects', code: 'FETCH_ERROR' } });
    }
  },

  // Get transactions for a project
  getProjectTransactions: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get project to verify it exists and get the wallet address
      const projectQuery = `
        SELECT p.*, c.name as charity_name 
        FROM projects p 
        JOIN charities c ON p.charity_id = c.id
        WHERE p.id = $1
      `;
      
      const project = await db.query(projectQuery, [id]);
      
      if (project.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      const walletAddress = project.rows[0].wallet_address;
      
      if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Project wallet address is missing or invalid',
            code: 'INVALID_WALLET'
          }
        });
      }
      
      // Get the API key for ScrollScan
      const SCROLLSCAN_API_KEY = process.env.SCROLLSCAN_API_KEY || '';
      
      // Define networks to try
      const networks = [
        { name: 'Sepolia', url: 'https://api-sepolia.scrollscan.com/api' },
        { name: 'Mainnet', url: 'https://api.scrollscan.com/api' }
      ];
      
      let transactions = [];
      let networkUsed = '';
      
      // Try each network until we find transactions
      for (const network of networks) {
        try {
          logger.info(`Trying ${network.name} network for project ${id} transactions...`);
          
          // Fetch regular transactions
          const txUrl = `${network.url}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${SCROLLSCAN_API_KEY}`;
          const txResponse = await axios.get(txUrl);
          
          if (txResponse.data.status === '1' && Array.isArray(txResponse.data.result) && txResponse.data.result.length > 0) {
            logger.info(`Found ${txResponse.data.result.length} transactions on ${network.name}`);
            
            // Format the transactions
            transactions = txResponse.data.result.map(tx => formatBlockchainTransaction(tx, walletAddress));
            
            networkUsed = network.name;
            break; // Exit loop if we found transactions
          }
          
          // Also fetch internal transactions
          const internalTxUrl = `${network.url}?module=account&action=txlistinternal&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${SCROLLSCAN_API_KEY}`;
          const internalTxResponse = await axios.get(internalTxUrl);
          
          if (internalTxResponse.data.status === '1' && Array.isArray(internalTxResponse.data.result) && internalTxResponse.data.result.length > 0) {
            logger.info(`Found ${internalTxResponse.data.result.length} internal transactions on ${network.name}`);
            
            // Add isInternalTransaction flag to mark these as internal transactions
            const internalTxsWithFlag = internalTxResponse.data.result.map(tx => ({
              ...tx,
              isInternalTransaction: true
            }));
            
            // Format and add internal transactions
            const internalTransactions = internalTxsWithFlag.map(tx => formatBlockchainTransaction(tx, walletAddress));
            
            // Combine with regular transactions if any
            transactions = [...transactions, ...internalTransactions];
            
            // Sort by timestamp (newest first)
            transactions.sort((a, b) => b.timestamp - a.timestamp);
            
            networkUsed = network.name;
            break; // Exit loop if we found transactions
          }
        } catch (error) {
          logger.error(`Error fetching transactions from ${network.name}:`, error);
        }
      }
      
      // If no transactions found, try to check if there are any local transactions in the database
      if (transactions.length === 0) {
        logger.info(`No transactions found on blockchain for project ${id}, checking database...`);
        
        try {
          // Check for donations or other transactions in our database
          const dbTransactions = await db.query(`
            SELECT * FROM transactions
            WHERE to_address = $1 OR from_address = $1
            ORDER BY created_at DESC
          `, [walletAddress]);
          
          if (dbTransactions.rows.length > 0) {
            logger.info(`Found ${dbTransactions.rows.length} transactions in database`);
            
            // Format database transactions
            transactions = dbTransactions.rows.map(tx => ({
              hash: tx.transaction_hash || `local-${tx.id}`,
              from: tx.from_address || 'Unknown',
              to: tx.to_address || walletAddress,
              value: tx.amount?.toString() || '0',
              timestamp: new Date(tx.created_at).getTime() / 1000,
              isIncoming: tx.to_address?.toLowerCase() === walletAddress.toLowerCase(),
              isOutgoing: tx.from_address?.toLowerCase() === walletAddress.toLowerCase(),
              status: tx.status || 'completed',
              source: 'database'
            }));
          }
        } catch (dbError) {
          logger.error(`Error fetching transactions from database:`, dbError);
        }
      }
      
      res.json({
        success: true,
        data: {
          transactions,
          project_id: parseInt(id, 10),
          project_name: project.rows[0].name,
          wallet_address: walletAddress,
          network: networkUsed || 'Database',
          count: transactions.length
        }
      });
    } catch (error) {
      logger.error(`Error fetching transactions for project ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch project transactions',
          code: 'FETCH_ERROR'
        }
      });
    }
  },

  /**
   * Trigger AI evaluation for a project
   * @route POST /api/projects/:id/ai-evaluate
   * @access Private (Admin only)
   */
  aiEvaluateProject: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Only administrators can trigger AI evaluation',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Check if project exists
      const projectResult = await db.query(
        `SELECT p.*, c.name as organization_name
         FROM projects p
         JOIN charities c ON p.charity_id = c.id
         WHERE p.id = $1`,
        [id]
      );
      
      if (projectResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      const project = projectResult.rows[0];
      
      // Prepare project data for AI evaluation
      const projectData = {
        id: project.id,
        name: project.name,
        description: project.description,
        ipfs_hash: project.ipfs_hash,
        funding_goal: project.funding_goal,
        organization_name: project.organization_name
      };
      
      // Import AI service
      const aiService = require('../services/ai.service');
      
      // Call AI service to evaluate project
      const aiEvaluation = await aiService.evaluateProject(id, projectData);
      
      // Update project with AI evaluation results
      await db.query(
        `UPDATE projects 
         SET verification_score = $1,
             verification_notes = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [aiEvaluation.score, aiEvaluation.notes, id]
      );
      
      // Return success response with AI evaluation results
      res.json({
        success: true,
        data: {
          project_id: id,
          verification_score: aiEvaluation.score,
          verified: aiEvaluation.verified,
          verification_notes: aiEvaluation.notes
        }
      });
    } catch (error) {
      logger.error('AI evaluation error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Server error during AI evaluation',
          code: 'SERVER_ERROR'
        }
      });
    }
  },
};

module.exports = projectController;