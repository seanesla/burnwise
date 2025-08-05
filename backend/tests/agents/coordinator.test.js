const coordinatorAgent = require('../../agents/coordinator');
const { query } = require('../../db/connection');
const logger = require('../../middleware/logger');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');
jest.mock('axios');

describe('Coordinator Agent Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    coordinatorAgent.initialized = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization Tests', () => {
    test('should initialize successfully with valid configuration', async () => {
      coordinatorAgent.initialized = false;
      query.mockResolvedValue([{ count: 5 }]);
      
      await coordinatorAgent.initialize();
      
      expect(coordinatorAgent.initialized).toBe(true);
      expect(logger.agent).toHaveBeenCalledWith(
        'coordinator', 'info', 'Coordinator Agent initialized successfully'
      );
    });

    test('should handle initialization failure gracefully', async () => {
      coordinatorAgent.initialized = false;
      query.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(coordinatorAgent.initialize()).rejects.toThrow('Database connection failed');
      expect(coordinatorAgent.initialized).toBe(false);
    });

    test('should load validation rules during initialization', async () => {
      coordinatorAgent.initialized = false;
      query.mockResolvedValue([{ count: 5 }]);
      
      await coordinatorAgent.initialize();
      
      expect(coordinatorAgent.validationRules).toBeDefined();
      expect(coordinatorAgent.validationRules.burnRequest).toBeDefined();
    });

    test('should set up OpenAI client when API key is available', async () => {
      const originalApiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      coordinatorAgent.initialized = false;
      query.mockResolvedValue([{ count: 5 }]);
      
      await coordinatorAgent.initialize();
      
      expect(coordinatorAgent.openaiClient).toBeDefined();
      
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    test('should handle missing OpenAI API key gracefully', async () => {
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      coordinatorAgent.initialized = false;
      query.mockResolvedValue([{ count: 5 }]);
      
      await coordinatorAgent.initialize();
      
      expect(coordinatorAgent.openaiClient).toBeNull();
      expect(logger.agent).toHaveBeenCalledWith(
        'coordinator', 'warn', 'OpenAI API key not configured - using fallback embeddings'
      );
      
      process.env.OPENAI_API_KEY = originalApiKey;
    });
  });

  describe('Burn Request Validation Tests', () => {
    test('should validate required fields successfully', async () => {
      const validRequest = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(validRequest);

      expect(result.success).toBe(true);
      expect(result.burnRequestId).toBe(123);
      expect(result.priorityScore).toBeGreaterThan(0);
    });

    test('should reject request with missing required fields', async () => {
      const invalidRequest = {
        farm_id: 1,
        field_name: 'North Field'
        // Missing required fields
      };

      await expect(coordinatorAgent.coordinateBurnRequest(invalidRequest))
        .rejects.toThrow('Missing required field');
    });

    test('should reject request with invalid farm_id', async () => {
      const invalidRequest = {
        farm_id: 999,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([]); // Farm doesn't exist

      await expect(coordinatorAgent.coordinateBurnRequest(invalidRequest))
        .rejects.toThrow('Farm not found');
    });

    test('should reject request with past burn date', async () => {
      const invalidRequest = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2024-01-01',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists

      await expect(coordinatorAgent.coordinateBurnRequest(invalidRequest))
        .rejects.toThrow('Burn date cannot be in the past');
    });

    test('should reject request with invalid time window', async () => {
      const invalidRequest = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '16:00',
        time_window_end: '08:00', // End before start
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists

      await expect(coordinatorAgent.coordinateBurnRequest(invalidRequest))
        .rejects.toThrow('Time window end must be after start');
    });

    test('should validate field boundary GeoJSON format', async () => {
      const invalidRequest = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'InvalidGeometry',
          coordinates: []
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists

      await expect(coordinatorAgent.coordinateBurnRequest(invalidRequest))
        .rejects.toThrow('Invalid field boundary geometry');
    });

    test('should validate minimum and maximum acres', async () => {
      const tooSmallRequest = {
        farm_id: 1,
        field_name: 'Tiny Field',
        acres: 0.5, // Below minimum
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists

      await expect(coordinatorAgent.coordinateBurnRequest(tooSmallRequest))
        .rejects.toThrow('Burn area must be between 1 and 500 acres');
    });

    test('should validate crop type against allowed list', async () => {
      const invalidCropRequest = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'invalid_crop',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists

      await expect(coordinatorAgent.coordinateBurnRequest(invalidCropRequest))
        .rejects.toThrow('Invalid crop type');
    });
  });

  describe('Priority Scoring Tests', () => {
    test('should calculate priority score correctly for high-priority burn', async () => {
      const highPriorityBurn = {
        acres: 100,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        urgency_level: 'high'
      };

      const score = await coordinatorAgent.calculatePriorityScore(highPriorityBurn, []);

      expect(score).toBeGreaterThan(7);
      expect(score).toBeLessThanOrEqual(10);
    });

    test('should calculate priority score correctly for low-priority burn', async () => {
      const lowPriorityBurn = {
        acres: 5,
        crop_type: 'wheat',
        burn_date: '2025-12-01',
        time_window_start: '10:00',
        time_window_end: '14:00',
        urgency_level: 'low'
      };

      const score = await coordinatorAgent.calculatePriorityScore(lowPriorityBurn, []);

      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThan(5);
    });

    test('should increase priority based on crop type', async () => {
      const riceRequest = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00'
      };

      const wheatRequest = {
        ...riceRequest,
        crop_type: 'wheat'
      };

      const riceScore = await coordinatorAgent.calculatePriorityScore(riceRequest, []);
      const wheatScore = await coordinatorAgent.calculatePriorityScore(wheatRequest, []);

      expect(riceScore).toBeGreaterThan(wheatScore);
    });

    test('should increase priority for larger burn areas', async () => {
      const largeBurn = {
        acres: 100,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00'
      };

      const smallBurn = {
        ...largeBurn,
        acres: 10
      };

      const largeScore = await coordinatorAgent.calculatePriorityScore(largeBurn, []);
      const smallScore = await coordinatorAgent.calculatePriorityScore(smallBurn, []);

      expect(largeScore).toBeGreaterThan(smallScore);
    });

    test('should adjust priority based on seasonal factors', async () => {
      const fallBurn = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-10-15', // Fall - optimal burn season
        time_window_start: '08:00',
        time_window_end: '16:00'
      };

      const summerBurn = {
        ...fallBurn,
        burn_date: '2025-07-15' // Summer - less optimal
      };

      const fallScore = await coordinatorAgent.calculatePriorityScore(fallBurn, []);
      const summerScore = await coordinatorAgent.calculatePriorityScore(summerBurn, []);

      expect(fallScore).toBeGreaterThan(summerScore);
    });

    test('should consider existing burn density in area', async () => {
      const existingBurns = [
        { id: 1, acres: 50, burn_date: '2025-08-10', distance: 2000 },
        { id: 2, acres: 30, burn_date: '2025-08-10', distance: 3000 }
      ];

      const newBurn = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00'
      };

      const priorityWithCompetition = await coordinatorAgent.calculatePriorityScore(newBurn, existingBurns);
      const priorityWithoutCompetition = await coordinatorAgent.calculatePriorityScore(newBurn, []);

      expect(priorityWithCompetition).toBeLessThan(priorityWithoutCompetition);
    });
  });

  describe('Burn Vector Generation Tests', () => {
    test('should generate 32-dimensional burn vector', async () => {
      const burnData = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const vector = await coordinatorAgent.generateBurnVector(burnData, 7.5);

      expect(vector).toHaveLength(32);
      expect(vector.every(val => typeof val === 'number')).toBe(true);
      expect(vector.every(val => val >= -1 && val <= 1)).toBe(true);
    });

    test('should encode crop type correctly in vector', async () => {
      const riceData = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const wheatData = { ...riceData, crop_type: 'wheat' };

      const riceVector = await coordinatorAgent.generateBurnVector(riceData, 7.5);
      const wheatVector = await coordinatorAgent.generateBurnVector(wheatData, 7.5);

      // Crop type is encoded in dimensions 5-12
      const riceCropSection = riceVector.slice(5, 13);
      const wheatCropSection = wheatVector.slice(5, 13);

      expect(riceCropSection).not.toEqual(wheatCropSection);
    });

    test('should handle field geometry complexity in vector', async () => {
      const simpleField = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const complexField = {
        ...simpleField,
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[
            [-121.5, 38.5], [-121.45, 38.52], [-121.42, 38.55], [-121.4, 38.6],
            [-121.48, 38.58], [-121.5, 38.6], [-121.5, 38.5]
          ]]]
        }
      };

      const simpleVector = await coordinatorAgent.generateBurnVector(simpleField, 7.5);
      const complexVector = await coordinatorAgent.generateBurnVector(complexField, 7.5);

      // Geometry complexity should be reflected in the vector
      expect(complexVector[15]).toBeGreaterThan(simpleVector[15]); // Complexity factor
    });

    test('should normalize vector magnitude to unit length', async () => {
      const burnData = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const vector = await coordinatorAgent.generateBurnVector(burnData, 7.5);
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

      expect(magnitude).toBeCloseTo(1, 2);
    });

    test('should handle OpenAI embedding integration', async () => {
      // Mock OpenAI response
      const mockEmbedding = new Array(1536).fill(0.1);
      coordinatorAgent.openaiClient = {
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [{ embedding: mockEmbedding }]
          })
        }
      };

      const burnData = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const vector = await coordinatorAgent.generateBurnVector(burnData, 7.5);

      expect(coordinatorAgent.openaiClient.embeddings.create).toHaveBeenCalled();
      expect(vector).toHaveLength(32);
    });

    test('should fall back to local embeddings when OpenAI fails', async () => {
      coordinatorAgent.openaiClient = {
        embeddings: {
          create: jest.fn().mockRejectedValue(new Error('API rate limit exceeded'))
        }
      };

      const burnData = {
        acres: 25,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const vector = await coordinatorAgent.generateBurnVector(burnData, 7.5);

      expect(vector).toHaveLength(32);
      expect(logger.agent).toHaveBeenCalledWith(
        'coordinator', 'warn', expect.stringContaining('OpenAI embedding failed')
      );
    });
  });

  describe('Field Geometry Processing Tests', () => {
    test('should calculate field area correctly for simple polygon', async () => {
      const fieldBoundary = {
        type: 'Polygon',
        coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
      };

      const area = coordinatorAgent.calculateFieldArea(fieldBoundary);

      expect(area).toBeGreaterThan(0);
      expect(typeof area).toBe('number');
    });

    test('should calculate centroid correctly', async () => {
      const fieldBoundary = {
        type: 'Polygon',
        coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
      };

      const centroid = coordinatorAgent.calculateFieldCentroid(fieldBoundary);

      expect(centroid).toHaveProperty('lat');
      expect(centroid).toHaveProperty('lon');
      expect(centroid.lat).toBeCloseTo(38.55, 2);
      expect(centroid.lon).toBeCloseTo(-121.45, 2);
    });

    test('should detect field shape complexity', async () => {
      const simpleSquare = {
        type: 'Polygon',
        coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
      };

      const complexShape = {
        type: 'Polygon',
        coordinates: [[[
          [-121.5, 38.5], [-121.45, 38.52], [-121.42, 38.55], [-121.4, 38.6],
          [-121.48, 38.58], [-121.5, 38.6], [-121.5, 38.5]
        ]]]
      };

      const simpleComplexity = coordinatorAgent.calculateGeometryComplexity(simpleSquare);
      const complexComplexity = coordinatorAgent.calculateGeometryComplexity(complexShape);

      expect(complexComplexity).toBeGreaterThan(simpleComplexity);
    });

    test('should handle invalid geometry gracefully', async () => {
      const invalidGeometry = {
        type: 'Polygon',
        coordinates: [[]] // Empty coordinates
      };

      expect(() => coordinatorAgent.calculateFieldArea(invalidGeometry)).not.toThrow();
      expect(() => coordinatorAgent.calculateFieldCentroid(invalidGeometry)).not.toThrow();
    });
  });

  describe('Similar Burn Detection Tests', () => {
    test('should find similar burns using vector search', async () => {
      const burnVector = new Array(32).fill(0.1);
      const mockSimilarBurns = [
        { id: 1, similarity_score: 0.95, acres: 24, crop_type: 'rice' },
        { id: 2, similarity_score: 0.87, acres: 28, crop_type: 'rice' }
      ];

      // Mock vector similarity search
      const { vectorSimilaritySearch } = require('../../db/connection');
      vectorSimilaritySearch.mockResolvedValue(mockSimilarBurns);

      const similarBurns = await coordinatorAgent.findSimilarBurns(burnVector);

      expect(similarBurns).toHaveLength(2);
      expect(similarBurns[0].similarity_score).toBeGreaterThan(0.9);
      expect(vectorSimilaritySearch).toHaveBeenCalledWith(
        'burn_requests', 'burn_vector', burnVector, 10, 0.7
      );
    });

    test('should handle vector search failures gracefully', async () => {
      const burnVector = new Array(32).fill(0.1);
      
      const { vectorSimilaritySearch } = require('../../db/connection');
      vectorSimilaritySearch.mockRejectedValue(new Error('Vector search failed'));

      const similarBurns = await coordinatorAgent.findSimilarBurns(burnVector);

      expect(similarBurns).toEqual([]);
      expect(logger.agent).toHaveBeenCalledWith(
        'coordinator', 'warn', expect.stringContaining('Similar burn search failed')
      );
    });

    test('should filter similar burns by relevance threshold', async () => {
      const burnVector = new Array(32).fill(0.1);
      const mockResults = [
        { id: 1, similarity_score: 0.95 },
        { id: 2, similarity_score: 0.85 },
        { id: 3, similarity_score: 0.65 }, // Below threshold
        { id: 4, similarity_score: 0.55 }  // Below threshold
      ];

      const { vectorSimilaritySearch } = require('../../db/connection');
      vectorSimilaritySearch.mockResolvedValue(mockResults);

      const similarBurns = await coordinatorAgent.findSimilarBurns(burnVector, 0.8);

      expect(similarBurns).toHaveLength(2);
      expect(similarBurns.every(burn => burn.similarity_score >= 0.8)).toBe(true);
    });
  });

  describe('Database Integration Tests', () => {
    test('should store burn request successfully', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const priorityScore = 7.5;
      const burnVector = new Array(32).fill(0.1);

      query.mockResolvedValueOnce({ insertId: 123 });

      const burnRequestId = await coordinatorAgent.storeBurnRequest(burnData, priorityScore, burnVector);

      expect(burnRequestId).toBe(123);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO burn_requests'),
        expect.arrayContaining([
          burnData.farm_id,
          burnData.field_name,
          burnData.acres,
          burnData.crop_type,
          burnData.burn_date,
          burnData.time_window_start,
          burnData.time_window_end,
          expect.any(String), // GeoJSON string
          priorityScore,
          'pending',
          JSON.stringify(burnVector)
        ])
      );
    });

    test('should handle database insertion errors', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockRejectedValue(new Error('Database constraint violation'));

      await expect(coordinatorAgent.storeBurnRequest(burnData, 7.5, []))
        .rejects.toThrow('Failed to store burn request');
    });

    test('should verify farm existence before processing', async () => {
      const burnData = {
        farm_id: 999,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([]); // No farm found

      await expect(coordinatorAgent.coordinateBurnRequest(burnData))
        .rejects.toThrow('Farm not found');
    });
  });

  describe('Error Handling Tests', () => {
    test('should throw AgentError when not initialized', async () => {
      coordinatorAgent.initialized = false;

      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      await expect(coordinatorAgent.coordinateBurnRequest(burnData))
        .rejects.toThrow('Agent not initialized');
    });

    test('should handle validation errors with specific field information', async () => {
      const burnData = {
        farm_id: 'invalid', // Should be number
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      try {
        await coordinatorAgent.coordinateBurnRequest(burnData);
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('farm_id');
        expect(error.field).toBe('farm_id');
      }
    });

    test('should log all coordination attempts', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      await coordinatorAgent.coordinateBurnRequest(burnData);

      expect(logger.agent).toHaveBeenCalledWith(
        'coordinator', 'info', 'Coordinating burn request', expect.any(Object)
      );
    });
  });

  describe('Time Window Processing Tests', () => {
    test('should parse time window correctly', () => {
      const timeWindow = {
        start: '08:30',
        end: '16:45'
      };

      const parsed = coordinatorAgent.parseTimeWindow(timeWindow);

      expect(parsed.startHours).toBeCloseTo(8.5, 1);
      expect(parsed.endHours).toBeCloseTo(16.75, 1);
      expect(parsed.duration).toBeCloseTo(8.25, 1);
    });

    test('should validate time window duration', () => {
      const shortWindow = { start: '08:00', end: '08:30' }; // 30 minutes
      const longWindow = { start: '06:00', end: '20:00' };   // 14 hours

      expect(() => coordinatorAgent.validateTimeWindow(shortWindow))
        .toThrow('Time window must be at least 1 hour');
      expect(() => coordinatorAgent.validateTimeWindow(longWindow))
        .toThrow('Time window cannot exceed 12 hours');
    });

    test('should handle edge cases in time parsing', () => {
      expect(() => coordinatorAgent.parseTimeWindow({ start: '25:00', end: '16:00' }))
        .toThrow('Invalid time format');
      expect(() => coordinatorAgent.parseTimeWindow({ start: '08:60', end: '16:00' }))
        .toThrow('Invalid time format');
    });
  });

  describe('Seasonal Factor Tests', () => {
    test('should apply correct seasonal multipliers', () => {
      const springDate = new Date('2025-04-15');
      const summerDate = new Date('2025-07-15');
      const fallDate = new Date('2025-10-15');
      const winterDate = new Date('2025-01-15');

      const springFactor = coordinatorAgent.calculateSeasonalFactor(springDate);
      const summerFactor = coordinatorAgent.calculateSeasonalFactor(summerDate);
      const fallFactor = coordinatorAgent.calculateSeasonalFactor(fallDate);
      const winterFactor = coordinatorAgent.calculateSeasonalFactor(winterDate);

      expect(fallFactor).toBeGreaterThan(summerFactor); // Fall is optimal
      expect(springFactor).toBeGreaterThan(winterDate); // Spring better than winter
    });

    test('should consider crop-specific burn seasons', () => {
      const riceInFall = {
        crop_type: 'rice',
        burn_date: new Date('2025-10-15')
      };

      const wheatInSpring = {
        crop_type: 'wheat',
        burn_date: new Date('2025-05-15')
      };

      const riceFactor = coordinatorAgent.calculateCropSeasonalFactor(riceInFall);
      const wheatFactor = coordinatorAgent.calculateCropSeasonalFactor(wheatInSpring);

      expect(riceFactor).toBeGreaterThan(0.8); // Rice optimal in fall
      expect(wheatFactor).toBeGreaterThan(0.7); // Wheat good in spring
    });
  });

  describe('Competition Analysis Tests', () => {
    test('should calculate competition factor based on nearby burns', () => {
      const nearbyBurns = [
        { acres: 50, distance: 2000, burn_date: '2025-08-10' },
        { acres: 30, distance: 4000, burn_date: '2025-08-10' },
        { acres: 20, distance: 6000, burn_date: '2025-08-11' }
      ];

      const competitionFactor = coordinatorAgent.calculateCompetitionFactor(nearbyBurns, '2025-08-10');

      expect(competitionFactor).toBeLessThan(1); // Should reduce priority
      expect(competitionFactor).toBeGreaterThan(0);
    });

    test('should consider distance in competition calculation', () => {
      const closeCompetition = [
        { acres: 50, distance: 1000, burn_date: '2025-08-10' }
      ];

      const farCompetition = [
        { acres: 50, distance: 8000, burn_date: '2025-08-10' }
      ];

      const closeFactor = coordinatorAgent.calculateCompetitionFactor(closeCompetition, '2025-08-10');
      const farFactor = coordinatorAgent.calculateCompetitionFactor(farCompetition, '2025-08-10');

      expect(closeFactor).toBeLessThan(farFactor);
    });
  });

  describe('Status Management Tests', () => {
    test('should return comprehensive agent status', async () => {
      query.mockResolvedValueOnce([{
        total_requests: 150,
        pending: 25,
        approved: 75,
        completed: 45,
        avg_priority: 6.8
      }]);

      const status = await coordinatorAgent.getStatus();

      expect(status.status).toBe('active');
      expect(status.agent).toBe('coordinator');
      expect(status.initialized).toBe(true);
      expect(status.database).toBeDefined();
    });

    test('should handle status check errors', async () => {
      query.mockRejectedValue(new Error('Database unavailable'));

      const status = await coordinatorAgent.getStatus();

      expect(status.status).toBe('error');
      expect(status.error).toContain('Database unavailable');
    });
  });

  describe('Performance Tests', () => {
    test('should complete coordination within reasonable time', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const startTime = Date.now();
      await coordinatorAgent.coordinateBurnRequest(burnData);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle high load scenarios', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        farm_id: i + 1,
        field_name: `Field ${i + 1}`,
        acres: 25 + i,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5 - i*0.01, 38.5], [-121.4 - i*0.01, 38.5], [-121.4 - i*0.01, 38.6], [-121.5 - i*0.01, 38.6], [-121.5 - i*0.01, 38.5]]]
        }
      }));

      // Mock database responses for all requests
      query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT')) {
          return Promise.resolve([{ id: params[0] }]); // Farm exists
        } else if (sql.includes('INSERT')) {
          return Promise.resolve({ insertId: Math.floor(Math.random() * 1000) + 100 });
        }
        return Promise.resolve([]);
      });

      const startTime = Date.now();
      const promises = requests.map(req => coordinatorAgent.coordinateBurnRequest(req));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(15000); // Should handle 10 requests within 15 seconds
    });
  });

  describe('Edge Cases and Boundary Tests', () => {
    test('should handle minimum valid burn request', async () => {
      const minimalRequest = {
        farm_id: 1,
        field_name: 'A', // Single character
        acres: 1, // Minimum acres
        crop_type: 'rice',
        burn_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
        time_window_start: '06:00',
        time_window_end: '07:00', // Minimum 1 hour window
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.499, 38.5], [-121.499, 38.501], [-121.5, 38.501], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(minimalRequest);

      expect(result.success).toBe(true);
    });

    test('should handle maximum valid burn request', async () => {
      const maximalRequest = {
        farm_id: 1,
        field_name: 'A'.repeat(200), // Maximum length
        acres: 500, // Maximum acres
        crop_type: 'rice',
        burn_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
        time_window_start: '06:00',
        time_window_end: '18:00', // Maximum 12 hour window
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.0, 38.5], [-121.0, 39.0], [-121.5, 39.0], [-121.5, 38.5]]] // Large field
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(maximalRequest);

      expect(result.success).toBe(true);
    });

    test('should handle special characters in field names', async () => {
      const specialNameRequest = {
        farm_id: 1,
        field_name: "O'Connor's Field #1 (East)", // Special characters
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(specialNameRequest);

      expect(result.success).toBe(true);
    });

    test('should handle complex polygon geometries', async () => {
      const complexRequest = {
        farm_id: 1,
        field_name: 'Complex Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [
            [
              [-121.5, 38.5], [-121.45, 38.52], [-121.42, 38.55], [-121.4, 38.6],
              [-121.38, 38.58], [-121.35, 38.55], [-121.37, 38.52], [-121.4, 38.5],
              [-121.45, 38.48], [-121.48, 38.49], [-121.5, 38.5]
            ],
            // Hole in polygon
            [
              [-121.46, 38.52], [-121.44, 38.52], [-121.44, 38.54], [-121.46, 38.54], [-121.46, 38.52]
            ]
          ]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(complexRequest);

      expect(result.success).toBe(true);
    });
  });

  describe('Concurrency and Thread Safety Tests', () => {
    test('should handle concurrent requests safely', async () => {
      const baseRequest = {
        field_name: 'Test Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const requests = Array.from({ length: 5 }, (_, i) => ({
        ...baseRequest,
        farm_id: i + 1,
        field_name: `Field ${i + 1}`
      }));

      // Mock responses
      query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT') && sql.includes('farms')) {
          return Promise.resolve([{ id: params[0] }]);
        } else if (sql.includes('INSERT')) {
          return Promise.resolve({ insertId: Math.floor(Math.random() * 1000) + 100 });
        }
        return Promise.resolve([]);
      });

      const promises = requests.map(req => coordinatorAgent.coordinateBurnRequest(req));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      
      // Check that all burn request IDs are unique
      const burnIds = results.map(r => r.burnRequestId);
      const uniqueIds = [...new Set(burnIds)];
      expect(uniqueIds).toHaveLength(5);
    });
  });

  describe('Integration with Vector Search Tests', () => {
    test('should perform vector similarity search correctly', async () => {
      const burnVector = new Array(32).fill(0.1);
      const mockSimilarResults = [
        { id: 1, similarity_score: 0.95, acres: 24, crop_type: 'rice' },
        { id: 2, similarity_score: 0.87, acres: 28, crop_type: 'rice' }
      ];

      const { vectorSimilaritySearch } = require('../../db/connection');
      vectorSimilaritySearch.mockResolvedValue(mockSimilarResults);

      const results = await coordinatorAgent.findSimilarBurns(burnVector, 0.8);

      expect(results).toEqual(mockSimilarResults);
      expect(vectorSimilaritySearch).toHaveBeenCalledWith(
        'burn_requests', 'burn_vector', burnVector, 10, 0.8
      );
    });

    test('should log vector operations for monitoring', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      const vector = await coordinatorAgent.generateBurnVector(burnData, 7.5);

      expect(logger.vector).toHaveBeenCalledWith(
        'burn_vector_generation', 'burn_characteristics', 32,
        expect.objectContaining({
          acres: 25.5,
          cropType: 'rice'
        })
      );
    });
  });

  describe('Data Consistency Tests', () => {
    test('should maintain data consistency between operations', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(burnData);

      // Verify that the same data used for validation is stored
      const insertCall = query.mock.calls.find(call => call[0].includes('INSERT INTO burn_requests'));
      expect(insertCall[1]).toContain(burnData.farm_id);
      expect(insertCall[1]).toContain(burnData.field_name);
      expect(insertCall[1]).toContain(burnData.acres);
    });
  });

  describe('Logging and Monitoring Tests', () => {
    test('should log performance metrics for each operation', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      await coordinatorAgent.coordinateBurnRequest(burnData);

      expect(logger.performance).toHaveBeenCalledWith(
        'burn_coordination', expect.any(Number), expect.any(Object)
      );
    });

    test('should log errors with sufficient context', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'North Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockRejectedValueOnce(new Error('Database error'));

      try {
        await coordinatorAgent.coordinateBurnRequest(burnData);
        fail('Should have thrown error');
      } catch (error) {
        expect(logger.agent).toHaveBeenCalledWith(
          'coordinator', 'error', 'Burn coordination failed',
          expect.objectContaining({
            error: 'Database error',
            duration: expect.any(Number)
          })
        );
      }
    });
  });

  describe('Memory Management Tests', () => {
    test('should not leak memory during vector operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const burnData = {
        farm_id: 1,
        field_name: 'Memory Test Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      // Perform many vector operations
      for (let i = 0; i < 100; i++) {
        await coordinatorAgent.generateBurnVector(burnData, 7.5);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Security Tests', () => {
    test('should sanitize field names to prevent injection', async () => {
      const maliciousRequest = {
        farm_id: 1,
        field_name: "'; DROP TABLE burn_requests; --",
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(maliciousRequest);

      expect(result.success).toBe(true);
      // Field name should be sanitized but stored safely
      const insertCall = query.mock.calls.find(call => call[0].includes('INSERT INTO burn_requests'));
      expect(insertCall[1]).toContain(maliciousRequest.field_name); // Should be safely parameterized
    });

    test('should validate and sanitize GeoJSON input', async () => {
      const maliciousGeoJSON = {
        farm_id: 1,
        field_name: 'Test Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5]]],
          malicious_field: '<script>alert("xss")</script>'
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists

      await expect(coordinatorAgent.coordinateBurnRequest(maliciousGeoJSON))
        .rejects.toThrow('Invalid field boundary geometry');
    });
  });

  describe('Regression Tests', () => {
    test('should maintain backward compatibility with legacy burn requests', async () => {
      const legacyRequest = {
        farm_id: 1,
        field_name: 'Legacy Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        },
        legacy_field: 'should_be_ignored'
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockResolvedValueOnce({ insertId: 123 }); // Insert burn request
      query.mockResolvedValueOnce([]); // No similar burns

      const result = await coordinatorAgent.coordinateBurnRequest(legacyRequest);

      expect(result.success).toBe(true);
    });

    test('should handle database schema changes gracefully', async () => {
      const burnData = {
        farm_id: 1,
        field_name: 'Schema Test Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      query.mockResolvedValueOnce([{ id: 1 }]); // Farm exists
      query.mockRejectedValueOnce(new Error("Unknown column 'new_field' in 'field list'"));

      try {
        await coordinatorAgent.coordinateBurnRequest(burnData);
      } catch (error) {
        expect(error.message).toContain('Failed to store burn request');
      }
    });
  });

  describe('Load Testing Scenarios', () => {
    test('should maintain performance under sustained load', async () => {
      const baseRequest = {
        field_name: 'Load Test Field',
        acres: 25.5,
        crop_type: 'rice',
        burn_date: '2025-08-10',
        time_window_start: '08:00',
        time_window_end: '16:00',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-121.5, 38.5], [-121.4, 38.5], [-121.4, 38.6], [-121.5, 38.6], [-121.5, 38.5]]]
        }
      };

      // Mock fast database responses
      query.mockImplementation((sql, params) => {
        return new Promise(resolve => {
          setTimeout(() => {
            if (sql.includes('SELECT')) {
              resolve([{ id: params[0] || 1 }]);
            } else if (sql.includes('INSERT')) {
              resolve({ insertId: Math.floor(Math.random() * 1000) + 100 });
            } else {
              resolve([]);
            }
          }, Math.random() * 50); // Random delay 0-50ms
        });
      });

      const startTime = Date.now();
      const promises = [];

      // Submit 50 requests in batches
      for (let batch = 0; batch < 5; batch++) {
        const batchPromises = Array.from({ length: 10 }, (_, i) => 
          coordinatorAgent.coordinateBurnRequest({
            ...baseRequest,
            farm_id: batch * 10 + i + 1,
            field_name: `Load Test Field ${batch}-${i}`
          })
        );
        promises.push(...batchPromises);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});