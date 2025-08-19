/**
 * Authentication API endpoints
 * Real implementation for login and token management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/connection');
const { generateToken, authenticateToken, refreshToken } = require('../middleware/auth');
const { setTokenCookie, clearAuthCookies, authenticateFromCookie, verifyRefreshToken, refreshAccessToken } = require('../middleware/cookieAuth');
const { loginRateLimiter, registrationRateLimiter, trackFailedLogin, clearFailedAttempts, isAccountLocked, getRemainingAttempts } = require('../middleware/authRateLimiter');
const { setCSRFToken, verifyCSRFToken, getCSRFToken } = require('../middleware/csrf');
const { loginSchema, registrationSchema, validateInput } = require('../validation/authSchemas');
const logger = require('../middleware/logger');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/auth/csrf-token
 * Get CSRF token for forms
 */
router.get('/csrf-token', getCSRFToken);

/**
 * POST /api/auth/login
 * Authenticate user and set httpOnly cookie
 */
router.post('/login', loginRateLimiter, async (req, res) => {
  // Validate input with Joi
  const validation = validateInput(loginSchema, req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Validation error',
      message: validation.error
    });
  }
  
  const { email, password } = validation.value;
  
  try {
    // Check if account is locked
    if (isAccountLocked(req)) {
      logger.security('Login blocked - account locked', { email });
      return res.status(429).json({
        error: 'Account locked',
        message: 'Too many failed attempts. Please try again in 5 minutes.',
        retryAfter: 5 * 60,
        timestamp: new Date().toISOString()
      });
    }
    
    // Find user by email (include password_hash for production auth)
    const users = await query(`
      SELECT 
        f.farm_id,
        f.owner_name,
        f.contact_email,
        f.contact_phone,
        f.password_hash
      FROM farms f
      WHERE f.contact_email = ?
      LIMIT 1
    `, [email]);
    
    if (users.length === 0) {
      logger.security('Login failed - user not found', { email });
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials'
      });
    }
    
    const user = users[0];
    
    // DEMO MODE CHECK - Only allow demo passwords when explicitly enabled
    const isDemoMode = process.env.DEMO_MODE === 'true';
    let validPassword = false;
    
    if (isDemoMode) {
      // In demo mode, accept demo123 or farm-specific password
      validPassword = password === 'demo123' || password === `farm${user.farm_id}`;
      if (validPassword && password === 'demo123') {
        logger.info('Demo login used', { email, isDemoMode: true });
      }
    } else {
      // In production mode, check against hashed passwords
      // First check if this is a demo password attempt
      if (password === 'demo123' || password === `farm${user.farm_id}`) {
        logger.security('Demo password attempted in production mode', { email });
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Demo credentials are disabled in production'
        });
      }
      
      // Check if user has a password_hash field (production setup)
      if (user.password_hash) {
        // Compare with hashed password
        try {
          validPassword = await bcrypt.compare(password, user.password_hash);
        } catch (hashError) {
          logger.error('Password comparison error', { error: hashError.message });
          validPassword = false;
        }
      } else {
        // No password hash exists - user needs to reset password
        logger.warn('User has no password hash', { email });
        validPassword = false;
      }
    }
    
    if (!validPassword) {
      logger.security('Login failed - invalid password', { email, isDemoMode });
      trackFailedLogin(req); // Track failed attempt
      const remainingAttempts = getRemainingAttempts(req);
      
      // Build response with helpful feedback
      const response = {
        error: 'Authentication failed',
        message: 'Invalid credentials',
        remainingAttempts
      };
      
      // Add warning when attempts are running low
      if (remainingAttempts <= 3 && remainingAttempts > 0) {
        response.warning = `Only ${remainingAttempts} login attempts remaining before temporary lockout`;
      } else if (remainingAttempts === 0) {
        response.warning = 'Account will be locked after next failed attempt. Please wait 5 minutes.';
      }
      
      return res.status(401).json(response);
    }
    
    // Clear failed attempts on successful login
    clearFailedAttempts(req);
    
    // Generate tokens
    const userData = {
      userId: user.farm_id,
      farmId: user.farm_id,
      email: user.contact_email,
      name: user.owner_name,
      roles: ['farmer']
    };
    
    const accessToken = generateToken(userData);
    const refreshTokenData = { ...userData, type: 'refresh' };
    const refreshToken = generateToken(refreshTokenData);
    
    // Set tokens in httpOnly cookies
    setTokenCookie(res, accessToken, false);
    setTokenCookie(res, refreshToken, true);
    
    logger.info('Login successful', { 
      farmId: user.farm_id,
      email: user.contact_email 
    });
    
    // Send token in response body for API clients AND set cookies for browser
    res.json({
      success: true,
      token: accessToken,  // Include token for API clients
      refreshToken: refreshToken,  // Include refresh token
      user: {
        farmId: user.farm_id,
        name: user.owner_name,
        email: user.contact_email,
        roles: ['farmer']
      },
      message: 'Login successful'
    });
    
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /api/auth/register
 * Register a new farm and owner
 */
