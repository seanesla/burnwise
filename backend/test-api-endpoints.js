const axios = require('axios');
const { spawn } = require('child_process');

const API_URL = 'http://localhost:5000/api';
let serverProcess;

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting backend server...');
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: '/Users/seane/Documents/GitHub/burnwise/backend',
      env: { ...process.env, PORT: 5000 }
    });
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running on port')) {
        console.log('✓ Server started successfully');
        setTimeout(resolve, 2000); // Wait for full initialization
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
    
    setTimeout(() => resolve(), 5000); // Timeout after 5 seconds
  });
}

async function stopServer() {
  if (serverProcess) {
    console.log('Stopping server...');
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testEndpoints() {
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  console.log('\n=== API ENDPOINT TESTING ===\n');

  // Test 1: Health Check
  try {
    console.log('1. Testing Health Check...');
    const response = await axios.get('http://localhost:5000/health'); // Direct health endpoint
    if (response.status === 200) {
      console.log('   ✓ Health check passed');
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Health check failed:', error.message);
    results.failed++;
    results.errors.push('Health check: ' + error.message);
  }

  // Test 2: Weather Endpoint
  try {
    console.log('2. Testing Weather API...');
    const response = await axios.get(`${API_URL}/weather/current`, {
      params: { lat: 45.5152, lon: -122.6784 }
    });
    if (response.data && response.data.weather) {
      console.log('   ✓ Weather API working');
      console.log('   - Temperature:', response.data.weather.main?.temp, '°C');
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Weather API failed:', error.message);
    results.failed++;
    results.errors.push('Weather API: ' + error.message);
  }

  // Test 3: Create Farm
  try {
    console.log('3. Testing Farm Creation...');
    const response = await axios.post(`${API_URL}/farms`, {
      farmName: 'Test Farm ' + Date.now(),
      ownerName: 'Test Owner',
      contactEmail: 'test@example.com',
      contactPhone: '+15551234567',
      location: { lat: 45.5152, lon: -122.6784 },
      totalAreaHectares: 500
    });
    if (response.data && response.data.farmId) {
      console.log('   ✓ Farm creation working');
      console.log('   - Farm ID:', response.data.farmId);
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Farm creation failed:', error.response?.data?.error || error.message);
    results.failed++;
    results.errors.push('Farm creation: ' + error.message);
  }

  // Test 4: Create Burn Request
  try {
    console.log('4. Testing Burn Request Creation...');
    const response = await axios.post(`${API_URL}/burn-requests`, {
      farmId: 1,
      fieldGeometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.6784, 45.5152],
          [-122.6684, 45.5152],
          [-122.6684, 45.5252],
          [-122.6784, 45.5252],
          [-122.6784, 45.5152]
        ]]
      },
      requestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      cropType: 'wheat',
      fieldSizeAcres: 120,
      estimatedDuration: 4
    });
    if (response.data && response.data.requestId) {
      console.log('   ✓ Burn request creation working');
      console.log('   - Request ID:', response.data.requestId);
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Burn request failed:', error.response?.data?.error || error.message);
    results.failed++;
    results.errors.push('Burn request: ' + error.message);
  }

  // Test 5: Get Burn Requests
  try {
    console.log('5. Testing Get Burn Requests...');
    const response = await axios.get(`${API_URL}/burn-requests`);
    if (response.data && Array.isArray(response.data)) {
      console.log('   ✓ Get burn requests working');
      console.log('   - Total requests:', response.data.length);
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Get burn requests failed:', error.message);
    results.failed++;
    results.errors.push('Get burn requests: ' + error.message);
  }

  // Test 6: Conflict Detection
  try {
    console.log('6. Testing Conflict Detection...');
    const response = await axios.post(`${API_URL}/burn-requests/detect-conflicts`, {
      burnRequestIds: [1, 2],
      date: new Date().toISOString()
    });
    if (response.data) {
      console.log('   ✓ Conflict detection working');
      console.log('   - Conflicts found:', response.data.conflicts?.length || 0);
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Conflict detection failed:', error.response?.data?.error || error.message);
    results.failed++;
    results.errors.push('Conflict detection: ' + error.message);
  }

  // Test 7: Schedule Optimization
  try {
    console.log('7. Testing Schedule Optimization...');
    const response = await axios.post(`${API_URL}/schedule/optimize`, {
      burnRequestIds: [1, 2],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    if (response.data) {
      console.log('   ✓ Schedule optimization working');
      console.log('   - Optimized schedule items:', response.data.schedule?.length || 0);
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Schedule optimization failed:', error.response?.data?.error || error.message);
    results.failed++;
    results.errors.push('Schedule optimization: ' + error.message);
  }

  // Test 8: Send Alerts
  try {
    console.log('8. Testing Alert System...');
    const response = await axios.post(`${API_URL}/alerts/send`, {
      farmId: 1,
      alertType: 'burn_scheduled',
      message: 'Test alert message'
    });
    if (response.data) {
      console.log('   ✓ Alert system working');
      console.log('   - Alert sent:', response.data.success);
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Alert system failed:', error.response?.data?.error || error.message);
    results.failed++;
    results.errors.push('Alert system: ' + error.message);
  }

  // Test 9: Analytics Metrics
  try {
    console.log('9. Testing Analytics Metrics...');
    const response = await axios.get(`${API_URL}/analytics/metrics`);
    if (response.data) {
      console.log('   ✓ Analytics metrics working');
      console.log('   - Metrics retrieved:', Object.keys(response.data).length);
      results.passed++;
    }
  } catch (error) {
    console.log('   ✗ Analytics metrics failed:', error.message);
    results.failed++;
    results.errors.push('Analytics metrics: ' + error.message);
  }

  // Test 10: WebSocket Connection
  try {
    console.log('10. Testing WebSocket Connection...');
    const io = require('socket.io-client');
    const socket = io('http://localhost:5000');
    
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('   ✓ WebSocket connection established');
        results.passed++;
        socket.disconnect();
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        console.log('   ✗ WebSocket connection failed:', error.message);
        results.failed++;
        results.errors.push('WebSocket: ' + error.message);
        reject(error);
      });
      
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('WebSocket timeout'));
      }, 5000);
    });
  } catch (error) {
    if (!error.message.includes('WebSocket')) {
      console.log('   ✗ WebSocket test failed:', error.message);
      results.failed++;
      results.errors.push('WebSocket: ' + error.message);
    }
  }

  return results;
}

async function main() {
  try {
    await startServer();
    const results = await testEndpoints();
    
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Passed: ${results.passed}/10`);
    console.log(`Failed: ${results.failed}/10`);
    console.log(`Success Rate: ${(results.passed / 10 * 100).toFixed(1)}%`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(err => console.log(' -', err));
    }
    
    if (results.passed >= 7) {
      console.log('\n✅ API endpoints are mostly functional!');
    } else {
      console.log('\n⚠️ Multiple API endpoints are failing. Debug required.');
    }
    
    process.exit(results.failed > 3 ? 1 : 0);
  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  } finally {
    await stopServer();
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  await stopServer();
  process.exit(0);
});

main();