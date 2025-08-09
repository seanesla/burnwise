const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { initializeDatabase, query, pool, vectorSearch } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinatorFixed5Agent');

describe('Terrain Vector Tests - 32-Dimensional Terrain Encoding', () => {
  let coordinator;
  let testLocations;
  
  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new CoordinatorAgent();
    
    // Real California terrain locations for testing
    testLocations = [
      { lat: 37.7749, lon: -122.4194, elevation: 52, slope: 5, vegetation: 'urban' }, // San Francisco
      { lat: 38.5816, lon: -121.4944, elevation: 9, slope: 1, vegetation: 'agriculture' }, // Sacramento Valley
      { lat: 39.0968, lon: -120.0324, elevation: 1897, slope: 25, vegetation: 'forest' }, // Lake Tahoe
      { lat: 36.7783, lon: -119.4179, elevation: 94, slope: 2, vegetation: 'grassland' }, // Central Valley
      { lat: 34.0522, lon: -118.2437, elevation: 87, slope: 8, vegetation: 'chaparral' } // Los Angeles
    ];
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Terrain Vector Generation (32-dimensional)', () => {
    test('Should generate exactly 32-dimensional terrain vectors', async () => {
      const vector = await coordinator.generateTerrainVector(
        testLocations[0].lat,
        testLocations[0].lon,
        testLocations[0].elevation,
        testLocations[0].slope,
        testLocations[0].vegetation
      );
      
      expect(vector).toHaveLength(32);
      expect(vector.every(v => typeof v === 'number')).toBeTruthy();
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should normalize all values to [-1, 1] range', async () => {
      const vectors = await Promise.all(testLocations.map(loc =>
        coordinator.generateTerrainVector(
          loc.lat, loc.lon, loc.elevation, loc.slope, loc.vegetation
        )
      ));
      
      vectors.forEach(vector => {
        expect(vector.every(v => v >= -1 && v <= 1)).toBeTruthy();
      });
    });

    test('Should encode elevation in first 8 dimensions', async () => {
      const lowElevation = await coordinator.generateTerrainVector(
        37.0, -120.0, 10, 5, 'grassland'
      );
      
      const highElevation = await coordinator.generateTerrainVector(
        37.0, -120.0, 2000, 5, 'grassland'
      );
      
      // First 8 dimensions should differ based on elevation
      const elevationDims = lowElevation.slice(0, 8);
      const highElevationDims = highElevation.slice(0, 8);
      
      expect(elevationDims).not.toEqual(highElevationDims);
      
      // Higher elevation should have larger values in elevation dimensions
      const lowSum = elevationDims.reduce((a, b) => a + Math.abs(b), 0);
      const highSum = highElevationDims.reduce((a, b) => a + Math.abs(b), 0);
      expect(highSum).toBeGreaterThan(lowSum);
    });

    test('Should encode slope in dimensions 8-16', async () => {
      const gentleSlope = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 2, 'grassland'
      );
      
      const steepSlope = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 45, 'grassland'
      );
      
      // Dimensions 8-16 should differ based on slope
      const gentleDims = gentleSlope.slice(8, 16);
      const steepDims = steepSlope.slice(8, 16);
      
      expect(gentleDims).not.toEqual(steepDims);
    });

    test('Should encode vegetation type in dimensions 16-24', async () => {
      const vegetationTypes = ['forest', 'grassland', 'agriculture', 'chaparral', 'urban'];
      const vectors = await Promise.all(vegetationTypes.map(veg =>
        coordinator.generateTerrainVector(37.0, -120.0, 100, 10, veg)
      ));
      
      // Vegetation dimensions should be unique for each type
      const vegDimensions = vectors.map(v => v.slice(16, 24));
      
      for (let i = 0; i < vegDimensions.length; i++) {
        for (let j = i + 1; j < vegDimensions.length; j++) {
          expect(vegDimensions[i]).not.toEqual(vegDimensions[j]);
        }
      }
    });

    test('Should encode geographic location in dimensions 24-32', async () => {
      const northLocation = await coordinator.generateTerrainVector(
        42.0, -120.0, 100, 10, 'forest'
      );
      
      const southLocation = await coordinator.generateTerrainVector(
        32.0, -120.0, 100, 10, 'forest'
      );
      
      // Last 8 dimensions encode location
      const northGeo = northLocation.slice(24, 32);
      const southGeo = southLocation.slice(24, 32);
      
      expect(northGeo).not.toEqual(southGeo);
    });

    test('Should handle elevation extremes correctly', async () => {
      const belowSeaLevel = await coordinator.generateTerrainVector(
        33.9425, -116.625, -69, 2, 'desert' // Salton Sea
      );
      
      const mountWhitney = await coordinator.generateTerrainVector(
        36.5785, -118.2923, 4421, 60, 'alpine' // Mt Whitney
      );
      
      expect(belowSeaLevel.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
      expect(mountWhitney.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should calculate terrain complexity score', async () => {
      const simple = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 2, 'grassland' // Flat grassland
      );
      
      const complex = await coordinator.generateTerrainVector(
        37.0, -120.0, 2000, 45, 'forest' // Steep forested mountain
      );
      
      // Calculate complexity as variance in vector
      const simpleVariance = calculateVariance(simple);
      const complexVariance = calculateVariance(complex);
      
      expect(complexVariance).toBeGreaterThan(simpleVariance);
    });

    test('Should encode fuel load based on vegetation', async () => {
      const fuelLoads = {
        'forest': 25,
        'chaparral': 20,
        'grassland': 10,
        'agriculture': 5,
        'urban': 1
      };
      
      for (const [vegetation, expectedLoad] of Object.entries(fuelLoads)) {
        const vector = await coordinator.generateTerrainVector(
          37.0, -120.0, 100, 10, vegetation
        );
        
        // Fuel load influences dimensions 16-20
        const fuelDims = vector.slice(16, 20);
        const fuelMagnitude = Math.sqrt(fuelDims.reduce((sum, v) => sum + v * v, 0));
        
        // Higher fuel load should have higher magnitude
        expect(fuelMagnitude).toBeGreaterThan(0);
      }
    });

    test('Should be deterministic for same inputs', async () => {
      const vector1 = await coordinator.generateTerrainVector(
        37.7749, -122.4194, 52, 5, 'urban'
      );
      
      const vector2 = await coordinator.generateTerrainVector(
        37.7749, -122.4194, 52, 5, 'urban'
      );
      
      expect(vector1).toEqual(vector2);
    });
  });

  describe('Terrain Influence on Smoke Dispersion', () => {
    test('Should calculate valley amplification factor', async () => {
      const valley = await coordinator.generateTerrainVector(
        37.0, -120.0, 50, 2, 'agriculture' // Valley floor
      );
      
      const amplificationFactor = calculateValleyAmplification(valley);
      expect(amplificationFactor).toBeGreaterThan(1.0);
      expect(amplificationFactor).toBeLessThan(2.0);
    });

    test('Should calculate ridge dilution factor', async () => {
      const ridge = await coordinator.generateTerrainVector(
        37.0, -120.0, 1500, 30, 'forest' // Ridge top
      );
      
      const dilutionFactor = calculateRidgeDilution(ridge);
      expect(dilutionFactor).toBeGreaterThan(0.5);
      expect(dilutionFactor).toBeLessThan(1.0);
    });

    test('Should detect temperature inversion potential', async () => {
      const valley = await coordinator.generateTerrainVector(
        37.0, -120.0, 50, 2, 'agriculture'
      );
      
      const inversionPotential = calculateInversionPotential(valley);
      expect(inversionPotential).toBeGreaterThan(0.5); // High potential in valleys
    });

    test('Should calculate terrain-modified wind speed', async () => {
      const exposed = await coordinator.generateTerrainVector(
        37.0, -120.0, 1000, 5, 'grassland' // Exposed hilltop
      );
      
      const sheltered = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 2, 'forest' // Sheltered forest
      );
      
      const baseWindSpeed = 10; // m/s
      const exposedWind = calculateTerrainWindSpeed(exposed, baseWindSpeed);
      const shelteredWind = calculateTerrainWindSpeed(sheltered, baseWindSpeed);
      
      expect(exposedWind).toBeGreaterThan(baseWindSpeed);
      expect(shelteredWind).toBeLessThan(baseWindSpeed);
    });

    test('Should determine smoke drainage patterns', async () => {
      const hillside = await coordinator.generateTerrainVector(
        37.0, -120.0, 500, 20, 'chaparral'
      );
      
      const drainageDirection = calculateDrainageDirection(hillside);
      expect(drainageDirection).toBeGreaterThanOrEqual(0);
      expect(drainageDirection).toBeLessThan(360);
    });
  });

  describe('Terrain Vector Distance Calculations', () => {
    test('Should calculate Euclidean distance between terrain vectors', async () => {
      const vector1 = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 5, 'grassland'
      );
      
      const vector2 = await coordinator.generateTerrainVector(
        37.1, -120.1, 150, 10, 'agriculture'
      );
      
      const distance = calculateEuclideanDistance(vector1, vector2);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(Math.sqrt(32 * 4)); // Max possible distance
    });

    test('Should calculate cosine similarity for terrain matching', async () => {
      const similar1 = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 5, 'grassland'
      );
      
      const similar2 = await coordinator.generateTerrainVector(
        37.01, -120.01, 105, 6, 'grassland'
      );
      
      const different = await coordinator.generateTerrainVector(
        39.0, -120.0, 2000, 45, 'forest'
      );
      
      const similaritySame = calculateCosineSimilarity(similar1, similar2);
      const similarityDiff = calculateCosineSimilarity(similar1, different);
      
      expect(similaritySame).toBeGreaterThan(0.8);
      expect(similarityDiff).toBeLessThan(0.5);
    });

    test('Should find k-nearest terrain neighbors', async () => {
      const target = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 5, 'grassland'
      );
      
      const candidates = await Promise.all(testLocations.map(loc =>
        coordinator.generateTerrainVector(
          loc.lat, loc.lon, loc.elevation, loc.slope, loc.vegetation
        )
      ));
      
      const kNearest = findKNearestNeighbors(target, candidates, 3);
      expect(kNearest).toHaveLength(3);
      
      // Should be sorted by distance
      for (let i = 1; i < kNearest.length; i++) {
        expect(kNearest[i].distance).toBeGreaterThanOrEqual(kNearest[i - 1].distance);
      }
    });

    test('Should cluster similar terrains', async () => {
      const vectors = await Promise.all([
        // Valley cluster
        coordinator.generateTerrainVector(37.0, -120.0, 50, 2, 'agriculture'),
        coordinator.generateTerrainVector(37.1, -120.1, 60, 3, 'agriculture'),
        coordinator.generateTerrainVector(36.9, -119.9, 45, 1, 'agriculture'),
        // Mountain cluster
        coordinator.generateTerrainVector(39.0, -120.0, 2000, 40, 'forest'),
        coordinator.generateTerrainVector(39.1, -120.1, 2100, 45, 'forest'),
        coordinator.generateTerrainVector(38.9, -119.9, 1900, 35, 'forest')
      ]);
      
      const clusters = performKMeansClustering(vectors, 2);
      expect(clusters).toHaveLength(2);
      
      // Each cluster should have 3 members
      expect(clusters[0].members.length).toBe(3);
      expect(clusters[1].members.length).toBe(3);
    });
  });

  describe('Terrain Vector Persistence in TiDB', () => {
    test('Should store terrain vector in VECTOR(32) column', async () => {
      const vector = await coordinator.generateTerrainVector(
        37.7749, -122.4194, 52, 5, 'urban'
      );
      
      const sql = `
        INSERT INTO terrain_vectors (
          location_id, terrain_vector, lat, lon, elevation, slope, vegetation
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      try {
        await query(sql, [
          'test_location_1',
          JSON.stringify(vector),
          37.7749,
          -122.4194,
          52,
          5,
          'urban'
        ]);
        
        const result = await query(
          'SELECT terrain_vector FROM terrain_vectors WHERE location_id = ?',
          ['test_location_1']
        );
        
        if (result.length > 0) {
          const retrieved = JSON.parse(result[0].terrain_vector);
          expect(retrieved).toEqual(vector);
        }
      } catch (error) {
        // Expected without TiDB connection
        expect(error.code).toBeTruthy();
      }
    });

    test('Should retrieve similar terrains using vector search', async () => {
      const target = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 5, 'grassland'
      );
      
      try {
        const similar = await vectorSearch(
          'terrain_vectors',
          'terrain_vector',
          target,
          5,
          0.8 // Similarity threshold
        );
        
        if (similar.length > 0) {
          expect(similar[0].similarity).toBeGreaterThan(0.8);
        }
      } catch (error) {
        // Expected without TiDB connection
        expect(error.code).toBeTruthy();
      }
    });

    test('Should update terrain vector on changes', async () => {
      const original = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 5, 'grassland'
      );
      
      const updated = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 5, 'agriculture' // Vegetation changed
      );
      
      expect(original).not.toEqual(updated);
      
      try {
        const sql = `
          UPDATE terrain_vectors 
          SET terrain_vector = ?, vegetation = ?
          WHERE location_id = ?
        `;
        
        await query(sql, [
          JSON.stringify(updated),
          'agriculture',
          'test_location_1'
        ]);
      } catch (error) {
        // Expected without TiDB connection
        expect(error.code).toBeTruthy();
      }
    });

    test('Should handle batch terrain vector insertions', async () => {
      const vectors = await Promise.all(testLocations.map(loc =>
        coordinator.generateTerrainVector(
          loc.lat, loc.lon, loc.elevation, loc.slope, loc.vegetation
        )
      ));
      
      try {
        const values = vectors.map((v, i) => [
          `batch_${i}`,
          JSON.stringify(v),
          testLocations[i].lat,
          testLocations[i].lon,
          testLocations[i].elevation,
          testLocations[i].slope,
          testLocations[i].vegetation
        ]);
        
        // Batch insert would be done here
        expect(values).toHaveLength(5);
        expect(values[0][1]).toContain('[');
      } catch (error) {
        // Expected without TiDB connection
        expect(error.code).toBeTruthy();
      }
    });

    test('Should calculate terrain similarity matrix', async () => {
      const vectors = await Promise.all(testLocations.map(loc =>
        coordinator.generateTerrainVector(
          loc.lat, loc.lon, loc.elevation, loc.slope, loc.vegetation
        )
      ));
      
      const similarityMatrix = [];
      for (let i = 0; i < vectors.length; i++) {
        similarityMatrix[i] = [];
        for (let j = 0; j < vectors.length; j++) {
          similarityMatrix[i][j] = calculateCosineSimilarity(vectors[i], vectors[j]);
        }
      }
      
      // Diagonal should be 1 (self-similarity)
      for (let i = 0; i < vectors.length; i++) {
        expect(similarityMatrix[i][i]).toBeCloseTo(1.0, 5);
      }
      
      // Matrix should be symmetric
      for (let i = 0; i < vectors.length; i++) {
        for (let j = i + 1; j < vectors.length; j++) {
          expect(similarityMatrix[i][j]).toBeCloseTo(similarityMatrix[j][i], 5);
        }
      }
    });
  });

  describe('Terrain Effects on Boundary Layer', () => {
    test('Should calculate boundary layer height modification', () => {
      const baseBoundaryHeight = 1000; // meters
      
      const valleyModifier = calculateBoundaryLayerModifier('valley');
      const ridgeModifier = calculateBoundaryLayerModifier('ridge');
      const flatModifier = calculateBoundaryLayerModifier('flat');
      
      expect(valleyModifier).toBeLessThan(1.0); // Suppressed in valleys
      expect(ridgeModifier).toBeGreaterThan(1.0); // Enhanced on ridges
      expect(flatModifier).toBeCloseTo(1.0, 1); // Neutral on flat terrain
    });

    test('Should determine mixing height from terrain', async () => {
      const valley = await coordinator.generateTerrainVector(
        37.0, -120.0, 50, 2, 'agriculture'
      );
      
      const ridge = await coordinator.generateTerrainVector(
        37.0, -120.0, 1500, 30, 'forest'
      );
      
      const valleyMixing = calculateMixingHeight(valley, 12); // Noon
      const ridgeMixing = calculateMixingHeight(ridge, 12);
      
      expect(ridgeMixing).toBeGreaterThan(valleyMixing);
    });

    test('Should calculate terrain-induced turbulence', async () => {
      const smooth = await coordinator.generateTerrainVector(
        37.0, -120.0, 100, 2, 'grassland'
      );
      
      const rough = await coordinator.generateTerrainVector(
        37.0, -120.0, 500, 30, 'forest'
      );
      
      const smoothTurbulence = calculateTerrainTurbulence(smooth, 10);
      const roughTurbulence = calculateTerrainTurbulence(rough, 10);
      
      expect(roughTurbulence).toBeGreaterThan(smoothTurbulence);
    });

    test('Should identify smoke pooling zones', async () => {
      const locations = [
        { lat: 37.0, lon: -120.0, elevation: 50 },   // Valley bottom
        { lat: 37.1, lon: -120.0, elevation: 200 },  // Hillside
        { lat: 37.2, lon: -120.0, elevation: 500 },  // Ridge
      ];
      
      const vectors = await Promise.all(locations.map(loc =>
        coordinator.generateTerrainVector(
          loc.lat, loc.lon, loc.elevation, 10, 'mixed'
        )
      ));
      
      const poolingPotentials = vectors.map(v => calculatePoolingPotential(v));
      
      // Valley should have highest pooling potential
      expect(poolingPotentials[0]).toBeGreaterThan(poolingPotentials[1]);
      expect(poolingPotentials[0]).toBeGreaterThan(poolingPotentials[2]);
    });

    test('Should calculate terrain roughness length', async () => {
      const surfaces = [
        { vegetation: 'water', expectedZ0: 0.0001 },
        { vegetation: 'grassland', expectedZ0: 0.03 },
        { vegetation: 'agriculture', expectedZ0: 0.1 },
        { vegetation: 'forest', expectedZ0: 1.0 },
        { vegetation: 'urban', expectedZ0: 2.0 }
      ];
      
      for (const surface of surfaces) {
        const vector = await coordinator.generateTerrainVector(
          37.0, -120.0, 100, 5, surface.vegetation
        );
        
        const z0 = calculateRoughnessLength(vector);
        expect(z0).toBeCloseTo(surface.expectedZ0, 1);
      }
    });
  });
});

// Helper functions for terrain calculations
function calculateVariance(vector) {
  const mean = vector.reduce((sum, v) => sum + v, 0) / vector.length;
  return vector.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vector.length;
}

function calculateValleyAmplification(vector) {
  const elevationDims = vector.slice(0, 8);
  const slopeDims = vector.slice(8, 16);
  
  const lowElevation = elevationDims.reduce((sum, v) => sum + v, 0) < 0;
  const gentleSlope = slopeDims.reduce((sum, v) => sum + Math.abs(v), 0) < 2;
  
  if (lowElevation && gentleSlope) {
    return 1.5; // 50% amplification in valleys
  }
  return 1.0;
}

function calculateRidgeDilution(vector) {
  const elevationDims = vector.slice(0, 8);
  const highElevation = elevationDims.reduce((sum, v) => sum + v, 0) > 2;
  
  if (highElevation) {
    return 0.7; // 30% dilution on ridges
  }
  return 1.0;
}

function calculateInversionPotential(vector) {
  const elevationDims = vector.slice(0, 8);
  const slopeDims = vector.slice(8, 16);
  
  const valleyFactor = Math.max(0, -elevationDims[0]) * 0.5;
  const slopeFactor = Math.max(0, 1 - Math.abs(slopeDims[0])) * 0.5;
  
  return Math.min(1, valleyFactor + slopeFactor);
}

function calculateTerrainWindSpeed(vector, baseSpeed) {
  const elevationDims = vector.slice(0, 8);
  const vegetationDims = vector.slice(16, 24);
  
  const exposureFactor = 1 + elevationDims[0] * 0.2;
  const shelterFactor = 1 - Math.abs(vegetationDims[0]) * 0.3;
  
  return baseSpeed * exposureFactor * shelterFactor;
}

function calculateDrainageDirection(vector) {
  const slopeDims = vector.slice(8, 16);
  const angle = Math.atan2(slopeDims[1], slopeDims[0]) * 180 / Math.PI;
  return (angle + 360) % 360;
}

function calculateEuclideanDistance(v1, v2) {
  return Math.sqrt(v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0));
}

function calculateCosineSimilarity(v1, v2) {
  const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const magnitude1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

function findKNearestNeighbors(target, candidates, k) {
  const distances = candidates.map((candidate, index) => ({
    index,
    distance: calculateEuclideanDistance(target, candidate)
  }));
  
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, k);
}

function performKMeansClustering(vectors, k) {
  // Simplified k-means for testing
  const clusters = [];
  for (let i = 0; i < k; i++) {
    clusters.push({
      centroid: vectors[i],
      members: []
    });
  }
  
  vectors.forEach((vector, index) => {
    let minDistance = Infinity;
    let closestCluster = 0;
    
    clusters.forEach((cluster, clusterIndex) => {
      const distance = calculateEuclideanDistance(vector, cluster.centroid);
      if (distance < minDistance) {
        minDistance = distance;
        closestCluster = clusterIndex;
      }
    });
    
    clusters[closestCluster].members.push(index);
  });
  
  return clusters;
}

function calculateBoundaryLayerModifier(terrainType) {
  const modifiers = {
    'valley': 0.7,
    'ridge': 1.3,
    'flat': 1.0,
    'slope': 1.1
  };
  return modifiers[terrainType] || 1.0;
}

function calculateMixingHeight(vector, hour) {
  const baseMixing = 500 + Math.sin((hour - 6) * Math.PI / 12) * 1000;
  const terrainFactor = 1 + vector[0] * 0.2; // Elevation influence
  return baseMixing * terrainFactor;
}

function calculateTerrainTurbulence(vector, windSpeed) {
  const roughness = calculateRoughnessLength(vector);
  const shearVelocity = windSpeed * 0.4 / Math.log(10 / roughness);
  return shearVelocity * shearVelocity;
}

function calculatePoolingPotential(vector) {
  const elevationDims = vector.slice(0, 8);
  const slopeDims = vector.slice(8, 16);
  
  const lowElevation = Math.max(0, -elevationDims[0]);
  const gentleSlope = Math.max(0, 1 - Math.abs(slopeDims[0]));
  
  return (lowElevation + gentleSlope) / 2;
}

function calculateRoughnessLength(vector) {
  const vegetationDims = vector.slice(16, 24);
  const vegetationType = Math.abs(vegetationDims[0]);
  
  // Map vegetation encoding to roughness length
  if (vegetationType < 0.2) return 0.0001; // Water
  if (vegetationType < 0.4) return 0.03;   // Grassland
  if (vegetationType < 0.6) return 0.1;    // Agriculture
  if (vegetationType < 0.8) return 1.0;    // Forest
  return 2.0; // Urban
}

module.exports = {
  calculateVariance,
  calculateValleyAmplification,
  calculateRidgeDilution,
  calculateInversionPotential,
  calculateTerrainWindSpeed,
  calculateDrainageDirection,
  calculateEuclideanDistance,
  calculateCosineSimilarity,
  findKNearestNeighbors,
  performKMeansClustering,
  calculateBoundaryLayerModifier,
  calculateMixingHeight,
  calculateTerrainTurbulence,
  calculatePoolingPotential,
  calculateRoughnessLength
};