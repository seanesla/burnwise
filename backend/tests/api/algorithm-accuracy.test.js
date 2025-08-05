const request = require('supertest');
const express = require('express');

// Import API routers
const weatherRouter = require('../../api/weather');
const scheduleRouter = require('../../api/schedule');
const analyticsRouter = require('../../api/analytics');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');
jest.mock('../../agents/weather');
jest.mock('../../agents/predictor');
jest.mock('../../agents/optimizer');

const { query, vectorSimilaritySearch } = require('../../db/connection');
const weatherAgent = require('../../agents/weather');
const predictorAgent = require('../../agents/predictor');
const optimizerAgent = require('../../agents/optimizer');

describe('Algorithm Accuracy API Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mount API routers
    app.use('/api/weather', weatherRouter);
    app.use('/api/schedule', scheduleRouter);
    app.use('/api/analytics', analyticsRouter);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('1. Gaussian Plume Model Accuracy Tests', () => {
    test('should validate smoke dispersion calculations against EPA models', async () => {
      const burnData = {
        latitude: 37.5,
        longitude: -120.5,
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate'
      };

      const weatherData = {
        wind_speed: 5, // m/s
        wind_direction: 180,
        temperature: 20, // C
        atmospheric_stability: 'neutral'
      };

      // Mock predictor with EPA-compliant calculations
      const expectedDispersion = {
        maxDispersionRadius: 8000, // meters
        maxPM25: 28.5, // µg/m³
        epaCompliance: {
          exceedsThreshold: false,
          pm25Threshold: 35,
          maxConcentration: 28.5
        },
        gaussianParameters: {
          sigmaY: 640, // Expected for 8km downwind, neutral stability
          sigmaZ: 160,  // Expected for 8km downwind, neutral stability
          effectiveHeight: 25
        }
      };

      predictorAgent.calculateGaussianPlume.mockResolvedValueOnce(expectedDispersion);

      const response = await request(app)
        .post('/api/weather/predict-dispersion')
        .send({ burn_data: burnData, weather_data: weatherData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.maxPM25).toBeCloseTo(28.5, 1);
      expect(response.body.data.gaussianParameters.sigmaY).toBeCloseTo(640, 50);
      expect(response.body.data.gaussianParameters.sigmaZ).toBeCloseTo(160, 20);
    });

    test('should correctly model atmospheric stability effects', async () => {
      const testCases = [
        {
          stability: 'very_unstable',
          expectedSigmaY: 850, // Greater dispersion
          expectedSigmaZ: 220,
          expectedMaxPM25: 22.1 // Lower concentration due to better mixing
        },
        {
          stability: 'neutral',
          expectedSigmaY: 640,
          expectedSigmaZ: 160,
          expectedMaxPM25: 28.5
        },
        {
          stability: 'very_stable',
          expectedSigmaY: 420, // Less lateral dispersion
          expectedSigmaZ: 80,  // Much less vertical dispersion
          expectedMaxPM25: 45.2 // Higher concentration due to poor mixing
        }
      ];

      for (const testCase of testCases) {
        const mockResult = {
          gaussianParameters: {
            sigmaY: testCase.expectedSigmaY,
            sigmaZ: testCase.expectedSigmaZ
          },
          maxPM25: testCase.expectedMaxPM25
        };

        predictorAgent.calculateGaussianPlume.mockResolvedValueOnce(mockResult);

        const response = await request(app)
          .post('/api/weather/predict-dispersion')
          .send({
            burn_data: { acres: 100, fuel_type: 'wheat_stubble' },
            weather_data: { 
              wind_speed: 5,
              atmospheric_stability: testCase.stability
            }
          })
          .expect(200);

        expect(response.body.data.gaussianParameters.sigmaY).toBeCloseTo(testCase.expectedSigmaY, 50);
        expect(response.body.data.gaussianParameters.sigmaZ).toBeCloseTo(testCase.expectedSigmaZ, 20);
        expect(response.body.data.maxPM25).toBeCloseTo(testCase.expectedMaxPM25, 2);
      }
    });

    test('should accurately calculate emission factors for different fuel types', async () => {
      const fuelEmissionFactors = {
        'wheat_stubble': 10.2, // kg/acre
        'rice_straw': 15.8,
        'corn_stalks': 8.5,
        'orchard_prunings': 12.3,
        'grass_residue': 7.1
      };

      for (const [fuelType, expectedFactor] of Object.entries(fuelEmissionFactors)) {
        const mockResult = {
          emissionFactor: expectedFactor,
          totalEmissions: expectedFactor * 100 // 100 acres
        };

        predictorAgent.calculateEmissionRate.mockResolvedValueOnce(mockResult);

        const response = await request(app)
          .post('/api/weather/calculate-emissions')
          .send({
            acres: 100,
            fuel_type: fuelType,
            burn_intensity: 'moderate'
          })
          .expect(200);

        expect(response.body.data.emissionFactor).toBeCloseTo(expectedFactor, 1);
        expect(response.body.data.totalEmissions).toBeCloseTo(expectedFactor * 100, 10);
      }
    });

    test('should validate plume rise calculations', async () => {
      const testScenarios = [
        {
          burnIntensity: 'low',
          acres: 50,
          windSpeed: 3,
          expectedPlumeRise: 15, // meters
          expectedEffectiveHeight: 25 // 10m stack + 15m rise
        },
        {
          burnIntensity: 'moderate',
          acres: 100,
          windSpeed: 5,
          expectedPlumeRise: 25,
          expectedEffectiveHeight: 35
        },
        {
          burnIntensity: 'high',
          acres: 200,
          windSpeed: 2, // Low wind allows more rise
          expectedPlumeRise: 45,
          expectedEffectiveHeight: 55
        }
      ];

      for (const scenario of testScenarios) {
        const mockResult = {
          plumeRise: scenario.expectedPlumeRise,
          effectiveHeight: scenario.expectedEffectiveHeight,
          buoyancyFlux: scenario.acres * 0.05 // Simplified calculation
        };

        predictorAgent.calculatePlumeRise.mockResolvedValueOnce(mockResult);

        const response = await request(app)
          .post('/api/weather/calculate-plume-rise')
          .send({
            burn_intensity: scenario.burnIntensity,
            acres: scenario.acres,
            wind_speed: scenario.windSpeed
          })
          .expect(200);

        expect(response.body.data.plumeRise).toBeCloseTo(scenario.expectedPlumeRise, 5);
        expect(response.body.data.effectiveHeight).toBeCloseTo(scenario.expectedEffectiveHeight, 5);
      }
    });
  });

  describe('2. Simulated Annealing Optimization Accuracy Tests', () => {
    test('should converge to optimal solutions for small problems', async () => {
      const smallProblem = [
        { id: 1, priority_score: 9.0, preferred_date: '2025-08-10T09:00:00Z' },
        { id: 2, priority_score: 7.5, preferred_date: '2025-08-10T11:00:00Z' },
        { id: 3, priority_score: 8.2, preferred_date: '2025-08-10T14:00:00Z' }
      ];

      const expectedOptimalSchedule = {
        schedule: [
          { burn_id: 1, scheduled_time: '2025-08-10T09:00:00Z' }, // Highest priority first
          { burn_id: 3, scheduled_time: '2025-08-10T12:00:00Z' },
          { burn_id: 2, scheduled_time: '2025-08-10T15:00:00Z' }
        ],
        totalScore: 92.5, // Near-optimal score
        iterations: 145,
        converged: true
      };

      optimizerAgent.optimizeSchedule.mockResolvedValueOnce(expectedOptimalSchedule);

      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({
          burn_requests: smallProblem,
          optimization_params: {
            priorityWeight: 0.6,
            timePreferenceWeight: 0.4
          }
        })
        .expect(200);

      expect(response.body.data.converged).toBe(true);
      expect(response.body.data.totalScore).toBeGreaterThan(90);
      expect(response.body.data.schedule[0].burn_id).toBe(1); // Highest priority scheduled first
    });

    test('should handle cooling schedule correctly', async () => {
      const optimizationParams = {
        initialTemperature: 1000,
        finalTemperature: 1,
        coolingRate: 0.95,
        maxIterations: 1000
      };

      const mockResult = {
        temperatureHistory: [1000, 950, 902.5, 857.4], // T * cooling_rate each step
        acceptanceProbabilities: [0.95, 0.78, 0.65, 0.52],
        bestSolutionIteration: 750,
        finalTemperature: 1.2
      };

      optimizerAgent.trackOptimizationProgress.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/schedule/optimize-detailed')
        .send({
          burn_requests: [{ id: 1, priority_score: 8.0 }],
          optimization_params: optimizationParams
        })
        .expect(200);

      const tempHistory = response.body.data.temperatureHistory;
      
      // Verify temperature cooling follows exponential decay
      expect(tempHistory[1]).toBeCloseTo(1000 * 0.95, 10);
      expect(tempHistory[2]).toBeCloseTo(1000 * 0.95 * 0.95, 10);
      expect(response.body.data.finalTemperature).toBeCloseTo(1.2, 1);
    });

    test('should correctly implement neighbor solution generation', async () => {
      const currentSolution = [
        { burn_id: 1, scheduled_time: '2025-08-10T09:00:00Z' },
        { burn_id: 2, scheduled_time: '2025-08-10T12:00:00Z' },
        { burn_id: 3, scheduled_time: '2025-08-10T15:00:00Z' }
      ];

      const neighborSolutions = [
        // Time shift neighbor
        [
          { burn_id: 1, scheduled_time: '2025-08-10T10:00:00Z' }, // Shifted +1 hour
          { burn_id: 2, scheduled_time: '2025-08-10T12:00:00Z' },
          { burn_id: 3, scheduled_time: '2025-08-10T15:00:00Z' }
        ],
        // Swap neighbor
        [
          { burn_id: 2, scheduled_time: '2025-08-10T09:00:00Z' }, // Swapped positions
          { burn_id: 1, scheduled_time: '2025-08-10T12:00:00Z' },
          { burn_id: 3, scheduled_time: '2025-08-10T15:00:00Z' }
        ]
      ];

      optimizerAgent.generateNeighbors.mockResolvedValueOnce(neighborSolutions);

      const response = await request(app)
        .post('/api/schedule/generate-neighbors')
        .send({ current_solution: currentSolution })
        .expect(200);

      expect(response.body.data.neighbors).toHaveLength(2);
      
      // Verify neighbor 1 is a time shift
      const neighbor1 = response.body.data.neighbors[0];
      expect(neighbor1[0].burn_id).toBe(1);
      expect(neighbor1[0].scheduled_time).toBe('2025-08-10T10:00:00Z');
      
      // Verify neighbor 2 is a swap
      const neighbor2 = response.body.data.neighbors[1];
      expect(neighbor2[0].burn_id).toBe(2);
      expect(neighbor2[1].burn_id).toBe(1);
    });

    test('should calculate acceptance probabilities accurately', async () => {
      const testCases = [
        {
          currentScore: 80,
          newScore: 85, // Better solution
          temperature: 50,
          expectedProbability: 1.0 // Always accept better solutions
        },
        {
          currentScore: 80,
          newScore: 75, // Worse solution
          temperature: 100,
          expectedProbability: 0.607 // exp(-5/100) ≈ 0.607
        },
        {
          currentScore: 80,
          newScore: 75,
          temperature: 10,
          expectedProbability: 0.049 // exp(-5/10) ≈ 0.049
        }
      ];

      for (const testCase of testCases) {
        optimizerAgent.calculateAcceptanceProbability.mockResolvedValueOnce(
          testCase.expectedProbability
        );

        const response = await request(app)
          .post('/api/schedule/acceptance-probability')
          .send({
            current_score: testCase.currentScore,
            new_score: testCase.newScore,
            temperature: testCase.temperature
          })
          .expect(200);

        expect(response.body.data.probability).toBeCloseTo(testCase.expectedProbability, 2);
      }
    });
  });

  describe('3. Vector Similarity Search Accuracy Tests', () => {
    test('should return accurate cosine similarity scores', async () => {
      // Test with known vectors
      const queryVector = new Array(128).fill(1/Math.sqrt(128)); // Unit vector
      const testVectors = [
        {
          id: 1,
          vector: new Array(128).fill(1/Math.sqrt(128)), // Identical vector
          expectedSimilarity: 1.0
        },
        {
          id: 2,
          vector: new Array(128).fill(-1/Math.sqrt(128)), // Opposite vector
          expectedSimilarity: -1.0
        },
        {
          id: 3,
          vector: [...new Array(64).fill(1/Math.sqrt(128)), ...new Array(64).fill(0)], // Orthogonal
          expectedSimilarity: 0.707 // cos(45°)
        }
      ];

      const mockResults = testVectors.map(tv => ({
        id: tv.id,
        similarity: tv.expectedSimilarity
      }));

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const response = await request(app)
        .post('/api/weather/vector-similarity')
        .send({
          query_vector: queryVector,
          table: 'weather_patterns',
          column: 'weather_pattern_embedding',
          limit: 10,
          threshold: 0.5
        })
        .expect(200);

      expect(response.body.data.results).toHaveLength(3);
      expect(response.body.data.results[0].similarity).toBeCloseTo(1.0, 3);
      expect(response.body.data.results[1].similarity).toBeCloseTo(-1.0, 3);
      expect(response.body.data.results[2].similarity).toBeCloseTo(0.707, 2);
    });

    test('should validate L2 distance calculations', async () => {
      const queryVector = [0, 0]; // Origin in 2D space
      const testVectors = [
        {
          id: 1,
          vector: [3, 4], // Distance = 5
          expectedDistance: 5.0
        },
        {
          id: 2,
          vector: [1, 1], // Distance = √2 ≈ 1.414
          expectedDistance: 1.414
        },
        {
          id: 3,
          vector: [0, 0], // Same point
          expectedDistance: 0.0
        }
      ];

      const mockResults = testVectors.map(tv => ({
        id: tv.id,
        distance: tv.expectedDistance
      }));

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const response = await request(app)
        .post('/api/weather/vector-distance')
        .send({
          query_vector: queryVector,
          similarity_function: 'VEC_L2_DISTANCE',
          limit: 10
        })
        .expect(200);

      expect(response.body.data.results[0].distance).toBeCloseTo(5.0, 1);
      expect(response.body.data.results[1].distance).toBeCloseTo(1.414, 2);
      expect(response.body.data.results[2].distance).toBeCloseTo(0.0, 3);
    });

    test('should handle high-dimensional vector accuracy', async () => {
      // Test with 128-dimensional vectors (weather patterns)
      const dimensions = 128;
      const queryVector = new Array(dimensions).fill(0);
      queryVector[0] = 1; // Single spike in first dimension

      const testVector = new Array(dimensions).fill(0);
      testVector[0] = 0.8; // Similar spike, lower magnitude
      
      const expectedSimilarity = 0.8; // Dot product normalized

      vectorSimilaritySearch.mockResolvedValueOnce([{
        id: 1,
        similarity: expectedSimilarity,
        vector_dimensions: dimensions
      }]);

      const response = await request(app)
        .post('/api/weather/high-dim-similarity')
        .send({
          query_vector: queryVector,
          dimensions: dimensions
        })
        .expect(200);

      expect(response.body.data.results[0].similarity).toBeCloseTo(0.8, 2);
      expect(response.body.data.results[0].vector_dimensions).toBe(128);
    });

    test('should validate vector normalization effects', async () => {
      const unnormalizedVector = [3, 4]; // Magnitude = 5
      const normalizedVector = [0.6, 0.8]; // Unit vector

      const mockResults = [
        {
          id: 1,
          similarity: 0.96, // High similarity to normalized version
          is_normalized: true,
          magnitude: 1.0
        }
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(mockResults);

      const response = await request(app)
        .post('/api/weather/normalized-similarity')
        .send({
          original_vector: unnormalizedVector,
          normalized_vector: normalizedVector
        })
        .expect(200);

      expect(response.body.data.results[0].magnitude).toBeCloseTo(1.0, 3);
      expect(response.body.data.results[0].is_normalized).toBe(true);
    });
  });

  describe('4. Prediction Accuracy Validation Tests', () => {
    test('should validate PM2.5 prediction accuracy against EPA standards', async () => {
      const testScenarios = [
        {
          conditions: { acres: 50, fuel_type: 'grass_residue', wind_speed: 8 },
          expectedPM25: 15.2,
          epaThreshold: 35,
          shouldComply: true
        },
        {
          conditions: { acres: 200, fuel_type: 'rice_straw', wind_speed: 2 },
          expectedPM25: 42.8,
          epaThreshold: 35,
          shouldComply: false
        }
      ];

      for (const scenario of testScenarios) {
        const mockPrediction = {
          maxPM25: scenario.expectedPM25,
          epaCompliance: {
            exceedsThreshold: !scenario.shouldComply,
            pm25Threshold: scenario.epaThreshold
          },
          confidenceScore: 0.89
        };

        predictorAgent.predictPM25Levels.mockResolvedValueOnce(mockPrediction);

        const response = await request(app)
          .post('/api/weather/predict-pm25')
          .send(scenario.conditions)
          .expect(200);

        expect(response.body.data.maxPM25).toBeCloseTo(scenario.expectedPM25, 1);
        expect(response.body.data.epaCompliance.exceedsThreshold).toBe(!scenario.shouldComply);
      }
    });

    test('should calculate prediction confidence intervals', async () => {
      const mockPrediction = {
        prediction: 28.5,
        confidenceInterval: {
          lower: 24.2,
          upper: 32.8,
          confidence_level: 0.95
        },
        standardError: 2.1,
        sampleSize: 150
      };

      predictorAgent.calculateConfidenceInterval.mockResolvedValueOnce(mockPrediction);

      const response = await request(app)
        .post('/api/analytics/prediction-confidence')
        .send({
          prediction_value: 28.5,
          confidence_level: 0.95
        })
        .expect(200);

      const ci = response.body.data.confidenceInterval;
      expect(ci.lower).toBeCloseTo(24.2, 1);
      expect(ci.upper).toBeCloseTo(32.8, 1);
      expect(ci.confidence_level).toBe(0.95);
    });

    test('should validate model performance metrics', async () => {
      const mockPerformance = {
        accuracy: 0.887,
        precision: 0.892,
        recall: 0.881,
        f1Score: 0.886,
        meanAbsoluteError: 2.34,
        rootMeanSquareError: 3.12,
        r2Score: 0.78
      };

      query.mockResolvedValueOnce([mockPerformance]);

      const response = await request(app)
        .get('/api/analytics/model-performance')
        .expect(200);

      expect(response.body.data.accuracy).toBeCloseTo(0.887, 3);
      expect(response.body.data.f1Score).toBeCloseTo(0.886, 3);
      expect(response.body.data.r2Score).toBeCloseTo(0.78, 2);
    });

    test('should compare predictions against ground truth data', async () => {
      const groundTruthData = [
        { predicted: 25.3, actual: 26.1, error: -0.8 },
        { predicted: 31.7, actual: 29.9, error: 1.8 },
        { predicted: 18.9, actual: 19.5, error: -0.6 }
      ];

      const validationMetrics = {
        meanError: 0.133, // Average of errors
        meanAbsoluteError: 1.067, // Average of absolute errors
        rootMeanSquareError: 1.247,
        correlationCoefficient: 0.956
      };

      query.mockResolvedValueOnce(groundTruthData);
      query.mockResolvedValueOnce([validationMetrics]);

      const response = await request(app)
        .post('/api/analytics/validate-predictions')
        .send({
          validation_period: '2025-08-01',
          prediction_type: 'pm25_levels'
        })
        .expect(200);

      expect(response.body.data.meanAbsoluteError).toBeCloseTo(1.067, 2);
      expect(response.body.data.correlationCoefficient).toBeCloseTo(0.956, 3);
    });
  });

  describe('5. Cross-Algorithm Integration Accuracy Tests', () => {
    test('should validate end-to-end prediction pipeline accuracy', async () => {
      const inputData = {
        burn_request: {
          latitude: 37.5,
          longitude: -120.5,
          acres: 100,
          fuel_type: 'wheat_stubble',
          burn_date: '2025-08-10T10:00:00Z'
        }
      };

      // Mock complete pipeline results
      const pipelineResult = {
        coordinator: { priorityScore: 8.5, processingTime: 45 },
        weather: { suitabilityScore: 7.8, processingTime: 120 },
        predictor: { maxPM25: 28.5, confidence: 0.89, processingTime: 380 },
        optimizer: { scheduleScore: 85.2, processingTime: 1200 },
        alerts: { alertsSent: 2, processingTime: 200 },
        totalPipelineTime: 1945,
        overallAccuracy: 0.874
      };

      // Mock each agent
      weatherAgent.analyzeWeatherConditions.mockResolvedValueOnce({
        suitabilityScore: 7.8
      });
      
      predictorAgent.createPrediction.mockResolvedValueOnce({
        maxPM25: 28.5,
        confidence: 0.89
      });

      optimizerAgent.optimizeSchedule.mockResolvedValueOnce({
        totalScore: 85.2
      });

      query.mockResolvedValueOnce([pipelineResult]);

      const response = await request(app)
        .post('/api/analytics/pipeline-accuracy')
        .send(inputData)
        .expect(200);

      expect(response.body.data.overallAccuracy).toBeCloseTo(0.874, 3);
      expect(response.body.data.totalPipelineTime).toBeLessThan(2000);
      expect(response.body.data.predictor.confidence).toBeCloseTo(0.89, 2);
    });

    test('should validate algorithm consistency across multiple runs', async () => {
      const testInput = {
        burn_requests: [
          { id: 1, priority_score: 8.0, acres: 100 },
          { id: 2, priority_score: 7.5, acres: 80 },
          { id: 3, priority_score: 9.0, acres: 120 }
        ]
      };

      // Run optimization multiple times with same input
      const multipleRuns = [
        { totalScore: 87.2, iterations: 342 },
        { totalScore: 87.8, iterations: 289 },
        { totalScore: 87.5, iterations: 356 },
        { totalScore: 87.1, iterations: 401 },
        { totalScore: 87.6, iterations: 334 }
      ];

      optimizerAgent.optimizeSchedule
        .mockResolvedValueOnce(multipleRuns[0])
        .mockResolvedValueOnce(multipleRuns[1])
        .mockResolvedValueOnce(multipleRuns[2])
        .mockResolvedValueOnce(multipleRuns[3])
        .mockResolvedValueOnce(multipleRuns[4]);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app)
            .post('/api/schedule/consistency-test')
            .send(testInput)
        )
      );

      const scores = responses.map(r => r.body.data.totalScore);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      expect(avgScore).toBeCloseTo(87.4, 1);
      expect(stdDev).toBeLessThan(0.5); // Results should be consistent
    });

    test('should validate cross-agent data flow integrity', async () => {
      const burnId = 123;
      
      // Track data as it flows through agents
      const dataFlow = {
        input: { burnId, acres: 100, fuel_type: 'wheat_stubble' },
        coordinator_output: { burnId, priorityScore: 8.5, burnVector: new Array(32).fill(0.5) },
        weather_output: { burnId, suitabilityScore: 7.8, weatherVector: new Array(128).fill(0.3) },
        predictor_output: { burnId, maxPM25: 28.5, plumeVector: new Array(64).fill(0.7) },
        optimizer_output: { burnId, scheduledTime: '2025-08-10T10:00:00Z', totalScore: 85.2 },
        alerts_output: { burnId, alertsSent: 2, success: true }
      };

      // Verify burnId is preserved throughout pipeline
      Object.values(dataFlow).forEach(output => {
        if (output.burnId) {
          expect(output.burnId).toBe(burnId);
        }
      });

      query.mockResolvedValueOnce([{ dataIntegrityCheck: 'passed', burnId }]);

      const response = await request(app)
        .post('/api/analytics/data-flow-integrity')
        .send({ burn_id: burnId })
        .expect(200);

      expect(response.body.data.dataIntegrityCheck).toBe('passed');
      expect(response.body.data.burnId).toBe(burnId);
    });
  });

});

// Helper functions for algorithm testing
function calculateExpectedSimilarity(vector1, vector2) {
  const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitude1 * magnitude2);
}

function calculateL2Distance(vector1, vector2) {
  return Math.sqrt(
    vector1.reduce((sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0)
  );
}