const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const CoordinatorAgent = require('../../agents/coordinator');
const WeatherAgent = require('../../agents/weather');
const SmokeOverlapPredictor = require('../../agents/predictor');
const ScheduleOptimizer = require('../../agents/optimizer');
const AlertsAgent = require('../../agents/alerts');
const { initializeDatabase, query, pool } = require('../../db/connection');
require('dotenv').config();

describe('Load Testing - Concurrent Burn Request Processing', () => {
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

  test('Should handle 50 concurrent burn requests efficiently', async () => {
    const burnRequests = Array.from({ length: 50 }, (_, i) => ({
      farmId: 1000 + i,
      fieldId: 2000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 100 + (i % 10),
      cropType: ['wheat_stubble', 'corn_residue', 'grass_hay'][i % 3],
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001)
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      burnRequests.map(request => coordinator.coordinateBurnRequest(request))
    );

    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    expect(results.every(result => result.priorityScore > 0)).toBeTruthy();
  });

  test('Should process concurrent weather analyses for multiple locations', async () => {
    const locations = Array.from({ length: 50 }, (_, i) => ({
      lat: 40.0 + (i * 0.1),
      lon: -120.0 + (i * 0.1)
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      locations.map(loc => 
        weatherAgent.analyzeWeatherForBurn(loc.lat, loc.lon, new Date())
      )
    );

    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    expect(results.every(result => result.burnSafety !== undefined)).toBeTruthy();
  });

  test('Should perform concurrent smoke overlap predictions', async () => {
    const burnRequests = Array.from({ length: 50 }, (_, i) => ({
      farmId: 3000 + i,
      fieldId: 4000 + i,
      areaHectares: 50 + (i % 20),
      fuelLoad: 10 + (i % 10),
      cropType: ['wheat_stubble', 'corn_residue'][i % 2],
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001)
    }));

    const startTime = Date.now();
    const results = await predictor.predictSmokeOverlap(burnRequests);

    const duration = Date.now() - startTime;

    expect(results.predictions.length).toBe(50);
    expect(duration).toBeLessThan(12000); // Should complete within 12 seconds
    expect(results.predictions.every(pred => pred.pm25Concentration > 0)).toBeTruthy();
  });

  test('Should optimize schedules for large number of burn requests', async () => {
    const burnRequests = Array.from({ length: 50 }, (_, i) => ({
      requestId: 5000 + i,
      farmId: 5000 + i,
      priorityScore: 50 + (i % 50),
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15'
    }));

    const startTime = Date.now();
    const result = await optimizer.optimizeSchedule(burnRequests, []);

    const duration = Date.now() - startTime;

    expect(Object.keys(result.schedule)).toHaveLength(50);
    expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
    expect(result.cost).toBeGreaterThanOrEqual(0);
  });

  test('Should handle mixed concurrent operations across agents', async () => {
    const requests = Array.from({ length: 50 }, (_, i) => ({
      farmId: 6000 + i,
      fieldId: 7000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 100 + (i % 10),
      cropType: ['wheat_stubble', 'corn_residue', 'grass_hay'][i % 3],
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001)
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      requests.map(async (request) => {
        const coordResult = await coordinator.coordinateBurnRequest(request);
        const weatherResult = await weatherAgent.analyzeWeatherForBurn(
          request.lat, request.lon, new Date()
        );
        const smokeResult = await predictor.predictSmokeOverlap([request]);
        
        return { coordResult, weatherResult, smokeResult };
      })
    );

    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(25000); // Should complete within 25 seconds
    expect(results.every(r => 
      r.coordResult.priorityScore > 0 &&
      r.weatherResult.burnSafety !== undefined &&
      r.smokeResult.predictions.length > 0
    )).toBeTruthy();
  });

  test('Should handle burst load of 100 burn requests within time limit', async () => {
    const burnRequests = Array.from({ length: 100 }, (_, i) => ({
      farmId: 8000 + i,
      fieldId: 9000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 75 + (i % 25),
      cropType: ['wheat_stubble', 'corn_residue', 'grass_hay', 'rice_stubble'][i % 4],
      lat: 40.0 + (i * 0.0005),
      lon: -120.0 + (i * 0.0005)
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      burnRequests.map(request => coordinator.coordinateBurnRequest(request))
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(100);
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    expect(results.every(result => result.priorityScore > 0)).toBeTruthy();
  });

  test('Should maintain performance under database connection pressure', async () => {
    const queries = Array.from({ length: 100 }, (_, i) => 
      query('SELECT * FROM farms WHERE farm_id = ? LIMIT 1', [1 + (i % 10)])
    );

    const startTime = Date.now();
    const results = await Promise.allSettled(queries);
    const duration = Date.now() - startTime;

    const successful = results.filter(r => r.status === 'fulfilled').length;
    expect(successful).toBeGreaterThan(95); // At least 95% success rate
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('Should handle concurrent vector similarity searches efficiently', async () => {
    const vectors = Array.from({ length: 50 }, () => 
      Array.from({ length: 64 }, () => Math.random())
    );

    const baseVector = Array.from({ length: 64 }, () => Math.random());

    const startTime = Date.now();
    const similarities = await Promise.all(
      vectors.map(vector => predictor.calculateCosineSimilarity(baseVector, vector))
    );
    const duration = Date.now() - startTime;

    expect(similarities.length).toBe(50);
    expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    expect(similarities.every(sim => typeof sim === 'number')).toBeTruthy();
  });

  test('Should process concurrent weather API calls with rate limiting', async () => {
    const locations = Array.from({ length: 20 }, (_, i) => ({
      lat: 40.0 + (i * 0.05), 
      lon: -120.0 + (i * 0.05)
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      locations.map(async (loc, index) => {
        // Stagger requests to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, index * 100));
        return weatherAgent.analyzeWeatherForBurn(loc.lat, loc.lon, new Date());
      })
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(20);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    expect(results.every(result => result.burnSafety !== undefined)).toBeTruthy();
  });

  test('Should handle concurrent Gaussian plume calculations', async () => {
    const calculations = Array.from({ length: 50 }, (_, i) => ({
      area: 100 + (i % 20),
      fuelLoad: 15 + (i % 10),
      weather: {
        temperature: 20 + (i % 15),
        humidity: 40 + (i % 30),
        windSpeed: 5 + (i % 10),
        stabilityClass: ['A', 'B', 'C', 'D', 'E', 'F'][i % 6]
      }
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      calculations.map(calc => 
        weatherAgent.calculateGaussianPlume(calc.area, calc.fuelLoad, calc.weather)
      )
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
    expect(results.every(result => result.maxConcentration > 0)).toBeTruthy();
  });

  test('Should optimize large schedules with multiple conflicts efficiently', async () => {
    const burnRequests = Array.from({ length: 75 }, (_, i) => ({
      requestId: 10000 + i,
      farmId: 10000 + i,
      priorityScore: 40 + (i % 60),
      lat: 40.0 + (i % 15) * 0.001,
      lon: -120.0 + Math.floor(i / 15) * 0.001,
      requestedDate: '2025-09-15'
    }));

    // Create some conflicts between nearby burns
    const conflicts = [];
    for (let i = 0; i < 30; i++) {
      conflicts.push({
        requestId1: 10000 + i,
        requestId2: 10000 + i + 1,
        severity: 'medium',
        cost: 50 + (i % 30)
      });
    }

    const startTime = Date.now();
    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);
    const duration = Date.now() - startTime;

    expect(Object.keys(result.schedule)).toHaveLength(75);
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    expect(result.cost).toBeGreaterThanOrEqual(0);
  });

  test('Should send concurrent alerts to multiple farmers efficiently', async () => {
    const alerts = Array.from({ length: 50 }, (_, i) => ({
      farmerId: 1000 + i,
      message: `Burn request ${i + 1} has been scheduled`,
      priority: ['low', 'medium', 'high'][i % 3],
      channel: ['email', 'sms'][i % 2]
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      alerts.map(alert => alertsAgent.sendAlert(alert))
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(12000); // Should complete within 12 seconds
    expect(results.every(result => result.sent === true)).toBeTruthy();
  });

  test('Should handle mixed priority concurrent operations', async () => {
    const highPriorityOps = Array.from({ length: 10 }, (_, i) => ({
      type: 'high_priority',
      farmId: 11000 + i,
      emergency: true,
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001)
    }));

    const lowPriorityOps = Array.from({ length: 40 }, (_, i) => ({
      type: 'low_priority',
      farmId: 12000 + i,
      emergency: false,
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001)
    }));

    const startTime = Date.now();
    const [highResults, lowResults] = await Promise.all([
      Promise.all(highPriorityOps.map(op => 
        coordinator.coordinateBurnRequest({
          farmId: op.farmId,
          fieldId: op.farmId + 1000,
          requestedDate: '2025-09-15',
          areaHectares: 200,
          cropType: 'wheat_stubble',
          priority: 'emergency',
          lat: op.lat,
          lon: op.lon
        })
      )),
      Promise.all(lowPriorityOps.map(op => 
        coordinator.coordinateBurnRequest({
          farmId: op.farmId,
          fieldId: op.farmId + 1000,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'grass_hay',
          priority: 'normal',
          lat: op.lat,
          lon: op.lon
        })
      ))
    ]);
    const duration = Date.now() - startTime;

    expect(highResults.length).toBe(10);
    expect(lowResults.length).toBe(40);
    expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
    expect(highResults.every(r => r.priorityScore > 80)).toBeTruthy();
  });

  test('Should maintain response times under sustained load', async () => {
    const batchSize = 25;
    const batches = 4;
    const responseTimes = [];

    for (let batch = 0; batch < batches; batch++) {
      const batchRequests = Array.from({ length: batchSize }, (_, i) => ({
        farmId: 13000 + (batch * batchSize) + i,
        fieldId: 14000 + (batch * batchSize) + i,
        requestedDate: '2025-09-15',
        areaHectares: 80 + (i % 20),
        cropType: ['wheat_stubble', 'corn_residue'][i % 2],
        lat: 40.0 + (i * 0.001),
        lon: -120.0 + (i * 0.001)
      }));

      const batchStart = Date.now();
      await Promise.all(
        batchRequests.map(request => coordinator.coordinateBurnRequest(request))
      );
      const batchDuration = Date.now() - batchStart;
      responseTimes.push(batchDuration);

      // Brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    expect(responseTimes.length).toBe(4);
    expect(responseTimes.every(time => time < 8000)).toBeTruthy(); // Each batch < 8s
    
    // Response times should not degrade significantly
    const firstBatch = responseTimes[0];
    const lastBatch = responseTimes[responseTimes.length - 1];
    expect(lastBatch).toBeLessThan(firstBatch * 1.5); // < 50% degradation
  });

  test('Should handle concurrent full workflow executions', async () => {
    const workflows = Array.from({ length: 10 }, (_, i) => ({
      farmId: 15000 + i,
      fieldId: 16000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 150 + (i % 30),
      cropType: ['wheat_stubble', 'corn_residue', 'grass_hay'][i % 3],
      lat: 40.0 + (i * 0.01),
      lon: -120.0 + (i * 0.01)
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      workflows.map(async (request) => {
        // Full 5-agent workflow
        const coordResult = await coordinator.coordinateBurnRequest(request);
        const weatherResult = await weatherAgent.analyzeWeatherForBurn(
          request.lat, request.lon, new Date()
        );
        const smokeResult = await predictor.predictSmokeOverlap([request]);
        const optimizeResult = await optimizer.optimizeSchedule([{
          requestId: request.farmId,
          ...request,
          priorityScore: coordResult.priorityScore
        }], []);
        const alertResult = await alertsAgent.sendAlert({
          farmerId: request.farmId,
          message: 'Burn scheduled',
          priority: 'medium'
        });

        return {
          coordResult,
          weatherResult,
          smokeResult,
          optimizeResult,
          alertResult
        };
      })
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(10);
    expect(duration).toBeLessThan(45000); // Should complete within 45 seconds
    expect(results.every(r => 
      r.coordResult.priorityScore > 0 &&
      r.weatherResult.burnSafety !== undefined &&
      r.smokeResult.predictions.length > 0 &&
      r.optimizeResult.schedule !== undefined &&
      r.alertResult.sent === true
    )).toBeTruthy();
  });

  test('Should handle database connection pool exhaustion gracefully', async () => {
    // Create more concurrent queries than connection pool size
    const queries = Array.from({ length: 20 }, (_, i) => 
      query('SELECT SLEEP(0.5), ? as query_id', [i])
    );

    const startTime = Date.now();
    const results = await Promise.allSettled(queries);
    const duration = Date.now() - startTime;

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    expect(successful + failed).toBe(20);
    expect(duration).toBeLessThan(15000); // Should not hang indefinitely
    expect(successful).toBeGreaterThan(15); // Most should succeed
  });

  test('Should maintain memory efficiency under load', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    const operations = Array.from({ length: 100 }, (_, i) => ({
      farmId: 17000 + i,
      fieldId: 18000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 100,
      cropType: 'wheat_stubble',
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001)
    }));

    await Promise.all(
      operations.map(op => coordinator.coordinateBurnRequest(op))
    );

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB increase
  });

  test('Should handle concurrent vector operations with TiDB efficiently', async () => {
    const vectorQueries = Array.from({ length: 50 }, (_, i) => {
      const vector = Array.from({ length: 64 }, () => Math.random());
      const vectorString = `[${vector.join(',')}]`;
      
      return query(`
        SELECT VEC_COSINE_DISTANCE(?, '[0.5,0.5,${new Array(62).fill('0.5').join(',')}]') as distance
      `, [vectorString]);
    });

    const startTime = Date.now();
    const results = await Promise.all(vectorQueries);
    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(results.every(result => 
      result[0] && typeof result[0].distance === 'number'
    )).toBeTruthy();
  });

  test('Should handle concurrent spatial queries efficiently', async () => {
    const spatialQueries = Array.from({ length: 50 }, (_, i) => {
      const lat = 40.0 + (i * 0.01);
      const lon = -120.0 + (i * 0.01);
      
      return query(`
        SELECT ST_Distance_Sphere(
          POINT(?, ?),
          POINT(40.0, -120.0)
        ) as distance_meters
      `, [lon, lat]);
    });

    const startTime = Date.now();
    const results = await Promise.all(spatialQueries);
    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    expect(results.every(result => 
      result[0] && typeof result[0].distance_meters === 'number'
    )).toBeTruthy();
  });

  test('Should process concurrent PM2.5 calculations efficiently', async () => {
    const pm25Calculations = Array.from({ length: 50 }, (_, i) => ({
      area: 100 + (i % 20),
      fuelLoad: 10 + (i % 15),
      distance: 1000 + (i * 100),
      weather: {
        windSpeed: 5 + (i % 10),
        stabilityClass: ['A', 'B', 'C', 'D', 'E', 'F'][i % 6]
      }
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      pm25Calculations.map(calc => 
        weatherAgent.calculatePM25Concentration(
          calc.area,
          calc.fuelLoad,
          calc.distance,
          calc.weather
        )
      )
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(50);
    expect(duration).toBeLessThan(6000); // Should complete within 6 seconds
    expect(results.every(result => typeof result === 'number' && result >= 0)).toBeTruthy();
  });

  test('Should handle concurrent emergency burn processing', async () => {
    const emergencyBurns = Array.from({ length: 20 }, (_, i) => ({
      farmId: 19000 + i,
      fieldId: 20000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 300 + (i % 50),
      cropType: 'wheat_stubble',
      priority: 'emergency',
      lat: 40.0 + (i * 0.002),
      lon: -120.0 + (i * 0.002),
      emergencyReason: 'fire_risk'
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      emergencyBurns.map(burn => coordinator.coordinateBurnRequest(burn))
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(20);
    expect(duration).toBeLessThan(10000); // Emergency burns should be fast
    expect(results.every(result => result.priorityScore > 80)).toBeTruthy();
  });

  test('Should maintain accuracy under high throughput', async () => {
    const testRequests = Array.from({ length: 100 }, (_, i) => ({
      farmId: 21000 + i,
      fieldId: 22000 + i,
      requestedDate: '2025-09-15',
      areaHectares: 100,
      cropType: 'wheat_stubble',
      lat: 40.0,
      lon: -120.0
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      testRequests.map(request => coordinator.coordinateBurnRequest(request))
    );
    const duration = Date.now() - startTime;

    expect(results.length).toBe(100);
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    
    // All results should be consistent for identical inputs
    const firstResult = results[0];
    expect(results.every(result => 
      Math.abs(result.priorityScore - firstResult.priorityScore) < 1
    )).toBeTruthy();
  });
});