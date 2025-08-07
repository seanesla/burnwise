const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Simple rate limiter - removed overengineered circuit breaker and multiple limiters
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 100 to prevent false positives
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
  skip: (req) => req.path === '/health',
  handler: (req, res, next, options) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(options.statusCode).json(options.message);
  }
});

module.exports = rateLimiter;