const logger = require('./logger');

// Custom error classes
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.field = field;
  }
}

class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
  }
}

class ExternalServiceError extends Error {
  constructor(service, message, statusCode = 503) {
    super(`${service}: ${message}`);
    this.name = 'ExternalServiceError';
    this.service = service;
    this.statusCode = statusCode;
  }
}

class AgentError extends Error {
  constructor(agentName, phase, message, originalError = null) {
    super(`Agent ${agentName} (${phase}): ${message}`);
    this.name = 'AgentError';
    this.agentName = agentName;
    this.phase = phase;
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

class VectorOperationError extends Error {
  constructor(operation, message, originalError = null) {
    super(`Vector operation ${operation}: ${message}`);
    this.name = 'VectorOperationError';
    this.operation = operation;
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Log the error with context
  const errorContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString(),
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack
  };

  // Log based on error severity
  if (err.statusCode >= 500) {
    logger.error('Server error occurred', errorContext);
  } else if (err.statusCode >= 400) {
    logger.warn('Client error occurred', errorContext);
  } else {
    logger.info('Request processing error', errorContext);
  }

  // Handle specific error types
  let statusCode = err.statusCode || 500;
  let message = err.message;
  let errorResponse = {
    error: err.name || 'Internal Server Error',
    message: message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  // Add specific error details based on error type
  switch (err.name) {
    case 'ValidationError':
      errorResponse.field = err.field;
      if (err.details) {
        errorResponse.details = err.details;
      }
      break;

    case 'DatabaseError':
      if (process.env.NODE_ENV !== 'production') {
        errorResponse.originalMessage = err.originalError?.message;
      }
      // Don't expose database details in production
      if (process.env.NODE_ENV === 'production') {
        errorResponse.message = 'Database operation failed';
      }
      break;

    case 'AgentError':
      errorResponse.agent = err.agentName;
      errorResponse.phase = err.phase;
      if (process.env.NODE_ENV !== 'production' && err.originalError) {
        errorResponse.originalError = err.originalError.message;
      }
      break;

    case 'VectorOperationError':
      errorResponse.operation = err.operation;
      if (process.env.NODE_ENV !== 'production' && err.originalError) {
        errorResponse.originalError = err.originalError.message;
      }
      break;

    case 'ExternalServiceError':
      errorResponse.service = err.service;
      errorResponse.retryAfter = '60 seconds';
      break;

    case 'RateLimitError':
      errorResponse.retryAfter = '15 minutes';
      break;

    case 'CastError':
    case 'ObjectParameterError':
      statusCode = 400;
      errorResponse.error = 'Invalid Parameter';
      errorResponse.message = 'Invalid parameter format';
      break;

    case 'MongoError':
    case 'MongooseError':
      statusCode = 500;
      if (process.env.NODE_ENV === 'production') {
        errorResponse.message = 'Database operation failed';
      }
      break;

    case 'JsonWebTokenError':
    case 'TokenExpiredError':
      statusCode = 401;
      errorResponse.error = 'Authentication Error';
      errorResponse.message = 'Invalid or expired token';
      break;

    case 'MulterError':
      statusCode = 400;
      errorResponse.error = 'File Upload Error';
      if (err.code === 'LIMIT_FILE_SIZE') {
        errorResponse.message = 'File too large';
      }
      break;

    default:
      // Handle unknown errors
      if (process.env.NODE_ENV === 'production') {
        errorResponse.message = 'Internal server error';
        // Don't expose error details in production
        delete errorResponse.stack;
      }
      break;
  }

  // Add error ID for tracking
  errorResponse.errorId = require('crypto').randomBytes(8).toString('hex');

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  // Security headers for error responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  error.name = 'NotFoundError';
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handlers for uncaught exceptions
const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setupGlobalErrorHandlers,
  // Export custom error classes
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ExternalServiceError,
  AgentError,
  VectorOperationError
};