#!/usr/bin/env node

require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSchema() {
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
    
    // Check farms table structure
    console.log('\n📋 FARMS TABLE STRUCTURE:');
    const [farmsColumns] = await connection.execute('DESCRIBE farms');
    farmsColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null} ${col.Key} ${col.Default || ''}`);
    });
    
    // Check if weather_data table exists
    console.log('\n📋 CHECKING FOR MISSING TABLES:');
    const [tables] = await connection.execute("SHOW TABLES LIKE 'weather_data'");
    console.log(`weather_data table: ${tables.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);
    
    const [scheduleTables] = await connection.execute("SHOW TABLES LIKE '%schedule%'");
    console.log('Schedule-related tables:', scheduleTables.map(t => Object.values(t)[0]));
    
    // Check alerts table structure  
    console.log('\n📋 ALERTS TABLE STRUCTURE:');
    const [alertsColumns] = await connection.execute('DESCRIBE alerts');
    alertsColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null} ${col.Key} ${col.Default || ''}`);
    });
    
    // Test the farms query that's failing
    console.log('\n🧪 TESTING FARMS QUERY:');
    try {
      const [rows] = await connection.execute('SELECT f.id, f.name FROM farms f LIMIT 1');
      console.log('✅ Basic farms query works:', rows);
    } catch (error) {
      console.error('❌ Farms query failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
  } finally {
    await connection.end();
    console.log('🔚 Database connection closed');
  }
}

checkSchema().catch(console.error);