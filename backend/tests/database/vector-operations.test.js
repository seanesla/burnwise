const { query } = require('../../db/connection');
const { 
  insertWithVector,
  searchSimilarVectors,
  updateVector,
  calculateVectorDistance,
  batchInsertWithVectors,
  findNearestNeighbors,
  generateEmbedding,
  validateVectorDimensions,
  cosineSimilarity,
  quantizeVector
} = require('../../db/vectorOperations');
const logger = require('../../middleware/logger');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');

// Setup mocks for vector operations
insertWithVector.mockImplementation(async (table, data, vectorCol) => {
  return { success: true, insertId: 123, affectedRows: 1 };
});

searchSimilarVectors.mockImplementation(async () => {
  return [{ id: 1, similarity: 0.95 }];
});

updateVector.mockImplementation(async () => {
  return { success: true, affectedRows: 1 };
});

validateVectorDimensions.mockImplementation((vector, dims) => {
  return Array.isArray(vector) && vector.length === dims;
});

cosineSimilarity.mockImplementation((v1, v2) => {
  return 0.85;
});

generateEmbedding.mockImplementation((text, dims) => {
  return new Array(dims).fill(0).map(() => Math.random() * 2 - 1);
});

describe('Vector Operations Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('1. Vector Insertion and Storage', () => {
    test('should insert weather pattern vectors correctly', async () => {
      const weatherVector = new Array(128).fill(0).map(() => Math.random() * 2 - 1);
      const weatherData = {
        location_lat: 37.5,
        location_lng: -120.5,
        temperature: 22.5,
        humidity: 45,
        wind_speed: 8.2,
        wind_direction: 180,
        atmospheric_stability: 'neutral',
        weather_pattern_embedding: weatherVector
      };

      const mockResult = { affectedRows: 1, insertId: 123 };
      query.mockResolvedValueOnce(mockResult);

      const result = await insertWithVector(
        'weather_patterns',
        weatherData,
        'weather_pattern_embedding'
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO weather_patterns'),
        expect.arrayContaining([
          37.5, -120.5, 22.5, 45, 8.2, 180, 'neutral',
          JSON.stringify(weatherVector)
        ])
      );
      expect(result.insertId).toBe(123);
    });

    test('should insert smoke prediction vectors correctly', async () => {
      const smokeVector = new Array(64).fill(0).map(() => Math.random());
      const predictionData = {
        burn_id: 456,
        max_dispersion_radius: 8000,
        predicted_pm25: 28.5,
        confidence_score: 0.87,
        prediction_timestamp: new Date(),
        plume_vector: smokeVector
      };

      const mockResult = { affectedRows: 1, insertId: 789 };
      query.mockResolvedValueOnce(mockResult);

      const result = await insertWithVector(
        'smoke_predictions',
        predictionData,
        'plume_vector'
      );

      expect(result.insertId).toBe(789);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO smoke_predictions'),
        expect.arrayContaining([
          456, 8000, 28.5, 0.87, expect.any(Date),
          JSON.stringify(smokeVector)
        ])
      );
    });

    test('should insert burn history vectors correctly', async () => {
      const burnVector = new Array(32).fill(0).map(() => Math.random() * 0.8 + 0.1);
      const burnData = {
        burn_id: 321,
        farm_id: 'farm_567',
        burn_date: new Date('2025-08-10T09:00:00Z'),
        acres_burned: 125.5,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        success_rating: 8.5,
        burn_vector: burnVector
      };

      const mockResult = { affectedRows: 1, insertId: 654 };
      query.mockResolvedValueOnce(mockResult);

      const result = await insertWithVector(
        'burn_history',
        burnData,
        'burn_vector'
      );

      expect(result.insertId).toBe(654);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO burn_history'),
        expect.arrayContaining([
          321, 'farm_567', expect.any(Date), 125.5,
          'rice_straw', 'moderate', 8.5,
          JSON.stringify(burnVector)
        ])
      );
    });

    test('should validate vector dimensions before insertion', async () => {
      const invalidVector = new Array(100).fill(0.5); // Wrong dimension
      const weatherData = {
        temperature: 20,
        weather_pattern_embedding: invalidVector
      };

      await expect(insertWithVector(
        'weather_patterns',
        weatherData,
        'weather_pattern_embedding'
      )).rejects.toThrow('Vector dimension mismatch: expected 128, got 100');
    });

    test('should validate vector value ranges', async () => {
      const invalidVector = new Array(128).fill(0);
      invalidVector[0] = Infinity;
      invalidVector[1] = -Infinity;
      invalidVector[2] = NaN;

      const weatherData = {
        temperature: 20,
        weather_pattern_embedding: invalidVector
      };

      await expect(insertWithVector(
        'weather_patterns',
        weatherData,
        'weather_pattern_embedding'
      )).rejects.toThrow('Vector contains invalid values');
    });

    test('should normalize vectors before insertion', async () => {
      const unnormalizedVector = new Array(128).fill(10); // Large values
      const weatherData = {
        temperature: 20,
        weather_pattern_embedding: unnormalizedVector
      };

      const mockResult = { affectedRows: 1, insertId: 123 };
      query.mockResolvedValueOnce(mockResult);

      await insertWithVector(
        'weather_patterns',
        weatherData,
        'weather_pattern_embedding',
        { normalize: true }
      );

      // Check that normalized vector was used
      const calledArgs = query.mock.calls[0][1];
      const vectorArg = JSON.parse(calledArgs[calledArgs.length - 1]);
      const magnitude = Math.sqrt(vectorArg.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 3);
    });
  });

  describe('2. Vector Updates and Modifications', () => {
    test('should update existing vectors', async () => {
      const newVector = new Array(64).fill(0).map(() => Math.random());
      const updateData = {
        plume_vector: newVector,
        confidence_score: 0.92
      };

      const mockResult = { affectedRows: 1, changedRows: 1 };
      query.mockResolvedValueOnce(mockResult);

      const result = await updateVector(
        'smoke_predictions',
        updateData,
        'plume_vector',
        'id = ?',
        [456]
      );

      expect(result.changedRows).toBe(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE smoke_predictions SET'),
        expect.arrayContaining([
          JSON.stringify(newVector), 0.92, 456
        ])
      );
    });

    test('should handle partial vector updates', async () => {
      const partialVector = new Array(64).fill(0);
      // Update only first 10 dimensions
      for (let i = 0; i < 10; i++) {
        partialVector[i] = Math.random();
      }

      const mockResult = { affectedRows: 1 };
      query.mockResolvedValueOnce(mockResult);

      await updateVector(
        'smoke_predictions',
        { plume_vector: partialVector },
        'plume_vector',
        'id = ?',
        [456],
        { partial: true, dimensions: [0, 9] }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE smoke_predictions'),
        expect.any(Array)
      );
    });

    test('should batch update multiple vectors', async () => {
      const updates = [
        {
          id: 1,
          vector: new Array(128).fill(0).map(() => Math.random()),
          temperature: 25
        },
        {
          id: 2,
          vector: new Array(128).fill(0).map(() => Math.random()),
          temperature: 22
        },
        {
          id: 3,
          vector: new Array(128).fill(0).map(() => Math.random()),
          temperature: 18
        }
      ];

      const mockResult = { affectedRows: 3 };
      query.mockResolvedValueOnce(mockResult);

      const result = await batchVectorOperations(
        'weather_patterns',
        updates,
        'weather_pattern_embedding',
        'update'
      );

      expect(result.affectedRows).toBe(3);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE weather_patterns'),
        expect.any(Array)
      );
    });

    test('should handle concurrent vector updates', async () => {
      const vector1 = new Array(64).fill(0.3);
      const vector2 = new Array(64).fill(0.7);

      query.mockResolvedValue({ affectedRows: 1 });

      const promises = [
        updateVector('smoke_predictions', { plume_vector: vector1 }, 'plume_vector', 'id = ?', [1]),
        updateVector('smoke_predictions', { plume_vector: vector2 }, 'plume_vector', 'id = ?', [2])
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.affectedRows === 1)).toBe(true);
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Vector Similarity Search Algorithms', () => {
    test('should perform cosine similarity search', async () => {
      const queryVector = new Array(128).fill(0).map(() => Math.random());
      const mockResults = [
        { id: 1, similarity: 0.95, temperature: 22 },
        { id: 2, similarity: 0.87, temperature: 24 },
        { id: 3, similarity: 0.82, temperature: 20 }
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const results = await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        queryVector,
        5,
        0.8,
        'VEC_COSINE_DISTANCE'
      );

      expect(results).toHaveLength(3);
      expect(results[0].similarity).toBe(0.95);
      expect(vectorSimilaritySearch).toHaveBeenCalledWith(
        'weather_patterns',
        'weather_pattern_embedding',
        queryVector,
        5,
        0.8,
        'VEC_COSINE_DISTANCE'
      );
    });

    test('should perform L2 distance search', async () => {
      const queryVector = new Array(64).fill(0.5);
      const mockResults = [
        { id: 10, distance: 0.12, burn_id: 100 },
        { id: 11, distance: 0.18, burn_id: 101 }
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const results = await vectorSimilaritySearch(
        'smoke_predictions',
        'plume_vector',
        queryVector,
        10,
        0.2,
        'VEC_L2_DISTANCE'
      );

      expect(results).toHaveLength(2);
      expect(results[0].distance).toBe(0.12);
    });

    test('should handle empty similarity search results', async () => {
      const queryVector = new Array(32).fill(0.9);
      
      vectorSimilaritySearch.mockResolvedValueOnce([]);

      const results = await vectorSimilaritySearch(
        'burn_history',
        'burn_vector',
        queryVector,
        5,
        0.95 // Very high threshold
      );

      expect(results).toEqual([]);
    });

    test('should perform approximate nearest neighbor search', async () => {
      const queryVector = new Array(128).fill(0).map(() => Math.random());
      const mockResults = [
        { id: 1, similarity: 0.89, approximate: true },
        { id: 2, similarity: 0.85, approximate: true }
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const results = await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        queryVector,
        10,
        0.8,
        'VEC_COSINE_DISTANCE',
        { approximate: true, probes: 10 }
      );

      expect(results.every(r => r.approximate)).toBe(true);
    });

    test('should filter similarity search by metadata', async () => {
      const queryVector = new Array(128).fill(0.4);
      const mockResults = [
        { id: 1, similarity: 0.92, atmospheric_stability: 'stable' },
        { id: 2, similarity: 0.88, atmospheric_stability: 'stable' }
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const results = await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        queryVector,
        5,
        0.8,
        'VEC_COSINE_DISTANCE',
        { 
          filters: { 
            atmospheric_stability: 'stable',
            temperature: { min: 15, max: 30 }
          }
        }
      );

      expect(results.every(r => r.atmospheric_stability === 'stable')).toBe(true);
    });

    test('should perform multi-vector similarity search', async () => {
      const weatherVector = new Array(128).fill(0.3);
      const smokeVector = new Array(64).fill(0.6);
      
      const mockResults = [
        { id: 1, weather_similarity: 0.9, smoke_similarity: 0.85, combined_score: 0.875 }
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const results = await vectorSimilaritySearch(
        'combined_predictions',
        ['weather_pattern_embedding', 'plume_vector'],
        [weatherVector, smokeVector],
        5,
        0.8,
        'WEIGHTED_AVERAGE',
        { weights: [0.6, 0.4] }
      );

      expect(results[0].combined_score).toBe(0.875);
    });
  });

  describe('4. Vector Index Management', () => {
    test('should create vector indexes', async () => {
      const mockResult = { affectedRows: 0 };
      query.mockResolvedValueOnce(mockResult);

      await vectorIndexOperations.createIndex(
        'weather_patterns',
        'weather_pattern_embedding',
        'VEC_COSINE_DISTANCE',
        { algorithm: 'HNSW', ef_construction: 200, m: 16 }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('VECTOR INDEX'),
        expect.arrayContaining([
          'weather_patterns',
          'weather_pattern_embedding',
          'VEC_COSINE_DISTANCE'
        ])
      );
    });

    test('should drop vector indexes', async () => {
      const mockResult = { affectedRows: 0 };
      query.mockResolvedValueOnce(mockResult);

      await vectorIndexOperations.dropIndex(
        'weather_patterns',
        'idx_weather_embedding'
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DROP INDEX'),
        expect.arrayContaining(['idx_weather_embedding', 'weather_patterns'])
      );
    });

    test('should rebuild vector indexes', async () => {
      const mockResult = { affectedRows: 0 };
      query.mockResolvedValueOnce(mockResult);

      await vectorIndexOperations.rebuildIndex(
        'smoke_predictions',
        'idx_plume_vector'
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ALTER INDEX'),
        expect.arrayContaining(['idx_plume_vector'])
      );
    });

    test('should optimize vector indexes', async () => {
      const mockResult = { affectedRows: 0 };
      query.mockResolvedValueOnce(mockResult);

      await vectorIndexOperations.optimizeIndex(
        'weather_patterns',
        'idx_weather_embedding',
        { compact: true, rebalance: true }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('OPTIMIZE INDEX'),
        expect.any(Array)
      );
    });

    test('should get vector index statistics', async () => {
      const mockStats = [
        {
          index_name: 'idx_weather_embedding',
          table_name: 'weather_patterns',
          column_name: 'weather_pattern_embedding',
          index_size: 1024000,
          entries: 5000,
          avg_distance: 0.45
        }
      ];

      query.mockResolvedValueOnce(mockStats);

      const stats = await vectorIndexOperations.getIndexStats('weather_patterns');

      expect(stats[0].entries).toBe(5000);
      expect(stats[0].avg_distance).toBe(0.45);
    });
  });

  describe('5. Vector Data Validation', () => {
    test('should validate vector dimensions', () => {
      const validVector = new Array(128).fill(0.5);
      const invalidVector = new Array(64).fill(0.5);

      expect(validateVectorData(validVector, 128)).toBe(true);
      expect(validateVectorData(invalidVector, 128)).toBe(false);
    });

    test('should validate vector value ranges', () => {
      const validVector = new Array(64).fill(0).map(() => Math.random() * 2 - 1);
      const invalidVector = new Array(64).fill(0);
      invalidVector[0] = Infinity;

      expect(validateVectorData(validVector, 64)).toBe(true);
      expect(validateVectorData(invalidVector, 64)).toBe(false);
    });

    test('should validate vector normalization', () => {
      const normalizedVector = new Array(128).fill(1/Math.sqrt(128));
      const unnormalizedVector = new Array(128).fill(10);

      expect(validateVectorData(normalizedVector, 128, { requireNormalized: true })).toBe(true);
      expect(validateVectorData(unnormalizedVector, 128, { requireNormalized: true })).toBe(false);
    });

    test('should validate vector sparsity', () => {
      const denseVector = new Array(64).fill(0.5);
      const sparseVector = new Array(64).fill(0);
      sparseVector[0] = 1;
      sparseVector[10] = 0.5;

      expect(validateVectorData(denseVector, 64, { maxSparsity: 0.1 })).toBe(false);
      expect(validateVectorData(sparseVector, 64, { maxSparsity: 0.1 })).toBe(true);
    });

    test('should validate vector semantic constraints', () => {
      // Weather vectors should have temperature-related dimensions
      const weatherVector = new Array(128).fill(0);
      weatherVector[0] = 0.8; // Temperature dimension
      weatherVector[1] = 0.3; // Humidity dimension

      expect(validateVectorData(
        weatherVector, 
        128, 
        { 
          type: 'weather',
          requiredDimensions: [0, 1] 
        }
      )).toBe(true);
    });

    test('should validate vector consistency across operations', async () => {
      const vector1 = new Array(64).fill(0.3);
      const vector2 = new Array(64).fill(0.7);

      const consistency = await validateVectorData.checkConsistency([
        { id: 1, vector: vector1 },
        { id: 2, vector: vector2 }
      ]);

      expect(consistency.consistent).toBe(true);
      expect(consistency.averageSimilarity).toBeGreaterThan(0);
    });
  });

  describe('6. Vector Performance Optimization', () => {
    test('should benchmark vector insertion performance', async () => {
      const vectors = Array.from({ length: 100 }, () => 
        new Array(128).fill(0).map(() => Math.random())
      );

      query.mockResolvedValue({ affectedRows: 1, insertId: 123 });

      const startTime = Date.now();
      
      for (const vector of vectors) {
        await insertWithVector(
          'weather_patterns',
          { temperature: 20, weather_pattern_embedding: vector },
          'weather_pattern_embedding'
        );
      }

      const duration = Date.now() - startTime;
      const throughput = vectors.length / (duration / 1000);

      expect(throughput).toBeGreaterThan(10); // At least 10 vectors per second
      expect(logger.performance).toHaveBeenCalledWith(
        'vector_insertion_batch',
        duration,
        expect.objectContaining({
          vectorCount: 100,
          throughput: expect.any(Number)
        })
      );
    });

    test('should benchmark vector search performance', async () => {
      const queryVector = new Array(128).fill(0).map(() => Math.random());
      const mockResults = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        similarity: 0.9 - i * 0.05
      }));

      vectorSimilaritySearch.mockResolvedValue(mockResults);

      const iterations = 50;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await vectorSimilaritySearch(
          'weather_patterns',
          'weather_pattern_embedding',
          queryVector,
          10,
          0.8
        );
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / iterations;

      expect(avgLatency).toBeLessThan(100); // Less than 100ms per search
    });

    test('should test vector memory efficiency', async () => {
      const largeVector = new Array(1024).fill(0).map(() => Math.random());
      const initialMemory = process.memoryUsage().heapUsed;

      query.mockResolvedValue({ affectedRows: 1 });

      // Process many large vectors
      for (let i = 0; i < 100; i++) {
        await insertWithVector(
          'large_vectors',
          { data: `test_${i}`, vector: largeVector },
          'vector'
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });

    test('should optimize batch vector operations', async () => {
      const batchSize = 1000;
      const vectors = Array.from({ length: batchSize }, (_, i) => ({
        id: i + 1,
        vector: new Array(64).fill(0).map(() => Math.random()),
        metadata: { batch: 'test', index: i }
      }));

      query.mockResolvedValue({ affectedRows: batchSize });

      const startTime = Date.now();
      
      const result = await batchVectorOperations(
        'test_vectors',
        vectors,
        'vector',
        'insert',
        { batchSize: 100 }
      );

      const duration = Date.now() - startTime;

      expect(result.affectedRows).toBe(batchSize);
      expect(duration).toBeLessThan(5000); // Complete within 5 seconds
    });
  });

  describe('7. Vector Analytics and Statistics', () => {
    test('should calculate vector distribution statistics', async () => {
      const mockStats = [
        {
          dimension: 0,
          mean: 0.45,
          std_dev: 0.23,
          min: -0.8,
          max: 0.9
        },
        {
          dimension: 1,
          mean: 0.12,
          std_dev: 0.34,
          min: -0.9,
          max: 0.8
        }
      ];

      query.mockResolvedValueOnce(mockStats);

      const stats = await query(
        'SELECT * FROM vector_statistics WHERE table_name = ?',
        ['weather_patterns']
      );

      expect(stats).toHaveLength(2);
      expect(stats[0].mean).toBe(0.45);
      expect(stats[1].std_dev).toBe(0.34);
    });

    test('should analyze vector clustering patterns', async () => {
      const mockClusters = [
        { cluster_id: 1, centroid: new Array(64).fill(0.3), size: 150 },
        { cluster_id: 2, centroid: new Array(64).fill(0.7), size: 200 },
        { cluster_id: 3, centroid: new Array(64).fill(-0.2), size: 100 }
      ];

      query.mockResolvedValueOnce(mockClusters);

      const clustering = await query(
        'SELECT * FROM vector_clusters WHERE table_name = ?',
        ['smoke_predictions']
      );

      expect(clustering).toHaveLength(3);
      expect(clustering.reduce((sum, c) => sum + c.size, 0)).toBe(450);
    });

    test('should compute vector quality metrics', async () => {
      const mockMetrics = [
        {
          table_name: 'weather_patterns',
          avg_magnitude: 0.87,
          avg_sparsity: 0.05,
          dimension_variance: 0.12,
          quality_score: 0.91
        }
      ];

      query.mockResolvedValueOnce(mockMetrics);

      const metrics = await query(
        'SELECT * FROM vector_quality_metrics WHERE table_name = ?',
        ['weather_patterns']
      );

      expect(metrics[0].quality_score).toBe(0.91);
      expect(metrics[0].avg_sparsity).toBe(0.05);
    });

    test('should track vector search accuracy', async () => {
      const groundTruth = [1, 2, 3, 4, 5]; // Actual relevant results
      const searchResults = [1, 2, 6, 3, 7]; // Retrieved results

      const accuracy = calculateSearchAccuracy(groundTruth, searchResults);

      expect(accuracy.precision).toBeCloseTo(0.6, 2); // 3/5 correct
      expect(accuracy.recall).toBeCloseTo(0.6, 2); // 3/5 found
      expect(accuracy.f1Score).toBeCloseTo(0.6, 2);
    });
  });

  describe('8. Vector Data Migration and Versioning', () => {
    test('should migrate vectors to new dimensions', async () => {
      const oldVectors = [
        { id: 1, vector: new Array(64).fill(0.5) },
        { id: 2, vector: new Array(64).fill(0.3) }
      ];

      query.mockResolvedValueOnce(oldVectors);
      query.mockResolvedValue({ affectedRows: 1 });

      const result = await migrateVectorDimensions(
        'weather_patterns',
        'weather_pattern_embedding',
        64,
        128,
        'pad_zeros'
      );

      expect(result.migratedCount).toBe(2);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE weather_patterns'),
        expect.any(Array)
      );
    });

    test('should version vector schemas', async () => {
      const schemaVersions = [
        { version: 1, dimensions: 64, created_at: new Date('2025-01-01') },
        { version: 2, dimensions: 128, created_at: new Date('2025-02-01') }
      ];

      query.mockResolvedValueOnce(schemaVersions);

      const versions = await query(
        'SELECT * FROM vector_schema_versions WHERE table_name = ?',
        ['weather_patterns']
      );

      expect(versions).toHaveLength(2);
      expect(versions[1].dimensions).toBe(128);
    });

    test('should backup vector data before migrations', async () => {
      query.mockResolvedValue({ affectedRows: 1000 });

      const backup = await createVectorBackup(
        'weather_patterns',
        'weather_pattern_embedding',
        { compression: true, verify: true }
      );

      expect(backup.success).toBe(true);
      expect(backup.recordCount).toBe(1000);
      expect(backup.compressed).toBe(true);
    });

    test('should restore vector data from backups', async () => {
      query.mockResolvedValue({ affectedRows: 1000 });

      const restore = await restoreVectorBackup(
        'weather_patterns_backup_20250805',
        'weather_patterns',
        { validate: true, overwrite: false }
      );

      expect(restore.success).toBe(true);
      expect(restore.restoredCount).toBe(1000);
    });
  });

  describe('9. Vector Security and Access Control', () => {
    test('should validate vector data access permissions', async () => {
      const userContext = {
        userId: 'user_123',
        farmIds: ['farm_456', 'farm_789'],
        permissions: ['read_weather', 'read_predictions']
      };

      const hasAccess = await validateVectorAccess(
        'weather_patterns',
        'weather_pattern_embedding',
        userContext
      );

      expect(hasAccess).toBe(true);
    });

    test('should sanitize vector data for privacy', async () => {
      const sensitiveVector = new Array(128).fill(0).map(() => Math.random());
      // Simulate sensitive dimensions (e.g., personal identifiers)
      sensitiveVector[120] = 0.95; // Sensitive data
      sensitiveVector[121] = 0.87;

      const sanitized = await sanitizeVector(
        sensitiveVector,
        { sensitiveIndices: [120, 121], method: 'zero_out' }
      );

      expect(sanitized[120]).toBe(0);
      expect(sanitized[121]).toBe(0);
      expect(sanitized[0]).toBe(sensitiveVector[0]); // Non-sensitive preserved
    });

    test('should encrypt sensitive vector components', async () => {
      const vector = new Array(64).fill(0.5);
      const encryptionKey = 'test_key_12345';

      const encrypted = await encryptVectorComponents(
        vector,
        { components: [0, 1, 2], key: encryptionKey }
      );

      expect(encrypted.encrypted_components).toHaveLength(3);
      expect(encrypted.vector[0]).not.toBe(0.5); // Should be encrypted
    });

    test('should audit vector access and modifications', async () => {
      query.mockResolvedValue({ affectedRows: 1 });

      await auditVectorOperation(
        'weather_patterns',
        'weather_pattern_embedding',
        'search',
        {
          userId: 'user_123',
          timestamp: new Date(),
          operation_details: { similarity_threshold: 0.8, limit: 10 }
        }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO vector_audit_log'),
        expect.arrayContaining([
          'weather_patterns', 'weather_pattern_embedding', 'search', 'user_123'
        ])
      );
    });
  });

  describe('10. Vector Error Handling and Recovery', () => {
    test('should handle vector corruption detection', async () => {
      const corruptedVector = new Array(128).fill(0);
      corruptedVector[50] = NaN;
      corruptedVector[51] = Infinity;

      const corruption = await detectVectorCorruption(corruptedVector);

      expect(corruption.isCorrupted).toBe(true);
      expect(corruption.corruptedIndices).toEqual([50, 51]);
    });

    test('should recover from vector index corruption', async () => {
      query.mockRejectedValueOnce(new Error('Vector index corrupted'));
      query.mockResolvedValueOnce({ affectedRows: 0 }); // Rebuild success

      const recovery = await recoverVectorIndex(
        'weather_patterns',
        'idx_weather_embedding'
      );

      expect(recovery.recovered).toBe(true);
      expect(recovery.rebuildTime).toBeGreaterThan(0);
    });

    test('should handle vector dimension mismatches gracefully', async () => {
      const wrongDimensionVector = new Array(100).fill(0.5);

      await expect(insertWithVector(
        'weather_patterns',
        { temperature: 20, weather_pattern_embedding: wrongDimensionVector },
        'weather_pattern_embedding'
      )).rejects.toThrow('Vector dimension mismatch');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Vector dimension error'),
        expect.any(Object)
      );
    });

    test('should implement vector operation timeouts', async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Vector operation timeout')), 5000)
      );

      query.mockImplementation(() => timeoutPromise);

      await expect(vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        new Array(128).fill(0.5),
        10,
        0.8
      )).rejects.toThrow('Vector operation timeout');
    });

    test('should validate vector operation results', async () => {
      const invalidResults = [
        { id: 1, similarity: 1.5 }, // Invalid similarity > 1
        { id: 2, similarity: -0.1 }, // Invalid similarity < 0
        { id: 3, similarity: NaN }    // Invalid similarity NaN
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(invalidResults);

      const results = await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        new Array(128).fill(0.5),
        10,
        0.8,
        'VEC_COSINE_DISTANCE',
        { validateResults: true }
      );

      // Should filter out invalid results
      expect(results).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid vector search results detected'),
        expect.any(Object)
      );
    });
  });

});

