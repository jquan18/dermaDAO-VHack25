const app = require('../../index');

// This is a catch-all handler for webhook routes
module.exports = (req, res) => {
  // Get the original path from the request
  const originalPath = req.url;
  // Prepend /api/webhooks to match the Express route structure
  req.url = `/api/webhooks${originalPath}`;
  // Handle the request with the express app
  return app(req, res);
};
