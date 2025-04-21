const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Import configuration
const logger = require('./config/logger');
const db = require('./config/database');
const blockchain = require('./services/blockchain.service');

// Import middleware
const { notFound, errorHandler } = require('./middleware/error');

// Create express app
const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging with Morgan
if (process.env.NODE_ENV === 'production') {
  // In production, log to file
  const accessLogStream = fs.createWriteStream(
    path.join(__dirname, '../logs/access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  // In development, log to console
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});
app.use(limiter);

// API routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/charities', require('./routes/charity.routes'));
app.use('/api/projects', require('./routes/project.routes'));
app.use('/api/donations', require('./routes/donation.routes'));
app.use('/api/proposals', require('./routes/proposal.routes'));
app.use('/api/bank-accounts', require('./routes/bankAccount.routes'));
app.use('/api/bank-transfers', require('./routes/bankTransfer.routes'));
app.use('/api/quadratic', require('./routes/quadratic.routes'));
app.use('/api/pools', require('./routes/pool.routes'));
app.use('/api/wallet', require('./routes/wallet.routes'));
app.use('/api/debug', require('./routes/debug.routes'));
app.use('/api/companies', require('./routes/company.routes'));

// Webhook routes
app.use('/api/webhooks', require('./routes/webhook.routes'));

// API docs route (if needed)
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../api-docs.md'));
});

// Health check route
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.testConnection();
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Health check failed',
        code: 'SERVER_ERROR'
      }
    });
  }
});

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8000;

// Initialize blockchain connection
blockchain.initializeBlockchain().catch(err => {
  logger.error(`Failed to initialize blockchain services: ${err.message}`);
  logger.info('Server will continue with limited blockchain functionality');
});

app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION:', err);
  process.exit(1);
}); 