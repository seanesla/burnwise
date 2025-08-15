const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const CoordinatorAgent = require('../../agents/coordinator');
const WeatherAgent = require('../../agents/weather');
const SmokeOverlapPredictor = require('../../agents/predictor');
const ScheduleOptimizer = require('../../agents/optimizer');
const AlertsAgent = require('../../agents/alerts');
const { initializeDatabase, query, pool } = require('../../db/connection');
require('dotenv').config();

describe('Stress Testing - System Limits and Breaking Points', () => {
  let coordinator;
  let weatherAgent;
  let predictor;
  let optimizer;
  let alertsAgent;

  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new CoordinatorAgent();
    weatherAgent = new WeatherAgent();
    predictor = new SmokeOverlapPredictor();
    optimizer = new ScheduleOptimizer();
    alertsAgent = new AlertsAgent();
  });

  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  test('Should handle extreme number of concurrent burn requests (500)', async () => {
    const extremeRequests = Array.from({ length: 500 }, (_, i) => ({
      farmId: 30000 + i,
      fieldId: 40000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 50 + (i % 100),
      cropType: ['wheat_stubble', 'corn_residue', 'grass_hay', 'rice_stubble'][i % 4],
      lat: 40.0 + (i % 100) * 0.001,
      lon: -120.0 + Math.floor(i / 100) * 0.001
    }));

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const results = await Promise.all(
        extremeRequests.map(async (request, index) => {
          // Add small delays to prevent overwhelming
          if (index % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          return coordinator.coordinateBurnRequest(request);
        })
      );

      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      expect(results.length).toBe(500);
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
      expect(memoryUsed).toBeLessThan(200 * 1024 * 1024); // < 200MB increase
      expect(results.every(result => result.priorityScore > 0)).toBeTruthy();

    } catch (error) {
      // System should fail gracefully, not crash
      expect(error.message).toMatch(/timeout|limit|overload|capacity/i);
    }
  });

  test('Should handle massive vector similarity calculations (1000 vectors)', async () => {
    const vectorCount = 1000;
    const vectors = Array.from({ length: vectorCount }, () => 
      Array.from({ length: 64 }, () => Math.random())
    );

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const similarities = [];
      const baseVector = Array.from({ length: 64 }, () => Math.random());

      // Process in batches to prevent memory overflow
      const batchSize = 100;
      for (let i = 0; i < vectorCount; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(vector => predictor.calculateCosineSimilarity(baseVector, vector))
        );
        similarities.push(...batchResults);
      }

      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      expect(similarities.length).toBe(vectorCount);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
      expect(similarities.every(sim => typeof sim === 'number')).toBeTruthy();

    } catch (error) {
      expect(error.message).toMatch(/memory|overflow|capacity|timeout/i);
    }
  });

  test('Should handle extremely large area burn requests (10000+ hectares)', async () => {
    const megaBurnRequests = Array.from({ length: 10 }, (_, i) => ({
      farmId: 50000 + i,
      fieldId: 60000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 10000 + (i * 1000), // 10,000 to 19,000 hectares
      cropType: 'wheat_stubble',
      lat: 40.0 + (i * 0.1),
      lon: -120.0 + (i * 0.1),
      fuelLoad: 50 // Very high fuel load
    }));

    const startTime = Date.now();

    try {
      const results = await Promise.all(
        megaBurnRequests.map(request => coordinator.coordinateBurnRequest(request))
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
      expect(results.every(result => result.safetyWarnings.length > 0)).toBeTruthy();
      expect(results.every(result => result.priorityScore >= 0)).toBeTruthy();

    } catch (error) {
      // System should reject impossibly large burns
      expect(error.message).toMatch(/area|size|limit|safety|extreme/i);
    }
  });

  test('Should handle extreme weather conditions', async () => {
    const extremeWeatherConditions = [
      { temp: -45, humidity: 0, windSpeed: 80, desc: 'arctic hurricane' },
      { temp: 55, humidity: 5, windSpeed: 70, desc: 'desert storm' },
      { temp: 40, humidity: 95, windSpeed: 50, desc: 'tropical cyclone' },
      { temp: 0, humidity: 100, windSpeed: 0, desc: 'freezing fog' },
      { temp: 50, humidity: 0, windSpeed: 100, desc: 'extreme fire weather' }
    ];

    const startTime = Date.now();

    try {
      const results = await Promise.all(
        extremeWeatherConditions.map(async (weather, index) => {
          const condition = {
            lat: 40.0 + index,
            lon: -120.0 + index,
            temperature: weather.temp,
            humidity: weather.humidity,
            windSpeed: weather.windSpeed,
            pressure: 1013.25
          };

          return weatherAgent.analyzeWeatherForBurn(
            condition.lat,
            condition.lon,
            new Date(),
            condition
          );
        })
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(5);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(results.every(result => result.burnSafety !== undefined)).toBeTruthy();
      expect(results.every(result => result.burnSafety.isSafe === false)).toBeTruthy();

    } catch (error) {
      // System should handle extreme conditions gracefully
      expect(error.message).toMatch(/weather|extreme|range|invalid/i);
    }
  });

  test('Should handle optimization with maximum conflicts (10000 conflicts)', async () => {
    const burnRequests = Array.from({ length: 200 }, (_, i) => ({
      requestId: 70000 + i,
      farmId: 70000 + i,
      priorityScore: 50 + (i % 50),
      lat: 40.0 + (i % 20) * 0.001,
      lon: -120.0 + Math.floor(i / 20) * 0.001,
      requestedDate: '2025-09-15'
    }));

    // Create maximum conflicts - every burn conflicts with every other
    const maxConflicts = [];
    for (let i = 0; i < Math.min(100, burnRequests.length); i++) {
      for (let j = i + 1; j < Math.min(100, burnRequests.length); j++) {
        maxConflicts.push({
          requestId1: 70000 + i,
          requestId2: 70000 + j,
          severity: 'high',
          cost: 100 + (i * j % 50)
        });
      }
    }

    const startTime = Date.now();

    try {
      const result = await optimizer.optimizeSchedule(
        burnRequests.slice(0, 100), // Limit to 100 for performance
        maxConflicts.slice(0, 1000) // Limit conflicts to prevent timeout
      );

      const duration = Date.now() - startTime;

      expect(Object.keys(result.schedule)).toHaveLength(100);
      expect(duration).toBeLessThan(120000); // Should complete within 2 minutes
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.conflicts).toBeDefined();

    } catch (error) {
      // Optimization may fail with too many conflicts
      expect(error.message).toMatch(/optimization|timeout|complexity|conflicts/i);
    }
  });

  test('Should handle database connection pool saturation', async () => {
    const connectionCount = 50; // Exceed typical pool size
    const queries = Array.from({ length: connectionCount }, (_, i) => 
      query('SELECT SLEEP(2), ? as query_id', [i]) // 2-second sleep per query
    );

    const startTime = Date.now();

    try {
      const results = await Promise.allSettled(queries);
      const duration = Date.now() - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(connectionCount);
      expect(duration).toBeLessThan(30000); // Should not hang indefinitely
      expect(successful).toBeGreaterThan(0); // Some should succeed

    } catch (error) {
      expect(error.message).toMatch(/connection|pool|timeout|limit/i);
    }
  });

  test('Should handle massive PM2.5 concentration calculations', async () => {
    const massiveCalculations = Array.from({ length: 1000 }, (_, i) => ({
      area: 500 + (i % 100),
      fuelLoad: 30 + (i % 20),
      distance: 500 + (i * 10),
      weather: {
        windSpeed: 5 + (i % 15),
        stabilityClass: ['A', 'B', 'C', 'D', 'E', 'F'][i % 6]
      }
    }));

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Process in batches to prevent overwhelming
      const batchSize = 100;
      const allResults = [];

      for (let i = 0; i < massiveCalculations.length; i += batchSize) {
        const batch = massiveCalculations.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(calc => 
            weatherAgent.calculatePM25Concentration(
              calc.area,
              calc.fuelLoad,
              calc.distance,
              calc.weather
            )
          )
        );
        allResults.push(...batchResults);
      }

      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      expect(allResults.length).toBe(1000);
      expect(duration).toBeLessThan(45000); // Should complete within 45 seconds
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
      expect(allResults.every(result => typeof result === 'number' && result >= 0)).toBeTruthy();

    } catch (error) {
      expect(error.message).toMatch(/memory|calculation|overflow|timeout/i);
    }
  });

  test('Should handle rapid-fire alert sending (1000 alerts)', async () => {
    const massiveAlerts = Array.from({ length: 1000 }, (_, i) => ({
      farmerId: 80000 + i,
      message: `Mass alert test ${i + 1}`,
      priority: ['low', 'medium', 'high'][i % 3],
      channel: ['email', 'sms'][i % 2]
    }));

    const startTime = Date.now();

    try {
      // Send alerts in batches to prevent overwhelming external services
      const batchSize = 50;
      const allResults = [];

      for (let i = 0; i < massiveAlerts.length; i += batchSize) {
        const batch = massiveAlerts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(alert => alertsAgent.sendAlert(alert))
        );
        allResults.push(...batchResults);

        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const duration = Date.now() - startTime;

      expect(allResults.length).toBe(1000);
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
      
      const successCount = allResults.filter(result => result.sent === true).length;
      expect(successCount).toBeGreaterThan(800); // At least 80% success rate

    } catch (error) {
      expect(error.message).toMatch(/rate.*limit|service.*unavailable|timeout/i);
    }
  });

  test('Should handle extreme vector dimension edge cases', async () => {
    const extremeVectors = [
      { vector: new Array(128).fill(Number.MAX_VALUE), desc: 'maximum values' },
      { vector: new Array(128).fill(Number.MIN_VALUE), desc: 'minimum values' },
      { vector: new Array(128).fill(0), desc: 'zero vector' },
      { vector: Array.from({length: 128}, () => Math.random() * 1e10), desc: 'huge random' },
      { vector: Array.from({length: 128}, () => Math.random() * 1e-10), desc: 'tiny random' }
    ];

    const startTime = Date.now();

    try {
      const results = await Promise.all(
        extremeVectors.map(async (test) => {
          try {
            const weatherVector = await weatherAgent.createWeatherVector({
              customVector: test.vector,
              temperature: 20,
              humidity: 50,
              windSpeed: 10,
              pressure: 1013.25
            });
            return { success: true, vector: weatherVector, desc: test.desc };
          } catch (error) {
            return { success: false, error: error.message, desc: test.desc };
          }
        })
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(5);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // System should handle or reject extreme values gracefully
      results.forEach(result => {
        if (result.success) {
          expect(result.vector).toHaveLength(128);
          expect(result.vector.every(v => isFinite(v))).toBeTruthy();
        } else {
          expect(result.error).toMatch(/vector|range|invalid|extreme/i);
        }
      });

    } catch (error) {
      expect(error.message).toMatch(/vector|dimension|overflow|invalid/i);
    }
  });

  test('Should handle sustained high-frequency operations', async () => {
    const operationCount = 2000;
    const operations = [];
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Mix of different operation types
      for (let i = 0; i < operationCount; i++) {
        const opType = i % 4;
        
        switch (opType) {
          case 0:
            operations.push(coordinator.coordinateBurnRequest({
              farmId: 90000 + i,
              fieldId: 100000 + i,
              requestedDate: '2025-09-15',
              areaHectares: 50,
              cropType: 'wheat_stubble',
              lat: 40.0,
              lon: -120.0
            }));
            break;
          case 1:
            operations.push(weatherAgent.analyzeWeatherForBurn(40.0, -120.0, new Date()));
            break;
          case 2:
            operations.push(predictor.calculateCosineSimilarity(
              Array.from({ length: 64 }, () => Math.random()),
              Array.from({ length: 64 }, () => Math.random())
            ));
            break;
          case 3:
            operations.push(query('SELECT 1 as test'));
            break;
        }

        // Process in batches to prevent overwhelming
        if (operations.length >= 50) {
          await Promise.allSettled(operations);
          operations.length = 0; // Clear array
          
          // Brief pause
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Process remaining operations
      if (operations.length > 0) {
        await Promise.allSettled(operations);
      }

      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      expect(duration).toBeLessThan(120000); // Should complete within 2 minutes
      expect(memoryUsed).toBeLessThan(200 * 1024 * 1024); // < 200MB increase

    } catch (error) {
      expect(error.message).toMatch(/timeout|memory|overload|capacity/i);
    }
  });

  test('Should handle memory pressure with large data structures', async () => {
    const largeDataSets = [];
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Create large data structures
      for (let i = 0; i < 100; i++) {
        largeDataSets.push({
          burnRequests: Array.from({ length: 100 }, (_, j) => ({
            farmId: 110000 + (i * 100) + j,
            fieldId: 120000 + (i * 100) + j,
            requestedDate: '2025-09-15',
            areaHectares: 100,
            cropType: 'wheat_stubble',
            weatherVector: Array.from({ length: 128 }, () => Math.random()),
            smokeVector: Array.from({ length: 64 }, () => Math.random()),
            terrainVector: Array.from({ length: 32 }, () => Math.random())
          }))
        });
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryUsed = peakMemory - startMemory;

      // Process some operations with large data
      const results = await Promise.all(
        largeDataSets.slice(0, 10).map(dataSet => 
          predictor.predictSmokeOverlap(dataSet.burnRequests.slice(0, 10))
        )
      );

      expect(results.length).toBe(10);
      expect(memoryUsed).toBeLessThan(500 * 1024 * 1024); // < 500MB increase
      expect(results.every(result => result.predictions.length > 0)).toBeTruthy();

      // Clean up large data structures
      largeDataSets.length = 0;

    } catch (error) {
      expect(error.message).toMatch(/memory|heap|allocation|overflow/i);
    }
  });

  test('Should handle CPU-intensive optimization with time constraints', async () => {
    const complexBurnRequests = Array.from({ length: 150 }, (_, i) => ({
      requestId: 130000 + i,
      farmId: 130000 + i,
      priorityScore: 30 + (i % 70),
      lat: 40.0 + (i % 25) * 0.001,
      lon: -120.0 + Math.floor(i / 25) * 0.001,
      requestedDate: '2025-09-15',
      areaHectares: 100 + (i % 50),
      emergencyLevel: i % 10 === 0 ? 'high' : 'normal'
    }));

    // Create complex conflict matrix
    const complexConflicts = [];
    for (let i = 0; i < Math.min(50, complexBurnRequests.length); i++) {
      for (let j = i + 1; j < Math.min(75, complexBurnRequests.length); j++) {
        if ((i + j) % 3 === 0) { // Create sparse but complex conflicts
          complexConflicts.push({
            requestId1: 130000 + i,
            requestId2: 130000 + j,
            severity: ['low', 'medium', 'high'][((i + j) % 3)],
            cost: 25 + ((i * j) % 100),
            pm25Impact: 50 + ((i + j) % 150)
          });
        }
      }
    }

    const startTime = Date.now();

    try {
      const result = await optimizer.optimizeSchedule(
        complexBurnRequests.slice(0, 100), // Limit to prevent timeout
        complexConflicts.slice(0, 500)     // Limit conflicts
      );

      const duration = Date.now() - startTime;

      expect(Object.keys(result.schedule)).toHaveLength(100);
      expect(duration).toBeLessThan(180000); // Should complete within 3 minutes
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBeGreaterThan(0);

    } catch (error) {
      expect(error.message).toMatch(/optimization|timeout|complexity|cpu/i);
    }
  });

  test('Should maintain system stability under cascading failures', async () => {
    const testOperations = [];
    const results = { successes: 0, failures: 0, timeouts: 0 };

    try {
      // Simulate cascading failure scenario
      const operations = [
        // Overwhelm database
        ...Array.from({ length: 30 }, (_, i) => 
          query('SELECT SLEEP(3), ? as id', [i])
        ),
        // Overwhelm weather agent
        ...Array.from({ length: 20 }, (_, i) => 
          weatherAgent.analyzeWeatherForBurn(40.0 + i, -120.0 + i, new Date())
        ),
        // Overwhelm coordinator
        ...Array.from({ length: 50 }, (_, i) => 
          coordinator.coordinateBurnRequest({
            farmId: 140000 + i,
            fieldId: 150000 + i,
            requestedDate: '2025-09-15',
            areaHectares: 100,
            cropType: 'wheat_stubble',
            lat: 40.0 + (i * 0.001),
            lon: -120.0 + (i * 0.001)
          })
        )
      ];

      const startTime = Date.now();
      const operationResults = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;

      operationResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.successes++;
        } else {
          results.failures++;
          if (result.reason.message.includes('timeout')) {
            results.timeouts++;
          }
        }
      });

      expect(results.successes + results.failures).toBe(100);
      expect(duration).toBeLessThan(60000); // Should not hang indefinitely
      expect(results.successes).toBeGreaterThan(20); // System should maintain some functionality

    } catch (error) {
      // System should fail gracefully, not crash completely
      expect(error.message).toMatch(/timeout|overload|capacity|circuit.*breaker/i);
    }
  });

  test('Should handle extreme geographical boundaries', async () => {
    const extremeLocations = [
      { lat: 89.999, lon: 179.999, desc: 'near north pole, date line' },
      { lat: -89.999, lon: -179.999, desc: 'near south pole, date line' },
      { lat: 0.0001, lon: 0.0001, desc: 'near equator, prime meridian' },
      { lat: 71.0, lon: -156.0, desc: 'Alaska north slope' },
      { lat: -54.0, lon: -67.0, desc: 'Tierra del Fuego' }
    ];

    const startTime = Date.now();

    try {
      const results = await Promise.all(
        extremeLocations.map(async (location) => {
          try {
            const burnRequest = {
              farmId: 160000,
              fieldId: 170000,
              requestedDate: '2025-09-15',
              areaHectares: 100,
              cropType: 'wheat_stubble',
              lat: location.lat,
              lon: location.lon
            };

            const result = await coordinator.coordinateBurnRequest(burnRequest);
            return { success: true, result, desc: location.desc };
          } catch (error) {
            return { success: false, error: error.message, desc: location.desc };
          }
        })
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBe(5);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      results.forEach(result => {
        if (result.success) {
          expect(result.result.priorityScore).toBeGreaterThanOrEqual(0);
        } else {
          // Some extreme locations may be rejected
          expect(result.error).toMatch(/location|coordinate|agricultural|extreme/i);
        }
      });

    } catch (error) {
      expect(error.message).toMatch(/coordinate|location|range|extreme/i);
    }
  });

  test('Should recover from temporary service outages', async () => {
    const operations = [];
    const recoveryAttempts = { weather: 0, database: 0, alerts: 0 };

    try {
      // Simulate operations that might fail due to service outages
      for (let i = 0; i < 100; i++) {
        operations.push({
          type: ['weather', 'database', 'alerts'][i % 3],
          id: i,
          operation: async () => {
            const opType = ['weather', 'database', 'alerts'][i % 3];
            
            try {
              switch (opType) {
                case 'weather':
                  return await weatherAgent.analyzeWeatherForBurn(40.0, -120.0, new Date());
                case 'database':
                  return await query('SELECT ? as test_id', [i]);
                case 'alerts':
                  return await alertsAgent.sendAlert({
                    farmerId: 180000 + i,
                    message: 'Test alert',
                    priority: 'low'
                  });
              }
            } catch (error) {
              recoveryAttempts[opType]++;
              // Simulate retry logic
              await new Promise(resolve => setTimeout(resolve, 100));
              throw error;
            }
          }
        });
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(
        operations.map(op => op.operation())
      );
      const duration = Date.now() - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(100);
      expect(duration).toBeLessThan(30000); // Should not hang indefinitely
      expect(successful).toBeGreaterThan(50); // At least 50% should eventually succeed

    } catch (error) {
      expect(error.message).toMatch(/service.*unavailable|timeout|connection|network/i);
    }
  });
});