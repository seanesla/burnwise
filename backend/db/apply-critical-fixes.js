#!/usr/bin/env node

/**
 * Apply Critical Database Fixes
 * Fixes all remaining schema issues for 90%+ functionality
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function applyFixes() {
  let connection;
  
  try {
    console.log('🔧 Applying critical database fixes...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: process.env.TIDB_PORT,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: {
        rejectUnauthorized: true
      },
      multipleStatements: true
    });
    
    console.log('✅ Connected to TiDB database');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'critical-fixes.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // Parse SQL statements
    const statements = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n')
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and SELECT verification statements
      if (statement.startsWith('SELECT') && statement.includes('Verification Results')) {
        continue;
      }
      
      try {
        console.log(`  [${i + 1}/${statements.length}] Executing: ${statement.substring(0, 50)}...`);
        await connection.execute(statement);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Statement ${i + 1}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`  ❌ ${errorMsg}`);
        
        // Continue on certain expected errors
        if (error.message.includes('Duplicate') || 
            error.message.includes('already exists') ||
            error.message.includes('Unknown table')) {
          console.log('    ℹ️  Non-critical error, continuing...');
          successCount++;
          errorCount--;
        }
      }
    }
    
    console.log('\n📊 Fix Summary:');
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    
    // Run verification queries
    console.log('\n🔍 Verifying critical fixes...');
    
    const checks = [
      { name: 'burns table', query: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'burns'" },
      { name: 'burn_vector column', query: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'burns' AND COLUMN_NAME = 'burn_vector'" },
      { name: 'optimization_algorithm', query: "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'optimization_algorithm'" },
      { name: 'burns table records', query: "SELECT COUNT(*) as count FROM burns" }
    ];
    
    for (const check of checks) {
      try {
        const [rows] = await connection.execute(check.query, 
          check.query.includes('?') ? [process.env.TIDB_DATABASE] : []
        );
        const exists = rows[0].count > 0;
        console.log(`  ${exists ? '✅' : '❌'} ${check.name}: ${exists ? 'OK' : 'MISSING'} (${rows[0].count})`);
      } catch (e) {
        console.log(`  ❌ ${check.name}: ERROR - ${e.message}`);
      }
    }
    
    console.log('\n✨ Critical fixes applied!');
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some errors occurred:');
      errors.forEach(err => console.log(`  - ${err}`));
    }
    
  } catch (error) {
    console.error('💥 Failed to apply fixes:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the fixes
applyFixes().catch(console.error);