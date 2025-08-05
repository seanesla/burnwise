const optimizerAgent = require('../../agents/optimizer');
const { query, vectorSimilaritySearch } = require('../../db/connection');
const logger = require('../../middleware/logger');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');

describe('Optimizer Agent Tests', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Initialization Tests', () => {
    test('should initialize with default configuration', () => {
      expect(optimizerAgent.isInitialized()).toBe(false);
      expect(() => optimizerAgent.initialize()).not.toThrow();
      expect(optimizerAgent.isInitialized()).toBe(true);
    });

    test('should initialize with custom simulated annealing parameters', () => {
      const config = {
        initialTemperature: 1000,
        finalTemperature: 0.1,
        coolingRate: 0.95,
        maxIterations: 10000,
        reheatingThreshold: 100
      };
      
      expect(() => optimizerAgent.initialize(config)).not.toThrow();
      const status = optimizerAgent.getStatus();
      expect(status.config.initialTemperature).toBe(1000);
      expect(status.config.coolingRate).toBe(0.95);
    });

    test('should handle initialization errors gracefully', () => {
      query.mockRejectedValueOnce(new Error('Database connection failed'));
      expect(() => optimizerAgent.initialize()).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    test('should not reinitialize if already initialized', () => {
      optimizerAgent.initialize();
      const firstStatus = optimizerAgent.getStatus();
      optimizerAgent.initialize();
      const secondStatus = optimizerAgent.getStatus();
      expect(firstStatus.initializedAt).toEqual(secondStatus.initializedAt);
    });

    test('should validate algorithm parameters', () => {
      const invalidConfig = {
        initialTemperature: -100,
        finalTemperature: 1000, // Higher than initial
        coolingRate: 1.5, // > 1
        maxIterations: -1
      };
      
      expect(() => optimizerAgent.initialize(invalidConfig)).not.toThrow();
      // Should use defaults for invalid values
      const status = optimizerAgent.getStatus();
      expect(status.config.initialTemperature).toBeGreaterThan(0);
      expect(status.config.coolingRate).toBeLessThan(1);
    });
  });

  describe('2. Simulated Annealing Algorithm Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should perform basic simulated annealing optimization', async () => {
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.5,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 8000
        },
        {
          id: 2,
          latitude: 37.52,
          longitude: -120.48,
          acres: 80,
          priority_score: 7.2,
          preferred_date: new Date('2025-08-10T11:00:00Z'),
          time_window_start: 10,
          time_window_end: 18,
          max_dispersion_radius: 6500
        }
      ];

      const optimizedSchedule = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(optimizedSchedule).toBeDefined();
      expect(optimizedSchedule.schedule).toBeInstanceOf(Array);
      expect(optimizedSchedule.totalScore).toBeGreaterThan(0);
      expect(optimizedSchedule.conflicts).toBeInstanceOf(Array);
      expect(optimizedSchedule.iterations).toBeGreaterThan(0);
    });

    test('should handle temperature cooling correctly', () => {
      const config = {
        initialTemperature: 1000,
        finalTemperature: 1,
        coolingRate: 0.9,
        maxIterations: 100
      };
      
      optimizerAgent.initialize(config);
      
      const temperatures = [];
      for (let i = 0; i < 10; i++) {
        const temp = optimizerAgent.calculateTemperature(i, config);
        temperatures.push(temp);
      }
      
      // Temperature should decrease monotonically
      for (let i = 1; i < temperatures.length; i++) {
        expect(temperatures[i]).toBeLessThanOrEqual(temperatures[i-1]);
      }
      
      expect(temperatures[0]).toBe(1000);
      expect(temperatures[temperatures.length - 1]).toBeGreaterThanOrEqual(1);
    });

    test('should generate valid neighbor solutions', () => {
      const currentSolution = [
        { burnId: 1, scheduledTime: new Date('2025-08-10T09:00:00Z') },
        { burnId: 2, scheduledTime: new Date('2025-08-10T11:00:00Z') },
        { burnId: 3, scheduledTime: new Date('2025-08-10T14:00:00Z') }
      ];

      const neighbor = optimizerAgent.generateNeighbor(currentSolution);
      
      expect(neighbor).toBeInstanceOf(Array);
      expect(neighbor).toHaveLength(currentSolution.length);
      expect(neighbor.every(item => item.burnId && item.scheduledTime)).toBe(true);
      
      // Should be different from current solution
      const isDifferent = neighbor.some((item, index) => 
        item.scheduledTime.getTime() !== currentSolution[index].scheduledTime.getTime()
      );
      expect(isDifferent).toBe(true);
    });

    test('should calculate acceptance probability correctly', () => {
      const currentScore = 100;
      const newScore = 90; // Worse solution
      const temperature = 50;
      
      const probability = optimizerAgent.calculateAcceptanceProbability(
        currentScore, newScore, temperature
      );
      
      expect(probability).toBeGreaterThan(0);
      expect(probability).toBeLessThan(1);
      
      // Higher temperature should mean higher acceptance probability
      const higherTempProb = optimizerAgent.calculateAcceptanceProbability(
        currentScore, newScore, 100
      );
      expect(higherTempProb).toBeGreaterThan(probability);
    });

    test('should always accept better solutions', () => {
      const currentScore = 80;
      const betterScore = 90;
      const temperature = 10;
      
      const probability = optimizerAgent.calculateAcceptanceProbability(
        currentScore, betterScore, temperature
      );
      
      expect(probability).toBe(1.0); // Should always accept better solutions
    });

    test('should implement reheating mechanism', async () => {
      const config = {
        initialTemperature: 100,
        finalTemperature: 1,
        coolingRate: 0.8,
        maxIterations: 1000,
        reheatingThreshold: 50,
        reheatingFactor: 1.5
      };
      
      optimizerAgent.initialize(config);
      
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(result.reheatingEvents).toBeInstanceOf(Array);
      expect(result.temperatureHistory).toBeInstanceOf(Array);
    });
  });

  describe('3. Conflict Detection and Resolution', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should detect spatial conflicts between burns', () => {
      const solution = [
        {
          burnId: 1,
          scheduledTime: new Date('2025-08-10T09:00:00Z'),
          latitude: 37.5,
          longitude: -120.5,
          max_dispersion_radius: 8000
        },
        {
          burnId: 2,
          scheduledTime: new Date('2025-08-10T09:30:00Z'),
          latitude: 37.501,
          longitude: -120.501,
          max_dispersion_radius: 7000
        }
      ];

      const conflicts = optimizerAgent.detectConflicts(solution);
      
      expect(conflicts).toBeInstanceOf(Array);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toHaveProperty('type');
      expect(conflicts[0]).toHaveProperty('severity');
      expect(conflicts[0]).toHaveProperty('burnIds');
    });

    test('should detect temporal conflicts', () => {
      const solution = [
        {
          burnId: 1,
          scheduledTime: new Date('2025-08-10T09:00:00Z'),
          estimated_duration: 4, // 4 hours
          latitude: 37.5,
          longitude: -120.5,
          max_dispersion_radius: 8000
        },
        {
          burnId: 2,
          scheduledTime: new Date('2025-08-10T11:00:00Z'),
          estimated_duration: 3,
          latitude: 37.51,
          longitude: -120.49,
          max_dispersion_radius: 7500
        }
      ];

      const conflicts = optimizerAgent.detectConflicts(solution);
      
      const temporalConflicts = conflicts.filter(c => c.type === 'temporal_overlap');
      expect(temporalConflicts.length).toBeGreaterThan(0);
      expect(temporalConflicts[0].overlapHours).toBeGreaterThan(0);
    });

    test('should calculate conflict severity levels', () => {
      const conflict = {
        burnId1: 1,
        burnId2: 2,
        distance: 500, // Very close
        dispersionOverlap: 0.8, // High overlap
        timeOverlap: 2 // 2 hours overlap
      };

      const severity = optimizerAgent.calculateConflictSeverity(conflict);
      
      expect(['low', 'medium', 'high', 'critical']).toContain(severity);
      expect(severity).toBe('critical'); // Very close with high overlap
    });

    test('should resolve conflicts through rescheduling', () => {
      const conflictingSolution = [
        {
          burnId: 1,
          scheduledTime: new Date('2025-08-10T09:00:00Z'),
          latitude: 37.5,
          longitude: -120.5,
          max_dispersion_radius: 8000,
          time_window_start: 8,
          time_window_end: 18
        },
        {
          burnId: 2,
          scheduledTime: new Date('2025-08-10T09:30:00Z'), // Conflicting time
          latitude: 37.501,
          longitude: -120.501,
          max_dispersion_radius: 7000,
          time_window_start: 9,
          time_window_end: 17
        }
      ];

      const resolvedSolution = optimizerAgent.resolveConflicts(conflictingSolution);
      
      expect(resolvedSolution).toBeInstanceOf(Array);
      expect(resolvedSolution).toHaveLength(conflictingSolution.length);
      
      // Check that conflicts are reduced
      const originalConflicts = optimizerAgent.detectConflicts(conflictingSolution);
      const newConflicts = optimizerAgent.detectConflicts(resolvedSolution);
      expect(newConflicts.length).toBeLessThanOrEqual(originalConflicts.length);
    });

    test('should handle multiple simultaneous conflicts', () => {
      const complexSolution = [
        { burnId: 1, scheduledTime: new Date('2025-08-10T09:00:00Z'), latitude: 37.5, longitude: -120.5, max_dispersion_radius: 8000 },
        { burnId: 2, scheduledTime: new Date('2025-08-10T09:15:00Z'), latitude: 37.501, longitude: -120.501, max_dispersion_radius: 7000 },
        { burnId: 3, scheduledTime: new Date('2025-08-10T09:30:00Z'), latitude: 37.502, longitude: -120.499, max_dispersion_radius: 7500 },
        { burnId: 4, scheduledTime: new Date('2025-08-10T09:45:00Z'), latitude: 37.499, longitude: -120.502, max_dispersion_radius: 6500 }
      ];

      const conflicts = optimizerAgent.detectConflicts(complexSolution);
      
      expect(conflicts.length).toBeGreaterThan(3); // Multiple conflicts expected
      
      const conflictMatrix = optimizerAgent.buildConflictMatrix(complexSolution);
      expect(conflictMatrix).toBeInstanceOf(Array);
      expect(conflictMatrix.length).toBe(4);
      expect(conflictMatrix[0].length).toBe(4);
    });
  });

  describe('4. Score Calculation Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should calculate comprehensive solution scores', () => {
      const solution = [
        {
          burnId: 1,
          scheduledTime: new Date('2025-08-10T09:00:00Z'),
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          priority_score: 8.5,
          latitude: 37.5,
          longitude: -120.5,
          max_dispersion_radius: 8000
        },
        {
          burnId: 2,
          scheduledTime: new Date('2025-08-10T14:00:00Z'),
          preferred_date: new Date('2025-08-10T12:00:00Z'),
          priority_score: 7.2,
          latitude: 37.55,
          longitude: -120.55,
          max_dispersion_radius: 6000
        }
      ];

      const score = optimizerAgent.calculateSolutionScore(solution);
      
      expect(score).toBeGreaterThan(0);
      expect(score.total).toBeDefined();
      expect(score.components).toBeDefined();
      expect(score.components.priorityScore).toBeGreaterThan(0);
      expect(score.components.timePreferenceScore).toBeGreaterThan(0);
      expect(score.components.conflictPenalty).toBeGreaterThanOrEqual(0);
    });

    test('should apply time preference scoring', () => {
      const perfectTimingBurn = {
        burnId: 1,
        scheduledTime: new Date('2025-08-10T10:00:00Z'),
        preferred_date: new Date('2025-08-10T10:00:00Z'),
        priority_score: 8.0
      };

      const poorTimingBurn = {
        burnId: 2,
        scheduledTime: new Date('2025-08-10T16:00:00Z'),
        preferred_date: new Date('2025-08-10T09:00:00Z'),
        priority_score: 8.0
      };

      const perfectScore = optimizerAgent.calculateTimePreferenceScore(perfectTimingBurn);
      const poorScore = optimizerAgent.calculateTimePreferenceScore(poorTimingBurn);
      
      expect(perfectScore).toBeGreaterThan(poorScore);
      expect(perfectScore).toBe(1.0); // Perfect timing should score 1.0
    });

    test('should weight priority scores correctly', () => {
      const highPriorityBurn = {
        burnId: 1,
        scheduledTime: new Date('2025-08-10T10:00:00Z'),
        priority_score: 9.5,
        preferred_date: new Date('2025-08-10T10:00:00Z')
      };

      const lowPriorityBurn = {
        burnId: 2,
        scheduledTime: new Date('2025-08-10T10:00:00Z'),
        priority_score: 5.0,
        preferred_date: new Date('2025-08-10T10:00:00Z')
      };

      const highScore = optimizerAgent.calculatePriorityScore(highPriorityBurn);
      const lowScore = optimizerAgent.calculatePriorityScore(lowPriorityBurn);
      
      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeCloseTo(0.95, 1); // 9.5/10
      expect(lowScore).toBeCloseTo(0.5, 1); // 5.0/10
    });

    test('should penalize conflicts appropriately', () => {
      const conflictFreeScore = optimizerAgent.calculateConflictPenalty([]);
      const conflictedScore = optimizerAgent.calculateConflictPenalty([
        { type: 'spatial', severity: 'high', burnIds: [1, 2] },
        { type: 'temporal', severity: 'medium', burnIds: [2, 3] }
      ]);
      
      expect(conflictFreeScore).toBe(0); // No penalty for no conflicts
      expect(conflictedScore).toBeGreaterThan(0); // Penalty for conflicts
    });

    test('should calculate efficiency metrics', () => {
      const solution = [
        { burnId: 1, scheduledTime: new Date('2025-08-10T09:00:00Z'), acres: 100 },
        { burnId: 2, scheduledTime: new Date('2025-08-10T14:00:00Z'), acres: 80 },
        { burnId: 3, scheduledTime: new Date('2025-08-11T10:00:00Z'), acres: 120 }
      ];

      const efficiency = optimizerAgent.calculateEfficiencyMetrics(solution);
      
      expect(efficiency.totalAcres).toBe(300);
      expect(efficiency.averageGapHours).toBeGreaterThan(0);
      expect(efficiency.dayUtilization).toBeGreaterThan(0);
      expect(efficiency.throughputScore).toBeGreaterThan(0);
    });
  });

  describe('5. Constraint Handling Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should enforce time window constraints', () => {
      const burnRequest = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        priority_score: 8.0,
        preferred_date: new Date('2025-08-10T10:00:00Z'),
        time_window_start: 9, // 9 AM
        time_window_end: 15,  // 3 PM
        max_dispersion_radius: 7000
      };

      const validTime = new Date('2025-08-10T12:00:00Z'); // Within window
      const invalidTime = new Date('2025-08-10T18:00:00Z'); // Outside window

      expect(optimizerAgent.isWithinTimeWindow(burnRequest, validTime)).toBe(true);
      expect(optimizerAgent.isWithinTimeWindow(burnRequest, invalidTime)).toBe(false);
    });

    test('should respect weather constraints', () => {
      const weatherConstraints = {
        maxWindSpeed: 15, // mph
        minVisibility: 5, // miles
        noRainRequired: true,
        temperatureRange: { min: 10, max: 35 } // Celsius
      };

      const goodWeather = {
        wind_speed: 8,
        visibility: 10,
        precipitation: 0,
        temperature: 22
      };

      const badWeather = {
        wind_speed: 20, // Too windy
        visibility: 2,  // Too low
        precipitation: 5, // Raining
        temperature: 40 // Too hot
      };

      expect(optimizerAgent.meetsWeatherConstraints(goodWeather, weatherConstraints)).toBe(true);
      expect(optimizerAgent.meetsWeatherConstraints(badWeather, weatherConstraints)).toBe(false);
    });

    test('should handle spatial separation requirements', () => {
      const spatialConstraints = {
        minSeparationDistance: 5000, // meters
        bufferZones: [
          { type: 'school', latitude: 37.502, longitude: -120.502, radius: 2000 },
          { type: 'hospital', latitude: 37.498, longitude: -120.498, radius: 3000 }
        ]
      };

      const proposedBurn = {
        latitude: 37.5,
        longitude: -120.5,
        max_dispersion_radius: 6000
      };

      const violations = optimizerAgent.checkSpatialConstraints(proposedBurn, spatialConstraints);
      
      expect(violations).toBeInstanceOf(Array);
      expect(violations.length).toBeGreaterThan(0); // Should violate buffer zones
      expect(violations[0]).toHaveProperty('type');
      expect(violations[0]).toHaveProperty('distance');
    });

    test('should enforce resource availability constraints', () => {
      const resourceConstraints = {
        maxConcurrentBurns: 3,
        requiredPersonnel: 5,
        requiredEquipment: ['fire_truck', 'water_tank'],
        availableTimeSlots: [
          { start: '08:00', end: '17:00' },
          { start: '19:00', end: '22:00' }
        ]
      };

      const scheduledTime = new Date('2025-08-10T12:00:00Z');
      const unavailableTime = new Date('2025-08-10T18:00:00Z');

      expect(optimizerAgent.checkResourceAvailability(scheduledTime, resourceConstraints)).toBe(true);
      expect(optimizerAgent.checkResourceAvailability(unavailableTime, resourceConstraints)).toBe(false);
    });

    test('should handle regulatory constraints', () => {
      const regulatoryConstraints = {
        permitRequired: true,
        seasonalRestrictions: [
          { startDate: '2025-07-01', endDate: '2025-09-30', restricted: true }
        ],
        airQualityThresholds: {
          pm25: 35, // µg/m³
          visibility: 3 // miles
        },
        prohibitedDays: ['sunday', 'federal_holidays']
      };

      const scheduledDate = new Date('2025-08-10T10:00:00Z'); // Sunday
      const constraints = optimizerAgent.checkRegulatoryConstraints(scheduledDate, regulatoryConstraints);
      
      expect(constraints.violations).toBeInstanceOf(Array);
      expect(constraints.violations.some(v => v.type === 'prohibited_day')).toBe(true);
    });
  });

  describe('6. Multi-Objective Optimization Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should balance multiple objectives', async () => {
      const objectives = {
        priorityWeight: 0.4,
        timePreferenceWeight: 0.3,
        conflictAvoidanceWeight: 0.2,
        efficiencyWeight: 0.1
      };

      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 9.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 8000
        },
        {
          id: 2,
          latitude: 37.52,
          longitude: -120.48,
          acres: 80,
          priority_score: 6.5,
          preferred_date: new Date('2025-08-10T14:00:00Z'),
          time_window_start: 12,
          time_window_end: 18,
          max_dispersion_radius: 6000
        }
      ];

      const result = await optimizerAgent.multiObjectiveOptimization(burnRequests, objectives);
      
      expect(result.paretoFront).toBeInstanceOf(Array);
      expect(result.bestSolution).toBeDefined();
      expect(result.objectiveScores).toBeDefined();
      expect(result.tradeoffAnalysis).toBeDefined();
    });

    test('should generate Pareto front solutions', async () => {
      const burnRequests = [
        { id: 1, priority_score: 8.0, preferred_date: new Date('2025-08-10T09:00:00Z') },
        { id: 2, priority_score: 7.5, preferred_date: new Date('2025-08-10T11:00:00Z') },
        { id: 3, priority_score: 9.0, preferred_date: new Date('2025-08-10T14:00:00Z') }
      ];

      const paretoSolutions = await optimizerAgent.generateParetoFront(burnRequests);
      
      expect(paretoSolutions).toBeInstanceOf(Array);
      expect(paretoSolutions.length).toBeGreaterThan(0);
      
      // Each solution should have objective scores
      paretoSolutions.forEach(solution => {
        expect(solution.objectives).toBeDefined();
        expect(solution.objectives.priority).toBeGreaterThan(0);
        expect(solution.objectives.efficiency).toBeGreaterThan(0);
      });
    });

    test('should perform sensitivity analysis', () => {
      const baseSolution = [
        { burnId: 1, scheduledTime: new Date('2025-08-10T09:00:00Z'), priority_score: 8.0 }
      ];

      const weightVariations = [
        { priorityWeight: 0.6, timePreferenceWeight: 0.4 },
        { priorityWeight: 0.4, timePreferenceWeight: 0.6 },
        { priorityWeight: 0.5, timePreferenceWeight: 0.5 }
      ];

      const sensitivity = optimizerAgent.performSensitivityAnalysis(baseSolution, weightVariations);
      
      expect(sensitivity.variations).toBeInstanceOf(Array);
      expect(sensitivity.variations).toHaveLength(3);
      expect(sensitivity.stabilityScore).toBeGreaterThan(0);
    });
  });

  describe('7. Algorithm Performance Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should converge within iteration limits', async () => {
      const config = {
        maxIterations: 500,
        convergenceThreshold: 0.001,
        convergenceWindow: 50
      };
      
      optimizerAgent.initialize(config);

      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(result.converged).toBe(true);
      expect(result.iterations).toBeLessThanOrEqual(500);
      expect(result.convergenceIteration).toBeLessThanOrEqual(result.iterations);
    });

    test('should track solution improvement over iterations', async () => {
      const burnRequests = [
        { id: 1, priority_score: 8.0, preferred_date: new Date('2025-08-10T09:00:00Z') },
        { id: 2, priority_score: 7.5, preferred_date: new Date('2025-08-10T11:00:00Z') }
      ];

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(result.scoreHistory).toBeInstanceOf(Array);
      expect(result.scoreHistory.length).toBeGreaterThan(0);
      
      // Final score should be better than or equal to initial score
      const initialScore = result.scoreHistory[0];
      const finalScore = result.scoreHistory[result.scoreHistory.length - 1];
      expect(finalScore).toBeGreaterThanOrEqual(initialScore);
    });

    test('should handle different problem sizes efficiently', async () => {
      const smallProblem = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        priority_score: 7 + Math.random() * 2,
        preferred_date: new Date('2025-08-10T09:00:00Z')
      }));

      const largeProblem = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        priority_score: 7 + Math.random() * 2,
        preferred_date: new Date('2025-08-10T09:00:00Z')
      }));

      const startTimeSmall = Date.now();
      const smallResult = await optimizerAgent.optimizeSchedule(smallProblem);
      const smallDuration = Date.now() - startTimeSmall;

      const startTimeLarge = Date.now();
      const largeResult = await optimizerAgent.optimizeSchedule(largeProblem);
      const largeDuration = Date.now() - startTimeLarge;

      expect(smallResult.schedule).toHaveLength(5);
      expect(largeResult.schedule).toHaveLength(50);
      
      // Large problem should not take exponentially longer
      expect(largeDuration / smallDuration).toBeLessThan(20);
    });
  });

  describe('8. Database Integration Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
      query.mockClear();
    });

    test('should store optimization results in database', async () => {
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      query.mockResolvedValueOnce([{ insertId: 456 }]);

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO optimization_results'),
        expect.arrayContaining([
          expect.any(String), // schedule JSON
          expect.any(Number), // total_score
          expect.any(Number), // iterations
          expect.any(String), // algorithm_config JSON
          expect.any(String)  // performance_metrics JSON
        ])
      );
    });

    test('should handle database storage failures', async () => {
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      query.mockRejectedValueOnce(new Error('Database write failed'));

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(result.schedule).toBeDefined(); // Should still return results
      expect(result.databaseError).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    test('should retrieve historical optimization data', async () => {
      query.mockResolvedValueOnce([
        {
          id: 1,
          schedule_data: JSON.stringify([{ burnId: 1, scheduledTime: '2025-08-10T09:00:00Z' }]),
          total_score: 85.5,
          iterations: 342,
          created_at: new Date('2025-08-09T12:00:00Z')
        },
        {
          id: 2,
          schedule_data: JSON.stringify([{ burnId: 2, scheduledTime: '2025-08-10T11:00:00Z' }]),
          total_score: 78.2,
          iterations: 298,
          created_at: new Date('2025-08-09T10:00:00Z')
        }
      ]);

      const historicalData = await optimizerAgent.getHistoricalOptimizations();
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM optimization_results'),
        expect.any(Array)
      );
      expect(historicalData).toHaveLength(2);
      expect(historicalData[0].totalScore).toBe(85.5);
    });
  });

  describe('9. Error Handling Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should handle empty burn request arrays', async () => {
      const result = await optimizerAgent.optimizeSchedule([]);
      
      expect(result.schedule).toEqual([]);
      expect(result.totalScore).toBe(0);
      expect(result.iterations).toBe(0);
      expect(result.message).toContain('No burn requests');
    });

    test('should handle invalid burn request data', async () => {
      const invalidRequests = [
        {
          id: null,
          latitude: 'invalid',
          longitude: undefined,
          acres: -50,
          priority_score: 15, // > 10
          preferred_date: 'not a date'
        }
      ];

      const result = await optimizerAgent.optimizeSchedule(invalidRequests);
      
      expect(result.validationErrors).toBeInstanceOf(Array);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    test('should handle algorithm convergence failures', async () => {
      const config = {
        maxIterations: 10, // Very low limit
        convergenceThreshold: 0.0001, // Very strict
        convergenceWindow: 5
      };
      
      optimizerAgent.initialize(config);

      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(result.converged).toBe(false);
      expect(result.iterations).toBe(10);
      expect(result.terminationReason).toBe('max_iterations_reached');
    });

    test('should handle memory constraints gracefully', async () => {
      // Simulate memory pressure with very large problem
      const massiveProblem = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        latitude: 37.5 + (Math.random() - 0.5) * 0.1,
        longitude: -120.5 + (Math.random() - 0.5) * 0.1,
        acres: 50 + Math.random() * 100,
        priority_score: 5 + Math.random() * 5,
        preferred_date: new Date('2025-08-10T09:00:00Z'),
        time_window_start: 8,
        time_window_end: 16,
        max_dispersion_radius: 5000 + Math.random() * 5000
      }));

      const initialMemory = process.memoryUsage();
      
      const result = await optimizerAgent.optimizeSchedule(massiveProblem.slice(0, 10));
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      expect(result.schedule).toBeDefined();
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });
  });

  describe('10. Real-time Optimization Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should handle dynamic burn request updates', async () => {
      const initialRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      const initialResult = await optimizerAgent.optimizeSchedule(initialRequests);
      
      // Add new urgent request
      const updatedRequests = [
        ...initialRequests,
        {
          id: 2,
          latitude: 37.52,
          longitude: -120.48,
          acres: 150,
          priority_score: 9.5, // Higher priority
          preferred_date: new Date('2025-08-10T10:00:00Z'),
          time_window_start: 9,
          time_window_end: 17,
          max_dispersion_radius: 8500,
          urgent: true
        }
      ];

      const updatedResult = await optimizerAgent.reoptimizeSchedule(
        initialResult, updatedRequests
      );
      
      expect(updatedResult.schedule).toHaveLength(2);
      expect(updatedResult.totalScore).toBeDefined();
      expect(updatedResult.reoptimizationTime).toBeLessThan(5000); // Fast reoptimization
    });

    test('should handle weather condition changes', async () => {
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      const goodWeatherConstraints = {
        maxWindSpeed: 15,
        minVisibility: 5,
        noRainRequired: true
      };

      const poorWeatherConstraints = {
        maxWindSpeed: 10, // More restrictive
        minVisibility: 8,
        noRainRequired: true
      };

      const goodWeatherResult = await optimizerAgent.optimizeWithWeatherConstraints(
        burnRequests, goodWeatherConstraints
      );
      
      const poorWeatherResult = await optimizerAgent.optimizeWithWeatherConstraints(
        burnRequests, poorWeatherConstraints
      );

      expect(goodWeatherResult.feasibleTimeWindows.length).toBeGreaterThanOrEqual(
        poorWeatherResult.feasibleTimeWindows.length
      );
    });

    test('should provide incremental optimization capabilities', async () => {
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      const optimizationState = await optimizerAgent.initializeOptimizationState(burnRequests);
      
      // Perform incremental improvements
      for (let i = 0; i < 5; i++) {
        const improvement = await optimizerAgent.performIncrementalOptimization(
          optimizationState, 10 // 10 iterations each
        );
        
        expect(improvement.scoreImprovement).toBeGreaterThanOrEqual(0);
        expect(improvement.iterations).toBe(10);
      }
      
      const finalResult = optimizerAgent.getFinalOptimizationResult(optimizationState);
      expect(finalResult.totalIterations).toBe(50);
    });
  });

  describe('11. Performance Monitoring Tests', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should track detailed performance metrics', async () => {
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.totalExecutionTime).toBeGreaterThan(0);
      expect(result.performanceMetrics.iterationTimes).toBeInstanceOf(Array);
      expect(result.performanceMetrics.memoryUsage).toBeDefined();
      expect(result.performanceMetrics.convergenceRate).toBeGreaterThan(0);
    });

    test('should monitor algorithm efficiency', async () => {
      const burnRequests = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        latitude: 37.5 + (Math.random() - 0.5) * 0.1,
        longitude: -120.5 + (Math.random() - 0.5) * 0.1,
        acres: 50 + Math.random() * 100,
        priority_score: 5 + Math.random() * 5,
        preferred_date: new Date('2025-08-10T09:00:00Z'),
        time_window_start: 8,
        time_window_end: 16,
        max_dispersion_radius: 5000 + Math.random() * 5000
      }));

      const result = await optimizerAgent.optimizeSchedule(burnRequests);
      
      expect(result.efficiency).toBeDefined();
      expect(result.efficiency.solutionsPerSecond).toBeGreaterThan(0);
      expect(result.efficiency.convergenceEfficiency).toBeGreaterThan(0);
      expect(result.efficiency.resourceUtilization).toBeDefined();
    });

    test('should provide optimization statistics', () => {
      const stats = optimizerAgent.getOptimizationStatistics();
      
      expect(stats).toHaveProperty('totalOptimizations');
      expect(stats).toHaveProperty('averageIterations');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('convergenceRate');
      expect(stats).toHaveProperty('bestScore');
      expect(stats).toHaveProperty('worstScore');
    });
  });

  describe('12. Status and Health Monitoring', () => {
    beforeEach(() => {
      optimizerAgent.initialize();
    });

    test('should provide comprehensive agent status', () => {
      const status = optimizerAgent.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('config');
      expect(status).toHaveProperty('statistics');
      expect(status).toHaveProperty('lastOptimization');
      expect(status.config).toHaveProperty('initialTemperature');
      expect(status.config).toHaveProperty('coolingRate');
      expect(status.config).toHaveProperty('maxIterations');
    });

    test('should track optimization statistics', async () => {
      const burnRequests = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          priority_score: 8.0,
          preferred_date: new Date('2025-08-10T09:00:00Z'),
          time_window_start: 8,
          time_window_end: 16,
          max_dispersion_radius: 7000
        }
      ];

      await optimizerAgent.optimizeSchedule(burnRequests);
      const status = optimizerAgent.getStatus();
      
      expect(status.statistics.totalOptimizations).toBeGreaterThan(0);
      expect(status.statistics.averageScore).toBeGreaterThan(0);
      expect(status.statistics.lastOptimizationTime).toBeDefined();
    });

    test('should detect agent health issues', () => {
      // Simulate various health issues
      const healthChecks = [
        { memory: { heapUsed: 200 * 1024 * 1024 }, expected: 'healthy' },
        { memory: { heapUsed: 800 * 1024 * 1024 }, expected: 'warning' },
        { memory: { heapUsed: 1500 * 1024 * 1024 }, expected: 'critical' }
      ];

      healthChecks.forEach(({ memory, expected }) => {
        const health = optimizerAgent.checkHealth(memory);
        expect(health.status).toBe(expected);
      });
    });

    test('should provide diagnostic information', () => {
      const diagnostics = optimizerAgent.getDiagnostics();
      
      expect(diagnostics).toHaveProperty('memoryUsage');
      expect(diagnostics).toHaveProperty('optimizationQueue');
      expect(diagnostics).toHaveProperty('algorithmState');
      expect(diagnostics).toHaveProperty('performanceMetrics');
      expect(diagnostics.memoryUsage).toHaveProperty('heapUsed');
      expect(diagnostics.optimizationQueue).toHaveProperty('pending');
      expect(diagnostics.algorithmState).toHaveProperty('currentTemperature');
    });
  });

});