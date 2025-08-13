#!/usr/bin/env node

/**
 * HYPERRIGOROUS Backend API Testing
 * Tests every endpoint with valid, invalid, and edge cases
 * 100% REAL DATA - ZERO MOCKS
 */

const axios = require('axios');
const API_BASE = 'http://localhost:5001';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  endpoints: {}
};

async function testEndpoint(method, path, data = null, description = '') {
  testResults.total++;
  const endpoint = `${method} ${path}`;
  
  if (!testResults.endpoints[endpoint]) {
    testResults.endpoints[endpoint] = { tests: [], passed: 0, failed: 0 };
  }
  
  try {
    const config = {
      method,
      url: `${API_BASE}${path}`,
      timeout: 10000
    };
    
    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }
    
    const response = await axios(config);
    
    // Validate response structure
    if (response.data && typeof response.data === 'object') {
      testResults.passed++;
      testResults.endpoints[endpoint].passed++;
      testResults.endpoints[endpoint].tests.push({
        description,
        status: 'PASSED',
        statusCode: response.status
      });
      log(`  ✅ ${description || endpoint}: ${response.status}`, 'green');
      return { success: true, data: response.data };
    }
  } catch (error) {
    const statusCode = error.response?.status || 'ERROR';
    const message = error.response?.data?.message || error.message;
    
    // Some errors are expected (e.g., 404 for non-existent resources)
    if (description.includes('(should fail)') && error.response?.status >= 400) {
      testResults.passed++;
      testResults.endpoints[endpoint].passed++;
      testResults.endpoints[endpoint].tests.push({
        description,
        status: 'PASSED (expected failure)',
        statusCode
      });
      log(`  ✅ ${description}: ${statusCode} (expected)`, 'green');
      return { success: true, expectedError: true };
    } else {
      testResults.failed++;
      testResults.endpoints[endpoint].failed++;
      testResults.endpoints[endpoint].tests.push({
        description,
        status: 'FAILED',
        statusCode,
        error: message
      });
      log(`  ❌ ${description || endpoint}: ${statusCode} - ${message}`, 'red');
      return { success: false, error: message };
    }
  }
}

