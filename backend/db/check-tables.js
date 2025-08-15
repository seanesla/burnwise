#!/usr/bin/env node

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkTables() {
  const connection = await mysql.createConnection({
    host: process.env.TIDB_HOST,
    port: process.env.TIDB_PORT,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    ssl: { rejectUnauthorized: true }
  });

  console.log('📊 Checking database tables and columns...\n');

  // Check which tables exist
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [process.env.TIDB_DATABASE]
  );

  console.log('📋 Existing tables:');
  tables.forEach(t => console.log(`  ✅ ${t.TABLE_NAME}`));

  // Check for critical columns
  console.log('\n🔍 Checking critical columns:');
  
  const checks = [
    { table: 'weather_data', column: 'weather_vector' },
    { table: 'burns', column: 'burn_vector' },
    { table: 'smoke_predictions', column: 'plume_vector' },
    { table: 'burn_requests', column: 'field_id' },
    { table: 'burn_schedule', column: 'optimization_algorithm' }
  ];

  for (const check of checks) {
    const [result] = await connection.execute(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.TIDB_DATABASE, check.table, check.column]
    );
    
    const exists = result[0].count > 0;
    console.log(`  ${exists ? '✅' : '❌'} ${check.table}.${check.column}: ${exists ? 'EXISTS' : 'MISSING'}`);
  }

  // Check burn_requests structure
  console.log('\n📐 burn_requests table structure:');
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'burn_requests' 
     ORDER BY ORDINAL_POSITION`,
    [process.env.TIDB_DATABASE]
  );
  
  columns.forEach(col => console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`));

  await connection.end();
}

checkTables().catch(console.error);