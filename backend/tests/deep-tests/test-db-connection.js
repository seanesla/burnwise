#!/usr/bin/env node

/**
 * Database Connection Test
 * Verifies that we can connect to TiDB
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

console.log('Environment variables loaded:');
console.log('  Host:', process.env.TIDB_HOST);
console.log('  Port:', process.env.TIDB_PORT);
console.log('  User:', process.env.TIDB_USER);
console.log('  Database:', process.env.TIDB_DATABASE);
console.log('  Password:', process.env.TIDB_PASSWORD ? 'Set' : 'Not set');

const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('\nAttempting connection...');
    
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

    console.log('✅ Connected successfully!');
    
    // Test query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query executed:', rows);
    
    // List tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`✅ Found ${tables.length} tables`);
    
    await connection.end();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error);
  }
}

testConnection();