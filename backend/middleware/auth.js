/**
 * JWT Authentication Middleware
 * Real implementation - NO MOCKS
 */

const jwt = require('jsonwebtoken');
const logger = require('./logger');

// Get JWT secret from environment or use a secure default for development
const JWT_SECRET = process.env.JWT_SECRET || 'burnwise-jwt-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'burnwise-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'burnwise-client';

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.security('Authentication failed - No token provided', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token provided',
        timestamp: new Date().toISOString()
      });
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256']
    }, (err, decoded) => {
      if (err) {
        logger.security('Authentication failed - Invalid token', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          error: err.message
        });
        
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'Token expired',
            message: 'Authentication token has expired',
            timestamp: new Date().toISOString()
          });
        }
        
        return res.status(403).json({
          error: 'Invalid token',
          message: 'Authentication token is invalid',
          timestamp: new Date().toISOString()
        });
      }

      // Attach user info to request
      req.user = decoded;
      logger.info('Authentication successful', {
        userId: decoded.userId,
        farmId: decoded.farmId,
        path: req.path
      });
      
      next();
    });
  } catch (error) {
    logger.error('Authentication middleware error', { error: error.message });
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional authentication - allows both authenticated and unauthenticated requests
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without authentication
    req.user = null;
    return next();
  }

  // Try to verify token, but don't fail if invalid
  jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ['HS256']
  }, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
};

/**
 * Require specific role for access
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be authenticated to access this resource',
        timestamp: new Date().toISOString()
      });
    }

    if (!req.user.roles || !req.user.roles.includes(role)) {
      logger.security('Authorization failed - Insufficient role', {
        userId: req.user.userId,
        requiredRole: role,
        userRoles: req.user.roles,
        path: req.path
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This resource requires ${role} role`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * Require farm ownership for access
 */
const requireFarmOwnership = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be authenticated to access this resource',
      timestamp: new Date().toISOString()
    });
  }

  const farmId = req.params.farmId || req.params.farm_id || req.body.farm_id;
  
  if (!farmId) {
    return res.status(400).json({
      error: 'Farm ID required',
      message: 'Farm ID is required for this operation',
      timestamp: new Date().toISOString()
    });
  }

  // Check if user owns this farm
  if (req.user.farmId !== parseInt(farmId) && !req.user.roles?.includes('admin')) {
    logger.security('Authorization failed - Farm ownership required', {
      userId: req.user.userId,
      userFarmId: req.user.farmId,
      requestedFarmId: farmId,
      path: req.path
    });
    
    return res.status(403).json({
      error: 'Access denied',
      message: 'You can only access your own farm data',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * Generate JWT token for a user
 */
const generateToken = (userData) => {
  const payload = {
    userId: userData.userId,
    farmId: userData.farmId,
    email: userData.email,
    roles: userData.roles || ['farmer']
  };

  const options = {
    expiresIn: '24h',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256'
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Refresh an existing token
 */
const refreshToken = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Valid token required for refresh',
      timestamp: new Date().toISOString()
    });
  }

  const newToken = generateToken(req.user);
  
  res.json({
    success: true,
    token: newToken,
    expiresIn: '24h'
  });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireFarmOwnership,
  generateToken,
  refreshToken
};