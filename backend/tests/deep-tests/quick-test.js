#!/usr/bin/env node

/**
 * Quick test to verify database and agent connections work
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { initializeDatabase, query } = require('../../db/connection');
const { TestCoordinatorAgent } = require('./test-helpers');

async function quickTest() {
  console.log('🚀 Running quick test...');
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    await initializeDatabase();
    console.log('✅ Database connected');
    
    // Test simple query
    const [result] = await query('SELECT 1 as test');
    console.log('✅ Query executed:', result);
    
    // Test coordinator agent
    const coordinator = new TestCoordinatorAgent();
    const validation = await coordinator.validateBurnRequest({
      field_id: 'test_field',
      requested_acreage: 100,
      requested_date: new Date(),
      requester_name: 'Test',
      requester_phone: '555-0000'
    });
    console.log('✅ Agent validation:', validation);
    
    // Test table operations
    const tables = await query('SHOW TABLES');
    console.log(`✅ Found ${tables.length} tables`);
    
    // Test burn_requests table - need to create field first due to foreign key
    const testFarmId = Math.floor(Math.random() * 1000000) + 200000;
    const testFieldId = Math.floor(Math.random() * 1000000) + 200000;
    
    // Create farm first
    await query(
      `INSERT INTO farms (farm_id, farm_name, name, owner_name, contact_email, contact_phone, total_area_hectares) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testFarmId, 'Quick Test Farm', 'Quick Test Farm', 'Tester', 'test@test.com', '555-1234', 100]
    );
    
    // Create field
    await query(
      `INSERT INTO burn_fields (field_id, farm_id, field_name, area_hectares, crop_type) 
       VALUES (?, ?, ?, ?, ?)`,
      [testFieldId, testFarmId, 'Test Field', 50, 'wheat']
    );
    
    // Now insert burn request
    await query(
      `INSERT INTO burn_requests (field_id, requested_date, acreage, crop_type, status) 
       VALUES (?, NOW(), ?, ?, ?)`,
      [testFieldId, 50, 'wheat', 'pending']
    );
    console.log('✅ Insert successful');
    
    // Clean up
    await query('DELETE FROM burn_requests WHERE field_id = ?', [testFieldId]);
    await query('DELETE FROM burn_fields WHERE field_id = ?', [testFieldId]);
    await query('DELETE FROM farms WHERE farm_id = ?', [testFarmId]);
    console.log('✅ Cleanup successful');
    
    console.log('\n✨ All tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

quickTest();