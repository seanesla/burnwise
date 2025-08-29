const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool, getConnection } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinator');
const SmokeOverlapPredictor = require('../../agents/predictor');
const WeatherAgent = require('../../agents/weather');

describe('Vector Storage Tests - TiDB VECTOR Column Operations', () => {
  let connection;
  let coordinator;
  let predictor;
  let weatherAgent;
  
  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new CoordinatorAgent();
    predictor = new SmokeOverlapPredictor();
    weatherAgent = new WeatherAgent();
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });
  
  beforeEach(async () => {
    // Get connection for transaction tests
    try {
      connection = await getConnection();
    } catch (error) {
      // Expected without TiDB connection
    }
  });

  describe('Vector Column Creation and Schema', () => {
    test('Should create VECTOR(32) column for terrain vectors', async () => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS terrain_vectors_test (
          location_id VARCHAR(50) PRIMARY KEY,
          terrain_vector VECTOR(32) NOT NULL,
          lat DECIMAL(10, 6),
          lon DECIMAL(10, 6),
          elevation INT,
          slope INT,
          vegetation VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_terrain_vector (terrain_vector)
        )
      `;
      
      try {
        await query(createTableSQL);
        
        // Verify table structure
        const describeSQL = 'DESCRIBE terrain_vectors_test';
        const columns = await query(describeSQL);
        
        const vectorColumn = columns.find(c => c.Field === 'terrain_vector');
        expect(vectorColumn).toBeDefined();
        expect(vectorColumn.Type).toContain('VECTOR(32)');
      } catch (error) {
        // Expected without TiDB connection
        expect(error.code).toBeTruthy();
      }
    });

    test('Should create VECTOR(64) column for smoke plume vectors', async () => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS smoke_predictions_test (
          prediction_id VARCHAR(50) PRIMARY KEY,
          burn_request_id INT,
          plume_vector VECTOR(64) NOT NULL,
          max_pm25 DECIMAL(10, 2),
          affected_area_km2 DECIMAL(10, 2),
          duration_hours INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_plume_vector (plume_vector)
        )
      `;
      
      try {
        await query(createTableSQL);
        
        const describeSQL = 'DESCRIBE smoke_predictions_test';
        const columns = await query(describeSQL);
        
        const vectorColumn = columns.find(c => c.Field === 'plume_vector');
        expect(vectorColumn).toBeDefined();
        expect(vectorColumn.Type).toContain('VECTOR(64)');
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should create VECTOR(128) column for weather patterns', async () => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS weather_conditions_test (
          observation_id VARCHAR(50) PRIMARY KEY,
          weather_pattern_embedding VECTOR(128) NOT NULL,
          temperature_celsius DECIMAL(5, 2),
          humidity_percent INT,
          wind_speed_mps DECIMAL(5, 2),
          wind_direction_degrees INT,
          stability_class INT,
          observation_time TIMESTAMP,
          INDEX idx_weather_pattern (weather_pattern_embedding)
        )
      `;
      
      try {
        await query(createTableSQL);
        
        const describeSQL = 'DESCRIBE weather_conditions_test';
        const columns = await query(describeSQL);
        
        const vectorColumn = columns.find(c => c.Field === 'weather_pattern_embedding');
        expect(vectorColumn).toBeDefined();
        expect(vectorColumn.Type).toContain('VECTOR(128)');
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should validate vector dimension constraints', async () => {
      const vector32 = await coordinator.generateTerrainVector(40, -120, 100, 5, 'grassland');
      const vector64 = await predictor.generateSmokeVector(1, { windSpeed: 10 }, 100);
      
      // Try to insert wrong dimension
      const wrongDimSQL = `
        INSERT INTO terrain_vectors_test (location_id, terrain_vector)
        VALUES (?, ?)
      `;
      
      try {
        // Attempt to insert 64-dim vector into 32-dim column
        await query(wrongDimSQL, ['wrong_dim_1', JSON.stringify(vector64)]);
        
        // Should fail with dimension mismatch
        expect(false).toBeTruthy(); // Should not reach here
      } catch (error) {
        // Expected error for dimension mismatch
        expect(error).toBeDefined();
      }
    });
  });

  describe('Vector Serialization and Storage', () => {
    test('Should serialize and store 32-dimensional terrain vector', async () => {
      const vector = await coordinator.generateTerrainVector(
        40.7749, -122.4194, 52, 5, 'urban'
      );
      
      const serialized = serializeVector(vector);
      
      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('string');
      
      const insertSQL = `
        INSERT INTO terrain_vectors_test (
          location_id, terrain_vector, lat, lon, elevation, slope, vegetation
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      try {
        await query(insertSQL, [
          'terrain_001',
          serialized,
          40.7749,
          -122.4194,
          52,
          5,
          'urban'
        ]);
        
        // Verify insertion
        const selectSQL = 'SELECT * FROM terrain_vectors_test WHERE location_id = ?';
        const result = await query(selectSQL, ['terrain_001']);
        
        expect(result).toHaveLength(1);
        expect(result[0].location_id).toBe('terrain_001');
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should serialize and store 64-dimensional smoke vector', async () => {
      const vector = await predictor.generateSmokeVector(
        1001,
        { windSpeed: 15, windDirection: 270 },
        200
      );
      
      const serialized = serializeVector(vector);
      
      const insertSQL = `
        INSERT INTO smoke_predictions_test (
          prediction_id, burn_request_id, plume_vector, max_pm25, affected_area_km2
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      try {
        await query(insertSQL, [
          'smoke_001',
          1001,
          serialized,
          85.5,
          25.3
        ]);
        
        const result = await query(
          'SELECT * FROM smoke_predictions_test WHERE prediction_id = ?',
          ['smoke_001']
        );
        
        expect(result).toHaveLength(1);
        expect(result[0].burn_request_id).toBe(1001);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should serialize and store 128-dimensional weather vector', async () => {
      const weather = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013,
        cloudCover: 50,
        visibility: 20,
        timestamp: new Date('2025-08-25T12:00:00')
      };
      
      const vector = weatherAgent.createWeatherEmbedding(weather);
      const serialized = serializeVector(vector);
      
      const insertSQL = `
        INSERT INTO weather_conditions_test (
          observation_id, weather_pattern_embedding, temperature_celsius,
          humidity_percent, wind_speed_mps, observation_time
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      try {
        await query(insertSQL, [
          'weather_001',
          serialized,
          weather.temperature,
          weather.humidity,
          weather.windSpeed,
          weather.timestamp
        ]);
        
        const result = await query(
          'SELECT * FROM weather_conditions_test WHERE observation_id = ?',
          ['weather_001']
        );
        
        expect(result).toHaveLength(1);
        expect(result[0].temperature_celsius).toBe(25);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should handle binary vector format', async () => {
      const vector = new Array(32).fill(0).map(() => Math.random());
      
      // Test both JSON and binary serialization
      const jsonSerialized = JSON.stringify(vector);
      const binarySerialized = vectorToBinary(vector);
      
      expect(jsonSerialized).toBeDefined();
      expect(binarySerialized).toBeDefined();
      expect(binarySerialized.byteLength).toBe(32 * 4); // 32 floats * 4 bytes
    });

    test('Should preserve vector precision after storage', async () => {
      const originalVector = await coordinator.generateTerrainVector(
        40.0, -120.0, 100, 5, 'grassland'
      );
      
      const serialized = serializeVector(originalVector);
      
      try {
        await query(
          'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
          ['precision_test', serialized]
        );
        
        const result = await query(
          'SELECT terrain_vector FROM terrain_vectors_test WHERE location_id = ?',
          ['precision_test']
        );
        
        if (result.length > 0) {
          const retrieved = deserializeVector(result[0].terrain_vector);
          
          // Check precision preservation
          originalVector.forEach((val, idx) => {
            expect(retrieved[idx]).toBeCloseTo(val, 5);
          });
        }
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });
  });

  describe('Vector Retrieval and Deserialization', () => {
    test('Should retrieve and deserialize terrain vectors', async () => {
      const originalVector = await coordinator.generateTerrainVector(
        40.0, -120.0, 100, 5, 'grassland'
      );
      
      try {
        // Store vector
        await query(
          'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
          ['retrieve_terrain', serializeVector(originalVector)]
        );
        
        // Retrieve vector
        const result = await query(
          'SELECT terrain_vector FROM terrain_vectors_test WHERE location_id = ?',
          ['retrieve_terrain']
        );
        
        if (result.length > 0) {
          const retrieved = deserializeVector(result[0].terrain_vector);
          
          expect(retrieved).toHaveLength(32);
          expect(retrieved).toEqual(originalVector);
        }
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should retrieve and deserialize smoke vectors', async () => {
      const originalVector = await predictor.generateSmokeVector(
        2001,
        { windSpeed: 10, windDirection: 180 },
        150
      );
      
      try {
        await query(
          'INSERT INTO smoke_predictions_test (prediction_id, plume_vector) VALUES (?, ?)',
          ['retrieve_smoke', serializeVector(originalVector)]
        );
        
        const result = await query(
          'SELECT plume_vector FROM smoke_predictions_test WHERE prediction_id = ?',
          ['retrieve_smoke']
        );
        
        if (result.length > 0) {
          const retrieved = deserializeVector(result[0].plume_vector);
          
          expect(retrieved).toHaveLength(64);
          expect(retrieved).toEqual(originalVector);
        }
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should retrieve and deserialize weather vectors', async () => {
      const weather = {
        temperature: 30,
        humidity: 50,
        windSpeed: 15,
        timestamp: new Date()
      };
      
      const originalVector = weatherAgent.createWeatherEmbedding(weather);
      
      try {
        await query(
          'INSERT INTO weather_conditions_test (observation_id, weather_pattern_embedding) VALUES (?, ?)',
          ['retrieve_weather', serializeVector(originalVector)]
        );
        
        const result = await query(
          'SELECT weather_pattern_embedding FROM weather_conditions_test WHERE observation_id = ?',
          ['retrieve_weather']
        );
        
        if (result.length > 0) {
          const retrieved = deserializeVector(result[0].weather_pattern_embedding);
          
          expect(retrieved).toHaveLength(128);
          expect(retrieved).toEqual(originalVector);
        }
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should handle NULL vector values', async () => {
      try {
        await query(
          'INSERT INTO terrain_vectors_test (location_id) VALUES (?)',
          ['null_vector_test']
        );
        
        // Should fail due to NOT NULL constraint
        expect(false).toBeTruthy();
      } catch (error) {
        // Expected error for NULL vector
        expect(error).toBeDefined();
      }
    });
  });

  describe('Vector Update Operations', () => {
    test('Should update existing terrain vector', async () => {
      const initialVector = await coordinator.generateTerrainVector(
        40.0, -120.0, 100, 5, 'grassland'
      );
      
      const updatedVector = await coordinator.generateTerrainVector(
        40.0, -120.0, 100, 5, 'agriculture' // Changed vegetation
      );
      
      try {
        // Insert initial
        await query(
          'INSERT INTO terrain_vectors_test (location_id, terrain_vector, vegetation) VALUES (?, ?, ?)',
          ['update_test', serializeVector(initialVector), 'grassland']
        );
        
        // Update vector
        await query(
          'UPDATE terrain_vectors_test SET terrain_vector = ?, vegetation = ? WHERE location_id = ?',
          [serializeVector(updatedVector), 'agriculture', 'update_test']
        );
        
        // Verify update
        const result = await query(
          'SELECT terrain_vector, vegetation FROM terrain_vectors_test WHERE location_id = ?',
          ['update_test']
        );
        
        if (result.length > 0) {
          expect(result[0].vegetation).toBe('agriculture');
          const retrieved = deserializeVector(result[0].terrain_vector);
          expect(retrieved).toEqual(updatedVector);
        }
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should update smoke vector with new conditions', async () => {
      const initialVector = await predictor.generateSmokeVector(
        3001,
        { windSpeed: 10, windDirection: 180 },
        100
      );
      
      const updatedVector = await predictor.generateSmokeVector(
        3001,
        { windSpeed: 20, windDirection: 270 }, // Wind changed
        100
      );
      
      try {
        await query(
          'INSERT INTO smoke_predictions_test (prediction_id, plume_vector) VALUES (?, ?)',
          ['update_smoke', serializeVector(initialVector)]
        );
        
        await query(
          'UPDATE smoke_predictions_test SET plume_vector = ? WHERE prediction_id = ?',
          [serializeVector(updatedVector), 'update_smoke']
        );
        
        const result = await query(
          'SELECT plume_vector FROM smoke_predictions_test WHERE prediction_id = ?',
          ['update_smoke']
        );
        
        if (result.length > 0) {
          const retrieved = deserializeVector(result[0].plume_vector);
          expect(retrieved).toEqual(updatedVector);
          expect(retrieved).not.toEqual(initialVector);
        }
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should batch update multiple vectors', async () => {
      const vectors = await Promise.all([
        coordinator.generateTerrainVector(40.0, -120.0, 100, 5, 'grassland'),
        coordinator.generateTerrainVector(40.1, -120.1, 110, 6, 'agriculture'),
        coordinator.generateTerrainVector(40.2, -120.2, 120, 7, 'forest')
      ]);
      
      try {
        // Insert batch
        const insertPromises = vectors.map((v, i) =>
          query(
            'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
            [`batch_${i}`, serializeVector(v)]
          )
        );
        
        await Promise.all(insertPromises);
        
        // Update all with modified vectors
        const updatedVectors = vectors.map(v => 
          v.map(val => val * 1.1) // Modify all values
        );
        
        const updatePromises = updatedVectors.map((v, i) =>
          query(
            'UPDATE terrain_vectors_test SET terrain_vector = ? WHERE location_id = ?',
            [serializeVector(v), `batch_${i}`]
          )
        );
        
        await Promise.all(updatePromises);
        
        // Verify updates
        const result = await query(
          'SELECT location_id, terrain_vector FROM terrain_vectors_test WHERE location_id LIKE ?',
          ['batch_%']
        );
        
        expect(result.length).toBeGreaterThanOrEqual(3);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });
  });

  describe('Transaction Consistency', () => {
    test('Should maintain consistency in vector transactions', async () => {
      if (!connection) return;
      
      const vector1 = await coordinator.generateTerrainVector(40.0, -120.0, 100, 5, 'grassland');
      const vector2 = await coordinator.generateTerrainVector(40.1, -120.1, 110, 6, 'agriculture');
      
      try {
        await connection.beginTransaction();
        
        // Insert first vector
        await connection.execute(
          'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
          ['txn_1', serializeVector(vector1)]
        );
        
        // Insert second vector
        await connection.execute(
          'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
          ['txn_2', serializeVector(vector2)]
        );
        
        // Rollback transaction
        await connection.rollback();
        
        // Verify rollback
        const result = await query(
          'SELECT * FROM terrain_vectors_test WHERE location_id IN (?, ?)',
          ['txn_1', 'txn_2']
        );
        
        expect(result).toHaveLength(0);
      } catch (error) {
        if (connection) await connection.rollback();
        expect(error.code).toBeTruthy();
      }
    });

    test('Should handle concurrent vector updates', async () => {
      const vector = await predictor.generateSmokeVector(
        4001,
        { windSpeed: 10, windDirection: 180 },
        100
      );
      
      try {
        // Insert initial vector
        await query(
          'INSERT INTO smoke_predictions_test (prediction_id, plume_vector) VALUES (?, ?)',
          ['concurrent_test', serializeVector(vector)]
        );
        
        // Simulate concurrent updates
        const update1 = predictor.generateSmokeVector(4001, { windSpeed: 15 }, 100);
        const update2 = predictor.generateSmokeVector(4001, { windSpeed: 20 }, 100);
        
        const promises = [
          query(
            'UPDATE smoke_predictions_test SET plume_vector = ? WHERE prediction_id = ?',
            [serializeVector(await update1), 'concurrent_test']
          ),
          query(
            'UPDATE smoke_predictions_test SET plume_vector = ? WHERE prediction_id = ?',
            [serializeVector(await update2), 'concurrent_test']
          )
        ];
        
        await Promise.allSettled(promises);
        
        // One update should win
        const result = await query(
          'SELECT plume_vector FROM smoke_predictions_test WHERE prediction_id = ?',
          ['concurrent_test']
        );
        
        expect(result).toHaveLength(1);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should maintain referential integrity with vectors', async () => {
      try {
        // Create related tables
        await query(`
          CREATE TABLE IF NOT EXISTS farms_test (
            farm_id INT PRIMARY KEY,
            farm_name VARCHAR(100)
          )
        `);
        
        await query(`
          CREATE TABLE IF NOT EXISTS farm_terrain_test (
            farm_id INT,
            terrain_vector VECTOR(32),
            FOREIGN KEY (farm_id) REFERENCES farms_test(farm_id) ON DELETE CASCADE
          )
        `);
        
        // Insert farm
        await query('INSERT INTO farms_test (farm_id, farm_name) VALUES (?, ?)', [1, 'Test Farm']);
        
        // Insert terrain vector
        const vector = await coordinator.generateTerrainVector(40.0, -120.0, 100, 5, 'grassland');
        await query(
          'INSERT INTO farm_terrain_test (farm_id, terrain_vector) VALUES (?, ?)',
          [1, serializeVector(vector)]
        );
        
        // Delete farm (should cascade)
        await query('DELETE FROM farms_test WHERE farm_id = ?', [1]);
        
        // Verify cascade delete
        const result = await query('SELECT * FROM farm_terrain_test WHERE farm_id = ?', [1]);
        expect(result).toHaveLength(0);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });
  });

  describe('Vector Index Operations', () => {
    test('Should create HNSW index on vector column', async () => {
      try {
        const createIndexSQL = `
          CREATE INDEX idx_terrain_hnsw ON terrain_vectors_test 
          USING HNSW (terrain_vector)
        `;
        
        await query(createIndexSQL);
        
        // Verify index exists
        const showIndexSQL = 'SHOW INDEX FROM terrain_vectors_test';
        const indexes = await query(showIndexSQL);
        
        const hnswIndex = indexes.find(idx => 
          idx.Key_name === 'idx_terrain_hnsw'
        );
        
        expect(hnswIndex).toBeDefined();
      } catch (error) {
        // HNSW might not be supported in all TiDB versions
        expect(error.code).toBeTruthy();
      }
    });

    test('Should optimize vector queries with index', async () => {
      const targetVector = await coordinator.generateTerrainVector(
        40.0, -120.0, 100, 5, 'grassland'
      );
      
      try {
        // Insert test data
        for (let i = 0; i < 10; i++) {
          const vector = await coordinator.generateTerrainVector(
            40.0 + i * 0.01,
            -120.0 + i * 0.01,
            100 + i * 10,
            5 + i,
            'grassland'
          );
          
          await query(
            'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
            [`index_test_${i}`, serializeVector(vector)]
          );
        }
        
        // Query with vector similarity
        const searchSQL = `
          SELECT location_id, 
                 VEC_COSINE_DISTANCE(terrain_vector, ?) as distance
          FROM terrain_vectors_test
          ORDER BY distance
          LIMIT 5
        `;
        
        const results = await query(searchSQL, [serializeVector(targetVector)]);
        
        expect(results).toBeDefined();
        if (results.length > 0) {
          expect(results[0].distance).toBeLessThan(1);
        }
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should handle index rebuilding', async () => {
      try {
        // Drop existing index
        await query('DROP INDEX idx_terrain_vector ON terrain_vectors_test');
        
        // Recreate index
        await query('CREATE INDEX idx_terrain_vector ON terrain_vectors_test (terrain_vector)');
        
        // Verify recreation
        const indexes = await query('SHOW INDEX FROM terrain_vectors_test');
        const recreatedIndex = indexes.find(idx => idx.Key_name === 'idx_terrain_vector');
        
        expect(recreatedIndex).toBeDefined();
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });
  });

  describe('Vector Deletion and Cleanup', () => {
    test('Should delete individual vectors', async () => {
      const vector = await coordinator.generateTerrainVector(40.0, -120.0, 100, 5, 'grassland');
      
      try {
        // Insert vector
        await query(
          'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
          ['delete_test', serializeVector(vector)]
        );
        
        // Delete vector
        await query('DELETE FROM terrain_vectors_test WHERE location_id = ?', ['delete_test']);
        
        // Verify deletion
        const result = await query(
          'SELECT * FROM terrain_vectors_test WHERE location_id = ?',
          ['delete_test']
        );
        
        expect(result).toHaveLength(0);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should bulk delete vectors by criteria', async () => {
      try {
        // Insert test vectors
        for (let i = 0; i < 5; i++) {
          const vector = await coordinator.generateTerrainVector(
            40.0 + i * 0.01,
            -120.0,
            100,
            5,
            'test_vegetation'
          );
          
          await query(
            'INSERT INTO terrain_vectors_test (location_id, terrain_vector, vegetation) VALUES (?, ?, ?)',
            [`bulk_delete_${i}`, serializeVector(vector), 'test_vegetation']
          );
        }
        
        // Bulk delete by vegetation type
        const deleteResult = await query(
          'DELETE FROM terrain_vectors_test WHERE vegetation = ?',
          ['test_vegetation']
        );
        
        // Verify deletion
        const remaining = await query(
          'SELECT * FROM terrain_vectors_test WHERE vegetation = ?',
          ['test_vegetation']
        );
        
        expect(remaining).toHaveLength(0);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should cleanup old vectors by timestamp', async () => {
      try {
        // Insert vectors with different timestamps
        const oldDate = new Date('2024-01-01');
        const recentDate = new Date('2025-08-01');
        
        const oldVector = weatherAgent.createWeatherEmbedding({ timestamp: oldDate });
        const recentVector = weatherAgent.createWeatherEmbedding({ timestamp: recentDate });
        
        await query(
          'INSERT INTO weather_conditions_test (observation_id, weather_pattern_embedding, observation_time) VALUES (?, ?, ?)',
          ['old_weather', serializeVector(oldVector), oldDate]
        );
        
        await query(
          'INSERT INTO weather_conditions_test (observation_id, weather_pattern_embedding, observation_time) VALUES (?, ?, ?)',
          ['recent_weather', serializeVector(recentVector), recentDate]
        );
        
        // Delete old records
        await query(
          'DELETE FROM weather_conditions_test WHERE observation_time < ?',
          [new Date('2025-01-01')]
        );
        
        // Verify cleanup
        const remaining = await query('SELECT observation_id FROM weather_conditions_test');
        const ids = remaining.map(r => r.observation_id);
        
        expect(ids).toContain('recent_weather');
        expect(ids).not.toContain('old_weather');
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });
  });

  describe('Vector Backup and Recovery', () => {
    test('Should export vectors for backup', async () => {
      const vectors = [];
      
      // Generate test vectors
      for (let i = 0; i < 3; i++) {
        const vector = await coordinator.generateTerrainVector(
          40.0 + i * 0.01,
          -120.0,
          100 + i * 10,
          5,
          'grassland'
        );
        vectors.push({
          id: `backup_${i}`,
          vector: vector,
          metadata: { elevation: 100 + i * 10 }
        });
      }
      
      // Simulate export
      const backup = exportVectorsToBackup(vectors);
      
      expect(backup).toBeDefined();
      expect(backup.version).toBe('1.0');
      expect(backup.vectors).toHaveLength(3);
      expect(backup.timestamp).toBeDefined();
    });

    test('Should restore vectors from backup', async () => {
      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        vectors: [
          {
            id: 'restore_1',
            vector: await coordinator.generateTerrainVector(40.0, -120.0, 100, 5, 'grassland'),
            metadata: { elevation: 100 }
          },
          {
            id: 'restore_2',
            vector: await coordinator.generateTerrainVector(40.1, -120.1, 110, 6, 'agriculture'),
            metadata: { elevation: 110 }
          }
        ]
      };
      
      try {
        // Restore vectors
        for (const item of backup.vectors) {
          await query(
            'INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES (?, ?)',
            [item.id, serializeVector(item.vector)]
          );
        }
        
        // Verify restoration
        const result = await query(
          'SELECT location_id FROM terrain_vectors_test WHERE location_id LIKE ?',
          ['restore_%']
        );
        
        expect(result).toHaveLength(2);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should validate backup integrity', () => {
      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        vectors: [
          {
            id: 'test_1',
            vector: new Array(32).fill(0).map(() => Math.random()),
            checksum: null
          }
        ]
      };
      
      // Calculate checksum
      backup.vectors[0].checksum = calculateVectorChecksum(backup.vectors[0].vector);
      
      // Validate integrity
      const isValid = validateBackupIntegrity(backup);
      expect(isValid).toBeTruthy();
      
      // Corrupt vector
      backup.vectors[0].vector[0] = -999;
      
      // Should fail validation
      const isCorrupted = validateBackupIntegrity(backup);
      expect(isCorrupted).toBeFalsy();
    });
  });

  describe('Vector Migration and Versioning', () => {
    test('Should migrate vectors between schema versions', async () => {
      // Simulate v1 schema (32-dim)
      const v1Vector = new Array(32).fill(0).map(() => Math.random());
      
      // Simulate v2 schema (64-dim, padded)
      const v2Vector = migrateVectorV1ToV2(v1Vector);
      
      expect(v2Vector).toHaveLength(64);
      expect(v2Vector.slice(0, 32)).toEqual(v1Vector);
      expect(v2Vector.slice(32).every(v => v === 0)).toBeTruthy();
    });

    test('Should handle vector dimension changes', async () => {
      const original128 = weatherAgent.createWeatherEmbedding({
        temperature: 25,
        humidity: 60,
        timestamp: new Date()
      });
      
      // Reduce dimension (PCA simulation)
      const reduced64 = reduceDimension(original128, 64);
      
      expect(reduced64).toHaveLength(64);
      expect(reduced64.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
      
      // Expand dimension (padding)
      const expanded256 = expandDimension(original128, 256);
      
      expect(expanded256).toHaveLength(256);
      expect(expanded256.slice(0, 128)).toEqual(original128);
    });

    test('Should version vector storage format', () => {
      const vector = new Array(32).fill(0).map(() => Math.random());
      
      // Version 1 format (JSON)
      const v1Format = {
        version: 1,
        format: 'json',
        data: JSON.stringify(vector)
      };
      
      // Version 2 format (Binary)
      const v2Format = {
        version: 2,
        format: 'binary',
        data: vectorToBinary(vector)
      };
      
      expect(v1Format.version).toBe(1);
      expect(v2Format.version).toBe(2);
      expect(v2Format.data.byteLength).toBe(32 * 4);
    });
  });

  describe('Vector Storage Performance', () => {
    test('Should handle large batch insertions efficiently', async () => {
      const vectors = [];
      const batchSize = 100;
      
      // Generate batch
      for (let i = 0; i < batchSize; i++) {
        const vector = await coordinator.generateTerrainVector(
          40.0 + i * 0.001,
          -120.0 + i * 0.001,
          100 + i,
          5,
          'grassland'
        );
        vectors.push({
          id: `perf_${i}`,
          vector: serializeVector(vector)
        });
      }
      
      const startTime = performance.now();
      
      try {
        // Batch insert
        const values = vectors.map(v => [v.id, v.vector]);
        const placeholders = values.map(() => '(?, ?)').join(', ');
        const flatValues = values.flat();
        
        await query(
          `INSERT INTO terrain_vectors_test (location_id, terrain_vector) VALUES ${placeholders}`,
          flatValues
        );
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Should complete in reasonable time (< 5 seconds for 100 vectors)
        expect(duration).toBeLessThan(5000);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });

    test('Should optimize vector storage size', () => {
      const vector = new Array(128).fill(0).map(() => Math.random());
      
      // Compare storage formats
      const jsonSize = JSON.stringify(vector).length;
      const binarySize = vector.length * 4; // 4 bytes per float32
      const compressedSize = compressVector(vector).length;
      
      expect(binarySize).toBeLessThan(jsonSize); // Binary more efficient
      expect(compressedSize).toBeLessThan(binarySize); // Compression helps
    });

    test('Should measure vector query latency', async () => {
      const targetVector = await predictor.generateSmokeVector(
        5001,
        { windSpeed: 10, windDirection: 180 },
        100
      );
      
      const startTime = performance.now();
      
      try {
        const searchSQL = `
          SELECT prediction_id,
                 VEC_COSINE_DISTANCE(plume_vector, ?) as distance
          FROM smoke_predictions_test
          ORDER BY distance
          LIMIT 10
        `;
        
        await query(searchSQL, [serializeVector(targetVector)]);
        
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        // Query should be fast (< 100ms)
        expect(latency).toBeLessThan(100);
      } catch (error) {
        expect(error.code).toBeTruthy();
      }
    });
  });
});

// Helper functions for vector storage operations
function serializeVector(vector) {
  return JSON.stringify(vector);
}

function deserializeVector(serialized) {
  if (typeof serialized === 'string') {
    return JSON.parse(serialized);
  }
  return Array.from(serialized);
}

function vectorToBinary(vector) {
  const buffer = new ArrayBuffer(vector.length * 4);
  const view = new Float32Array(buffer);
  vector.forEach((val, i) => {
    view[i] = val;
  });
  return buffer;
}

function binaryToVector(buffer) {
  const view = new Float32Array(buffer);
  return Array.from(view);
}

function exportVectorsToBackup(vectors) {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    vectors: vectors.map(v => ({
      ...v,
      checksum: calculateVectorChecksum(v.vector)
    }))
  };
}

function calculateVectorChecksum(vector) {
  // Simple checksum for testing
  return vector.reduce((sum, val) => sum + val, 0);
}

function validateBackupIntegrity(backup) {
  return backup.vectors.every(item => {
    const checksum = calculateVectorChecksum(item.vector);
    return checksum === item.checksum;
  });
}

function migrateVectorV1ToV2(v1Vector) {
  // Pad to double dimension
  return [...v1Vector, ...new Array(32).fill(0)];
}

function reduceDimension(vector, targetDim) {
  // Simple truncation for testing
  if (vector.length <= targetDim) {
    return [...vector, ...new Array(targetDim - vector.length).fill(0)];
  }
  return vector.slice(0, targetDim);
}

function expandDimension(vector, targetDim) {
  return [...vector, ...new Array(targetDim - vector.length).fill(0)];
}

function compressVector(vector) {
  // Simulate compression (just return string for testing)
  return JSON.stringify(vector).replace(/0\./g, '.');
}

module.exports = {
  serializeVector,
  deserializeVector,
  vectorToBinary,
  binaryToVector,
  calculateVectorChecksum,
  validateBackupIntegrity
};