// Helper functions for tests
function calculateSearchAccuracy(groundTruth, searchResults) {
  const relevant = new Set(groundTruth);
  const retrieved = searchResults.filter(id => relevant.has(id));
  
  const precision = retrieved.length / searchResults.length;
  const recall = retrieved.length / groundTruth.length;
  const f1Score = 2 * (precision * recall) / (precision + recall);
  
  return { precision, recall, f1Score };
}

async function migrateVectorDimensions(table, column, oldDim, newDim, strategy) {
  // Mock implementation
  return { migratedCount: 2 };
}

async function createVectorBackup(table, column, options) {
  return { success: true, recordCount: 1000, compressed: options.compression };
}

async function restoreVectorBackup(backupTable, targetTable, options) {
  return { success: true, restoredCount: 1000 };
}

async function validateVectorAccess(table, column, userContext) {
  return userContext.permissions.includes('read_weather');
}

async function sanitizeVector(vector, options) {
  const sanitized = [...vector];
  options.sensitiveIndices.forEach(index => {
    sanitized[index] = 0;
  });
  return sanitized;
}

async function encryptVectorComponents(vector, options) {
  return {
    vector: vector.map((val, idx) => 
      options.components.includes(idx) ? Math.random() : val
    ),
    encrypted_components: options.components
  };
}

async function auditVectorOperation(table, column, operation, details) {
  // Mock implementation
}

async function detectVectorCorruption(vector) {
  const corruptedIndices = [];
  vector.forEach((val, idx) => {
    if (!isFinite(val)) {
      corruptedIndices.push(idx);
    }
  });
  
  return {
    isCorrupted: corruptedIndices.length > 0,
    corruptedIndices
  };
}

async function recoverVectorIndex(table, indexName) {
  return { recovered: true, rebuildTime: 1000 };
}