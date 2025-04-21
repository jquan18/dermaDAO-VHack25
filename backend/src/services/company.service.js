const db = require('../config/database');
const logger = require('../config/logger');
const { AppError } = require('../utils/appError');
const httpStatus = require('http-status');

/**
 * Create a new company
 * @param {Object} companyData - Company data
 * @param {number} userId - User ID of company admin
 * @returns {Promise<Object>} Created company
 */
const createCompany = async (companyData, userId) => {
  try {
    logger.info(`Creating company for user ${userId}: ${companyData.name}`);
    
    const { name, description, website, logo_url } = companyData;
    
    const result = await db.query(
      `INSERT INTO companies (
        name, 
        description, 
        website, 
        logo_url, 
        user_id, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
      RETURNING id, name, description, website, logo_url, user_id, created_at`,
      [name, description || '', website || '', logo_url || '', userId]
    );
    
    logger.info(`Company created with ID: ${result.rows[0].id}`);
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Failed to create company: ${error.message}`, error);
    throw new AppError('Failed to create company', httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Get company by user ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} Company or null if not found
 */
const getCompanyByUserId = async (userId) => {
  try {
    const result = await db.query(
      'SELECT * FROM companies WHERE user_id = $1',
      [userId]
    );
    
    return result.rows.length ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Failed to get company for user ${userId}: ${error.message}`, error);
    throw new AppError('Failed to get company', httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Get company by ID
 * @param {number} companyId - Company ID
 * @returns {Promise<Object|null>} Company or null if not found
 */
const getCompanyById = async (companyId) => {
  try {
    const result = await db.query(
      'SELECT * FROM companies WHERE id = $1',
      [companyId]
    );
    
    return result.rows.length ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Failed to get company ${companyId}: ${error.message}`, error);
    throw new AppError('Failed to get company', httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Update company
 * @param {number} companyId - Company ID
 * @param {Object} companyData - Company data to update
 * @returns {Promise<Object>} Updated company
 */
const updateCompany = async (companyId, companyData) => {
  try {
    const { name, description, website, logo_url } = companyData;
    
    // Build update query based on provided data
    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      queryParams.push(name);
    }
    
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      queryParams.push(description);
    }
    
    if (website !== undefined) {
      updateFields.push(`website = $${paramIndex++}`);
      queryParams.push(website);
    }
    
    if (logo_url !== undefined) {
      updateFields.push(`logo_url = $${paramIndex++}`);
      queryParams.push(logo_url);
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    queryParams.push(companyId);
    
    const query = `
      UPDATE companies 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING id, name, description, website, logo_url, user_id, created_at, updated_at
    `;
    
    const result = await db.query(query, queryParams);
    
    if (result.rows.length === 0) {
      throw new AppError('Company not found', httpStatus.NOT_FOUND);
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Failed to update company ${companyId}: ${error.message}`, error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update company', httpStatus.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  createCompany,
  getCompanyByUserId,
  getCompanyById,
  updateCompany
}; 