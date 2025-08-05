const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Circuit breaker for rate limiting
class RateLimitCircuitBreaker {
  constructor() {
    this.isOpen = false;
    this.failureCount = 0;
    this.threshold = 10;
    this.timeout = 60000; // 1 minute
    this.lastFailureTime = null;
  }

  canProceed() {
    if (!this.isOpen) return true;
    
    if (Date.now() - this.lastFailureTime > this.timeout) {
      this.reset();
      return true;
    }
    
    return false;
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.isOpen = true;
      logger.security('Rate limit circuit breaker opened', {
        failureCount: this.failureCount,
        threshold: this.threshold
      });
    }
  }

  reset() {
    this.isOpen = false;
    this.failureCount = 0;
    this.lastFailureTime = null;
    logger.info('Rate limit circuit breaker reset');
  }
}

const circuitBreaker = new RateLimitCircuitBreaker();

// Custom key generator for more sophisticated rate limiting
const keyGenerator = (req) => {
  // Combine IP, user agent, and endpoint for more granular limiting
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'unknown';
  const endpoint = req.route ? req.route.path : req.path;
  
  return `${ip}:${Buffer.from(userAgent).toString('base64').substring(0, 10)}:${endpoint}`;
};

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each key to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  handler: (req, res, next, options) => {
    const key = keyGenerator(req);
    logger.security('Rate limit exceeded', {
      key,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    circuitBreaker.recordFailure();
    
    res.status(options.statusCode).json(options.message);
  }
});

// Strict rate limiter for expensive operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit to 10 requests per windowMs for expensive operations
  message: {
    error: 'Rate limit exceeded for expensive operations',
    message: 'This endpoint has strict rate limiting. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next, options) => {
    const key = keyGenerator(req);
    logger.security('Strict rate limit exceeded', {
      key,
      ip: req.ip,
      path: req.path,
      method: req.method,
      limitType: 'strict'
    });
    
    res.status(options.statusCode).json(options.message);
  }
});

// Vector search rate limiter (very expensive operations)
const vectorSearchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit vector searches to 50 per hour
  message: {
    error: 'Vector search rate limit exceeded',
    message: 'Vector search operations are limited. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next, options) => {
    logger.security('Vector search rate limit exceeded', {
      key: keyGenerator(req),
      ip: req.ip,
      path: req.path
    });
    
    res.status(options.statusCode).json(options.message);
  }
});

// API key rate limiter for authenticated requests
const apiKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for authenticated requests
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  message: {
    error: 'API key rate limit exceeded',
    message: 'API key rate limit exceeded. Contact support for higher limits.',
    retryAfter: '15 minutes'
  }
});

// Middleware to check circuit breaker
const circuitBreakerMiddleware = (req, res, next) => {
  if (!circuitBreaker.canProceed()) {
    logger.security('Request blocked by circuit breaker', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Rate limiting circuit breaker is open. Please try again later.',
      retryAfter: '1 minute'
    });
  }
  
  next();
};

// Apply appropriate rate limiter based on endpoint
const smartRateLimiter = (req, res, next) => {
  const path = req.path;
  
  // Vector search endpoints get strictest limiting
  if (path.includes('/vector-search') || path.includes('/similarity')) {
    return vectorSearchLimiter(req, res, next);
  }
  
  // Expensive operations get strict limiting
  if (path.includes('/schedule/optimize') || 
      path.includes('/weather/analyze') || 
      path.includes('/predictions/calculate')) {
    return strictLimiter(req, res, next);
  }
  
  // API key authenticated requests get higher limits
  if (req.headers['x-api-key']) {
    return apiKeyLimiter(req, res, next);
  }
  
  // Default general rate limiting
  return generalLimiter(req, res, next);
};

module.exports = [circuitBreakerMiddleware, smartRateLimiter];