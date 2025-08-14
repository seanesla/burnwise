/**
 * Authentication Rate Limiter
 * Aggressive rate limiting for auth endpoints
 * SECURITY: Prevents brute force attacks
 */

const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Track failed login attempts per IP
const failedAttempts = new Map();

/**
 * Login rate limiter - 5 attempts per 15 minutes
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many login attempts',
    message: 'Please try again in 15 minutes',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
      attempts: failedAttempts.get(req.ip) || 0
    });
    
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Account temporarily locked. Please try again in 15 minutes.',
      retryAfter: 15 * 60,
      timestamp: new Date().toISOString()
    });
  },
  skip: (req) => {
    // Skip rate limiting for successful logins
    return req.user !== undefined;
  },
  keyGenerator: (req) => {
    // Rate limit by IP + email combination
    return `${req.ip}:${req.body.email || 'unknown'}`;
  }
});

/**
 * Registration rate limiter - 3 accounts per hour per IP
 */
const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  message: {
    error: 'Too many registration attempts',
    message: 'Please try again later',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Registration rate limit exceeded', {
      ip: req.ip,
      email: req.body.email
    });
    
    res.status(429).json({
      error: 'Registration limit exceeded',
      message: 'Too many accounts created from this IP. Please try again in 1 hour.',
      retryAfter: 60 * 60,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Password reset rate limiter - 3 attempts per hour
 */
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset attempts per hour
  message: {
    error: 'Too many password reset attempts',
    message: 'Please try again later',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Track failed login attempts for account lockout
 */
const trackFailedLogin = (req) => {
  const key = `${req.ip}:${req.body.email}`;
  const attempts = failedAttempts.get(key) || 0;
  failedAttempts.set(key, attempts + 1);
  
  // Clear after 15 minutes
  setTimeout(() => {
    failedAttempts.delete(key);
  }, 15 * 60 * 1000);
  
  logger.security('Failed login attempt tracked', {
    ip: req.ip,
    email: req.body.email,
    attempts: attempts + 1
  });
  
  return attempts + 1;
};

/**
 * Clear failed attempts on successful login
 */
const clearFailedAttempts = (req) => {
  const key = `${req.ip}:${req.body.email}`;
  failedAttempts.delete(key);
  
  logger.info('Failed attempts cleared after successful login', {
    ip: req.ip,
    email: req.body.email
  });
};

/**
 * Check if account is locked due to too many failed attempts
 */
const isAccountLocked = (req) => {
  const key = `${req.ip}:${req.body.email}`;
  const attempts = failedAttempts.get(key) || 0;
  return attempts >= 5;
};

/**
 * General API rate limiter - 100 requests per minute
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Please slow down your requests',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Clean up old failed attempts every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of failedAttempts.entries()) {
    // Remove entries older than 1 hour
    if (typeof data === 'object' && data.timestamp && now - data.timestamp > 60 * 60 * 1000) {
      failedAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000);

module.exports = {
  loginRateLimiter,
  registrationRateLimiter,
  passwordResetRateLimiter,
  apiRateLimiter,
  trackFailedLogin,
  clearFailedAttempts,
  isAccountLocked
};