const predictorAgent = require('../../agents/predictor');
const { query, vectorSimilaritySearch } = require('../../db/connection');
const logger = require('../../middleware/logger');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');

describe('Predictor Agent Tests', () => {
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
      expect(predictorAgent.isInitialized()).toBe(false);
      expect(() => predictorAgent.initialize()).not.toThrow();
      expect(predictorAgent.isInitialized()).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      const config = {
        maxDispersionRadius: 15000,
        pm25Threshold: 30,
        confidenceThreshold: 0.75
      };
      
      expect(() => predictorAgent.initialize(config)).not.toThrow();
      const status = predictorAgent.getStatus();
      expect(status.config.maxDispersionRadius).toBe(15000);
    });

    test('should handle initialization errors gracefully', () => {
      query.mockRejectedValueOnce(new Error('Database connection failed'));
      expect(() => predictorAgent.initialize()).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    test('should not reinitialize if already initialized', () => {
      predictorAgent.initialize();
      const firstStatus = predictorAgent.getStatus();
      predictorAgent.initialize();
      const secondStatus = predictorAgent.getStatus();
      expect(firstStatus.initializedAt).toEqual(secondStatus.initializedAt);
    });

    test('should validate configuration parameters', () => {
      const invalidConfig = {
        maxDispersionRadius: -1000,
        pm25Threshold: 500,
        confidenceThreshold: 1.5
      };
      
      expect(() => predictorAgent.initialize(invalidConfig)).not.toThrow();
      // Should use defaults for invalid values
      const status = predictorAgent.getStatus();
      expect(status.config.maxDispersionRadius).toBeGreaterThan(0);
    });
  });

  describe('2. Gaussian Plume Model Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should calculate basic Gaussian plume dispersion', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate'
      };

      const weatherData = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 20,
        atmospheric_stability: 'neutral'
      };

      const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
      
      expect(dispersion).toBeDefined();
      expect(dispersion.maxDispersionRadius).toBeGreaterThan(0);
      expect(dispersion.concentrations).toBeInstanceOf(Array);
      expect(dispersion.pm25Predictions).toBeInstanceOf(Array);
    });

    test('should handle different atmospheric stability classes', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 50,
        fuel_type: 'rice_straw',
        burn_intensity: 'low'
      };

      const stabilityClasses = ['very_unstable', 'unstable', 'neutral', 'stable', 'very_stable'];
      
      stabilityClasses.forEach(stability => {
        const weatherData = {
          wind_speed: 3,
          wind_direction: 90,
          temperature: 18,
          atmospheric_stability: stability
        };

        const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
        expect(dispersion.maxDispersionRadius).toBeGreaterThan(0);
        expect(dispersion.stabilityClass).toBe(stability);
      });
    });

    test('should calculate different burn intensities correctly', () => {
      const baseData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 75,
        fuel_type: 'corn_stalks'
      };

      const weatherData = {
        wind_speed: 4,
        wind_direction: 270,
        temperature: 22,
        atmospheric_stability: 'neutral'
      };

      const intensities = ['low', 'moderate', 'high'];
      const results = {};

      intensities.forEach(intensity => {
        const burnData = { ...baseData, burn_intensity: intensity };
        results[intensity] = predictorAgent.calculateGaussianPlume(burnData, weatherData);
      });

      // High intensity should have greater dispersion than low intensity
      expect(results.high.maxDispersionRadius).toBeGreaterThan(results.low.maxDispersionRadius);
      expect(results.moderate.maxDispersionRadius).toBeGreaterThanOrEqual(results.low.maxDispersionRadius);
      expect(results.moderate.maxDispersionRadius).toBeLessThanOrEqual(results.high.maxDispersionRadius);
    });

    test('should handle different fuel types with varying emission factors', () => {
      const baseData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        burn_intensity: 'moderate'
      };

      const weatherData = {
        wind_speed: 6,
        wind_direction: 45,
        temperature: 25,
        atmospheric_stability: 'unstable'
      };

      const fuelTypes = ['wheat_stubble', 'rice_straw', 'corn_stalks', 'orchard_prunings'];
      
      fuelTypes.forEach(fuelType => {
        const burnData = { ...baseData, fuel_type: fuelType };
        const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
        
        expect(dispersion.fuelType).toBe(fuelType);
        expect(dispersion.emissionFactor).toBeGreaterThan(0);
        expect(dispersion.maxDispersionRadius).toBeGreaterThan(0);
      });
    });

    test('should calculate wind direction effects accurately', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 80,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate'
      };

      const baseWeather = {
        wind_speed: 5,
        temperature: 20,
        atmospheric_stability: 'neutral'
      };

      const directions = [0, 90, 180, 270];
      
      directions.forEach(direction => {
        const weatherData = { ...baseWeather, wind_direction: direction };
        const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
        
        expect(dispersion.windDirection).toBe(direction);
        expect(dispersion.downwindDirection).toBeDefined();
        expect(dispersion.plumeShape).toBeDefined();
      });
    });

    test('should validate EPA PM2.5 standards compliance', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 200, // Large burn
        fuel_type: 'rice_straw', // High emission fuel
        burn_intensity: 'high'
      };

      const weatherData = {
        wind_speed: 2, // Low wind
        wind_direction: 90,
        temperature: 15,
        atmospheric_stability: 'stable' // Poor dispersion
      };

      const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
      
      expect(dispersion.epaCompliance).toBeDefined();
      expect(dispersion.epaCompliance.pm25Threshold).toBe(35); // EPA standard
      expect(dispersion.epaCompliance.exceedsThreshold).toBeDefined();
      expect(dispersion.epaCompliance.maxConcentration).toBeGreaterThan(0);
    });

    test('should calculate dispersion coefficients correctly', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 60,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate'
      };

      const weatherData = {
        wind_speed: 7,
        wind_direction: 135,
        temperature: 18,
        atmospheric_stability: 'unstable'
      };

      const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
      
      expect(dispersion.sigmaY).toBeGreaterThan(0);
      expect(dispersion.sigmaZ).toBeGreaterThan(0);
      expect(dispersion.effectiveHeight).toBeGreaterThan(0);
      expect(dispersion.plumeRise).toBeDefined();
    });

    test('should handle extreme weather conditions', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 50,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'low'
      };

      // Test extreme conditions
      const extremeConditions = [
        { wind_speed: 25, temperature: 40, atmospheric_stability: 'very_unstable' },
        { wind_speed: 1, temperature: 0, atmospheric_stability: 'very_stable' },
        { wind_speed: 0.5, temperature: -5, atmospheric_stability: 'stable' }
      ];

      extremeConditions.forEach((weather, index) => {
        const weatherData = { ...weather, wind_direction: 90 };
        
        expect(() => {
          const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
          expect(dispersion.maxDispersionRadius).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });
  });

  describe('3. PM2.5 Concentration Calculations', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should calculate PM2.5 concentrations at various distances', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate'
      };

      const weatherData = {
        wind_speed: 4,
        wind_direction: 180,
        temperature: 22,
        atmospheric_stability: 'neutral'
      };

      const distances = [500, 1000, 2000, 5000, 10000]; // meters
      
      const concentrations = predictorAgent.calculatePM25Concentrations(
        burnData, weatherData, distances
      );

      expect(concentrations).toBeInstanceOf(Array);
      expect(concentrations).toHaveLength(distances.length);
      
      // Concentrations should decrease with distance
      for (let i = 1; i < concentrations.length; i++) {
        expect(concentrations[i].concentration).toBeLessThanOrEqual(
          concentrations[i-1].concentration
        );
      }
    });

    test('should identify EPA threshold exceedances', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 150,
        fuel_type: 'rice_straw',
        burn_intensity: 'high'
      };

      const poorWeatherData = {
        wind_speed: 1.5, // Very low wind
        wind_direction: 0,
        temperature: 10,
        atmospheric_stability: 'very_stable' // Poor dispersion
      };

      const analysis = predictorAgent.analyzePM25Impact(burnData, poorWeatherData);
      
      expect(analysis.epaExceedances).toBeDefined();
      expect(analysis.epaExceedances.locations).toBeInstanceOf(Array);
      expect(analysis.maxConcentration).toBeGreaterThan(0);
      expect(analysis.exceedsEpaStandard).toBeDefined();
    });

    test('should calculate time-weighted average concentrations', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 75,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate'
      };

      const weatherData = {
        wind_speed: 6,
        wind_direction: 90,
        temperature: 25,
        atmospheric_stability: 'unstable'
      };

      const timeWeightedAnalysis = predictorAgent.calculateTimeWeightedAverages(
        burnData, weatherData, [1, 8, 24] // 1-hour, 8-hour, 24-hour averages
      );

      expect(timeWeightedAnalysis).toBeInstanceOf(Array);
      timeWeightedAnalysis.forEach(period => {
        expect(period.averagingPeriod).toBeDefined();
        expect(period.concentrations).toBeInstanceOf(Array);
        expect(period.maxConcentration).toBeGreaterThan(0);
      });
    });

    test('should account for topographical effects', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        elevation: 150 // meters above sea level
      };

      const weatherData = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 20,
        atmospheric_stability: 'neutral',
        surfaceRoughness: 0.3 // Agricultural land
      };

      const dispersion = predictorAgent.calculateGaussianPlume(burnData, weatherData);
      
      expect(dispersion.topographicalEffects).toBeDefined();
      expect(dispersion.adjustedEffectiveHeight).toBeGreaterThan(0);
      expect(dispersion.terrainInfluence).toBeDefined();
    });

    test('should handle multiple emission sources', () => {
      const multiSourceBurn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 200,
        fuel_type: 'mixed', // Multiple fuel types
        burn_intensity: 'moderate',
        emissionSources: [
          { fuelType: 'wheat_stubble', acres: 100, intensity: 'moderate' },
          { fuelType: 'rice_straw', acres: 100, intensity: 'high' }
        ]
      };

      const weatherData = {
        wind_speed: 4,
        wind_direction: 45,
        temperature: 18,
        atmospheric_stability: 'neutral'
      };

      const multiSourceDispersion = predictorAgent.calculateMultiSourceDispersion(
        multiSourceBurn, weatherData
      );

      expect(multiSourceDispersion.totalEmissionRate).toBeGreaterThan(0);
      expect(multiSourceDispersion.combinedConcentrations).toBeInstanceOf(Array);
      expect(multiSourceDispersion.dominantSource).toBeDefined();
    });
  });

  describe('4. Smoke Plume Vector Generation', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should generate 64-dimensional plume vectors', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate'
      };

      const weatherData = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 22,
        atmospheric_stability: 'neutral'
      };

      const vector = predictorAgent.generatePlumeVector(burnData, weatherData);
      
      expect(vector).toBeInstanceOf(Array);
      expect(vector).toHaveLength(64);
      expect(vector.every(val => typeof val === 'number')).toBe(true);
      expect(vector.every(val => !isNaN(val))).toBe(true);
    });

    test('should create unique vectors for different burn conditions', () => {
      const baseData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble'
      };

      const weatherData = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 20,
        atmospheric_stability: 'neutral'
      };

      const vector1 = predictorAgent.generatePlumeVector(
        { ...baseData, burn_intensity: 'low' }, weatherData
      );
      const vector2 = predictorAgent.generatePlumeVector(
        { ...baseData, burn_intensity: 'high' }, weatherData
      );

      // Vectors should be different for different intensities
      const similarity = predictorAgent.calculateVectorSimilarity(vector1, vector2);
      expect(similarity).toBeLessThan(0.95); // Should be different enough
    });

    test('should normalize vector components properly', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 150,
        fuel_type: 'orchard_prunings',
        burn_intensity: 'high'
      };

      const weatherData = {
        wind_speed: 8,
        wind_direction: 315,
        temperature: 28,
        atmospheric_stability: 'unstable'
      };

      const vector = predictorAgent.generatePlumeVector(burnData, weatherData);
      
      // Check vector normalization
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 3); // Should be unit vector
    });

    test('should include atmospheric stability in vector encoding', () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 80,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate'
      };

      const stableWeather = {
        wind_speed: 3,
        wind_direction: 90,
        temperature: 15,
        atmospheric_stability: 'very_stable'
      };

      const unstableWeather = {
        wind_speed: 3,
        wind_direction: 90,
        temperature: 15,
        atmospheric_stability: 'very_unstable'
      };

      const stableVector = predictorAgent.generatePlumeVector(burnData, stableWeather);
      const unstableVector = predictorAgent.generatePlumeVector(burnData, unstableWeather);

      // Different stability should produce significantly different vectors
      const similarity = predictorAgent.calculateVectorSimilarity(stableVector, unstableVector);
      expect(similarity).toBeLessThan(0.8);
    });

    test('should encode geographic coordinates in vector', () => {
      const weatherData = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 20,
        atmospheric_stability: 'neutral'
      };

      const burnData1 = {
        latitude: 37.0,
        longitude: -120.0,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate'
      };

      const burnData2 = {
        latitude: 38.0,
        longitude: -121.0,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate'
      };

      const vector1 = predictorAgent.generatePlumeVector(burnData1, weatherData);
      const vector2 = predictorAgent.generatePlumeVector(burnData2, weatherData);

      // Different locations should produce different vectors
      const similarity = predictorAgent.calculateVectorSimilarity(vector1, vector2);
      expect(similarity).toBeLessThan(0.95);
    });

    test('should handle missing vector components gracefully', () => {
      const incompleteBurn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100
        // Missing fuel_type and burn_intensity
      };

      const incompleteWeather = {
        wind_speed: 5,
        wind_direction: 180
        // Missing temperature and atmospheric_stability
      };

      expect(() => {
        const vector = predictorAgent.generatePlumeVector(incompleteBurn, incompleteWeather);
        expect(vector).toBeInstanceOf(Array);
        expect(vector).toHaveLength(64);
      }).not.toThrow();
    });
  });

  describe('5. Conflict Detection Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
      vectorSimilaritySearch.mockClear();
    });

    test('should detect smoke overlap conflicts', async () => {
      const primaryBurn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T09:00:00Z')
      };

      const weatherData = {
        wind_speed: 3,
        wind_direction: 90,
        temperature: 20,
        atmospheric_stability: 'stable'
      };

      // Mock vector search to return similar burns
      vectorSimilaritySearch.mockResolvedValueOnce([
        {
          id: 2,
          similarity: 0.85,
          latitude: 37.52,
          longitude: -120.48,
          burn_date: new Date('2025-08-10T10:00:00Z'),
          dispersion_radius: 8000
        }
      ]);

      const conflicts = await predictorAgent.detectConflicts(primaryBurn, weatherData);
      
      expect(conflicts).toBeInstanceOf(Array);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toHaveProperty('conflictType');
      expect(conflicts[0]).toHaveProperty('severity');
      expect(conflicts[0]).toHaveProperty('distance');
    });

    test('should calculate conflict severity levels', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 150,
        fuel_type: 'rice_straw',
        burn_intensity: 'high',
        burn_date: new Date('2025-08-10T09:00:00Z')
      };

      const weatherData = {
        wind_speed: 2,
        wind_direction: 180,
        temperature: 25,
        atmospheric_stability: 'stable'
      };

      // Mock nearby burns at different distances
      vectorSimilaritySearch.mockResolvedValueOnce([
        { id: 2, similarity: 0.9, latitude: 37.501, longitude: -120.501, burn_date: new Date('2025-08-10T09:30:00Z') }, // Very close
        { id: 3, similarity: 0.7, latitude: 37.51, longitude: -120.51, burn_date: new Date('2025-08-10T11:00:00Z') }, // Medium distance
        { id: 4, similarity: 0.5, latitude: 37.55, longitude: -120.55, burn_date: new Date('2025-08-10T14:00:00Z') } // Far distance
      ]);

      const conflicts = await predictorAgent.detectConflicts(burn, weatherData);
      
      const severities = conflicts.map(c => c.severity);
      expect(severities).toContain('critical'); // Very close burn
      expect(severities.some(s => ['high', 'medium'].includes(s))).toBe(true);
    });

    test('should consider temporal overlap in conflicts', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z'),
        estimated_duration: 4 // hours
      };

      const weatherData = {
        wind_speed: 4,
        wind_direction: 90,
        temperature: 20,
        atmospheric_stability: 'neutral'
      };

      vectorSimilaritySearch.mockResolvedValueOnce([
        { id: 2, similarity: 0.8, latitude: 37.51, longitude: -120.51, 
          burn_date: new Date('2025-08-10T12:00:00Z'), estimated_duration: 3 }, // Overlapping
        { id: 3, similarity: 0.7, latitude: 37.51, longitude: -120.51, 
          burn_date: new Date('2025-08-10T16:00:00Z'), estimated_duration: 2 } // Non-overlapping
      ]);

      const conflicts = await predictorAgent.detectConflicts(burn, weatherData);
      
      const temporalConflicts = conflicts.filter(c => c.hasTemporalOverlap);
      expect(temporalConflicts.length).toBeGreaterThan(0);
      expect(temporalConflicts[0].timeOverlapHours).toBeGreaterThan(0);
    });

    test('should assess cumulative PM2.5 impacts', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 80,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T09:00:00Z')
      };

      const weatherData = {
        wind_speed: 3,
        wind_direction: 270,
        temperature: 18,
        atmospheric_stability: 'stable'
      };

      vectorSimilaritySearch.mockResolvedValueOnce([
        { id: 2, similarity: 0.8, latitude: 37.51, longitude: -120.49, burn_date: new Date('2025-08-10T10:00:00Z') },
        { id: 3, similarity: 0.75, latitude: 37.49, longitude: -120.52, burn_date: new Date('2025-08-10T11:00:00Z') }
      ]);

      const cumulativeAnalysis = await predictorAgent.analyzeCumulativeImpacts(burn, weatherData);
      
      expect(cumulativeAnalysis.baselinePM25).toBeGreaterThan(0);
      expect(cumulativeAnalysis.cumulativePM25).toBeGreaterThanOrEqual(cumulativeAnalysis.baselinePM25);
      expect(cumulativeAnalysis.additionalSources).toBeInstanceOf(Array);
      expect(cumulativeAnalysis.exceedsStandards).toBeDefined();
    });

    test('should identify vulnerable receptor locations', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 120,
        fuel_type: 'rice_straw',
        burn_intensity: 'high',
        burn_date: new Date('2025-08-10T08:00:00Z')
      };

      const weatherData = {
        wind_speed: 2,
        wind_direction: 45,
        temperature: 15,
        atmospheric_stability: 'very_stable'
      };

      const receptorAnalysis = await predictorAgent.identifyVulnerableReceptors(burn, weatherData);
      
      expect(receptorAnalysis.schools).toBeInstanceOf(Array);
      expect(receptorAnalysis.hospitals).toBeInstanceOf(Array);
      expect(receptorAnalysis.nursingHomes).toBeInstanceOf(Array);
      expect(receptorAnalysis.residentialAreas).toBeInstanceOf(Array);
      expect(receptorAnalysis.highestRiskReceptor).toBeDefined();
    });
  });

  describe('6. Weather Integration Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should integrate with weather agent data', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      // Mock weather data retrieval
      query.mockResolvedValueOnce([{
        temperature: 22,
        humidity: 45,
        wind_speed: 6,
        wind_direction: 135,
        atmospheric_pressure: 1013.25,
        weather_condition: 'Clear',
        visibility: 10000,
        atmospheric_stability: 'unstable'
      }]);

      const prediction = await predictorAgent.createPrediction(burn);
      
      expect(prediction.burnId).toBe(1);
      expect(prediction.weatherIntegrated).toBe(true);
      expect(prediction.maxDispersionRadius).toBeGreaterThan(0);
      expect(prediction.confidenceScore).toBeGreaterThan(0);
    });

    test('should handle weather data unavailability', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      // Mock no weather data available
      query.mockResolvedValueOnce([]);

      const prediction = await predictorAgent.createPrediction(burn);
      
      expect(prediction.weatherIntegrated).toBe(false);
      expect(prediction.usedDefaultWeather).toBe(true);
      expect(prediction.confidenceScore).toBeLessThan(0.7); // Lower confidence
    });

    test('should validate weather data quality', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      // Mock invalid weather data
      query.mockResolvedValueOnce([{
        temperature: null,
        humidity: -10, // Invalid
        wind_speed: 150, // Extreme
        wind_direction: 400, // Invalid
        atmospheric_stability: 'invalid_class'
      }]);

      const prediction = await predictorAgent.createPrediction(burn);
      
      expect(prediction.weatherDataQuality).toBe('poor');
      expect(prediction.validationWarnings).toBeInstanceOf(Array);
      expect(prediction.validationWarnings.length).toBeGreaterThan(0);
    });

    test('should interpolate weather data for prediction times', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T13:30:00Z') // Between hourly readings
      };

      // Mock hourly weather data
      query.mockResolvedValueOnce([
        { timestamp: new Date('2025-08-10T13:00:00Z'), temperature: 20, wind_speed: 5 },
        { timestamp: new Date('2025-08-10T14:00:00Z'), temperature: 22, wind_speed: 7 }
      ]);

      const prediction = await predictorAgent.createPrediction(burn);
      
      expect(prediction.interpolatedWeather).toBe(true);
      expect(prediction.interpolatedValues.temperature).toBeCloseTo(21, 1); // Interpolated value
      expect(prediction.interpolatedValues.wind_speed).toBeCloseTo(6, 1);
    });
  });

  describe('7. Database Integration Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
      query.mockClear();
    });

    test('should store smoke predictions in database', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValueOnce([{ insertId: 123 }]);

      const prediction = await predictorAgent.createPrediction(burn);
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO smoke_predictions'),
        expect.arrayContaining([
          burn.id,
          expect.any(Number), // max_dispersion_radius
          expect.any(Number), // predicted_pm25
          expect.any(Number), // confidence_score
          expect.any(String), // plume_vector JSON
          expect.any(String)  // prediction_data JSON
        ])
      );
    });

    test('should handle database insertion failures', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(predictorAgent.createPrediction(burn)).rejects.toThrow('Database connection failed');
      expect(logger.error).toHaveBeenCalled();
    });

    test('should perform vector similarity searches correctly', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      const mockVector = new Array(64).fill(0).map(() => Math.random());
      
      vectorSimilaritySearch.mockResolvedValueOnce([
        { id: 2, similarity: 0.9, prediction_data: JSON.stringify({ maxDispersionRadius: 7500 }) },
        { id: 3, similarity: 0.8, prediction_data: JSON.stringify({ maxDispersionRadius: 6200 }) }
      ]);

      const similarPredictions = await predictorAgent.findSimilarPredictions(mockVector, 0.7);
      
      expect(vectorSimilaritySearch).toHaveBeenCalledWith(
        'smoke_predictions',
        'plume_vector',
        mockVector,
        5,
        0.7
      );
      expect(similarPredictions).toHaveLength(2);
    });

    test('should update prediction confidence based on historical accuracy', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      // Mock historical accuracy data
      query.mockResolvedValueOnce([{
        avg_accuracy: 0.85,
        prediction_count: 150,
        fuel_type_accuracy: 0.92
      }]);

      const prediction = await predictorAgent.createPrediction(burn);
      
      expect(prediction.historicalAccuracy).toBeDefined();
      expect(prediction.adjustedConfidence).toBeGreaterThan(0);
      expect(prediction.adjustedConfidence).toBeLessThanOrEqual(1);
    });

    test('should handle concurrent prediction requests', async () => {
      const burns = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          fuel_type: 'wheat_stubble',
          burn_intensity: 'moderate',
          burn_date: new Date('2025-08-10T09:00:00Z')
        },
        {
          id: 2,
          latitude: 37.52,
          longitude: -120.48,
          acres: 80,
          fuel_type: 'rice_straw',
          burn_intensity: 'high',
          burn_date: new Date('2025-08-10T10:00:00Z')
        }
      ];

      query.mockResolvedValue([{ insertId: 123 }]);
      vectorSimilaritySearch.mockResolvedValue([]);

      const predictions = await Promise.all(
        burns.map(burn => predictorAgent.createPrediction(burn))
      );

      expect(predictions).toHaveLength(2);
      expect(predictions.every(p => p.burnId)).toBe(true);
      expect(predictions.every(p => p.maxDispersionRadius > 0)).toBe(true);
    });
  });

  describe('8. Error Handling Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should handle invalid burn data gracefully', async () => {
      const invalidBurn = {
        id: 'invalid',
        latitude: 'not_a_number',
        longitude: null,
        acres: -50,
        fuel_type: 'unknown_fuel',
        burn_intensity: 'extreme'
      };

      const result = await predictorAgent.createPrediction(invalidBurn);
      
      expect(result.validationErrors).toBeInstanceOf(Array);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    test('should handle calculation overflow conditions', () => {
      const extremeBurn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100000, // Extremely large
        fuel_type: 'rice_straw',
        burn_intensity: 'extreme'
      };

      const extremeWeather = {
        wind_speed: 0.01, // Near zero wind
        wind_direction: 90,
        temperature: 50,
        atmospheric_stability: 'very_stable'
      };

      expect(() => {
        const dispersion = predictorAgent.calculateGaussianPlume(extremeBurn, extremeWeather);
        expect(isFinite(dispersion.maxDispersionRadius)).toBe(true);
        expect(isFinite(dispersion.maxConcentration)).toBe(true);
      }).not.toThrow();
    });

    test('should recover from vector generation failures', () => {
      const burn = {
        latitude: NaN,
        longitude: undefined,
        acres: null,
        fuel_type: '',
        burn_intensity: undefined
      };

      const weather = {
        wind_speed: Infinity,
        wind_direction: NaN,
        temperature: undefined,
        atmospheric_stability: null
      };

      const vector = predictorAgent.generatePlumeVector(burn, weather);
      
      expect(vector).toBeInstanceOf(Array);
      expect(vector).toHaveLength(64);
      expect(vector.every(val => isFinite(val))).toBe(true);
    });

    test('should handle network timeouts for external services', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 100);
        })
      );

      const prediction = await predictorAgent.createPrediction(burn);
      
      expect(prediction.success).toBe(false);
      expect(prediction.error).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });

    test('should validate mathematical model inputs', () => {
      const testCases = [
        { wind_speed: 0, expected: 'should handle zero wind' },
        { wind_speed: -5, expected: 'should handle negative wind' },
        { temperature: -100, expected: 'should handle extreme cold' },
        { temperature: 100, expected: 'should handle extreme heat' },
        { atmospheric_stability: 'invalid', expected: 'should handle invalid stability' }
      ];

      testCases.forEach(testCase => {
        const burnData = {
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          fuel_type: 'wheat_stubble',
          burn_intensity: 'moderate'
        };

        const weatherData = {
          wind_speed: 5,
          wind_direction: 180,
          temperature: 20,
          atmospheric_stability: 'neutral',
          ...testCase
        };

        expect(() => {
          const result = predictorAgent.calculateGaussianPlume(burnData, weatherData);
          expect(result.validationWarnings).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe('9. Algorithm Accuracy Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should match known Gaussian plume solutions', () => {
      // Test against known analytical solutions
      const referenceBurn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        emissionRate: 1000 // kg/hour
      };

      const referenceWeather = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 20,
        atmospheric_stability: 'neutral',
        mixingHeight: 1000
      };

      const result = predictorAgent.calculateGaussianPlume(referenceBurn, referenceWeather);
      
      // Validate against known dispersion parameters for Pasquill-Gifford D class
      const expectedSigmaY = predictorAgent.calculateSigmaY(1000, 'neutral'); // At 1km downwind
      const expectedSigmaZ = predictorAgent.calculateSigmaZ(1000, 'neutral');
      
      expect(result.sigmaY).toBeCloseTo(expectedSigmaY, 1);
      expect(result.sigmaZ).toBeCloseTo(expectedSigmaZ, 1);
    });

    test('should validate emission factor calculations', () => {
      const fuelEmissionFactors = {
        'wheat_stubble': 10.2,
        'rice_straw': 15.8,
        'corn_stalks': 8.5,
        'orchard_prunings': 12.3,
        'grass_residue': 7.1
      };

      Object.entries(fuelEmissionFactors).forEach(([fuelType, expectedFactor]) => {
        const calculatedFactor = predictorAgent.getEmissionFactor(fuelType);
        expect(calculatedFactor).toBeCloseTo(expectedFactor, 1);
      });
    });

    test('should calculate plume rise accurately', () => {
      const stackParameters = {
        stackHeight: 10, // meters
        exitVelocity: 15, // m/s
        stackDiameter: 2, // meters
        exitTemperature: 350, // K
        ambientTemperature: 293 // K (20°C)
      };

      const weatherConditions = {
        wind_speed: 5,
        atmospheric_stability: 'neutral'
      };

      const plumeRise = predictorAgent.calculatePlumeRise(stackParameters, weatherConditions);
      
      expect(plumeRise.deltaH).toBeGreaterThan(0);
      expect(plumeRise.effectiveHeight).toBeGreaterThan(stackParameters.stackHeight);
      expect(plumeRise.buoyancyFlux).toBeGreaterThan(0);
    });

    test('should validate dispersion coefficient formulas', () => {
      const distances = [100, 500, 1000, 5000, 10000]; // meters
      const stabilityClasses = ['very_unstable', 'unstable', 'neutral', 'stable', 'very_stable'];

      stabilityClasses.forEach(stability => {
        distances.forEach(distance => {
          const sigmaY = predictorAgent.calculateSigmaY(distance, stability);
          const sigmaZ = predictorAgent.calculateSigmaZ(distance, stability);
          
          expect(sigmaY).toBeGreaterThan(0);
          expect(sigmaZ).toBeGreaterThan(0);
          
          // Sigma values should increase with distance
          if (distance > 100) {
            const smallerSigmaY = predictorAgent.calculateSigmaY(distance / 2, stability);
            expect(sigmaY).toBeGreaterThanOrEqual(smallerSigmaY);
          }
        });
      });
    });

    test('should calculate ground-level concentrations correctly', () => {
      const sourceData = {
        emissionRate: 1000, // kg/hour
        effectiveHeight: 25, // meters
        distance: 2000, // meters downwind
        crossWindDistance: 100 // meters
      };

      const dispersionParams = {
        sigmaY: 140,
        sigmaZ: 35,
        wind_speed: 6
      };

      const concentration = predictorAgent.calculateGroundLevelConcentration(
        sourceData, dispersionParams
      );

      expect(concentration).toBeGreaterThan(0);
      expect(isFinite(concentration)).toBe(true);
      expect(concentration).toBeLessThan(1000000); // Reasonable upper bound
    });
  });

  describe('10. Vector Operations Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should calculate vector similarity accurately', () => {
      const vector1 = new Array(64).fill(1).map((_, i) => Math.sin(i * 0.1));
      const vector2 = new Array(64).fill(1).map((_, i) => Math.sin(i * 0.1 + 0.1));
      const vector3 = new Array(64).fill(1).map((_, i) => Math.cos(i * 0.1));

      const similarity12 = predictorAgent.calculateVectorSimilarity(vector1, vector2);
      const similarity13 = predictorAgent.calculateVectorSimilarity(vector1, vector3);

      expect(similarity12).toBeGreaterThan(similarity13); // Similar patterns
      expect(similarity12).toBeGreaterThan(0.8);
      expect(similarity13).toBeLessThan(0.8);
    });

    test('should normalize vectors to unit length', () => {
      const unnormalizedVector = [10, 20, 30, 40, 50];
      const normalizedVector = predictorAgent.normalizeVector(unnormalizedVector);
      
      const magnitude = Math.sqrt(normalizedVector.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 6);
    });

    test('should handle zero vectors in similarity calculations', () => {
      const zeroVector = new Array(64).fill(0);
      const normalVector = new Array(64).fill(1).map(() => Math.random());

      const similarity = predictorAgent.calculateVectorSimilarity(zeroVector, normalVector);
      expect(similarity).toBe(0);
    });

    test('should validate vector dimensions consistency', () => {
      const vector32 = new Array(32).fill(0.5);
      const vector64 = new Array(64).fill(0.5);
      const vector128 = new Array(128).fill(0.5);

      expect(() => {
        predictorAgent.calculateVectorSimilarity(vector32, vector64);
      }).toThrow('Vector dimension mismatch');

      expect(() => {
        predictorAgent.calculateVectorSimilarity(vector64, vector128);
      }).toThrow('Vector dimension mismatch');
    });

    test('should compress high-dimensional features into 64D vectors', () => {
      const highDimFeatures = {
        spatialFeatures: new Array(20).fill(0).map(() => Math.random()),
        temporalFeatures: new Array(15).fill(0).map(() => Math.random()),
        meteorologicalFeatures: new Array(25).fill(0).map(() => Math.random()),
        emissionFeatures: new Array(18).fill(0).map(() => Math.random())
      };

      const compressedVector = predictorAgent.compressFeaturesToVector(highDimFeatures);
      
      expect(compressedVector).toHaveLength(64);
      expect(compressedVector.every(val => isFinite(val))).toBe(true);
      
      // Vector should be normalized
      const magnitude = Math.sqrt(compressedVector.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 3);
    });
  });

  describe('11. Real-time Prediction Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should update predictions with live weather changes', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        burn_date: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
      };

      // Mock initial weather
      query.mockResolvedValueOnce([{
        temperature: 20,
        wind_speed: 5,
        wind_direction: 180,
        atmospheric_stability: 'neutral'
      }]);

      const initialPrediction = await predictorAgent.createPrediction(burn);
      
      // Mock updated weather
      query.mockResolvedValueOnce([{
        temperature: 25,
        wind_speed: 8,
        wind_direction: 90,
        atmospheric_stability: 'unstable'
      }]);

      const updatedPrediction = await predictorAgent.updatePrediction(burn.id);
      
      expect(updatedPrediction.isUpdate).toBe(true);
      expect(updatedPrediction.previousPredictionId).toBe(initialPrediction.id);
      expect(updatedPrediction.changeReasons).toBeInstanceOf(Array);
    });

    test('should trigger real-time conflict alerts', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 150,
        fuel_type: 'rice_straw',
        burn_intensity: 'high',
        burn_date: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      };

      // Mock conflicting burn detected
      vectorSimilaritySearch.mockResolvedValueOnce([{
        id: 2,
        similarity: 0.95,
        latitude: 37.501,
        longitude: -120.501,
        burn_date: new Date(Date.now() + 45 * 60 * 1000),
        status: 'approved'
      }]);

      const mockIo = {
        emit: jest.fn(),
        to: jest.fn().mockReturnThis()
      };

      const conflictDetection = await predictorAgent.checkRealTimeConflicts(burn, mockIo);
      
      expect(conflictDetection.conflicts).toHaveLength(1);
      expect(conflictDetection.alerts.sent).toBe(true);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'conflict_detected',
        expect.objectContaining({
          burnId: burn.id,
          conflictType: 'smoke_overlap',
          severity: expect.any(String)
        })
      );
    });

    test('should handle rapid weather changes during burns', async () => {
      const activeBurn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate',
        burn_date: new Date(Date.now() - 30 * 60 * 1000), // Started 30 min ago
        status: 'active'
      };

      const weatherSequence = [
        { wind_speed: 5, wind_direction: 180, atmospheric_stability: 'neutral' },
        { wind_speed: 12, wind_direction: 90, atmospheric_stability: 'unstable' }, // Sudden change
        { wind_speed: 8, wind_direction: 135, atmospheric_stability: 'neutral' }
      ];

      const predictions = [];
      for (const weather of weatherSequence) {
        query.mockResolvedValueOnce([{ ...weather, temperature: 22 }]);
        const prediction = await predictorAgent.updatePrediction(activeBurn.id);
        predictions.push(prediction);
      }

      expect(predictions).toHaveLength(3);
      expect(predictions[1].significantChange).toBe(true);
      expect(predictions[1].weatherChangeAlert).toBe(true);
    });

    test('should monitor prediction confidence degradation', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours from now
      };

      // Mock degrading weather forecast confidence over time
      const timeSequence = [1, 2, 4, 8, 12]; // hours from now

      const confidenceResults = [];
      for (const hours of timeSequence) {
        const forecastReliability = Math.exp(-hours / 6); // Exponential decay
        
        query.mockResolvedValueOnce([{
          temperature: 20,
          wind_speed: 5,
          wind_direction: 180,
          atmospheric_stability: 'neutral',
          forecast_confidence: forecastReliability
        }]);

        const prediction = await predictorAgent.createPrediction({
          ...burn,
          burn_date: new Date(Date.now() + hours * 60 * 60 * 1000)
        });

        confidenceResults.push(prediction.confidenceScore);
      }

      // Confidence should decrease with forecast time
      for (let i = 1; i < confidenceResults.length; i++) {
        expect(confidenceResults[i]).toBeLessThanOrEqual(confidenceResults[i-1]);
      }
    });
  });

  describe('12. Performance Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should process predictions within performance thresholds', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValue([{ insertId: 123 }]);
      vectorSimilaritySearch.mockResolvedValue([]);

      const startTime = Date.now();
      const prediction = await predictorAgent.createPrediction(burn);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(prediction.processingTimeMs).toBeLessThan(5000);
    });

    test('should handle high-frequency prediction requests', async () => {
      const burns = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        latitude: 37.5 + (Math.random() - 0.5) * 0.1,
        longitude: -120.5 + (Math.random() - 0.5) * 0.1,
        acres: 50 + Math.random() * 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date(Date.now() + i * 60 * 60 * 1000)
      }));

      query.mockResolvedValue([{ insertId: 123 }]);
      vectorSimilaritySearch.mockResolvedValue([]);

      const startTime = Date.now();
      const predictions = await Promise.all(
        burns.map(burn => predictorAgent.createPrediction(burn))
      );
      const totalDuration = Date.now() - startTime;

      expect(predictions).toHaveLength(50);
      expect(predictions.every(p => p.success)).toBe(true);
      expect(totalDuration).toBeLessThan(30000); // 30 seconds for 50 predictions
    });

    test('should manage memory usage for large-scale predictions', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process many predictions
      for (let i = 0; i < 100; i++) {
        const burn = {
          id: i + 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          fuel_type: 'corn_stalks',
          burn_intensity: 'moderate',
          burn_date: new Date(Date.now() + i * 60 * 60 * 1000)
        };

        query.mockResolvedValueOnce([{ insertId: i + 1 }]);
        await predictorAgent.createPrediction(burn);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(50); // Should not leak significant memory
    });

    test('should optimize vector similarity search performance', async () => {
      const vector = new Array(64).fill(0).map(() => Math.random());
      
      vectorSimilaritySearch.mockResolvedValue([
        { id: 1, similarity: 0.95 },
        { id: 2, similarity: 0.87 },
        { id: 3, similarity: 0.82 }
      ]);

      const startTime = Date.now();
      const similar = await predictorAgent.findSimilarPredictions(vector, 0.8);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Vector search should be fast
      expect(similar).toHaveLength(3);
      expect(vectorSimilaritySearch).toHaveBeenCalledWith(
        'smoke_predictions',
        'plume_vector',
        vector,
        5, // limit
        0.8 // threshold
      );
    });
  });

  describe('13. Edge Cases and Boundary Conditions', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should handle minimum burn size edge cases', () => {
      const minimalBurn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 0.1, // Very small burn
        fuel_type: 'grass_residue',
        burn_intensity: 'low'
      };

      const weatherData = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 20,
        atmospheric_stability: 'neutral'
      };

      const dispersion = predictorAgent.calculateGaussianPlume(minimalBurn, weatherData);
      
      expect(dispersion.maxDispersionRadius).toBeGreaterThan(0);
      expect(dispersion.maxDispersionRadius).toBeLessThan(1000); // Should be small for tiny burn
    });

    test('should handle maximum burn size edge cases', () => {
      const massiveBurn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 10000, // Very large burn
        fuel_type: 'orchard_prunings',
        burn_intensity: 'high'
      };

      const weatherData = {
        wind_speed: 3,
        wind_direction: 270,
        temperature: 15,
        atmospheric_stability: 'stable'
      };

      const dispersion = predictorAgent.calculateGaussianPlume(massiveBurn, weatherData);
      
      expect(dispersion.maxDispersionRadius).toBeGreaterThan(10000);
      expect(dispersion.exceedsMaxRadius).toBe(true);
      expect(dispersion.scalingApplied).toBe(true);
    });

    test('should handle coordinate boundary conditions', () => {
      const boundaryCoords = [
        { latitude: 90, longitude: 180 },   // North Pole, International Date Line
        { latitude: -90, longitude: -180 }, // South Pole, International Date Line
        { latitude: 0, longitude: 0 },      // Equator, Prime Meridian
        { latitude: 37.999999, longitude: -120.000001 } // Precision boundaries
      ];

      boundaryCoords.forEach(coords => {
        const burn = {
          ...coords,
          acres: 100,
          fuel_type: 'wheat_stubble',
          burn_intensity: 'moderate'
        };

        const weather = {
          wind_speed: 5,
          wind_direction: 180,
          temperature: 20,
          atmospheric_stability: 'neutral'
        };

        expect(() => {
          const vector = predictorAgent.generatePlumeVector(burn, weather);
          expect(vector).toBeInstanceOf(Array);
          expect(vector).toHaveLength(64);
        }).not.toThrow();
      });
    });

    test('should handle atmospheric stability edge cases', () => {
      const burn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate'
      };

      const edgeCases = [
        { atmospheric_stability: 'extremely_unstable', wind_speed: 0.1 },
        { atmospheric_stability: 'extremely_stable', wind_speed: 25 },
        { atmospheric_stability: 'transitional', wind_speed: 5 },
        { atmospheric_stability: 'unknown', wind_speed: 3 }
      ];

      edgeCases.forEach(weather => {
        const weatherData = {
          ...weather,
          wind_direction: 180,
          temperature: 20
        };

        expect(() => {
          const dispersion = predictorAgent.calculateGaussianPlume(burn, weatherData);
          expect(dispersion.stabilityHandling).toBeDefined();
        }).not.toThrow();
      });
    });

    test('should validate temporal prediction windows', async () => {
      const now = new Date();
      const testTimes = [
        new Date(now.getTime() - 24 * 60 * 60 * 1000), // Past (should reject)
        new Date(now.getTime() + 30 * 60 * 1000),      // 30 min future (good)
        new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days future (uncertain)
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)  // 30 days future (should reject)
      ];

      for (const burnDate of testTimes) {
        const burn = {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          fuel_type: 'wheat_stubble',
          burn_intensity: 'moderate',
          burn_date: burnDate
        };

        const result = await predictorAgent.createPrediction(burn);
        
        if (burnDate < now || burnDate.getTime() - now.getTime() > 14 * 24 * 60 * 60 * 1000) {
          expect(result.temporalValidation).toBe('rejected');
        } else {
          expect(result.temporalValidation).toBe('accepted');
        }
      }
    });
  });

  describe('14. Integration with Other Agents', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should integrate with coordinator agent data', async () => {
      const coordinatorOutput = {
        burnId: 1,
        priorityScore: 8.5,
        burnVector: new Array(32).fill(0).map(() => Math.random()),
        validationResults: {
          isValid: true,
          spatialCompliance: true,
          temporalCompliance: true
        }
      };

      const prediction = await predictorAgent.processCoordinatorOutput(coordinatorOutput);
      
      expect(prediction.inputPriorityScore).toBe(8.5);
      expect(prediction.coordinatorBurnVector).toEqual(coordinatorOutput.burnVector);
      expect(prediction.crossAgentValidation).toBe(true);
    });

    test('should provide input for optimizer agent', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValueOnce([{ insertId: 123 }]);

      const prediction = await predictorAgent.createPrediction(burn);
      const optimizerInput = predictorAgent.prepareOptimizerInput(prediction);
      
      expect(optimizerInput.burnId).toBe(burn.id);
      expect(optimizerInput.conflictConstraints).toBeInstanceOf(Array);
      expect(optimizerInput.dispersionParameters).toBeDefined();
      expect(optimizerInput.timeWindows).toBeInstanceOf(Array);
      expect(optimizerInput.spatialConstraints).toBeDefined();
    });

    test('should coordinate with alerts agent for warnings', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 200,
        fuel_type: 'rice_straw',
        burn_intensity: 'high',
        burn_date: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      };

      // Mock high PM2.5 prediction
      const highPm25Prediction = {
        maxConcentration: 75, // Exceeds EPA standard
        affectedRadius: 15000,
        vulnerableReceptors: 3,
        confidenceScore: 0.9
      };

      const alertRecommendations = predictorAgent.generateAlertRecommendations(
        burn, highPm25Prediction
      );

      expect(alertRecommendations.shouldAlert).toBe(true);
      expect(alertRecommendations.severity).toBe('critical');
      expect(alertRecommendations.recipients).toBeInstanceOf(Array);
      expect(alertRecommendations.alertTypes).toContain('air_quality_alert');
    });

    test('should validate multi-agent data consistency', async () => {
      const multiAgentData = {
        coordinator: {
          burnId: 1,
          priorityScore: 7.5,
          acres: 100,
          burnVector: new Array(32).fill(0.5)
        },
        weather: {
          weatherId: 456,
          weatherVector: new Array(128).fill(0.3),
          suitabilityScore: 8.2,
          conditions: 'favorable'
        }
      };

      const consistencyCheck = predictorAgent.validateMultiAgentConsistency(multiAgentData);
      
      expect(consistencyCheck.isConsistent).toBe(true);
      expect(consistencyCheck.burnIdMatches).toBe(true);
      expect(consistencyCheck.vectorDimensionsValid).toBe(true);
      expect(consistencyCheck.dataIntegrity).toBe('passed');
    });
  });

  describe('15. Logging and Monitoring Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
      logger.info.mockClear();
      logger.error.mockClear();
      logger.performance.mockClear();
    });

    test('should log prediction creation events', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValueOnce([{ insertId: 123 }]);
      await predictorAgent.createPrediction(burn);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating smoke prediction'),
        expect.objectContaining({
          burnId: burn.id,
          acres: burn.acres,
          fuelType: burn.fuel_type
        })
      );
    });

    test('should log performance metrics', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValueOnce([{ insertId: 123 }]);
      await predictorAgent.createPrediction(burn);

      expect(logger.performance).toHaveBeenCalledWith(
        'smoke_prediction_creation',
        expect.any(Number),
        expect.objectContaining({
          burnId: burn.id,
          vectorDimensions: 64,
          calculationSteps: expect.any(Number)
        })
      );
    });

    test('should log error conditions appropriately', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'unknown_fuel',
        burn_intensity: 'extreme'
      };

      const result = await predictorAgent.createPrediction(burn);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid fuel type'),
        expect.objectContaining({
          burnId: burn.id,
          fuelType: burn.fuel_type
        })
      );
    });

    test('should track vector operations in logs', async () => {
      const vector = new Array(64).fill(0).map(() => Math.random());
      
      vectorSimilaritySearch.mockResolvedValueOnce([
        { id: 1, similarity: 0.9 },
        { id: 2, similarity: 0.85 }
      ]);

      await predictorAgent.findSimilarPredictions(vector, 0.8);

      expect(logger.vector).toHaveBeenCalledWith(
        'vector_similarity_search',
        expect.objectContaining({
          table: 'smoke_predictions',
          column: 'plume_vector',
          dimensions: 64,
          threshold: 0.8,
          resultsFound: 2
        })
      );
    });
  });

  describe('16. Mathematical Model Validation', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should validate Pasquill-Gifford stability parameters', () => {
      const stabilityClassParams = {
        'A': { sigmaYCoeff: 0.22, sigmaZCoeff: 0.20 },
        'B': { sigmaYCoeff: 0.16, sigmaZCoeff: 0.12 },
        'C': { sigmaYCoeff: 0.11, sigmaZCoeff: 0.08 },
        'D': { sigmaYCoeff: 0.08, sigmaZCoeff: 0.06 },
        'E': { sigmaYCoeff: 0.06, sigmaZCoeff: 0.03 },
        'F': { sigmaYCoeff: 0.04, sigmaZCoeff: 0.016 }
      };

      Object.entries(stabilityClassParams).forEach(([stabilityClass, expectedParams]) => {
        const params = predictorAgent.getPasquillGiffordParameters(stabilityClass);
        
        expect(params.sigmaYCoeff).toBeCloseTo(expectedParams.sigmaYCoeff, 2);
        expect(params.sigmaZCoeff).toBeCloseTo(expectedParams.sigmaZCoeff, 2);
      });
    });

    test('should implement correct reflection formulas', () => {
      const sourceHeight = 50; // meters
      const mixingHeight = 1000; // meters
      const receptorHeight = 2; // meters
      const sigmaZ = 100; // meters

      const reflectionTerms = predictorAgent.calculateReflectionTerms(
        sourceHeight, mixingHeight, receptorHeight, sigmaZ
      );

      expect(reflectionTerms.primaryTerm).toBeGreaterThan(0);
      expect(reflectionTerms.reflectionTerms).toBeInstanceOf(Array);
      expect(reflectionTerms.totalReflection).toBeGreaterThanOrEqual(reflectionTerms.primaryTerm);
    });

    test('should calculate effective emission rates', () => {
      const burnParameters = {
        acres: 100,
        fuelType: 'rice_straw',
        burnIntensity: 'moderate',
        moistureContent: 12, // percent
        combustionEfficiency: 0.85
      };

      const emissionRate = predictorAgent.calculateEffectiveEmissionRate(burnParameters);
      
      expect(emissionRate.pm25Rate).toBeGreaterThan(0);
      expect(emissionRate.adjustmentFactors).toBeDefined();
      expect(emissionRate.adjustmentFactors.moisture).toBeLessThanOrEqual(1);
      expect(emissionRate.adjustmentFactors.efficiency).toBeLessThanOrEqual(1);
    });

    test('should validate conservation of mass in calculations', () => {
      const burn = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'corn_stalks',
        burn_intensity: 'moderate'
      };

      const weather = {
        wind_speed: 5,
        wind_direction: 180,
        temperature: 20,
        atmospheric_stability: 'neutral'
      };

      const massConservation = predictorAgent.validateMassConservation(burn, weather);
      
      expect(massConservation.totalEmitted).toBeGreaterThan(0);
      expect(massConservation.totalDispersed).toBeCloseTo(massConservation.totalEmitted, 1);
      expect(massConservation.conservationError).toBeLessThan(0.05); // Less than 5% error
    });
  });

  describe('17. Security and Data Validation', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should sanitize input data', () => {
      const maliciousInput = {
        id: '1; DROP TABLE smoke_predictions; --',
        latitude: '<script>alert("xss")</script>',
        longitude: '../../etc/passwd',
        fuel_type: 'wheat_stubble\'; DELETE FROM burns; --',
        burn_intensity: 'moderate'
      };

      const sanitized = predictorAgent.sanitizeInput(maliciousInput);
      
      expect(sanitized.id).toBe(1); // Should be converted to number
      expect(sanitized.latitude).toBeNaN(); // Invalid coordinate
      expect(sanitized.fuel_type).toBe('wheat_stubble'); // SQL injection removed
      expect(sanitized.containsThreats).toBe(true);
    });

    test('should validate coordinate bounds', () => {
      const invalidCoords = [
        { latitude: 91, longitude: -120.5 },   // Invalid latitude
        { latitude: 37.5, longitude: 181 },    // Invalid longitude
        { latitude: -91, longitude: -120.5 },  // Invalid latitude
        { latitude: 37.5, longitude: -181 }    // Invalid longitude
      ];

      invalidCoords.forEach(coords => {
        const validation = predictorAgent.validateCoordinates(coords.latitude, coords.longitude);
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toBeInstanceOf(Array);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    test('should prevent vector injection attacks', () => {
      const maliciousVector = [
        1.0, 2.0, Infinity, -Infinity, NaN, 
        'string', null, undefined, {}, [],
        ...new Array(54).fill(0)
      ];

      const cleanedVector = predictorAgent.sanitizeVector(maliciousVector);
      
      expect(cleanedVector).toHaveLength(64);
      expect(cleanedVector.every(val => isFinite(val))).toBe(true);
      expect(cleanedVector.every(val => typeof val === 'number')).toBe(true);
    });

    test('should rate limit expensive operations', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValue([{ insertId: 123 }]);

      // Simulate rapid requests
      const promises = Array.from({ length: 20 }, () => 
        predictorAgent.createPrediction(burn)
      );

      const results = await Promise.allSettled(promises);
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && r.reason.message.includes('rate limit')
      );

      expect(rateLimited.length).toBeGreaterThan(0); // Some should be rate limited
    });
  });

  describe('18. Regression Tests', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should maintain backward compatibility with legacy data', async () => {
      const legacyBurn = {
        id: 1,
        lat: 37.5, // Old field name
        lon: -120.5, // Old field name
        size: 100, // Old field name
        type: 'wheat', // Old fuel type format
        intensity: 2, // Numeric intensity
        date: '2025-08-10 10:00:00' // String date
      };

      const convertedBurn = predictorAgent.convertLegacyFormat(legacyBurn);
      const prediction = await predictorAgent.createPrediction(convertedBurn);
      
      expect(prediction.success).toBe(true);
      expect(prediction.legacyConversion).toBe(true);
      expect(convertedBurn.latitude).toBe(37.5);
      expect(convertedBurn.longitude).toBe(-120.5);
      expect(convertedBurn.acres).toBe(100);
    });

    test('should handle schema evolution gracefully', () => {
      const newSchemaData = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        // New fields in future schema versions
        carbon_sequestration_rate: 2.5,
        biodiversity_impact_score: 6.8,
        soil_health_metrics: { ph: 6.5, organic_matter: 3.2 }
      };

      expect(() => {
        const vector = predictorAgent.generatePlumeVector(newSchemaData, {
          wind_speed: 5,
          wind_direction: 180,
          temperature: 20,
          atmospheric_stability: 'neutral'
        });
        expect(vector).toHaveLength(64);
      }).not.toThrow();
    });

    test('should maintain prediction accuracy standards', async () => {
      const referenceBurns = [
        {
          id: 1,
          latitude: 37.5,
          longitude: -120.5,
          acres: 50,
          fuel_type: 'wheat_stubble',
          burn_intensity: 'low',
          burn_date: new Date('2025-08-10T09:00:00Z')
        },
        {
          id: 2,
          latitude: 37.52,
          longitude: -120.48,
          acres: 150,
          fuel_type: 'rice_straw',
          burn_intensity: 'high',
          burn_date: new Date('2025-08-10T11:00:00Z')
        }
      ];

      query.mockResolvedValue([{ insertId: 123 }]);
      vectorSimilaritySearch.mockResolvedValue([]);

      const predictions = await Promise.all(
        referenceBurns.map(burn => predictorAgent.createPrediction(burn))
      );

      // All predictions should meet minimum accuracy thresholds
      predictions.forEach(prediction => {
        expect(prediction.confidenceScore).toBeGreaterThanOrEqual(0.6);
        expect(prediction.maxDispersionRadius).toBeGreaterThan(0);
        expect(prediction.maxDispersionRadius).toBeLessThan(50000); // Reasonable upper bound
      });
    });
  });

  describe('19. Load Testing', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should handle sustained high load', async () => {
      const burnRequests = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        latitude: 37.5 + (Math.random() - 0.5) * 0.2,
        longitude: -120.5 + (Math.random() - 0.5) * 0.2,
        acres: 50 + Math.random() * 150,
        fuel_type: ['wheat_stubble', 'rice_straw', 'corn_stalks'][i % 3],
        burn_intensity: ['low', 'moderate', 'high'][i % 3],
        burn_date: new Date(Date.now() + i * 30 * 60 * 1000) // 30 min intervals
      }));

      query.mockResolvedValue([{ insertId: 123 }]);
      vectorSimilaritySearch.mockResolvedValue([]);

      const startTime = Date.now();
      const batchSize = 20;
      const results = [];

      for (let i = 0; i < burnRequests.length; i += batchSize) {
        const batch = burnRequests.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(burn => predictorAgent.createPrediction(burn))
        );
        results.push(...batchResults);
      }

      const totalDuration = Date.now() - startTime;
      const avgProcessingTime = totalDuration / burnRequests.length;

      expect(results).toHaveLength(200);
      expect(results.every(r => r.success)).toBe(true);
      expect(avgProcessingTime).toBeLessThan(1000); // Less than 1 second per prediction
    });

    test('should maintain accuracy under load stress', async () => {
      const stressBurn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'rice_straw',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValue([{ insertId: 123 }]);

      // Run same prediction multiple times under stress
      const stressResults = await Promise.all(
        Array.from({ length: 50 }, () => predictorAgent.createPrediction(stressBurn))
      );

      // Results should be consistent
      const dispersionRadii = stressResults.map(r => r.maxDispersionRadius);
      const avgRadius = dispersionRadii.reduce((sum, r) => sum + r, 0) / dispersionRadii.length;
      const variance = dispersionRadii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / dispersionRadii.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev / avgRadius).toBeLessThan(0.05); // Less than 5% coefficient of variation
    });
  });

  describe('20. Status and Health Monitoring', () => {
    beforeEach(() => {
      predictorAgent.initialize();
    });

    test('should provide comprehensive agent status', () => {
      const status = predictorAgent.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('config');
      expect(status).toHaveProperty('statistics');
      expect(status).toHaveProperty('lastActivity');
      expect(status.config).toHaveProperty('maxDispersionRadius');
      expect(status.config).toHaveProperty('pm25Threshold');
      expect(status.config).toHaveProperty('confidenceThreshold');
    });

    test('should track processing statistics', async () => {
      const burn = {
        id: 1,
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        burn_date: new Date('2025-08-10T10:00:00Z')
      };

      query.mockResolvedValueOnce([{ insertId: 123 }]);
      
      await predictorAgent.createPrediction(burn);
      const status = predictorAgent.getStatus();
      
      expect(status.statistics.totalPredictions).toBeGreaterThan(0);
      expect(status.statistics.averageProcessingTime).toBeGreaterThan(0);
      expect(status.statistics.lastPredictionTime).toBeDefined();
    });

    test('should detect agent health issues', () => {
      // Simulate various health issues
      const healthChecks = [
        { memory: { heapUsed: 500 * 1024 * 1024 }, expected: 'healthy' },
        { memory: { heapUsed: 1500 * 1024 * 1024 }, expected: 'warning' },
        { memory: { heapUsed: 2500 * 1024 * 1024 }, expected: 'critical' }
      ];

      healthChecks.forEach(({ memory, expected }) => {
        const health = predictorAgent.checkHealth(memory);
        expect(health.status).toBe(expected);
      });
    });

    test('should provide diagnostic information', () => {
      const diagnostics = predictorAgent.getDiagnostics();
      
      expect(diagnostics).toHaveProperty('memoryUsage');
      expect(diagnostics).toHaveProperty('processingQueue');
      expect(diagnostics).toHaveProperty('errorCounts');
      expect(diagnostics).toHaveProperty('performanceMetrics');
      expect(diagnostics.memoryUsage).toHaveProperty('heapUsed');
      expect(diagnostics.processingQueue).toHaveProperty('pending');
      expect(diagnostics.errorCounts).toHaveProperty('total');
    });
  });

});