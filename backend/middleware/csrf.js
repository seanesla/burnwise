/**
 * Custom CSRF Protection Middleware
 * Double Submit Cookie Pattern Implementation
 * SECURITY: Prevents Cross-Site Request Forgery attacks
 */

const crypto = require('crypto');
const logger = require('./logger');

// Store CSRF tokens with expiration (in production, use Redis)
const csrfTokenStore = new Map();

/**
 * Generate CSRF token
 */
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Set CSRF token cookie and header
 */
const setCSRFToken = (req, res, next) => {
  // Skip for GET requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  // Generate new token for each session
  if (!req.cookies.csrf_token || !csrfTokenStore.has(req.cookies.csrf_token)) {
    const token = generateCSRFToken();
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set cookie with token
    res.cookie('csrf_token', token, {
      httpOnly: false, // Must be readable by JavaScript for double-submit
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000 // 1 hour
    });
    
    // Store token with expiration
    csrfTokenStore.set(token, {
      created: Date.now(),
      ip: req.ip
    });
    
    // Clean old tokens
    cleanExpiredTokens();
    
    req.csrfToken = token;
    logger.debug('CSRF token generated', { ip: req.ip });
  } else {
    req.csrfToken = req.cookies.csrf_token;
  }
  
  next();
};

/**
 * Verify CSRF token
 */
const verifyCSRFToken = (req, res, next) => {
  // Skip for safe methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  // Skip for API endpoints that use JWT authentication only
  if (req.path.startsWith('/api/auth/login') || 
      req.path.startsWith('/api/auth/register') ||
      req.path.startsWith('/api/auth/demo-status')) {
    return next();
  }
  
  // Get token from cookie
  const cookieToken = req.cookies.csrf_token;
  
  // Get token from header or body
  const headerToken = req.headers['x-csrf-token'] || 
                     req.headers['x-xsrf-token'] ||
                     req.body._csrf;
  
  // Verify tokens match
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.security('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      match: cookieToken === headerToken
    });
    
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid or missing CSRF token',
      timestamp: new Date().toISOString()
    });
  }
  
  // Verify token exists in store
  const tokenData = csrfTokenStore.get(cookieToken);
  if (!tokenData) {
    logger.security('CSRF token not found in store', {
      ip: req.ip,
      path: req.path
    });
    
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'CSRF token expired or invalid',
      timestamp: new Date().toISOString()
    });
  }
  
  // Check token age (1 hour max)
  const tokenAge = Date.now() - tokenData.created;
  if (tokenAge > 60 * 60 * 1000) {
    csrfTokenStore.delete(cookieToken);
    
    logger.security('CSRF token expired', {
      ip: req.ip,
      path: req.path,
      tokenAge: tokenAge
    });
    
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'CSRF token has expired',
      timestamp: new Date().toISOString()
    });
  }
  
  logger.debug('CSRF token validated', {
    ip: req.ip,
    path: req.path
  });
  
  next();
};

/**
 * Clean expired tokens from store
 */
const cleanExpiredTokens = () => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  for (const [token, data] of csrfTokenStore.entries()) {
    if (now - data.created > maxAge) {
      csrfTokenStore.delete(token);
    }
  }
};

/**
 * Get current CSRF token for response
 */
const getCSRFToken = (req, res) => {
  const token = req.csrfToken || generateCSRFToken();
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Set cookie if not exists
  if (!req.cookies.csrf_token) {
    res.cookie('csrf_token', token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000
    });
    
    csrfTokenStore.set(token, {
      created: Date.now(),
      ip: req.ip
    });
  }
  
  res.json({
    csrfToken: token,
    timestamp: new Date().toISOString()
  });
};

// Clean expired tokens every 10 minutes
setInterval(cleanExpiredTokens, 10 * 60 * 1000);

module.exports = {
  generateCSRFToken,
  setCSRFToken,
  verifyCSRFToken,
  getCSRFToken
};