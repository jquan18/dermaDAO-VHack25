// Express API proxy handler for Vercel
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Load environment variables
require('dotenv').config();

// Create express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// Handle all API requests
app.all('/api/*', (req, res) => {
  res.json({
    message: 'API endpoint under construction',
    path: req.path,
    method: req.method
  });
});

// Export the serverless function
module.exports = (req, res) => {
  // Handle the request with the express app
  return app(req, res);
};
