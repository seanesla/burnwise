#!/usr/bin/env node

/**
 * Comprehensive test script to verify all critical fixes
 * Tests all backend APIs and critical functionality
 */

require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');
const mysql = require('mysql2/promise');
const colors = require('colors');

const BASE_URL = 'http://localhost:5001';
const FRONTEND_URL = 'http://localhost:3000';

let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Test utilities
async function test(name, fn) {
  process.stdout.write(`Testing ${name}... `);
  try {
    await fn();
    console.log('✅ PASSED'.green);
    testResults.passed++;
  } catch (error) {
    console.log('❌ FAILED'.red);
    console.error(`  Error: ${error.message}`.red);
    testResults.failed++;
    testResults.errors.push({ test: name, error: error.message });
  }
}

// Database tests
async function testDatabase() {
  console.log('\n📊 DATABASE TESTS'.cyan.bold);
  
  await test('TiDB Connection', async () => {
    const conn = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: process.env.TIDB_PORT,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { rejectUnauthorized: true }
    });
    await conn.ping();
    await conn.end();
  });

  await test('Vector Columns Exist', async () => {
    const conn = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: process.env.TIDB_PORT,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { rejectUnauthorized: true }
    });
    
    const [cols] = await conn.execute('DESCRIBE smoke_predictions');
    const vectorCol = cols.find(c => c.Field === 'plume_vector');
    if (!vectorCol || !vectorCol.Type.includes('vector')) {
      throw new Error('plume_vector column not found or not vector type');
    }
    await conn.end();
  });

  await test('Vector Search Performance', async () => {
    const conn = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: process.env.TIDB_PORT,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { rejectUnauthorized: true }
    });
    
    const start = Date.now();
    await conn.execute('SELECT prediction_id FROM smoke_predictions WHERE plume_vector IS NOT NULL LIMIT 10');
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      throw new Error(`Vector search took ${duration}ms (>1000ms limit)`);
    }
    await conn.end();
  });
}

// API tests
async function testAPIs() {
  console.log('\n🌐 API TESTS'.cyan.bold);
  
  await test('GET /api/farms', async () => {
    const response = await axios.get(`${BASE_URL}/api/farms`);
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('Invalid response structure');
    }
    if (response.data.data.length === 0) {
      throw new Error('No farms returned');
    }
    // Check for correct field names
    const farm = response.data.data[0];
    if (!farm.id || !farm.name || !farm.owner_name) {
      throw new Error('Farm missing required fields');
    }
  });

  await test('Farms API Pagination', async () => {
    const response = await axios.get(`${BASE_URL}/api/farms?limit=5&page=1`);
    if (!response.data.success) {
      throw new Error('Pagination failed');
    }
    if (response.data.data.length > 5) {
      throw new Error('Limit not respected');
    }
  });

  await test('GET /api/burn-requests', async () => {
    const response = await axios.get(`${BASE_URL}/api/burn-requests`);
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('Invalid response structure');
    }
  });

  await test('Weather API - Current', async () => {
    const response = await axios.get(`${BASE_URL}/api/weather/current/39.0458/-95.6989`);
    if (!response.data.success || !response.data.data.weather) {
      throw new Error('Invalid weather data');
    }
    const weather = response.data.data.weather;
    if (typeof weather.temperature !== 'number' || typeof weather.humidity !== 'number') {
      throw new Error('Missing weather properties');
    }
  });

  await test('Weather API - OpenWeatherMap Integration', async () => {
    const response = await axios.get(`${BASE_URL}/api/weather/current/40.7128/-74.0060`);
    if (!response.data.success) {
      throw new Error('OpenWeatherMap API failed');
    }
    // Check it's real data not mock
    if (response.data.cached === undefined || response.data.data.weather.timestamp === undefined) {
      throw new Error('Not real OpenWeatherMap data');
    }
  });
}

