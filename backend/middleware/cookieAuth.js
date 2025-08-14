/**
 * Cookie-based Authentication Middleware
 * Secure JWT storage using httpOnly cookies
 * SECURITY: Prevents XSS attacks on tokens
 */

const jwt = require('jsonwebtoken');
const logger = require('./logger');

// Cookie configuration for different environments
const getCookieConfig = (isProduction) => ({
  httpOnly: true,        // Prevent JavaScript access (XSS protection)
  secure: isProduction,  // HTTPS only in production
  sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
});

// Refresh token cookie config (longer duration)
const getRefreshCookieConfig = (isProduction) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth/refresh'  // Only sent to refresh endpoint
});

/**
 * Set JWT token in httpOnly cookie
 */
const setTokenCookie = (res, token, isRefresh = false) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isRefresh ? 'burnwise_refresh_token' : 'burnwise_token';
  const config = isRefresh ? getRefreshCookieConfig(isProduction) : getCookieConfig(isProduction);
  
  res.cookie(cookieName, token, config);
  
  logger.info('Token cookie set', {
    type: isRefresh ? 'refresh' : 'access',
    secure: config.secure,
    sameSite: config.sameSite
  });
};

/**
 * Clear authentication cookies
 */
const clearAuthCookies = (res) => {
  res.clearCookie('burnwise_token');
  res.clearCookie('burnwise_refresh_token');
  logger.info('Authentication cookies cleared');
};

/**
 * Extract and verify JWT from cookie
 */
const authenticateFromCookie = (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies?.burnwise_token;
    
    if (!token) {
      // Check Authorization header as fallback (for API clients)
      const authHeader = req.headers['authorization'];
      const headerToken = authHeader && authHeader.split(' ')[1];
      
      if (!headerToken) {
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
      
      // Use header token if no cookie
      req.token = headerToken;
    } else {
      req.token = token;
    }
    
    // Verify token
    const JWT_SECRET = process.env.JWT_SECRET || 'burnwise-jwt-secret-change-in-production';
    const JWT_ISSUER = process.env.JWT_ISSUER || 'burnwise-api';
    const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'burnwise-client';
    
    jwt.verify(req.token, JWT_SECRET, {
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
      logger.info('Cookie authentication successful', {
        userId: decoded.userId,
        farmId: decoded.farmId,
        path: req.path
      });
      
      next();
    });
  } catch (error) {
    logger.error('Cookie authentication middleware error', { error: error.message });
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Refresh token verification
 */
const verifyRefreshToken = (req, res, next) => {
  try {
    const refreshToken = req.cookies?.burnwise_refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({
        error: 'No refresh token',
        message: 'Refresh token not provided'
      });
    }
    
    const JWT_SECRET = process.env.JWT_SECRET || 'burnwise-jwt-secret-change-in-production';
    const JWT_ISSUER = process.env.JWT_ISSUER || 'burnwise-api';
    const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'burnwise-client';
    
    jwt.verify(refreshToken, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256']
    }, (err, decoded) => {
      if (err) {
        logger.security('Refresh token verification failed', {
          ip: req.ip,
          error: err.message
        });
        
        return res.status(401).json({
          error: 'Invalid refresh token',
          message: 'Refresh token is invalid or expired'
        });
      }
      
      req.user = decoded;
      next();
    });
  } catch (error) {
    logger.error('Refresh token middleware error', { error: error.message });
    return res.status(500).json({
      error: 'Token refresh error',
      message: 'An error occurred during token refresh'
    });
  }
};

/**
 * Generate new access token from refresh token
 */
const refreshAccessToken = (req, res) => {
  const { generateToken } = require('./auth');
  
  // Generate new access token with same user data
  const newAccessToken = generateToken(req.user);
  
  // Set new access token cookie
  setTokenCookie(res, newAccessToken, false);
  
  logger.info('Access token refreshed', {
    userId: req.user.userId,
    farmId: req.user.farmId
  });
  
  res.json({
    success: true,
    message: 'Token refreshed successfully',
    expiresIn: '24h'
  });
};

module.exports = {
  setTokenCookie,
  clearAuthCookies,
  authenticateFromCookie,
  verifyRefreshToken,
  refreshAccessToken,
  getCookieConfig
};