const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

module.exports = function(app) {
  // Proxy API requests to backend
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5001',
    changeOrigin: true,
  }));
  
  // Handle client-side routes by serving index.html
  // This is REQUIRED for React Router to work - NOT a fallback
  app.get('/*', function(req, res, next) {
    // Skip if this is a static file request
    if (req.path.includes('.')) {
      return next();
    }
    
    // Skip if this is an API request
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    // For all other routes, serve the React app
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
};