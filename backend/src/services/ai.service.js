const logger = require('../config/logger');
const db = require('../config/database');

/**
 * Evaluate a proposal using AI
 * @param {number} proposalId - Proposal ID
 * @param {Object} proposalData - Proposal data
 * @returns {Promise<{score: number, verified: boolean, notes: string}>} - Evaluation results
 */
const evaluateProposal = async (proposalId, proposalData) => {
  try {
    logger.info(`Evaluating proposal ${proposalId} with AI`);
    
    // Record the start time for processing time calculation
    const startTime = Date.now();
    
    // In a real implementation, this would call an AI service to evaluate the proposal
    // For now, we'll simulate AI evaluation with some basic rules
    
    // Example evaluation criteria
    const criteriaScores = {
      evidenceQuality: 0,
      milestoneAlignment: 0,
      budgetReasonability: 0,
      implementationFeasibility: 0,
      fraudRiskIndicators: 0
    };
    
    // Simulate evidence quality scoring (based on IPFS hash existence)
    if (proposalData.evidence_ipfs_hash && proposalData.evidence_ipfs_hash.length > 10) {
      criteriaScores.evidenceQuality = 95;
    } else {
      criteriaScores.evidenceQuality = 30;
    }
    
    // Simulate milestone alignment (would check if the proposal matches a milestone)
    if (proposalData.milestone_id) {
      criteriaScores.milestoneAlignment = 90;
    } else {
      criteriaScores.milestoneAlignment = 50;
    }
    
    // Simulate budget reasonability (check if amount is reasonable)
    const projectFunds = await getProjectFunds(proposalData.project_id);
    if (proposalData.amount <= projectFunds * 0.8) {
      criteriaScores.budgetReasonability = 90;
    } else if (proposalData.amount <= projectFunds) {
      criteriaScores.budgetReasonability = 70;
    } else {
      criteriaScores.budgetReasonability = 0;
    }
    
    // Simulate implementation feasibility
    criteriaScores.implementationFeasibility = 85;
    
    // Simulate fraud risk indicators (would look for red flags)
    // For demo, we'll base this on the description length
    if (proposalData.description && proposalData.description.length > 50) {
      criteriaScores.fraudRiskIndicators = 90;
    } else {
      criteriaScores.fraudRiskIndicators = 40;
    }
    
    // Calculate weighted average (each criteria has different weight)
    const weights = {
      evidenceQuality: 0.3,
      milestoneAlignment: 0.2,
      budgetReasonability: 0.25,
      implementationFeasibility: 0.15,
      fraudRiskIndicators: 0.1
    };
    
    let weightedScore = 0;
    for (const [criterion, score] of Object.entries(criteriaScores)) {
      weightedScore += score * weights[criterion];
    }
    
    // Round to nearest integer
    const finalScore = Math.round(weightedScore);
    
    // Determine if proposal is verified (threshold is 70)
    const verified = finalScore >= 70;
    
    // Generate evaluation notes
    let notes = `AI Evaluation Results:\n`;
    notes += `- Evidence Quality: ${criteriaScores.evidenceQuality}/100\n`;
    notes += `- Milestone Alignment: ${criteriaScores.milestoneAlignment}/100\n`;
    notes += `- Budget Reasonability: ${criteriaScores.budgetReasonability}/100\n`;
    notes += `- Implementation Feasibility: ${criteriaScores.implementationFeasibility}/100\n`;
    notes += `- Fraud Risk Assessment: ${criteriaScores.fraudRiskIndicators}/100\n`;
    notes += `\nFinal Score: ${finalScore}/100\n`;
    notes += verified ? 
      'RECOMMENDATION: APPROVE - This proposal meets verification criteria' : 
      'RECOMMENDATION: REJECT - This proposal does not meet verification criteria';
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Log evaluation in database
    await logAiEvaluation(
      'proposal',
      proposalId,
      proposalData,
      { score: finalScore, verified, notes },
      'v1.0',
      processingTime
    );
    
    logger.info(`Proposal ${proposalId} evaluated: score ${finalScore}, verified: ${verified}`);
    
    return {
      score: finalScore,
      verified,
      notes
    };
  } catch (error) {
    logger.error('AI evaluation error:', error);
    throw new Error(`Failed to evaluate proposal: ${error.message}`);
  }
};

/**
 * Evaluate a project using AI
 * @param {number} projectId - Project ID
 * @param {Object} projectData - Project data
 * @returns {Promise<{score: number, verified: boolean, notes: string}>} - Evaluation results
 */
