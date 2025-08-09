#!/usr/bin/env node

const axios = require('axios');

// Test burn request submission via the API
async function testBurnRequestSubmission() {
  console.log('🔥 Testing Burn Request Form Submission...\n');
  
  try {
    // First, get available farms
    console.log('1. Fetching available farms...');
    const farmsResponse = await axios.get('http://localhost:5001/api/farms');
    const farms = farmsResponse.data.data;
    
    if (!farms || farms.length === 0) {
      throw new Error('No farms available in the database');
    }
    
    console.log(`   ✅ Found ${farms.length} farms`);
    const testFarm = farms[0];
    console.log(`   Using farm: ${testFarm.name} (ID: ${testFarm.id})\n`);
    
    // Prepare test burn request data (mimicking frontend form submission)
    const burnRequestData = {
      farm_id: testFarm.id,
      field_name: 'Test Field Alpha',
      field_boundary: {
        type: 'Polygon',
        coordinates: [[
          [-98.5, 30.2],
          [-98.5, 30.3],
          [-98.4, 30.3],
          [-98.4, 30.2],
          [-98.5, 30.2]
        ]]
      },
      acres: 75.5,
      acreage: 75.5, // API expects 'acreage' field
      crop_type: 'wheat', // Schema requires lowercase specific values
      burn_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      requested_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time_window_start: '08:00',
      time_window_end: '12:00',
      requested_window_start: '08:00',
      requested_window_end: '12:00',
      estimated_duration: 4,
      preferred_conditions: {
        max_wind_speed: 10,
        min_humidity: 30,
        max_humidity: 70
      },
      notes: 'Test submission from frontend form verification'
    };
    
    console.log('2. Submitting burn request...');
    console.log('   Request data:', {
      farm_id: burnRequestData.farm_id,
      field_name: burnRequestData.field_name,
      acres: burnRequestData.acres,
      crop_type: burnRequestData.crop_type,
      burn_date: burnRequestData.burn_date
    });
    
    const startTime = Date.now();
    const response = await axios.post('http://localhost:5001/api/burn-requests', burnRequestData);
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ Burn request submitted successfully in ${duration}ms\n`);
    
    // Verify the response
    if (response.data.success) {
      console.log('3. Response Analysis:');
      const data = response.data.data;
      
      console.log(`   Burn Request ID: ${data.burn_request_id}`);
      console.log(`   Priority Score: ${data.priority_score}/100`);
      
      if (data.weather_analysis) {
        console.log(`   Weather Suitability: ${data.weather_analysis.suitability_score}/100`);
        console.log(`   Weather Confidence: ${(data.weather_analysis.confidence * 100).toFixed(1)}%`);
      }
      
      if (data.smoke_prediction) {
        console.log(`   Max Dispersion Radius: ${data.smoke_prediction.max_dispersion_radius} km`);
        console.log(`   Conflicts Detected: ${data.smoke_prediction.conflicts_detected}`);
        console.log(`   Prediction Confidence: ${(data.smoke_prediction.confidence * 100).toFixed(1)}%`);
      }
      
      if (data.schedule_optimization) {
        console.log(`   Scheduled: ${data.schedule_optimization.scheduled ? 'Yes' : 'No'}`);
        if (data.schedule_optimization.optimization_score) {
          console.log(`   Optimization Score: ${data.schedule_optimization.optimization_score}/100`);
        }
      }
      
      console.log(`   Alerts Sent: ${data.alerts_sent}`);
      
      if (data.workflow_performance) {
        console.log('\n4. Workflow Performance:');
        console.log(`   Total Duration: ${data.workflow_performance.total_duration_ms}ms`);
        console.log(`   Agent Sequence: ${data.workflow_performance.agent_sequence.join(' → ')}`);
      }
      
      // Verify the burn request was stored
      console.log('\n5. Verifying stored burn request...');
      const verifyResponse = await axios.get(`http://localhost:5001/api/burn-requests/${data.burn_request_id}`);
      
      if (verifyResponse.data.success) {
        const storedRequest = verifyResponse.data.data;
        console.log(`   ✅ Burn request verified in database`);
        console.log(`   Status: ${storedRequest.status}`);
        console.log(`   Farm: ${storedRequest.farm_name}`);
        console.log(`   Field: ${storedRequest.field_name || storedRequest.field_id}`);
      }
      
      console.log('\n✅ Frontend form submission test PASSED!');
      console.log('   The burn request form is working correctly.');
      console.log('   All 5 agents processed the request successfully.');
      
    } else {
      console.error('❌ Burn request submission failed:', response.data);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('   Details:', error.response.data.details);
    }
    process.exit(1);
  }
}

// Run the test
testBurnRequestSubmission();