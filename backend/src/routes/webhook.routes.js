const express = require('express');
const router = express.Router();
const bankTransferController = require('../controllers/bankTransfer.controller');

/**
 * @route POST /api/webhooks/wise
 * @desc Handle Wise API webhook callbacks
 * @access Public (protected by signature)
 */
router.post(
  '/wise',
  express.json({
    verify: (req, res, buf) => {
      // Store the raw body for signature verification
      req.rawBody = buf.toString();
    }
  }),
  bankTransferController.processWiseWebhook
);

module.exports = router; 