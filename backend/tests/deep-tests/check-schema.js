#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { initializeDatabase, query } = require('../../db/connection');

async function checkSchema() {
  try {
    await initializeDatabase();
    console.log('Checking optimized_schedules schema...\n');
    
    const columns = await query('SHOW COLUMNS FROM optimized_schedules');
    console.log('Columns in optimized_schedules:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();