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
 * POST /api/auth/demo
 * Create demo session - NO AUTHENTICATION REQUIRED
 * Bypasses login entirely for demo mode
 */
router.post('/demo', async (req, res) => {
  try {
    // Create demo user data without any authentication
    const demoUserData = {
      userId: 99999,  // Demo user ID
      farmId: 99999,
      email: 'demo@burnwise.com',
      name: 'Demo User',
      roles: ['farmer', 'demo'],
      isDemo: true
    };
    
    // Generate tokens for demo session
    const accessToken = generateToken(demoUserData);
    const refreshTokenData = { ...demoUserData, type: 'refresh' };
    const refreshToken = generateToken(refreshTokenData);
    
    // Set tokens in httpOnly cookies
    setTokenCookie(res, accessToken, false);
    setTokenCookie(res, refreshToken, true);
    
    logger.info('Demo session created', { email: demoUserData.email });
    
    return res.status(200).json({
      success: true,
      message: 'Demo session created',
      user: {
        id: demoUserData.userId,
        email: demoUserData.email,
        name: demoUserData.name,
        roles: demoUserData.roles,
        isDemo: true
      },
      token: accessToken,
      refreshToken,
      expiresIn: '24h'
    });
  } catch (error) {
    logger.error('Demo session creation failed', { error: error.message });
    return res.status(500).json({
      error: 'Demo session failed',
      message: 'Could not create demo session'
    });
  }
});

/**
 * POST /api/auth/demo/end
 * End demo session and clean up demo data
 */
router.post('/demo/end', async (req, res) => {
  try {
    // Clear cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    logger.info('Demo session ended');
    
    return res.status(200).json({
      success: true,
      message: 'Demo session ended successfully'
    });
  } catch (error) {
    logger.error('Error ending demo session', { error: error.message });
    return res.status(500).json({
      error: 'Failed to end demo session',
      message: error.message
    });
  }
});

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
    
    // Find user by email (include password_hash for production auth and onboarding status)
    const users = await query(`
      SELECT 
        f.farm_id,
        f.owner_name,
        f.contact_email,
        f.contact_phone,
        f.password_hash,
        f.onboarding_completed,
        f.boundary,
        f.location,
        f.farm_size_acres
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
    
    // Check if onboarding is completed (has boundary or complete location data)
    const onboardingCompleted = !!(
      user.onboarding_completed || 
      user.boundary || 
      (user.location && user.farm_size_acres)
    );
    
    // Generate tokens
    const userData = {
      userId: user.farm_id,
      farmId: user.farm_id,
      email: user.contact_email,
      name: user.owner_name,
      roles: ['farmer'],
      onboardingCompleted: onboardingCompleted
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
        roles: ['farmer'],
        onboardingCompleted: onboardingCompleted
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
 * Check if demo mode is available - REAL TiDB CHECK
 * Validates demo infrastructure and database setup
 */
router.get('/demo-status', async (req, res) => {
  try {
    // Check if demo tables exist in TiDB
    const demoTableCheck = await query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name IN ('demo_sessions', 'agent_interactions')
    `);

    const tablesExist = demoTableCheck[0].table_count >= 2;

    // Check if demo columns exist on core tables
    const demoColumnCheck = await query(`
      SELECT 
        SUM(CASE WHEN table_name = 'farms' AND column_name = 'is_demo' THEN 1 ELSE 0 END) as farms_demo,
        SUM(CASE WHEN table_name = 'burn_requests' AND column_name = 'is_demo' THEN 1 ELSE 0 END) as burns_demo,
        SUM(CASE WHEN table_name = 'users' AND column_name = 'is_demo' THEN 1 ELSE 0 END) as users_demo
      FROM information_schema.columns 
      WHERE table_schema = DATABASE()
    `);

    const columnsExist = demoColumnCheck[0].farms_demo > 0 && 
                        demoColumnCheck[0].burns_demo > 0 && 
                        demoColumnCheck[0].users_demo > 0;

    // Check current demo session count
    const activeSessionsResult = await query(`
      SELECT COUNT(*) as active_sessions
      FROM demo_sessions 
      WHERE is_active = true AND expires_at > NOW()
    `);

    const activeSessions = activeSessionsResult[0].active_sessions;

    // Check demo data isolation
    const demoDataResult = await query(`
      SELECT 
        (SELECT COUNT(*) FROM farms WHERE is_demo = true) as demo_farms,
        (SELECT COUNT(*) FROM burn_requests WHERE is_demo = true) as demo_burns
    `);

    const hasDemoData = demoDataResult[0].demo_farms > 0;

    // Determine if demo is fully available
    const isDemoAvailable = tablesExist && columnsExist;
    const isDemoReady = isDemoAvailable; // Could add additional checks here

    logger.info('Demo status check', {
      tablesExist,
      columnsExist, 
      activeSessions,
      hasDemoData,
      isDemoReady
    });

    res.json({
      demoMode: isDemoReady,
      available: isDemoReady,
      infrastructure: {
        tables_ready: tablesExist,
        columns_ready: columnsExist,
        database_schema: 'valid'
      },
      statistics: {
        active_sessions: activeSessions,
        demo_farms: demoDataResult[0].demo_farms,
        demo_burns: demoDataResult[0].demo_burns
      },
      message: isDemoReady 
        ? 'Demo mode is available with full TiDB integration' 
        : 'Demo mode infrastructure not ready',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Demo status check error', { error: error.message });
    
    // Fallback to environment variable check
    const envDemoMode = process.env.DEMO_MODE === 'true';
    
    res.json({
      demoMode: false,
      available: false,
      error: 'Demo infrastructure check failed',
      fallback_mode: envDemoMode,
      message: 'Demo temporarily unavailable - database infrastructure issue',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;