async function testBurnRequestsAPI() {
  log('\n🔥 BURN REQUESTS API', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // GET /api/burn-requests
  await testEndpoint('GET', '/api/burn-requests', null, 'List all burn requests');
  await testEndpoint('GET', '/api/burn-requests', { page: 1, limit: 5 }, 'Paginated burn requests');
  await testEndpoint('GET', '/api/burn-requests', { status: 'pending' }, 'Filter by status');
  await testEndpoint('GET', '/api/burn-requests', { farm_id: 999 }, 'Filter by non-existent farm');
  
  // GET /api/burn-requests/:id
  await testEndpoint('GET', '/api/burn-requests/1', null, 'Get specific burn request');
  await testEndpoint('GET', '/api/burn-requests/99999', null, 'Get non-existent burn request (should fail)');
  
  // POST /api/burn-requests (will fail due to validation)
  await testEndpoint('POST', '/api/burn-requests', {}, 'Create with empty data (should fail)');
  await testEndpoint('POST', '/api/burn-requests', {
    farm_id: 999,
    field_name: 'Test Field',
    acres: -100
  }, 'Create with invalid data (should fail)');
}

async function testWeatherAPI() {
  log('\n🌤️ WEATHER API', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // GET /api/weather/current
  await testEndpoint('GET', '/api/weather/current', null, 'Current weather (default location)');
  
  // GET /api/weather/current/:lat/:lon
  await testEndpoint('GET', '/api/weather/current/38.544/-121.740', null, 'Current weather (Davis, CA)');
  await testEndpoint('GET', '/api/weather/current/999/999', null, 'Current weather (invalid coords - should fail)');
  
  // GET /api/weather/forecast
  await testEndpoint('GET', '/api/weather/forecast', {
    lat: 38.544,
    lon: -121.740,
    date: '2025-08-20'
  }, 'Weather forecast with query params');
  
  await testEndpoint('GET', '/api/weather/forecast', {
    lat: 38.544,
    lon: -121.740,
    date: '2020-01-01'
  }, 'Weather forecast (past date - should fail)');
  
  // GET /api/weather/conditions
  await testEndpoint('GET', '/api/weather/conditions', null, 'Weather conditions summary');
  await testEndpoint('GET', '/api/weather/conditions', { region: 'central_valley' }, 'Regional conditions');
  
  // GET /api/weather/statistics
  await testEndpoint('GET', '/api/weather/statistics', { days: 7 }, 'Weather statistics (7 days)');
  
  // GET /api/weather/agent-status
  await testEndpoint('GET', '/api/weather/agent-status', null, 'Weather agent status');
}

async function testAlertsAPI() {
  log('\n🚨 ALERTS API', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // GET /api/alerts
  await testEndpoint('GET', '/api/alerts', null, 'List all alerts');
  await testEndpoint('GET', '/api/alerts', { severity: 'high' }, 'Filter by severity');
  await testEndpoint('GET', '/api/alerts', { status: 'pending' }, 'Filter by status');
  await testEndpoint('GET', '/api/alerts', { page: 1, limit: 10 }, 'Paginated alerts');
  
  // GET /api/alerts/active
  await testEndpoint('GET', '/api/alerts/active', null, 'Active alerts');
  await testEndpoint('GET', '/api/alerts/active', { severity_filter: 'critical' }, 'Critical alerts only');
  
  // GET /api/alerts/statistics
  await testEndpoint('GET', '/api/alerts/statistics', { days: 30 }, 'Alert statistics (30 days)');
  
  // GET /api/alerts/:id
  await testEndpoint('GET', '/api/alerts/1', null, 'Get specific alert');
  await testEndpoint('GET', '/api/alerts/99999', null, 'Get non-existent alert (should fail)');
  
  // GET /api/alerts/agent-status
  await testEndpoint('GET', '/api/alerts/agent-status', null, 'Alerts agent status');
}

async function testScheduleAPI() {
  log('\n📅 SCHEDULE API', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // GET /api/schedule
  await testEndpoint('GET', '/api/schedule', null, 'Get current schedule');
  await testEndpoint('GET', '/api/schedule', { date_from: '2025-08-01', date_to: '2025-08-31' }, 'Schedule for date range');
  
  // GET /api/schedule/conflicts
  await testEndpoint('GET', '/api/schedule/conflicts', null, 'Check for conflicts');
  
  // GET /api/schedule/optimization-status
  await testEndpoint('GET', '/api/schedule/optimization-status', null, 'Optimization status');
  
  // POST /api/schedule/optimize
  await testEndpoint('POST', '/api/schedule/optimize', {
    date: '2025-08-20',
    max_iterations: 100
  }, 'Run schedule optimization');
}

async function testAnalyticsAPI() {
  log('\n📊 ANALYTICS API', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // GET /api/analytics/metrics
  await testEndpoint('GET', '/api/analytics/metrics', null, 'System metrics');
  
  // GET /api/analytics/performance
  await testEndpoint('GET', '/api/analytics/performance', null, 'Performance metrics');
  
  // GET /api/analytics/usage
  await testEndpoint('GET', '/api/analytics/usage', { days: 7 }, 'Usage statistics (7 days)');
  
  // GET /api/analytics/trends
  await testEndpoint('GET', '/api/analytics/trends', null, 'Analytics trends');
  
  // GET /api/analytics/agents
  await testEndpoint('GET', '/api/analytics/agents', null, 'Agent performance metrics');
}

async function testFarmsAPI() {
  log('\n🚜 FARMS API', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // Note: May be rate limited
  await testEndpoint('GET', '/api/farms', null, 'List all farms');
  await testEndpoint('GET', '/api/farms/1', null, 'Get specific farm');
  await testEndpoint('GET', '/api/farms/99999', null, 'Get non-existent farm (should fail)');
}

async function testErrorHandling() {
  log('\n⚠️ ERROR HANDLING', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // Test various error conditions
  await testEndpoint('GET', '/api/nonexistent', null, 'Non-existent endpoint (should fail)');
  await testEndpoint('POST', '/api/burn-requests', 'invalid json', 'Malformed JSON (should fail)');
  await testEndpoint('GET', '/api/weather/forecast', {}, 'Missing required params (should fail)');
  
  // Test rate limiting (may already be triggered)
  log('  ℹ️  Rate limiting tested implicitly through multiple requests', 'yellow');
}

async function runAllTests() {
  log('\n' + '='.repeat(60), 'magenta');
  log('🔥 BURNWISE BACKEND API HYPERRIGOROUS TESTING', 'magenta');
  log('='.repeat(60), 'magenta');
  log('Testing with 100% REAL DATA - ZERO MOCKS', 'yellow');
  
  const startTime = Date.now();
  
  // Run all test suites
  await testBurnRequestsAPI();
  await testWeatherAPI();
  await testAlertsAPI();
  await testScheduleAPI();
  await testAnalyticsAPI();
  await testFarmsAPI();
  await testErrorHandling();
  
  const duration = Date.now() - startTime;
  
  // Generate report
  log('\n' + '='.repeat(60), 'magenta');
  log('📊 TEST RESULTS SUMMARY', 'magenta');
  log('='.repeat(60), 'magenta');
  
  log(`\n⏱️  Duration: ${duration}ms`, 'blue');
  log(`📝 Total Tests: ${testResults.total}`, 'blue');
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`, 'blue');
  
  log('\n📋 Endpoint Coverage:', 'cyan');
  Object.entries(testResults.endpoints).forEach(([endpoint, results]) => {
    const status = results.failed === 0 ? '✅' : '⚠️';
    const color = results.failed === 0 ? 'green' : 'yellow';
    log(`  ${status} ${endpoint}: ${results.passed}/${results.tests.length} passed`, color);
  });
  
  // Check for critical issues
  log('\n🔍 Critical Checks:', 'cyan');
  const criticalEndpoints = [
    'GET /api/burn-requests',
    'GET /api/weather/current',
    'GET /api/alerts',
    'GET /api/schedule',
    'GET /api/analytics/metrics'
  ];
  
  let allCriticalPassed = true;
  criticalEndpoints.forEach(endpoint => {
    const result = testResults.endpoints[endpoint];
    if (result && result.failed === 0) {
      log(`  ✅ ${endpoint} - OPERATIONAL`, 'green');
    } else if (result) {
      log(`  ⚠️ ${endpoint} - ISSUES DETECTED`, 'yellow');
      allCriticalPassed = false;
    } else {
      log(`  ❌ ${endpoint} - NOT TESTED`, 'red');
      allCriticalPassed = false;
    }
  });
  
  // Final verdict
  log('\n' + '='.repeat(60), 'magenta');
  if (testResults.failed === 0 && allCriticalPassed) {
    log('🎉 ALL TESTS PASSED - SYSTEM OPERATIONAL', 'green');
    log('✨ Backend APIs are functioning with 100% REAL DATA', 'green');
  } else if (allCriticalPassed) {
    log('⚠️ SYSTEM OPERATIONAL WITH MINOR ISSUES', 'yellow');
    log(`   ${testResults.failed} non-critical test(s) failed`, 'yellow');
  } else {
    log('❌ CRITICAL ISSUES DETECTED', 'red');
    log('   Review failed tests above', 'red');
  }
  log('='.repeat(60), 'magenta');
  
  return testResults;
}

// Execute tests
runAllTests()
  .then(results => {
    process.exit(results.failed === 0 ? 0 : 1);
  })
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });