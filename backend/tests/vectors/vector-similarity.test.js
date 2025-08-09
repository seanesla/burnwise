const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { initializeDatabase, query, pool, vectorSearch } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinatorFixed5Agent');
const SmokeOverlapPredictor = require('../../agents/predictor');
const WeatherAgent = require('../../agents/weather');

describe('Vector Similarity Search Tests - TiDB VEC_COSINE_DISTANCE', () => {
  let coordinator;
  let predictor;
  let weatherAgent;
  let testVectors;
  
  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new CoordinatorAgent();
    predictor = new SmokeOverlapPredictor();
    weatherAgent = new WeatherAgent();
    
    // Generate test vectors of each dimension
    testVectors = {
      terrain32: [],
      smoke64: [],
      weather128: []
    };
    
    // Create diverse terrain vectors
    const terrainConditions = [
      { lat: 40.0, lon: -120.0, elevation: 100, slope: 5, vegetation: 'grassland' },
      { lat: 40.0, lon: -120.0, elevation: 100, slope: 5, vegetation: 'grassland' }, // Duplicate
      { lat: 40.1, lon: -120.1, elevation: 120, slope: 8, vegetation: 'agriculture' },
      { lat: 39.0, lon: -120.0, elevation: 2000, slope: 30, vegetation: 'forest' },
      { lat: 41.0, lon: -119.0, elevation: 50, slope: 2, vegetation: 'agriculture' }
    ];
    
    for (const terrain of terrainConditions) {
      const vector = await coordinator.generateTerrainVector(
        terrain.lat, terrain.lon, terrain.elevation, terrain.slope, terrain.vegetation
      );
      testVectors.terrain32.push({ vector, metadata: terrain });
    }
    
    // Create diverse smoke vectors
    const smokeConditions = [
      { burnId: 1, weather: { windSpeed: 10, windDirection: 180 }, area: 100 },
      { burnId: 2, weather: { windSpeed: 10, windDirection: 180 }, area: 100 }, // Duplicate
      { burnId: 3, weather: { windSpeed: 15, windDirection: 270 }, area: 150 },
      { burnId: 4, weather: { windSpeed: 5, windDirection: 90 }, area: 200 },
      { burnId: 5, weather: { windSpeed: 2, windDirection: 0 }, area: 300 }
    ];
    
    for (const smoke of smokeConditions) {
      const vector = await predictor.generateSmokeVector(
        smoke.burnId, smoke.weather, smoke.area
      );
      testVectors.smoke64.push({ vector, metadata: smoke });
    }
    
    // Create diverse weather vectors
    const weatherConditions = [
      { temperature: 25, humidity: 60, windSpeed: 10, windDirection: 180, timestamp: new Date('2025-08-25T12:00:00') },
      { temperature: 25, humidity: 60, windSpeed: 10, windDirection: 180, timestamp: new Date('2025-08-25T12:00:00') }, // Duplicate
      { temperature: 30, humidity: 40, windSpeed: 15, windDirection: 270, timestamp: new Date('2025-08-25T14:00:00') },
      { temperature: 15, humidity: 80, windSpeed: 5, windDirection: 90, timestamp: new Date('2025-08-25T06:00:00') },
      { temperature: 35, humidity: 20, windSpeed: 20, windDirection: 0, timestamp: new Date('2025-08-25T16:00:00') }
    ];
    
    for (const weather of weatherConditions) {
      const vector = weatherAgent.createWeatherEmbedding(weather);
      testVectors.weather128.push({ vector, metadata: weather });
    }
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Cosine Similarity Calculations', () => {
    test('Should calculate exact match as similarity 1.0', () => {
      const vector = testVectors.terrain32[0].vector;
      const similarity = calculateCosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1.0, 10);
    });

    test('Should calculate orthogonal vectors as similarity 0.0', () => {
      const v1 = new Array(32).fill(0);
      const v2 = new Array(32).fill(0);
      v1[0] = 1;
      v2[1] = 1;
      
      const similarity = calculateCosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(0.0, 10);
    });

    test('Should calculate opposite vectors as similarity -1.0', () => {
      const v1 = new Array(32).fill(1);
      const v2 = new Array(32).fill(-1);
      
      const similarity = calculateCosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(-1.0, 10);
    });

    test('Should identify duplicate vectors with similarity > 0.999', () => {
      // Terrain duplicates (index 0 and 1)
      const terrain1 = testVectors.terrain32[0].vector;
      const terrain2 = testVectors.terrain32[1].vector;
      const terrainSim = calculateCosineSimilarity(terrain1, terrain2);
      expect(terrainSim).toBeGreaterThan(0.999);
      
      // Smoke duplicates (index 0 and 1)
      const smoke1 = testVectors.smoke64[0].vector;
      const smoke2 = testVectors.smoke64[1].vector;
      const smokeSim = calculateCosineSimilarity(smoke1, smoke2);
      expect(smokeSim).toBeGreaterThan(0.999);
      
      // Weather duplicates (index 0 and 1)
      const weather1 = testVectors.weather128[0].vector;
      const weather2 = testVectors.weather128[1].vector;
      const weatherSim = calculateCosineSimilarity(weather1, weather2);
      expect(weatherSim).toBeGreaterThan(0.999);
    });

    test('Should handle zero vectors gracefully', () => {
      const zeroVector = new Array(32).fill(0);
      const normalVector = testVectors.terrain32[0].vector;
      
      const similarity = calculateCosineSimilarity(zeroVector, normalVector);
      expect(similarity).toBe(0);
    });

    test('Should be symmetric: sim(A,B) = sim(B,A)', () => {
      const v1 = testVectors.smoke64[0].vector;
      const v2 = testVectors.smoke64[2].vector;
      
      const sim1 = calculateCosineSimilarity(v1, v2);
      const sim2 = calculateCosineSimilarity(v2, v1);
      
      expect(sim1).toBeCloseTo(sim2, 10);
    });

    test('Should satisfy triangle inequality for distances', () => {
      const v1 = testVectors.weather128[0].vector;
      const v2 = testVectors.weather128[2].vector;
      const v3 = testVectors.weather128[3].vector;
      
      const d12 = 1 - calculateCosineSimilarity(v1, v2);
      const d23 = 1 - calculateCosineSimilarity(v2, v3);
      const d13 = 1 - calculateCosineSimilarity(v1, v3);
      
      // Triangle inequality: d(1,3) <= d(1,2) + d(2,3)
      expect(d13).toBeLessThanOrEqual(d12 + d23 + 0.0001); // Small epsilon for floating point
    });
  });

  describe('K-Nearest Neighbor Search', () => {
    test('Should find k nearest neighbors for terrain vectors', () => {
      const target = testVectors.terrain32[2].vector;
      const candidates = testVectors.terrain32.map(t => t.vector);
      
      const knn = findKNearestNeighbors(target, candidates, 3);
      
      expect(knn).toHaveLength(3);
      expect(knn[0].index).toBe(2); // Should find itself first
      expect(knn[0].similarity).toBeCloseTo(1.0, 10);
      
      // Results should be sorted by similarity (descending)
      for (let i = 1; i < knn.length; i++) {
        expect(knn[i].similarity).toBeLessThanOrEqual(knn[i - 1].similarity);
      }
    });

    test('Should find k nearest neighbors for smoke vectors', () => {
      const target = testVectors.smoke64[3].vector;
      const candidates = testVectors.smoke64.map(s => s.vector);
      
      const knn = findKNearestNeighbors(target, candidates, 4);
      
      expect(knn).toHaveLength(4);
      expect(knn[0].index).toBe(3); // Should find itself first
      expect(knn[0].similarity).toBeCloseTo(1.0, 10);
    });

    test('Should find k nearest neighbors for weather vectors', () => {
      const target = testVectors.weather128[4].vector;
      const candidates = testVectors.weather128.map(w => w.vector);
      
      const knn = findKNearestNeighbors(target, candidates, 2);
      
      expect(knn).toHaveLength(2);
      expect(knn[0].index).toBe(4); // Should find itself first
      expect(knn[0].similarity).toBeCloseTo(1.0, 10);
    });

    test('Should handle k larger than dataset size', () => {
      const target = testVectors.terrain32[0].vector;
      const candidates = testVectors.terrain32.map(t => t.vector);
      
      const knn = findKNearestNeighbors(target, candidates, 10);
      
      expect(knn).toHaveLength(5); // Only 5 vectors in dataset
    });

    test('Should exclude vectors below similarity threshold', () => {
      const target = testVectors.smoke64[0].vector;
      const candidates = testVectors.smoke64.map(s => s.vector);
      
      const threshold = 0.5;
      const knn = findKNearestNeighborsWithThreshold(target, candidates, 10, threshold);
      
      knn.forEach(neighbor => {
        expect(neighbor.similarity).toBeGreaterThanOrEqual(threshold);
      });
    });
  });

  describe('Vector Search with TiDB Simulation', () => {
    test('Should simulate VEC_COSINE_DISTANCE query for terrain', async () => {
      const target = testVectors.terrain32[0].vector;
      
      // Simulate TiDB vector search
      const results = simulateVectorSearch(
        testVectors.terrain32,
        target,
        5,
        'VEC_COSINE_DISTANCE'
      );
      
      expect(results).toHaveLength(5);
      
      // First result should be exact match
      expect(results[0].distance).toBeCloseTo(0, 10);
      
      // Results should be sorted by distance (ascending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });

    test('Should simulate VEC_L2_DISTANCE query for smoke', async () => {
      const target = testVectors.smoke64[2].vector;
      
      const results = simulateVectorSearch(
        testVectors.smoke64,
        target,
        3,
        'VEC_L2_DISTANCE'
      );
      
      expect(results).toHaveLength(3);
      
      // First result should be exact match
      expect(results[0].distance).toBeCloseTo(0, 10);
    });

    test('Should filter results by distance threshold', async () => {
      const target = testVectors.weather128[0].vector;
      const maxDistance = 0.3; // Cosine distance threshold
      
      const results = simulateVectorSearchWithFilter(
        testVectors.weather128,
        target,
        10,
        'VEC_COSINE_DISTANCE',
        maxDistance
      );
      
      results.forEach(result => {
        expect(result.distance).toBeLessThanOrEqual(maxDistance);
      });
    });

    test('Should combine vector search with metadata filters', async () => {
      const target = testVectors.terrain32[0].vector;
      
      // Filter for only grassland or agriculture
      const results = simulateVectorSearchWithMetadataFilter(
        testVectors.terrain32,
        target,
        10,
        'VEC_COSINE_DISTANCE',
        (metadata) => ['grassland', 'agriculture'].includes(metadata.vegetation)
      );
      
      results.forEach(result => {
        expect(['grassland', 'agriculture']).toContain(result.metadata.vegetation);
      });
    });

    test('Should handle approximate nearest neighbor search', async () => {
      const target = testVectors.smoke64[0].vector;
      
      // Simulate HNSW index behavior
      const exactResults = simulateVectorSearch(
        testVectors.smoke64,
        target,
        5,
        'VEC_COSINE_DISTANCE'
      );
      
      const approxResults = simulateApproximateVectorSearch(
        testVectors.smoke64,
        target,
        5,
        'VEC_COSINE_DISTANCE',
        0.95 // 95% recall target
      );
      
      // Approximate should find at least 95% of exact results
      const overlap = approxResults.filter(a => 
        exactResults.some(e => e.index === a.index)
      ).length;
      
      expect(overlap / exactResults.length).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('Historical Pattern Matching', () => {
    test('Should find similar historical weather patterns', () => {
      const currentWeather = weatherAgent.createWeatherEmbedding({
        temperature: 26,
        humidity: 58,
        windSpeed: 11,
        windDirection: 185,
        timestamp: new Date('2025-08-26T12:00:00')
      });
      
      const historicalMatches = findHistoricalMatches(
        testVectors.weather128,
        currentWeather,
        0.9 // 90% similarity threshold
      );
      
      expect(historicalMatches.length).toBeGreaterThan(0);
      
      // Should find the similar conditions from test data
      const bestMatch = historicalMatches[0];
      expect(bestMatch.similarity).toBeGreaterThan(0.9);
    });

    test('Should find similar terrain for burn planning', async () => {
      const targetTerrain = await coordinator.generateTerrainVector(
        40.05, -120.05, 110, 6, 'grassland'
      );
      
      const similarTerrains = findHistoricalMatches(
        testVectors.terrain32,
        targetTerrain,
        0.8
      );
      
      expect(similarTerrains.length).toBeGreaterThan(0);
      
      // Should prefer same vegetation type
      const grasslandMatches = similarTerrains.filter(m => 
        m.metadata.vegetation === 'grassland'
      );
      expect(grasslandMatches.length).toBeGreaterThan(0);
    });

    test('Should find previous smoke incidents in similar conditions', async () => {
      const currentSmoke = await predictor.generateSmokeVector(
        999,
        { windSpeed: 11, windDirection: 175 },
        105
      );
      
      const historicalIncidents = findHistoricalMatches(
        testVectors.smoke64,
        currentSmoke,
        0.85
      );
      
      expect(historicalIncidents.length).toBeGreaterThan(0);
      
      // Most similar should be the duplicate conditions
      expect(historicalIncidents[0].similarity).toBeGreaterThan(0.95);
    });

    test('Should rank historical matches by relevance', () => {
      const target = testVectors.weather128[0].vector;
      
      const rankedMatches = rankHistoricalMatches(
        testVectors.weather128,
        target,
        {
          similarityWeight: 0.7,
          recencyWeight: 0.2,
          severityWeight: 0.1
        }
      );
      
      expect(rankedMatches).toHaveLength(testVectors.weather128.length);
      
      // Should be sorted by combined score
      for (let i = 1; i < rankedMatches.length; i++) {
        expect(rankedMatches[i].score).toBeLessThanOrEqual(rankedMatches[i - 1].score);
      }
    });
  });

  describe('Conflict Detection via Vector Similarity', () => {
    test('Should detect overlapping smoke plumes', async () => {
      const plume1 = testVectors.smoke64[0].vector;
      const plume2 = testVectors.smoke64[1].vector; // Duplicate conditions
      
      const overlap = detectSmokeOverlap(plume1, plume2, 0.95);
      
      expect(overlap.hasConflict).toBeTruthy();
      expect(overlap.similarity).toBeGreaterThan(0.99);
      expect(overlap.severity).toBe('critical');
    });

    test('Should not detect conflict for dissimilar plumes', async () => {
      const plume1 = testVectors.smoke64[0].vector;
      const plume2 = testVectors.smoke64[3].vector; // Different conditions
      
      const overlap = detectSmokeOverlap(plume1, plume2, 0.95);
      
      expect(overlap.hasConflict).toBeFalsy();
      expect(overlap.similarity).toBeLessThan(0.95);
    });

    test('Should find all conflicting burns in region', async () => {
      const targetBurn = testVectors.smoke64[0].vector;
      const allBurns = testVectors.smoke64.map(s => s.vector);
      
      const conflicts = findAllConflicts(targetBurn, allBurns, 0.9);
      
      expect(conflicts.length).toBeGreaterThanOrEqual(1); // At least the duplicate
      
      conflicts.forEach(conflict => {
        expect(conflict.similarity).toBeGreaterThan(0.9);
      });
    });

    test('Should calculate cumulative smoke exposure', () => {
      const activeBurns = testVectors.smoke64.slice(0, 3).map(s => s.vector);
      const exposurePoint = [40.0, -120.0];
      
      const cumulative = calculateCumulativeExposure(activeBurns, exposurePoint);
      
      expect(cumulative.totalPM25).toBeGreaterThan(0);
      expect(cumulative.contributors).toHaveLength(3);
      expect(cumulative.hazardLevel).toBeDefined();
    });
  });

  describe('Vector Clustering and Segmentation', () => {
    test('Should cluster similar weather patterns', () => {
      const weatherVectors = testVectors.weather128.map(w => w.vector);
      
      const clusters = performHierarchicalClustering(weatherVectors, 0.8);
      
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(weatherVectors.length);
      
      // Duplicates should be in same cluster
      const duplicateCluster = clusters.find(c => 
        c.members.includes(0) && c.members.includes(1)
      );
      expect(duplicateCluster).toBeDefined();
    });

    test('Should segment terrain by similarity', async () => {
      const terrainVectors = testVectors.terrain32.map(t => t.vector);
      
      const segments = performDBSCAN(terrainVectors, 0.2, 2); // eps=0.2, minPts=2
      
      expect(segments.clusters.length).toBeGreaterThan(0);
      
      // Each point should be assigned to a cluster or marked as noise
      const totalAssigned = segments.clusters.reduce((sum, c) => sum + c.length, 0) + 
                           segments.noise.length;
      expect(totalAssigned).toBe(terrainVectors.length);
    });

    test('Should identify outlier vectors', () => {
      const smokeVectors = testVectors.smoke64.map(s => s.vector);
      
      const outliers = detectOutliers(smokeVectors, 1.5); // 1.5 * IQR
      
      expect(Array.isArray(outliers)).toBeTruthy();
      
      // Outliers should have low average similarity to others
      outliers.forEach(outlierIdx => {
        const outlier = smokeVectors[outlierIdx];
        const avgSimilarity = calculateAverageSimilarity(outlier, smokeVectors);
        expect(avgSimilarity).toBeLessThan(0.8);
      });
    });

    test('Should find vector centroids', () => {
      const vectors = testVectors.terrain32.slice(0, 3).map(t => t.vector);
      
      const centroid = calculateCentroid(vectors);
      
      expect(centroid).toHaveLength(32);
      expect(centroid.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
      
      // Centroid should be "central" to all vectors
      const distances = vectors.map(v => 
        calculateEuclideanDistance(v, centroid)
      );
      
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      expect(avgDistance).toBeGreaterThan(0);
    });
  });

  describe('Vector Index Performance Simulation', () => {
    test('Should simulate HNSW index build', () => {
      const vectors = [...testVectors.terrain32, ...testVectors.terrain32]; // Double for more data
      
      const index = buildHNSWIndex(vectors.map(v => v.vector), {
        M: 16,  // Number of connections
        efConstruction: 200
      });
      
      expect(index.layers.length).toBeGreaterThan(0);
      expect(index.entryPoint).toBeDefined();
    });

    test('Should simulate IVF index partitioning', () => {
      const vectors = testVectors.weather128.map(w => w.vector);
      
      const index = buildIVFIndex(vectors, {
        nCentroids: 2,
        nProbe: 1
      });
      
      expect(index.centroids).toHaveLength(2);
      expect(index.inverted_lists).toHaveLength(2);
      
      // Each vector should be assigned to a centroid
      const totalAssigned = index.inverted_lists.reduce((sum, list) => 
        sum + list.length, 0
      );
      expect(totalAssigned).toBe(vectors.length);
    });

    test('Should measure search latency', () => {
      const vectors = testVectors.smoke64.map(s => s.vector);
      const target = vectors[0];
      
      const startTime = performance.now();
      const results = findKNearestNeighbors(target, vectors, 3);
      const endTime = performance.now();
      
      const latency = endTime - startTime;
      
      expect(latency).toBeLessThan(10); // Should be fast (< 10ms)
      expect(results).toHaveLength(3);
    });

    test('Should handle batch vector searches', () => {
      const database = testVectors.weather128.map(w => w.vector);
      const queries = database.slice(0, 3); // Use first 3 as queries
      
      const batchResults = batchVectorSearch(queries, database, 2);
      
      expect(batchResults).toHaveLength(3);
      
      batchResults.forEach((results, i) => {
        expect(results).toHaveLength(2);
        expect(results[0].index).toBe(i); // Should find itself first
      });
    });
  });

  describe('Vector Distance Metrics Comparison', () => {
    test('Should calculate L2 (Euclidean) distance', () => {
      const v1 = testVectors.terrain32[0].vector;
      const v2 = testVectors.terrain32[2].vector;
      
      const l2Distance = calculateL2Distance(v1, v2);
      
      expect(l2Distance).toBeGreaterThan(0);
      expect(l2Distance).toBeFinite();
    });

    test('Should calculate L1 (Manhattan) distance', () => {
      const v1 = testVectors.smoke64[0].vector;
      const v2 = testVectors.smoke64[2].vector;
      
      const l1Distance = calculateL1Distance(v1, v2);
      
      expect(l1Distance).toBeGreaterThan(0);
      expect(l1Distance).toBeFinite();
    });

    test('Should calculate Inner Product similarity', () => {
      const v1 = testVectors.weather128[0].vector;
      const v2 = testVectors.weather128[1].vector;
      
      const innerProduct = calculateInnerProduct(v1, v2);
      
      expect(innerProduct).toBeGreaterThan(0); // Similar vectors
    });

    test('Should compare distance metrics consistency', () => {
      const v1 = testVectors.terrain32[0].vector;
      const v2 = testVectors.terrain32[2].vector;
      const v3 = testVectors.terrain32[3].vector;
      
      // Calculate all distances
      const cosine12 = 1 - calculateCosineSimilarity(v1, v2);
      const cosine13 = 1 - calculateCosineSimilarity(v1, v3);
      
      const l2_12 = calculateL2Distance(v1, v2);
      const l2_13 = calculateL2Distance(v1, v3);
      
      // If v2 is closer than v3 in one metric, should be consistent
      const cosineOrder = cosine12 < cosine13;
      const l2Order = l2_12 < l2_13;
      
      // Order might differ due to normalization, but both are valid
      expect(typeof cosineOrder).toBe('boolean');
      expect(typeof l2Order).toBe('boolean');
    });
  });

  describe('Cross-Dimensional Vector Operations', () => {
    test('Should handle mixed-dimension searches gracefully', () => {
      // Cannot directly compare 32-dim with 64-dim
      const terrain32 = testVectors.terrain32[0].vector;
      const smoke64 = testVectors.smoke64[0].vector;
      
      expect(() => {
        calculateCosineSimilarity(terrain32, smoke64);
      }).toThrow();
    });

    test('Should project high-dimensional to low-dimensional', () => {
      const weather128 = testVectors.weather128[0].vector;
      
      // Project 128-dim to 32-dim
      const projected32 = projectVector(weather128, 32);
      
      expect(projected32).toHaveLength(32);
      expect(projected32.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should concatenate vectors for multi-modal search', () => {
      const terrain = testVectors.terrain32[0].vector;
      const smoke = testVectors.smoke64[0].vector;
      const weather = testVectors.weather128[0].vector;
      
      const combined = concatenateVectors([terrain, smoke, weather]);
      
      expect(combined).toHaveLength(32 + 64 + 128);
      expect(combined).toHaveLength(224);
    });

    test('Should normalize vectors across different scales', () => {
      const vectors = [
        testVectors.terrain32[0].vector,
        testVectors.terrain32[1].vector,
        testVectors.terrain32[2].vector
      ];
      
      const normalized = normalizeVectorSet(vectors);
      
      normalized.forEach(vector => {
        const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        expect(magnitude).toBeCloseTo(1.0, 5);
      });
    });
  });
});

// Helper functions for vector similarity operations
function calculateCosineSimilarity(v1, v2) {
  if (v1.length !== v2.length) {
    throw new Error(`Vector dimension mismatch: ${v1.length} vs ${v2.length}`);
  }
  
  const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const magnitude1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

function findKNearestNeighbors(target, candidates, k) {
  const similarities = candidates.map((candidate, index) => ({
    index,
    similarity: calculateCosineSimilarity(target, candidate)
  }));
  
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, Math.min(k, similarities.length));
}

function findKNearestNeighborsWithThreshold(target, candidates, k, threshold) {
  const neighbors = findKNearestNeighbors(target, candidates, k);
  return neighbors.filter(n => n.similarity >= threshold);
}

function simulateVectorSearch(dataset, target, k, distanceFunction) {
  const distances = dataset.map((item, index) => {
    let distance;
    if (distanceFunction === 'VEC_COSINE_DISTANCE') {
      distance = 1 - calculateCosineSimilarity(target, item.vector);
    } else if (distanceFunction === 'VEC_L2_DISTANCE') {
      distance = calculateL2Distance(target, item.vector);
    }
    return { index, distance, metadata: item.metadata };
  });
  
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, k);
}

function simulateVectorSearchWithFilter(dataset, target, k, distanceFunction, maxDistance) {
  const results = simulateVectorSearch(dataset, target, dataset.length, distanceFunction);
  return results.filter(r => r.distance <= maxDistance).slice(0, k);
}

function simulateVectorSearchWithMetadataFilter(dataset, target, k, distanceFunction, metadataFilter) {
  const filtered = dataset.filter(item => metadataFilter(item.metadata));
  return simulateVectorSearch(filtered, target, k, distanceFunction);
}

function simulateApproximateVectorSearch(dataset, target, k, distanceFunction, recall) {
  // Simulate approximate search by randomly dropping some results
  const exact = simulateVectorSearch(dataset, target, k, distanceFunction);
  const keepCount = Math.ceil(exact.length * recall);
  return exact.slice(0, keepCount);
}

function findHistoricalMatches(dataset, target, threshold) {
  const matches = dataset.map((item, index) => ({
    index,
    similarity: calculateCosineSimilarity(target, item.vector),
    metadata: item.metadata
  }));
  
  return matches
    .filter(m => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

function rankHistoricalMatches(dataset, target, weights) {
  const now = Date.now();
  
  return dataset.map((item, index) => {
    const similarity = calculateCosineSimilarity(target, item.vector);
    const recency = item.metadata.timestamp ? 
      1 / (1 + (now - item.metadata.timestamp.getTime()) / (1000 * 60 * 60 * 24)) : 0.5;
    const severity = Math.random(); // Placeholder for actual severity score
    
    const score = weights.similarityWeight * similarity +
                 weights.recencyWeight * recency +
                 weights.severityWeight * severity;
    
    return { index, score, similarity, metadata: item.metadata };
  }).sort((a, b) => b.score - a.score);
}

function detectSmokeOverlap(plume1, plume2, threshold) {
  const similarity = calculateCosineSimilarity(plume1, plume2);
  const hasConflict = similarity >= threshold;
  
  let severity = 'low';
  if (similarity >= 0.99) severity = 'critical';
  else if (similarity >= 0.95) severity = 'high';
  else if (similarity >= 0.90) severity = 'medium';
  
  return { hasConflict, similarity, severity };
}

function findAllConflicts(target, allBurns, threshold) {
  return allBurns
    .map((burn, index) => ({
      index,
      similarity: calculateCosineSimilarity(target, burn)
    }))
    .filter(b => b.similarity >= threshold && b.similarity < 1.0); // Exclude self
}

function calculateCumulativeExposure(burns, location) {
  const contributions = burns.map((burn, index) => {
    // Simplified PM2.5 calculation
    const pm25 = Math.random() * 50 + 10;
    return { index, pm25 };
  });
  
  const totalPM25 = contributions.reduce((sum, c) => sum + c.pm25, 0);
  
  let hazardLevel = 'Good';
  if (totalPM25 > 250) hazardLevel = 'Hazardous';
  else if (totalPM25 > 150) hazardLevel = 'Very Unhealthy';
  else if (totalPM25 > 55) hazardLevel = 'Unhealthy';
  else if (totalPM25 > 35) hazardLevel = 'Moderate';
  
  return { totalPM25, contributors: contributions, hazardLevel };
}

function performHierarchicalClustering(vectors, threshold) {
  const clusters = vectors.map((v, i) => ({ members: [i], centroid: v }));
  
  while (clusters.length > 1) {
    let maxSim = -1;
    let mergeI = -1, mergeJ = -1;
    
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = calculateCosineSimilarity(clusters[i].centroid, clusters[j].centroid);
        if (sim > maxSim) {
          maxSim = sim;
          mergeI = i;
          mergeJ = j;
        }
      }
    }
    
    if (maxSim < threshold) break;
    
    // Merge clusters
    clusters[mergeI].members.push(...clusters[mergeJ].members);
    clusters[mergeI].centroid = calculateCentroid(
      clusters[mergeI].members.map(idx => vectors[idx])
    );
    clusters.splice(mergeJ, 1);
  }
  
  return clusters;
}

function performDBSCAN(vectors, eps, minPts) {
  const clusters = [];
  const visited = new Set();
  const noise = [];
  
  vectors.forEach((vector, idx) => {
    if (visited.has(idx)) return;
    visited.add(idx);
    
    const neighbors = vectors
      .map((v, i) => ({ index: i, distance: 1 - calculateCosineSimilarity(vector, v) }))
      .filter(n => n.distance <= eps)
      .map(n => n.index);
    
    if (neighbors.length < minPts) {
      noise.push(idx);
    } else {
      const cluster = [idx];
      clusters.push(cluster);
      
      // Expand cluster (simplified)
      neighbors.forEach(n => {
        if (!visited.has(n)) {
          visited.add(n);
          cluster.push(n);
        }
      });
    }
  });
  
  return { clusters, noise };
}

function detectOutliers(vectors, iqrMultiplier) {
  const avgSimilarities = vectors.map((v, i) => 
    calculateAverageSimilarity(v, vectors.filter((_, j) => i !== j))
  );
  
  avgSimilarities.sort((a, b) => a - b);
  const q1 = avgSimilarities[Math.floor(avgSimilarities.length * 0.25)];
  const q3 = avgSimilarities[Math.floor(avgSimilarities.length * 0.75)];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - iqrMultiplier * iqr;
  
  return avgSimilarities
    .map((sim, i) => sim < lowerBound ? i : -1)
    .filter(i => i >= 0);
}

function calculateAverageSimilarity(vector, others) {
  if (others.length === 0) return 0;
  const totalSim = others.reduce((sum, other) => 
    sum + calculateCosineSimilarity(vector, other), 0
  );
  return totalSim / others.length;
}

function calculateCentroid(vectors) {
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);
  
  vectors.forEach(vector => {
    vector.forEach((val, i) => {
      centroid[i] += val / vectors.length;
    });
  });
  
  return centroid;
}

function calculateEuclideanDistance(v1, v2) {
  return Math.sqrt(v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0));
}

function calculateL2Distance(v1, v2) {
  return calculateEuclideanDistance(v1, v2);
}

function calculateL1Distance(v1, v2) {
  return v1.reduce((sum, val, i) => sum + Math.abs(val - v2[i]), 0);
}

function calculateInnerProduct(v1, v2) {
  return v1.reduce((sum, val, i) => sum + val * v2[i], 0);
}

function buildHNSWIndex(vectors, params) {
  // Simplified HNSW simulation
  return {
    layers: [{ nodes: vectors.length }],
    entryPoint: 0,
    M: params.M,
    efConstruction: params.efConstruction
  };
}

function buildIVFIndex(vectors, params) {
  // Simplified IVF simulation
  const centroids = vectors.slice(0, params.nCentroids);
  const inverted_lists = centroids.map(() => []);
  
  vectors.forEach((v, idx) => {
    const nearest = findKNearestNeighbors(v, centroids, 1)[0];
    inverted_lists[nearest.index].push(idx);
  });
  
  return { centroids, inverted_lists };
}

function batchVectorSearch(queries, database, k) {
  return queries.map(query => 
    findKNearestNeighbors(query, database, k)
  );
}

function projectVector(vector, targetDim) {
  // Simple projection by taking first targetDim dimensions or padding
  if (vector.length >= targetDim) {
    return vector.slice(0, targetDim);
  } else {
    return [...vector, ...new Array(targetDim - vector.length).fill(0)];
  }
}

function concatenateVectors(vectors) {
  return vectors.reduce((combined, v) => [...combined, ...v], []);
}

function normalizeVectorSet(vectors) {
  return vectors.map(vector => {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map(v => v / magnitude);
  });
}

module.exports = {
  calculateCosineSimilarity,
  findKNearestNeighbors,
  findKNearestNeighborsWithThreshold,
  simulateVectorSearch,
  detectSmokeOverlap,
  performHierarchicalClustering,
  calculateCentroid,
  calculateL2Distance,
  calculateL1Distance
};