const app = require('../index');

// This is a serverless function adapter for the health check endpoint
module.exports = (req, res) => {
  // Set the URL to match the Express health check route
  req.url = '/health';
  // Handle the request with the express app
  return app(req, res);
};
