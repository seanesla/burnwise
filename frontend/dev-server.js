const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:5001',
  changeOrigin: true,
}));

// Serve static files from build directory
app.use(express.static(path.join(__dirname, 'build')));

// CRITICAL: For React Router - ALL routes must serve the React app
// This is NOT a fallback - it's the ONLY way SPAs work
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`All routes will be handled by React Router`);
});