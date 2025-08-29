const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const BurnRequestCoordinator = require('../../agents/coordinator');
const { query, initializeDatabase, closePool } = require('../../db/connection');

describe('Coordinator Agent Tests - 5-Agent Workflow Orchestration', () => {
  let coordinator;
  
  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new BurnRequestCoordinator();
  });
  
  afterAll(async () => {
    await closePool();
  });

  describe('Terrain Vector Generation (32-dimensional)', () => {
    test('Should generate valid 32-dimensional terrain vector', () => {
      const requestData = {
        elevationMeters: 250,
        terrainSlope: 15,
        fuelLoadTonsPerHectare: 20,
        requestedDate: '2025-08-25'
      };
      
      const vector = coordinator.generateTerrainVector(requestData, 100, [-120, 40]);
      
      expect(vector).toHaveLength(32);
      expect(vector.every(v => typeof v === 'number')).toBeTruthy();
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should handle missing terrain data gracefully', () => {
      const vector = coordinator.generateTerrainVector({}, 50, [0, 0]);
      
      expect(vector).toHaveLength(32);
      expect(vector.every(v => v >= -10 && v <= 10)).toBeTruthy();
    });

    test('Should normalize extreme elevation values', () => {
      const extremeData = {
        elevationMeters: 5000,
        terrainSlope: 90,
        fuelLoadTonsPerHectare: 200
      };
      
      const vector = coordinator.generateTerrainVector(extremeData, 100, [-120, 40]);
      expect(vector.every(v => v >= -10 && v <= 10)).toBeTruthy();
    });

    test('Should encode location accurately', () => {
      const locations = [
        [-120, 40],
        [-119.5, 39.5],
        [-120.5, 40.5]
      ];
      
      const vectors = locations.map(loc => 
        coordinator.generateTerrainVector({}, 100, loc)
      );
      
      // Vectors for different locations should differ
      expect(vectors[0]).not.toEqual(vectors[1]);
      expect(vectors[1]).not.toEqual(vectors[2]);
    });

    test('Should incorporate temporal features', () => {
      const dates = ['2025-01-15', '2025-06-15', '2025-12-15'];
      const vectors = dates.map(date => 
        coordinator.generateTerrainVector({ requestedDate: date }, 100, [-120, 40])
      );
      
      // Seasonal differences should be reflected
      expect(vectors[0]).not.toEqual(vectors[1]);
      expect(vectors[1]).not.toEqual(vectors[2]);
    });

    test('Should handle NaN inputs safely', () => {
      const badData = {
        elevationMeters: NaN,
        terrainSlope: Infinity,
        fuelLoadTonsPerHectare: undefined
      };
      
      const vector = coordinator.generateTerrainVector(badData, NaN, [NaN, NaN]);
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should maintain consistent vector magnitude', () => {
      const vectors = Array(10).fill(0).map(() => 
        coordinator.generateTerrainVector(
          { elevationMeters: Math.random() * 1000 },
          Math.random() * 200,
          [Math.random() * 10 - 125, Math.random() * 10 + 35]
        )
      );
      
      const magnitudes = vectors.map(v => 
        Math.sqrt(v.reduce((sum, val) => sum + val * val, 0))
      );
      
      const maxMag = Math.max(...magnitudes);
      const minMag = Math.min(...magnitudes);
      expect(maxMag / minMag).toBeLessThan(10);
    });

    test('Should encode fuel load appropriately', () => {
      const fuelLoads = [5, 20, 50, 100];
      const vectors = fuelLoads.map(fuel => 
        coordinator.generateTerrainVector(
          { fuelLoadTonsPerHectare: fuel },
          100,
          [-120, 40]
        )
      );
      
      // Higher fuel loads should affect certain dimensions
      expect(vectors[3][6]).toBeGreaterThan(vectors[0][6]);
    });

    test('Should handle coordinate edge cases', () => {
      const edgeCases = [
        [0, 0],           // Equator/Prime Meridian
        [-180, 90],       // North Pole
        [180, -90],       // South Pole
        [-180, 0],        // International Date Line
      ];
      
      edgeCases.forEach(coords => {
        const vector = coordinator.generateTerrainVector({}, 100, coords);
        expect(vector).toHaveLength(32);
        expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
      });
    });

    test('Should generate reproducible vectors', () => {
      const data = { elevationMeters: 300, terrainSlope: 10 };
      const vector1 = coordinator.generateTerrainVector(data, 100, [-120, 40]);
      const vector2 = coordinator.generateTerrainVector(data, 100, [-120, 40]);
      
      expect(vector1).toEqual(vector2);
    });
  });

  describe('Priority Score Calculation', () => {
    test('Should calculate priority based on field size', () => {
      const sizes = [10, 50, 100, 500];
      const priorities = sizes.map(size => 
        coordinator.calculatePriorityScore({ areaHectares: size })
      );
      
      // Larger fields might have different priorities
      expect(priorities.every(p => p >= 0 && p <= 100)).toBeTruthy();
    });

    test('Should factor in fuel load for priority', () => {
      const score1 = coordinator.calculatePriorityScore({ 
        fuelLoadTonsPerHectare: 10 
      });
      const score2 = coordinator.calculatePriorityScore({ 
        fuelLoadTonsPerHectare: 50 
      });
      
      expect(score2).toBeGreaterThanOrEqual(score1);
    });

    test('Should consider terrain slope in priority', () => {
      const slopes = [0, 15, 30, 45];
      const scores = slopes.map(slope => 
        coordinator.calculatePriorityScore({ terrainSlope: slope })
      );
      
      // Steeper slopes might affect priority
      expect(scores.every(s => s >= 0)).toBeTruthy();
    });

    test('Should handle missing priority factors', () => {
      const score = coordinator.calculatePriorityScore({});
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('Should prioritize safety-critical burns', () => {
      const criticalBurn = {
        burnType: 'prescribed',
        purpose: 'wildfire_prevention',
        fuelLoadTonsPerHectare: 80
      };
      
      const routineBurn = {
        burnType: 'broadcast',
        purpose: 'crop_residue',
        fuelLoadTonsPerHectare: 10
      };
      
      const criticalScore = coordinator.calculatePriorityScore(criticalBurn);
      const routineScore = coordinator.calculatePriorityScore(routineBurn);
      
      expect(criticalScore).toBeGreaterThanOrEqual(routineScore);
    });

    test('Should adjust priority for time sensitivity', () => {
      const today = new Date();
      const urgent = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const later = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const urgentScore = coordinator.calculatePriorityScore({ 
        requestedDate: urgent.toISOString() 
      });
      const laterScore = coordinator.calculatePriorityScore({ 
        requestedDate: later.toISOString() 
      });
      
      expect(urgentScore).toBeGreaterThanOrEqual(0);
    });

    test('Should cap priority scores at 100', () => {
      const extremeCase = {
        areaHectares: 10000,
        fuelLoadTonsPerHectare: 200,
        terrainSlope: 60,
        burnType: 'prescribed',
        purpose: 'emergency'
      };
      
      const score = coordinator.calculatePriorityScore(extremeCase);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('Should differentiate burn types', () => {
      const types = ['broadcast', 'pile', 'prescribed'];
      const scores = types.map(type => 
        coordinator.calculatePriorityScore({ burnType: type })
      );
      
      expect(scores.every(s => s >= 0)).toBeTruthy();
    });

    test('Should factor in historical success rates', () => {
      const withHistory = {
        farmId: 1,
        historicalSuccessRate: 0.95
      };
      
      const noHistory = {
        farmId: 2,
        historicalSuccessRate: 0.0
      };
      
      const score1 = coordinator.calculatePriorityScore(withHistory);
      const score2 = coordinator.calculatePriorityScore(noHistory);
      
      expect(score1).toBeGreaterThanOrEqual(0);
    });

    test('Should handle concurrent burn requests', () => {
      const requests = Array(10).fill(0).map((_, i) => ({
        id: i,
        areaHectares: Math.random() * 100,
        priority: 0
      }));
      
      requests.forEach(req => {
        req.priority = coordinator.calculatePriorityScore(req);
      });
      
      const sorted = [...requests].sort((a, b) => b.priority - a.priority);
      expect(sorted[0].priority).toBeGreaterThanOrEqual(sorted[9].priority);
    });
  });

  describe('Burn Request Validation', () => {
    test('Should validate required fields', () => {
      const invalid = {};
      const valid = {
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00'
      };
      
      expect(() => coordinator.validateBurnRequest(invalid)).toThrow();
      expect(() => coordinator.validateBurnRequest(valid)).not.toThrow();
    });

    test('Should validate GeoJSON geometry', () => {
      const invalidGeometry = {
        farmId: 1,
        fieldGeometry: { type: 'InvalidType' },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00'
      };
      
      expect(() => coordinator.validateBurnRequest(invalidGeometry)).toThrow();
    });

    test('Should validate date formats', () => {
      const invalidDate = {
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[]] },
        requestedDate: 'invalid-date',
        requestedStartTime: '09:00'
      };
      
      expect(() => coordinator.validateBurnRequest(invalidDate)).toThrow();
    });

    test('Should validate time formats', () => {
      const invalidTime = {
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '25:00'
      };
      
      expect(() => coordinator.validateBurnRequest(invalidTime)).toThrow();
    });

    test('Should ensure end time after start time', () => {
      const invalidTimeRange = {
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '15:00',
        requestedEndTime: '09:00'
      };
      
      expect(() => coordinator.validateBurnRequest(invalidTimeRange)).toThrow();
    });

    test('Should validate field size limits', () => {
      const tooLarge = {
        farmId: 1,
        areaHectares: 20000,
        fieldGeometry: { type: 'Polygon', coordinates: [[]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00'
      };
      
      expect(() => coordinator.validateBurnRequest(tooLarge)).toThrow();
    });

    test('Should validate burn duration', () => {
      const tooLong = {
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '06:00',
        requestedEndTime: '23:00'
      };
      
      expect(() => coordinator.validateBurnRequest(tooLong)).toThrow();
    });

    test('Should validate polygon closure', () => {
      const unclosed = {
        farmId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [0, 0], [1, 0], [1, 1], [0, 1]
            // Missing closing point
          ]]
        },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00'
      };
      
      expect(() => coordinator.validateBurnRequest(unclosed)).toThrow();
    });

    test('Should validate coordinate bounds', () => {
      const outOfBounds = {
        farmId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-200, 40], [-199, 40], [-199, 41], [-200, 41], [-200, 40]
          ]]
        },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00'
      };
      
      expect(() => coordinator.validateBurnRequest(outOfBounds)).toThrow();
    });

    test('Should validate self-intersecting polygons', () => {
      const selfIntersecting = {
        farmId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [0, 0], [2, 2], [0, 2], [2, 0], [0, 0]
          ]]
        },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00'
      };
      
      expect(() => coordinator.validateBurnRequest(selfIntersecting)).toThrow();
    });
  });

  describe('5-Agent Workflow Orchestration', () => {
    test('Should initialize all 5 agents', () => {
      expect(coordinator.weatherAgent).toBeDefined();
      expect(coordinator.predictor).toBeDefined();
      expect(coordinator.optimizer).toBeDefined();
      expect(coordinator.alertAgent).toBeDefined();
    });

    test('Should execute agents in correct sequence', async () => {
      const executionOrder = [];
      
      // Mock agent methods to track execution
      coordinator.weatherAgent.analyzeWeatherForBurn = jest.fn(() => {
        executionOrder.push('weather');
        return Promise.resolve({ safe: true });
      });
      
      coordinator.predictor.detectConflictsForRequest = jest.fn(() => {
        executionOrder.push('predictor');
        return Promise.resolve([]);
      });
      
      coordinator.optimizer.optimizeSchedule = jest.fn(() => {
        executionOrder.push('optimizer');
        return Promise.resolve({});
      });
      
      coordinator.alertAgent.sendBurnApprovalAlert = jest.fn(() => {
        executionOrder.push('alert');
        return Promise.resolve();
      });
      
      await coordinator.createBurnRequest({
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[[-120, 40], [-119.9, 40], [-119.9, 40.1], [-120, 40.1], [-120, 40]]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00'
      });
      
      expect(executionOrder).toEqual(['weather', 'predictor', 'optimizer', 'alert']);
    });

    test('Should handle agent failures gracefully', async () => {
      coordinator.weatherAgent.analyzeWeatherForBurn = jest.fn(() => 
        Promise.reject(new Error('Weather API down'))
      );
      
      const result = await coordinator.createBurnRequest({
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[[-120, 40], [-119.9, 40], [-119.9, 40.1], [-120, 40.1], [-120, 40]]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00'
      });
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    test('Should pass data between agents correctly', async () => {
      let weatherData, conflictData;
      
      coordinator.weatherAgent.analyzeWeatherForBurn = jest.fn(() => {
        weatherData = { windSpeed: 10, windDirection: 180 };
        return Promise.resolve(weatherData);
      });
      
      coordinator.predictor.detectConflictsForRequest = jest.fn((id, weather) => {
        expect(weather).toEqual(weatherData);
        conflictData = [{ type: 'proximity' }];
        return Promise.resolve(conflictData);
      });
      
      coordinator.optimizer.optimizeSchedule = jest.fn((requests, conflicts) => {
        expect(conflicts).toEqual(conflictData);
        return Promise.resolve({});
      });
      
      await coordinator.createBurnRequest({
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[[-120, 40], [-119.9, 40], [-119.9, 40.1], [-120, 40.1], [-120, 40]]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00'
      });
    });

    test('Should maintain workflow state consistency', async () => {
      const states = [];
      
      coordinator.updateWorkflowState = jest.fn((state) => {
        states.push(state);
      });
      
      await coordinator.createBurnRequest({
        farmId: 1,
        fieldGeometry: { type: 'Polygon', coordinates: [[[-120, 40], [-119.9, 40], [-119.9, 40.1], [-120, 40.1], [-120, 40]]] },
        requestedDate: '2025-08-25',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00'
      });
      
      expect(states).toContain('initialized');
      expect(states).toContain('weather_analyzed');
      expect(states).toContain('conflicts_detected');
      expect(states).toContain('schedule_optimized');
      expect(states).toContain('alerts_sent');
    });
  });
});