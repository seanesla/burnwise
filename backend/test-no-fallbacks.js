#!/usr/bin/env node

/**
 * NO FALLBACKS TEST
 * 
 * Simulates GPT-5-mini failures to verify:
 * 1. System FAILS when GPT-5 is unavailable
 * 2. NO silent fallbacks to fake data
 * 3. NO hardcoded responses
 * 4. Proper error propagation
 * 
 * CRITICAL: System must use REAL AI or fail - no middle ground
 */

require('dotenv').config();
const axios = require('axios');

// Test results
const testResults = {
  totalTests: 0,
  expectedFailures: 0,
  unexpectedSuccesses: 0,
  properFailures: 0,
  fallbacksDetected: []
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const color = {
    'info': colors.cyan,
    'success': colors.green,
    'warn': colors.yellow,
    'error': colors.red,
    'debug': colors.blue
  }[level] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
  if (Object.keys(data).length > 0) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Test 1: Block GPT-5 API calls and verify failure
async function testApiBlockage() {
  log('info', '\n[TEST 1] Blocking GPT-5 API calls');
  
  // Monkey-patch axios to block OpenAI calls
  const originalPost = axios.post;
  axios.post = async function(...args) {
    const [url] = args;
    
    if (url.includes('openai.com')) {
      log('warn', '  Blocking OpenAI API call');
      throw new Error('SIMULATED: OpenAI API unavailable');
    }
    
    return originalPost.apply(this, args);
  };
  
  try {
    // Try to initialize coordinator agent
    const coordinatorAgent = require('./agents/coordinator');
    await coordinatorAgent.initialize();
    
    // If we get here, it's a problem - should have failed
    log('error', '  [FAIL] Agent initialized without GPT-5!');
    testResults.unexpectedSuccesses++;
    testResults.fallbacksDetected.push('Coordinator initialized without AI');
    
  } catch (error) {
    if (error.message.includes('NO FALLBACKS') || 
        error.message.includes('REQUIRED') ||
        error.message.includes('OpenAI')) {
      log('success', '  [PASS] Agent properly failed without GPT-5');
      testResults.properFailures++;
    } else {
      log('warn', '  [WARNING] Failed but unclear error:', { error: error.message });
    }
  }
  
  // Restore axios
  axios.post = originalPost;
  testResults.totalTests++;
}

// Test 2: Invalid API key should fail
async function testInvalidApiKey() {
  log('info', '\n[TEST 2] Testing with invalid API key');
  
  // Save original key
  const originalKey = process.env.OPENAI_API_KEY;
  
  // Set invalid key
  process.env.OPENAI_API_KEY = 'sk-invalid-key-that-should-fail';
  
  try {
    // Clear any cached instances
    delete require.cache[require.resolve('./agents/weather')];
    
    const WeatherAgent = require('./agents/weather');
    const weatherAgent = new WeatherAgent();
    await weatherAgent.initialize();
    
    // Try to use the agent
    await weatherAgent.analyzeBurnConditions(
      { lat: 38.5, lng: -121.5 },
      '2025-08-20'
    );
    
    // Should not get here
    log('error', '  [FAIL] Weather agent worked with invalid key!');
    testResults.unexpectedSuccesses++;
    testResults.fallbacksDetected.push('Weather agent has fallback behavior');
    
  } catch (error) {
    log('success', '  [PASS] Weather agent failed with invalid key');
    log('debug', '  Error:', { message: error.message });
    testResults.properFailures++;
  }
  
  // Restore original key
  process.env.OPENAI_API_KEY = originalKey;
  testResults.totalTests++;
}

// Test 3: Check for hardcoded responses
async function testHardcodedResponses() {
  log('info', '\n[TEST 3] Checking for hardcoded responses');
  
  // Intercept all function returns to check for suspicious patterns
  const suspiciousPatterns = [
    /always safe/i,
    /default.*value/i,
    /placeholder/i,
    /mock/i,
    /fake/i,
    /simulated/i,
    /example/i,
    /test data/i
  ];
  
  try {
    // Check coordinator agent
    const coordinatorAgent = require('./agents/coordinator');
    
    // Look for hardcoded priority scores
    if (coordinatorAgent.calculatePriorityScore) {
      const testData = {
        acres: 100,
        crop_type: 'wheat',
        time_window_start: '08:00',
        time_window_end: '12:00'
      };
      
      const score1 = await coordinatorAgent.calculatePriorityScore(testData);
      testData.acres = 200;
      const score2 = await coordinatorAgent.calculatePriorityScore(testData);
      
      if (score1 === score2) {
        log('warn', '  [WARNING] Priority scores identical despite different inputs');
        testResults.fallbacksDetected.push('Possible hardcoded priority scores');
      } else {
        log('success', '  [PASS] Priority scores vary with input');
      }
    }
    
  } catch (error) {
    log('debug', '  Error during hardcoded check:', { error: error.message });
  }
  
  testResults.totalTests++;
}

// Test 4: Verify error messages indicate NO FALLBACKS
async function testErrorMessages() {
  log('info', '\n[TEST 4] Verifying error messages');
  
  // Check each agent's error handling
  const agents = [
    './agents/coordinator',
    './agents/weather',  
    './agents/predictor',
    './agents/optimizer',
    './agents/alerts'
  ];
  
  for (const agentPath of agents) {
    try {
      // Clear cache
      delete require.cache[require.resolve(agentPath)];
      
      // Read agent code to check for fallback patterns
      const fs = require('fs');
      const agentCode = fs.readFileSync(require.resolve(agentPath), 'utf8');
      
      // Check for NO FALLBACKS mentions
      if (agentCode.includes('NO FALLBACKS')) {
        log('success', `  [PASS] ${agentPath} has NO FALLBACKS enforcement`);
      } else {
        log('warn', `  [WARNING] ${agentPath} missing explicit NO FALLBACKS`);
      }
      
      // Check for fallback patterns
      if (agentCode.includes('|| default') || 
          agentCode.includes('catch {') && !agentCode.includes('throw')) {
        log('warn', `  [WARNING] ${agentPath} may have fallback logic`);
        testResults.fallbacksDetected.push(`${agentPath} has potential fallback`);
      }
      
    } catch (error) {
      log('debug', `  Could not check ${agentPath}:`, { error: error.message });
    }
  }
  
  testResults.totalTests++;
}

// Test 5: Simulate network failure
async function testNetworkFailure() {
  log('info', '\n[TEST 5] Simulating network failure');
  
  // Intercept all network requests
  const originalPost = axios.post;
  const originalGet = axios.get;
  
  axios.post = async () => {
    throw new Error('ECONNREFUSED: Network unavailable');
  };
  
  axios.get = async () => {
    throw new Error('ECONNREFUSED: Network unavailable');
  };
  
  try {
    // Try to use any agent
    delete require.cache[require.resolve('./agents/predictor')];
    const predictorAgent = require('./agents/predictor');
    await predictorAgent.initialize();
    
    // Should not succeed
    log('error', '  [FAIL] Predictor initialized without network!');
    testResults.unexpectedSuccesses++;
    testResults.fallbacksDetected.push('Predictor works offline');
    
  } catch (error) {
    log('success', '  [PASS] Predictor failed without network');
    testResults.properFailures++;
  }
  
  // Restore
  axios.post = originalPost;
  axios.get = originalGet;
  testResults.totalTests++;
}

async function runAllTests() {
  log('info', 'NO FALLBACKS VERIFICATION TEST');
  log('info', '=' .repeat(60));
  log('info', 'Testing that system FAILS without GPT-5 (no silent fallbacks)');
  
  await testApiBlockage();
  await testInvalidApiKey();
  await testHardcodedResponses();
  await testErrorMessages();
  await testNetworkFailure();
  
  // Generate report
  log('info', '\n' + '=' .repeat(60));
  log('info', 'NO FALLBACKS TEST REPORT');
  log('info', '=' .repeat(60));
  
  console.log(`\nTotal tests run: ${testResults.totalTests}`);
  console.log(`Expected failures (good): ${testResults.properFailures}`);
  console.log(`Unexpected successes (BAD): ${testResults.unexpectedSuccesses}`);
  console.log(`Potential fallbacks detected: ${testResults.fallbacksDetected.length}`);
  
  if (testResults.fallbacksDetected.length > 0) {
    console.log(`\n${colors.yellow}[WARNING] POTENTIAL FALLBACKS FOUND:${colors.reset}`);
    testResults.fallbacksDetected.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }
  
  // Final verdict
  console.log('\n' + '=' .repeat(60));
  
  if (testResults.unexpectedSuccesses === 0 && testResults.fallbacksDetected.length === 0) {
    console.log(`${colors.green}[SUCCESS] System properly fails without GPT-5!${colors.reset}`);
    console.log('NO FALLBACKS detected - system requires REAL AI');
    return 0;
  } else {
    console.log(`${colors.red}[FAILURE] System has fallback behavior!${colors.reset}`);
    console.log('System MUST fail when GPT-5 is unavailable - NO FALLBACKS ALLOWED');
    return 1;
  }
}

// Run tests
runAllTests().then(exitCode => {
  console.log('\n[COMPLETE] No-fallbacks test complete');
  process.exit(exitCode);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});