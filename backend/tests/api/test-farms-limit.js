#!/usr/bin/env node

require('dotenv').config();
const mysql = require('mysql2/promise');

async function testFarmsLimitQuery() {
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
    
    // Test 1: Simple query with LIMIT (using literal values)
    console.log('\n🧪 Test 1: Simple LIMIT query with literal values');
    const query1 = 'SELECT * FROM farms LIMIT 10 OFFSET 0';
    console.log('Query:', query1);
    
    try {
      const [rows1] = await connection.execute(query1);
      console.log('✅ Test 1 passed! Found', rows1.length, 'farms');
    } catch (error) {
      console.error('❌ Test 1 failed:', error.message);
    }
    
    // Test 1b: Try with placeholders
    console.log('\n🧪 Test 1b: LIMIT query with placeholders');
    const query1b = 'SELECT * FROM farms LIMIT ? OFFSET ?';
    const params1b = [10, 0];
    console.log('Query:', query1b);
    console.log('Params:', params1b);
    
    try {
      const [rows1b] = await connection.execute(query1b, params1b);
      console.log('✅ Test 1b passed! Found', rows1b.length, 'farms');
    } catch (error) {
      console.error('❌ Test 1b failed:', error.message);
    }
    
    // Test 2: Query with computed columns and LIMIT
    console.log('\n🧪 Test 2: Query with computed columns');
    const query2 = `
      SELECT 
        f.farm_id as id,
        f.farm_name as name
      FROM farms f
      LIMIT ? OFFSET ?
    `;
    const params2 = [10, 0];
    console.log('Query:', query2);
    console.log('Params:', params2);
    
    try {
      const [rows2] = await connection.execute(query2, params2);
      console.log('✅ Test 2 passed! Found', rows2.length, 'farms');
    } catch (error) {
      console.error('❌ Test 2 failed:', error.message);
    }
    
    // Test 3: Full query from farms.js (without distance)
    console.log('\n🧪 Test 3: Full farms.js query (no distance)');
    const query3 = `
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
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const params3 = [10, 0];
    console.log('Query:', query3);
    console.log('Params:', params3);
    
    try {
      const [rows3] = await connection.execute(query3, params3);
      console.log('✅ Test 3 passed! Found', rows3.length, 'farms');
      if (rows3.length > 0) {
        console.log('Sample farm:', rows3[0]);
      }
    } catch (error) {
      console.error('❌ Test 3 failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  } finally {
    await connection.end();
    console.log('\n🔚 Database connection closed');
  }
}

testFarmsLimitQuery().catch(console.error);