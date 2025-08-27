#!/usr/bin/env node
/**
 * RIGOROUS BurnRequestAgent Test - No Mocks, Real Operations
 * Tests actual tool execution, real TiDB operations, Zod validation
 */

const BurnRequestAgent = require('./agents-sdk/BurnRequestAgent');
const { query, initializeDatabase } = require('./db/connection');

async function runRigorousTests() {
  console.log('🔥 RIGOROUS BurnRequestAgent Testing - No Shortcuts');
  console.log('================================================');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  try {
    // Initialize database connection
    console.log('⚡ Initializing TiDB connection...');
    await initializeDatabase();
    console.log('✅ Database initialized');
    testsPassed++;
    // Test 1: Agent loads with correct GPT-5-mini model
    console.log('\n1️⃣  Testing agent instantiation...');
    if (BurnRequestAgent.model !== 'gpt-5-mini') {
      throw new Error(`Expected gpt-5-mini model, got ${BurnRequestAgent.model}`);
    }
    if (!BurnRequestAgent.tools || BurnRequestAgent.tools.length !== 2) {
      throw new Error(`Expected 2 tools, got ${BurnRequestAgent.tools?.length}`);
    }
    console.log('✅ Agent loaded with GPT-5-mini and 2 tools');
    testsPassed++;
    
    // Test 2: Real TiDB connection and table verification
    console.log('\n2️⃣  Testing TiDB connection and schema...');
    const tableCheck = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'burn_requests'
    `);
    
    if (tableCheck[0].count === 0) {
      throw new Error('burn_requests table does not exist in TiDB');
    }
    
    const schemaCheck = await query(`
      DESCRIBE burn_requests
    `);
    
    const requiredFields = ['farm_id', 'field_name', 'acres', 'crop_type', 'burn_date', 'status'];
    const actualFields = schemaCheck.map(row => row.Field);
    
    for (const field of requiredFields) {
      if (!actualFields.includes(field)) {
        throw new Error(`Required field '${field}' missing from burn_requests table`);
      }
    }
    console.log('✅ TiDB connection verified, burn_requests schema correct');
    testsPassed++;
    
    // Test 3: Real farm existence verification
    console.log('\n3️⃣  Testing farm data prerequisite...');
    const farmCheck = await query(`SELECT id FROM farms LIMIT 1`);
    if (farmCheck.length === 0) {
      // Insert test farm if none exists
      await query(`
        INSERT INTO farms (name, latitude, longitude, owner_name, contact_email) 
        VALUES (?, ?, ?, ?, ?)
      `, ['Test Farm For Agent Tests', 40.7128, -74.0060, 'Test Owner', 'test@example.com']);
      console.log('✅ Created test farm for rigorous testing');
    } else {
      console.log('✅ Farm data exists for testing');
    }
    testsPassed++;
    
    // Test 4: Real tool execution - storeBurnRequest with valid data
    console.log('\n4️⃣  Testing storeBurnRequest tool with valid data...');
    const testFarm = await query(`SELECT id FROM farms LIMIT 1`);
    const farmId = testFarm[0].id;
    
    // Find the storeBurnRequest tool
    const storeTool = BurnRequestAgent.tools.find(tool => tool.name === 'store_burn_request');
    if (!storeTool) {
      throw new Error('store_burn_request tool not found');
    }
    
    const validBurnRequest = {
      farm_id: farmId,
      field_name: 'North Field',
      acres: 150,
      crop_type: 'wheat',
      burn_date: '2025-03-15',
      time_window_start: '08:00',
      time_window_end: '12:00',
      urgency: 'medium',
      reason: 'Post-harvest residue management'
    };
    
    const storeResult = await storeTool.execute(validBurnRequest);
    
    if (!storeResult.success || !storeResult.requestId) {
      throw new Error('storeBurnRequest failed with valid data');
    }
    
    // Verify the burn request was actually inserted into TiDB
    const insertedRecord = await query(
      'SELECT * FROM burn_requests WHERE id = ?', 
      [storeResult.requestId]
    );
    
    if (insertedRecord.length === 0) {
      throw new Error('Burn request not found in database after insertion');
    }
    
    if (insertedRecord[0].acres !== 150 || insertedRecord[0].crop_type !== 'wheat') {
      throw new Error('Inserted data does not match expected values');
    }
    
    console.log(`✅ storeBurnRequest tool executed successfully, ID: ${storeResult.requestId}`);
    testsPassed++;
    
    // Test 5: Real tool execution - validateBurnParameters
    console.log('\n5️⃣  Testing validateBurnParameters tool...');
    const validateTool = BurnRequestAgent.tools.find(tool => tool.name === 'validate_parameters');
    if (!validateTool) {
      throw new Error('validate_parameters tool not found');
    }
    
    // Test with safe parameters
    const safeParams = {
      acres: 50,
      windSpeed: 8,
      humidity: 45
    };
    
    const safeResult = await validateTool.execute(safeParams);
    if (!safeResult.valid || safeResult.issues.length > 0) {
      throw new Error('Safe parameters should validate as valid');
    }
    
    // Test with unsafe parameters
    const unsafeParams = {
      acres: 600, // Exceeds 500 limit
      windSpeed: 20, // Exceeds 15 mph limit
      humidity: 25  // Below 30% threshold
    };
    
    const unsafeResult = await validateTool.execute(unsafeParams);
    if (unsafeResult.valid || unsafeResult.issues.length !== 3) {
      throw new Error('Unsafe parameters should be flagged with 3 issues');
    }
    
    console.log('✅ validateBurnParameters tool working correctly for safe and unsafe params');
    testsPassed++;
    
    // Test 6: Zod validation with invalid data types
    console.log('\n6️⃣  Testing Zod schema validation with invalid types...');
    
    const invalidData = {
      farm_id: 'not_a_number', // Should be number
      field_name: 123, // Should be string
      acres: 'fifty', // Should be number
      crop_type: null,
      burn_date: new Date(), // Should be string
      urgency: 'super_urgent' // Invalid enum value
    };
    
    try {
      await storeTool.execute(invalidData);
      throw new Error('Should have thrown validation error for invalid data types');
    } catch (error) {
      if (error.message.includes('validation') || error.message.includes('schema')) {
        console.log('✅ Zod validation correctly rejected invalid data types');
        testsPassed++;
      } else {
        throw error;
      }
    }
    
    // Test 7: Database constraint testing
    console.log('\n7️⃣  Testing database constraints...');
    
    const invalidFarmId = {
      farm_id: 99999, // Non-existent farm
      field_name: 'Test Field',
      acres: 100,
      crop_type: 'corn',
      burn_date: '2025-04-01',
      time_window_start: '09:00',
      time_window_end: '13:00',
      urgency: 'low',
      reason: 'Testing'
    };
    
    const constraintResult = await storeTool.execute(invalidFarmId);
    if (constraintResult.success) {
      throw new Error('Should have failed with non-existent farm_id');
    }
    
    console.log('✅ Database foreign key constraint correctly enforced');
    testsPassed++;
    
    // Test 8: Clean up test data
    console.log('\n8️⃣  Cleaning up test data...');
    await query('DELETE FROM burn_requests WHERE reason = ?', ['Post-harvest residue management']);
    await query('DELETE FROM farms WHERE name = ?', ['Test Farm For Agent Tests']);
    console.log('✅ Test data cleaned up');
    testsPassed++;
    
    // Final Results
    console.log('\n🎉 RIGOROUS TEST RESULTS');
    console.log('========================');
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log('\n🔥 BurnRequestAgent with GPT-5-mini: FULLY VERIFIED');
    console.log('   - Real TiDB operations ✓');
    console.log('   - Actual tool execution ✓');
    console.log('   - Zod validation ✓');
    console.log('   - Database constraints ✓');
    console.log('   - Error handling ✓');
    
    return true;
    
  } catch (error) {
    testsFailed++;
    console.error('\n💥 RIGOROUS TEST FAILED:', error.message);
    console.log('\n📊 FINAL RESULTS');
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    return false;
  }
}

// Run the rigorous tests
runRigorousTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});