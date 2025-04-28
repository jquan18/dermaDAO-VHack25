const app = require('../../index');

// This is a catch-all handler for companies routes
module.exports = (req, res) => {
  // Get the original path from the request
  const originalPath = req.url;
  // Prepend /api/companies to match the Express route structure
  req.url = `/api/companies${originalPath}`;
  // Handle the request with the express app
  return app(req, res);
};
