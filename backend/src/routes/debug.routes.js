const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /api/debug/user-charity
 * @desc Get the charity associated with the current user
 * @access Private
 */
router.get('/user-charity', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Debug - Checking charity for user ID:', userId);
    
    // Get the user's profile to see if they have a charity_id
    const userResult = await db.query('SELECT id, charity_id FROM users WHERE id = $1', [userId]);
    
    const userInfo = {
      id: userId,
      charity_id: userResult.rows[0]?.charity_id || null
    };
    
    // Check if the user is a charity admin by looking for charities where admin_id = userId
    const adminResult = await db.query('SELECT id, name FROM charities WHERE admin_id = $1', [userId]);
    
    // Return both the direct charity_id and the admin charity info
    res.json({
      success: true,
      data: {
        user: userInfo,
        is_charity_admin: adminResult.rows.length > 0,
        admin_charities: adminResult.rows
      }
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to check user charity association',
        details: error.message
      }
    });
  }
});

module.exports = router; 