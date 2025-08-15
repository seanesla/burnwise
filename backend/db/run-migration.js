#!/usr/bin/env node

/**
 * Database Migration Runner
 * Applies critical schema fixes to TiDB database
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  let connection;
  
  try {
    console.log('🔧 Starting database migration...');
    
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
      multipleStatements: true // Allow multiple SQL statements
    });
    
    console.log('✅ Connected to TiDB database');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'fix-schema-migration.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Parse SQL more carefully - handle comments and complex statements
    const sqlLines = migrationSQL.split('\n');
    let currentStatement = '';
    const statements = [];
    
    for (const line of sqlLines) {
      // Skip comment lines
      if (line.trim().startsWith('--') || line.trim().length === 0) {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check if statement ends with semicolon
      if (line.trim().endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) {
        continue;
      }
      
      try {
        // Log the type of statement
        const stmtType = statement.substring(0, 30).replace(/\n/g, ' ');
        console.log(`  [${i + 1}/${statements.length}] Executing: ${stmtType}...`);
        
        await connection.execute(statement);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error in statement ${i + 1}: ${error.message}`);
        
        // Continue with other statements even if one fails
        // This is important for ALTER TABLE ADD COLUMN IF NOT EXISTS
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_DUP_KEYNAME' ||
            error.message.includes('Duplicate') ||
            error.message.includes('already exists')) {
          console.log('    ℹ️  Column/index already exists, continuing...');
          successCount++; // Count as success since column exists
          errorCount--; // Don't count as error
        }
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Successful statements: ${successCount}`);
    console.log(`  ❌ Failed statements: ${errorCount}`);
    
    // Verify critical columns exist
    console.log('\n🔍 Verifying critical columns...');
    
    const verifyQueries = [
      {
        name: 'weather_vector in weather_data',
        query: `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'weather_data' 
                AND COLUMN_NAME = 'weather_vector'`
      },
      {
        name: 'burn_vector in burns',
        query: `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'burns' 
                AND COLUMN_NAME = 'burn_vector'`
      },
      {
        name: 'plume_vector in smoke_predictions',
        query: `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'smoke_predictions' 
                AND COLUMN_NAME = 'plume_vector'`
      },
      {
        name: 'burn_fields table',
        query: `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'burn_fields'`
      }
    ];
    
    for (const verify of verifyQueries) {
      const [rows] = await connection.execute(verify.query, [process.env.TIDB_DATABASE]);
      const exists = rows[0].count > 0;
      console.log(`  ${exists ? '✅' : '❌'} ${verify.name}: ${exists ? 'EXISTS' : 'MISSING'}`);
    }
    
    console.log('\n✨ Migration completed!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
runMigration().catch(console.error);