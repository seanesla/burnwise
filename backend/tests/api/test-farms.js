#!/usr/bin/env node

require('dotenv').config();
const mysql = require('mysql2/promise');

async function testFarmsQuery() {
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
    
    // Test the exact query from the fixed farms.js
    const farmsQuery = `
      SELECT 
        f.farm_id as id,
        f.farm_name as name,
        f.owner_name,
        f.contact_phone as phone,
        f.contact_email as email,
        f.permit_number as address,
        f.longitude as lon,
        f.latitude as lat,
        f.total_acreage as farm_size_acres,
        NULL as primary_crops,
        f.permit_number as certification_number,
        NULL as emergency_contact,
        f.created_at,
        f.updated_at
      FROM farms f
      LIMIT 5
    `;
    
    console.log('🧪 Testing farms query...');
    const [rows] = await connection.execute(farmsQuery);
    console.log('✅ Farms query successful!');
    console.log(`📊 Found ${rows.length} farms:`);
    rows.forEach(farm => {
      console.log(`  - ${farm.name} (ID: ${farm.id})`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await connection.end();
    console.log('🔚 Database connection closed');
  }
}

testFarmsQuery().catch(console.error);