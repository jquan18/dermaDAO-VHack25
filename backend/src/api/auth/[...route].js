const app = require('../../index');
const url = require('url');

// This is a catch-all handler for auth routes
module.exports = (req, res) => {
  // Get the original path from the request
  const originalPath = req.url;
  // Prepend /api/auth to match the Express route structure
  req.url = `/api/auth${originalPath}`;
  // Handle the request with the express app
  return app(req, res);
};
