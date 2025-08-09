const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinator');
const WeatherAgent = require('../../agents/weather');
const SmokeOverlapPredictor = require('../../agents/predictor');
const ScheduleOptimizer = require('../../agents/optimizer');
require('dotenv').config();

describe('Boundary Conditions - Critical Edge Cases for Life-Safety System', () => {
  let coordinator;
  let weatherAgent;
  let predictor;
  let optimizer;
  
  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new CoordinatorAgent();
    weatherAgent = new WeatherAgent();
    predictor = new SmokeOverlapPredictor();
    optimizer = new ScheduleOptimizer();
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });
  
  beforeEach(async () => {
    // Clean up test data before each test
    try {
      await query('DELETE FROM burn_requests WHERE request_id > 99000');
      await query('DELETE FROM weather_conditions WHERE observation_id LIKE "test_%"');
      await query('DELETE FROM smoke_predictions WHERE burn_request_id > 99000');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('Numeric Boundary Conditions', () => {
    test('Should handle minimum valid area (1 hectare)', async () => {
      const minAreaRequest = {
        farmId: 1,
        fieldId: 101,
        requestedDate: '2025-09-15',
        areaHectares: 1.0, // Minimum valid area
        cropType: 'wheat_stubble',
        lat: 40.0,
        lon: -120.0
      };
      
      const result = await coordinator.coordinateBurnRequest(minAreaRequest);
      
      expect(result).toBeDefined();
      expect(result.areaHectares).toBe(1.0);
      expect(result.priorityScore).toBeGreaterThan(0);
    });

    test('Should handle maximum reasonable area (5000 hectares)', async () => {
      const maxAreaRequest = {
        farmId: 2,
        fieldId: 102,
        requestedDate: '2025-09-15',
        areaHectares: 5000.0, // Large agricultural field
        cropType: 'wheat_stubble',
        lat: 40.0,
        lon: -120.0
      };
      
      const result = await coordinator.coordinateBurnRequest(maxAreaRequest);
      
      expect(result).toBeDefined();
      expect(result.areaHectares).toBe(5000.0);
      expect(result.priorityScore).toBeDefined();
      
      // Large burns should have safety restrictions
      expect(result.safetyWarnings).toBeDefined();
      expect(result.safetyWarnings.length).toBeGreaterThan(0);
    });

    test('Should handle extreme coordinate precision', async () => {
      const preciseCoords = {
        farmId: 3,
        fieldId: 103,
        requestedDate: '2025-09-15',
        areaHectares: 100,
        cropType: 'wheat_stubble',
        lat: 40.123456789012345, // Maximum precision
        lon: -120.987654321098765
      };
      
      const result = await coordinator.coordinateBurnRequest(preciseCoords);
      
      expect(result).toBeDefined();
      expect(result.lat).toBeCloseTo(40.123456789012345, 10);
      expect(result.lon).toBeCloseTo(-120.987654321098765, 10);
    });

    test('Should handle boundary coordinate values', async () => {
      const boundaryTests = [
        { lat: 90.0, lon: -180.0, desc: 'North Pole, Date Line' },
        { lat: -90.0, lon: 180.0, desc: 'South Pole, Date Line' },
        { lat: 0.0, lon: 0.0, desc: 'Equator, Prime Meridian' },
        { lat: 49.0, lon: -125.0, desc: 'Northern US border' },
        { lat: 25.0, lon: -80.0, desc: 'Southern US border' },
      ];
      
      for (const test of boundaryTests) {
        const boundaryRequest = {
          farmId: 4,
          fieldId: 104,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: test.lat,
          lon: test.lon
        };
        
        try {
          const result = await coordinator.coordinateBurnRequest(boundaryRequest);
          expect(result).toBeDefined();
          console.log(`✓ Handled ${test.desc}: (${test.lat}, ${test.lon})`);
        } catch (error) {
          // Some extreme coordinates may be rejected for agricultural use
          expect(error.message).toMatch(/coordinate|location|agricultural/i);
        }
      }
    });

    test('Should handle floating point precision edge cases', async () => {
      const floatTests = [
        { value: 1.0000000000001, expected: 1.0 },
        { value: 99.99999999999999, expected: 100.0 },
        { value: 0.1 + 0.2, expected: 0.3 }, // Classic floating point issue
        { value: 1.7976931348623157e+308, expected: 'overflow' }, // Max double
        { value: 5e-324, expected: 'underflow' }, // Min positive double
      ];
      
      for (const test of floatTests) {
        const floatRequest = {
          farmId: 5,
          fieldId: 105,
          requestedDate: '2025-09-15',
          areaHectares: test.value,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        try {
          const result = await coordinator.coordinateBurnRequest(floatRequest);
          
          if (test.expected === 'overflow' || test.expected === 'underflow') {
            expect(true).toBe(false); // Should have thrown error
          } else {
            expect(result.areaHectares).toBeCloseTo(test.expected, 5);
          }
        } catch (error) {
          if (test.expected === 'overflow' || test.expected === 'underflow') {
            expect(error.message).toMatch(/range|overflow|underflow|invalid/i);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('Date and Time Boundary Conditions', () => {
    test('Should handle date boundaries (leap years, month transitions)', async () => {
      const dateTests = [
        { date: '2024-02-29', valid: true, desc: 'leap year' },
        { date: '2025-02-29', valid: false, desc: 'non-leap year' },
        { date: '2025-04-31', valid: false, desc: 'invalid April date' },
        { date: '2025-12-31', valid: true, desc: 'year end' },
        { date: '2026-01-01', valid: true, desc: 'year start' },
        { date: '2025-03-01', valid: true, desc: 'March 1st' },
        { date: '2025-02-28', valid: true, desc: 'Feb 28 non-leap' },
      ];
      
      for (const test of dateTests) {
        const dateRequest = {
          farmId: 6,
          fieldId: 106,
          requestedDate: test.date,
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        try {
          const result = await coordinator.coordinateBurnRequest(dateRequest);
          
          if (test.valid) {
            expect(result).toBeDefined();
            expect(result.requestedDate).toBe(test.date);
          } else {
            expect(true).toBe(false); // Should have thrown error
          }
        } catch (error) {
          if (!test.valid) {
            expect(error.message).toMatch(/date|invalid|format/i);
          } else {
            throw error;
          }
        }
      }
    });

    test('Should handle time zone boundary conditions', async () => {
      const timezoneTests = [
        { time: '00:00:00', desc: 'midnight' },
        { time: '23:59:59', desc: 'end of day' },
        { time: '12:00:00', desc: 'noon' },
        { time: '06:00:00', desc: 'dawn' },
        { time: '18:00:00', desc: 'dusk' },
      ];
      
      for (const test of timezoneTests) {
        const timeRequest = {
          farmId: 7,
          fieldId: 107,
          requestedDate: '2025-09-15',
          requestedStartTime: test.time,
          requestedEndTime: '12:00:00',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        try {
          const result = await coordinator.coordinateBurnRequest(timeRequest);
          expect(result).toBeDefined();
          console.log(`✓ Handled ${test.desc}: ${test.time}`);
        } catch (error) {
          // Some times may be rejected for safety reasons
          expect(error.message).toMatch(/time|safety|prohibited|restricted/i);
        }
      }
    });

    test('Should handle date sequence boundaries', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const nextYear = new Date(today);
      nextYear.setFullYear(today.getFullYear() + 1);
      
      const sequenceTests = [
        { 
          date: today.toISOString().split('T')[0], 
          valid: false, 
          desc: 'today (too soon)' 
        },
        { 
          date: tomorrow.toISOString().split('T')[0], 
          valid: true, 
          desc: 'tomorrow' 
        },
        { 
          date: nextWeek.toISOString().split('T')[0], 
          valid: true, 
          desc: 'next week' 
        },
        { 
          date: nextYear.toISOString().split('T')[0], 
          valid: false, 
          desc: 'next year (too far)' 
        },
      ];
      
      for (const test of sequenceTests) {
        const sequenceRequest = {
          farmId: 8,
          fieldId: 108,
          requestedDate: test.date,
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        try {
          const result = await coordinator.coordinateBurnRequest(sequenceRequest);
          
          if (test.valid) {
            expect(result).toBeDefined();
          } else {
            expect(true).toBe(false); // Should have thrown error
          }
        } catch (error) {
          if (!test.valid) {
            expect(error.message).toMatch(/date|range|advance|notice|future/i);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('Vector Dimension Boundary Conditions', () => {
    test('Should handle minimum vector dimensions (32-dim terrain)', async () => {
      const minTerrainVector = new Array(32).fill(0.001); // Minimum non-zero values
      const terrainData = {
        fieldId: 109,
        terrainFeatures: minTerrainVector,
        elevation: 0.1
      };
      
      const result = await coordinator.encodeTerrainVector(terrainData);
      
      expect(result).toHaveLength(32);
      expect(result.every(v => typeof v === 'number')).toBeTruthy();
      expect(result.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should handle maximum vector dimensions (128-dim weather)', async () => {
      const maxWeatherVector = new Array(128).fill(999.999); // Large values
      const weatherData = {
        temperature: 45.0, // Extreme heat
        humidity: 5.0, // Very dry
        windSpeed: 50.0, // High wind
        pressure: 950.0, // Low pressure
        stabilityClass: 'A' // Highly unstable
      };
      
      const result = await weatherAgent.createWeatherVector(weatherData);
      
      expect(result).toHaveLength(128);
      expect(result.every(v => typeof v === 'number')).toBeTruthy();
      expect(result.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should handle vector normalization edge cases', async () => {
      const normalizationTests = [
        { vector: new Array(64).fill(0), desc: 'zero vector' },
        { vector: new Array(64).fill(Infinity), desc: 'infinite vector' },
        { vector: new Array(64).fill(1e-15), desc: 'tiny vector' },
        { vector: new Array(64).fill(1e15), desc: 'huge vector' },
        { vector: Array.from({length: 64}, (_, i) => i % 2 === 0 ? 1 : -1), desc: 'alternating vector' },
      ];
      
      for (const test of normalizationTests) {
        try {
          const normalized = await predictor.normalizeVector(test.vector);
          
          if (test.desc === 'zero vector') {
            // Zero vector cannot be normalized
            expect(normalized.every(v => v === 0)).toBeTruthy();
          } else if (test.desc === 'infinite vector') {
            // Should handle or reject infinite values
            expect(normalized.every(v => isFinite(v))).toBeTruthy();
          } else {
            // Should be unit vector
            const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
            expect(magnitude).toBeCloseTo(1.0, 5);
          }
        } catch (error) {
          // Some edge cases may be rejected
          expect(error.message).toMatch(/vector|normalize|invalid|infinite/i);
        }
      }
    });

    test('Should handle vector similarity at boundaries', async () => {
      const similarityTests = [
        { 
          vec1: new Array(64).fill(1), 
          vec2: new Array(64).fill(1), 
          expectedSimilarity: 1.0, 
          desc: 'identical vectors' 
        },
        { 
          vec1: new Array(64).fill(1), 
          vec2: new Array(64).fill(-1), 
          expectedSimilarity: -1.0, 
          desc: 'opposite vectors' 
        },
        { 
          vec1: Array.from({length: 64}, (_, i) => i % 2), 
          vec2: Array.from({length: 64}, (_, i) => (i + 1) % 2), 
          expectedSimilarity: 0.0, 
          desc: 'orthogonal vectors' 
        },
        { 
          vec1: new Array(64).fill(1e-10), 
          vec2: new Array(64).fill(1e10), 
          expectedSimilarity: 1.0, 
          desc: 'same direction, different magnitude' 
        },
      ];
      
      for (const test of similarityTests) {
        try {
          const similarity = await predictor.calculateCosineSimilarity(test.vec1, test.vec2);
          expect(similarity).toBeCloseTo(test.expectedSimilarity, 5);
          console.log(`✓ ${test.desc}: similarity = ${similarity}`);
        } catch (error) {
          console.log(`✗ ${test.desc}: ${error.message}`);
          expect(error.message).toMatch(/vector|similarity|invalid/i);
        }
      }
    });
  });

  describe('Weather Condition Boundary Conditions', () => {
    test('Should handle extreme temperature conditions', async () => {
      const temperatureTests = [
        { temp: -40.0, valid: true, desc: 'extreme cold' },
        { temp: 0.0, valid: true, desc: 'freezing' },
        { temp: 50.0, valid: true, desc: 'extreme heat' },
        { temp: 60.0, valid: false, desc: 'impossible heat' },
        { temp: -50.0, valid: false, desc: 'impossible cold' },
      ];
      
      for (const test of temperatureTests) {
        const weatherCondition = {
          lat: 40.0,
          lon: -120.0,
          temperature: test.temp,
          humidity: 50.0,
          windSpeed: 10.0,
          pressure: 1013.25
        };
        
        try {
          const result = await weatherAgent.analyzeWeatherForBurn(
            weatherCondition.lat,
            weatherCondition.lon,
            new Date(),
            weatherCondition
          );
          
          if (test.valid) {
            expect(result).toBeDefined();
            expect(result.burnSafety).toBeDefined();
          } else {
            expect(true).toBe(false); // Should have thrown error
          }
        } catch (error) {
          if (!test.valid) {
            expect(error.message).toMatch(/temperature|range|invalid|extreme/i);
          } else {
            throw error;
          }
        }
      }
    });

    test('Should handle humidity boundary conditions', async () => {
      const humidityTests = [
        { humidity: 0.0, burnSafe: false, desc: 'bone dry' },
        { humidity: 5.0, burnSafe: false, desc: 'very dry' },
        { humidity: 30.0, burnSafe: true, desc: 'safe minimum' },
        { humidity: 100.0, burnSafe: false, desc: 'saturated' },
        { humidity: 105.0, burnSafe: false, desc: 'impossible humidity' },
      ];
      
      for (const test of humidityTests) {
        const weatherCondition = {
          lat: 40.0,
          lon: -120.0,
          temperature: 20.0,
          humidity: test.humidity,
          windSpeed: 10.0,
          pressure: 1013.25
        };
        
        try {
          const result = await weatherAgent.analyzeWeatherForBurn(
            weatherCondition.lat,
            weatherCondition.lon,
            new Date(),
            weatherCondition
          );
          
          expect(result).toBeDefined();
          expect(result.burnSafety.isSafe).toBe(test.burnSafe);
          
          if (test.humidity > 100) {
            expect(true).toBe(false); // Should have thrown error for impossible values
          }
        } catch (error) {
          if (test.humidity > 100) {
            expect(error.message).toMatch(/humidity|range|invalid/i);
          } else {
            throw error;
          }
        }
      }
    });

    test('Should handle wind speed boundary conditions', async () => {
      const windTests = [
        { windSpeed: 0.0, burnSafe: false, desc: 'no wind' },
        { windSpeed: 5.0, burnSafe: true, desc: 'light breeze' },
        { windSpeed: 25.0, burnSafe: false, desc: 'high wind' },
        { windSpeed: 50.0, burnSafe: false, desc: 'dangerous wind' },
        { windSpeed: 100.0, burnSafe: false, desc: 'hurricane force' },
        { windSpeed: -5.0, burnSafe: false, desc: 'negative wind (invalid)' },
      ];
      
      for (const test of windTests) {
        const weatherCondition = {
          lat: 40.0,
          lon: -120.0,
          temperature: 20.0,
          humidity: 50.0,
          windSpeed: test.windSpeed,
          pressure: 1013.25
        };
        
        try {
          const result = await weatherAgent.analyzeWeatherForBurn(
            weatherCondition.lat,
            weatherCondition.lon,
            new Date(),
            weatherCondition
          );
          
          if (test.windSpeed >= 0) {
            expect(result).toBeDefined();
            expect(result.burnSafety.isSafe).toBe(test.burnSafe);
          } else {
            expect(true).toBe(false); // Should have thrown error for negative wind
          }
        } catch (error) {
          if (test.windSpeed < 0) {
            expect(error.message).toMatch(/wind|speed|negative|invalid/i);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('Smoke Dispersion Boundary Conditions', () => {
    test('Should handle minimum fuel load calculations', async () => {
      const minFuelRequest = {
        farmId: 10,
        fieldId: 110,
        areaHectares: 1.0,
        fuelLoad: 0.1, // Minimal fuel
        cropType: 'grass_hay',
        lat: 40.0,
        lon: -120.0
      };
      
      const result = await predictor.predictSmokeOverlap([minFuelRequest]);
      
      expect(result).toBeDefined();
      expect(result.predictions).toBeDefined();
      expect(result.predictions.length).toBeGreaterThan(0);
      expect(result.predictions[0].pm25Concentration).toBeGreaterThan(0);
    });

    test('Should handle maximum fuel load calculations', async () => {
      const maxFuelRequest = {
        farmId: 11,
        fieldId: 111,
        areaHectares: 1000.0,
        fuelLoad: 50.0, // Very high fuel load
        cropType: 'corn_residue',
        lat: 40.0,
        lon: -120.0
      };
      
      const result = await predictor.predictSmokeOverlap([maxFuelRequest]);
      
      expect(result).toBeDefined();
      expect(result.predictions[0].pm25Concentration).toBeGreaterThan(100);
      expect(result.safetyWarnings).toBeDefined();
      expect(result.safetyWarnings.length).toBeGreaterThan(0);
    });

    test('Should handle atmospheric stability class boundaries', async () => {
      const stabilityTests = [
        { class: 'A', stable: false, desc: 'very unstable' },
        { class: 'B', stable: false, desc: 'unstable' },
        { class: 'C', stable: false, desc: 'slightly unstable' },
        { class: 'D', stable: true, desc: 'neutral' },
        { class: 'E', stable: true, desc: 'stable' },
        { class: 'F', stable: true, desc: 'very stable' },
        { class: 'G', stable: false, desc: 'invalid class' },
      ];
      
      for (const test of stabilityTests) {
        const weatherData = {
          temperature: 20.0,
          humidity: 50.0,
          windSpeed: 10.0,
          stabilityClass: test.class
        };
        
        try {
          const dispersion = await weatherAgent.calculateGaussianPlume(
            100, // area
            20,  // fuel load
            weatherData
          );
          
          if (test.stable !== null) {
            expect(dispersion).toBeDefined();
            expect(dispersion.maxConcentration).toBeGreaterThan(0);
            expect(dispersion.stabilityClass).toBe(test.class);
          } else {
            expect(true).toBe(false); // Should have thrown error
          }
        } catch (error) {
          if (test.class === 'G') {
            expect(error.message).toMatch(/stability|class|invalid/i);
          } else {
            throw error;
          }
        }
      }
    });

    test('Should handle PM2.5 concentration thresholds', async () => {
      const concentrationTests = [
        { pm25: 0, level: 'good', safe: true },
        { pm25: 12, level: 'good', safe: true },
        { pm25: 35, level: 'moderate', safe: true },
        { pm25: 55, level: 'unhealthy', safe: false },
        { pm25: 150, level: 'very_unhealthy', safe: false },
        { pm25: 250, level: 'hazardous', safe: false },
        { pm25: 500, level: 'hazardous', safe: false },
      ];
      
      for (const test of concentrationTests) {
        const classification = await predictor.classifyPM25Level(test.pm25);
        
        expect(classification.level).toBe(test.level);
        expect(classification.safe).toBe(test.safe);
        expect(classification.healthRisk).toBeDefined();
        
        console.log(`✓ PM2.5 ${test.pm25}: ${test.level} (${test.safe ? 'safe' : 'unsafe'})`);
      }
    });
  });

  describe('Optimization Algorithm Boundary Conditions', () => {
    test('Should handle single burn request optimization', async () => {
      const singleBurn = [{
        requestId: 99001,
        farmId: 12,
        fieldId: 112,
        areaHectares: 100,
        priorityScore: 75,
        lat: 40.0,
        lon: -120.0,
        requestedDate: '2025-09-15'
      }];
      
      const result = await optimizer.optimizeSchedule(singleBurn, []);
      
      expect(result).toBeDefined();
      expect(result.schedule).toBeDefined();
      expect(result.schedule[99001]).toBeDefined();
      expect(result.conflicts).toBe(0);
      expect(result.cost).toBeGreaterThanOrEqual(0);
    });

    test('Should handle maximum burn requests (stress test)', async () => {
      const maxBurns = Array.from({ length: 100 }, (_, i) => ({
        requestId: 99100 + i,
        farmId: 13 + i,
        fieldId: 113 + i,
        areaHectares: 50 + (i % 50),
        priorityScore: 50 + (i % 50),
        lat: 40.0 + (i % 10) * 0.01,
        lon: -120.0 + Math.floor(i / 10) * 0.01,
        requestedDate: '2025-09-15'
      }));
      
      const startTime = Date.now();
      const result = await optimizer.optimizeSchedule(maxBurns, []);
      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(Object.keys(result.schedule)).toHaveLength(100);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.cost).toBeGreaterThanOrEqual(0);
    });

    test('Should handle optimization with zero temperature (final state)', async () => {
      const burnRequests = [
        { requestId: 99001, priorityScore: 90, lat: 40.0, lon: -120.0 },
        { requestId: 99002, priorityScore: 80, lat: 40.01, lon: -120.01 }
      ];
      
      const conflicts = [{
        requestId1: 99001,
        requestId2: 99002,
        severity: 'high',
        cost: 100
      }];
      
      // Run optimization with minimal temperature (should converge quickly)
      const result = await optimizer.simulatedAnnealing(
        burnRequests,
        conflicts,
        { initialTemperature: 0.001, coolingRate: 0.1, maxIterations: 100 }
      );
      
      expect(result).toBeDefined();
      expect(result.finalCost).toBeDefined();
      expect(result.accepted).toBeDefined();
      expect(result.rejected).toBeDefined();
    });

    test('Should handle conflicting high-priority burns', async () => {
      const highPriorityBurns = [
        { 
          requestId: 99001, 
          priorityScore: 100, 
          areaHectares: 500, 
          lat: 40.0, 
          lon: -120.0,
          emergency: true
        },
        { 
          requestId: 99002, 
          priorityScore: 100, 
          areaHectares: 500, 
          lat: 40.001, 
          lon: -120.001, // Very close
          emergency: true
        }
      ];
      
      const conflicts = [{
        requestId1: 99001,
        requestId2: 99002,
        severity: 'critical',
        maxCombinedPM25: 200,
        cost: 1000
      }];
      
      const result = await optimizer.optimizeSchedule(highPriorityBurns, conflicts);
      
      expect(result).toBeDefined();
      
      // Should handle the conflict by scheduling burns at different times
      const schedule1 = result.schedule[99001];
      const schedule2 = result.schedule[99002];
      
      expect(schedule1).toBeDefined();
      expect(schedule2).toBeDefined();
      
      // Times should be different to avoid conflict
      expect(schedule1.startTime).not.toBe(schedule2.startTime);
    });
  });

  describe('Database Connection Boundary Conditions', () => {
    test('Should handle maximum connection pool utilization', async () => {
      const connectionPromises = [];
      
      // Try to exhaust connection pool
      for (let i = 0; i < 15; i++) {
        connectionPromises.push(
          query('SELECT SLEEP(0.1), ? as test_id', [i])
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(connectionPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      expect(successful).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should not hang indefinitely
      
      console.log(`Connection pool test: ${successful} successful, ${failed} failed`);
    });

    test('Should handle query timeout boundaries', async () => {
      try {
        // Long-running query that should timeout
        await query('SELECT SLEEP(10)'); // 10 second sleep
        expect(true).toBe(false); // Should have timed out
      } catch (error) {
        expect(error.code).toMatch(/timeout|interrupted|killed/i);
      }
    });

    test('Should handle transaction size limits', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Insert many records in single transaction
        for (let i = 0; i < 1000; i++) {
          await connection.query(`
            INSERT INTO burn_requests (farm_id, field_id, requested_date, area_hectares)
            VALUES (?, ?, ?, ?)
          `, [99000 + i, 99000 + i, '2025-09-15', 100]);
        }
        
        await connection.commit();
        
        // Verify all records committed
        const [count] = await query(
          'SELECT COUNT(*) as count FROM burn_requests WHERE farm_id >= 99000'
        );
        expect(parseInt(count[0].count)).toBe(1000);
        
      } catch (error) {
        await connection.rollback();
        // Large transactions might fail due to limits
        expect(error.message).toMatch(/transaction|size|limit|timeout/i);
      } finally {
        connection.release();
      }
    });
  });

  describe('Memory and Performance Boundary Conditions', () => {
    test('Should handle large vector operations in memory', async () => {
      const largeVectorCount = 1000;
      const vectors = [];
      
      // Generate many large vectors
      for (let i = 0; i < largeVectorCount; i++) {
        vectors.push(Array.from({ length: 128 }, () => Math.random()));
      }
      
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();
      
      // Perform vector similarity calculations
      const similarities = [];
      for (let i = 0; i < Math.min(100, largeVectorCount); i++) {
        for (let j = i + 1; j < Math.min(100, largeVectorCount); j++) {
          const similarity = await predictor.calculateCosineSimilarity(vectors[i], vectors[j]);
          similarities.push(similarity);
        }
      }
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;
      const duration = endTime - startTime;
      
      expect(similarities.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Should use less than 100MB
      
      console.log(`Memory test: ${similarities.length} calculations, ${duration}ms, ${Math.round(memoryUsed / 1024 / 1024)}MB`);
    });

    test('Should handle CPU-intensive calculations', async () => {
      const complexRequest = {
        farmId: 14,
        fieldId: 114,
        areaHectares: 1000,
        fuelLoad: 40,
        lat: 40.0,
        lon: -120.0,
        requestedDate: '2025-09-15'
      };
      
      const startTime = Date.now();
      
      // Perform multiple CPU-intensive operations
      const operations = [
        coordinator.coordinateBurnRequest(complexRequest),
        weatherAgent.analyzeWeatherForBurn(40.0, -120.0, new Date()),
        predictor.predictSmokeOverlap([complexRequest]),
      ];
      
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r !== null && r !== undefined)).toBeTruthy();
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      
      console.log(`CPU test completed in ${duration}ms`);
    });
  });
});

module.exports = {
  // Helper functions for boundary condition testing
  generateBoundaryValues: (type) => {
    const boundaries = {
      coordinates: [
        { lat: -90, lon: -180 },
        { lat: 90, lon: 180 },
        { lat: 0, lon: 0 },
        { lat: 49, lon: -125 }, // North US
        { lat: 25, lon: -80 }   // South US
      ],
      areas: [1, 5000, 10000, 0.1, -1],
      temperatures: [-40, -20, 0, 25, 50, 60],
      humidity: [0, 5, 30, 50, 90, 100, 105],
      windSpeeds: [0, 5, 15, 25, 50, 100],
      pm25Levels: [0, 12, 35, 55, 150, 250, 500]
    };
    
    return boundaries[type] || [];
  },
  
  testFloatingPointPrecision: (value1, value2, tolerance = 1e-10) => {
    return Math.abs(value1 - value2) < tolerance;
  },
  
  createStressTestData: (count) => {
    return Array.from({ length: count }, (_, i) => ({
      requestId: 99000 + i,
      farmId: i + 1,
      fieldId: i + 100,
      areaHectares: 50 + (i % 100),
      priorityScore: 50 + (i % 50),
      lat: 40.0 + (i % 10) * 0.01,
      lon: -120.0 + Math.floor(i / 10) * 0.01,
      requestedDate: '2025-09-15'
    }));
  },
  
  measurePerformance: async (operation) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result = await operation();
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      result,
      duration: endTime - startTime,
      memoryUsed: endMemory - startMemory
    };
  }
};