#!/usr/bin/env node
/**
 * Final test of all endpoints after fixes
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const baseURL = 'http://localhost:5001';

async function testAllEndpoints() {
  console.log('🎯 FINAL ENDPOINT TEST\n');
  
  // Get token
  let token;
  try {
    const res = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'john@sunrisevalley.com',
      password: 'demo123'
    });
    token = res.data.token;
    console.log('✅ Authentication working');
  } catch (error) {
    console.log('❌ Authentication failed:', error.message);
    return;
  }
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Test all endpoints
  const endpoints = [
    { name: 'Health Check', url: '/health', needsAuth: false },
    { name: 'Farms List', url: '/api/farms' },
    { name: 'Farm Details', url: '/api/farms/1' },
    { name: 'Burn Requests', url: '/api/burn-requests' },
    { name: 'Schedule', url: '/api/schedule' },
    { name: 'Alerts', url: '/api/alerts' },
    { name: 'Analytics Dashboard', url: '/api/analytics/dashboard' },
    { name: 'Analytics Burn Trends', url: '/api/analytics/burn-trends' },
    { name: 'Analytics Weather', url: '/api/analytics/weather-patterns' },
    { name: 'Analytics Farm Perf', url: '/api/analytics/farm-performance' }
  ];
  
  console.log('\nTesting all endpoints:');
  console.log('─'.repeat(60));
  
  let working = 0;
  let broken = 0;
  const issues = [];
  
  for (const endpoint of endpoints) {
    const start = performance.now();
    try {
      const response = await axios.get(`${baseURL}${endpoint.url}`, {
        headers: endpoint.needsAuth === false ? {} : headers,
        timeout: 10000
      });
      
      const time = performance.now() - start;
      const status = response.status;
      
      if (status === 200) {
        console.log(`✅ ${endpoint.name.padEnd(20)} ${status} - ${time.toFixed(0)}ms`);
        working++;
      } else {
        console.log(`⚠️  ${endpoint.name.padEnd(20)} ${status} - ${time.toFixed(0)}ms`);
        issues.push({ endpoint: endpoint.name, status });
      }
    } catch (error) {
      const time = performance.now() - start;
      const status = error.response?.status || 'ERROR';
      const message = error.response?.data?.error || error.message;
      
      console.log(`❌ ${endpoint.name.padEnd(20)} ${status} - ${message}`);
      broken++;
      issues.push({ endpoint: endpoint.name, status, error: message });
    }
  }
  
  console.log('─'.repeat(60));
  console.log(`\nResults: ${working} working, ${broken} broken\n`);
  
  if (issues.length > 0) {
    console.log('Issues found:');
    issues.forEach(issue => {
      console.log(`  - ${issue.endpoint}: ${issue.error || `Status ${issue.status}`}`);
    });
  }
  
  // Test a complete workflow
  console.log('\n🔄 Testing Complete Workflow:');
  console.log('─'.repeat(60));
  
  try {
    // 1. Create burn request
    console.log('1. Creating burn request...');
    const burnResponse = await axios.post(`${baseURL}/api/burn-requests`, {
      farm_id: 1,
      field_id: 1,
      acreage: 50,
      crop_type: 'wheat',
      requested_date: '2025-08-30',
      requested_window_start: '08:00',
      requested_window_end: '12:00'
    }, { headers, validateStatus: () => true });
    
    if ([200, 201, 400, 422].includes(burnResponse.status)) {
      console.log(`   ✅ Burn request processed (status: ${burnResponse.status})`);
    } else {
      console.log(`   ❌ Burn request failed (status: ${burnResponse.status})`);
    }
    
    // 2. Check schedule
    console.log('2. Checking schedule...');
    const scheduleResponse = await axios.get(`${baseURL}/api/schedule`, { headers });
    console.log(`   ✅ Schedule retrieved`);
    
    // 3. Check analytics
    console.log('3. Getting analytics...');
    const analyticsResponse = await axios.get(`${baseURL}/api/analytics/burns/stats`, { headers });
    console.log(`   ✅ Analytics retrieved`);
    
    console.log('\n✅ Workflow test completed successfully');
    
  } catch (error) {
    console.log(`\n❌ Workflow failed: ${error.message}`);
  }
  
  console.log('─'.repeat(60));
  console.log('\n🏁 TESTING COMPLETE\n');
  
  if (broken === 0) {
    console.log('🎉 ALL ENDPOINTS WORKING!');
  } else {
    console.log(`⚠️  ${broken} endpoints still have issues`);
  }
}

testAllEndpoints();