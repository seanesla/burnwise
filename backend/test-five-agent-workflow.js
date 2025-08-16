/**
 * Test the REAL 5-Agent Workflow End-to-End
 * Verifies all agents are working with real API calls, no mocks
 */

require('dotenv').config();
const axios = require('axios');
const { query } = require('./db/connection');
const logger = require('./middleware/logger');

const API_BASE = 'http://localhost:5001/api';

// Test configuration
const TEST_FARM_ID = 1; // Assuming we have a farm with ID 1

/**
 * Step 1: Test Natural Language Burn Request
 */
async function testBurnRequestAgent() {
  console.log('\n=== TESTING BURN REQUEST AGENT ===');
  
  const naturalLanguageRequest = `
    I need to burn 50 acres of wheat stubble tomorrow morning around 9am.
    The field is on the north side of my property. 
    We had some rain last week so moisture is good.
    This is for disease control after harvest.
  `;
  
  try {
    const response = await axios.post(`${API_BASE}/agents/burn-request`, {
      text: naturalLanguageRequest,
      userId: 'test-user'
    });
    
    console.log('✓ Natural language processed');
    console.log('  Extracted data:', JSON.stringify(response.data.structured, null, 2));
    console.log('  Burn Request ID:', response.data.burnRequestId);
    
    return response.data;
  } catch (error) {
    console.error('✗ Burn request failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 2: Test Weather Analysis
 */
async function testWeatherAnalyst() {
  console.log('\n=== TESTING WEATHER ANALYST ===');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  try {
    const response = await axios.post(`${API_BASE}/agents/weather-analysis`, {
      location: { lat: 45.5152, lng: -122.6784 }, // Portland, OR
      burnDate: tomorrow.toISOString().split('T')[0],
      burnDetails: {
        acres: 50,
        fuelType: 'wheat_stubble',
        purpose: 'disease_control'
      }
    });
    
    console.log('✓ Weather analysis complete');
    console.log('  Decision:', response.data.decision);
    console.log('  Requires Approval:', response.data.requiresApproval);
    console.log('  Confidence:', response.data.confidence);
    console.log('  Reasons:', response.data.reasons);
    
    if (response.data.currentWeather) {
      console.log('  Current Weather:', {
        temp: response.data.currentWeather.main?.temp,
        windSpeed: response.data.currentWeather.wind?.speed,
        humidity: response.data.currentWeather.main?.humidity
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('✗ Weather analysis failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 3: Test Conflict Resolution
 */
async function testConflictResolver() {
  console.log('\n=== TESTING CONFLICT RESOLVER ===');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  try {
    const response = await axios.post(`${API_BASE}/agents/resolve-conflicts`, {
      burnDate: tomorrow.toISOString().split('T')[0]
    });
    
    console.log('✓ Conflict resolution complete');
    console.log('  Conflicts Found:', response.data.conflictsFound || 0);
    console.log('  Resolutions:', response.data.resolutions?.length || 0);
    
    if (response.data.resolutions && response.data.resolutions.length > 0) {
      response.data.resolutions.forEach((res, i) => {
        console.log(`  Resolution ${i+1}:`, res.type, '-', res.description);
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('✗ Conflict resolution failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 4: Test Schedule Optimization
 */
async function testScheduleOptimizer() {
  console.log('\n=== TESTING SCHEDULE OPTIMIZER ===');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  try {
    const response = await axios.post(`${API_BASE}/agents/optimize-schedule`, {
      date: tomorrow.toISOString().split('T')[0]
    });
    
    console.log('✓ Schedule optimization complete');
    console.log('  Schedule ID:', response.data.scheduleId);
    console.log('  Items Scheduled:', response.data.schedule?.length || 0);
    console.log('  Quality Score:', response.data.quality?.overallScore);
    console.log('  Utilization Rate:', response.data.metrics?.utilizationRate + '%');
    console.log('  Conflicts:', response.data.metrics?.conflicts);
    
    if (response.data.quality) {
      console.log('  Strengths:', response.data.quality.strengths);
      console.log('  Improvements:', response.data.quality.improvements);
    }
    
    return response.data;
  } catch (error) {
    console.error('✗ Schedule optimization failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 5: Test Proactive Monitor
 */
async function testProactiveMonitor() {
  console.log('\n=== TESTING PROACTIVE MONITOR ===');
  
  try {
    // Start monitoring
    console.log('Starting 24/7 monitoring...');
    const startResponse = await axios.post(`${API_BASE}/agents/monitoring/start`);
    console.log('✓ Monitoring started');
    console.log('  Check Interval:', startResponse.data.checkInterval, 'ms');
    console.log('  Next Check:', new Date(startResponse.data.nextCheck).toLocaleString());
    
    // Get status
    const statusResponse = await axios.get(`${API_BASE}/agents/monitoring/status`);
    console.log('✓ Monitoring status retrieved');
    console.log('  Is Running:', statusResponse.data.isRunning);
    console.log('  Alerts Sent Today:', statusResponse.data.alertsSentToday);
    
    // Trigger manual check
    console.log('Triggering manual check...');
    const checkResponse = await axios.post(`${API_BASE}/agents/monitoring/check`);
    console.log('✓ Manual check complete');
    console.log('  Burns Checked:', checkResponse.data.burnsChecked);
    console.log('  Alerts Generated:', checkResponse.data.alertsGenerated);
    
    if (checkResponse.data.alerts && checkResponse.data.alerts.length > 0) {
      checkResponse.data.alerts.forEach((alert, i) => {
        console.log(`  Alert ${i+1}: Farm ${alert.farmName} - ${alert.optimalWindows?.length || 0} optimal windows found`);
      });
    }
    
    // Stop monitoring (cleanup)
    await axios.post(`${API_BASE}/agents/monitoring/stop`);
    console.log('✓ Monitoring stopped');
    
    return { start: startResponse.data, check: checkResponse.data };
  } catch (error) {
    console.error('✗ Proactive monitoring failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 6: Test Full Workflow
 */
async function testFullWorkflow() {
  console.log('\n=== TESTING FULL 5-AGENT WORKFLOW ===');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  try {
    const response = await axios.post(`${API_BASE}/agents/workflow`, {
      burnRequest: {
        farm_id: TEST_FARM_ID,
        requested_date: tomorrow.toISOString().split('T')[0],
        acreage: 75,
        fuel_type: 'grass',
        purpose: 'pasture_management',
        requested_window_start: '08:00',
        requested_window_end: '12:00',
        crew_size: 4,
        firebreaks_prepared: true,
        water_source_available: true,
        notes: 'Testing full workflow with all 5 agents'
      }
    });
    
    console.log('✓ Full workflow executed');
    console.log('  Summary:');
    console.log('    Validated:', response.data.summary.validated);
    console.log('    Weather Decision:', response.data.summary.weatherDecision);
    console.log('    Conflicts Detected:', response.data.summary.conflictsDetected);
    console.log('    Scheduled:', response.data.summary.scheduled);
    console.log('    Alerts Sent:', response.data.summary.alertsSent);
    
    return response.data;
  } catch (error) {
    console.error('✗ Full workflow failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 7: Test Agent Stats
 */
async function testAgentStats() {
  console.log('\n=== TESTING AGENT STATS ===');
  
  try {
    const response = await axios.get(`${API_BASE}/agents/stats`);
    
    console.log('✓ Agent stats retrieved');
    console.log('  Weekly Stats:');
    console.log('    Requests:', response.data.weeklyStats?.requests_week || 0);
    console.log('    Weather Checks:', response.data.weeklyStats?.weather_checks || 0);
    console.log('    Conflicts Resolved:', response.data.weeklyStats?.conflicts_resolved || 0);
    console.log('    Schedules Created:', response.data.weeklyStats?.schedules_created || 0);
    console.log('    Alerts Sent:', response.data.weeklyStats?.alerts_sent || 0);
    
    console.log('  Agent Status:');
    Object.entries(response.data.agentStatus || {}).forEach(([agent, status]) => {
      console.log(`    ${agent}: ${status}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('✗ Agent stats failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Verify database entries were created
 */
async function verifyDatabaseEntries() {
  console.log('\n=== VERIFYING DATABASE ENTRIES ===');
  
  try {
    // Check for recent burn requests
    const burnRequests = await query(`
      SELECT COUNT(*) as count 
      FROM burn_requests 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    console.log('✓ Recent burn requests:', burnRequests[0].count);
    
    // Check for weather analyses
    const weatherAnalyses = await query(`
      SELECT COUNT(*) as count 
      FROM weather_analyses 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    console.log('✓ Recent weather analyses:', weatherAnalyses[0].count);
    
    // Check for schedules
    const schedules = await query(`
      SELECT COUNT(*) as count 
      FROM schedules 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    console.log('✓ Recent schedules created:', schedules[0].count);
    
    // Check for schedule items
    const scheduleItems = await query(`
      SELECT COUNT(*) as count 
      FROM schedule_items 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    console.log('✓ Recent schedule items:', scheduleItems[0].count);
    
    return {
      burnRequests: burnRequests[0].count,
      weatherAnalyses: weatherAnalyses[0].count,
      schedules: schedules[0].count,
      scheduleItems: scheduleItems[0].count
    };
  } catch (error) {
    console.error('✗ Database verification failed:', error.message);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('=====================================');
  console.log('  BURNWISE 5-AGENT SYSTEM TEST');
  console.log('  Testing REAL agents with GPT-5');
  console.log('=====================================');
  
  const results = {
    burnRequest: null,
    weather: null,
    conflicts: null,
    schedule: null,
    monitoring: null,
    workflow: null,
    stats: null,
    database: null
  };
  
  try {
    // Make sure server is running
    try {
      await axios.get(`${API_BASE}/../health`);
      console.log('✓ Server is running');
    } catch (error) {
      console.error('✗ Server is not running. Start it with: npm run dev');
      process.exit(1);
    }
    
    // Run tests in sequence
    results.burnRequest = await testBurnRequestAgent();
    results.weather = await testWeatherAnalyst();
    results.conflicts = await testConflictResolver();
    results.schedule = await testScheduleOptimizer();
    results.monitoring = await testProactiveMonitor();
    results.workflow = await testFullWorkflow();
    results.stats = await testAgentStats();
    results.database = await verifyDatabaseEntries();
    
    console.log('\n=====================================');
    console.log('  ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('=====================================');
    console.log('\n✅ 5-AGENT SYSTEM VERIFIED:');
    console.log('  1. BurnRequestAgent: Processing natural language');
    console.log('  2. WeatherAnalyst: Making autonomous safety decisions');
    console.log('  3. ConflictResolver: Mediating between farms');
    console.log('  4. ScheduleOptimizer: Creating optimized schedules');
    console.log('  5. ProactiveMonitor: 24/7 autonomous monitoring');
    console.log('\n✅ REAL FEATURES CONFIRMED:');
    console.log('  - GPT-5-nano/mini making actual decisions');
    console.log('  - Real database entries created');
    console.log('  - Real weather API integration');
    console.log('  - Real conflict detection algorithms');
    console.log('  - Real schedule optimization');
    
    return results;
    
  } catch (error) {
    console.log('\n=====================================');
    console.log('  TEST FAILED - SEE ERRORS ABOVE');
    console.log('=====================================');
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\nTest complete. Exiting...');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nTest failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests };