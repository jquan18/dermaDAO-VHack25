const db = require('../config/database');
const logger = require('../config/logger');
const blockchainService = require('../services/blockchain.service');
const { AppError } = require('../utils/appError');
const httpStatus = require('http-status');

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
               fp.theme as pool_theme, fp.id as pool_id
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
      
      // Get quadratic funding status if applicable
      let quadratic = { rows: [] }; // Default empty result
      try {
        const quadraticQuery = `
          SELECT ra.allocated_amount, ra.transaction_hash, fr.id as round_id, fr.end_time
          FROM round_allocations ra
          JOIN funding_rounds fr ON ra.round_id = fr.id
          WHERE ra.project_id = $1
          ORDER BY fr.end_time DESC
          LIMIT 1
        `;
        quadratic = await db.query(quadraticQuery, [id]);
      } catch (quadraticError) {
        logger.warn(`Unable to fetch quadratic funding info (tables may not exist yet): ${quadraticError.message}`);
        // Continue without quadratic funding data
      }

      // Extract pool information
      const poolInfo = project.rows[0].pool_id ? {
        id: project.rows[0].pool_id,
        name: project.rows[0].pool_name,
        description: project.rows[0].pool_description,
        theme: project.rows[0].pool_theme
      } : null;

      // Construct the detailed project object
      const projectData = {
        ...project.rows[0],
        milestones: milestones.rows,
        funding: {
          goal: parseFloat(project.rows[0].funding_goal),
          raised: parseFloat(funding.rows[0].raised || 0),
          donors_count: parseInt(funding.rows[0].donors_count || 0, 10),
          quadratic_match: quadratic.rows.length > 0 ? parseFloat(quadratic.rows[0].allocated_amount || 0) : 0
        },
        proposals: proposals.rows,
        pool: poolInfo
      };

      // Remove duplicate pool fields from the main object
      delete projectData.pool_name;
      delete projectData.pool_description;
      delete projectData.pool_theme;

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
      const { charity_id, pool_id, name, description, ipfs_hash, funding_goal, duration_days } = req.body;
      
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
        `);
        
        const result = await db.query(
          `INSERT INTO projects 
           (charity_id, pool_id, name, description, ipfs_hash, funding_goal, duration_days, wallet_address, start_date, end_date, verification_score, is_active) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
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
            false // Project not active until verified
          ]
        );
        
        const projectId = result.rows[0].id;
        logger.info(`Project inserted successfully with ID: ${projectId}`);
        
        // Immediately trigger AI verification
        const aiService = require('../services/ai.service');
        const projectData = {
          id: projectId,
          charity_id,
          pool_id,
          name,
          description,
          ipfs_hash,
          funding_goal,
          duration_days,
          wallet_address: walletAddress
        };
        
        const aiEvaluation = await aiService.evaluateProject(projectId, projectData);
        
        // Update project with AI verification score
        await db.query(
          `UPDATE projects 
           SET verification_score = $1, 
               verification_notes = $2,
               is_active = $3
           WHERE id = $4`,
          [
            aiEvaluation.score,
            aiEvaluation.notes,
            aiEvaluation.verified, // Set project active if AI verification passes
            projectId
          ]
        );
        
        // Add project to blockchain pool
        try {
          logger.info(`Adding project ${projectId} to pool ${pool_id} on blockchain`);
          await blockchainService.addProjectToPool(projectId, pool_id);
        } catch (blockchainError) {
          logger.error(`Error adding project ${projectId} to pool ${pool_id} on blockchain:`, blockchainError);
          // Continue even if blockchain operation fails
        }
        
        // Call blockchain service to verify project if AI verification passes
        if (aiEvaluation.verified) {
          try {
            logger.info(`Project ${projectId} passed AI verification with score ${aiEvaluation.score}, verifying on blockchain`);
            await blockchainService.verifyProject(projectId, true);
          } catch (blockchainError) {
            logger.error(`Error verifying project ${projectId} on blockchain after AI verification:`, blockchainError);
            // Continue even if blockchain verification fails
          }
        }
        
        // Create audit log
        await db.query(
          `INSERT INTO audit_logs 
           (user_id, action, entity_type, entity_id, details, ip_address) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user.id,
            'CREATE_PROJECT',
            'project',
            projectId,
            JSON.stringify({
              project_name: name,
              charity_id: charity_id,
              pool_id: pool_id,
              ai_score: aiEvaluation.score,
              ai_verified: aiEvaluation.verified
            }),
            req.ip
          ]
        );
        
        // Return success with project ID and AI verification status
        res.status(201).json({
          success: true,
          data: {
            id: projectId,
            name,
            description,
            pool_id,
            ipfs_hash,
            funding_goal,
            duration_days,
            wallet_address: walletAddress,
            verification_score: aiEvaluation.score,
            is_active: aiEvaluation.verified,
            ai_verified: aiEvaluation.verified,
            verification_notes: aiEvaluation.notes
          }
        });
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
      const { 
        name, 
        description, 
        funding_goal, 
        duration_days,
        ipfs_hash,
        is_active
      } = req.body;
      
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
      
      // Calculate new end date if duration_days is provided
      let endDate = projectCheck.rows[0].end_date;
      if (duration_days) {
        const startDate = projectCheck.rows[0].start_date || new Date();
        endDate = new Date(startDate.getTime() + duration_days * 24 * 60 * 60 * 1000);
      }
      
      const project = await db.query(
        `UPDATE projects 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             funding_goal = COALESCE($3, funding_goal),
             duration_days = COALESCE($4, duration_days),
             ipfs_hash = COALESCE($5, ipfs_hash),
             is_active = COALESCE($6, is_active),
             end_date = COALESCE($7, end_date),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 
         RETURNING *`,
        [name, description, funding_goal, duration_days, ipfs_hash, is_active, endDate, id]
      );

      res.json({
        success: true,
        data: project.rows[0]
      });
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

  // Verify a project (admin only)
  verifyProject: async (req, res) => {
    try {
      const { id } = req.params;
      const { verified, verification_notes } = req.body;
      
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Only administrators can verify projects',
            code: 'PERMISSION_DENIED'
          }
        });
      }
      
      // Check if project exists
      const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1', [id]);
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Project not found',
            code: 'NOT_FOUND'
          }
        });
      }
      
      // Update project verification status
      const project = await db.query(
        `UPDATE projects 
         SET is_verified = $1,
             verification_notes = $2,
             verified_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE verified_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 
         RETURNING *`,
        [verified, verification_notes, id]
      );
      
      // Update blockchain verification status
      try {
        // Call blockchain service to verify project
        await blockchainService.verifyProject(id, verified);
      } catch (blockchainError) {
        logger.error('Error verifying project on blockchain:', blockchainError);
        // Continue with database update even if blockchain update fails
      }
      
      res.json({
        success: true,
        data: {
          project_id: project.rows[0].id,
          is_verified: project.rows[0].is_verified
        }
      });
    } catch (error) {
      logger.error('Error verifying project:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to verify project',
          code: 'UPDATE_ERROR'
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
  }
};

module.exports = projectController; 