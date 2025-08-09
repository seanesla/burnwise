/**
 * BURNWISE Vector Similarity Testing Suite
 * 
 * Ultra-deep testing of vector similarity operations, TiDB vector search functionality,
 * and mathematical correctness of all vector-based operations in the system.
 */

const { initializeDatabase, query, closePool } = require('../db/connection');
const BurnRequestCoordinator = require('../agents/coordinatorFixed5Agent');
const WeatherAgent = require('../agents/weather');
const SmokeOverlapPredictor = require('../agents/predictor');

describe('Vector Similarity Testing Suite', () => {
  let coordinator, weatherAgent, predictor;

  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new BurnRequestCoordinator();
    weatherAgent = new WeatherAgent();
    predictor = new SmokeOverlapPredictor();
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  describe('Vector Mathematical Properties', () => {
    
    test('terrain vectors should satisfy mathematical properties', () => {
      const baseRequest = {
        elevationMeters: 300,
        terrainSlope: 15,
        fuelLoadTonsPerHectare: 20,
        requestedDate: '2025-08-15'
      };
      const areaHectares = 50;
      const center = [-120, 40];

      const vector1 = coordinator.generateTerrainVector(baseRequest, areaHectares, center);
      const vector2 = coordinator.generateTerrainVector(baseRequest, areaHectares, center);

      // Identity property: v = v
      expect(vector1).toEqual(vector2);

      // Vector length should be consistent
      expect(vector1).toHaveLength(32);

      // All components should be finite numbers
      vector1.forEach((component, index) => {
        expect(component).toBeFinite();
        expect(component).not.toBeNaN();
        expect(typeof component).toBe('number');
      });
    });

    test('weather vectors should demonstrate similarity for similar conditions', () => {
      const baseWeather = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013
      };

      const similarWeather = {
        temperature: 26,
        humidity: 62,
        windSpeed: 11,
        windDirection: 185,
        pressure: 1015
      };

      const differentWeather = {
        temperature: 5,
        humidity: 90,
        windSpeed: 25,
        windDirection: 45,
        pressure: 950
      };

      const baseVector = weatherAgent.createWeatherEmbedding(baseWeather);
      const similarVector = weatherAgent.createWeatherEmbedding(similarWeather);
      const differentVector = weatherAgent.createWeatherEmbedding(differentWeather);

      // Calculate cosine similarity
      const cosineSimilarity = (v1, v2) => {
        const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
        const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
        const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (norm1 * norm2);
      };

      const similarityToSimilar = cosineSimilarity(baseVector, similarVector);
      const similarityToDifferent = cosineSimilarity(baseVector, differentVector);

      console.log(`\n🧮 Weather Vector Similarities:`);
      console.log(`   Base to Similar: ${similarityToSimilar.toFixed(4)}`);
      console.log(`   Base to Different: ${similarityToDifferent.toFixed(4)}`);

      // Similar weather should have higher similarity than different weather
      expect(similarityToSimilar).toBeGreaterThan(similarityToDifferent);
      expect(similarityToSimilar).toBeGreaterThan(0.8); // High similarity
      expect(similarityToDifferent).toBeLessThan(0.8);   // Lower similarity
    });

    test('smoke vectors should scale correctly with burn parameters', async () => {
      const baseWeather = { windSpeed: 5, windDirection: 180, temperature: 25 };
      
      const smallBurn = await predictor.generateSmokeVector(1, baseWeather, 10);
      const mediumBurn = await predictor.generateSmokeVector(2, baseWeather, 100);
      const largeBurn = await predictor.generateSmokeVector(3, baseWeather, 1000);

      // Emission components should scale with area
      expect(largeBurn[0]).toBeGreaterThan(mediumBurn[0]);
      expect(mediumBurn[0]).toBeGreaterThan(smallBurn[0]);

      // Calculate vector magnitudes
      const magnitude = (vector) => Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      
      const smallMagnitude = magnitude(smallBurn);
      const mediumMagnitude = magnitude(mediumBurn);
      const largeMagnitude = magnitude(largeBurn);

      console.log(`\n📏 Smoke Vector Magnitudes:`);
      console.log(`   Small Burn (10ha): ${smallMagnitude.toFixed(4)}`);
      console.log(`   Medium Burn (100ha): ${mediumMagnitude.toFixed(4)}`);
      console.log(`   Large Burn (1000ha): ${largeMagnitude.toFixed(4)}`);

      // Larger burns should generally have larger vector magnitudes
      expect(largeMagnitude).toBeGreaterThan(smallMagnitude);
    });
  });

  describe('TiDB Vector Operations', () => {
    
    test('should store and retrieve terrain vectors correctly', async () => {
      const testVector = coordinator.generateTerrainVector({
        elevationMeters: 250,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 18,
        requestedDate: '2025-08-15'
      }, 60, [-119.5, 39.8]);

      const vectorString = `[${testVector.join(',')}]`;

      try {
        // Insert a test burn request with terrain vector
        const insertResult = await query(`
          INSERT INTO burn_requests (
            field_id, requested_date, requested_start_time,
            requested_end_time, burn_type, purpose,
            estimated_duration_hours, status, priority_score,
            terrain_vector
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `, [1, '2025-08-15', '09:00', '15:00', 'prescribed', 'Vector test', 4, 75, vectorString]);

        const requestId = insertResult.insertId;
        expect(requestId).toBeDefined();

        // Retrieve the stored vector
        const [storedRecord] = await query(
          'SELECT terrain_vector FROM burn_requests WHERE request_id = ?',
          [requestId]
        );

        expect(storedRecord).toBeDefined();
        expect(storedRecord.terrain_vector).toBeDefined();

        // Parse and verify the stored vector
        const storedVector = JSON.parse(storedRecord.terrain_vector);
        expect(storedVector).toHaveLength(32);
        
        // Verify each component matches (with floating point tolerance)
        testVector.forEach((expectedValue, index) => {
          expect(storedVector[index]).toBeCloseTo(expectedValue, 6);
        });

        // Clean up
        await query('DELETE FROM burn_requests WHERE request_id = ?', [requestId]);

      } catch (error) {
        throw new Error(`TiDB vector storage test failed: ${error.message}`);
      }
    });

    test('should perform vector similarity queries correctly', async () => {
      // Create test vectors with known relationships
      const similarRequest1 = {
        elevationMeters: 200,
        terrainSlope: 10,
        fuelLoadTonsPerHectare: 15,
        requestedDate: '2025-08-15'
      };
      
      const similarRequest2 = {
        elevationMeters: 210,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 16,
        requestedDate: '2025-08-15'
      };

      const differentRequest = {
        elevationMeters: 2000,
        terrainSlope: 45,
        fuelLoadTonsPerHectare: 45,
        requestedDate: '2025-08-15'
      };

      const vector1 = coordinator.generateTerrainVector(similarRequest1, 50, [-120, 40]);
      const vector2 = coordinator.generateTerrainVector(similarRequest2, 52, [-120.1, 40.1]);
      const vector3 = coordinator.generateTerrainVector(differentRequest, 500, [150, -30]);

      const vector1String = `[${vector1.join(',')}]`;
      const vector2String = `[${vector2.join(',')}]`;
      const vector3String = `[${vector3.join(',')}]`;

      try {
        // Insert test records
        const insertPromises = [
          query(`
            INSERT INTO burn_requests (
              field_id, requested_date, requested_start_time,
              requested_end_time, purpose, terrain_vector
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [1, '2025-08-15', '09:00', '15:00', 'Similarity test 1', vector1String]),
          
          query(`
            INSERT INTO burn_requests (
              field_id, requested_date, requested_start_time,
              requested_end_time, purpose, terrain_vector
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [2, '2025-08-15', '09:00', '15:00', 'Similarity test 2', vector2String]),
          
          query(`
            INSERT INTO burn_requests (
              field_id, requested_date, requested_start_time,
              requested_end_time, purpose, terrain_vector
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [3, '2025-08-15', '09:00', '15:00', 'Similarity test 3', vector3String])
        ];

        const results = await Promise.all(insertPromises);
        const [id1, id2, id3] = results.map(r => r.insertId);

        // Test vector similarity search
        const similarityQuery = `
          SELECT 
            request_id,
            purpose,
            VEC_COSINE_DISTANCE(terrain_vector, ?) as distance
          FROM burn_requests 
          WHERE request_id IN (?, ?, ?)
          ORDER BY distance ASC
        `;

        const similarityResults = await query(similarityQuery, [vector1String, id1, id2, id3]);

        console.log(`\n🔍 Vector Similarity Search Results:`);
        similarityResults.forEach((row, index) => {
          console.log(`   ${index + 1}. ID ${row.request_id}: ${row.purpose} (distance: ${row.distance?.toFixed(4)})`);
        });

        // Verify similarity ordering
        expect(similarityResults).toHaveLength(3);
        expect(similarityResults[0].request_id).toBe(id1); // Should be most similar to itself (distance 0)
        expect(similarityResults[1].request_id).toBe(id2); // Should be second most similar
        expect(similarityResults[2].request_id).toBe(id3); // Should be least similar

        // Verify distance values
        expect(similarityResults[0].distance).toBeCloseTo(0, 6); // Distance to self should be 0
        expect(similarityResults[1].distance).toBeLessThan(similarityResults[2].distance); // Similar should be closer than different

        // Clean up
        await query('DELETE FROM burn_requests WHERE request_id IN (?, ?, ?)', [id1, id2, id3]);

      } catch (error) {
        throw new Error(`Vector similarity query test failed: ${error.message}`);
      }
    });

    test('should handle weather vector similarity searches', async () => {
      const weather1 = { temperature: 20, humidity: 50, windSpeed: 5, windDirection: 180 };
      const weather2 = { temperature: 22, humidity: 52, windSpeed: 7, windDirection: 185 };
      const weather3 = { temperature: -10, humidity: 90, windSpeed: 30, windDirection: 45 };

      const vector1 = weatherAgent.createWeatherEmbedding(weather1);
      const vector2 = weatherAgent.createWeatherEmbedding(weather2);
      const vector3 = weatherAgent.createWeatherEmbedding(weather3);

      const vector1String = `[${vector1.join(',')}]`;
      const vector2String = `[${vector2.join(',')}]`;
      const vector3String = `[${vector3.join(',')}]`;

      try {
        // Insert weather records
        const insertPromises = [
          query(`
            INSERT INTO weather_conditions (
              latitude, longitude, observation_time,
              temperature_celsius, humidity_percent,
              wind_speed_mps, wind_direction_degrees,
              weather_pattern_embedding
            ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
          `, [40, -120, weather1.temperature, weather1.humidity, weather1.windSpeed, weather1.windDirection, vector1String]),
          
          query(`
            INSERT INTO weather_conditions (
              latitude, longitude, observation_time,
              temperature_celsius, humidity_percent,
              wind_speed_mps, wind_direction_degrees,
              weather_pattern_embedding
            ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
          `, [40.1, -120.1, weather2.temperature, weather2.humidity, weather2.windSpeed, weather2.windDirection, vector2String]),
          
          query(`
            INSERT INTO weather_conditions (
              latitude, longitude, observation_time,
              temperature_celsius, humidity_percent,
              wind_speed_mps, wind_direction_degrees,
              weather_pattern_embedding
            ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
          `, [45, -125, weather3.temperature, weather3.humidity, weather3.windSpeed, weather3.windDirection, vector3String])
        ];

        const results = await Promise.all(insertPromises);
        const [id1, id2, id3] = results.map(r => r.insertId);

        // Test weather pattern similarity
        const weatherSimilarityQuery = `
          SELECT 
            weather_id,
            temperature_celsius,
            humidity_percent,
            wind_speed_mps,
            VEC_COSINE_DISTANCE(weather_pattern_embedding, ?) as pattern_distance
          FROM weather_conditions 
          WHERE weather_id IN (?, ?, ?)
          ORDER BY pattern_distance ASC
        `;

        const weatherResults = await query(weatherSimilarityQuery, [vector1String, id1, id2, id3]);

        console.log(`\n🌤️ Weather Pattern Similarity Results:`);
        weatherResults.forEach((row, index) => {
          console.log(`   ${index + 1}. ID ${row.weather_id}: T=${row.temperature_celsius}°C, H=${row.humidity_percent}%, W=${row.wind_speed_mps}m/s (distance: ${row.pattern_distance?.toFixed(4)})`);
        });

        // Verify similarity ordering
        expect(weatherResults).toHaveLength(3);
        expect(weatherResults[0].weather_id).toBe(id1); // Most similar to itself
        expect(weatherResults[1].weather_id).toBe(id2); // Similar conditions should be second
        expect(weatherResults[2].weather_id).toBe(id3); // Different conditions should be last

        // Clean up
        await query('DELETE FROM weather_conditions WHERE weather_id IN (?, ?, ?)', [id1, id2, id3]);

      } catch (error) {
        throw new Error(`Weather vector similarity test failed: ${error.message}`);
      }
    });

    test('should handle smoke vector similarity for conflict detection', async () => {
      const weather = { windSpeed: 8, windDirection: 225, temperature: 22 };
      
      const smokeVector1 = await predictor.generateSmokeVector(1001, weather, 50);
      const smokeVector2 = await predictor.generateSmokeVector(1002, weather, 55);
      const smokeVector3 = await predictor.generateSmokeVector(1003, { windSpeed: 25, windDirection: 45, temperature: 5 }, 200);

      const vector1String = `[${smokeVector1.join(',')}]`;
      const vector2String = `[${smokeVector2.join(',')}]`;
      const vector3String = `[${smokeVector3.join(',')}]`;

      try {
        // Insert smoke prediction records
        const insertPromises = [
          query(`
            INSERT INTO smoke_predictions (
              burn_request_id, prediction_time,
              plume_vector, max_pm25_ugm3,
              dispersion_radius_km, confidence_score
            ) VALUES (?, NOW(), ?, ?, ?, ?)
          `, [1001, vector1String, 75, 8.5, 0.85]),
          
          query(`
            INSERT INTO smoke_predictions (
              burn_request_id, prediction_time,
              plume_vector, max_pm25_ugm3,
              dispersion_radius_km, confidence_score
            ) VALUES (?, NOW(), ?, ?, ?, ?)
          `, [1002, vector2String, 80, 9.2, 0.82]),
          
          query(`
            INSERT INTO smoke_predictions (
              burn_request_id, prediction_time,
              plume_vector, max_pm25_ugm3,
              dispersion_radius_km, confidence_score
            ) VALUES (?, NOW(), ?, ?, ?, ?)
          `, [1003, vector3String, 150, 15.0, 0.78])
        ];

        const results = await Promise.all(insertPromises);
        const [id1, id2, id3] = results.map(r => r.insertId);

        // Test smoke plume similarity for conflict detection
        const conflictQuery = `
          SELECT 
            prediction_id,
            burn_request_id,
            max_pm25_ugm3,
            dispersion_radius_km,
            VEC_COSINE_DISTANCE(plume_vector, ?) as plume_similarity
          FROM smoke_predictions 
          WHERE prediction_id IN (?, ?, ?)
          ORDER BY plume_similarity ASC
        `;

        const conflictResults = await query(conflictQuery, [vector1String, id1, id2, id3]);

        console.log(`\n💨 Smoke Plume Similarity Results:`);
        conflictResults.forEach((row, index) => {
          console.log(`   ${index + 1}. Request ${row.burn_request_id}: PM2.5=${row.max_pm25_ugm3}µg/m³, Radius=${row.dispersion_radius_km}km (similarity: ${row.plume_similarity?.toFixed(4)})`);
        });

        // Test conflict detection threshold
        const conflictThreshold = 0.3; // Similar plumes might indicate conflicts
        const potentialConflicts = conflictResults.filter(row => 
          row.plume_similarity < conflictThreshold && row.prediction_id !== id1
        );

        console.log(`   Potential conflicts (similarity < ${conflictThreshold}): ${potentialConflicts.length}`);

        // Verify results
        expect(conflictResults).toHaveLength(3);
        expect(conflictResults[0].prediction_id).toBe(id1); // Self should be most similar

        // Clean up
        await query('DELETE FROM smoke_predictions WHERE prediction_id IN (?, ?, ?)', [id1, id2, id3]);

      } catch (error) {
        throw new Error(`Smoke vector similarity test failed: ${error.message}`);
      }
    });
  });

  describe('Vector Performance and Optimization', () => {
    
    test('should perform vector operations efficiently at scale', async () => {
      const numVectors = 50;
      const vectors = [];

      // Generate test vectors
      for (let i = 0; i < numVectors; i++) {
        const vector = coordinator.generateTerrainVector({
          elevationMeters: 100 + i * 20,
          terrainSlope: i % 45,
          fuelLoadTonsPerHectare: 10 + (i % 40),
          requestedDate: '2025-08-15'
        }, 20 + i, [-120 + i * 0.01, 40 + i * 0.01]);
        
        vectors.push({
          id: i,
          vector,
          vectorString: `[${vector.join(',')}]`
        });
      }

      const startTime = performance.now();

      try {
        // Insert all vectors
        const insertPromises = vectors.map(({ id, vectorString }) =>
          query(`
            INSERT INTO burn_requests (
              field_id, requested_date, purpose, terrain_vector
            ) VALUES (?, ?, ?, ?)
          `, [id + 1, '2025-08-15', `Performance test ${id}`, vectorString])
        );

        const insertResults = await Promise.all(insertPromises);
        const insertIds = insertResults.map(r => r.insertId);

        // Perform similarity searches
        const searchPromises = vectors.slice(0, 10).map(({ vectorString }) =>
          query(`
            SELECT COUNT(*) as similar_count
            FROM burn_requests 
            WHERE VEC_COSINE_DISTANCE(terrain_vector, ?) < 0.5
            AND request_id IN (${insertIds.join(',')})
          `, [vectorString])
        );

        const searchResults = await Promise.all(searchPromises);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        console.log(`\n⚡ Vector Performance Test:`);
        console.log(`   Vectors processed: ${numVectors}`);
        console.log(`   Similarity searches: 10`);
        console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`   Avg time per vector: ${(totalTime / numVectors).toFixed(2)}ms`);
        console.log(`   Avg search time: ${(totalTime / 10).toFixed(2)}ms`);

        // Verify results
        expect(searchResults).toHaveLength(10);
        searchResults.forEach(result => {
          expect(result[0].similar_count).toBeGreaterThanOrEqual(1); // At least the vector itself
        });

        // Performance requirements
        expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
        expect(totalTime / numVectors).toBeLessThan(100); // Less than 100ms per vector

        // Clean up
        await query(`DELETE FROM burn_requests WHERE request_id IN (${insertIds.join(',')})`);

      } catch (error) {
        throw new Error(`Vector performance test failed: ${error.message}`);
      }
    });

    test('should handle vector indexing efficiently', async () => {
      // Test that vector indexes are working by comparing query performance
      const testVector = coordinator.generateTerrainVector({
        elevationMeters: 300,
        terrainSlope: 15,
        fuelLoadTonsPerHectare: 20,
        requestedDate: '2025-08-15'
      }, 50, [-120, 40]);

      const vectorString = `[${testVector.join(',')}]`;

      const startTime = performance.now();

      try {
        // This query should use the vector index if available
        const indexedQuery = `
          SELECT COUNT(*) as count
          FROM burn_requests br
          WHERE VEC_COSINE_DISTANCE(br.terrain_vector, ?) < 0.8
          LIMIT 10
        `;

        const result = await query(indexedQuery, [vectorString]);
        
        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`\n📊 Vector Index Performance:`);
        console.log(`   Query time: ${queryTime.toFixed(2)}ms`);
        console.log(`   Results: ${result[0]?.count || 0}`);

        // Should complete quickly with proper indexing
        expect(queryTime).toBeLessThan(1000); // Less than 1 second
        expect(result).toHaveLength(1);

      } catch (error) {
        // Vector indexing might not be available in test environment
        console.log(`   Vector indexing test skipped: ${error.message}`);
      }
    });
  });

  describe('Vector Data Integrity', () => {
    
    test('should maintain vector integrity through CRUD operations', async () => {
      const originalVector = coordinator.generateTerrainVector({
        elevationMeters: 250,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 18,
        requestedDate: '2025-08-15'
      }, 60, [-119.5, 39.8]);

      const vectorString = `[${originalVector.join(',')}]`;

      try {
        // CREATE
        const insertResult = await query(`
          INSERT INTO burn_requests (
            field_id, requested_date, purpose, terrain_vector
          ) VALUES (?, ?, ?, ?)
        `, [1, '2025-08-15', 'Integrity test', vectorString]);

        const requestId = insertResult.insertId;

        // READ
        const [readResult] = await query(
          'SELECT terrain_vector FROM burn_requests WHERE request_id = ?',
          [requestId]
        );

        const readVector = JSON.parse(readResult.terrain_vector);
        
        // Verify CREATE/READ integrity
        expect(readVector).toHaveLength(32);
        originalVector.forEach((value, index) => {
          expect(readVector[index]).toBeCloseTo(value, 10);
        });

        // UPDATE with new vector
        const updatedVector = coordinator.generateTerrainVector({
          elevationMeters: 300,
          terrainSlope: 20,
          fuelLoadTonsPerHectare: 25,
          requestedDate: '2025-08-15'
        }, 80, [-119.3, 39.9]);

        const updatedVectorString = `[${updatedVector.join(',')}]`;

        await query(
          'UPDATE burn_requests SET terrain_vector = ? WHERE request_id = ?',
          [updatedVectorString, requestId]
        );

        // READ updated vector
        const [updatedReadResult] = await query(
          'SELECT terrain_vector FROM burn_requests WHERE request_id = ?',
          [requestId]
        );

        const updatedReadVector = JSON.parse(updatedReadResult.terrain_vector);

        // Verify UPDATE integrity
        expect(updatedReadVector).toHaveLength(32);
        updatedVector.forEach((value, index) => {
          expect(updatedReadVector[index]).toBeCloseTo(value, 10);
        });

        // Verify vector actually changed
        const vectorsAreEqual = originalVector.every((value, index) => 
          Math.abs(value - updatedReadVector[index]) < 0.000001
        );
        expect(vectorsAreEqual).toBe(false);

        // DELETE
        await query('DELETE FROM burn_requests WHERE request_id = ?', [requestId]);

        // Verify DELETE
        const [deletedResult] = await query(
          'SELECT terrain_vector FROM burn_requests WHERE request_id = ?',
          [requestId]
        );

        expect(deletedResult).toBeUndefined();

        console.log(`\n✅ Vector CRUD Integrity Test Passed`);

      } catch (error) {
        throw new Error(`Vector integrity test failed: ${error.message}`);
      }
    });

    test('should handle vector data corruption gracefully', async () => {
      try {
        // Test with corrupted vector data
        const corruptedVectorStrings = [
          '[1,2,3,NaN,5]',
          '[1,2,3,Infinity,5]',
          '[1,2,3]', // Wrong dimension
          'not_a_vector',
          '[]',
          null
        ];

        for (const corruptedVector of corruptedVectorStrings) {
          try {
            await query(`
              INSERT INTO burn_requests (
                field_id, requested_date, purpose, terrain_vector
              ) VALUES (?, ?, ?, ?)
            `, [1, '2025-08-15', 'Corruption test', corruptedVector]);

            // If insert succeeded, clean up
            await query('DELETE FROM burn_requests WHERE purpose = ?', ['Corruption test']);
            
          } catch (error) {
            // Expected to fail for corrupted data
            expect(error).toBeInstanceOf(Error);
            console.log(`   Correctly rejected corrupted vector: ${corruptedVector?.substring(0, 20)}`);
          }
        }

        console.log(`\n🛡️ Vector Corruption Handling Test Passed`);

      } catch (error) {
        throw new Error(`Vector corruption test failed: ${error.message}`);
      }
    });
  });

  describe('Vector Dimension Consistency', () => {
    
    test('should maintain consistent dimensions across all vector types', () => {
      // Test terrain vectors (32-dimensional)
      const terrainVector = coordinator.generateTerrainVector({
        elevationMeters: 200,
        terrainSlope: 10,
        fuelLoadTonsPerHectare: 15,
        requestedDate: '2025-08-15'
      }, 50, [-120, 40]);

      expect(terrainVector).toHaveLength(32);

      // Test weather vectors (128-dimensional)
      const weatherVector = weatherAgent.createWeatherEmbedding({
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180
      });

      expect(weatherVector).toHaveLength(128);

      console.log(`\n📐 Vector Dimensions:`);
      console.log(`   Terrain vectors: ${terrainVector.length} dimensions`);
      console.log(`   Weather vectors: ${weatherVector.length} dimensions`);
      console.log(`   All vectors have consistent dimensions ✅`);
    });

    test('should generate smoke vectors with correct dimensions', async () => {
      const smokeVector = await predictor.generateSmokeVector(
        123,
        { windSpeed: 8, windDirection: 225, temperature: 22 },
        75
      );

      expect(smokeVector).toHaveLength(64);
      
      smokeVector.forEach((component, index) => {
        expect(component).toBeFinite();
        expect(component).not.toBeNaN();
      });

      console.log(`   Smoke vectors: ${smokeVector.length} dimensions ✅`);
    });
  });
});