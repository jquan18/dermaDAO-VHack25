const logger = require('../config/logger');
const db = require('../config/database');
const axios = require('axios');

// Get Gemini API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Call Gemini API for content generation
 * @param {string} prompt - Text prompt for the AI
 * @returns {Promise<string>} - AI response
 */
const callGeminiApi = async (prompt) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the text from the response
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      return response.data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Unexpected response format from Gemini API');
  } catch (error) {
    logger.error(`Gemini API error: ${error.message}`);
    if (error.response) {
      logger.error(`Gemini API error details: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to call Gemini API: ${error.message}`);
  }
};

/**
 * Parse AI response to extract scores
 * @param {string} aiResponse - AI response text
 * @param {Array<string>} criteriaNames - List of criteria names to extract
 * @returns {Object} - Object with criteria scores
 */
const parseAiScores = (aiResponse, criteriaNames) => {
  const scores = {};
  
  // Initialize with default scores
  criteriaNames.forEach(criterion => {
    scores[criterion] = 70; // Default middle score
  });
  
  try {
    // Look for scores in the format "CriteriaName: XX/100" or similar patterns
    criteriaNames.forEach(criterion => {
      // Create regex pattern based on criterion name, allowing for different formatting
      const pattern = new RegExp(`${criterion}[:\\s]+(\\d+)\\s*\\/\\s*100`, 'i');
      const match = aiResponse.match(pattern);
      if (match && match[1]) {
        const score = parseInt(match[1], 10);
        if (!isNaN(score) && score >= 0 && score <= 100) {
          scores[criterion] = score;
        }
      }
    });
    
    // Look for overall recommendation
    if (aiResponse.toLowerCase().includes('approve') || 
        aiResponse.toLowerCase().includes('recommended') ||
        aiResponse.toLowerCase().includes('pass')) {
      scores.overallRecommendation = 'APPROVE';
    } else if (aiResponse.toLowerCase().includes('reject') || 
               aiResponse.toLowerCase().includes('not recommended') ||
               aiResponse.toLowerCase().includes('fail')) {
      scores.overallRecommendation = 'REJECT';
    } else {
      scores.overallRecommendation = 'NEUTRAL';
    }
  } catch (error) {
    logger.error(`Error parsing AI scores: ${error.message}`);
  }
  
  return scores;
};

/**
 * Evaluate a proposal using AI
 * @param {number} proposalId - Proposal ID
 * @param {Object} proposalData - Proposal data
 * @returns {Promise<{score: number, verified: boolean, notes: string}>} - Evaluation results
 */
