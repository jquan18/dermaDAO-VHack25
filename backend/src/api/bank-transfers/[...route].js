const app = require('../../index');

// This is a catch-all handler for bank-transfers routes
module.exports = (req, res) => {
  // Get the original path from the request
  const originalPath = req.url;
  // Prepend /api/bank-transfers to match the Express route structure
  req.url = `/api/bank-transfers${originalPath}`;
  // Handle the request with the express app
  return app(req, res);
};
