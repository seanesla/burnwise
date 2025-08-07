#!/usr/bin/env node
/**
 * SERVER PERFORMANCE TEST - Test through API endpoints
 * Real testing, no mocks, finding actual bottlenecks
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

const baseURL = 'http://localhost:5001';
const results = {
  performance: [],
  bottlenecks: [],
  overengineering: [],
  optimizations: []
};

// Get auth token
async function getToken() {
  const res = await axios.post(`${baseURL}/api/auth/login`, {
    email: 'john@sunrisevalley.com',
    password: 'demo123'
  });
  return res.data.token;
}

// Test 1: Find slow endpoints
async function findSlowEndpoints() {
  console.log('\n=== FINDING SLOW ENDPOINTS ===\n');
  
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  
  const tests = [
    { name: 'GET /farms (list)', method: 'GET', url: '/api/farms' },
    { name: 'GET /farms/1', method: 'GET', url: '/api/farms/1' },
    { name: 'GET /farms?search=test', method: 'GET', url: '/api/farms?search=test' },
    { name: 'GET /farms?page=1&limit=100', method: 'GET', url: '/api/farms?page=1&limit=100' },
    { name: 'GET /burn-requests', method: 'GET', url: '/api/burn-requests' },
    { name: 'GET /burn-requests?limit=100', method: 'GET', url: '/api/burn-requests?limit=100' },
    { name: 'GET /analytics/dashboard', method: 'GET', url: '/api/analytics/dashboard' },
    { name: 'GET /analytics/farms/summary', method: 'GET', url: '/api/analytics/farms/summary' },
    { name: 'GET /schedule', method: 'GET', url: '/api/schedule' },
    { name: 'GET /alerts', method: 'GET', url: '/api/alerts' }
  ];
  
  for (const test of tests) {
    const times = [];
    
    // Run each test 3 times
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try {
        await axios({
          method: test.method,
          url: `${baseURL}${test.url}`,
          headers,
          timeout: 10000
        });
        const duration = performance.now() - start;
        times.push(duration);
      } catch (error) {
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
    
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      
      console.log(`  ${test.name}: ${avg.toFixed(0)}ms avg, ${max.toFixed(0)}ms max`);
      
      results.performance.push({
        endpoint: test.name,
        avgTime: avg,
        maxTime: max
      });
      
      if (avg > 500) {
        results.bottlenecks.push({
          endpoint: test.name,
          avgTime: avg,
          issue: 'Slow response time',
          recommendation: 'Add caching or optimize query'
        });
      }
    }
  }
}

// Test 2: Check for overengineered patterns
async function checkOverengineering() {
  console.log('\n=== CHECKING FOR OVERENGINEERING ===\n');
  
  // Check file sizes to find bloated code
  const checkFiles = [
    { path: './agents/weather.js', maxSize: 30000 },
    { path: './agents/predictor.js', maxSize: 25000 },
    { path: './agents/coordinator.js', maxSize: 20000 },
    { path: './api/farms.js', maxSize: 40000 },
    { path: './middleware/errorHandler.js', maxSize: 10000 }
  ];
  
  for (const file of checkFiles) {
    try {
      const stats = fs.statSync(file.path);
      const sizeKB = (stats.size / 1024).toFixed(1);
      
      console.log(`  ${path.basename(file.path)}: ${sizeKB} KB`);
      
      if (stats.size > file.maxSize) {
        results.overengineering.push({
          file: file.path,
          size: `${sizeKB} KB`,
          issue: 'File too large',
          recommendation: 'Split into smaller modules or remove unused code'
        });
      }
    } catch (error) {
      // File not found
    }
  }
  
  // Check for unused dependencies
  console.log('\n  Checking for potentially unused features...');
  
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  
  // Check if vector search is actually used
  try {
    const response = await axios.get(`${baseURL}/api/weather/vector-search`, {
      headers,
      validateStatus: () => true
    });
    
    if (response.status === 404) {
      console.log('    ⚠️  Vector search endpoints not implemented');
      results.overengineering.push({
        feature: 'Vector embeddings',
        issue: '128-dim vectors defined but not used',
        recommendation: 'Remove vector code if not needed'
      });
    }
  } catch (error) {
    // Endpoint doesn't exist
  }
  
  // Check if Socket.io is actually used
  console.log('    Checking Socket.io usage...');
  try {
    const io = require('socket.io-client');
    const socket = io(baseURL);
    
    let connected = false;
    socket.on('connect', () => {
      connected = true;
      socket.disconnect();
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!connected) {
      results.overengineering.push({
        feature: 'Socket.io',
        issue: 'Real-time updates not working',
        recommendation: 'Fix or remove Socket.io if not needed'
      });
    }
  } catch (error) {
    console.log('    Socket.io client not available');
  }
}

// Test 3: Concurrent user handling
async function testConcurrentUsers() {
  console.log('\n=== TESTING CONCURRENT USERS ===\n');
  
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  
  const levels = [10, 25, 50, 100, 150];
  
  for (const level of levels) {
    const start = performance.now();
    const promises = [];
    
    // Create concurrent requests
    for (let i = 0; i < level; i++) {
      promises.push(
        axios.get(`${baseURL}/api/farms`, { 
          headers,
          timeout: 30000,
          validateStatus: () => true 
        })
          .then(res => ({ success: res.status === 200 }))
          .catch(() => ({ success: false }))
      );
    }
    
    const responses = await Promise.all(promises);
    const duration = performance.now() - start;
    const successful = responses.filter(r => r.success).length;
    const failed = level - successful;
    
    console.log(`  ${level} users: ${duration.toFixed(0)}ms, ${successful} success, ${failed} failed`);
    
    if (failed > level * 0.1) { // More than 10% failure
      results.bottlenecks.push({
        type: 'concurrency',
        level,
        failureRate: (failed / level * 100).toFixed(1) + '%',
        issue: `System fails at ${level} concurrent users`,
        recommendation: 'Add connection pooling or load balancing'
      });
      break; // Don't test higher levels if this failed
    }
  }
}

// Test 4: Check actual database queries
async function analyzeQueries() {
  console.log('\n=== ANALYZING DATABASE QUERIES ===\n');
  
  // Check if queries are optimized by looking at response times with different limits
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  
  const limits = [10, 50, 100, 500];
  const times = {};
  
  for (const limit of limits) {
    const start = performance.now();
    try {
      await axios.get(`${baseURL}/api/burn-requests?limit=${limit}`, { headers });
      times[limit] = performance.now() - start;
      console.log(`  Burn requests with limit=${limit}: ${times[limit].toFixed(0)}ms`);
    } catch (error) {
      console.log(`  ❌ Failed with limit=${limit}`);
    }
  }
  
  // Check if time scales linearly (bad) or stays constant (good - has proper limits)
  if (times[100] && times[10]) {
    const scaleFactor = times[100] / times[10];
    if (scaleFactor > 5) {
      results.bottlenecks.push({
        type: 'database',
        issue: 'Query time scales with result size',
        recommendation: 'Add pagination and indexes'
      });
    }
  }
}

// Test 5: Find unnecessary complexity
async function findComplexity() {
  console.log('\n=== FINDING UNNECESSARY COMPLEXITY ===\n');
  
  // Count middleware layers
  const serverFile = fs.readFileSync('./server.js', 'utf8');
  const middlewareCount = (serverFile.match(/app\.use/g) || []).length;
  
  console.log(`  Middleware layers: ${middlewareCount}`);
  
  if (middlewareCount > 10) {
    results.overengineering.push({
      component: 'Middleware',
      count: middlewareCount,
      issue: 'Too many middleware layers',
      recommendation: 'Combine related middleware'
    });
  }
  
  // Check agent complexity
  const agents = ['coordinator', 'weather', 'predictor', 'optimizer', 'alerts'];
  
  for (const agent of agents) {
    try {
      const agentFile = fs.readFileSync(`./agents/${agent}.js`, 'utf8');
      const methodCount = (agentFile.match(/async \w+\(/g) || []).length;
      const lineCount = agentFile.split('\n').length;
      
      console.log(`  ${agent} agent: ${methodCount} methods, ${lineCount} lines`);
      
      if (lineCount > 1000) {
        results.overengineering.push({
          component: `${agent} agent`,
          lines: lineCount,
          methods: methodCount,
          issue: 'Agent too complex',
          recommendation: 'Split into smaller services'
        });
      }
    } catch (error) {
      // File not found
    }
  }
}

// Test 6: Memory usage
async function testMemoryUsage() {
  console.log('\n=== TESTING MEMORY USAGE ===\n');
  
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  
  const initialMemory = process.memoryUsage();
  console.log(`  Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  
  // Make 50 requests
  for (let i = 0; i < 50; i++) {
    await axios.get(`${baseURL}/api/farms`, { headers }).catch(() => {});
  }
  
  // Force garbage collection if available
  if (global.gc) global.gc();
  
  const finalMemory = process.memoryUsage();
  console.log(`  After 50 requests: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  
  const growth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
  console.log(`  Growth: ${growth.toFixed(1)} MB`);
  
  if (growth > 20) {
    results.bottlenecks.push({
      type: 'memory',
      growth: `${growth.toFixed(1)} MB`,
      issue: 'Potential memory leak',
      recommendation: 'Check for unclosed connections or large cached objects'
    });
  }
}

// Generate optimization recommendations
function generateOptimizations() {
  console.log('\n=== GENERATING OPTIMIZATIONS ===\n');
  
  // Analyze results and create specific optimizations
  
  // 1. Database optimizations
  results.optimizations.push({
    category: 'DATABASE',
    changes: [
      'Add composite index: CREATE INDEX idx_burn_date_farm ON burn_requests(requested_date, farm_id);',
      'Add index: CREATE INDEX idx_farm_status ON farms(farm_id, status);',
      'Limit default query results to 20 instead of 100'
    ]
  });
  
  // 2. API optimizations
  if (results.bottlenecks.some(b => b.endpoint && b.avgTime > 500)) {
    results.optimizations.push({
      category: 'CACHING',
      changes: [
        'Add response caching for GET /api/analytics/* (5 minute TTL)',
        'Cache farm data for 1 minute',
        'Use ETags for conditional requests'
      ]
    });
  }
  
  // 3. Code simplifications
  if (results.overengineering.length > 0) {
    results.optimizations.push({
      category: 'SIMPLIFICATION',
      changes: [
        'Remove unused vector embedding code if not implementing similarity search',
        'Combine coordinator and optimizer agents into single service',
        'Remove unused Socket.io if real-time not needed'
      ]
    });
  }
  
  // 4. Performance improvements
  results.optimizations.push({
    category: 'PERFORMANCE',
    changes: [
      'Use connection pooling with min=2, max=10 connections',
      'Implement query result streaming for large datasets',
      'Add request queuing for burn request processing'
    ]
  });
}

// Generate final report
function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('PERFORMANCE OPTIMIZATION REPORT');
  console.log('='.repeat(70));
  
  // Performance results
  if (results.performance.length > 0) {
    console.log('\n📊 ENDPOINT PERFORMANCE:');
    const slow = results.performance.filter(p => p.avgTime > 500);
    const fast = results.performance.filter(p => p.avgTime <= 200);
    
    console.log(`  Fast (<200ms): ${fast.length} endpoints`);
    console.log(`  Slow (>500ms): ${slow.length} endpoints`);
    
    if (slow.length > 0) {
      console.log('\n  Slowest endpoints:');
      slow.sort((a, b) => b.avgTime - a.avgTime).slice(0, 3).forEach(s => {
        console.log(`    - ${s.endpoint}: ${s.avgTime.toFixed(0)}ms`);
      });
    }
  }
  
  // Bottlenecks
  if (results.bottlenecks.length > 0) {
    console.log('\n🚨 BOTTLENECKS FOUND:');
    results.bottlenecks.forEach((b, i) => {
      console.log(`\n  ${i + 1}. ${b.issue}`);
      console.log(`     Recommendation: ${b.recommendation}`);
    });
  }
  
  // Overengineering
  if (results.overengineering.length > 0) {
    console.log('\n⚙️ OVERENGINEERING DETECTED:');
    results.overengineering.forEach((o, i) => {
      console.log(`\n  ${i + 1}. ${o.component || o.feature || o.file}`);
      console.log(`     Issue: ${o.issue}`);
      console.log(`     Fix: ${o.recommendation}`);
    });
  }
  
  // Optimizations
  if (results.optimizations.length > 0) {
    console.log('\n💡 RECOMMENDED OPTIMIZATIONS:');
    results.optimizations.forEach(opt => {
      console.log(`\n  ${opt.category}:`);
      opt.changes.forEach(change => {
        console.log(`    - ${change}`);
      });
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  
  const totalIssues = results.bottlenecks.length + results.overengineering.length;
  console.log(`\nTotal issues found: ${totalIssues}`);
  console.log(`Critical bottlenecks: ${results.bottlenecks.length}`);
  console.log(`Overengineered components: ${results.overengineering.length}`);
  
  if (totalIssues > 10) {
    console.log('\n⚠️  STATUS: System needs significant optimization');
  } else if (totalIssues > 5) {
    console.log('\n⚠️  STATUS: System has moderate optimization opportunities');
  } else {
    console.log('\n✅ STATUS: System is reasonably optimized');
  }
  
  console.log('\n' + '='.repeat(70));
}

// Run all tests
async function runPerformanceTests() {
  console.log('🔥 BURNWISE SERVER PERFORMANCE TESTING');
  console.log('Finding real bottlenecks and overengineering\n');
  
  try {
    await findSlowEndpoints();
    await checkOverengineering();
    await testConcurrentUsers();
    await analyzeQueries();
    await findComplexity();
    await testMemoryUsage();
    generateOptimizations();
    generateReport();
    
    // Save results
    fs.writeFileSync(
      'performance-results.json',
      JSON.stringify(results, null, 2)
    );
    console.log('\n📁 Detailed results saved to performance-results.json');
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  }
  
  process.exit(0);
}

// Execute
runPerformanceTests();