const evaluateProposal = async (proposalId, proposalData) => {
  try {
    logger.info(`Evaluating proposal ${proposalId} with Gemini AI`);
    
    // Record the start time for processing time calculation
    const startTime = Date.now();
    
    // Get project funds for context
    const projectFunds = await getProjectFunds(proposalData.project_id);
    
    // Define criteria names
    const criteriaNames = [
      'evidenceQuality',
      'milestoneAlignment',
      'budgetReasonability',
      'implementationFeasibility',
      'fraudRiskIndicators'
    ];
    
    // Create prompt for AI evaluation
    const prompt = `
You are a senior grant reviewer and a compliance officer for charity proposals. Evaluate the following proposal on a scale of 0-100 for each criterion.
Format your response with a score for each criterion, followed by a brief explanation.

PROPOSAL DETAILS:
- ID: ${proposalId}
- Project: ${proposalData.project_name || 'Unknown'}
- Description: ${proposalData.description || 'No description provided'}
- Amount Requested (ETH): ${proposalData.amount || 'Unknown'}
- Evidence IPFS Hash: ${proposalData.evidence_ipfs_hash || 'No evidence provided'}
- Project Funds Available(ETH): ${projectFunds}

EVALUATION CRITERIA:
1. evidenceQuality (0-100): Assess the quality and completeness of the evidence provided.
2. milestoneAlignment (0-100): Evaluate how well the proposal aligns with the project milestone.
3. budgetReasonability (0-100): Determine if the requested amount is reasonable given the project scope and available funds.
4. implementationFeasibility (0-100): Assess how feasible the implementation plan is.
5. fraudRiskIndicators (0-100): Identify any potential fraud risks (higher score means lower risk).

For each criterion, provide a score out of 100 and a brief justification.
End with an overall recommendation: APPROVE or REJECT, and a brief summary of your reasoning.
`;

    // Call Gemini API
    const aiResponse = await callGeminiApi(prompt);
    
    // Parse the response to extract scores
    const aiScores = parseAiScores(aiResponse, criteriaNames);
    
    // Calculate weighted average using the same weights as before
    const weights = {
      evidenceQuality: 0.3,
      milestoneAlignment: 0.2,
      budgetReasonability: 0.25,
      implementationFeasibility: 0.15,
      fraudRiskIndicators: 0.1
    };
    
    let weightedScore = 0;
    for (const [criterion, weight] of Object.entries(weights)) {
      weightedScore += (aiScores[criterion] || 70) * weight;
    }
    
    // Round to nearest integer
    const finalScore = Math.round(weightedScore);
    
    // Determine if proposal is verified (threshold is 70)
    // Also consider explicit AI recommendation if available
    let verified = finalScore >= 70;
    if (aiScores.overallRecommendation === 'APPROVE') {
      verified = true;
    } else if (aiScores.overallRecommendation === 'REJECT') {
      verified = false;
    }
    
    // Use AI response as notes, but format it nicely
    const notes = aiResponse.trim();
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Log evaluation in database
    await logAiEvaluation(
      'proposal',
      proposalId,
      proposalData,
      { score: finalScore, verified, notes },
      'gemini-2.0-flash',
      processingTime
    );
    
    logger.info(`Proposal ${proposalId} evaluated with Gemini: score ${finalScore}, verified: ${verified}`);
    
    return {
      score: finalScore,
      verified,
      notes
    };
  } catch (error) {
    logger.error('Gemini AI evaluation error:', error);
    
    // Fallback to simulated evaluation if API fails
    logger.info(`Falling back to simulated evaluation for proposal ${proposalId}`);
    return simulateProposalEvaluation(proposalId, proposalData);
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
    logger.info(`Evaluating project ${projectId} with Gemini AI`);
    
    // Record the start time for processing time calculation
    const startTime = Date.now();
    
    // Define criteria names
    const criteriaNames = [
      'projectDescription',
      'organizationCredibility',
      'financialFeasibility',
      'socialImpact',
      'technicalImplementation',
      'fraudRiskIndicators'
    ];
    
    // Create prompt for AI evaluation
    const prompt = `
You are a charitable project evaluator. Evaluate the following project on a scale of 0-100 for each criterion.
Format your response with a score for each criterion, followed by a brief explanation.

PROJECT DETAILS:
- ID: ${projectId}
- Name: ${projectData.name || 'Unnamed project'}
- Description: ${projectData.description || 'No description provided'}
- Funding Goal: ${projectData.funding_goal || 'Unknown'}
- Organization: ${projectData.organization_name || 'Unknown'}
- IPFS Hash: ${projectData.ipfs_hash || 'No documentation provided'}

EVALUATION CRITERIA:
1. projectDescription (0-100): Assess the quality and completeness of the project description.
2. organizationCredibility (0-100): Evaluate the credibility of the organization behind the project.
3. financialFeasibility (0-100): Determine if the funding goal is reasonable and achievable.
4. socialImpact (0-100): Assess the potential social impact of the project.
5. technicalImplementation (0-100): Evaluate the technical implementation plan.
6. fraudRiskIndicators (0-100): Identify any potential fraud risks (higher score means lower risk).

For each criterion, provide a score out of 100 and a brief justification.
End with an overall recommendation: APPROVE or REJECT, and a brief summary of your reasoning.
`;

    // Call Gemini API
    const aiResponse = await callGeminiApi(prompt);
    
    // Parse the response to extract scores
    const aiScores = parseAiScores(aiResponse, criteriaNames);
    
    // Calculate weighted average using the same weights as before
    const weights = {
      projectDescription: 0.2,
      organizationCredibility: 0.2,
      financialFeasibility: 0.15,
      socialImpact: 0.2,
      technicalImplementation: 0.15,
      fraudRiskIndicators: 0.1
    };
    
    let weightedScore = 0;
    for (const [criterion, weight] of Object.entries(weights)) {
      weightedScore += (aiScores[criterion] || 70) * weight;
    }
    
    // Round to nearest integer
    const finalScore = Math.round(weightedScore);
    
    // Determine if project is verified (threshold is 70)
    // Also consider explicit AI recommendation if available
    let verified = finalScore >= 70;
    if (aiScores.overallRecommendation === 'APPROVE') {
      verified = true;
    } else if (aiScores.overallRecommendation === 'REJECT') {
      verified = false;
    }
    
    // Use AI response as notes, but format it nicely
    const notes = aiResponse.trim();
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Log evaluation in database
    await logAiEvaluation(
      'project',
      projectId,
      projectData,
      { score: finalScore, verified, notes },
      'gemini-2.0-flash',
      processingTime
    );
    
    logger.info(`Project ${projectId} evaluated with Gemini: score ${finalScore}, verified: ${verified}`);
    
    return {
      score: finalScore,
      verified,
      notes
    };
  } catch (error) {
    logger.error('Gemini AI evaluation error:', error);
    
    // Fallback to simulated evaluation if API fails
    logger.info(`Falling back to simulated evaluation for project ${projectId}`);
    return simulateProjectEvaluation(projectId, projectData);
  }
};

