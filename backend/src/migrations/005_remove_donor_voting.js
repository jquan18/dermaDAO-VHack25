/**
 * Migration to remove donor voting functionality and switch to AI verification
 * This updates existing 'pending_donor_approval' proposals to 'pending_verification'
 * and sets required_approvals and current_approvals to 0
 */
module.exports = {
  async up(db) {
    try {
      // Update existing proposals to use the new status
      await db.query(`
        UPDATE proposals 
        SET status = 'pending_verification' 
        WHERE status = 'pending_donor_approval'
      `);

      // Set all required_approvals and current_approvals to 0
      await db.query(`
        UPDATE proposals
        SET required_approvals = 0, current_approvals = 0
      `);

      // We're keeping the donor_votes table for historical record, but we could drop it if needed
      // For now, just leave it in place but it won't be used anymore

      console.log('Successfully migrated from donor voting to AI verification');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },
  
  async down(db) {
    try {
      // Revert proposal status changes
      await db.query(`
        UPDATE proposals 
        SET status = 'pending_donor_approval' 
        WHERE status = 'pending_verification'
      `);

      // We can't recover the previous required_approvals and current_approvals values
      // so we'll have to leave those fields as they are

      console.log('Successfully reverted from AI verification to donor voting');
    } catch (error) {
      console.error('Error in migration rollback:', error);
      throw error;
    }
  }
}; 