const app = require('../../index');

// This is a catch-all handler for pools routes
module.exports = (req, res) => {
  // Get the original path from the request
  const originalPath = req.url;
  // Prepend /api/pools to match the Express route structure
  req.url = `/api/pools${originalPath}`;
  // Handle the request with the express app
  return app(req, res);
};
