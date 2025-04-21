/**
 * Migration to add donor voting functionality
 * This adds the required_approvals and current_approvals columns to the proposals table
 * and creates the donor_votes table
 */
module.exports = {
  async up(db) {
    // Add columns to proposals table
    await db.query(`
      ALTER TABLE proposals 
      ADD COLUMN IF NOT EXISTS required_approvals INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS current_approvals INTEGER DEFAULT 0
    `);
    
    // Create donor_votes table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS donor_votes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        proposal_id INTEGER REFERENCES proposals(id),
        vote BOOLEAN NOT NULL,
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, proposal_id)
      )
    `);
    
    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_donor_votes_proposal_id ON donor_votes(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_donor_votes_user_id ON donor_votes(user_id);
      CREATE INDEX IF NOT EXISTS idx_donor_votes_vote ON donor_votes(vote);
    `);
    
    // Update existing proposals to use the new status
    await db.query(`
      UPDATE proposals 
      SET status = 'pending_donor_approval' 
      WHERE status = 'pending_verification'
    `);
  },
  
  async down(db) {
    // Drop the indexes first
    await db.query(`
      DROP INDEX IF EXISTS idx_donor_votes_proposal_id;
      DROP INDEX IF EXISTS idx_donor_votes_user_id;
      DROP INDEX IF EXISTS idx_donor_votes_vote;
    `);
    
    // Drop the donor_votes table
    await db.query(`
      DROP TABLE IF EXISTS donor_votes
    `);
    
    // Remove columns from proposals table
    await db.query(`
      ALTER TABLE proposals 
      DROP COLUMN IF EXISTS required_approvals,
      DROP COLUMN IF EXISTS current_approvals
    `);
    
    // Revert status changes
    await db.query(`
      UPDATE proposals 
      SET status = 'pending_verification' 
      WHERE status = 'pending_donor_approval'
    `);
  }
}; 