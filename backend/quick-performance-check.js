#!/usr/bin/env node
/**
 * Quick Performance Check - Find actual bottlenecks
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const baseURL = 'http://localhost:5001';

async function runQuickCheck() {
  console.log('🔍 QUICK PERFORMANCE CHECK\n');
  
  // 1. Test authentication
  console.log('1. Testing Authentication Speed...');
  let token;
  const authStart = performance.now();
  try {
    const res = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'john@sunrisevalley.com',
      password: 'demo123'
    });
    token = res.data.token;
    console.log(`   Login: ${(performance.now() - authStart).toFixed(0)}ms ✅`);
  } catch (error) {
    console.log(`   Login failed: ${error.message} ❌`);
    process.exit(1);
  }
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // 2. Test main endpoints
  console.log('\n2. Testing Endpoint Response Times...');
  
  const endpoints = [
    '/api/farms',
    '/api/farms/1',
    '/api/burn-requests',
    '/api/schedule',
    '/api/alerts',
    '/api/analytics/dashboard'
  ];
  
  const slowEndpoints = [];
  
  for (const endpoint of endpoints) {
    const start = performance.now();
    try {
      await axios.get(`${baseURL}${endpoint}`, { headers, timeout: 10000 });
      const time = performance.now() - start;
      console.log(`   ${endpoint}: ${time.toFixed(0)}ms ${time > 500 ? '⚠️ SLOW' : '✅'}`);
      if (time > 500) {
        slowEndpoints.push({ endpoint, time });
      }
    } catch (error) {
      console.log(`   ${endpoint}: ERROR - ${error.message} ❌`);
    }
  }
  
  // 3. Test concurrent requests
  console.log('\n3. Testing Concurrent Request Handling...');
  
  const concurrentTests = [10, 25, 50];
  
  for (const count of concurrentTests) {
    const start = performance.now();
    const promises = [];
    
    for (let i = 0; i < count; i++) {
      promises.push(
        axios.get(`${baseURL}/api/farms`, { headers })
          .then(() => true)
          .catch(() => false)
      );
    }
    
    const results = await Promise.all(promises);
    const success = results.filter(r => r).length;
    const time = performance.now() - start;
    
    console.log(`   ${count} concurrent: ${time.toFixed(0)}ms, ${success}/${count} success ${success < count ? '⚠️' : '✅'}`);
    
    if (success < count) {
      console.log(`      System fails at ${count} concurrent users!`);
      break;
    }
  }
  
  // 4. Check database query patterns
  console.log('\n4. Checking Query Efficiency...');
  
  const limits = [10, 50, 100];
  const queryTimes = {};
  
  for (const limit of limits) {
    const start = performance.now();
    try {
      await axios.get(`${baseURL}/api/burn-requests?limit=${limit}`, { headers });
      queryTimes[limit] = performance.now() - start;
      console.log(`   Limit ${limit}: ${queryTimes[limit].toFixed(0)}ms`);
    } catch (error) {
      console.log(`   Limit ${limit}: ERROR`);
    }
  }
  
  // Check if query time scales linearly
  if (queryTimes[100] && queryTimes[10]) {
    const scaling = queryTimes[100] / queryTimes[10];
    if (scaling > 3) {
      console.log(`   ⚠️ Query time scales poorly (${scaling.toFixed(1)}x for 10x data)`);
    }
  }
  
  // 5. Summary
  console.log('\n' + '='.repeat(50));
  console.log('ISSUES FOUND:');
  console.log('='.repeat(50));
  
  if (slowEndpoints.length > 0) {
    console.log('\n🐌 SLOW ENDPOINTS:');
    slowEndpoints.forEach(e => {
      console.log(`   ${e.endpoint}: ${e.time.toFixed(0)}ms`);
    });
  }
  
  console.log('\n💡 QUICK WINS:');
  console.log('   1. Add caching to slow endpoints');
  console.log('   2. Optimize database queries with indexes');
  console.log('   3. Reduce default page size from 100 to 20');
  console.log('   4. Remove unused middleware layers');
  
  console.log('\n' + '='.repeat(50));
}

runQuickCheck();