/**
 * Fallback simulated evaluation for proposals when API fails
 * @param {number} proposalId - Proposal ID
 * @param {Object} proposalData - Proposal data 
 * @returns {Promise<{score: number, verified: boolean, notes: string}>}
 */
const simulateProposalEvaluation = async (proposalId, proposalData) => {
  try {
    logger.info(`Using simulated evaluation for proposal ${proposalId}`);
    
    // Example evaluation criteria
    const criteriaScores = {
      evidenceQuality: 0,
      milestoneAlignment: 0,
      budgetReasonability: 0,
      implementationFeasibility: 0,
      fraudRiskIndicators: 0
    };
    
    // Simulate evidence quality scoring
    if (proposalData.evidence_ipfs_hash && proposalData.evidence_ipfs_hash.length > 10) {
      criteriaScores.evidenceQuality = 95;
    } else {
      criteriaScores.evidenceQuality = 30;
    }
    
    // Simulate milestone alignment
    if (proposalData.milestone_id) {
      criteriaScores.milestoneAlignment = 90;
    } else {
      criteriaScores.milestoneAlignment = 50;
    }
    
    // Simulate budget reasonability
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
    
    // Simulate fraud risk indicators
    if (proposalData.description && proposalData.description.length > 50) {
      criteriaScores.fraudRiskIndicators = 90;
    } else {
      criteriaScores.fraudRiskIndicators = 40;
    }
    
    // Calculate weighted average
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
    let notes = `AI Evaluation Results (Simulated):\n`;
    notes += `- Evidence Quality: ${criteriaScores.evidenceQuality}/100\n`;
    notes += `- Milestone Alignment: ${criteriaScores.milestoneAlignment}/100\n`;
    notes += `- Budget Reasonability: ${criteriaScores.budgetReasonability}/100\n`;
    notes += `- Implementation Feasibility: ${criteriaScores.implementationFeasibility}/100\n`;
    notes += `- Fraud Risk Assessment: ${criteriaScores.fraudRiskIndicators}/100\n`;
    notes += `\nFinal Score: ${finalScore}/100\n`;
    notes += verified ? 
      'RECOMMENDATION: APPROVE - This proposal meets verification criteria (Simulated)' : 
      'RECOMMENDATION: REJECT - This proposal does not meet verification criteria (Simulated)';
    
    return {
      score: finalScore,
      verified,
      notes
    };
  } catch (error) {
    logger.error('Simulated evaluation error:', error);
    throw new Error(`Failed to evaluate proposal: ${error.message}`);
  }
};

/**
 * Fallback simulated evaluation for projects when API fails
 * @param {number} projectId - Project ID
 * @param {Object} projectData - Project data
 * @returns {Promise<{score: number, verified: boolean, notes: string}>}
 */
const simulateProjectEvaluation = async (projectId, projectData) => {
  try {
    logger.info(`Using simulated evaluation for project ${projectId}`);
    
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
    criteriaScores.socialImpact = 85;
    
    // Simulate technical implementation review
    criteriaScores.technicalImplementation = 80;
    
    // Simulate fraud risk indicators
    if (projectData.ipfs_hash && projectData.ipfs_hash.length > 10) {
      criteriaScores.fraudRiskIndicators = 95;
    } else {
      criteriaScores.fraudRiskIndicators = 60;
    }
    
    // Calculate weighted average
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
    let notes = `AI Project Evaluation Results (Simulated):\n`;
    notes += `- Project Description: ${criteriaScores.projectDescription}/100\n`;
    notes += `- Organization Credibility: ${criteriaScores.organizationCredibility}/100\n`;
    notes += `- Financial Feasibility: ${criteriaScores.financialFeasibility}/100\n`;
    notes += `- Social Impact: ${criteriaScores.socialImpact}/100\n`;
    notes += `- Technical Implementation: ${criteriaScores.technicalImplementation}/100\n`;
    notes += `- Fraud Risk Assessment: ${criteriaScores.fraudRiskIndicators}/100\n`;
    notes += `\nFinal Score: ${finalScore}/100\n`;
    notes += verified ? 
      'RECOMMENDATION: APPROVE - This project meets verification criteria (Simulated)' : 
      'RECOMMENDATION: REJECT - This project does not meet verification criteria (Simulated)';
    
    return {
      score: finalScore,
      verified,
      notes
    };
  } catch (error) {
    logger.error('Simulated project evaluation error:', error);
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