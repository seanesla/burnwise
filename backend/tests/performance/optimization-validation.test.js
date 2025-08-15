const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const ScheduleOptimizer = require('../../agents/optimizer');
const CoordinatorAgent = require('../../agents/coordinator');
const WeatherAgent = require('../../agents/weather');
const SmokeOverlapPredictor = require('../../agents/predictor');
const { initializeDatabase, query, pool } = require('../../db/connection');
require('dotenv').config();

describe('Optimization Validation - Algorithm Correctness and Performance', () => {
  let optimizer;
  let coordinator;
  let weatherAgent;
  let predictor;

  beforeAll(async () => {
    await initializeDatabase();
    optimizer = new ScheduleOptimizer();
    coordinator = new CoordinatorAgent();
    weatherAgent = new WeatherAgent();
    predictor = new SmokeOverlapPredictor();
  });

  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  test('Should implement correct simulated annealing temperature decay (0.95)', async () => {
    const burnRequests = Array.from({ length: 20 }, (_, i) => ({
      requestId: 200000 + i,
      farmId: 200000 + i,
      priorityScore: 50 + (i % 30),
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15'
    }));

    const conflicts = [
      { requestId1: 200000, requestId2: 200001, severity: 'medium', cost: 50 },
      { requestId1: 200002, requestId2: 200003, severity: 'high', cost: 100 }
    ];

    // Run optimization and capture temperature progression
    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);

    expect(result.schedule).toBeDefined();
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.iterations).toBeLessThanOrEqual(1000); // Max iterations constraint
    expect(result.finalTemperature).toBeLessThan(result.initialTemperature);
    
    // Validate temperature decay follows 0.95 ratio
    const expectedFinalTemp = result.initialTemperature * Math.pow(0.95, result.iterations);
    expect(Math.abs(result.finalTemperature - expectedFinalTemp)).toBeLessThan(0.01);
  });

  test('Should respect maximum iteration limit of 1000', async () => {
    const complexRequests = Array.from({ length: 50 }, (_, i) => ({
      requestId: 210000 + i,
      farmId: 210000 + i,
      priorityScore: 40 + (i % 60),
      lat: 40.0 + (i % 10) * 0.001,
      lon: -120.0 + Math.floor(i / 10) * 0.001,
      requestedDate: '2025-09-15'
    }));

    // Create many conflicts to force maximum iterations
    const manyConflicts = [];
    for (let i = 0; i < 30; i++) {
      for (let j = i + 1; j < 35; j++) {
        manyConflicts.push({
          requestId1: 210000 + i,
          requestId2: 210000 + j,
          severity: 'high',
          cost: 75 + (i * j % 50)
        });
      }
    }

    const result = await optimizer.optimizeSchedule(complexRequests, manyConflicts);

    expect(result.iterations).toBeLessThanOrEqual(1000);
    expect(result.schedule).toBeDefined();
    expect(Object.keys(result.schedule)).toHaveLength(50);
  });

  test('Should minimize cost function correctly', async () => {
    const burnRequests = [
      { requestId: 220000, farmId: 220000, priorityScore: 90, lat: 40.0, lon: -120.0, requestedDate: '2025-09-15' },
      { requestId: 220001, farmId: 220001, priorityScore: 30, lat: 40.001, lon: -120.001, requestedDate: '2025-09-15' },
      { requestId: 220002, farmId: 220002, priorityScore: 70, lat: 40.002, lon: -120.002, requestedDate: '2025-09-15' }
    ];

    const conflicts = [
      { requestId1: 220000, requestId2: 220001, severity: 'high', cost: 200 }
    ];

    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);

    expect(result.cost).toBeGreaterThanOrEqual(0);
    expect(result.schedule).toBeDefined();

    // High priority burn (220000) should be scheduled despite conflict cost
    const highPriorityScheduled = Object.values(result.schedule).some(slot => 
      slot.burnRequests && slot.burnRequests.includes(220000)
    );
    expect(highPriorityScheduled).toBeTruthy();
  });

  test('Should handle cost function with safety constraints', async () => {
    const burnRequests = Array.from({ length: 15 }, (_, i) => ({
      requestId: 230000 + i,
      farmId: 230000 + i,
      priorityScore: 60,
      lat: 40.0,
      lon: -120.0,
      requestedDate: '2025-09-15',
      areaHectares: 200 + (i * 50), // Varying burn sizes
      pm25Risk: i > 10 ? 'high' : 'low' // Some high-risk burns
    }));

    const result = await optimizer.optimizeSchedule(burnRequests, []);

    expect(result.safetyViolations).toBeDefined();
    expect(result.cost).toBeGreaterThanOrEqual(0);
    
    // Safety violations should increase cost
    if (result.safetyViolations > 0) {
      expect(result.cost).toBeGreaterThan(1000); // Safety penalty threshold
    }

    // High-risk burns should be scheduled with safety buffers
    const schedule = result.schedule;
    const highRiskBurns = burnRequests.filter(req => req.pm25Risk === 'high');
    highRiskBurns.forEach(burn => {
      const scheduledSlot = Object.values(schedule).find(slot => 
        slot.burnRequests && slot.burnRequests.includes(burn.requestId)
      );
      if (scheduledSlot) {
        expect(scheduledSlot.safetyBuffer).toBeGreaterThan(0);
      }
    });
  });

  test('Should integrate weather conditions into cost calculation', async () => {
    const burnRequests = [
      { requestId: 240000, farmId: 240000, priorityScore: 80, lat: 40.0, lon: -120.0, requestedDate: '2025-09-15' },
      { requestId: 240001, farmId: 240001, priorityScore: 80, lat: 40.1, lon: -120.1, requestedDate: '2025-09-15' }
    ];

    // Different weather conditions for comparison
    const goodWeatherResult = await optimizer.optimizeSchedule(burnRequests, [], {
      temperature: 18,
      humidity: 60,
      windSpeed: 8,
      stabilityClass: 'D'
    });

    const badWeatherResult = await optimizer.optimizeSchedule(burnRequests, [], {
      temperature: 35,
      humidity: 15,
      windSpeed: 25,
      stabilityClass: 'A'
    });

    expect(goodWeatherResult.cost).toBeLessThan(badWeatherResult.cost);
    expect(goodWeatherResult.weatherPenalty).toBeLessThan(badWeatherResult.weatherPenalty);
  });

  test('Should prioritize emergency burns over regular burns', async () => {
    const burnRequests = [
      { requestId: 250000, farmId: 250000, priorityScore: 95, priority: 'emergency', lat: 40.0, lon: -120.0, requestedDate: '2025-09-15' },
      { requestId: 250001, farmId: 250001, priorityScore: 85, priority: 'high', lat: 40.001, lon: -120.001, requestedDate: '2025-09-15' },
      { requestId: 250002, farmId: 250002, priorityScore: 75, priority: 'normal', lat: 40.002, lon: -120.002, requestedDate: '2025-09-15' }
    ];

    const conflicts = [
      { requestId1: 250000, requestId2: 250001, severity: 'medium', cost: 100 },
      { requestId1: 250000, requestId2: 250002, severity: 'medium', cost: 100 }
    ];

    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);

    // Emergency burn should be scheduled first
    const emergencyBurn = Object.values(result.schedule)[0];
    expect(emergencyBurn.burnRequests).toContain(250000);
    expect(result.priorityViolations).toBe(0);
  });

  test('Should validate schedule feasibility constraints', async () => {
    const burnRequests = Array.from({ length: 10 }, (_, i) => ({
      requestId: 260000 + i,
      farmId: 260000 + i,
      priorityScore: 70,
      lat: 40.0 + (i * 0.0001), // Very close burns
      lon: -120.0 + (i * 0.0001),
      requestedDate: '2025-09-15',
      duration: 4, // 4-hour burns
      minStartTime: '08:00',
      maxEndTime: '16:00'
    }));

    const result = await optimizer.optimizeSchedule(burnRequests, []);

    // Validate all burns fit within time constraints
    Object.values(result.schedule).forEach(slot => {
      if (slot.startTime && slot.endTime) {
        const startHour = parseInt(slot.startTime.split(':')[0]);
        const endHour = parseInt(slot.endTime.split(':')[0]);
        expect(startHour).toBeGreaterThanOrEqual(8);
        expect(endHour).toBeLessThanOrEqual(16);
        expect(endHour - startHour).toBeLessThanOrEqual(4);
      }
    });

    expect(result.feasibilityViolations).toBe(0);
  });

  test('Should handle multiple optimization runs with consistent results', async () => {
    const burnRequests = Array.from({ length: 15 }, (_, i) => ({
      requestId: 270000 + i,
      farmId: 270000 + i,
      priorityScore: 50 + (i % 30),
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15'
    }));

    const conflicts = [
      { requestId1: 270000, requestId2: 270001, severity: 'medium', cost: 75 },
      { requestId1: 270002, requestId2: 270003, severity: 'high', cost: 150 }
    ];

    // Run optimization multiple times
    const results = await Promise.all([
      optimizer.optimizeSchedule(burnRequests, conflicts),
      optimizer.optimizeSchedule(burnRequests, conflicts),
      optimizer.optimizeSchedule(burnRequests, conflicts)
    ]);

    // Results should be similar (within 10% cost variance)
    const costs = results.map(r => r.cost);
    const avgCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    
    costs.forEach(cost => {
      expect(Math.abs(cost - avgCost) / avgCost).toBeLessThan(0.1);
    });

    // All runs should schedule the same number of burns
    const scheduledCounts = results.map(r => Object.keys(r.schedule).length);
    expect(new Set(scheduledCounts).size).toBe(1); // All counts should be identical
  });

  test('Should optimize PM2.5 exposure minimization', async () => {
    const burnRequests = Array.from({ length: 8 }, (_, i) => ({
      requestId: 280000 + i,
      farmId: 280000 + i,
      priorityScore: 60,
      lat: 40.0 + (i * 0.002),
      lon: -120.0 + (i * 0.002),
      requestedDate: '2025-09-15',
      areaHectares: 150,
      fuelLoad: 20,
      nearbyPopulation: i < 4 ? 5000 : 100 // Some burns near population centers
    }));

    const result = await optimizer.optimizeSchedule(burnRequests, []);

    expect(result.pm25Optimization).toBeDefined();
    expect(result.totalPM25Exposure).toBeGreaterThanOrEqual(0);

    // Burns near population should be scheduled with more spacing
    const populationBurns = burnRequests.filter(req => req.nearbyPopulation > 1000);
    const ruralBurns = burnRequests.filter(req => req.nearbyPopulation <= 1000);

    if (populationBurns.length > 0 && ruralBurns.length > 0) {
      const popBurnSlots = Object.values(result.schedule).filter(slot => 
        slot.burnRequests && slot.burnRequests.some(id => 
          populationBurns.some(burn => burn.requestId === id)
        )
      );

      popBurnSlots.forEach(slot => {
        expect(slot.pm25Buffer).toBeGreaterThan(0);
      });
    }
  });

  test('Should validate Gaussian plume model integration', async () => {
    const burnRequests = [
      { 
        requestId: 290000, 
        farmId: 290000, 
        priorityScore: 70, 
        lat: 40.0, 
        lon: -120.0, 
        requestedDate: '2025-09-15',
        areaHectares: 200,
        fuelLoad: 25
      },
      { 
        requestId: 290001, 
        farmId: 290001, 
        priorityScore: 70, 
        lat: 40.003, 
        lon: -120.003, 
        requestedDate: '2025-09-15',
        areaHectares: 200,
        fuelLoad: 25
      }
    ];

    const weather = {
      temperature: 25,
      humidity: 45,
      windSpeed: 12,
      windDirection: 270,
      stabilityClass: 'D'
    };

    const result = await optimizer.optimizeSchedule(burnRequests, [], weather);

    expect(result.gaussianPlume).toBeDefined();
    expect(result.gaussianPlume.calculations.length).toBeGreaterThan(0);

    // Verify plume calculations affect scheduling
    result.gaussianPlume.calculations.forEach(calc => {
      expect(calc.maxConcentration).toBeGreaterThan(0);
      expect(calc.effectiveRadius).toBeGreaterThan(0);
      expect(['A', 'B', 'C', 'D', 'E', 'F']).toContain(calc.stabilityClass);
    });
  });

  test('Should handle Pasquill-Gifford stability class optimization', async () => {
    const burnRequests = Array.from({ length: 6 }, (_, i) => ({
      requestId: 300000 + i,
      farmId: 300000 + i,
      priorityScore: 65,
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15',
      areaHectares: 100
    }));

    const stabilityClasses = ['A', 'B', 'C', 'D', 'E', 'F'];
    const results = [];

    for (const stabilityClass of stabilityClasses) {
      const weather = {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        stabilityClass
      };

      const result = await optimizer.optimizeSchedule(burnRequests, [], weather);
      results.push({ stabilityClass, cost: result.cost, safety: result.safetyScore });
    }

    // Class D (neutral) should generally have lower costs than A (very unstable)
    const classA = results.find(r => r.stabilityClass === 'A');
    const classD = results.find(r => r.stabilityClass === 'D');
    
    expect(classD.cost).toBeLessThan(classA.cost);
    expect(classD.safety).toBeGreaterThan(classA.safety);

    // All results should have valid stability calculations
    results.forEach(result => {
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.safety).toBeGreaterThanOrEqual(0);
    });
  });

  test('Should optimize spatial burn distribution', async () => {
    const clusteredBurns = Array.from({ length: 10 }, (_, i) => ({
      requestId: 310000 + i,
      farmId: 310000 + i,
      priorityScore: 65,
      lat: 40.0 + (i % 3) * 0.0005, // Clustered in 3x3 grid
      lon: -120.0 + Math.floor(i / 3) * 0.0005,
      requestedDate: '2025-09-15',
      areaHectares: 100
    }));

    const spreadBurns = Array.from({ length: 10 }, (_, i) => ({
      requestId: 320000 + i,
      farmId: 320000 + i,
      priorityScore: 65,
      lat: 40.0 + (i * 0.01), // Well spread out
      lon: -120.0 + (i * 0.01),
      requestedDate: '2025-09-15',
      areaHectares: 100
    }));

    const clusteredResult = await optimizer.optimizeSchedule(clusteredBurns, []);
    const spreadResult = await optimizer.optimizeSchedule(spreadBurns, []);

    expect(clusteredResult.spatialDistribution).toBeDefined();
    expect(spreadResult.spatialDistribution).toBeDefined();

    // Spread burns should have better spatial optimization
    expect(spreadResult.spatialDistribution.score).toBeGreaterThan(
      clusteredResult.spatialDistribution.score
    );

    // Both should optimize for minimum overlap
    expect(clusteredResult.spatialDistribution.overlaps).toBeGreaterThan(
      spreadResult.spatialDistribution.overlaps
    );
  });

  test('Should validate burn window trading optimization', async () => {
    const burnRequests = [
      { 
        requestId: 330000, 
        farmId: 330000, 
        priorityScore: 85, 
        preferredDate: '2025-09-15',
        alternativeDates: ['2025-09-16', '2025-09-17'],
        tradingPenalty: 25,
        lat: 40.0, 
        lon: -120.0
      },
      { 
        requestId: 330001, 
        farmId: 330001, 
        priorityScore: 90, 
        preferredDate: '2025-09-15',
        alternativeDates: ['2025-09-14'],
        tradingPenalty: 50,
        lat: 40.001, 
        lon: -120.001
      }
    ];

    const conflicts = [
      { requestId1: 330000, requestId2: 330001, severity: 'high', cost: 200 }
    ];

    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);

    expect(result.burnWindowTrading).toBeDefined();
    expect(result.tradingDecisions).toBeDefined();

    // Higher priority burn should get preferred date
    const schedule = result.schedule;
    const highPrioritySlot = Object.values(schedule).find(slot => 
      slot.burnRequests && slot.burnRequests.includes(330001)
    );
    const lowPrioritySlot = Object.values(schedule).find(slot => 
      slot.burnRequests && slot.burnRequests.includes(330000)
    );

    if (highPrioritySlot && lowPrioritySlot) {
      expect(highPrioritySlot.date).toBe('2025-09-15');
      expect(lowPrioritySlot.date).not.toBe('2025-09-15');
    }
  });

  test('Should handle multi-objective optimization correctly', async () => {
    const burnRequests = Array.from({ length: 12 }, (_, i) => ({
      requestId: 340000 + i,
      farmId: 340000 + i,
      priorityScore: 40 + (i % 50),
      lat: 40.0 + (i * 0.002),
      lon: -120.0 + (i * 0.002),
      requestedDate: '2025-09-15',
      areaHectares: 100 + (i * 20),
      economicValue: 10000 + (i * 2000),
      environmentalCost: 500 + (i * 100)
    }));

    const conflicts = Array.from({ length: 5 }, (_, i) => ({
      requestId1: 340000 + i,
      requestId2: 340000 + i + 1,
      severity: 'medium',
      cost: 75 + (i * 25)
    }));

    const result = await optimizer.optimizeSchedule(burnRequests, conflicts, null, {
      priorityWeight: 0.4,
      safetyWeight: 0.3,
      economicWeight: 0.2,
      environmentalWeight: 0.1
    });

    expect(result.multiObjective).toBeDefined();
    expect(result.multiObjective.priorityScore).toBeGreaterThanOrEqual(0);
    expect(result.multiObjective.safetyScore).toBeGreaterThanOrEqual(0);
    expect(result.multiObjective.economicScore).toBeGreaterThanOrEqual(0);
    expect(result.multiObjective.environmentalScore).toBeGreaterThanOrEqual(0);

    // Weighted sum should equal total cost
    const calculatedCost = 
      result.multiObjective.priorityScore * 0.4 +
      result.multiObjective.safetyScore * 0.3 +
      result.multiObjective.economicScore * 0.2 +
      result.multiObjective.environmentalScore * 0.1;

    expect(Math.abs(result.cost - calculatedCost)).toBeLessThan(1.0);
  });

  test('Should validate convergence behavior', async () => {
    const burnRequests = Array.from({ length: 20 }, (_, i) => ({
      requestId: 350000 + i,
      farmId: 350000 + i,
      priorityScore: 55 + (i % 40),
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15'
    }));

    const conflicts = Array.from({ length: 8 }, (_, i) => ({
      requestId1: 350000 + i,
      requestId2: 350000 + i + 2,
      severity: 'medium',
      cost: 60 + (i * 15)
    }));

    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);

    expect(result.convergence).toBeDefined();
    expect(result.convergence.initialCost).toBeGreaterThan(result.convergence.finalCost);
    expect(result.convergence.improvements).toBeGreaterThan(0);
    expect(result.convergence.plateauIterations).toBeGreaterThanOrEqual(0);

    // Cost should improve over iterations
    const costHistory = result.convergence.costHistory;
    if (costHistory && costHistory.length > 10) {
      const firstTen = costHistory.slice(0, 10);
      const lastTen = costHistory.slice(-10);
      const avgFirst = firstTen.reduce((sum, cost) => sum + cost, 0) / firstTen.length;
      const avgLast = lastTen.reduce((sum, cost) => sum + cost, 0) / lastTen.length;
      
      expect(avgLast).toBeLessThanOrEqual(avgFirst);
    }
  });

  test('Should handle parameter sensitivity analysis', async () => {
    const burnRequests = Array.from({ length: 8 }, (_, i) => ({
      requestId: 360000 + i,
      farmId: 360000 + i,
      priorityScore: 60,
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15'
    }));

    const conflicts = [
      { requestId1: 360000, requestId2: 360001, severity: 'medium', cost: 80 }
    ];

    // Test different temperature decay rates
    const decayRates = [0.90, 0.95, 0.99];
    const results = [];

    for (const decayRate of decayRates) {
      const result = await optimizer.optimizeSchedule(burnRequests, conflicts, null, {
        temperatureDecay: decayRate
      });
      results.push({ decayRate, cost: result.cost, iterations: result.iterations });
    }

    // Higher decay rate should converge faster but potentially to worse solution
    const slow = results.find(r => r.decayRate === 0.90);
    const medium = results.find(r => r.decayRate === 0.95);
    const fast = results.find(r => r.decayRate === 0.99);

    expect(slow.iterations).toBeLessThan(medium.iterations);
    expect(medium.iterations).toBeLessThan(fast.iterations);

    // All should find valid solutions
    results.forEach(result => {
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBeGreaterThan(0);
    });
  });

  test('Should optimize for wind direction and smoke dispersion', async () => {
    const burnRequests = [
      { requestId: 370000, farmId: 370000, priorityScore: 70, lat: 40.000, lon: -120.000, requestedDate: '2025-09-15' },
      { requestId: 370001, farmId: 370001, priorityScore: 70, lat: 40.005, lon: -120.000, requestedDate: '2025-09-15' }, // North
      { requestId: 370002, farmId: 370002, priorityScore: 70, lat: 40.000, lon: -120.005, requestedDate: '2025-09-15' }  // East
    ];

    // Test with different wind directions
    const eastWind = { windSpeed: 15, windDirection: 90, temperature: 25, humidity: 40 }; // Wind from east
    const southWind = { windSpeed: 15, windDirection: 180, temperature: 25, humidity: 40 }; // Wind from south

    const eastWindResult = await optimizer.optimizeSchedule(burnRequests, [], eastWind);
    const southWindResult = await optimizer.optimizeSchedule(burnRequests, [], southWind);

    expect(eastWindResult.windOptimization).toBeDefined();
    expect(southWindResult.windOptimization).toBeDefined();

    // Different wind directions should produce different scheduling decisions
    expect(eastWindResult.cost).not.toBe(southWindResult.cost);

    // Validate smoke dispersion calculations
    [eastWindResult, southWindResult].forEach(result => {
      expect(result.smokeDispersion).toBeDefined();
      expect(result.smokeDispersion.dominantDirection).toBeGreaterThanOrEqual(0);
      expect(result.smokeDispersion.dominantDirection).toBeLessThan(360);
    });
  });

  test('Should validate schedule robustness under uncertainty', async () => {
    const burnRequests = Array.from({ length: 10 }, (_, i) => ({
      requestId: 380000 + i,
      farmId: 380000 + i,
      priorityScore: 60 + (i % 30),
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15',
      uncertainty: {
        priorityVariance: 5 + (i % 10),
        weatherSensitivity: 0.1 + (i % 5) * 0.02
      }
    }));

    const result = await optimizer.optimizeSchedule(burnRequests, [], null, {
      robustnessOptimization: true,
      uncertaintyTolerance: 0.15
    });

    expect(result.robustness).toBeDefined();
    expect(result.robustness.worstCaseScenario).toBeGreaterThanOrEqual(result.cost);
    expect(result.robustness.averageCaseScenario).toBeGreaterThanOrEqual(result.cost);
    expect(result.robustness.confidenceInterval).toBeDefined();

    // Schedule should be feasible under various scenarios
    expect(result.robustness.feasibilityProbability).toBeGreaterThan(0.8);
    expect(result.robustness.robustnessScore).toBeGreaterThan(0);
  });

  test('Should handle real-time optimization updates', async () => {
    const initialRequests = Array.from({ length: 8 }, (_, i) => ({
      requestId: 390000 + i,
      farmId: 390000 + i,
      priorityScore: 65,
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15'
    }));

    const initialResult = await optimizer.optimizeSchedule(initialRequests, []);

    // Add new urgent request
    const updatedRequests = [
      ...initialRequests,
      { 
        requestId: 390010, 
        farmId: 390010, 
        priorityScore: 95, 
        priority: 'emergency',
        lat: 40.004, 
        lon: -120.004, 
        requestedDate: '2025-09-15'
      }
    ];

    const updatedResult = await optimizer.optimizeSchedule(
      updatedRequests, 
      [],
      null,
      { incrementalUpdate: true, previousSchedule: initialResult.schedule }
    );

    expect(updatedResult.incrementalUpdate).toBeDefined();
    expect(updatedResult.changesFromPrevious).toBeDefined();
    expect(updatedResult.schedule).toBeDefined();

    // Emergency request should be accommodated
    const emergencyScheduled = Object.values(updatedResult.schedule).some(slot => 
      slot.burnRequests && slot.burnRequests.includes(390010)
    );
    expect(emergencyScheduled).toBeTruthy();

    // Most original schedule should be preserved
    const preservedSlots = updatedResult.changesFromPrevious.preserved;
    expect(preservedSlots).toBeGreaterThan(5); // Most slots should remain unchanged
  });

  test('Should validate mathematical correctness of cost function', async () => {
    const burnRequests = [
      { requestId: 400000, farmId: 400000, priorityScore: 80, lat: 40.0, lon: -120.0, requestedDate: '2025-09-15' },
      { requestId: 400001, farmId: 400001, priorityScore: 60, lat: 40.001, lon: -120.001, requestedDate: '2025-09-15' }
    ];

    const conflicts = [
      { requestId1: 400000, requestId2: 400001, severity: 'medium', cost: 100 }
    ];

    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);

    expect(result.costBreakdown).toBeDefined();
    expect(result.costBreakdown.priorityCost).toBeGreaterThanOrEqual(0);
    expect(result.costBreakdown.conflictCost).toBeGreaterThanOrEqual(0);
    expect(result.costBreakdown.safetyCost).toBeGreaterThanOrEqual(0);
    expect(result.costBreakdown.weatherCost).toBeGreaterThanOrEqual(0);

    // Total cost should equal sum of components
    const calculatedTotal = 
      result.costBreakdown.priorityCost +
      result.costBreakdown.conflictCost +
      result.costBreakdown.safetyCost +
      result.costBreakdown.weatherCost;

    expect(Math.abs(result.cost - calculatedTotal)).toBeLessThan(0.01);

    // Individual cost components should make mathematical sense
    expect(result.costBreakdown.conflictCost).toBeGreaterThan(0); // We have conflicts
    expect(result.costBreakdown.priorityCost).toBeGreaterThan(0); // We have priority variations
  });

  test('Should optimize for minimum total system risk', async () => {
    const burnRequests = Array.from({ length: 12 }, (_, i) => ({
      requestId: 410000 + i,
      farmId: 410000 + i,
      priorityScore: 55 + (i % 35),
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15',
      riskFactors: {
        fireSpread: 0.1 + (i % 8) * 0.05,
        airQuality: 0.2 + (i % 6) * 0.03,
        publicSafety: 0.05 + (i % 4) * 0.02
      }
    }));

    const result = await optimizer.optimizeSchedule(burnRequests, [], null, {
      riskMinimization: true
    });

    expect(result.riskAnalysis).toBeDefined();
    expect(result.riskAnalysis.totalSystemRisk).toBeGreaterThanOrEqual(0);
    expect(result.riskAnalysis.riskDistribution).toBeDefined();

    // Risk should be distributed across time slots
    const riskBySlot = result.riskAnalysis.riskDistribution;
    Object.values(riskBySlot).forEach(slotRisk => {
      expect(slotRisk.fireSpreadRisk).toBeGreaterThanOrEqual(0);
      expect(slotRisk.airQualityRisk).toBeGreaterThanOrEqual(0);
      expect(slotRisk.publicSafetyRisk).toBeGreaterThanOrEqual(0);
    });

    // High-risk burns should be scheduled with appropriate spacing
    const highRiskBurns = burnRequests.filter(req => 
      req.riskFactors.fireSpread > 0.3 || 
      req.riskFactors.airQuality > 0.4 ||
      req.riskFactors.publicSafety > 0.1
    );

    if (highRiskBurns.length > 1) {
      expect(result.riskAnalysis.highRiskSeparation).toBeGreaterThan(0);
    }
  });

  test('Should handle optimization performance metrics validation', async () => {
    const burnRequests = Array.from({ length: 25 }, (_, i) => ({
      requestId: 420000 + i,
      farmId: 420000 + i,
      priorityScore: 45 + (i % 45),
      lat: 40.0 + (i * 0.001),
      lon: -120.0 + (i * 0.001),
      requestedDate: '2025-09-15'
    }));

    const conflicts = Array.from({ length: 10 }, (_, i) => ({
      requestId1: 420000 + i,
      requestId2: 420000 + i + 1,
      severity: ['low', 'medium', 'high'][i % 3],
      cost: 50 + (i * 20)
    }));

    const startTime = Date.now();
    const result = await optimizer.optimizeSchedule(burnRequests, conflicts);
    const duration = Date.now() - startTime;

    expect(result.performance).toBeDefined();
    expect(result.performance.executionTime).toBeGreaterThan(0);
    expect(result.performance.iterationsPerSecond).toBeGreaterThan(0);
    expect(result.performance.memoryUsage).toBeGreaterThan(0);

    // Performance should be reasonable
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    expect(result.performance.iterationsPerSecond).toBeGreaterThan(10); // At least 10 iterations/second

    // Algorithm efficiency metrics
    expect(result.performance.convergenceRate).toBeGreaterThan(0);
    expect(result.performance.solutionQuality).toBeGreaterThan(0);
    expect(result.performance.algorithmEfficiency).toBeGreaterThan(0.5);
  });
});