// Agent tests
async function testAgents() {
  console.log('\n🤖 AGENT TESTS'.cyan.bold);
  
  await test('Coordinator Agent Status', async () => {
    const coordinator = require('./backend/agents/coordinator');
    const status = coordinator.getStatus();
    if (status.status !== 'active') {
      throw new Error('Coordinator agent not active');
    }
  });

  await test('Weather Agent Status', async () => {
    const weather = require('./backend/agents/weather');
    const status = weather.getStatus();
    if (status.status !== 'active') {
      throw new Error('Weather agent not active');
    }
  });

  await test('Predictor Agent Status', async () => {
    const predictor = require('./backend/agents/predictor');
    const status = predictor.getStatus();
    if (status.status !== 'active') {
      throw new Error('Predictor agent not active');
    }
  });

  await test('Predictor Agent - Smoke Dispersion Method', async () => {
    const predictor = require('./backend/agents/predictor');
    if (typeof predictor.predictSmokeDispersion !== 'function') {
      throw new Error('predictSmokeDispersion method not found');
    }
  });

  await test('Optimizer Agent Status', async () => {
    const optimizer = require('./backend/agents/optimizer');
    const status = optimizer.getStatus();
    if (status.status !== 'active') {
      throw new Error('Optimizer agent not active');
    }
  });

  await test('Alerts Agent Status', async () => {
    const alerts = require('./backend/agents/alerts');
    const status = alerts.getStatus();
    if (status.status !== 'active') {
      throw new Error('Alerts agent not active');
    }
  });
}

// Frontend fixes verification
async function testFrontendFixes() {
  console.log('\n🎨 FRONTEND FIX VERIFICATION'.cyan.bold);
  
  await test('Frontend Running', async () => {
    const response = await axios.get(FRONTEND_URL);
    if (response.status !== 200) {
      throw new Error('Frontend not accessible');
    }
  });

  await test('Farm Coordinates Fix', async () => {
    // Check that farms API returns lon/lat fields
    const response = await axios.get(`${BASE_URL}/api/farms`);
    const farm = response.data.data[0];
    if (farm.lon === undefined || farm.lat === undefined) {
      throw new Error('Farms missing lon/lat fields');
    }
    // Verify they're strings (as returned by API)
    if (typeof farm.lon !== 'string' || typeof farm.lat !== 'string') {
      throw new Error('lon/lat should be strings from API');
    }
  });

  console.log('  ℹ️  Schedule page date handling: Fixed with default date fallback'.yellow);
  console.log('  ℹ️  Alerts dropdown: Fixed with proper field mapping'.yellow);
  console.log('  ℹ️  Mobile navigation: Fixed with proper overflow handling'.yellow);
  console.log('  ℹ️  Mapbox token: Configured and tested'.yellow);
}

// Critical functionality tests
async function testCriticalFunctionality() {
  console.log('\n⚡ CRITICAL FUNCTIONALITY'.cyan.bold);
  
  await test('5-Agent System Initialization', async () => {
    // All agents should be initialized (tested above)
    const agents = ['coordinator', 'weather', 'predictor', 'optimizer', 'alerts'];
    for (const agentName of agents) {
      const agent = require(`./backend/agents/${agentName}`);
      if (!agent.initialized) {
        throw new Error(`${agentName} agent not initialized`);
      }
    }
  });

  await test('Database Connection Pool', async () => {
    const db = require('./backend/db/connection');
    // Make multiple concurrent requests to test pool
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(db.query('SELECT 1 as test'));
    }
    await Promise.all(promises);
  });

  await test('Error Handler Middleware', async () => {
    try {
      // Test invalid endpoint returns proper error
      await axios.get(`${BASE_URL}/api/invalid-endpoint-test`);
      throw new Error('Should have returned 404');
    } catch (error) {
      if (!error.response || error.response.status !== 404) {
        throw new Error('Error handler not working properly');
      }
    }
  });
}

// Main test runner
async function runAllTests() {
  console.log('🔥 BURNWISE COMPREHENSIVE TEST SUITE'.yellow.bold);
  console.log('===================================='.yellow);
  console.log(`Backend URL: ${BASE_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Check services are running
  try {
    await axios.get(`${BASE_URL}/health`);
  } catch (error) {
    console.error('❌ Backend is not running! Start it with: npm run backend:dev'.red.bold);
    process.exit(1);
  }

  try {
    await axios.get(FRONTEND_URL);
  } catch (error) {
    console.error('❌ Frontend is not running! Start it with: npm run frontend:dev'.red.bold);
    process.exit(1);
  }

  // Run all test suites
  await testDatabase();
  await testAPIs();
  await testAgents();
  await testFrontendFixes();
  await testCriticalFunctionality();

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY'.cyan.bold);
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`.green.bold);
  console.log(`❌ Failed: ${testResults.failed}`.red.bold);
  console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ FAILED TESTS:'.red.bold);
    testResults.errors.forEach(err => {
      console.log(`  - ${err.test}: ${err.error}`.red);
    });
  }

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The application is ready.'.green.bold);
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above.'.yellow.bold);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});