const express = require('express');
const { check } = require('express-validator');
const { 
  register, 
  login, 
  getMe, 
  worldcoinVerify,
  worldcoinCallback,
  getWorldcoinUrl,
  getMyCharity
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register new user
 * @access Public
 */
router.post(
  '/register',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('name', 'Name is required').not().isEmpty(),
    validateRequest
  ],
  register
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
    validateRequest
  ],
  login
);

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route POST /api/auth/worldcoin-verify
 * @desc Initiate Worldcoin verification
 * @access Private
 */
router.post('/worldcoin-verify', authenticate, worldcoinVerify);

/**
 * @route GET /api/auth/worldcoin-url
 * @desc Get Worldcoin authorization URL
 * @access Private
 */
router.get('/worldcoin-url', authenticate, getWorldcoinUrl);

/**
 * @route GET /api/auth/worldcoin-callback
 * @desc Handle Worldcoin OAuth callback
 * @access Public
 */
router.get('/worldcoin-callback', worldcoinCallback);

/**
 * @route POST /api/auth/verify-worldcoin
 * @desc Alias for worldcoin-verify to maintain frontend compatibility
 * @access Private
 */
router.post('/verify-worldcoin', authenticate, worldcoinVerify);

/**
 * @route GET /api/auth/my-charity
 * @desc Get charity linked to current user
 * @access Private
 */
router.get('/my-charity', authenticate, getMyCharity);

module.exports = router; 