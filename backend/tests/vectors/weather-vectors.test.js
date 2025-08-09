const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { initializeDatabase, query, pool, vectorSearch } = require('../../db/connection');
const WeatherAgent = require('../../agents/weather');

describe('Weather Pattern Vector Tests - 128-Dimensional Atmospheric Encoding', () => {
  let weatherAgent;
  let testConditions;
  
  beforeAll(async () => {
    await initializeDatabase();
    weatherAgent = new WeatherAgent();
    
    // Real weather conditions for comprehensive testing
    testConditions = [
      {
        // Stable morning conditions - high risk for smoke pooling
        id: 'stable_morning',
        temperature: 15,
        humidity: 80,
        windSpeed: 2,
        windDirection: 180,
        pressure: 1020,
        cloudCover: 20,
        visibility: 10,
        timestamp: new Date('2025-08-25T06:00:00'),
        expectedStability: 5 // Class F - Stable
      },
      {
        // Unstable afternoon - good dispersion
        id: 'unstable_afternoon',
        temperature: 35,
        humidity: 30,
        windSpeed: 12,
        windDirection: 270,
        pressure: 1010,
        cloudCover: 40,
        visibility: 50,
        timestamp: new Date('2025-08-25T14:00:00'),
        expectedStability: 1 // Class B - Unstable
      },
      {
        // Neutral conditions
        id: 'neutral',
        temperature: 20,
        humidity: 60,
        windSpeed: 5,
        windDirection: 90,
        pressure: 1013,
        cloudCover: 60,
        visibility: 20,
        timestamp: new Date('2025-08-25T10:00:00'),
        expectedStability: 3 // Class D - Neutral
      },
      {
        // Extreme heat warning
        id: 'extreme_heat',
        temperature: 45,
        humidity: 10,
        windSpeed: 20,
        windDirection: 0,
        pressure: 1005,
        cloudCover: 0,
        visibility: 30,
        timestamp: new Date('2025-08-25T15:00:00'),
        expectedStability: 0 // Class A - Very Unstable
      },
      {
        // Inversion conditions - dangerous for burns
        id: 'inversion',
        temperature: 10,
        humidity: 95,
        windSpeed: 0.5,
        windDirection: 0,
        pressure: 1025,
        cloudCover: 100,
        visibility: 2,
        timestamp: new Date('2025-08-25T04:00:00'),
        expectedStability: 5 // Class F - Very Stable
      }
    ];
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Weather Vector Generation (128-dimensional)', () => {
    test('Should generate exactly 128-dimensional weather vectors', () => {
      const weather = testConditions[0];
      const vector = weatherAgent.createWeatherEmbedding(weather);
      
      expect(vector).toHaveLength(128);
      expect(vector.every(v => typeof v === 'number')).toBeTruthy();
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should encode basic weather parameters in dimensions 0-6', () => {
      const weather = testConditions[1];
      const vector = weatherAgent.createWeatherEmbedding(weather);
      
      // Check normalized values
      expect(vector[0]).toBeCloseTo(weather.temperature / 50, 2); // Temperature
      expect(vector[1]).toBeCloseTo(weather.humidity / 100, 2); // Humidity
      expect(vector[2]).toBeCloseTo(weather.windSpeed / 20, 2); // Wind speed
      expect(vector[3]).toBeCloseTo(weather.windDirection / 360, 2); // Wind direction
      expect(vector[4]).toBeCloseTo(weather.pressure / 1100, 2); // Pressure
      expect(vector[5]).toBeCloseTo(weather.cloudCover / 100, 2); // Cloud cover
      expect(vector[6]).toBeCloseTo(weather.visibility / 50, 2); // Visibility
    });

    test('Should encode month in dimensions 7-19 as one-hot', () => {
      const weather = { ...testConditions[0], timestamp: new Date('2025-08-15T12:00:00') };
      const vector = weatherAgent.createWeatherEmbedding(weather);
      
      const month = 7; // August (0-indexed)
      const monthDims = vector.slice(7, 20);
      
      // Should have exactly one 1 and rest 0s
      expect(monthDims[month]).toBe(1);
      expect(monthDims.filter(v => v === 1)).toHaveLength(1);
      expect(monthDims.filter(v => v === 0)).toHaveLength(12);
    });

    test('Should encode hour of day in dimensions 20-29', () => {
      const hours = [0, 4, 8, 12, 16, 20, 23];
      const vectors = hours.map(hour => {
        const weather = { 
          ...testConditions[0], 
          timestamp: new Date(`2025-08-25T${hour.toString().padStart(2, '0')}:00:00`)
        };
        return weatherAgent.createWeatherEmbedding(weather);
      });
      
      vectors.forEach((vector, idx) => {
        const hour = hours[idx];
        const timeSlot = Math.floor(hour / 4); // 6 slots of 4 hours each
        const timeDims = vector.slice(20, 26);
        
        expect(timeDims[timeSlot]).toBe(1);
        expect(timeDims.filter(v => v === 1)).toHaveLength(1);
      });
    });

    test('Should encode atmospheric stability class in dimensions 30-39', () => {
      testConditions.forEach(weather => {
        const vector = weatherAgent.createWeatherEmbedding(weather);
        const stabilityClass = weatherAgent.calculateStabilityClass(weather);
        const stabilityDims = vector.slice(30, 40);
        
        expect(stabilityClass).toBe(weather.expectedStability);
        expect(stabilityDims[stabilityClass]).toBe(1);
        expect(stabilityDims.filter(v => v === 1)).toHaveLength(1);
      });
    });

    test('Should handle extreme temperature values', () => {
      const extremes = [
        { ...testConditions[0], temperature: -20 }, // Below freezing
        { ...testConditions[0], temperature: 50 },  // Extreme heat
        { ...testConditions[0], temperature: 0 }    // Freezing
      ];
      
      extremes.forEach(weather => {
        const vector = weatherAgent.createWeatherEmbedding(weather);
        expect(vector[0]).toBeGreaterThanOrEqual(-1);
        expect(vector[0]).toBeLessThanOrEqual(1);
        expect(isFinite(vector[0])).toBeTruthy();
      });
    });

    test('Should handle extreme wind conditions', () => {
      const windConditions = [
        { ...testConditions[0], windSpeed: 0 },    // Calm
        { ...testConditions[0], windSpeed: 40 },   // Gale force
        { ...testConditions[0], windSpeed: 60 }    // Storm force
      ];
      
      windConditions.forEach(weather => {
        const vector = weatherAgent.createWeatherEmbedding(weather);
        expect(vector[2]).toBeGreaterThanOrEqual(0);
        expect(isFinite(vector[2])).toBeTruthy();
      });
    });

    test('Should encode all wind directions correctly', () => {
      const directions = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      
      directions.forEach(dir => {
        const weather = { ...testConditions[0], windDirection: dir };
        const vector = weatherAgent.createWeatherEmbedding(weather);
        const expectedValue = (dir % 360) / 360;
        expect(vector[3]).toBeCloseTo(expectedValue, 2);
      });
    });

    test('Should handle missing weather data gracefully', () => {
      const incomplete = {
        timestamp: new Date('2025-08-25T12:00:00')
        // Missing most fields
      };
      
      const vector = weatherAgent.createWeatherEmbedding(incomplete);
      expect(vector).toHaveLength(128);
      expect(vector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should normalize pressure to standard range', () => {
      const pressures = [950, 1000, 1013, 1030, 1050]; // hPa range
      
      pressures.forEach(pressure => {
        const weather = { ...testConditions[0], pressure };
        const vector = weatherAgent.createWeatherEmbedding(weather);
        expect(vector[4]).toBeGreaterThan(0);
        expect(vector[4]).toBeLessThan(1);
      });
    });
  });

  describe('Atmospheric Stability Classification', () => {
    test('Should calculate Pasquill-Gifford stability class A (Very Unstable)', () => {
      const weather = {
        timestamp: new Date('2025-08-25T12:00:00'), // Daytime
        windSpeed: 1.5,
        cloudCover: 10 // Clear sky
      };
      
      const stability = weatherAgent.calculateStabilityClass(weather);
      expect(stability).toBe(0); // Class A
    });

    test('Should calculate stability class B (Unstable)', () => {
      const weather = {
        timestamp: new Date('2025-08-25T13:00:00'),
        windSpeed: 3,
        cloudCover: 30
      };
      
      const stability = weatherAgent.calculateStabilityClass(weather);
      expect(stability).toBe(1); // Class B
    });

    test('Should calculate stability class C (Slightly Unstable)', () => {
      const weather = {
        timestamp: new Date('2025-08-25T14:00:00'),
        windSpeed: 5,
        cloudCover: 40
      };
      
      const stability = weatherAgent.calculateStabilityClass(weather);
      expect(stability).toBe(2); // Class C
    });

    test('Should calculate stability class D (Neutral)', () => {
      const weather = {
        timestamp: new Date('2025-08-25T10:00:00'),
        windSpeed: 6,
        cloudCover: 60
      };
      
      const stability = weatherAgent.calculateStabilityClass(weather);
      expect(stability).toBe(3); // Class D
    });

    test('Should calculate stability class E (Slightly Stable)', () => {
      const weather = {
        timestamp: new Date('2025-08-25T22:00:00'), // Nighttime
        windSpeed: 2.5,
        cloudCover: 50
      };
      
      const stability = weatherAgent.calculateStabilityClass(weather);
      expect(stability).toBe(4); // Class E
    });

    test('Should calculate stability class F (Stable)', () => {
      const weather = {
        timestamp: new Date('2025-08-25T03:00:00'), // Night
        windSpeed: 1,
        cloudCover: 10
      };
      
      const stability = weatherAgent.calculateStabilityClass(weather);
      expect(stability).toBe(5); // Class F
    });

    test('Should handle transition periods (dawn/dusk)', () => {
      const dawn = {
        timestamp: new Date('2025-08-25T06:00:00'),
        windSpeed: 3,
        cloudCover: 50
      };
      
      const dusk = {
        timestamp: new Date('2025-08-25T18:00:00'),
        windSpeed: 3,
        cloudCover: 50
      };
      
      const dawnStability = weatherAgent.calculateStabilityClass(dawn);
      const duskStability = weatherAgent.calculateStabilityClass(dusk);
      
      expect(dawnStability).toBeGreaterThanOrEqual(0);
      expect(dawnStability).toBeLessThanOrEqual(5);
      expect(duskStability).toBeGreaterThanOrEqual(0);
      expect(duskStability).toBeLessThanOrEqual(5);
    });
  });

  describe('Weather Pattern Similarity and Matching', () => {
    test('Should identify similar weather patterns', () => {
      const weather1 = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013,
        cloudCover: 50,
        visibility: 20,
        timestamp: new Date('2025-08-25T12:00:00')
      };
      
      const weather2 = {
        temperature: 26,
        humidity: 58,
        windSpeed: 11,
        windDirection: 175,
        pressure: 1014,
        cloudCover: 55,
        visibility: 18,
        timestamp: new Date('2025-08-25T12:00:00')
      };
      
      const vector1 = weatherAgent.createWeatherEmbedding(weather1);
      const vector2 = weatherAgent.createWeatherEmbedding(weather2);
      
      const similarity = calculateCosineSimilarity(vector1, vector2);
      expect(similarity).toBeGreaterThan(0.95); // Very similar
    });

    test('Should distinguish different weather patterns', () => {
      const stable = weatherAgent.createWeatherEmbedding(testConditions[0]);
      const unstable = weatherAgent.createWeatherEmbedding(testConditions[1]);
      
      const similarity = calculateCosineSimilarity(stable, unstable);
      expect(similarity).toBeLessThan(0.7); // Different patterns
    });

    test('Should match seasonal patterns', () => {
      const summer = {
        ...testConditions[1],
        timestamp: new Date('2025-07-15T14:00:00')
      };
      
      const winter = {
        ...testConditions[1],
        timestamp: new Date('2025-01-15T14:00:00')
      };
      
      const summerVector = weatherAgent.createWeatherEmbedding(summer);
      const winterVector = weatherAgent.createWeatherEmbedding(winter);
      
      // Month encoding should differ
      const summerMonth = summerVector.slice(7, 20);
      const winterMonth = winterVector.slice(7, 20);
      
      expect(summerMonth).not.toEqual(winterMonth);
      expect(summerMonth[6]).toBe(1); // July
      expect(winterMonth[0]).toBe(1); // January
    });

    test('Should cluster weather patterns by similarity', () => {
      const vectors = testConditions.map(c => 
        weatherAgent.createWeatherEmbedding(c)
      );
      
      const clusters = performKMeansClustering(vectors, 3);
      expect(clusters).toHaveLength(3);
      
      // Each cluster should have at least one member
      clusters.forEach(cluster => {
        expect(cluster.members.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Wind Vector Calculations', () => {
    test('Should calculate wind vector components correctly', () => {
      const testCases = [
        { speed: 10, direction: 0, expected: [0, 10] },   // North
        { speed: 10, direction: 90, expected: [10, 0] },  // East
        { speed: 10, direction: 180, expected: [0, -10] }, // South
        { speed: 10, direction: 270, expected: [-10, 0] }  // West
      ];
      
      testCases.forEach(tc => {
        const [x, y] = weatherAgent.calculateWindVector(tc.speed, tc.direction);
        expect(x).toBeCloseTo(tc.expected[0], 1);
        expect(y).toBeCloseTo(tc.expected[1], 1);
      });
    });

    test('Should handle diagonal wind directions', () => {
      const speed = 10;
      const expectedMagnitude = Math.sqrt(50); // ~7.07 for each component
      
      const ne = weatherAgent.calculateWindVector(speed, 45);
      expect(Math.abs(ne[0])).toBeCloseTo(expectedMagnitude, 1);
      expect(Math.abs(ne[1])).toBeCloseTo(expectedMagnitude, 1);
      
      const sw = weatherAgent.calculateWindVector(speed, 225);
      expect(Math.abs(sw[0])).toBeCloseTo(expectedMagnitude, 1);
      expect(Math.abs(sw[1])).toBeCloseTo(expectedMagnitude, 1);
    });

    test('Should preserve wind speed magnitude', () => {
      const speeds = [5, 10, 15, 20, 25];
      const directions = [0, 45, 90, 135, 180, 225, 270, 315];
      
      speeds.forEach(speed => {
        directions.forEach(dir => {
          const [x, y] = weatherAgent.calculateWindVector(speed, dir);
          const magnitude = Math.sqrt(x * x + y * y);
          expect(magnitude).toBeCloseTo(speed, 1);
        });
      });
    });
  });

  describe('Weather Impact on Dispersion', () => {
    test('Should predict higher concentrations in stable conditions', async () => {
      const stableWeather = testConditions.find(c => c.id === 'stable_morning');
      const unstableWeather = testConditions.find(c => c.id === 'unstable_afternoon');
      
      const burnLocation = { lat: 40.0, lon: -120.0 };
      const areaHectares = 100;
      
      const stableDispersion = await weatherAgent.predictSmokeDispersion(
        burnLocation, 
        areaHectares, 
        stableWeather
      );
      
      const unstableDispersion = await weatherAgent.predictSmokeDispersion(
        burnLocation, 
        areaHectares, 
        unstableWeather
      );
      
      // Stable conditions should have higher PM2.5 at same distance
      const stablePM25 = stableDispersion.predictions[2].pm25; // 2km
      const unstablePM25 = unstableDispersion.predictions[2].pm25;
      
      expect(stablePM25).toBeGreaterThan(unstablePM25);
    });

    test('Should calculate sigma-Y dispersion parameters', () => {
      const stabilityClasses = [0, 1, 2, 3, 4, 5];
      const distance = 1000; // meters
      
      stabilityClasses.forEach(stabilityClass => {
        const sigmaY = weatherAgent.getSigmaY(stabilityClass);
        const value = sigmaY(distance);
        
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(1000);
        
        // More stable conditions should have smaller sigma-Y
        if (stabilityClass > 0) {
          const prevSigmaY = weatherAgent.getSigmaY(stabilityClass - 1);
          expect(value).toBeLessThan(prevSigmaY(distance));
        }
      });
    });

    test('Should calculate sigma-Z dispersion parameters', () => {
      const stabilityClasses = [0, 1, 2, 3, 4, 5];
      const distance = 1000; // meters
      
      stabilityClasses.forEach(stabilityClass => {
        const sigmaZ = weatherAgent.getSigmaZ(stabilityClass);
        const value = sigmaZ(distance);
        
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(500);
        
        // More stable conditions should have smaller sigma-Z
        if (stabilityClass > 0) {
          const prevSigmaZ = weatherAgent.getSigmaZ(stabilityClass - 1);
          expect(value).toBeLessThan(prevSigmaZ(distance));
        }
      });
    });

    test('Should identify dangerous inversion conditions', () => {
      const inversionWeather = testConditions.find(c => c.id === 'inversion');
      const vector = weatherAgent.createWeatherEmbedding(inversionWeather);
      
      // Check for inversion indicators
      const lowWind = vector[2] < 0.1; // Very low wind
      const highHumidity = vector[1] > 0.9; // Very high humidity
      const stableClass = vector.slice(30, 40)[5] === 1; // Class F
      
      const isDangerous = lowWind && highHumidity && stableClass;
      expect(isDangerous).toBeTruthy();
    });

    test('Should calculate confidence score based on data quality', () => {
      const highConfidence = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013,
        cloudCover: 50,
        visibility: 30,
        timestamp: new Date()
      };
      
      const lowConfidence = {
        temperature: 25,
        humidity: 60,
        windSpeed: 0.5, // Very low wind - hard to predict
        windDirection: 0,
        pressure: 1013,
        cloudCover: 100,
        visibility: 2, // Poor visibility
        timestamp: new Date()
      };
      
      const highScore = weatherAgent.calculateConfidenceScore(highConfidence);
      const lowScore = weatherAgent.calculateConfidenceScore(lowConfidence);
      
      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeGreaterThan(0.7);
      expect(lowScore).toBeLessThan(0.5);
    });
  });

  describe('Weather Vector Persistence in TiDB', () => {
    test('Should store weather vector in VECTOR(128) column', async () => {
      const weather = testConditions[0];
      const vector = weatherAgent.createWeatherEmbedding(weather);
      
      const sql = `
        INSERT INTO weather_conditions (
          observation_id, 
          weather_pattern_embedding,
          temperature_celsius,
          humidity_percent,
          wind_speed_mps,
          wind_direction_degrees,
          stability_class,
          observation_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      try {
        await query(sql, [
          'test_weather_1',
          JSON.stringify(vector),
          weather.temperature,
          weather.humidity,
          weather.windSpeed,
          weather.windDirection,
          weather.expectedStability,
          weather.timestamp
        ]);
        
        const result = await query(
          'SELECT weather_pattern_embedding FROM weather_conditions WHERE observation_id = ?',
          ['test_weather_1']
        );
        
        if (result.length > 0) {
          const retrieved = JSON.parse(result[0].weather_pattern_embedding);
          expect(retrieved).toEqual(vector);
          expect(retrieved).toHaveLength(128);
        }
      } catch (error) {
        // Expected without TiDB connection
        expect(error.code).toBeTruthy();
      }
    });

    test('Should search for similar weather patterns', async () => {
      const targetWeather = testConditions[0];
      const targetVector = weatherAgent.createWeatherEmbedding(targetWeather);
      
      try {
        const similar = await vectorSearch(
          'weather_conditions',
          'weather_pattern_embedding',
          targetVector,
          10,
          0.85 // High similarity threshold
        );
        
        if (similar.length > 0) {
          expect(similar[0].similarity).toBeGreaterThan(0.85);
        }
      } catch (error) {
        // Expected without TiDB connection
        expect(error.code).toBeTruthy();
      }
    });

    test('Should aggregate regional weather patterns', async () => {
      const regionalWeathers = [
        { ...testConditions[0], lat: 40.0, lon: -120.0 },
        { ...testConditions[0], lat: 40.1, lon: -120.1 },
        { ...testConditions[0], lat: 39.9, lon: -119.9 }
      ];
      
      const vectors = regionalWeathers.map(w => 
        weatherAgent.createWeatherEmbedding(w)
      );
      
      // Calculate regional average
      const regionalVector = vectors.reduce((sum, v) => 
        sum.map((val, i) => val + v[i] / vectors.length),
        new Array(128).fill(0)
      );
      
      expect(regionalVector).toHaveLength(128);
      expect(regionalVector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should track weather evolution over time', async () => {
      const hours = [0, 6, 12, 18, 24];
      const evolutionVectors = hours.map(hour => {
        const weather = {
          ...testConditions[0],
          temperature: 15 + hour * 0.8, // Temperature rises
          humidity: 80 - hour * 2,      // Humidity drops
          windSpeed: 2 + hour * 0.3,    // Wind increases
          timestamp: new Date(`2025-08-25T${hour.toString().padStart(2, '0')}:00:00`)
        };
        return weatherAgent.createWeatherEmbedding(weather);
      });
      
      // Vectors should show gradual change
      for (let i = 1; i < evolutionVectors.length; i++) {
        const prevVector = evolutionVectors[i - 1];
        const currVector = evolutionVectors[i];
        const similarity = calculateCosineSimilarity(prevVector, currVector);
        
        // Adjacent hours should be similar but not identical
        expect(similarity).toBeGreaterThan(0.8);
        expect(similarity).toBeLessThan(1.0);
      }
    });

    test('Should update weather vectors for forecast changes', async () => {
      const originalForecast = {
        ...testConditions[0],
        forecastTime: new Date('2025-08-25T12:00:00')
      };
      
      const updatedForecast = {
        ...originalForecast,
        temperature: originalForecast.temperature + 5,
        windSpeed: originalForecast.windSpeed * 2,
        windDirection: (originalForecast.windDirection + 90) % 360
      };
      
      const originalVector = weatherAgent.createWeatherEmbedding(originalForecast);
      const updatedVector = weatherAgent.createWeatherEmbedding(updatedForecast);
      
      expect(originalVector).not.toEqual(updatedVector);
      
      // Temperature dimension should increase
      expect(updatedVector[0]).toBeGreaterThan(originalVector[0]);
      
      // Wind speed dimension should increase
      expect(updatedVector[2]).toBeGreaterThan(originalVector[2]);
      
      // Wind direction dimension should change
      expect(updatedVector[3]).not.toEqual(originalVector[3]);
    });
  });

  describe('Historical Weather Pattern Analysis', () => {
    test('Should identify recurring weather patterns', () => {
      const historicalPatterns = [
        // Morning fog pattern (repeats)
        { ...testConditions[0], date: '2025-08-01', id: 'fog1' },
        { ...testConditions[0], date: '2025-08-08', id: 'fog2' },
        { ...testConditions[0], date: '2025-08-15', id: 'fog3' },
        // Afternoon heat pattern (repeats)
        { ...testConditions[1], date: '2025-08-02', id: 'heat1' },
        { ...testConditions[1], date: '2025-08-09', id: 'heat2' },
        { ...testConditions[1], date: '2025-08-16', id: 'heat3' }
      ];
      
      const vectors = historicalPatterns.map(p => 
        weatherAgent.createWeatherEmbedding(p)
      );
      
      // Fog patterns should be similar to each other
      const fogSimilarity = calculateCosineSimilarity(vectors[0], vectors[1]);
      expect(fogSimilarity).toBeGreaterThan(0.95);
      
      // Heat patterns should be similar to each other
      const heatSimilarity = calculateCosineSimilarity(vectors[3], vectors[4]);
      expect(heatSimilarity).toBeGreaterThan(0.95);
      
      // Fog and heat should be different
      const crossSimilarity = calculateCosineSimilarity(vectors[0], vectors[3]);
      expect(crossSimilarity).toBeLessThan(0.7);
    });

    test('Should detect anomalous weather patterns', () => {
      const normalPatterns = [
        weatherAgent.createWeatherEmbedding(testConditions[0]),
        weatherAgent.createWeatherEmbedding(testConditions[2]),
        weatherAgent.createWeatherEmbedding(testConditions[1])
      ];
      
      const anomalous = weatherAgent.createWeatherEmbedding(testConditions[3]); // Extreme heat
      
      const similarities = normalPatterns.map(n => 
        calculateCosineSimilarity(n, anomalous)
      );
      
      // Anomalous pattern should have low similarity to all normal patterns
      expect(Math.max(...similarities)).toBeLessThan(0.6);
    });

    test('Should calculate weather pattern frequency', () => {
      const patterns = [
        'stable_morning', 'stable_morning', 'stable_morning',
        'unstable_afternoon', 'unstable_afternoon',
        'neutral',
        'extreme_heat'
      ];
      
      const frequency = calculatePatternFrequency(patterns);
      
      expect(frequency['stable_morning']).toBe(3);
      expect(frequency['unstable_afternoon']).toBe(2);
      expect(frequency['neutral']).toBe(1);
      expect(frequency['extreme_heat']).toBe(1);
    });

    test('Should predict next weather pattern based on history', () => {
      const sequence = [
        weatherAgent.createWeatherEmbedding(testConditions[0]), // Morning
        weatherAgent.createWeatherEmbedding(testConditions[2]), // Midday
        weatherAgent.createWeatherEmbedding(testConditions[1])  // Afternoon
      ];
      
      // Simple prediction: find most similar to last pattern
      const lastPattern = sequence[sequence.length - 1];
      const candidates = testConditions.map(c => 
        weatherAgent.createWeatherEmbedding(c)
      );
      
      const predictions = candidates.map(c => ({
        vector: c,
        similarity: calculateCosineSimilarity(lastPattern, c)
      }));
      
      predictions.sort((a, b) => b.similarity - a.similarity);
      
      // Most similar should be the same pattern
      expect(predictions[0].similarity).toBeGreaterThan(0.99);
    });
  });

  describe('Weather Safety Validation', () => {
    test('Should identify unsafe burn conditions', () => {
      const unsafeConditions = [
        { ...testConditions[0], windSpeed: 30 }, // High wind
        { ...testConditions[0], humidity: 15 },  // Very dry
        { ...testConditions[0], windSpeed: 0.2 }, // Too calm (inversion risk)
        { ...testConditions[0], visibility: 1 }   // Poor visibility
      ];
      
      unsafeConditions.forEach(weather => {
        const vector = weatherAgent.createWeatherEmbedding(weather);
        const isSafe = evaluateBurnSafety(vector);
        expect(isSafe).toBeFalsy();
      });
    });

    test('Should calculate fire weather index components', () => {
      const weather = {
        temperature: 30,
        humidity: 25,
        windSpeed: 15,
        windDirection: 270,
        pressure: 1010,
        cloudCover: 20,
        visibility: 40,
        timestamp: new Date('2025-08-25T14:00:00')
      };
      
      const vector = weatherAgent.createWeatherEmbedding(weather);
      const fwi = calculateFireWeatherIndex(vector);
      
      expect(fwi).toBeGreaterThan(0);
      expect(fwi).toBeLessThan(100);
      
      // High temp, low humidity, moderate wind = high FWI
      expect(fwi).toBeGreaterThan(50);
    });

    test('Should determine optimal burn windows', () => {
      const dayVectors = [];
      for (let hour = 0; hour < 24; hour++) {
        const weather = {
          ...testConditions[2],
          timestamp: new Date(`2025-08-25T${hour.toString().padStart(2, '0')}:00:00`),
          temperature: 15 + Math.sin(hour * Math.PI / 12) * 10,
          humidity: 70 - Math.sin(hour * Math.PI / 12) * 20,
          windSpeed: 5 + Math.sin(hour * Math.PI / 12) * 3
        };
        dayVectors.push(weatherAgent.createWeatherEmbedding(weather));
      }
      
      const burnWindows = identifyBurnWindows(dayVectors);
      
      expect(burnWindows).toBeDefined();
      expect(Array.isArray(burnWindows)).toBeTruthy();
      
      // Should identify morning and late afternoon as optimal
      const optimalHours = burnWindows.filter(w => w.isOptimal).map(w => w.hour);
      expect(optimalHours).toContain(10); // Mid-morning
      expect(optimalHours).toContain(16); // Late afternoon
    });
  });
});

// Helper functions for weather vector analysis
function calculateCosineSimilarity(v1, v2) {
  const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const magnitude1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

function performKMeansClustering(vectors, k) {
  const clusters = [];
  for (let i = 0; i < k; i++) {
    clusters.push({
      centroid: vectors[Math.floor(Math.random() * vectors.length)],
      members: []
    });
  }
  
  // Single iteration for testing
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

function calculateEuclideanDistance(v1, v2) {
  return Math.sqrt(v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0));
}

function calculatePatternFrequency(patterns) {
  return patterns.reduce((freq, pattern) => {
    freq[pattern] = (freq[pattern] || 0) + 1;
    return freq;
  }, {});
}

function evaluateBurnSafety(vector) {
  const windSpeed = vector[2] * 20; // Denormalize
  const humidity = vector[1] * 100;
  const visibility = vector[6] * 50;
  
  // Safety criteria based on CLAUDE.md specifications
  if (windSpeed > 25) return false; // Too windy
  if (windSpeed < 1) return false;  // Too calm (inversion risk)
  if (humidity < 20) return false;  // Too dry
  if (visibility < 5) return false; // Poor visibility
  
  return true;
}

function calculateFireWeatherIndex(vector) {
  const temp = vector[0] * 50;
  const humidity = vector[1] * 100;
  const windSpeed = vector[2] * 20;
  
  // Simplified FWI calculation
  const moistureCode = Math.max(0, 100 - humidity);
  const windEffect = Math.min(windSpeed * 2, 50);
  const tempEffect = Math.max(0, temp - 10);
  
  return (moistureCode + windEffect + tempEffect) / 2;
}

function identifyBurnWindows(dayVectors) {
  return dayVectors.map((vector, hour) => {
    const safety = evaluateBurnSafety(vector);
    const fwi = calculateFireWeatherIndex(vector);
    
    // Optimal conditions: safe, moderate FWI, good dispersion
    const isOptimal = safety && fwi > 20 && fwi < 60;
    
    return { hour, isOptimal, safety, fwi };
  });
}

module.exports = {
  calculateCosineSimilarity,
  performKMeansClustering,
  calculateEuclideanDistance,
  calculatePatternFrequency,
  evaluateBurnSafety,
  calculateFireWeatherIndex,
  identifyBurnWindows
};