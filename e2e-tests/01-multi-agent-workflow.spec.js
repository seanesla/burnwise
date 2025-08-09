const { test, expect } = require('@playwright/test');
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

test.describe('Multi-Agent Workflow E2E Tests', () => {
  let testFarmId;
  let testBurnRequestId;

  test.beforeAll(async () => {
    // Initialize database with test data
    console.log('Initializing test database...');
    try {
      const response = await axios.post(`${API_URL}/test/reset-db`);
      console.log('Database reset:', response.data);
    } catch (error) {
      console.log('Database reset endpoint not available, continuing...');
    }
  });

  test('1. Weather Agent - Fetches and analyzes real weather data', async ({ page }) => {
    // Test weather API integration
    const weatherResponse = await axios.get(`${API_URL}/weather/current`, {
      params: {
        lat: 45.5152,
        lon: -122.6784
      }
    });

    expect(weatherResponse.status).toBe(200);
    expect(weatherResponse.data).toHaveProperty('weather');
    expect(weatherResponse.data).toHaveProperty('weatherVector');
    expect(weatherResponse.data.weatherVector).toHaveLength(128); // 128-dimensional vector
    expect(weatherResponse.data).toHaveProperty('gaussianPlume');
    expect(weatherResponse.data.gaussianPlume).toHaveProperty('concentrations');
    
    console.log('Weather analysis successful:', {
      windSpeed: weatherResponse.data.weather.wind?.speed,
      temperature: weatherResponse.data.weather.main?.temp,
      vectorDimensions: weatherResponse.data.weatherVector.length,
      plumePoints: weatherResponse.data.gaussianPlume.concentrations.length
    });
  });

  test('2. Coordinator Agent - Processes burn request with terrain vectors', async ({ page }) => {
    // Submit a burn request
    const burnRequestData = {
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
      estimatedDuration: 4,
      fuelLoadTonsPerAcre: 2.5
    };

    const response = await axios.post(`${API_URL}/burn-requests`, burnRequestData);
    
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('burnRequest');
    expect(response.data).toHaveProperty('terrainVector');
    expect(response.data.terrainVector).toHaveLength(32); // 32-dimensional terrain vector
    expect(response.data).toHaveProperty('priorityScore');
    
    testBurnRequestId = response.data.burnRequest.id;
    
    console.log('Burn request created:', {
      requestId: testBurnRequestId,
      priority: response.data.priorityScore,
      terrainVectorDims: response.data.terrainVector.length
    });
  });

  test('3. Predictor Agent - Calculates smoke plume intersections', async ({ page }) => {
    // Create multiple burn requests to test conflict detection
    const burnRequests = [];
    
    // Create 3 overlapping burn requests
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.01;
      const burnData = {
        farmId: i + 2,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.6784 + offset, 45.5152],
            [-122.6684 + offset, 45.5152],
            [-122.6684 + offset, 45.5252],
            [-122.6784 + offset, 45.5252],
            [-122.6784 + offset, 45.5152]
          ]]
        },
        requestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        cropType: 'barley',
        fieldSizeAcres: 80 + i * 20,
        estimatedDuration: 3,
        fuelLoadTonsPerAcre: 2.0
      };
      
      const response = await axios.post(`${API_URL}/burn-requests`, burnData);
      burnRequests.push(response.data.burnRequest);
    }

    // Run conflict detection
    const conflictResponse = await axios.post(`${API_URL}/burn-requests/detect-conflicts`, {
      burnRequestIds: [testBurnRequestId, ...burnRequests.map(br => br.id)]
    });

    expect(conflictResponse.status).toBe(200);
    expect(conflictResponse.data).toHaveProperty('conflicts');
    expect(conflictResponse.data).toHaveProperty('smokeVectors');
    
    // Check smoke vectors are 64-dimensional
    conflictResponse.data.smokeVectors.forEach(vector => {
      expect(vector).toHaveLength(64);
    });

    console.log('Conflict detection complete:', {
      totalConflicts: conflictResponse.data.conflicts.length,
      smokeVectorCount: conflictResponse.data.smokeVectors.length,
      conflictSeverities: conflictResponse.data.conflicts.map(c => c.severity)
    });
  });

  test('4. Optimizer Agent - Runs simulated annealing optimization', async ({ page }) => {
    // Get all pending burn requests
    const pendingResponse = await axios.get(`${API_URL}/burn-requests`, {
      params: { status: 'pending' }
    });

    const burnRequestIds = pendingResponse.data.map(br => br.id);
    
    // Run optimization
    const optimizeResponse = await axios.post(`${API_URL}/schedule/optimize`, {
      burnRequestIds,
      optimizationParams: {
        maxIterations: 1000,
        initialTemperature: 100,
        coolingRate: 0.95,
        constraints: {
          maxPM25: 35,
          minTimeBetweenBurns: 4,
          maxConcurrentBurns: 2
        }
      }
    });

    expect(optimizeResponse.status).toBe(200);
    expect(optimizeResponse.data).toHaveProperty('optimizedSchedule');
    expect(optimizeResponse.data).toHaveProperty('optimizationStats');
    expect(optimizeResponse.data.optimizationStats).toHaveProperty('iterations');
    expect(optimizeResponse.data.optimizationStats).toHaveProperty('finalCost');
    expect(optimizeResponse.data.optimizationStats).toHaveProperty('conflictsResolved');

    console.log('Optimization complete:', {
      iterations: optimizeResponse.data.optimizationStats.iterations,
      finalCost: optimizeResponse.data.optimizationStats.finalCost,
      conflictsResolved: optimizeResponse.data.optimizationStats.conflictsResolved,
      scheduleLength: optimizeResponse.data.optimizedSchedule.length
    });
  });

  test('5. Alerts Agent - Sends notifications for schedule changes', async ({ page }) => {
    // Get optimized schedule
    const scheduleResponse = await axios.get(`${API_URL}/schedule/optimized`);
    
    // Send alerts
    const alertResponse = await axios.post(`${API_URL}/alerts/send`, {
      scheduleId: scheduleResponse.data[0].id,
      alertTypes: ['schedule_change', 'smoke_warning', 'burn_reminder']
    });

    expect(alertResponse.status).toBe(200);
    expect(alertResponse.data).toHaveProperty('alerts');
    expect(alertResponse.data.alerts).toBeInstanceOf(Array);
    
    // Verify alert structure
    alertResponse.data.alerts.forEach(alert => {
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('recipientFarmId');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('deliveryStatus');
    });

    console.log('Alerts sent:', {
      totalAlerts: alertResponse.data.alerts.length,
      types: [...new Set(alertResponse.data.alerts.map(a => a.type))],
      deliveryStatuses: alertResponse.data.alerts.map(a => a.deliveryStatus)
    });
  });

  test('6. Vector Search - Find similar weather patterns', async ({ page }) => {
    // Get current weather vector
    const currentWeather = await axios.get(`${API_URL}/weather/current`, {
      params: { lat: 45.5152, lon: -122.6784 }
    });

    // Search for similar historical patterns
    const searchResponse = await axios.post(`${API_URL}/weather/search-similar`, {
      weatherVector: currentWeather.data.weatherVector,
      limit: 5
    });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.data).toHaveProperty('similarPatterns');
    expect(searchResponse.data.similarPatterns).toBeInstanceOf(Array);
    expect(searchResponse.data.similarPatterns.length).toBeLessThanOrEqual(5);

    // Verify vector similarity scores
    searchResponse.data.similarPatterns.forEach(pattern => {
      expect(pattern).toHaveProperty('distance');
      expect(pattern.distance).toBeGreaterThanOrEqual(0);
      expect(pattern.distance).toBeLessThanOrEqual(1);
      expect(pattern).toHaveProperty('weatherData');
    });

    console.log('Vector search results:', {
      patternsFound: searchResponse.data.similarPatterns.length,
      distances: searchResponse.data.similarPatterns.map(p => p.distance.toFixed(3))
    });
  });

  test('7. Smoke Plume Visualization - UI renders correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for map to load
    await page.waitForSelector('.mapboxgl-canvas', { timeout: 30000 });
    
    // Check dashboard components
    await expect(page.locator('text=BURNWISE Dashboard')).toBeVisible();
    await expect(page.locator('text=Active Burns')).toBeVisible();
    await expect(page.locator('text=Schedule Optimizer')).toBeVisible();
    
    // Open burn request form
    await page.click('button:has-text("New Burn Request")');
    await expect(page.locator('text=Submit Burn Request')).toBeVisible();
    
    // Verify form fields
    await expect(page.locator('input[name="farmId"]')).toBeVisible();
    await expect(page.locator('select[name="cropType"]')).toBeVisible();
    await expect(page.locator('input[name="fieldSizeAcres"]')).toBeVisible();
    
    // Close form
    await page.keyboard.press('Escape');
    
    console.log('UI components rendered successfully');
  });

  test('8. Real-time Updates - WebSocket connection', async ({ page }) => {
    await page.goto('/');
    
    // Check WebSocket connection
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:5000');
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });
    });
    
    expect(wsConnected).toBe(true);
    console.log('WebSocket connection established');
  });

  test('9. Spatial Queries - Test geospatial operations', async ({ page }) => {
    // Test farms within radius
    const spatialResponse = await axios.post(`${API_URL}/farms/within-radius`, {
      centerLat: 45.5152,
      centerLon: -122.6784,
      radiusKm: 50
    });

    expect(spatialResponse.status).toBe(200);
    expect(spatialResponse.data).toHaveProperty('farms');
    expect(spatialResponse.data.farms).toBeInstanceOf(Array);

    console.log('Spatial query results:', {
      farmsInRadius: spatialResponse.data.farms.length
    });
  });

  test('10. Analytics Dashboard - Metrics calculation', async ({ page }) => {
    const metricsResponse = await axios.get(`${API_URL}/analytics/metrics`);
    
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.data).toHaveProperty('totalBurns');
    expect(metricsResponse.data).toHaveProperty('conflictsAvoided');
    expect(metricsResponse.data).toHaveProperty('pm25Reduction');
    expect(metricsResponse.data).toHaveProperty('farmsCovered');
    
    console.log('Analytics metrics:', metricsResponse.data);
  });
});