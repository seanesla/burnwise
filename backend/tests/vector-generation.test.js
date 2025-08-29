/**
 * BURNWISE Vector Generation Ultra-Deep Testing Suite
 * 
 * Tests all vector generation functions across all agents with comprehensive edge cases.
 * This ensures mathematical robustness and prevents NaN/Infinity values in production.
 */

const BurnRequestCoordinator = require('../agents/coordinator');
const WeatherAgent = require('../agents/weather');
const SmokeOverlapPredictor = require('../agents/predictor');

describe('Vector Generation Ultra-Deep Testing', () => {
  let coordinator, weatherAgent, predictor;

  beforeEach(() => {
    coordinator = new BurnRequestCoordinator();
    weatherAgent = new WeatherAgent();
    predictor = new SmokeOverlapPredictor();
  });

  describe('Terrain Vector Generation (32-dimensional)', () => {
    
    test('should generate valid 32-dimensional vector for normal inputs', () => {
      const requestData = {
        elevationMeters: 300,
        terrainSlope: 15,
        fuelLoadTonsPerHectare: 20,
        requestedDate: '2025-08-15'
      };
      const areaHectares = 50;
      const center = [-120.5, 40.2];

      const vector = coordinator.generateTerrainVector(requestData, areaHectares, center);

      expect(vector).toHaveLength(32);
      vector.forEach((value, index) => {
        expect(value).toBeFinite();
        expect(value).not.toBeNaN();
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(10);
      });
    });

    test('should handle null/undefined inputs gracefully', () => {
      const testCases = [
        { requestData: null, areaHectares: null, center: null },
        { requestData: undefined, areaHectares: undefined, center: undefined },
        { requestData: {}, areaHectares: 0, center: [] },
        { requestData: {}, areaHectares: -5, center: [null, undefined] },
        { requestData: { elevationMeters: null }, areaHectares: NaN, center: [Infinity, -Infinity] }
      ];

      testCases.forEach((testCase, index) => {
        const vector = coordinator.generateTerrainVector(
          testCase.requestData, 
          testCase.areaHectares, 
          testCase.center
        );
        
        expect(vector).toHaveLength(32);
        vector.forEach((value, vectorIndex) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
        }, `Test case ${index} failed at vector index ${vectorIndex}`);
      });
    });

    test('should handle extreme values without overflow', () => {
      const extremeCases = [
        {
          requestData: {
            elevationMeters: 999999,
            terrainSlope: 999,
            fuelLoadTonsPerHectare: 999999,
            requestedDate: '1900-01-01'
          },
          areaHectares: 999999,
          center: [180, 90]
        },
        {
          requestData: {
            elevationMeters: -999999,
            terrainSlope: -999,
            fuelLoadTonsPerHectare: -999999,
            requestedDate: '2100-12-31'
          },
          areaHectares: -999999,
          center: [-180, -90]
        },
        {
          requestData: {
            elevationMeters: 0.0001,
            terrainSlope: 0.0001,
            fuelLoadTonsPerHectare: 0.0001,
            requestedDate: '2025-02-29' // leap year edge case
          },
          areaHectares: 0.0001,
          center: [0.0001, 0.0001]
        }
      ];

      extremeCases.forEach((testCase, index) => {
        const vector = coordinator.generateTerrainVector(
          testCase.requestData,
          testCase.areaHectares,
          testCase.center
        );

        expect(vector).toHaveLength(32);
        vector.forEach((value, vectorIndex) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
          expect(value).toBeGreaterThanOrEqual(-10);
          expect(value).toBeLessThanOrEqual(10);
        }, `Extreme case ${index} failed at vector index ${vectorIndex}`);
      });
    });

    test('should produce consistent results for same inputs', () => {
      const requestData = {
        elevationMeters: 250,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 18,
        requestedDate: '2025-08-15'
      };
      const areaHectares = 45.7;
      const center = [-119.8, 39.9];

      const vector1 = coordinator.generateTerrainVector(requestData, areaHectares, center);
      const vector2 = coordinator.generateTerrainVector(requestData, areaHectares, center);

      expect(vector1).toEqual(vector2);
    });

    test('should handle various date formats and edge cases', () => {
      const dateCases = [
        '2025-12-31T23:59:59.999Z',
        '2025-01-01T00:00:00.000Z',
        '2025-02-29', // leap year
        '2024-02-29', // non-leap year  
        'invalid-date',
        '',
        null,
        undefined,
        new Date('2025-08-15'),
        1723680000000 // timestamp
      ];

      dateCases.forEach((date, index) => {
        const requestData = {
          elevationMeters: 200,
          terrainSlope: 10,
          fuelLoadTonsPerHectare: 15,
          requestedDate: date
        };
        
        const vector = coordinator.generateTerrainVector(requestData, 50, [-120, 40]);
        
        expect(vector).toHaveLength(32);
        vector.forEach((value, vectorIndex) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
        }, `Date case ${index} (${date}) failed at vector index ${vectorIndex}`);
      });
    });

    test('should normalize location coordinates correctly', () => {
      const locationCases = [
        { center: [-180, -90], expectedNormalized: [-1, -1] }, // min bounds
        { center: [180, 90], expectedNormalized: [1, 1] },     // max bounds
        { center: [0, 0], expectedNormalized: [0, 0] },        // origin
        { center: [-120, 40], expectedNormalized: [-0.6667, 0.4444] }, // typical US
        { center: [151.2093, -33.8688], expectedNormalized: [0.8401, -0.3765] } // Sydney
      ];

      locationCases.forEach(({ center, expectedNormalized }, index) => {
        const vector = coordinator.generateTerrainVector({
          elevationMeters: 100,
          terrainSlope: 5,
          fuelLoadTonsPerHectare: 10,
          requestedDate: '2025-08-15'
        }, 50, center);

        // Check longitude normalization (index 0)
        expect(vector[0]).toBeCloseTo(expectedNormalized[0], 3);
        // Check latitude normalization (index 1) 
        expect(vector[1]).toBeCloseTo(expectedNormalized[1], 3);
      });
    });
  });

  describe('Weather Vector Generation (128-dimensional)', () => {
    
    test('should generate valid 128-dimensional weather embedding', () => {
      const weatherData = {
        temperature: 25,
        humidity: 65,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013.25,
        visibility: 10000,
        cloudCover: 30,
        precipitation: 0,
        uvIndex: 7,
        dewPoint: 15
      };

      const embedding = weatherAgent.createWeatherEmbedding(weatherData);

      expect(embedding).toHaveLength(128);
      embedding.forEach((value, index) => {
        expect(value).toBeFinite();
        expect(value).not.toBeNaN();
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(10);
      });
    });

    test('should handle missing weather data gracefully', () => {
      const incompleteCases = [
        {},
        { temperature: null },
        { humidity: undefined },
        { windSpeed: NaN },
        { pressure: Infinity },
        { visibility: -1 },
        null,
        undefined
      ];

      incompleteCases.forEach((weatherData, index) => {
        const embedding = weatherAgent.createWeatherEmbedding(weatherData);
        
        expect(embedding).toHaveLength(128);
        embedding.forEach((value, vectorIndex) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
        }, `Incomplete weather case ${index} failed at vector index ${vectorIndex}`);
      });
    });

    test('should handle extreme weather conditions', () => {
      const extremeWeatherCases = [
        {
          name: 'Arctic conditions',
          data: {
            temperature: -50,
            humidity: 95,
            windSpeed: 50,
            windDirection: 360,
            pressure: 950,
            visibility: 100,
            cloudCover: 100
          }
        },
        {
          name: 'Desert conditions',
          data: {
            temperature: 60,
            humidity: 5,
            windSpeed: 0,
            windDirection: 0,
            pressure: 1050,
            visibility: 50000,
            cloudCover: 0
          }
        },
        {
          name: 'Hurricane conditions',
          data: {
            temperature: 30,
            humidity: 100,
            windSpeed: 100,
            windDirection: 90,
            pressure: 900,
            visibility: 500,
            cloudCover: 100
          }
        }
      ];

      extremeWeatherCases.forEach(({ name, data }) => {
        const embedding = weatherAgent.createWeatherEmbedding(data);
        
        expect(embedding).toHaveLength(128);
        embedding.forEach((value, index) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
        }, `${name} failed at vector index ${index}`);
      });
    });

    test('should produce different embeddings for different weather patterns', () => {
      const weather1 = { temperature: 10, humidity: 30, windSpeed: 5 };
      const weather2 = { temperature: 30, humidity: 80, windSpeed: 15 };

      const embedding1 = weatherAgent.createWeatherEmbedding(weather1);
      const embedding2 = weatherAgent.createWeatherEmbedding(weather2);

      // Embeddings should be different
      expect(embedding1).not.toEqual(embedding2);
      
      // Calculate cosine distance to ensure they're meaningfully different
      const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
      const norm1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
      const norm2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
      const cosineDistance = 1 - (dotProduct / (norm1 * norm2));
      
      expect(cosineDistance).toBeGreaterThan(0.01); // Should be meaningfully different
    });
  });

  describe('Smoke Vector Generation (64-dimensional)', () => {
    
    test('should generate valid 64-dimensional smoke vector', async () => {
      const requestId = 12345;
      const weather = {
        windSpeed: 8,
        windDirection: 225,
        temperature: 22,
        humidity: 55,
        pressure: 1015
      };
      const areaHectares = 75;

      const smokeVector = await predictor.generateSmokeVector(requestId, weather, areaHectares);

      expect(smokeVector).toHaveLength(64);
      smokeVector.forEach((value, index) => {
        expect(value).toBeFinite();
        expect(value).not.toBeNaN();
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(10);
      });
    });

    test('should handle invalid smoke generation inputs', async () => {
      const invalidCases = [
        { requestId: null, weather: null, areaHectares: null },
        { requestId: undefined, weather: {}, areaHectares: -10 },
        { requestId: 'invalid', weather: { windSpeed: NaN }, areaHectares: Infinity },
        { requestId: 0, weather: undefined, areaHectares: 0 }
      ];

      for (const testCase of invalidCases) {
        const smokeVector = await predictor.generateSmokeVector(
          testCase.requestId,
          testCase.weather,
          testCase.areaHectares
        );

        expect(smokeVector).toHaveLength(64);
        smokeVector.forEach((value, index) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
        });
      }
    });

    test('should scale appropriately with burn area size', async () => {
      const baseWeather = { windSpeed: 5, windDirection: 180, temperature: 25 };
      
      const smallBurn = await predictor.generateSmokeVector(1, baseWeather, 1);
      const mediumBurn = await predictor.generateSmokeVector(2, baseWeather, 100);
      const largeBurn = await predictor.generateSmokeVector(3, baseWeather, 1000);

      // Emission-related components should scale with area
      expect(largeBurn[0]).toBeGreaterThan(mediumBurn[0]); // Emission rate
      expect(mediumBurn[0]).toBeGreaterThan(smallBurn[0]);
      
      // All vectors should be valid
      [smallBurn, mediumBurn, largeBurn].forEach((vector, burnIndex) => {
        vector.forEach((value, vectorIndex) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
        });
      });
    });
  });

  describe('Vector Mathematical Properties', () => {
    
    test('all vectors should maintain unit sphere properties when normalized', () => {
      const requestData = {
        elevationMeters: 200,
        terrainSlope: 8,
        fuelLoadTonsPerHectare: 12,
        requestedDate: '2025-08-15'
      };

      const terrainVector = coordinator.generateTerrainVector(requestData, 50, [-120, 40]);
      
      // Calculate vector magnitude
      const magnitude = Math.sqrt(terrainVector.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeGreaterThan(0);
      expect(magnitude).toBeFinite();

      // Normalize and check properties
      const normalized = terrainVector.map(val => val / magnitude);
      const normalizedMagnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));
      expect(normalizedMagnitude).toBeCloseTo(1.0, 6);
    });

    test('vector components should have reasonable statistical distributions', () => {
      const vectors = [];
      
      // Generate 100 terrain vectors with random but valid inputs
      for (let i = 0; i < 100; i++) {
        const requestData = {
          elevationMeters: Math.random() * 3000,
          terrainSlope: Math.random() * 45,
          fuelLoadTonsPerHectare: Math.random() * 50 + 5,
          requestedDate: `2025-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15`
        };
        const areaHectares = Math.random() * 500 + 10;
        const center = [(Math.random() - 0.5) * 360, (Math.random() - 0.5) * 180];
        
        vectors.push(coordinator.generateTerrainVector(requestData, areaHectares, center));
      }

      // Check that we have reasonable variance across components
      for (let component = 0; component < 32; component++) {
        const values = vectors.map(v => v[component]);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        
        expect(mean).toBeFinite();
        expect(variance).toBeFinite();
        expect(variance).toBeGreaterThanOrEqual(0);
        
        // Most components should have some variance (not all identical)
        if (component < 24) { // Skip temporal components which might be identical
          expect(variance).toBeGreaterThan(0.001);
        }
      }
    });

    test('vector similarity should correlate with input similarity', () => {
      const baseRequest = {
        elevationMeters: 200,
        terrainSlope: 10,
        fuelLoadTonsPerHectare: 15,
        requestedDate: '2025-08-15'
      };
      const baseArea = 50;
      const baseCenter = [-120, 40];

      const baseVector = coordinator.generateTerrainVector(baseRequest, baseArea, baseCenter);
      
      // Very similar request
      const similarRequest = {
        elevationMeters: 205,
        terrainSlope: 11,
        fuelLoadTonsPerHectare: 16,
        requestedDate: '2025-08-15'
      };
      const similarVector = coordinator.generateTerrainVector(similarRequest, 52, [-120.1, 40.1]);

      // Very different request  
      const differentRequest = {
        elevationMeters: 2000,
        terrainSlope: 45,
        fuelLoadTonsPerHectare: 45,
        requestedDate: '2025-12-15'
      };
      const differentVector = coordinator.generateTerrainVector(differentRequest, 500, [150, -30]);

      // Calculate cosine similarities
      const cosineSimilarity = (v1, v2) => {
        const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
        const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
        const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (norm1 * norm2);
      };

      const similaritySimilar = cosineSimilarity(baseVector, similarVector);
      const similarityDifferent = cosineSimilarity(baseVector, differentVector);

      expect(similaritySimilar).toBeGreaterThan(similarityDifferent);
      expect(similaritySimilar).toBeGreaterThan(0.8); // Should be quite similar
      expect(similarityDifferent).toBeLessThan(0.8);   // Should be less similar
    });
  });

  describe('Memory and Performance', () => {
    
    test('should not leak memory during repeated vector generation', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many vectors
      for (let i = 0; i < 1000; i++) {
        const vector = coordinator.generateTerrainVector({
          elevationMeters: i,
          terrainSlope: i % 45,
          fuelLoadTonsPerHectare: (i % 50) + 5,
          requestedDate: '2025-08-15'
        }, i % 500 + 10, [i % 360 - 180, i % 180 - 90]);
        
        // Clear reference to allow GC
        vector.length = 0;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    test('vector generation should complete within reasonable time', () => {
      const startTime = performance.now();
      
      // Generate 100 vectors
      for (let i = 0; i < 100; i++) {
        coordinator.generateTerrainVector({
          elevationMeters: 200 + i,
          terrainSlope: 10 + (i % 35),
          fuelLoadTonsPerHectare: 15 + (i % 30),
          requestedDate: '2025-08-15'
        }, 50 + i, [-120 + i * 0.01, 40 + i * 0.01]);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in under 100ms for 100 vectors
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Vector Storage Format Validation', () => {
    
    test('vectors should serialize to valid TiDB VECTOR format', () => {
      const vector = coordinator.generateTerrainVector({
        elevationMeters: 300,
        terrainSlope: 15,
        fuelLoadTonsPerHectare: 20,
        requestedDate: '2025-08-15'
      }, 75, [-119.5, 39.8]);

      const vectorString = `[${vector.join(',')}]`;
      
      // Should be valid JSON array
      expect(() => JSON.parse(vectorString)).not.toThrow();
      
      // Should not contain NaN or Infinity
      expect(vectorString).not.toContain('NaN');
      expect(vectorString).not.toContain('Infinity');
      expect(vectorString).not.toContain('-Infinity');
      
      // Should be reasonable length for TiDB
      expect(vectorString.length).toBeLessThan(2000); // TiDB text limit
    });

    test('all vector types should be compatible with TiDB vector operations', () => {
      // Test terrain vector (32-dim)
      const terrainVector = coordinator.generateTerrainVector({
        elevationMeters: 200,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 18,
        requestedDate: '2025-08-15'
      }, 60, [-120, 40]);

      // Test weather vector (128-dim)
      const weatherVector = weatherAgent.createWeatherEmbedding({
        temperature: 25,
        humidity: 60,
        windSpeed: 12,
        windDirection: 180
      });

      // All vectors should have correct dimensions
      expect(terrainVector).toHaveLength(32);
      expect(weatherVector).toHaveLength(128);

      // All values should be TiDB-compatible
      [...terrainVector, ...weatherVector].forEach(value => {
        expect(value).toBeFinite();
        expect(value).not.toBeNaN();
        expect(typeof value).toBe('number');
      });
    });
  });
});