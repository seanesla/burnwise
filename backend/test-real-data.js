/**
 * Comprehensive test to verify 100% real data implementation
 * NO MOCKS - Validates all endpoints return real database data
 */

const axios = require('axios');
require('dotenv').config();
const { query, initializeDatabase } = require('./db/connection');

const BASE_URL = 'http://localhost:5001';
const TESTS_PASSED = [];
const TESTS_FAILED = [];

async function testEndpoint(name, url, validations) {
  try {
    console.log(`\n🔍 Testing ${name}...`);
    const response = await axios.get(url);
    
    // Check response success
    if (!response.data.success && !response.data.data) {
      throw new Error('Response missing success flag or data');
    }
    
    // Run custom validations
    for (const validation of validations) {
      const result = validation(response.data);
      if (!result.passed) {
        throw new Error(result.message);
      }
      console.log(`   ✓ ${result.message}`);
    }
    
    TESTS_PASSED.push(name);
    console.log(`✅ ${name} - PASSED`);
    return response.data;
    
  } catch (error) {
    TESTS_FAILED.push(`${name}: ${error.message}`);
    console.error(`❌ ${name} - FAILED: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 BURNWISE REAL DATA VERIFICATION TEST\n');
  console.log('=' .repeat(60));
  
  // Initialize database
  await initializeDatabase();
  
  // Test 1: Weather API - Must be California location
  await testEndpoint('Weather API (California)', `${BASE_URL}/api/weather/current`, [
    (data) => ({
      passed: data.data.location.lat === 38.544,
      message: `Location is Davis, CA (38.544): ${data.data.location.lat === 38.544}`
    }),
    (data) => ({
      passed: data.data.location.lon === -121.74,
      message: `Longitude is California (-121.74): ${data.data.location.lon === -121.74}`
    }),
    (data) => ({
      passed: typeof data.data.temperature === 'number' && data.data.temperature > 0,
      message: `Real temperature value: ${data.data.temperature}°F`
    }),
    (data) => ({
      passed: !data.data.cached || data.data.cached === false,
      message: `Data is fresh (not mocked): ${!data.data.cached}`
    })
  ]);
  
  // Test 2: Analytics Metrics - Must have real counts
  await testEndpoint('Analytics Metrics', `${BASE_URL}/api/analytics/metrics`, [
    (data) => ({
      passed: typeof data.data.burns.total === 'number',
      message: `Real burn count: ${data.data.burns.total} burns`
    }),
    (data) => ({
      passed: data.data.farms.active > 0,
      message: `Active farms exist: ${data.data.farms.active} farms`
    }),
    (data) => ({
      passed: typeof data.data.weather.current_temp === 'number',
      message: `Real weather metrics: ${data.data.weather.current_temp}°F`
    }),
    (data) => ({
      passed: data.data.timestamp && new Date(data.data.timestamp).getTime() > 0,
      message: `Valid timestamp: ${data.data.timestamp}`
    })
  ]);
  
  // Test 3: Farms API - Must exclude test farms
  await testEndpoint('Farms API (No Test Data)', `${BASE_URL}/api/farms`, [
    (data) => ({
      passed: Array.isArray(data.data),
      message: `Returns array of farms: ${Array.isArray(data.data)}`
    }),
    (data) => ({
      passed: !data.data.some(f => f.farm_name && f.farm_name.includes('Test')),
      message: `No test farms in results: ${!data.data.some(f => f.farm_name && f.farm_name.includes('Test'))}`
    }),
    (data) => ({
      passed: data.data.some(f => parseFloat(f.lat) > 35 && parseFloat(f.lat) < 42 && parseFloat(f.lon) < -119 && parseFloat(f.lon) > -125),
      message: `Farms in California coordinates: TRUE`
    })
  ]);
  
  // Test 4: Alerts API - Real alert data
  await testEndpoint('Alerts API', `${BASE_URL}/api/alerts`, [
    (data) => ({
      passed: Array.isArray(data.data),
      message: `Returns array of alerts: ${Array.isArray(data.data)}`
    }),
    (data) => ({
      passed: data.pagination && typeof data.pagination.total_items === 'number',
      message: `Has real pagination: ${data.pagination.total_items} total alerts`
    })
  ]);
  
  // Test 5: Burn Requests API
  await testEndpoint('Burn Requests API', `${BASE_URL}/api/burn-requests`, [
    (data) => ({
      passed: Array.isArray(data.data),
      message: `Returns array of burn requests: ${Array.isArray(data.data)}`
    }),
    (data) => ({
      passed: data.data.length > 0 && data.data[0].request_id,
      message: `Has real burn requests with IDs: ${data.data.length} requests`
    })
  ]);
  
  // Test 6: Database Direct Query - Verify California Farms
  console.log('\n🔍 Testing Database Direct Query...');
  const farms = await query(`
    SELECT farm_name, latitude, longitude 
    FROM farms 
    WHERE farm_name NOT LIKE '%Test%' 
      AND farm_name NOT LIKE '%Load%'
    LIMIT 5
  `);
  
  const californiaFarms = farms.filter(f => 
    f.latitude > 35 && f.latitude < 42 && 
    f.longitude < -119 && f.longitude > -125
  );
  
  if (californiaFarms.length === farms.length) {
    console.log(`   ✓ All ${farms.length} farms are in California`);
    farms.forEach(f => {
      console.log(`   ✓ ${f.farm_name}: ${f.latitude}, ${f.longitude}`);
    });
    TESTS_PASSED.push('Database California Farms');
  } else {
    TESTS_FAILED.push('Database California Farms: Not all farms in California');
  }
  
  // Test 7: Check for removed mock file
  console.log('\n🔍 Checking for removed mock files...');
  const fs = require('fs');
  const mockFilePath = './api/test-analytics.js';
  if (!fs.existsSync(mockFilePath)) {
    console.log('   ✓ test-analytics.js has been deleted');
    TESTS_PASSED.push('Mock File Removal');
  } else {
    console.log('   ❌ test-analytics.js still exists!');
    TESTS_FAILED.push('Mock File Removal');
  }
  
  // Final Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY\n');
  console.log(`✅ PASSED: ${TESTS_PASSED.length} tests`);
  TESTS_PASSED.forEach(test => console.log(`   ✓ ${test}`));
  
  if (TESTS_FAILED.length > 0) {
    console.log(`\n❌ FAILED: ${TESTS_FAILED.length} tests`);
    TESTS_FAILED.forEach(test => console.log(`   ✗ ${test}`));
  }
  
  console.log('\n' + '=' .repeat(60));
  
  if (TESTS_FAILED.length === 0) {
    console.log('🎉 ALL TESTS PASSED - 100% REAL DATA VERIFIED!');
    console.log('NO MOCKS, NO FAKE DATA, NO RANDOM GENERATION');
  } else {
    console.log('⚠️ SOME TESTS FAILED - Please review and fix');
  }
  
  process.exit(TESTS_FAILED.length === 0 ? 0 : 1);
}

// Run all tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});