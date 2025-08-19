// Test SQL directly to isolate the issue
require('dotenv').config({ path: './backend/.env' });
const { query, initializeDatabase } = require('./backend/db/connection');

async function testDirectSQL() {
  console.log('Testing direct SQL queries to isolate undefined parameter issue...\n');
  
  // Initialize database first
  await initializeDatabase();
  console.log('Database initialized\n');
  
  try {
    // Test 1: Simple query with no parameters
    console.log('Test 1: Simple query with no parameters');
    const test1 = await query('SELECT 1 as test');
    console.log('✅ Success:', test1);
    
    // Test 2: Query with valid parameter
    console.log('\nTest 2: Query with valid parameter');
    const test2 = await query('SELECT * FROM farms WHERE farm_id = ?', [1]);
    console.log('✅ Success:', test2[0]);
    
    // Test 3: Query with null parameter (should work)
    console.log('\nTest 3: Query with null parameter');
    const test3 = await query('SELECT * FROM farms WHERE farm_id = ? OR ? IS NULL', [1, null]);
    console.log('✅ Success: null parameter works');
    
    // Test 4: Query with undefined parameter (should fail)
    console.log('\nTest 4: Query with undefined parameter (expecting failure)');
    try {
      const undefinedVar = undefined;
      await query('SELECT * FROM farms WHERE farm_id = ?', [undefinedVar]);
      console.log('❌ Unexpected success with undefined');
    } catch (err) {
      console.log('✅ Expected failure:', err.message);
    }
    
    // Test 5: Query with missing array element
    console.log('\nTest 5: Query with missing array element');
    try {
      const params = [];
      params[0] = 1;
      // params[1] is undefined
      await query('SELECT * FROM farms WHERE farm_id = ? AND owner_name = ?', params);
      console.log('❌ Unexpected success with missing element');
    } catch (err) {
      console.log('✅ Expected failure:', err.message);
    }
    
    // Test 6: Test the actual coordinator query
    console.log('\nTest 6: Coordinator-style query');
    const burnRequestData = {
      farm_id: 1,
      field_name: "North Field",
      acres: 150,
      crop_type: "wheat",
      burn_date: "2025-08-20",
      time_window_start: "08:00",
      time_window_end: "12:00"
    };
    
    console.log('Testing with burnRequestData:', burnRequestData);
    
    // Check if farm exists
    const farm = await query(
      'SELECT latitude as lat, longitude as lon FROM farms WHERE farm_id = ?',
      [burnRequestData.farm_id]
    );
    console.log('✅ Farm query success:', farm[0]);
    
    // Test field creation query
    const existingField = await query(
      'SELECT field_id FROM burn_fields WHERE farm_id = ? LIMIT 1',
      [burnRequestData.farm_id]
    );
    console.log('✅ Field query success:', existingField.length, 'fields found');
    
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

testDirectSQL();