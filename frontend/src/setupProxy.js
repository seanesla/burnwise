const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('🔧 [PROXY] Setting up proxy middleware for /api/* -> http://localhost:5001');
  
  // Proxy API requests to backend
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5001',
    changeOrigin: true,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`🔄 [PROXY] Forwarding ${req.method} ${req.url} -> http://localhost:5001${req.url}`);
    },
    onError: (err, req, res) => {
      console.error(`❌ [PROXY] Error forwarding ${req.url}:`, err.message);
    }
  }));
  
  console.log('✅ [PROXY] Proxy middleware configured');
};