/**
 * Create Test User Script
 * REAL user accounts with proper bcrypt hashed passwords
 * NO DEMO MODE - PRODUCTION READY
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initializeDatabase, query } = require('../db/connection');

async function createTestUser() {
  try {
    // Initialize database connection
    await initializeDatabase();
    // Create a real password hash
    const testPassword = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    // Check if password_hash column exists in farms table
    const columns = await query(`
      SHOW COLUMNS FROM farms LIKE 'password_hash'
    `);
    
    if (columns.length === 0) {
      // Add password_hash column if it doesn't exist
      await query(`
        ALTER TABLE farms 
        ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Added password_hash column to farms table');
    }
    
    // Update Robert Chen's account with hashed password
    const result = await query(`
      UPDATE farms 
      SET password_hash = ?
      WHERE contact_email = 'robert@goldenfields.com'
    `, [hashedPassword]);
    
    if (result.affectedRows > 0) {
      console.log('✅ Test user created successfully');
      console.log('📧 Email: robert@goldenfields.com');
      console.log('🔑 Password: TestPassword123!');
      console.log('✨ This is a REAL account with bcrypt hashed password');
    } else {
      console.log('⚠️ No user found with email robert@goldenfields.com');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();