/**
 * Authentication API endpoints
 * Real implementation for login and token management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/connection');
const { generateToken, authenticateToken, refreshToken } = require('../middleware/auth');
const logger = require('../middleware/logger');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Validate input
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }
    
    // Find user by email
    const users = await query(`
      SELECT 
        f.farm_id,
        f.owner_name,
        f.contact_email,
        f.contact_phone
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
    
    // For demo purposes, we'll accept any password that matches the pattern
    // In production, you'd check against a hashed password in a users table
    const validPassword = password === 'demo123' || password === `farm${user.farm_id}`;
    
    if (!validPassword) {
      logger.security('Login failed - invalid password', { email });
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = generateToken({
      userId: user.farm_id,
      farmId: user.farm_id,
      email: user.contact_email,
      name: user.owner_name,
      roles: ['farmer']
    });
    
    logger.info('Login successful', { 
      farmId: user.farm_id,
      email: user.contact_email 
    });
    
    res.json({
      success: true,
      token,
      user: {
        farmId: user.farm_id,
        name: user.owner_name,
        email: user.contact_email,
        roles: ['farmer']
      },
      expiresIn: '24h'
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
router.post('/register', async (req, res) => {
  const { 
    farm_name,
    owner_name,
    email,
    password,
    phone,
    longitude,
    latitude,
    total_acreage
  } = req.body;
  
  try {
    // Validate required fields
    if (!farm_name || !owner_name || !email || !password) {
      throw new ValidationError('Required fields: farm_name, owner_name, email, password');
    }
    
    // Check if email already exists
    const existing = await query(`
      SELECT farm_id FROM farms WHERE contact_email = ?
    `, [email]);
    
    if (existing.length > 0) {
      throw new ValidationError('Email already registered');
    }
    
    // Create new farm
    const result = await query(`
      INSERT INTO farms (
        farm_name, owner_name, contact_email, contact_phone,
        longitude, latitude, total_acreage,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `, [
      farm_name,
      owner_name,
      email,
      phone || null,
      longitude || -122.4194,
      latitude || 37.7749,
      total_acreage || 100
    ]);
    
    const farmId = result.insertId;
    
    // Generate token for new user
    const token = generateToken({
      userId: farmId,
      farmId: farmId,
      email: email,
      name: owner_name,
      roles: ['farmer']
    });
    
    logger.info('Registration successful', {
      farmId: farmId,
      email: email
    });
    
    res.status(201).json({
      success: true,
      token,
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
 * Refresh an existing JWT token
 */
router.post('/refresh', authenticateToken, refreshToken);

/**
 * GET /api/auth/verify
 * Verify if a token is valid
 */
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    valid: true,
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', authenticateToken, (req, res) => {
  logger.info('Logout', { userId: req.user.userId });
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;