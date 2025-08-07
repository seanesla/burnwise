#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initializeDatabase() {
  console.log('🔗 Connecting to TiDB...');
  
  const connection = await mysql.createConnection({
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT) || 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    ssl: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    }
  });

  try {
    console.log('✅ Connected to TiDB');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Clean and split schema into individual statements
    const cleanedSchema = schema
      .replace(/--.*$/gm, '') // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .trim();
    
    const statements = cleanedSchema
      .split(';')
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim().replace(/\s+/g, ' ')); // Normalize whitespace

    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    for (const statement of statements) {
      if (statement) {
        try {
          await connection.execute(statement);
          console.log('✅ Executed:', statement.split('\n')[0].substring(0, 50) + '...');
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log('⚠️ Already exists:', statement.split('\n')[0].substring(0, 50) + '...');
          } else {
            console.error('❌ Failed:', statement.split('\n')[0].substring(0, 50) + '...');
            console.error('Error:', error.message);
          }
        }
      }
    }
    
    // Verify tables were created
    const [rows] = await connection.execute('SHOW TABLES');
    console.log(`✅ Database initialized with ${rows.length} tables:`, rows.map(r => Object.values(r)[0]).join(', '));
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('🔚 Database connection closed');
  }
}

// Run the initialization
initializeDatabase().catch(console.error);