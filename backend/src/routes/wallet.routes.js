const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validator');
const { authenticate } = require('../middleware/auth');

// Import controllers
const walletController = require('../controllers/wallet.controller');

// Validation middleware
const walletValidation = [
  body('address').notEmpty().withMessage('Wallet address is required'),
  validateRequest
];

// Routes
router.get('/balance', authenticate, walletController.getWalletBalance);
router.get('/transactions', authenticate, walletController.getWalletTransactions);
router.get('/scrollscan-data', walletController.getWalletDataFromScrollScan);
router.post('/connect', authenticate, walletValidation, walletController.connectWallet);
router.post('/disconnect', authenticate, walletController.disconnectWallet);
router.post('/transak-webhook', walletController.handleTransakWebhook);
router.post('/transak-transaction', authenticate, walletController.recordTransakTransaction);

module.exports = router; 