router.post('/register', registrationRateLimiter, async (req, res) => {
  // Validate input with Joi
  const validation = validateInput(registrationSchema, req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Validation error',
      message: validation.error
    });
  }
  
  const { 
    farm_name,
    owner_name,
    email,
    password,
    phone,
    longitude,
    latitude,
    total_acreage
  } = validation.value;
  
  try {
    
    // Hash the password for production use
    const isDemoMode = process.env.DEMO_MODE === 'true';
    let passwordHash = null;
    
    if (!isDemoMode) {
      // In production, always hash passwords
      const saltRounds = 10;
      passwordHash = await bcrypt.hash(password, saltRounds);
      logger.info('Password hashed for new user', { email });
    }
    
    // Check if email already exists
    const existing = await query(`
      SELECT farm_id FROM farms WHERE contact_email = ?
    `, [email]);
    
    if (existing.length > 0) {
      throw new ValidationError('Email already registered');
    }
    
    // Create new farm with password hash if in production
    let insertQuery;
    let insertParams;
    
    if (!isDemoMode && passwordHash) {
      // Production mode - store password hash
      insertQuery = `
        INSERT INTO farms (
          farm_name, owner_name, contact_email, contact_phone,
          longitude, latitude, total_acreage, password_hash,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
      `;
      insertParams = [
        farm_name,
        owner_name,
        email,
        phone || null,
        longitude || -122.4194,
        latitude || 37.7749,
        total_acreage || 100,
        passwordHash
      ];
    } else {
      // Demo mode - no password hash
      insertQuery = `
        INSERT INTO farms (
          farm_name, owner_name, contact_email, contact_phone,
          longitude, latitude, total_acreage,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
      `;
      insertParams = [
        farm_name,
        owner_name,
        email,
        phone || null,
        longitude || -122.4194,
        latitude || 37.7749,
        total_acreage || 100
      ];
    }
    
    const result = await query(insertQuery, insertParams);
    
    const farmId = result.insertId;
    
    // Generate tokens for new user
    const userData = {
      userId: farmId,
      farmId: farmId,
      email: email,
      name: owner_name,
      roles: ['farmer']
    };
    
    const accessToken = generateToken(userData);
    const refreshTokenData = { ...userData, type: 'refresh' };
    const refreshToken = generateToken(refreshTokenData);
    
    // Set tokens in httpOnly cookies
    setTokenCookie(res, accessToken, false);
    setTokenCookie(res, refreshToken, true);
    
    logger.info('Registration successful', {
      farmId: farmId,
      email: email
    });
    
    res.status(201).json({
      success: true,
      user: {
        farmId: farmId,
        name: owner_name,
        email: email,
        roles: ['farmer']
      },
      message: 'Registration successful'
    });
    
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh an existing JWT token using refresh token from cookie
 */
router.post('/refresh', verifyRefreshToken, refreshAccessToken);

/**
 * GET /api/auth/verify
 * Verify if a token is valid (uses cookie)
 */
router.get('/verify', authenticateFromCookie, (req, res) => {
  res.json({
    success: true,
    valid: true,
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Logout - clear httpOnly cookies
 */
router.post('/logout', authenticateFromCookie, (req, res) => {
  logger.info('Logout', { userId: req.user.userId });
  
  // Clear authentication cookies
  clearAuthCookies(res);
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * GET /api/auth/demo-status
 * Check if demo mode is enabled
 */
router.get('/demo-status', (req, res) => {
  const isDemoMode = process.env.DEMO_MODE === 'true';
  
  res.json({
    demoMode: isDemoMode,
    message: isDemoMode ? 'Demo mode is enabled' : 'Production mode - demo disabled'
  });
});

module.exports = router;