const evaluateProject = async (projectId, projectData) => {
  try {
    logger.info(`Evaluating project ${projectId} with AI`);
    
    // Record the start time for processing time calculation
    const startTime = Date.now();
    
    // In a real implementation, this would call an AI service to evaluate the project
    // For now, we'll simulate AI evaluation with some basic rules
    
    // Example evaluation criteria
    const criteriaScores = {
      projectDescription: 0,
      organizationCredibility: 0,
      financialFeasibility: 0,
      socialImpact: 0,
      technicalImplementation: 0,
      fraudRiskIndicators: 0
    };
    
    // Simulate project description quality
    if (projectData.description && projectData.description.length > 200) {
      criteriaScores.projectDescription = 90;
    } else if (projectData.description && projectData.description.length > 100) {
      criteriaScores.projectDescription = 70;
    } else {
      criteriaScores.projectDescription = 40;
    }
    
    // Simulate organization credibility
    // In a real implementation, would check against external charity databases
    criteriaScores.organizationCredibility = 85;
    
    // Simulate financial feasibility
    if (projectData.funding_goal && !isNaN(parseFloat(projectData.funding_goal))) {
      const fundingGoal = parseFloat(projectData.funding_goal);
      if (fundingGoal > 0 && fundingGoal < 100) {
        criteriaScores.financialFeasibility = 90;
      } else if (fundingGoal >= 100 && fundingGoal < 1000) {
        criteriaScores.financialFeasibility = 80;
      } else {
        criteriaScores.financialFeasibility = 60;
      }
    } else {
      criteriaScores.financialFeasibility = 40;
    }
    
    // Simulate social impact assessment
    // In real implementation, would analyze project's potential social impact
    criteriaScores.socialImpact = 85;
    
    // Simulate technical implementation review
    criteriaScores.technicalImplementation = 80;
    
    // Simulate fraud risk indicators
    // For demo, we'll consider IPFS documentation as a positive sign
    if (projectData.ipfs_hash && projectData.ipfs_hash.length > 10) {
      criteriaScores.fraudRiskIndicators = 95;
    } else {
      criteriaScores.fraudRiskIndicators = 60;
    }
    
    // Calculate weighted average (each criteria has different weight)
    const weights = {
      projectDescription: 0.2,
      organizationCredibility: 0.2,
      financialFeasibility: 0.15,
      socialImpact: 0.2,
      technicalImplementation: 0.15,
      fraudRiskIndicators: 0.1
    };
    
    let weightedScore = 0;
    for (const [criterion, score] of Object.entries(criteriaScores)) {
      weightedScore += score * weights[criterion];
    }
    
    // Round to nearest integer
    const finalScore = Math.round(weightedScore);
    
    // Determine if project is verified (threshold is 70)
    const verified = finalScore >= 70;
    
    // Generate evaluation notes
    let notes = `AI Project Evaluation Results:\n`;
    notes += `- Project Description: ${criteriaScores.projectDescription}/100\n`;
    notes += `- Organization Credibility: ${criteriaScores.organizationCredibility}/100\n`;
    notes += `- Financial Feasibility: ${criteriaScores.financialFeasibility}/100\n`;
    notes += `- Social Impact: ${criteriaScores.socialImpact}/100\n`;
    notes += `- Technical Implementation: ${criteriaScores.technicalImplementation}/100\n`;
    notes += `- Fraud Risk Assessment: ${criteriaScores.fraudRiskIndicators}/100\n`;
    notes += `\nFinal Score: ${finalScore}/100\n`;
    notes += verified ? 
      'RECOMMENDATION: APPROVE - This project meets verification criteria' : 
      'RECOMMENDATION: REJECT - This project does not meet verification criteria';
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Log evaluation in database
    await logAiEvaluation(
      'project',
      projectId,
      projectData,
      { score: finalScore, verified, notes },
      'v1.0',
      processingTime
    );
    
    logger.info(`Project ${projectId} evaluated: score ${finalScore}, verified: ${verified}`);
    
    return {
      score: finalScore,
      verified,
      notes
    };
  } catch (error) {
    logger.error('AI project evaluation error:', error);
    throw new Error(`Failed to evaluate project: ${error.message}`);
  }
};

/**
 * Get project funds
 * @param {number} projectId - Project ID
 * @returns {Promise<number>} - Project funds
 */
const getProjectFunds = async (projectId) => {
  try {
    // Get project wallet address
    const { rows } = await db.query(
      'SELECT wallet_address FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (rows.length === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }
    
    // In a real implementation, we would get the actual wallet balance
    // For now, let's simulate a balance
    return 5;
  } catch (error) {
    logger.error('Error getting project funds:', error);
    throw error;
  }
};

/**
 * Log AI evaluation in database
 * @param {string} entityType - Entity type (e.g., 'proposal', 'project')
 * @param {number} entityId - Entity ID
 * @param {Object} inputData - Input data
 * @param {Object} outputData - Output data
 * @param {string} modelVersion - AI model version
 * @param {number} processingTime - Processing time in milliseconds
 * @returns {Promise<void>}
 */
const logAiEvaluation = async (
  entityType,
  entityId,
  inputData,
  outputData,
  modelVersion,
  processingTime
) => {
  try {
    await db.query(
      `INSERT INTO ai_verification_logs 
       (entity_type, entity_id, input_data, output_data, verification_score, model_version, processing_time, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        entityType,
        entityId,
        JSON.stringify(inputData),
        JSON.stringify(outputData),
        outputData.score,
        modelVersion,
        processingTime
      ]
    );
  } catch (error) {
    logger.error('Error logging AI evaluation:', error);
    // Don't throw here to avoid breaking the main flow
  }
};

module.exports = {
  evaluateProposal,
  evaluateProject
}; 