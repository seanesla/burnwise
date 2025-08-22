/**
 * Run migration 007 - Add onboarding_completed flag
 */

require('dotenv').config();
const { query } = require('../db/connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Running migration 007: Add onboarding_completed flag...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/007_add_onboarding_status.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      await query(statement);
    }
    
    console.log('✅ Migration 007 completed successfully!');
    
    // Verify the column was added
    const result = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'farms' 
      AND COLUMN_NAME = 'onboarding_completed'
    `);
    
    if (result.length > 0) {
      console.log('✅ Verified: onboarding_completed column exists');
    } else {
      console.log('⚠️ Warning: Column might not have been added properly');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();