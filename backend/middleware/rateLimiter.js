const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Simple rate limiter - removed overengineered circuit breaker and multiple limiters
const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window - was 15 minutes
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
  skip: (req) => req.path === '/health', // Only skip health checks
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
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