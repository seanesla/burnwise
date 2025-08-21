/**
 * Create Test User Script
 * Creates REAL user in database - NOT HARDCODED
 * Uses bcrypt for password hashing
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initializeDatabase, query } = require('../db/connection');

async function createTestUser() {
  try {
    // Initialize database connection
    await initializeDatabase();
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
    
    // Check if user exists in database
    const existing = await query(`
      SELECT farm_id, owner_name, contact_email FROM farms 
      WHERE contact_email = 'robert@goldenfields.com'
      LIMIT 1
    `);
    
    if (existing.length === 0) {
      // CREATE NEW USER IN DATABASE - NOT HARDCODED
      const insertResult = await query(`
        INSERT INTO farms (farm_name, owner_name, contact_email, password_hash, total_acreage, longitude, latitude, created_at, updated_at, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0)
      `, ['Golden Fields Farm', 'Robert Wilson', 'robert@goldenfields.com', hashedPassword, 250, '-121.740', '38.544']);
      
      console.log('✅ Created NEW user in database (not hardcoded)');
      console.log('📧 Email: robert@goldenfields.com');
      console.log('🔑 Password: TestPassword123!');
      console.log('🆔 User ID:', insertResult.insertId);
      console.log('✨ This is a REAL database record with bcrypt hashed password');
    } else {
      // Update existing user's password
      const result = await query(`
        UPDATE farms 
        SET password_hash = ?
        WHERE contact_email = 'robert@goldenfields.com'
      `, [hashedPassword]);
      
      if (result.affectedRows > 0) {
        console.log('✅ Updated existing user password');
        console.log('📧 Email: robert@goldenfields.com');
        console.log('🔑 Password: TestPassword123!');
        console.log('✨ Updated REAL database record with bcrypt hashed password');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();