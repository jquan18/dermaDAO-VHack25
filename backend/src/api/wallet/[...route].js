const app = require('../../index');

// This is a catch-all handler for wallet routes
module.exports = (req, res) => {
  // Get the original path from the request
  const originalPath = req.url;
  // Prepend /api/wallet to match the Express route structure
  req.url = `/api/wallet${originalPath}`;
  // Handle the request with the express app
  return app(req, res);
};
