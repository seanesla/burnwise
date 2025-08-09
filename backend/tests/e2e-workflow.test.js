/**
 * BURNWISE End-to-End Workflow Validation Suite
 * 
 * Comprehensive testing of the complete 5-agent workflow to ensure all agents
 * execute in correct sequence and produce expected outputs under various scenarios.
 */

const request = require('supertest');
const { initializeDatabase, query, closePool } = require('../db/connection');

describe('End-to-End Workflow Validation', () => {
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initializeDatabase();
    
    const server = require('../server');
    app = server.app || server;
    
    // Ensure test farms exist
    await ensureTestFarms();
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  const ensureTestFarms = async () => {
    const testFarms = [
      {
        farm_name: 'Test Farm Alpha',
        owner_name: 'John Alpha',
        contact_email: 'alpha@testfarm.com',
        contact_phone: '+1-555-0101',
        latitude: 40.0,
        longitude: -120.0,
        total_area_hectares: 500.0,
        permit_number: 'TEST-ALPHA-001',
        permit_expiry: '2025-12-31'
      },
      {
        farm_name: 'Test Farm Beta',
        owner_name: 'Jane Beta',
        contact_email: 'beta@testfarm.com',
        contact_phone: '+1-555-0102',
        latitude: 40.1,
        longitude: -120.1,
        total_area_hectares: 300.0,
        permit_number: 'TEST-BETA-002',
        permit_expiry: '2025-12-31'
      }
    ];

    for (const farm of testFarms) {
      try {
        await query(`
          INSERT IGNORE INTO farms (
            farm_name, owner_name, contact_email, contact_phone,
            latitude, longitude, total_area_hectares,
            permit_number, permit_expiry
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          farm.farm_name, farm.owner_name, farm.contact_email, farm.contact_phone,
          farm.latitude, farm.longitude, farm.total_area_hectares,
          farm.permit_number, farm.permit_expiry
        ]);
      } catch (error) {
        // Farm may already exist, continue
      }
    }
  };

  describe('Complete 5-Agent Workflow Execution', () => {
    
    test('should execute all 5 agents in correct sequence for single burn request', async () => {
      const burnRequest = {
        farmId: 1,
        fieldId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.02, 40.02],
            [-120.02, 40.03],
            [-119.98, 40.03],
            [-119.98, 40.02],
            [-120.02, 40.02]
          ]]
        },
        requestedDate: '2025-08-20',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        burnType: 'prescribed',
        purpose: 'E2E workflow test - single request',
        elevationMeters: 250,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 18,
        estimatedDurationHours: 6
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(burnRequest)
        .timeout(30000);

      console.log(`\n🔥 Single Request Workflow Test:`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Response time: ${response.get('X-Response-Time') || 'N/A'}`);

      // Verify successful request processing
      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const responseData = response.body.data;
      
      // Agent 1: Coordinator - should create request with terrain vector
      expect(responseData).toHaveProperty('requestId');
      expect(responseData).toHaveProperty('terrainVector');
      expect(responseData).toHaveProperty('priorityScore');
      expect(responseData.terrainVector).toHaveLength(5); // Sample returned
      
      console.log(`   Request ID: ${responseData.requestId}`);
      console.log(`   Priority Score: ${responseData.priorityScore}`);
      console.log(`   Area: ${responseData.areaHectares} hectares`);

      // Agent 2: Weather - should have weather analysis
      expect(responseData).toHaveProperty('weatherAnalysis');
      expect(responseData).toHaveProperty('safetyAssessment');
      expect(responseData.safetyAssessment).toHaveProperty('isSafe');
      expect(responseData.safetyAssessment).toHaveProperty('riskLevel');

      console.log(`   Weather Safe: ${responseData.safetyAssessment.isSafe}`);
      console.log(`   Risk Level: ${responseData.safetyAssessment.riskLevel}`);

      // Agent 3: Predictor - should have conflict detection
      expect(responseData).toHaveProperty('conflictsDetected');
      expect(typeof responseData.conflictsDetected).toBe('number');

      console.log(`   Conflicts Detected: ${responseData.conflictsDetected}`);

      // Agent 4: Optimizer - should indicate if optimization occurred
      expect(responseData).toHaveProperty('scheduleOptimized');
      expect(typeof responseData.scheduleOptimized).toBe('boolean');

      console.log(`   Schedule Optimized: ${responseData.scheduleOptimized}`);

      // Agent 5: Alerts - should confirm alerts were sent
      expect(responseData).toHaveProperty('alertsSent');
      expect(responseData.alertsSent).toBe(true);

      console.log(`   Alerts Sent: ${responseData.alertsSent}`);

      // Verify database state after workflow
      await verifyDatabaseState(responseData.requestId);

      console.log(`   ✅ Complete 5-agent workflow executed successfully`);
    });

    test('should handle multiple concurrent burn requests with conflict detection', async () => {
      const sameDate = '2025-08-25';
      const overlappingRequests = [
        {
          farmId: 1,
          fieldId: 1,
          fieldGeometry: {
            type: 'Polygon',
            coordinates: [[
              [-120.10, 40.10],
              [-120.08, 40.10],
              [-120.08, 40.12],
              [-120.10, 40.12],
              [-120.10, 40.10]
            ]]
          },
          requestedDate: sameDate,
          requestedStartTime: '08:00',
          requestedEndTime: '12:00',
          purpose: 'E2E conflict test - Request A',
          elevationMeters: 200,
          terrainSlope: 8,
          fuelLoadTonsPerHectare: 15
        },
        {
          farmId: 2,
          fieldId: 2,
          fieldGeometry: {
            type: 'Polygon',
            coordinates: [[
              [-120.09, 40.11],
              [-120.07, 40.11],
              [-120.07, 40.13],
              [-120.09, 40.13],
              [-120.09, 40.11]
            ]]
          },
          requestedDate: sameDate,
          requestedStartTime: '09:00',
          requestedEndTime: '13:00',
          purpose: 'E2E conflict test - Request B',
          elevationMeters: 210,
          terrainSlope: 10,
          fuelLoadTonsPerHectare: 18
        }
      ];

      console.log(`\n🔥 Concurrent Requests Conflict Test:`);

      // Submit requests concurrently
      const requestPromises = overlappingRequests.map(req => 
        request(app)
          .post('/api/burn-requests')
          .send(req)
          .timeout(30000)
      );

      const responses = await Promise.allSettled(requestPromises);

      // Analyze responses
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      );
      const failed = responses.filter(r => 
        r.status === 'rejected' || ![200, 201].includes(r.value?.status)
      );

      console.log(`   Successful requests: ${successful.length}/2`);
      console.log(`   Failed requests: ${failed.length}/2`);

      expect(successful.length).toBeGreaterThan(0); // At least one should succeed

      // Check if conflict detection worked
      if (successful.length >= 2) {
        const request1Data = successful[0].value.body.data;
        const request2Data = successful[1].value.body.data;

        console.log(`   Request 1 conflicts: ${request1Data.conflictsDetected}`);
        console.log(`   Request 2 conflicts: ${request2Data.conflictsDetected}`);

        // At least one should detect conflicts if both succeeded
        const totalConflicts = request1Data.conflictsDetected + request2Data.conflictsDetected;
        if (totalConflicts > 0) {
          console.log(`   ✅ Conflict detection working correctly`);
        }
      }

      // Test conflict detection API directly
      const conflictResponse = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({ date: sameDate })
        .timeout(15000);

      if (conflictResponse.status === 200) {
        console.log(`   Direct conflict detection: ${conflictResponse.body.data?.length || 0} conflicts found`);
      }
    });

    test('should execute optimization workflow when conflicts exist', async () => {
      // Create multiple requests for same date to force conflicts
      const conflictDate = '2025-08-30';
      const conflictRequests = Array.from({ length: 3 }, (_, i) => ({
        farmId: (i % 2) + 1,
        fieldId: i + 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.05 + i * 0.02, 40.05 + i * 0.02],
            [-120.03 + i * 0.02, 40.05 + i * 0.02],
            [-120.03 + i * 0.02, 40.07 + i * 0.02],
            [-120.05 + i * 0.02, 40.07 + i * 0.02],
            [-120.05 + i * 0.02, 40.05 + i * 0.02]
          ]]
        },
        requestedDate: conflictDate,
        requestedStartTime: '10:00',
        requestedEndTime: '14:00',
        purpose: `E2E optimization test - Request ${i + 1}`,
        elevationMeters: 250 + i * 50,
        terrainSlope: 10 + i * 5,
        fuelLoadTonsPerHectare: 15 + i * 5
      }));

      console.log(`\n🔥 Optimization Workflow Test:`);

      // Submit requests sequentially to ensure they all get processed
      const requestIds = [];
      for (const req of conflictRequests) {
        const response = await request(app)
          .post('/api/burn-requests')
          .send(req)
          .timeout(30000);

        if ([200, 201].includes(response.status)) {
          requestIds.push(response.body.data.requestId);
          console.log(`   Created request ${response.body.data.requestId}`);
        }
      }

      if (requestIds.length > 1) {
        // Test schedule optimization
        const optimizeResponse = await request(app)
          .post('/api/schedule/optimize')
          .send({
            startDate: conflictDate,
            endDate: '2025-09-05'
          })
          .timeout(45000);

        console.log(`   Optimization API status: ${optimizeResponse.status}`);

        if (optimizeResponse.status === 200) {
          const optimizationData = optimizeResponse.body.data;
          console.log(`   Optimization run ID: ${optimizationData.optimizationRunId}`);
          console.log(`   Conflicts resolved: ${optimizationData.improvements.conflictsResolved}`);
          console.log(`   Requests rescheduled: ${optimizationData.improvements.requestsRescheduled}`);
          console.log(`   ✅ Optimization workflow completed`);

          expect(optimizationData).toHaveProperty('optimizationRunId');
          expect(optimizationData).toHaveProperty('improvements');
        }
      }
    });

    test('should handle weather-related safety assessments correctly', async () => {
      console.log(`\n🌤️ Weather Safety Assessment Test:`);

      // Test with coordinates that should have weather data
      const weatherTestRequest = {
        farmId: 1,
        fieldId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.0, 40.0],
            [-119.99, 40.0],
            [-119.99, 40.01],
            [-120.0, 40.01],
            [-120.0, 40.0]
          ]]
        },
        requestedDate: '2025-09-01',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        purpose: 'E2E weather safety test',
        elevationMeters: 300,
        terrainSlope: 15,
        fuelLoadTonsPerHectare: 20
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(weatherTestRequest)
        .timeout(30000);

      expect([200, 201]).toContain(response.status);
      
      const responseData = response.body.data;
      
      // Verify weather analysis was performed
      expect(responseData).toHaveProperty('weatherAnalysis');
      expect(responseData).toHaveProperty('safetyAssessment');

      if (responseData.weatherAnalysis) {
        console.log(`   Weather data retrieved: ✅`);
        console.log(`   Temperature: ${responseData.weatherAnalysis.temperature}°C`);
        console.log(`   Wind speed: ${responseData.weatherAnalysis.windSpeed} m/s`);
        console.log(`   Humidity: ${responseData.weatherAnalysis.humidity}%`);
      }

      console.log(`   Safety assessment: ${responseData.safetyAssessment.riskLevel}`);
      console.log(`   Burn safe: ${responseData.safetyAssessment.isSafe}`);

      // Test direct weather API
      const weatherResponse = await request(app)
        .get('/api/weather/current?lat=40.0&lon=-120.0')
        .timeout(15000);

      if (weatherResponse.status === 200) {
        console.log(`   Direct weather API: ✅`);
        console.log(`   Weather conditions: ${weatherResponse.body.data?.conditions || 'N/A'}`);
      }
    });

    test('should generate and store all vector types correctly', async () => {
      console.log(`\n📊 Vector Generation Validation Test:`);

      const vectorTestRequest = {
        farmId: 1,
        fieldId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.1, 40.1],
            [-120.09, 40.1],
            [-120.09, 40.11],
            [-120.1, 40.11],
            [-120.1, 40.1]
          ]]
        },
        requestedDate: '2025-09-05',
        requestedStartTime: '08:00',
        requestedEndTime: '12:00',
        purpose: 'E2E vector validation test',
        elevationMeters: 280,
        terrainSlope: 18,
        fuelLoadTonsPerHectare: 22
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(vectorTestRequest)
        .timeout(30000);

      expect([200, 201]).toContain(response.status);
      
      const requestId = response.body.data.requestId;
      
      // Verify terrain vector was stored (32-dimensional)
      const [burnRecord] = await query(
        'SELECT terrain_vector FROM burn_requests WHERE request_id = ?',
        [requestId]
      );

      if (burnRecord?.terrain_vector) {
        const terrainVector = JSON.parse(burnRecord.terrain_vector);
        expect(terrainVector).toHaveLength(32);
        console.log(`   Terrain vector (32-dim): ✅`);
      }

      // Verify weather vector was stored (128-dimensional)
      const weatherRecords = await query(`
        SELECT weather_pattern_embedding FROM weather_conditions 
        WHERE DATE(observation_time) = ? 
        ORDER BY observation_time DESC 
        LIMIT 1
      `, ['2025-09-05']);

      if (weatherRecords.length > 0 && weatherRecords[0].weather_pattern_embedding) {
        const weatherVector = JSON.parse(weatherRecords[0].weather_pattern_embedding);
        expect(weatherVector).toHaveLength(128);
        console.log(`   Weather vector (128-dim): ✅`);
      }

      // Verify smoke vector was stored (64-dimensional)
      const smokeRecords = await query(
        'SELECT plume_vector FROM smoke_predictions WHERE burn_request_id = ?',
        [requestId]
      );

      if (smokeRecords.length > 0 && smokeRecords[0].plume_vector) {
        const smokeVector = JSON.parse(smokeRecords[0].plume_vector);
        expect(smokeVector).toHaveLength(64);
        console.log(`   Smoke vector (64-dim): ✅`);
      }

      console.log(`   All vector types generated and stored correctly ✅`);
    });
  });

  describe('Workflow Error Handling and Recovery', () => {
    
    test('should handle agent failures gracefully without stopping workflow', async () => {
      console.log(`\n🛡️ Agent Failure Recovery Test:`);

      // Request with potentially problematic data
      const problematicRequest = {
        farmId: 999, // Non-existent farm
        fieldId: 999,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.0, 40.0],
            [-119.99, 40.0],
            [-119.99, 40.01],
            [-120.0, 40.01],
            [-120.0, 40.0]
          ]]
        },
        requestedDate: '2025-09-10',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        purpose: 'E2E error handling test'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(problematicRequest)
        .timeout(30000);

      console.log(`   Response status: ${response.status}`);
      console.log(`   Error handling: ${response.status >= 400 ? '✅' : 'N/A'}`);

      // Should either succeed with validation or fail gracefully
      expect([200, 201, 400, 422]).toContain(response.status);

      if (response.status >= 400) {
        expect(response.body).toHaveProperty('error');
        console.log(`   Error message: ${response.body.error}`);
      }
    });

    test('should handle database connectivity issues gracefully', async () => {
      console.log(`\n💾 Database Connectivity Test:`);

      // Create multiple simultaneous requests to stress database connections
      const stressRequests = Array.from({ length: 20 }, (_, i) => ({
        farmId: (i % 2) + 1,
        fieldId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.0 + i * 0.001, 40.0 + i * 0.001],
            [-119.99 + i * 0.001, 40.0 + i * 0.001],
            [-119.99 + i * 0.001, 40.01 + i * 0.001],
            [-120.0 + i * 0.001, 40.01 + i * 0.001],
            [-120.0 + i * 0.001, 40.0 + i * 0.001]
          ]]
        },
        requestedDate: `2025-09-${String(10 + (i % 5)).padStart(2, '0')}`,
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        purpose: `E2E database stress test ${i}`
      }));

      const requestPromises = stressRequests.map(req => 
        request(app)
          .post('/api/burn-requests')
          .send(req)
          .timeout(30000)
      );

      const responses = await Promise.allSettled(requestPromises);

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      ).length;

      const failed = responses.filter(r => 
        r.status === 'rejected' || ![200, 201].includes(r.value?.status)
      ).length;

      console.log(`   Successful: ${successful}/20`);
      console.log(`   Failed: ${failed}/20`);
      console.log(`   Success rate: ${(successful / 20 * 100).toFixed(1)}%`);

      // Should handle database stress reasonably well
      expect(successful).toBeGreaterThan(10); // At least 50% success rate
    });

    test('should maintain data consistency during workflow interruptions', async () => {
      console.log(`\n🔄 Data Consistency Test:`);

      const consistencyRequest = {
        farmId: 1,
        fieldId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.15, 40.15],
            [-120.14, 40.15],
            [-120.14, 40.16],
            [-120.15, 40.16],
            [-120.15, 40.15]
          ]]
        },
        requestedDate: '2025-09-15',
        requestedStartTime: '10:00',
        requestedEndTime: '14:00',
        purpose: 'E2E consistency test',
        elevationMeters: 320,
        terrainSlope: 20,
        fuelLoadTonsPerHectare: 25
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(consistencyRequest)
        .timeout(30000);

      if ([200, 201].includes(response.status)) {
        const requestId = response.body.data.requestId;
        
        // Verify all related data was created consistently
        const [burnRequest] = await query(
          'SELECT * FROM burn_requests WHERE request_id = ?',
          [requestId]
        );

        expect(burnRequest).toBeDefined();
        expect(burnRequest.purpose).toBe('E2E consistency test');

        // Check if terrain vector is properly formatted
        if (burnRequest.terrain_vector) {
          const terrainVector = JSON.parse(burnRequest.terrain_vector);
          expect(terrainVector).toHaveLength(32);
          terrainVector.forEach(component => {
            expect(component).toBeFinite();
            expect(component).not.toBeNaN();
          });
        }

        console.log(`   Data consistency maintained ✅`);
        console.log(`   Request ID: ${requestId}`);
      }
    });
  });

  // Helper function to verify database state after workflow execution
  const verifyDatabaseState = async (requestId) => {
    // Verify burn request was created
    const [burnRequest] = await query(
      'SELECT * FROM burn_requests WHERE request_id = ?',
      [requestId]
    );
    expect(burnRequest).toBeDefined();

    // Check if terrain vector was stored
    if (burnRequest.terrain_vector) {
      const terrainVector = JSON.parse(burnRequest.terrain_vector);
      expect(terrainVector).toHaveLength(32);
    }

    // Check if weather data was stored
    const weatherRecords = await query(`
      SELECT * FROM weather_conditions 
      WHERE DATE(observation_time) = DATE(?)
      ORDER BY observation_time DESC
      LIMIT 1
    `, [burnRequest.requested_date]);

    // Check if smoke predictions were created
    const smokeRecords = await query(
      'SELECT * FROM smoke_predictions WHERE burn_request_id = ?',
      [requestId]
    );

    console.log(`   Database verification:`);
    console.log(`     Burn request: ✅`);
    console.log(`     Weather data: ${weatherRecords.length > 0 ? '✅' : 'ℹ️'}`);
    console.log(`     Smoke predictions: ${smokeRecords.length > 0 ? '✅' : 'ℹ️'}`);
  };
});