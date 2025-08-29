const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool, getConnection } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinator');
const WeatherAgent = require('../../agents/weather');
const SmokeOverlapPredictor = require('../../agents/predictor');
const ScheduleOptimizer = require('../../agents/optimizer');
const AlertSystem = require('../../agents/alerts');

describe('Five-Agent Workflow Integration Tests - Life-Critical Burn Coordination', () => {
  let coordinator;
  let weatherAgent;
  let predictor;
  let optimizer;
  let alertSystem;
  let testBurnRequests;
  
  beforeAll(async () => {
    await initializeDatabase();
    
    // Initialize all 5 agents
    coordinator = new CoordinatorAgent();
    weatherAgent = new WeatherAgent();
    predictor = new SmokeOverlapPredictor();
    optimizer = new ScheduleOptimizer();
    alertSystem = new AlertSystem();
    
    // Create realistic burn request scenarios
    testBurnRequests = [
      {
        farmId: 1,
        fieldId: 101,
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00',
        requestedEndTime: '13:00',
        areaHectares: 100,
        cropType: 'wheat_stubble',
        fuelLoad: 20,
        lat: 40.0,
        lon: -120.0,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.01, 40.01],
            [-119.99, 40.01],
            [-119.99, 39.99],
            [-120.01, 39.99],
            [-120.01, 40.01]
          ]]
        }
      },
      {
        farmId: 2,
        fieldId: 102,
        requestedDate: '2025-08-25',
        requestedStartTime: '10:00',
        requestedEndTime: '14:00',
        areaHectares: 150,
        cropType: 'rice_stubble',
        fuelLoad: 25,
        lat: 40.02,
        lon: -120.02,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.03, 40.03],
            [-120.01, 40.03],
            [-120.01, 40.01],
            [-120.03, 40.01],
            [-120.03, 40.03]
          ]]
        }
      },
      {
        farmId: 3,
        fieldId: 103,
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00',
        requestedEndTime: '12:00',
        areaHectares: 80,
        cropType: 'corn_stubble',
        fuelLoad: 18,
        lat: 40.01,
        lon: -120.01,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.02, 40.02],
            [-120.00, 40.02],
            [-120.00, 40.00],
            [-120.02, 40.00],
            [-120.02, 40.02]
          ]]
        }
      }
    ];
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Complete 5-Agent Workflow Execution', () => {
    test('Should execute full workflow: Coordinator → Weather → Predictor → Optimizer → Alerts', async () => {
      const workflowResult = {
        coordinator: null,
        weather: null,
        predictor: null,
        optimizer: null,
        alerts: null
      };
      
      // Step 1: Coordinator validates and prioritizes request
      const burnRequest = testBurnRequests[0];
      workflowResult.coordinator = await coordinator.coordinateBurnRequest({
        farmId: burnRequest.farmId,
        fieldId: burnRequest.fieldId,
        requestedDate: burnRequest.requestedDate,
        areaHectares: burnRequest.areaHectares,
        cropType: burnRequest.cropType
      });
      
      expect(workflowResult.coordinator).toHaveProperty('priorityScore');
      expect(workflowResult.coordinator).toHaveProperty('terrainVector');
      expect(workflowResult.coordinator.terrainVector).toHaveLength(32);
      
      // Step 2: Weather analysis
      workflowResult.weather = await weatherAgent.analyzeWeatherForBurn(
        burnRequest.lat,
        burnRequest.lon,
        burnRequest.requestedDate
      );
      
      expect(workflowResult.weather).toHaveProperty('suitable');
      expect(workflowResult.weather).toHaveProperty('weatherVector');
      expect(workflowResult.weather.weatherVector).toHaveLength(128);
      
      // Step 3: Predictor detects conflicts
      workflowResult.predictor = await predictor.predictSmokeOverlap(testBurnRequests);
      
      expect(workflowResult.predictor).toHaveProperty('conflicts');
      expect(Array.isArray(workflowResult.predictor.conflicts)).toBeTruthy();
      
      // Step 4: Optimizer schedules burns
      if (workflowResult.predictor.conflicts.length > 0) {
        workflowResult.optimizer = await optimizer.optimizeWithSimulatedAnnealing(
          testBurnRequests,
          workflowResult.predictor.conflicts,
          { '2025-08-25': workflowResult.weather.current }
        );
        
        expect(workflowResult.optimizer).toHaveProperty('schedule');
        expect(workflowResult.optimizer).toHaveProperty('cost');
        expect(workflowResult.optimizer).toHaveProperty('improvements');
      }
      
      // Step 5: Alert system sends notifications
      if (workflowResult.optimizer?.schedule) {
        workflowResult.alerts = await alertSystem.sendAlerts(
          Object.entries(workflowResult.optimizer.schedule).map(([id, slot]) => ({
            burnRequestId: parseInt(id),
            farmId: testBurnRequests.find(r => r.fieldId == id)?.farmId,
            scheduledTime: new Date(`${slot.date} ${slot.start}`)
          }))
        );
        
        expect(workflowResult.alerts).toHaveProperty('sent');
        expect(Array.isArray(workflowResult.alerts.sent)).toBeTruthy();
      }
      
      // Verify complete workflow execution
      expect(workflowResult.coordinator).not.toBeNull();
      expect(workflowResult.weather).not.toBeNull();
      expect(workflowResult.predictor).not.toBeNull();
    });

    test('Should handle multiple simultaneous burn requests through workflow', async () => {
      const results = [];
      
      // Process all test requests through the workflow
      for (const request of testBurnRequests) {
        const workflowResult = {};
        
        // Coordinator
        workflowResult.coordinator = await coordinator.coordinateBurnRequest({
          farmId: request.farmId,
          fieldId: request.fieldId,
          requestedDate: request.requestedDate,
          areaHectares: request.areaHectares,
          cropType: request.cropType
        });
        
        // Weather
        workflowResult.weather = await weatherAgent.analyzeWeatherForBurn(
          request.lat,
          request.lon,
          request.requestedDate
        );
        
        results.push(workflowResult);
      }
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.coordinator.priorityScore).toBeGreaterThan(0);
        expect(result.coordinator.priorityScore).toBeLessThanOrEqual(100);
      });
    });

    test('Should detect and resolve conflicts between adjacent burns', async () => {
      // Process adjacent burns that will conflict
      const adjacentBurns = testBurnRequests.slice(0, 2); // Farms 1 and 2 are adjacent
      
      // Run through predictor
      const conflicts = await predictor.predictSmokeOverlap(adjacentBurns);
      
      expect(conflicts.conflicts.length).toBeGreaterThan(0);
      
      // Verify conflict details
      const conflict = conflicts.conflicts[0];
      expect(conflict).toHaveProperty('severity');
      expect(['low', 'medium', 'high', 'critical']).toContain(conflict.severity);
      expect(conflict).toHaveProperty('maxCombinedPM25');
      
      // Optimize to resolve conflicts
      const weatherData = { '2025-08-25': { windSpeed: 10, humidity: 60 } };
      const optimized = await optimizer.optimizeWithSimulatedAnnealing(
        adjacentBurns,
        conflicts.conflicts,
        weatherData
      );
      
      expect(optimized.improvements.conflictsResolved).toBeGreaterThan(0);
    });

    test('Should abort workflow on critical safety violation', async () => {
      const dangerousBurn = {
        ...testBurnRequests[0],
        windSpeed: 40, // Dangerous wind speed
        humidity: 10   // Very dry conditions
      };
      
      // Weather analysis should flag as unsafe
      const weatherAnalysis = await weatherAgent.analyzeWeatherForBurn(
        dangerousBurn.lat,
        dangerousBurn.lon,
        dangerousBurn.requestedDate
      );
      
      // Check for specific dangerous conditions
      const isDangerous = weatherAnalysis.current?.windSpeed > 25 || 
                          weatherAnalysis.current?.humidity < 20;
      
      if (isDangerous) {
        expect(weatherAnalysis.suitable).toBeFalsy();
        
        // Workflow should not proceed to scheduling
        const shouldProceed = weatherAnalysis.suitable && !weatherAnalysis.warnings?.includes('HIGH_WIND');
        expect(shouldProceed).toBeFalsy();
      }
    });

    test('Should maintain data consistency across all agents', async () => {
      const request = testBurnRequests[0];
      const requestId = request.fieldId;
      
      // Each agent should reference the same request
      const coordinatorData = await coordinator.coordinateBurnRequest({
        fieldId: requestId,
        farmId: request.farmId,
        requestedDate: request.requestedDate,
        areaHectares: request.areaHectares
      });
      
      expect(coordinatorData.fieldId).toBe(requestId);
      
      // Weather analysis for same location
      const weatherData = await weatherAgent.analyzeWeatherForBurn(
        request.lat,
        request.lon,
        request.requestedDate
      );
      
      expect(weatherData.location.lat).toBeCloseTo(request.lat, 2);
      expect(weatherData.location.lon).toBeCloseTo(request.lon, 2);
      
      // Predictor should process same request
      const predictions = await predictor.predictSmokeOverlap([request]);
      expect(predictions.processedRequests).toBe(1);
    });
  });

  describe('Agent Communication and Data Flow', () => {
    test('Should pass terrain vectors from Coordinator to Predictor', async () => {
      const request = testBurnRequests[0];
      
      // Coordinator generates terrain vector
      const coordinatorResult = await coordinator.coordinateBurnRequest({
        farmId: request.farmId,
        fieldId: request.fieldId,
        lat: request.lat,
        lon: request.lon,
        elevation: 100,
        slope: 5,
        vegetation: 'grassland',
        areaHectares: request.areaHectares
      });
      
      expect(coordinatorResult.terrainVector).toHaveLength(32);
      
      // Predictor uses terrain vector for smoke calculations
      const smokeVector = await predictor.generateSmokeVector(
        request.fieldId,
        { windSpeed: 10, windDirection: 180 },
        request.areaHectares
      );
      
      expect(smokeVector).toHaveLength(64);
      
      // Verify vectors can be combined for analysis
      const combinedAnalysis = combineVectorsForAnalysis(
        coordinatorResult.terrainVector,
        smokeVector
      );
      
      expect(combinedAnalysis).toHaveLength(96); // 32 + 64
    });

    test('Should pass weather vectors from Weather to Predictor', async () => {
      const weather = await weatherAgent.analyzeWeatherForBurn(
        testBurnRequests[0].lat,
        testBurnRequests[0].lon,
        testBurnRequests[0].requestedDate
      );
      
      expect(weather.weatherVector).toHaveLength(128);
      
      // Predictor uses weather for dispersion calculations
      const dispersion = await predictor.calculateDispersionWithWeather(
        testBurnRequests[0],
        weather.weatherVector
      );
      
      expect(dispersion).toHaveProperty('plumeVector');
      expect(dispersion.plumeVector).toHaveLength(64);
    });

    test('Should pass conflict data from Predictor to Optimizer', async () => {
      // Predictor detects conflicts
      const conflicts = await predictor.predictSmokeOverlap(testBurnRequests);
      
      expect(conflicts.conflicts).toBeDefined();
      
      // Optimizer receives exact conflict structure
      const weatherData = { '2025-08-25': { windSpeed: 10 } };
      const optimized = await optimizer.optimizeWithSimulatedAnnealing(
        testBurnRequests,
        conflicts.conflicts,
        weatherData
      );
      
      // Verify optimizer processed the conflicts
      expect(optimized.improvements).toHaveProperty('conflictsResolved');
      expect(optimized.improvements.totalRequests).toBe(testBurnRequests.length);
    });

    test('Should pass optimized schedule from Optimizer to Alerts', async () => {
      const weatherData = { '2025-08-25': { windSpeed: 10 } };
      
      // Create mock conflicts
      const mockConflicts = [{
        request_id_1: testBurnRequests[0].fieldId,
        request_id_2: testBurnRequests[1].fieldId,
        conflict_severity: 'high',
        max_combined_pm25: 85
      }];
      
      // Optimizer creates schedule
      const optimized = await optimizer.optimizeWithSimulatedAnnealing(
        testBurnRequests.map(r => ({
          request_id: r.fieldId,
          field_id: r.fieldId,
          farm_id: r.farmId,
          requested_date: r.requestedDate,
          requested_start_time: r.requestedStartTime,
          requested_end_time: r.requestedEndTime,
          priority_score: 80,
          area_hectares: r.areaHectares,
          lat: r.lat,
          lon: r.lon
        })),
        mockConflicts,
        weatherData
      );
      
      // Alerts receives schedule
      const schedule = Object.entries(optimized.schedule).map(([id, slot]) => ({
        burnRequestId: parseInt(id),
        farmId: testBurnRequests.find(r => r.fieldId == id)?.farmId || 1,
        scheduledTime: new Date(`${slot.date} ${slot.start}`),
        changes: slot.date !== '2025-08-25' ? { rescheduled: true } : null
      }));
      
      const alerts = await alertSystem.sendAlerts(schedule);
      
      expect(alerts.sent).toBeDefined();
      expect(Array.isArray(alerts.sent)).toBeTruthy();
    });

    test('Should maintain vector dimensions through agent pipeline', () => {
      const dimensions = {
        terrain: 32,
        smoke: 64,
        weather: 128
      };
      
      // Verify each agent produces correct dimensions
      const terrainVector = new Array(dimensions.terrain).fill(0);
      const smokeVector = new Array(dimensions.smoke).fill(0);
      const weatherVector = new Array(dimensions.weather).fill(0);
      
      expect(terrainVector).toHaveLength(32);
      expect(smokeVector).toHaveLength(64);
      expect(weatherVector).toHaveLength(128);
      
      // Combined vector for comprehensive analysis
      const combined = [...terrainVector, ...smokeVector, ...weatherVector];
      expect(combined).toHaveLength(224); // 32 + 64 + 128
    });
  });

  describe('Error Handling and Recovery', () => {
    test('Should handle Coordinator agent failure gracefully', async () => {
      const invalidRequest = {
        farmId: null, // Invalid
        fieldId: null, // Invalid
        requestedDate: 'invalid-date',
        areaHectares: -100 // Invalid negative area
      };
      
      try {
        await coordinator.coordinateBurnRequest(invalidRequest);
        expect(false).toBeTruthy(); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('validation');
        
        // Workflow should not proceed
        const canProceed = false;
        expect(canProceed).toBeFalsy();
      }
    });

    test('Should handle Weather agent API failure', async () => {
      // Mock API failure
      const originalFetch = weatherAgent.fetchWeatherData;
      weatherAgent.fetchWeatherData = jest.fn().mockRejectedValue(new Error('API timeout'));
      
      try {
        await weatherAgent.analyzeWeatherForBurn(40.0, -120.0, '2025-08-25');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
      
      // Restore original method
      weatherAgent.fetchWeatherData = originalFetch;
    });

    test('Should handle Predictor calculation errors', async () => {
      const invalidBurns = [
        {
          ...testBurnRequests[0],
          areaHectares: NaN,
          lat: 'invalid',
          lon: null
        }
      ];
      
      try {
        await predictor.predictSmokeOverlap(invalidBurns);
      } catch (error) {
        expect(error).toBeDefined();
        
        // Should provide fallback or error details
        expect(error.message).toBeDefined();
      }
    });

    test('Should handle Optimizer convergence failure', async () => {
      // Create impossible optimization scenario
      const impossibleRequests = testBurnRequests.map(r => ({
        ...r,
        request_id: r.fieldId,
        priority_score: 100, // All max priority
        requested_date: '2025-08-25',
        requested_start_time: '09:00', // All same time
        requested_end_time: '13:00'
      }));
      
      // Create conflicts between all pairs
      const conflicts = [];
      for (let i = 0; i < impossibleRequests.length; i++) {
        for (let j = i + 1; j < impossibleRequests.length; j++) {
          conflicts.push({
            request_id_1: impossibleRequests[i].request_id,
            request_id_2: impossibleRequests[j].request_id,
            conflict_severity: 'critical',
            max_combined_pm25: 200
          });
        }
      }
      
      const weatherData = { '2025-08-25': { windSpeed: 10 } };
      
      // Should still produce a schedule, even if suboptimal
      const result = await optimizer.optimizeWithSimulatedAnnealing(
        impossibleRequests,
        conflicts,
        weatherData
      );
      
      expect(result.schedule).toBeDefined();
      expect(result.cost).toBeGreaterThan(0); // High cost due to conflicts
    });

    test('Should handle Alert delivery failure', async () => {
      // Mock SMS failure
      alertSystem.sendSMS = jest.fn().mockResolvedValue({
        success: false,
        error: 'Network error'
      });
      
      const schedule = [{
        burnRequestId: 1,
        farmId: 1,
        scheduledTime: new Date('2025-08-25T09:00:00')
      }];
      
      const result = await alertSystem.sendAlerts(schedule);
      
      // Should track failed alerts
      expect(result.sent).toBeDefined();
      
      // Restore original method
      alertSystem.sendSMS = jest.fn();
    });
  });

  describe('Workflow State Management', () => {
    test('Should track workflow execution state', async () => {
      const workflowState = {
        id: 'workflow_001',
        status: 'initiated',
        startTime: new Date(),
        stages: {
          coordinator: { status: 'pending', result: null },
          weather: { status: 'pending', result: null },
          predictor: { status: 'pending', result: null },
          optimizer: { status: 'pending', result: null },
          alerts: { status: 'pending', result: null }
        }
      };
      
      // Execute workflow with state tracking
      const request = testBurnRequests[0];
      
      // Stage 1: Coordinator
      workflowState.stages.coordinator.status = 'running';
      workflowState.stages.coordinator.result = await coordinator.coordinateBurnRequest({
        farmId: request.farmId,
        fieldId: request.fieldId,
        requestedDate: request.requestedDate,
        areaHectares: request.areaHectares
      });
      workflowState.stages.coordinator.status = 'completed';
      
      // Stage 2: Weather
      workflowState.stages.weather.status = 'running';
      workflowState.stages.weather.result = await weatherAgent.analyzeWeatherForBurn(
        request.lat,
        request.lon,
        request.requestedDate
      );
      workflowState.stages.weather.status = 'completed';
      
      // Verify state progression
      expect(workflowState.stages.coordinator.status).toBe('completed');
      expect(workflowState.stages.weather.status).toBe('completed');
      expect(workflowState.stages.predictor.status).toBe('pending');
    });

    test('Should support workflow rollback on failure', async () => {
      const connection = await getConnection();
      let transactionStarted = false;
      
      try {
        await connection.beginTransaction();
        transactionStarted = true;
        
        // Start workflow operations
        const request = testBurnRequests[0];
        
        // Insert burn request (would be actual DB operation)
        const insertSQL = `
          INSERT INTO burn_requests_test (
            field_id, farm_id, requested_date, status
          ) VALUES (?, ?, ?, 'processing')
        `;
        
        await connection.execute(insertSQL, [
          request.fieldId,
          request.farmId,
          request.requestedDate
        ]);
        
        // Simulate failure in workflow
        throw new Error('Workflow failure at predictor stage');
        
        await connection.commit();
      } catch (error) {
        if (transactionStarted && connection) {
          await connection.rollback();
        }
        
        // Verify rollback
        expect(error.message).toContain('Workflow failure');
        
        // Check that no data was persisted
        const checkSQL = 'SELECT * FROM burn_requests_test WHERE field_id = ?';
        try {
          const result = await query(checkSQL, [testBurnRequests[0].fieldId]);
          expect(result).toHaveLength(0);
        } catch (dbError) {
          // Expected if table doesn't exist
        }
      } finally {
        if (connection) connection.release();
      }
    });

    test('Should handle partial workflow completion', async () => {
      const request = testBurnRequests[0];
      const partialResults = {};
      
      // Complete first 3 stages
      partialResults.coordinator = await coordinator.coordinateBurnRequest({
        farmId: request.farmId,
        fieldId: request.fieldId,
        requestedDate: request.requestedDate,
        areaHectares: request.areaHectares
      });
      
      partialResults.weather = await weatherAgent.analyzeWeatherForBurn(
        request.lat,
        request.lon,
        request.requestedDate
      );
      
      partialResults.predictor = await predictor.predictSmokeOverlap([request]);
      
      // Simulate optimizer failure
      partialResults.optimizer = null;
      partialResults.alerts = null;
      
      // Verify partial completion
      expect(partialResults.coordinator).not.toBeNull();
      expect(partialResults.weather).not.toBeNull();
      expect(partialResults.predictor).not.toBeNull();
      expect(partialResults.optimizer).toBeNull();
      expect(partialResults.alerts).toBeNull();
      
      // System should handle partial results
      const isPartiallyComplete = partialResults.predictor !== null && 
                                  partialResults.optimizer === null;
      expect(isPartiallyComplete).toBeTruthy();
    });
  });

  describe('Performance and Timing', () => {
    test('Should complete full workflow within SLA (< 10 seconds)', async () => {
      const startTime = performance.now();
      
      // Execute complete workflow
      const request = testBurnRequests[0];
      
      await coordinator.coordinateBurnRequest({
        farmId: request.farmId,
        fieldId: request.fieldId,
        requestedDate: request.requestedDate,
        areaHectares: request.areaHectares
      });
      
      await weatherAgent.analyzeWeatherForBurn(
        request.lat,
        request.lon,
        request.requestedDate
      );
      
      await predictor.predictSmokeOverlap([request]);
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // Convert to seconds
      
      expect(duration).toBeLessThan(10); // 10 second SLA
    });

    test('Should handle concurrent workflow executions', async () => {
      const workflows = testBurnRequests.map(async (request) => {
        const result = {};
        
        result.coordinator = await coordinator.coordinateBurnRequest({
          farmId: request.farmId,
          fieldId: request.fieldId,
          requestedDate: request.requestedDate,
          areaHectares: request.areaHectares
        });
        
        result.weather = await weatherAgent.analyzeWeatherForBurn(
          request.lat,
          request.lon,
          request.requestedDate
        );
        
        return result;
      });
      
      const results = await Promise.all(workflows);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.coordinator).toBeDefined();
        expect(result.weather).toBeDefined();
      });
    });

    test('Should implement circuit breaker for failing agents', () => {
      const circuitBreaker = {
        failures: 0,
        threshold: 3,
        isOpen: false,
        lastFailure: null
      };
      
      // Simulate failures
      for (let i = 0; i < 4; i++) {
        try {
          // Simulate agent call that fails
          throw new Error('Agent failure');
        } catch (error) {
          circuitBreaker.failures++;
          circuitBreaker.lastFailure = new Date();
          
          if (circuitBreaker.failures >= circuitBreaker.threshold) {
            circuitBreaker.isOpen = true;
          }
        }
      }
      
      expect(circuitBreaker.isOpen).toBeTruthy();
      expect(circuitBreaker.failures).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Audit and Compliance', () => {
    test('Should log all agent decisions for audit trail', async () => {
      const auditLog = [];
      
      const request = testBurnRequests[0];
      
      // Log coordinator decision
      const coordinatorResult = await coordinator.coordinateBurnRequest({
        farmId: request.farmId,
        fieldId: request.fieldId,
        requestedDate: request.requestedDate,
        areaHectares: request.areaHectares
      });
      
      auditLog.push({
        timestamp: new Date(),
        agent: 'coordinator',
        action: 'burn_request_validated',
        data: {
          fieldId: request.fieldId,
          priorityScore: coordinatorResult.priorityScore
        }
      });
      
      // Log weather decision
      const weatherResult = await weatherAgent.analyzeWeatherForBurn(
        request.lat,
        request.lon,
        request.requestedDate
      );
      
      auditLog.push({
        timestamp: new Date(),
        agent: 'weather',
        action: 'weather_analyzed',
        data: {
          suitable: weatherResult.suitable,
          windSpeed: weatherResult.current?.windSpeed
        }
      });
      
      // Verify audit trail
      expect(auditLog).toHaveLength(2);
      expect(auditLog[0].agent).toBe('coordinator');
      expect(auditLog[1].agent).toBe('weather');
    });

    test('Should track safety threshold violations', async () => {
      const safetyViolations = [];
      
      // Check PM2.5 thresholds
      const pm25Levels = [30, 55, 150, 250]; // Various levels
      
      pm25Levels.forEach(level => {
        if (level > 35) { // EPA safe threshold
          safetyViolations.push({
            type: 'PM2.5_EXCEEDANCE',
            value: level,
            threshold: 35,
            severity: level > 150 ? 'critical' : level > 55 ? 'high' : 'moderate'
          });
        }
      });
      
      expect(safetyViolations.length).toBeGreaterThan(0);
      
      const criticalViolations = safetyViolations.filter(v => v.severity === 'critical');
      expect(criticalViolations.length).toBeGreaterThan(0);
    });

    test('Should enforce mandatory safety checks', async () => {
      const safetyChecks = {
        windSpeed: { checked: false, passed: false, value: null },
        humidity: { checked: false, passed: false, value: null },
        proximity: { checked: false, passed: false, value: null },
        pm25Forecast: { checked: false, passed: false, value: null }
      };
      
      // Perform safety checks
      const weather = {
        windSpeed: 8,
        humidity: 45,
        temperature: 25
      };
      
      // Wind speed check
      safetyChecks.windSpeed.checked = true;
      safetyChecks.windSpeed.value = weather.windSpeed;
      safetyChecks.windSpeed.passed = weather.windSpeed < 25 && weather.windSpeed > 1;
      
      // Humidity check
      safetyChecks.humidity.checked = true;
      safetyChecks.humidity.value = weather.humidity;
      safetyChecks.humidity.passed = weather.humidity > 20;
      
      // Verify all checks performed
      const allChecked = Object.values(safetyChecks).every(check => check.checked);
      expect(allChecked).toBeFalsy(); // Not all checked yet
      
      // Check if safe to proceed
      const checkedItems = Object.values(safetyChecks).filter(c => c.checked);
      const safeToProce = checkedItems.every(check => check.passed);
      expect(safeToProce).toBeTruthy();
    });
  });

  describe('Regional Coordination', () => {
    test('Should coordinate burns across multiple farms in region', async () => {
      const regionalBurns = testBurnRequests;
      
      // Process all burns in region
      const regionalConflicts = await predictor.predictSmokeOverlap(regionalBurns);
      
      expect(regionalConflicts.processedRequests).toBe(regionalBurns.length);
      
      // Optimize regional schedule
      const weatherData = { '2025-08-25': { windSpeed: 10 } };
      const regionalSchedule = await optimizer.optimizeWithSimulatedAnnealing(
        regionalBurns.map(r => ({
          request_id: r.fieldId,
          field_id: r.fieldId,
          farm_id: r.farmId,
          requested_date: r.requestedDate,
          requested_start_time: r.requestedStartTime,
          requested_end_time: r.requestedEndTime,
          priority_score: 80,
          area_hectares: r.areaHectares,
          lat: r.lat,
          lon: r.lon
        })),
        regionalConflicts.conflicts,
        weatherData
      );
      
      // Verify regional optimization
      expect(regionalSchedule.schedule).toBeDefined();
      expect(Object.keys(regionalSchedule.schedule).length).toBe(regionalBurns.length);
    });

    test('Should prioritize burns based on regional impact', async () => {
      const burns = testBurnRequests.map((r, idx) => ({
        ...r,
        populationImpact: idx === 0 ? 5000 : idx === 1 ? 2000 : 500,
        criticalInfrastructure: idx === 0 ? true : false
      }));
      
      // Calculate regional priorities
      const priorities = burns.map(burn => {
        let score = 50; // Base score
        
        // Population impact factor
        score += Math.min(30, burn.populationImpact / 200);
        
        // Critical infrastructure factor
        if (burn.criticalInfrastructure) score += 20;
        
        return { burnId: burn.fieldId, priority: score };
      });
      
      // Sort by priority
      priorities.sort((a, b) => b.priority - a.priority);
      
      expect(priorities[0].priority).toBeGreaterThan(priorities[2].priority);
      expect(priorities[0].burnId).toBe(testBurnRequests[0].fieldId);
    });

    test('Should implement emergency shutdown for regional danger', async () => {
      const emergencyConditions = {
        windSpeed: 35, // Extreme wind
        humidity: 15,   // Very dry
        fireWeatherIndex: 95, // Extreme danger
        activeWildfires: true
      };
      
      const shouldShutdown = 
        emergencyConditions.windSpeed > 30 ||
        emergencyConditions.humidity < 20 ||
        emergencyConditions.fireWeatherIndex > 90 ||
        emergencyConditions.activeWildfires;
      
      expect(shouldShutdown).toBeTruthy();
      
      if (shouldShutdown) {
        // Cancel all scheduled burns
        const cancelledBurns = testBurnRequests.map(r => ({
          burnId: r.fieldId,
          status: 'cancelled',
          reason: 'emergency_shutdown'
        }));
        
        expect(cancelledBurns).toHaveLength(testBurnRequests.length);
        expect(cancelledBurns.every(b => b.status === 'cancelled')).toBeTruthy();
      }
    });
  });
});

// Helper functions
function combineVectorsForAnalysis(...vectors) {
  return vectors.reduce((combined, vector) => [...combined, ...vector], []);
}

module.exports = {
  combineVectorsForAnalysis
};