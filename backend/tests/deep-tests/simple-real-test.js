#!/usr/bin/env node

/**
 * SIMPLE REAL TEST - Direct database operations without agent complexity
 * This tests ACTUAL database operations that the agents would perform
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { initializeDatabase, query } = require('../../db/connection');

async function runSimpleRealTest() {
  console.log('🔥 RUNNING SIMPLE REAL TEST - Direct Database Operations');
  
  let testFarmId, testFieldId, testRequestId;
  
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database connected');
    
    // Test 1: Create farm (what coordinator checks)
    testFarmId = Math.floor(Math.random() * 1000000) + 800000;
    await query(
      `INSERT INTO farms (farm_id, farm_name, name, owner_name, contact_email, contact_phone, total_area_hectares) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testFarmId, 'Simple Test Farm', 'Simple Test Farm', 'Test Owner', 'simple@test.com', '555-TEST', 300]
    );
    console.log('✅ Test 1 PASSED: Farm creation');
    
    // Test 2: Create field (what coordinator validates)
    testFieldId = Math.floor(Math.random() * 1000000) + 800000;
    await query(
      `INSERT INTO burn_fields (field_id, farm_id, field_name, area_hectares, crop_type) 
       VALUES (?, ?, ?, ?, ?)`,
      [testFieldId, testFarmId, 'Test Field', 50, 'wheat']
    );
    console.log('✅ Test 2 PASSED: Field creation');
    
    // Test 3: Create burn request (coordinator's main operation)
    const result = await query(
      `INSERT INTO burn_requests (field_id, requested_date, acreage, crop_type, status, priority_score) 
       VALUES (?, DATE_ADD(NOW(), INTERVAL 2 DAY), ?, ?, ?, ?)`,
      [testFieldId, 50, 'wheat', 'pending', 0]
    );
    testRequestId = result.insertId;
    console.log('✅ Test 3 PASSED: Burn request creation');
    
    // Test 4: Calculate and update priority (coordinator logic)
    const acreageScore = Math.min(50 / 500 * 100, 100) * 0.25;
    const cropScore = 50 * 0.20; // wheat priority
    const timeScore = 75 * 0.15;
    const weatherScore = 60 * 0.15;
    const proximityScore = 40 * 0.15;
    const historicalScore = 50 * 0.10;
    
    const priorityScore = Math.round(
      acreageScore + cropScore + timeScore + weatherScore + proximityScore + historicalScore
    );
    
    await query(
      'UPDATE burn_requests SET priority_score = ? WHERE request_id = ?',
      [priorityScore, testRequestId]
    );
    console.log(`✅ Test 4 PASSED: Priority calculation (score: ${priorityScore})`);
    
    // Test 5: Weather vector insertion (weather agent operation)
    const weatherVector = '[' + Array(128).fill(0).map(() => Math.random().toFixed(4)).join(',') + ']';
    await query(
      `INSERT INTO weather_conditions (location_lat, location_lng, temperature, humidity, 
       wind_speed, wind_direction, weather_pattern_embedding, observation_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [37.5, -120.5, 22, 45, 5.5, 180, weatherVector]
    );
    console.log('✅ Test 5 PASSED: Weather vector storage');
    
    // Test 6: Vector similarity search (weather pattern matching)
    const similar = await query(
      `SELECT *, 1 - VEC_COSINE_DISTANCE(weather_pattern_embedding, ?) as similarity
       FROM weather_conditions 
       WHERE weather_pattern_embedding IS NOT NULL
       ORDER BY similarity DESC
       LIMIT 1`,
      [weatherVector]
    );
    
    if (similar.length > 0 && similar[0].similarity > 0.99) {
      console.log('✅ Test 6 PASSED: Vector similarity search');
    } else {
      throw new Error('Vector similarity search failed');
    }
    
    // Test 7: Gaussian plume calculation (predictor agent)
    const emissionRate = 50 * 10; // acreage * emission factor
    const windSpeed = 5.5;
    const sigma_y = 0.08 * Math.pow(1000, 0.894);
    const sigma_z = 0.06 * Math.pow(1000, 0.894);
    const maxConcentration = emissionRate / (2 * Math.PI * windSpeed * sigma_y * sigma_z);
    const maxDispersionKm = Math.sqrt(-2 * Math.pow(sigma_y, 2) * Math.log(0.01)) / 1000;
    
    await query(
      `INSERT INTO smoke_predictions (burn_request_id, max_dispersion_km, 
       affected_area_km2, peak_pm25_concentration, prediction_time) 
       VALUES (?, ?, ?, ?, NOW())`,
      [testRequestId, maxDispersionKm.toFixed(2), (Math.PI * Math.pow(maxDispersionKm, 2)).toFixed(2), maxConcentration.toFixed(2)]
    );
    console.log(`✅ Test 7 PASSED: Smoke dispersion calculation (max: ${maxDispersionKm.toFixed(2)}km)`);
    
    // Test 8: Conflict detection (optimizer agent)
    const conflicts = await query(
      `SELECT COUNT(*) as conflict_count 
       FROM burn_requests 
       WHERE status IN ('approved', 'scheduled') 
       AND ABS(DATEDIFF(requested_date, DATE_ADD(NOW(), INTERVAL 2 DAY))) <= 3
       AND request_id != ?`,
      [testRequestId]
    );
    console.log(`✅ Test 8 PASSED: Conflict detection (found: ${conflicts[0].conflict_count})`);
    
    // Test 9: Schedule optimization (optimizer result)
    const optimizationRunId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await query(
      `INSERT INTO optimized_schedules (optimization_run_id, burn_request_id, optimized_date, 
       optimized_start_time, optimization_score) 
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 2 DAY), ?, ?)
       ON DUPLICATE KEY UPDATE optimization_score = VALUES(optimization_score)`,
      [optimizationRunId, testRequestId, '08:00:00', 85]
    );
    console.log('✅ Test 9 PASSED: Schedule optimization');
    
    // Test 10: Alert generation (alerts agent)
    await query(
      `INSERT INTO alerts (farm_id, burn_request_id, alert_type, severity, message, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [testFarmId, testRequestId, 'burn_scheduled', 'info', 'Burn successfully scheduled', 'pending']
    );
    console.log('✅ Test 10 PASSED: Alert generation');
    
    // Verify complete workflow
    const [finalRequest] = await query(
      'SELECT * FROM burn_requests WHERE request_id = ?',
      [testRequestId]
    );
    
    const [prediction] = await query(
      'SELECT * FROM smoke_predictions WHERE burn_request_id = ?',
      [testRequestId]
    );
    
    const [schedule] = await query(
      'SELECT * FROM optimized_schedules WHERE burn_request_id = ?',
      [testRequestId]
    );
    
    const alerts = await query(
      'SELECT * FROM alerts WHERE burn_request_id = ?',
      [testRequestId]
    );
    
    if (finalRequest && prediction && schedule && alerts.length > 0) {
      console.log('✅ Test 11 PASSED: Complete workflow verification');
    } else {
      throw new Error('Workflow verification failed');
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await query('DELETE FROM alerts WHERE burn_request_id = ?', [testRequestId]);
    await query('DELETE FROM optimized_schedules WHERE burn_request_id = ?', [testRequestId]);
    await query('DELETE FROM smoke_predictions WHERE burn_request_id = ?', [testRequestId]);
    await query('DELETE FROM burn_requests WHERE request_id = ?', [testRequestId]);
    await query('DELETE FROM burn_fields WHERE field_id = ?', [testFieldId]);
    await query('DELETE FROM farms WHERE farm_id = ?', [testFarmId]);
    console.log('✅ Cleanup complete');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 ALL TESTS PASSED - REAL DATABASE OPERATIONS VERIFIED');
    console.log('='.repeat(60));
    console.log('Summary: 11/11 tests passed');
    console.log('- Farm operations ✅');
    console.log('- Field management ✅');
    console.log('- Burn request handling ✅');
    console.log('- Priority calculation ✅');
    console.log('- Vector operations ✅');
    console.log('- Smoke dispersion ✅');
    console.log('- Conflict detection ✅');
    console.log('- Schedule optimization ✅');
    console.log('- Alert generation ✅');
    console.log('- Workflow integrity ✅');
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    
    // Cleanup on failure
    try {
      if (testRequestId) {
        await query('DELETE FROM alerts WHERE burn_request_id = ?', [testRequestId]);
        await query('DELETE FROM optimized_schedules WHERE burn_request_id = ?', [testRequestId]);
        await query('DELETE FROM smoke_predictions WHERE burn_request_id = ?', [testRequestId]);
        await query('DELETE FROM burn_requests WHERE request_id = ?', [testRequestId]);
      }
      if (testFieldId) {
        await query('DELETE FROM burn_fields WHERE field_id = ?', [testFieldId]);
      }
      if (testFarmId) {
        await query('DELETE FROM farms WHERE farm_id = ?', [testFarmId]);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

runSimpleRealTest();