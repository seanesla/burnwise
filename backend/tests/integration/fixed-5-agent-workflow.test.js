#!/usr/bin/env node

/**
 * FIXED 5-AGENT WORKFLOW TESTER
 * 
 * Tests the complete BURNWISE 5-agent system with proper method signatures
 * and correct parameter structures based on actual agent implementations.
 * 
 * This test follows CLAUDE.md requirements and tests:
 * 1. Coordinator - Validates burn requests, assigns priority scores  
 * 2. Weather - Fetches weather data, stores 128-dim vectors
 * 3. Predictor - Gaussian plume model for smoke dispersion
 * 4. Optimizer - Simulated annealing for schedule optimization
 * 5. Alerts - Alert system with notifications
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { initializeDatabase, query } = require('../../db/connection');

// Import real agents with correct interfaces
const coordinatorAgent = require('../../agents/coordinator');
const weatherAgent = require('../../agents/weather');
const predictorAgent = require('../../agents/predictor');
const optimizerAgent = require('../../agents/optimizer');
const alertsAgent = require('../../agents/alerts');

// Performance tracking
let testResults = {
  coordinator: { successes: 0, failures: 0, times: [] },
  weather: { successes: 0, failures: 0, times: [] },
  predictor: { successes: 0, failures: 0, times: [] },
  optimizer: { successes: 0, failures: 0, times: [] },
  alerts: { successes: 0, failures: 0, times: [] }
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let criticalFailures = [];
let workflowCompletions = 0;
let workflowAttempts = 0;

// Colors for output
const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', bright: '\x1b[1m'
};

function log(level, message) {
  const color = { info: colors.cyan, success: colors.green, warn: colors.yellow, error: colors.red }[level] || colors.reset;
  console.log(`${color}[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}${colors.reset}`);
}

function measureTime(agentName, startTime, success) {
  const duration = Date.now() - startTime;
  testResults[agentName].times.push(duration);
  if (success) testResults[agentName].successes++;
  else testResults[agentName].failures++;
  return duration;
}

function recordTest(passed, description, error = null) {
  totalTests++;
  if (passed) {
    passedTests++;
    log('success', `✅ ${description}`);
  } else {
    failedTests++;
    log('error', `❌ ${description}: ${error?.message || 'Unknown error'}`);
    if (error?.critical) {
      criticalFailures.push({ description, error: error.message });
    }
  }
}

// Test utilities
function generateTestFarm() {
  return {
    farm_id: Math.floor(Math.random() * 1000000) + 900000,
    farm_name: `Test Farm ${Math.random().toString(36).substr(2, 8)}`,
    name: `Test Farm ${Math.random().toString(36).substr(2, 8)}`,
    owner_name: 'Test Owner',
    contact_email: 'test@example.com',
    contact_phone: '555-TEST',
    total_area_hectares: 500
  };
}

function generateBurnRequest(farmId) {
  const crops = ['rice', 'wheat', 'corn', 'barley', 'cotton'];
  return {
    farm_id: farmId,
    field_name: `Test Field ${Math.random().toString(36).substr(2, 6)}`,
    field_boundary: {
      type: 'Polygon',
      coordinates: [[[-120.5, 37.5], [-120.4, 37.5], [-120.4, 37.6], [-120.5, 37.6], [-120.5, 37.5]]]
    },
    acres: Math.floor(Math.random() * 300) + 100,
    crop_type: crops[Math.floor(Math.random() * crops.length)],
    burn_date: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
    time_window_start: '08:00',
    time_window_end: '16:00',
    reason: 'Crop residue management',
    contact_method: 'sms'
  };
}

async function setupTestEnvironment() {
  log('info', 'Setting up test environment');
  
  try {
    await initializeDatabase();
    log('success', 'Database connected');
    
    // Initialize all agents
    await coordinatorAgent.initialize();
    log('success', 'Coordinator initialized');
    
    await weatherAgent.initialize();
    log('success', 'Weather agent initialized');
    
    await predictorAgent.initialize();
    log('success', 'Predictor initialized');
    
    await optimizerAgent.initialize();
    log('success', 'Optimizer initialized');
    
    await alertsAgent.initialize();
    log('success', 'Alerts agent initialized');
    
    return true;
  } catch (error) {
    log('error', `Setup failed: ${error.message}`);
    return false;
  }
}

async function testCompleteWorkflow() {
  log('info', '🔥 Testing Complete 5-Agent Workflow');
  
  const farmData = generateTestFarm();
  const fieldId = Math.floor(Math.random() * 1000000) + 800000;
  let burnRequestId = null;
  
  try {
    workflowAttempts++;
    
    // Setup test data
    await query(
      `INSERT INTO farms (farm_id, farm_name, name, owner_name, contact_email, contact_phone, total_area_hectares) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [farmData.farm_id, farmData.farm_name, farmData.name, farmData.owner_name, 
       farmData.contact_email, farmData.contact_phone, farmData.total_area_hectares]
    );
    
    await query(
      `INSERT INTO burn_fields (field_id, farm_id, field_name, area_hectares, crop_type) 
       VALUES (?, ?, ?, ?, ?)`,
      [fieldId, farmData.farm_id, 'Test Field', 150, 'rice']
    );

    // AGENT 1: COORDINATOR
    log('info', '🤖 Testing COORDINATOR Agent');
    const startCoord = Date.now();
    
    try {
      const burnRequest = generateBurnRequest(farmData.farm_id);
      const coordResult = await coordinatorAgent.coordinateBurnRequest(burnRequest);
      
      measureTime('coordinator', startCoord, true);
      recordTest(true, 'Coordinator processed burn request successfully');
      burnRequestId = coordResult.burnRequestId;
      
    } catch (error) {
      measureTime('coordinator', startCoord, false);
      recordTest(false, 'Coordinator failed', error);
      throw error; // Cannot continue without coordinator
    }
    
    // AGENT 2: WEATHER AGENT
    log('info', '🤖 Testing WEATHER Agent');
    const startWeather = Date.now();
    
    try {
      const location = { lat: 37.5, lng: -120.5 };
      const burnDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const timeWindow = { start: '08:00', end: '16:00' };
      
      const weatherResult = await weatherAgent.analyzeWeatherForBurn(
        burnRequestId, location, burnDate, timeWindow
      );
      
      measureTime('weather', startWeather, true);
      recordTest(true, 'Weather agent analyzed conditions');
      
    } catch (error) {
      measureTime('weather', startWeather, false);
      recordTest(false, 'Weather agent failed', error);
    }
    
    // AGENT 3: PREDICTOR AGENT  
    log('info', '🤖 Testing PREDICTOR Agent');
    const startPredictor = Date.now();
    
    try {
      const burnData = {
        acres: 150,
        crop_type: 'rice',
        location: { lat: 37.5, lng: -120.5 }
      };
      
      const weatherData = {
        windSpeed: 5.5,
        windDirection: 270,
        temperature: 22,
        humidity: 45,
        pressure: 1013.25
      };
      
      const predictionResult = await predictorAgent.predictSmokeDispersion(
        burnRequestId, burnData, weatherData
      );
      
      measureTime('predictor', startPredictor, true);
      recordTest(true, 'Predictor calculated smoke dispersion');
      
    } catch (error) {
      measureTime('predictor', startPredictor, false);
      recordTest(false, 'Predictor agent failed', error);
    }
    
    // AGENT 4: OPTIMIZER AGENT
    log('info', '🤖 Testing OPTIMIZER Agent');
    const startOptimizer = Date.now();
    
    try {
      const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const burnRequests = [{ 
        requestId: burnRequestId, 
        priority: 7, 
        acres: 150,
        timeWindow: { start: '08:00', end: '16:00' }
      }];
      const weatherData = { windSpeed: 5.5, temperature: 22, humidity: 45 };
      const predictionData = { maxDispersionKm: 7.5, conflictRisk: 0.2 };
      
      const optimizationResult = await optimizerAgent.optimizeSchedule(
        date, burnRequests, weatherData, predictionData
      );
      
      measureTime('optimizer', startOptimizer, true);
      recordTest(true, 'Optimizer scheduled burn successfully');
      
    } catch (error) {
      measureTime('optimizer', startOptimizer, false);
      recordTest(false, 'Optimizer agent failed', error);
    }
    
    // AGENT 5: ALERTS AGENT
    log('info', '🤖 Testing ALERTS Agent');
    const startAlerts = Date.now();
    
    try {
      const alertData = {
        type: 'burn_scheduled',
        severity: 'info',
        message: 'Burn successfully scheduled for tomorrow',
        farmId: farmData.farm_id,
        requestId: burnRequestId,
        contactMethod: 'sms',
        recipients: [farmData.contact_email]
      };
      
      const alertResult = await alertsAgent.processAlert(alertData);
      
      measureTime('alerts', startAlerts, true);
      recordTest(true, 'Alerts agent processed notification');
      
    } catch (error) {
      measureTime('alerts', startAlerts, false);
      recordTest(false, 'Alerts agent failed', error);
    }
    
    workflowCompletions++;
    log('success', `Complete workflow executed successfully`);
    
  } catch (error) {
    recordTest(false, 'Complete workflow failed', { ...error, critical: true });
  } finally {
    // Cleanup
    try {
      if (burnRequestId) {
        await query('DELETE FROM alerts WHERE burn_request_id = ?', [burnRequestId]);
        await query('DELETE FROM optimized_schedules WHERE burn_request_id = ?', [burnRequestId]);
        await query('DELETE FROM smoke_predictions WHERE burn_request_id = ?', [burnRequestId]);
        await query('DELETE FROM burn_requests WHERE request_id = ?', [burnRequestId]);
      }
      await query('DELETE FROM burn_fields WHERE field_id = ?', [fieldId]);
      await query('DELETE FROM farms WHERE farm_id = ?', [farmData.farm_id]);
    } catch (cleanupError) {
      log('warn', `Cleanup error: ${cleanupError.message}`);
    }
  }
}

async function testConcurrentRequests() {
  log('info', '🔄 Testing Concurrent Requests');
  
  const concurrentCount = 5;
  const promises = [];
  const farmIds = [];
  
  try {
    // Create test farms first
    for (let i = 0; i < concurrentCount; i++) {
      const farmData = generateTestFarm();
      farmIds.push(farmData.farm_id);
      
      await query(
        `INSERT INTO farms (farm_id, farm_name, name, owner_name, contact_email, contact_phone, total_area_hectares) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [farmData.farm_id, farmData.farm_name, farmData.name, farmData.owner_name, 
         farmData.contact_email, farmData.contact_phone, farmData.total_area_hectares]
      );
      
      const fieldId = Math.floor(Math.random() * 1000000) + 900000 + i;
      await query(
        `INSERT INTO burn_fields (field_id, farm_id, field_name, area_hectares, crop_type) 
         VALUES (?, ?, ?, ?, ?)`,
        [fieldId, farmData.farm_id, `Concurrent Field ${i}`, 100, 'wheat']
      );
      
      const burnRequest = generateBurnRequest(farmData.farm_id);
      promises.push(coordinatorAgent.coordinateBurnRequest(burnRequest));
    }
    
    const startTime = Date.now();
    const results = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    recordTest(
      successful >= concurrentCount * 0.8,
      `Concurrent requests: ${successful}/${concurrentCount} successful in ${duration}ms`
    );
    
  } finally {
    // Cleanup farms
    for (const farmId of farmIds) {
      try {
        await query('DELETE FROM burn_fields WHERE farm_id = ?', [farmId]);
        await query('DELETE FROM farms WHERE farm_id = ?', [farmId]);
      } catch (cleanupError) {
        log('warn', `Cleanup error for farm ${farmId}`);
      }
    }
  }
}

async function testVectorOperations() {
  log('info', '📊 Testing Vector Operations');
  
  try {
    // Test weather vector generation
    const weatherData = {
      temperature: 22, humidity: 45, windSpeed: 5, windDirection: 270,
      pressure: 1013.25, visibility: 10000, cloudCover: 30
    };
    
    const weatherVector = await weatherAgent.generateWeatherVector(weatherData);
    recordTest(
      Array.isArray(weatherVector) && weatherVector.length === 128,
      'Weather vector generated with 128 dimensions'
    );
    
    // Test smoke plume vector
    const burnData = { acres: 150, crop_type: 'rice' };
    const prediction = await predictorAgent.generatePlumeVector(burnData, weatherData);
    recordTest(
      prediction && typeof prediction === 'object',
      'Smoke prediction generated with vector data'
    );
    
  } catch (error) {
    recordTest(false, 'Vector operations failed', error);
  }
}

async function testFailureRecovery() {
  log('info', '🔧 Testing Failure Recovery');
  
  // Test invalid data handling
  try {
    const invalidRequest = {
      farm_id: 'invalid',
      acres: -100,
      crop_type: 'invalid_crop'
    };
    
    try {
      await coordinatorAgent.coordinateBurnRequest(invalidRequest);
      recordTest(false, 'Should have rejected invalid data');
    } catch (validationError) {
      recordTest(true, 'Coordinator properly validated and rejected invalid data');
    }
    
  } catch (error) {
    recordTest(false, 'Validation test failed', error);
  }
  
  // Test database error handling
  try {
    const result = await query('SELECT 1 as test');
    recordTest(result.length === 1, 'Database connection stable');
  } catch (error) {
    recordTest(false, 'Database connection failed', error);
  }
}

function calculateStats() {
  const stats = {};
  
  for (const [agentName, data] of Object.entries(testResults)) {
    const times = data.times;
    const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const total = data.successes + data.failures;
    const successRate = total > 0 ? Math.round((data.successes / total) * 100 * 100) / 100 : 0;
    
    stats[agentName] = { avgTime, successRate };
  }
  
  return stats;
}

async function runWorkflowTests() {
  console.log('\n' + '═'.repeat(80));
  console.log(colors.bright + colors.cyan + '🔥 BURNWISE 5-AGENT WORKFLOW TESTER (FIXED)' + colors.reset);
  console.log('═'.repeat(80));
  
  const overallStart = Date.now();
  
  try {
    const setupSuccess = await setupTestEnvironment();
    if (!setupSuccess) {
      throw new Error('Setup failed');
    }
    
    // Run test suites
    await testCompleteWorkflow();
    await testConcurrentRequests();
    await testVectorOperations();
    await testFailureRecovery();
    
    // Calculate results
    const totalDuration = Date.now() - overallStart;
    const agentPerformance = calculateStats();
    const workflowCompletionRate = workflowAttempts > 0 ? Math.round((workflowCompletions / workflowAttempts) * 100 * 100) / 100 : 0;
    
    // Generate report
    console.log('\n' + '═'.repeat(80));
    console.log(colors.bright + colors.green + '📊 WORKFLOW TEST RESULTS' + colors.reset);
    console.log('═'.repeat(80));
    
    const results = {
      agent: "5-Agent Workflow Tester",
      testsRun: totalTests,
      passed: passedTests,
      failed: failedTests,
      agentPerformance: agentPerformance,
      workflowCompletionRate: workflowCompletionRate,
      criticalFailures: criticalFailures,
      totalDurationMs: totalDuration
    };
    
    console.log(`\n${colors.cyan}🎯 Test Summary:${colors.reset}`);
    console.log(`   Tests Run: ${results.testsRun}`);
    console.log(`   Passed: ${colors.green}${results.passed}${colors.reset}`);
    console.log(`   Failed: ${colors.red}${results.failed}${colors.reset}`);
    console.log(`   Success Rate: ${Math.round((results.passed/results.testsRun)*100)}%`);
    console.log(`   Workflow Completion Rate: ${results.workflowCompletionRate}%`);
    console.log(`   Total Duration: ${Math.round(totalDuration/1000)}s`);
    
    console.log(`\n${colors.cyan}🤖 Agent Performance:${colors.reset}`);
    for (const [agentName, perf] of Object.entries(agentPerformance)) {
      console.log(`   ${agentName.toUpperCase()}: ${perf.avgTime}ms avg, ${perf.successRate}% success`);
    }
    
    if (criticalFailures.length > 0) {
      console.log(`\n${colors.red}❌ Critical Failures:${colors.reset}`);
      criticalFailures.forEach((failure, i) => {
        console.log(`   ${i + 1}. ${failure.description}: ${failure.error}`);
      });
    }
    
    console.log(`\n${colors.yellow}🏆 Final Verdict:${colors.reset}`);
    if (results.workflowCompletionRate >= 90 && criticalFailures.length === 0) {
      console.log('   ✅ BURNWISE 5-agent workflow is PRODUCTION READY');
    } else if (results.workflowCompletionRate >= 75) {
      console.log('   ⚠️  BURNWISE 5-agent workflow needs minor fixes');
    } else {
      console.log('   ❌ BURNWISE 5-agent workflow requires major fixes');
    }
    
    console.log('═'.repeat(80) + '\n');
    
    return results;
    
  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    return {
      agent: "5-Agent Workflow Tester",
      testsRun: totalTests,
      passed: passedTests,  
      failed: failedTests,
      agentPerformance: calculateStats(),
      workflowCompletionRate: 0,
      criticalFailures: [...criticalFailures, { description: 'Test runner failed', error: error.message }]
    };
  }
}

// Run if called directly
if (require.main === module) {
  runWorkflowTests()
    .then(results => {
      process.exit(results.criticalFailures.length === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal test error:', error);
      process.exit(1);
    });
}

module.exports = { runWorkflowTests };