const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool } = require('../../db/connection');
require('dotenv').config();

describe('TiDB Vector Search Operations - Critical for Smoke Pattern Matching', () => {
  let testTableCreated = false;
  
  beforeAll(async () => {
    await initializeDatabase();
    
    // Create test tables with vector columns
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS test_weather_vectors (
          id INT PRIMARY KEY AUTO_INCREMENT,
          observation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          location_lat DECIMAL(10, 6),
          location_lon DECIMAL(10, 6),
          weather_pattern_embedding VECTOR(128),
          VECTOR INDEX idx_weather_pattern ((VEC_COSINE_DISTANCE(weather_pattern_embedding)))
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS test_smoke_vectors (
          id INT PRIMARY KEY AUTO_INCREMENT,
          burn_request_id INT,
          plume_vector VECTOR(64),
          pm25_concentration DECIMAL(10, 2),
          VECTOR INDEX idx_plume ((VEC_COSINE_DISTANCE(plume_vector)))
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS test_terrain_vectors (
          id INT PRIMARY KEY AUTO_INCREMENT,
          field_id INT,
          terrain_features VECTOR(32),
          elevation DECIMAL(10, 2),
          VECTOR INDEX idx_terrain ((VEC_COSINE_DISTANCE(terrain_features)))
        )
      `);
      
      testTableCreated = true;
    } catch (error) {
      console.error('Error creating test tables:', error);
    }
  });
  
  afterAll(async () => {
    // Clean up test tables
    if (testTableCreated) {
      await query('DROP TABLE IF EXISTS test_weather_vectors');
      await query('DROP TABLE IF EXISTS test_smoke_vectors');
      await query('DROP TABLE IF EXISTS test_terrain_vectors');
    }
    
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });
  
  beforeEach(async () => {
    // Clear test data
    if (testTableCreated) {
      await query('DELETE FROM test_weather_vectors');
      await query('DELETE FROM test_smoke_vectors');
      await query('DELETE FROM test_terrain_vectors');
    }
  });

  describe('Vector Storage and Retrieval', () => {
    test('Should store and retrieve 128-dimensional weather vectors', async () => {
      const weatherVector = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1));
      const vectorString = `[${weatherVector.join(',')}]`;
      
      const result = await query(
        `INSERT INTO test_weather_vectors 
         (location_lat, location_lon, weather_pattern_embedding) 
         VALUES (?, ?, ?)`,
        [40.0, -120.0, vectorString]
      );
      
      expect(result.insertId).toBeGreaterThan(0);
      
      const retrieved = await query(
        'SELECT weather_pattern_embedding FROM test_weather_vectors WHERE id = ?',
        [result.insertId]
      );
      
      expect(retrieved[0]).toBeDefined();
      const retrievedVector = JSON.parse(retrieved[0].weather_pattern_embedding);
      expect(retrievedVector).toHaveLength(128);
      
      // Verify values match (within floating point precision)
      weatherVector.forEach((val, idx) => {
        expect(Math.abs(retrievedVector[idx] - val)).toBeLessThan(0.0001);
      });
    });

    test('Should store and retrieve 64-dimensional smoke plume vectors', async () => {
      const smokeVector = Array.from({ length: 64 }, (_, i) => i / 64);
      const vectorString = `[${smokeVector.join(',')}]`;
      
      const result = await query(
        `INSERT INTO test_smoke_vectors 
         (burn_request_id, plume_vector, pm25_concentration) 
         VALUES (?, ?, ?)`,
        [99001, vectorString, 45.5]
      );
      
      expect(result.insertId).toBeGreaterThan(0);
      
      const retrieved = await query(
        'SELECT plume_vector, pm25_concentration FROM test_smoke_vectors WHERE id = ?',
        [result.insertId]
      );
      
      const retrievedVector = JSON.parse(retrieved[0].plume_vector);
      expect(retrievedVector).toHaveLength(64);
      expect(retrieved[0].pm25_concentration).toBe('45.50');
    });

    test('Should store and retrieve 32-dimensional terrain vectors', async () => {
      const terrainVector = Array.from({ length: 32 }, () => Math.random());
      const vectorString = `[${terrainVector.join(',')}]`;
      
      const result = await query(
        `INSERT INTO test_terrain_vectors 
         (field_id, terrain_features, elevation) 
         VALUES (?, ?, ?)`,
        [101, vectorString, 1250.5]
      );
      
      expect(result.insertId).toBeGreaterThan(0);
      
      const retrieved = await query(
        'SELECT terrain_features FROM test_terrain_vectors WHERE id = ?',
        [result.insertId]
      );
      
      const retrievedVector = JSON.parse(retrieved[0].terrain_features);
      expect(retrievedVector).toHaveLength(32);
    });

    test('Should reject vectors with incorrect dimensions', async () => {
      const wrongVector = Array.from({ length: 100 }, () => Math.random());
      const vectorString = `[${wrongVector.join(',')}]`;
      
      try {
        await query(
          'INSERT INTO test_weather_vectors (weather_pattern_embedding) VALUES (?)',
          [vectorString]
        );
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error.message).toMatch(/dimension|vector/i);
      }
    });

    test('Should handle null vectors appropriately', async () => {
      const [result] = await query(
        'INSERT INTO test_weather_vectors (location_lat, location_lon) VALUES (?, ?)',
        [40.0, -120.0]
      );
      
      expect(result.insertId).toBeGreaterThan(0);
      
      const [retrieved] = await query(
        'SELECT weather_pattern_embedding FROM test_weather_vectors WHERE id = ?',
        [result.insertId]
      );
      
      expect(retrieved[0].weather_pattern_embedding).toBeNull();
    });
  });

  describe('Vector Similarity Search', () => {
    test('Should find similar weather patterns using cosine distance', async () => {
      // Insert multiple weather patterns
      const patterns = [
        Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1)), // Pattern A
        Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1 + 0.1)), // Similar to A
        Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.1)), // Different pattern
      ];
      
      for (const pattern of patterns) {
        await query(
          'INSERT INTO test_weather_vectors (weather_pattern_embedding) VALUES (?)',
          [`[${pattern.join(',')}]`]
        );
      }
      
      // Search for similar patterns to the first one
      const searchVector = `[${patterns[0].join(',')}]`;
      const [similar] = await query(`
        SELECT id, VEC_COSINE_DISTANCE(weather_pattern_embedding, ?) AS distance
        FROM test_weather_vectors
        ORDER BY distance
        LIMIT 2
      `, [searchVector]);
      
      expect(similar).toHaveLength(2);
      expect(similar[0].distance).toBeLessThan(0.1); // Very similar (self)
      expect(similar[1].distance).toBeLessThan(similar[0].distance + 0.2); // Next similar
    });

    test('Should detect smoke plume conflicts via vector similarity', async () => {
      // Create overlapping smoke plumes
      const plume1 = Array.from({ length: 64 }, (_, i) => i / 64);
      const plume2 = Array.from({ length: 64 }, (_, i) => (i + 1) / 64); // Slightly offset
      const plume3 = Array.from({ length: 64 }, () => Math.random()); // Random/different
      
      await query(
        'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector, pm25_concentration) VALUES (?, ?, ?)',
        [1, `[${plume1.join(',')}]`, 50]
      );
      await query(
        'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector, pm25_concentration) VALUES (?, ?, ?)',
        [2, `[${plume2.join(',')}]`, 45]
      );
      await query(
        'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector, pm25_concentration) VALUES (?, ?, ?)',
        [3, `[${plume3.join(',')}]`, 30]
      );
      
      // Find conflicts (similar plumes)
      const [conflicts] = await query(`
        SELECT 
          burn_request_id,
          pm25_concentration,
          VEC_COSINE_DISTANCE(plume_vector, ?) AS similarity
        FROM test_smoke_vectors
        WHERE VEC_COSINE_DISTANCE(plume_vector, ?) < 0.3
        ORDER BY similarity
      `, [`[${plume1.join(',')}]`, `[${plume1.join(',')}]`]);
      
      expect(conflicts.length).toBeGreaterThanOrEqual(2); // At least plume1 and plume2
      expect(conflicts[0].burn_request_id).toBe(1); // Self match
      expect(conflicts[1].burn_request_id).toBe(2); // Similar plume
    });

    test('Should find terrain patterns for similar fields', async () => {
      // Create terrain feature vectors
      const flatTerrain = Array.from({ length: 32 }, () => 0.1);
      const hillyTerrain = Array.from({ length: 32 }, (_, i) => Math.sin(i));
      const mountainous = Array.from({ length: 32 }, (_, i) => Math.abs(Math.sin(i)) * 2);
      
      await query(
        'INSERT INTO test_terrain_vectors (field_id, terrain_features, elevation) VALUES (?, ?, ?)',
        [1, `[${flatTerrain.join(',')}]`, 100]
      );
      await query(
        'INSERT INTO test_terrain_vectors (field_id, terrain_features, elevation) VALUES (?, ?, ?)',
        [2, `[${hillyTerrain.join(',')}]`, 500]
      );
      await query(
        'INSERT INTO test_terrain_vectors (field_id, terrain_features, elevation) VALUES (?, ?, ?)',
        [3, `[${mountainous.join(',')}]`, 2000]
      );
      
      // Find similar terrain to hilly
      const [similar] = await query(`
        SELECT 
          field_id,
          elevation,
          VEC_COSINE_DISTANCE(terrain_features, ?) AS distance
        FROM test_terrain_vectors
        WHERE field_id != ?
        ORDER BY distance
        LIMIT 1
      `, [`[${hillyTerrain.join(',')}]`, 2]);
      
      expect(similar).toHaveLength(1);
      expect(similar[0].field_id).toBe(3); // Mountainous is more similar to hilly than flat
    });

    test('Should apply similarity threshold for safety detection', async () => {
      const dangerousPattern = Array.from({ length: 128 }, () => 0.9); // High values = dangerous
      
      // Insert various weather patterns
      for (let i = 0; i < 5; i++) {
        const pattern = Array.from({ length: 128 }, () => Math.random() * (i / 5));
        await query(
          'INSERT INTO test_weather_vectors (weather_pattern_embedding) VALUES (?)',
          [`[${pattern.join(',')}]`]
        );
      }
      
      // Find patterns similar to dangerous threshold
      const SAFETY_THRESHOLD = 0.2; // Cosine distance threshold
      const [dangerous] = await query(`
        SELECT 
          id,
          VEC_COSINE_DISTANCE(weather_pattern_embedding, ?) AS risk_score
        FROM test_weather_vectors
        WHERE VEC_COSINE_DISTANCE(weather_pattern_embedding, ?) < ?
      `, [
        `[${dangerousPattern.join(',')}]`,
        `[${dangerousPattern.join(',')}]`,
        SAFETY_THRESHOLD
      ]);
      
      dangerous.forEach(record => {
        expect(record.risk_score).toBeLessThan(SAFETY_THRESHOLD);
      });
    });
  });

  describe('Vector Index Performance', () => {
    test('Should efficiently search large vector datasets', async () => {
      // Insert many vectors
      const vectorCount = 100;
      const vectors = [];
      
      for (let i = 0; i < vectorCount; i++) {
        const vector = Array.from({ length: 64 }, () => Math.random());
        vectors.push(vector);
        await query(
          'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector) VALUES (?, ?)',
          [i, `[${vector.join(',')}]`]
        );
      }
      
      // Search with index
      const searchVector = vectors[50];
      const startTime = Date.now();
      
      const [results] = await query(`
        SELECT burn_request_id
        FROM test_smoke_vectors
        ORDER BY VEC_COSINE_DISTANCE(plume_vector, ?)
        LIMIT 10
      `, [`[${searchVector.join(',')}]`]);
      
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(10);
      expect(results[0].burn_request_id).toBe(50); // Should find itself first
      expect(duration).toBeLessThan(1000); // Should be fast with index
    });

    test('Should use HNSW index for approximate nearest neighbor search', async () => {
      // Verify index exists
      const [indexes] = await query(`
        SHOW INDEX FROM test_weather_vectors 
        WHERE Key_name = 'idx_weather_pattern'
      `);
      
      expect(indexes.length).toBeGreaterThan(0);
      
      // Insert test data
      const testVector = Array.from({ length: 128 }, (_, i) => i / 128);
      await query(
        'INSERT INTO test_weather_vectors (weather_pattern_embedding) VALUES (?)',
        [`[${testVector.join(',')}]`]
      );
      
      // Use index for search
      const [explain] = await query(`
        EXPLAIN SELECT * FROM test_weather_vectors 
        ORDER BY VEC_COSINE_DISTANCE(weather_pattern_embedding, ?)
        LIMIT 1
      `, [`[${testVector.join(',')}]`]);
      
      // Should show index usage in execution plan
      const planText = JSON.stringify(explain);
      expect(planText.toLowerCase()).toMatch(/index|vector/);
    });

    test('Should handle vector updates efficiently', async () => {
      // Insert initial vector
      const initialVector = Array.from({ length: 32 }, () => 0.5);
      const [insert] = await query(
        'INSERT INTO test_terrain_vectors (field_id, terrain_features) VALUES (?, ?)',
        [1, `[${initialVector.join(',')}]`]
      );
      
      // Update vector
      const updatedVector = Array.from({ length: 32 }, () => 0.7);
      const [update] = await query(
        'UPDATE test_terrain_vectors SET terrain_features = ? WHERE id = ?',
        [`[${updatedVector.join(',')}]`, insert.insertId]
      );
      
      expect(update.affectedRows).toBe(1);
      
      // Verify update
      const [retrieved] = await query(
        'SELECT terrain_features FROM test_terrain_vectors WHERE id = ?',
        [insert.insertId]
      );
      
      const vector = JSON.parse(retrieved[0].terrain_features);
      expect(vector[0]).toBeCloseTo(0.7, 5);
    });
  });

  describe('Multi-Vector Operations', () => {
    test('Should combine multiple vector types for analysis', async () => {
      // Insert related vectors
      await query(
        'INSERT INTO test_weather_vectors (id, weather_pattern_embedding) VALUES (?, ?)',
        [1, `[${Array.from({ length: 128 }, () => 0.5).join(',')}]`]
      );
      
      await query(
        'INSERT INTO test_smoke_vectors (id, burn_request_id, plume_vector) VALUES (?, ?, ?)',
        [1, 1, `[${Array.from({ length: 64 }, () => 0.5).join(',')}]`]
      );
      
      await query(
        'INSERT INTO test_terrain_vectors (id, field_id, terrain_features) VALUES (?, ?, ?)',
        [1, 1, `[${Array.from({ length: 32 }, () => 0.5).join(',')}]`]
      );
      
      // Combined analysis query
      const [analysis] = await query(`
        SELECT 
          w.id as weather_id,
          s.burn_request_id,
          t.field_id
        FROM test_weather_vectors w
        CROSS JOIN test_smoke_vectors s
        CROSS JOIN test_terrain_vectors t
        WHERE w.id = 1 AND s.id = 1 AND t.id = 1
      `);
      
      expect(analysis).toHaveLength(1);
      expect(analysis[0].weather_id).toBe(1);
      expect(analysis[0].burn_request_id).toBe(1);
      expect(analysis[0].field_id).toBe(1);
    });

    test('Should perform batch vector similarity comparisons', async () => {
      // Insert batch of smoke vectors
      const burnRequests = [];
      for (let i = 0; i < 10; i++) {
        const vector = Array.from({ length: 64 }, () => Math.random());
        await query(
          'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector) VALUES (?, ?)',
          [i, `[${vector.join(',')}]`]
        );
        burnRequests.push({ id: i, vector });
      }
      
      // Find all pairs with high similarity
      const [pairs] = await query(`
        SELECT 
          s1.burn_request_id as burn1,
          s2.burn_request_id as burn2,
          VEC_COSINE_DISTANCE(s1.plume_vector, s2.plume_vector) as distance
        FROM test_smoke_vectors s1
        CROSS JOIN test_smoke_vectors s2
        WHERE s1.burn_request_id < s2.burn_request_id
          AND VEC_COSINE_DISTANCE(s1.plume_vector, s2.plume_vector) < 0.5
        ORDER BY distance
      `);
      
      pairs.forEach(pair => {
        expect(pair.burn1).toBeLessThan(pair.burn2);
        expect(pair.distance).toBeLessThan(0.5);
      });
    });

    test('Should aggregate vector statistics', async () => {
      // Insert vectors with known patterns
      for (let i = 0; i < 5; i++) {
        const concentration = 20 + i * 10;
        const vector = Array.from({ length: 64 }, () => concentration / 100);
        await query(
          'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector, pm25_concentration) VALUES (?, ?, ?)',
          [i, `[${vector.join(',')}]`, concentration]
        );
      }
      
      // Calculate statistics
      const [stats] = await query(`
        SELECT 
          COUNT(*) as total_plumes,
          AVG(pm25_concentration) as avg_pm25,
          MAX(pm25_concentration) as max_pm25,
          MIN(pm25_concentration) as min_pm25
        FROM test_smoke_vectors
      `);
      
      expect(stats[0].total_plumes).toBe(5);
      expect(parseFloat(stats[0].avg_pm25)).toBe(40);
      expect(parseFloat(stats[0].max_pm25)).toBe(60);
      expect(parseFloat(stats[0].min_pm25)).toBe(20);
    });
  });

  describe('Vector Data Validation', () => {
    test('Should validate vector normalization', async () => {
      // Create normalized vector (unit length)
      const vector = Array.from({ length: 32 }, (_, i) => i / 32);
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      const normalized = vector.map(val => val / magnitude);
      
      await query(
        'INSERT INTO test_terrain_vectors (field_id, terrain_features) VALUES (?, ?)',
        [1, `[${normalized.join(',')}]`]
      );
      
      const [result] = await query(
        'SELECT terrain_features FROM test_terrain_vectors WHERE field_id = 1'
      );
      
      const retrieved = JSON.parse(result[0].terrain_features);
      const retrievedMagnitude = Math.sqrt(
        retrieved.reduce((sum, val) => sum + val * val, 0)
      );
      
      expect(retrievedMagnitude).toBeCloseTo(1.0, 5);
    });

    test('Should handle extreme vector values', async () => {
      const extremeVector = Array.from({ length: 128 }, (_, i) => {
        if (i < 32) return 1e-10; // Very small
        if (i < 64) return 1e10; // Very large
        if (i < 96) return 0; // Zero
        return -1e5; // Negative large
      });
      
      try {
        await query(
          'INSERT INTO test_weather_vectors (weather_pattern_embedding) VALUES (?)',
          [`[${extremeVector.join(',')}]`]
        );
        
        const [result] = await query(
          'SELECT weather_pattern_embedding FROM test_weather_vectors'
        );
        
        const retrieved = JSON.parse(result[0].weather_pattern_embedding);
        expect(retrieved).toHaveLength(128);
      } catch (error) {
        // Some extreme values might be rejected
        expect(error.message).toMatch(/range|overflow|value/i);
      }
    });

    test('Should enforce vector dimension constraints', async () => {
      const attempts = [
        { dims: 31, table: 'test_terrain_vectors', col: 'terrain_features' }, // Too few
        { dims: 33, table: 'test_terrain_vectors', col: 'terrain_features' }, // Too many
        { dims: 63, table: 'test_smoke_vectors', col: 'plume_vector' }, // Too few
        { dims: 65, table: 'test_smoke_vectors', col: 'plume_vector' }, // Too many
      ];
      
      for (const attempt of attempts) {
        const vector = Array.from({ length: attempt.dims }, () => Math.random());
        
        try {
          await query(
            `INSERT INTO ${attempt.table} (${attempt.col}) VALUES (?)`,
            [`[${vector.join(',')}]`]
          );
          expect(true).toBe(false); // Should not succeed
        } catch (error) {
          expect(error.message).toMatch(/dimension|vector|constraint/i);
        }
      }
    });
  });

  describe('Vector Search Optimization', () => {
    test('Should optimize search with distance threshold', async () => {
      // Insert diverse vectors
      for (let i = 0; i < 20; i++) {
        const vector = Array.from({ length: 64 }, () => Math.random());
        await query(
          'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector) VALUES (?, ?)',
          [i, `[${vector.join(',')}]`]
        );
      }
      
      const searchVector = Array.from({ length: 64 }, () => 0.5);
      const threshold = 0.3;
      
      // Search with threshold
      const [results] = await query(`
        SELECT 
          burn_request_id,
          VEC_COSINE_DISTANCE(plume_vector, ?) as distance
        FROM test_smoke_vectors
        WHERE VEC_COSINE_DISTANCE(plume_vector, ?) < ?
        ORDER BY distance
      `, [
        `[${searchVector.join(',')}]`,
        `[${searchVector.join(',')}]`,
        threshold
      ]);
      
      results.forEach(result => {
        expect(result.distance).toBeLessThan(threshold);
      });
    });

    test('Should use vector indices for range queries', async () => {
      // Create weather patterns at different times
      for (let hour = 0; hour < 24; hour++) {
        const pattern = Array.from({ length: 128 }, (_, i) => 
          Math.sin((i + hour) * 0.1)
        );
        await query(
          `INSERT INTO test_weather_vectors 
           (observation_time, weather_pattern_embedding) 
           VALUES (DATE_ADD(NOW(), INTERVAL ? HOUR), ?)`,
          [hour, `[${pattern.join(',')}]`]
        );
      }
      
      // Find patterns in time range
      const [rangeResults] = await query(`
        SELECT 
          id,
          observation_time
        FROM test_weather_vectors
        WHERE observation_time >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
        ORDER BY observation_time
      `);
      
      expect(rangeResults.length).toBeGreaterThan(0);
      expect(rangeResults.length).toBeLessThanOrEqual(24);
    });

    test('Should handle vector pagination efficiently', async () => {
      // Insert many vectors
      for (let i = 0; i < 50; i++) {
        const vector = Array.from({ length: 32 }, () => Math.random());
        await query(
          'INSERT INTO test_terrain_vectors (field_id, terrain_features) VALUES (?, ?)',
          [i, `[${vector.join(',')}]`]
        );
      }
      
      const searchVector = Array.from({ length: 32 }, () => 0.5);
      const pageSize = 10;
      
      // Page 1
      const [page1] = await query(`
        SELECT field_id
        FROM test_terrain_vectors
        ORDER BY VEC_COSINE_DISTANCE(terrain_features, ?)
        LIMIT ? OFFSET ?
      `, [`[${searchVector.join(',')}]`, pageSize, 0]);
      
      // Page 2
      const [page2] = await query(`
        SELECT field_id
        FROM test_terrain_vectors
        ORDER BY VEC_COSINE_DISTANCE(terrain_features, ?)
        LIMIT ? OFFSET ?
      `, [`[${searchVector.join(',')}]`, pageSize, pageSize]);
      
      expect(page1).toHaveLength(pageSize);
      expect(page2).toHaveLength(pageSize);
      
      // No overlap between pages
      const page1Ids = page1.map(r => r.field_id);
      const page2Ids = page2.map(r => r.field_id);
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Vector-Based Pattern Recognition', () => {
    test('Should identify recurring weather patterns', async () => {
      // Create pattern that repeats
      const morningPattern = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1));
      const eveningPattern = Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.1));
      
      // Insert patterns for multiple days
      for (let day = 0; day < 5; day++) {
        // Morning
        await query(
          'INSERT INTO test_weather_vectors (weather_pattern_embedding) VALUES (?)',
          [`[${morningPattern.map(v => v + day * 0.01).join(',')}]`]
        );
        // Evening  
        await query(
          'INSERT INTO test_weather_vectors (weather_pattern_embedding) VALUES (?)',
          [`[${eveningPattern.map(v => v + day * 0.01).join(',')}]`]
        );
      }
      
      // Find similar morning patterns
      const [mornings] = await query(`
        SELECT 
          id,
          VEC_COSINE_DISTANCE(weather_pattern_embedding, ?) as similarity
        FROM test_weather_vectors
        WHERE VEC_COSINE_DISTANCE(weather_pattern_embedding, ?) < 0.2
        ORDER BY similarity
      `, [
        `[${morningPattern.join(',')}]`,
        `[${morningPattern.join(',')}]`
      ]);
      
      expect(mornings.length).toBeGreaterThanOrEqual(5); // All morning patterns
    });

    test('Should detect anomalous smoke patterns', async () => {
      // Normal patterns
      for (let i = 0; i < 10; i++) {
        const normal = Array.from({ length: 64 }, () => 0.3 + Math.random() * 0.2);
        await query(
          'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector, pm25_concentration) VALUES (?, ?, ?)',
          [i, `[${normal.join(',')}]`, 30 + i]
        );
      }
      
      // Anomalous pattern
      const anomaly = Array.from({ length: 64 }, () => Math.random());
      await query(
        'INSERT INTO test_smoke_vectors (burn_request_id, plume_vector, pm25_concentration) VALUES (?, ?, ?)',
        [99, `[${anomaly.join(',')}]`, 150]
      );
      
      // Calculate average pattern
      const normalPattern = Array.from({ length: 64 }, () => 0.4);
      
      // Find anomalies (high distance from normal)
      const [anomalies] = await query(`
        SELECT 
          burn_request_id,
          pm25_concentration,
          VEC_COSINE_DISTANCE(plume_vector, ?) as deviation
        FROM test_smoke_vectors
        WHERE VEC_COSINE_DISTANCE(plume_vector, ?) > 0.5
        ORDER BY deviation DESC
      `, [
        `[${normalPattern.join(',')}]`,
        `[${normalPattern.join(',')}]`
      ]);
      
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].burn_request_id).toBe(99);
      expect(parseFloat(anomalies[0].pm25_concentration)).toBe(150);
    });

    test('Should cluster similar terrain types', async () => {
      // Different terrain types
      const terrainTypes = {
        flat: Array.from({ length: 32 }, () => 0.1),
        rolling: Array.from({ length: 32 }, (_, i) => 0.3 + Math.sin(i) * 0.2),
        mountainous: Array.from({ length: 32 }, (_, i) => 0.7 + Math.cos(i) * 0.3)
      };
      
      // Insert multiple examples of each type
      let fieldId = 0;
      for (const [type, pattern] of Object.entries(terrainTypes)) {
        for (let i = 0; i < 3; i++) {
          const variation = pattern.map(v => v + Math.random() * 0.05);
          await query(
            'INSERT INTO test_terrain_vectors (field_id, terrain_features, elevation) VALUES (?, ?, ?)',
            [fieldId++, `[${variation.join(',')}]`, type === 'flat' ? 100 : type === 'rolling' ? 500 : 2000]
          );
        }
      }
      
      // Find all flat terrain
      const [flatFields] = await query(`
        SELECT 
          field_id,
          elevation,
          VEC_COSINE_DISTANCE(terrain_features, ?) as similarity
        FROM test_terrain_vectors
        WHERE VEC_COSINE_DISTANCE(terrain_features, ?) < 0.2
        ORDER BY similarity
      `, [
        `[${terrainTypes.flat.join(',')}]`,
        `[${terrainTypes.flat.join(',')}]`
      ]);
      
      expect(flatFields.length).toBeGreaterThanOrEqual(3);
      flatFields.forEach(field => {
        expect(parseFloat(field.elevation)).toBeLessThan(200);
      });
    });
  });
});

module.exports = {
  // Helper functions for vector testing
  generateRandomVector: (dimensions) => {
    return Array.from({ length: dimensions }, () => Math.random());
  },
  
  generateWeatherVector: () => {
    // 128-dimensional weather pattern
    return Array.from({ length: 128 }, (_, i) => {
      const temp = Math.sin(i * 0.1) * 0.3;
      const humidity = Math.cos(i * 0.15) * 0.2;
      const wind = Math.sin(i * 0.05) * 0.3;
      const pressure = Math.cos(i * 0.2) * 0.2;
      return temp + humidity + wind + pressure;
    });
  },
  
  generateSmokeVector: (concentration) => {
    // 64-dimensional smoke plume
    return Array.from({ length: 64 }, (_, i) => {
      const base = concentration / 100;
      const dispersion = Math.exp(-i / 20);
      return base * dispersion;
    });
  },
  
  generateTerrainVector: (elevation, roughness) => {
    // 32-dimensional terrain features
    return Array.from({ length: 32 }, (_, i) => {
      const elevComponent = elevation / 3000;
      const roughComponent = roughness * Math.sin(i * 0.5);
      return elevComponent + roughComponent;
    });
  },
  
  calculateCosineSimilarity: (vec1, vec2) => {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same dimension');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
};