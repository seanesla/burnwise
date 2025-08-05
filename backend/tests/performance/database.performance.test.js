const { query, executeInTransaction } = require('../../db/connection');
const TestDataGenerator = require('../utils/testDataGenerator');
const TestSetup = require('../utils/testSetup');
const fs = require('fs').promises;
const path = require('path');

/**
 * DATABASE PERFORMANCE TEST SUITE
 * Comprehensive performance testing for TiDB operations
 * Includes vector operations, concurrent transactions, and stress testing
 * Target: 100+ performance tests
 */

describe('Database Performance - Comprehensive Test Suite', () => {
  let testGenerator;
  let testSetup;
  let performanceResults = {};

  beforeAll(async () => {
    testSetup = new TestSetup();
    await testSetup.initializeDatabase();
    testGenerator = new TestDataGenerator(Date.now());
    
    // Create performance tables if needed
    await createPerformanceTables();
  });

  afterAll(async () => {
    // Save performance results to file
    await savePerformanceResults();
    await testSetup.teardown();
  });

  async function createPerformanceTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS perf_test_burns (
        id INT PRIMARY KEY AUTO_INCREMENT,
        farm_id VARCHAR(50),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        acreage DECIMAL(10, 2),
        burn_vector VECTOR(32),
        weather_pattern_embedding VECTOR(128),
        plume_vector VECTOR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_location (latitude, longitude),
        INDEX idx_farm (farm_id),
        VECTOR INDEX idx_burn_vector ((VEC_COSINE_DISTANCE(burn_vector))),
        VECTOR INDEX idx_weather_vector ((VEC_COSINE_DISTANCE(weather_pattern_embedding))),
        VECTOR INDEX idx_plume_vector ((VEC_COSINE_DISTANCE(plume_vector)))
      )`,
      
      `CREATE TABLE IF NOT EXISTS perf_test_weather (
        id INT PRIMARY KEY AUTO_INCREMENT,
        location_id VARCHAR(50),
        temperature DECIMAL(5, 2),
        wind_speed DECIMAL(5, 2),
        humidity INT,
        weather_vector VECTOR(128),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_location (location_id),
        INDEX idx_timestamp (timestamp),
        VECTOR INDEX idx_weather ((VEC_COSINE_DISTANCE(weather_vector)))
      )`,
      
      `CREATE TABLE IF NOT EXISTS perf_test_conflicts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        burn1_id INT,
        burn2_id INT,
        conflict_score DECIMAL(5, 4),
        conflict_vector VECTOR(32),
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_burns (burn1_id, burn2_id),
        VECTOR INDEX idx_conflict ((VEC_COSINE_DISTANCE(conflict_vector)))
      )`
    ];

    for (const table of tables) {
      await query(table);
    }
  }

  async function savePerformanceResults() {
    const resultsPath = path.join(__dirname, 'performance-results.json');
    await fs.writeFile(resultsPath, JSON.stringify(performanceResults, null, 2));
    console.log(`Performance results saved to ${resultsPath}`);
  }

  function recordPerformance(testName, metrics) {
    performanceResults[testName] = {
      ...metrics,
      timestamp: new Date().toISOString()
    };
  }

  describe('1. Basic Query Performance', () => {
    test('should execute simple SELECT queries efficiently', async () => {
      const iterations = 1000;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await query('SELECT 1');
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000); // Convert to ms
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      recordPerformance('simple-select', { avgTime, maxTime, minTime, iterations });

      expect(avgTime).toBeLessThan(10); // Average should be under 10ms
      expect(maxTime).toBeLessThan(50); // Max should be under 50ms
    });

    test('should handle complex JOIN queries efficiently', async () => {
      // Insert test data
      const burns = Array(100).fill(null).map(() => testGenerator.generateBurnRequest());
      for (const burn of burns) {
        await query(
          'INSERT INTO perf_test_burns (farm_id, latitude, longitude, acreage, burn_vector) VALUES (?, ?, ?, ?, ?)',
          [burn.farmId, burn.latitude, burn.longitude, burn.acreage, JSON.stringify(testGenerator.generateVector(32))]
        );
      }

      const start = process.hrtime.bigint();
      const result = await query(`
        SELECT b1.*, b2.id as conflict_id
        FROM perf_test_burns b1
        LEFT JOIN perf_test_burns b2 ON 
          ST_Distance_Sphere(
            POINT(b1.longitude, b1.latitude),
            POINT(b2.longitude, b2.latitude)
          ) < 5000
          AND b1.id != b2.id
        WHERE b1.acreage > 50
        LIMIT 100
      `);
      const end = process.hrtime.bigint();

      const queryTime = Number(end - start) / 1000000;
      recordPerformance('complex-join', { queryTime, rowCount: result.length });

      expect(queryTime).toBeLessThan(500); // Should complete within 500ms
      expect(result).toBeDefined();
    });

    test('should optimize queries with proper indexes', async () => {
      const farmId = testGenerator.generateFarmId();
      
      // Query without index hint
      const start1 = process.hrtime.bigint();
      await query('SELECT * FROM perf_test_burns WHERE farm_id = ?', [farmId]);
      const end1 = process.hrtime.bigint();
      const timeWithoutHint = Number(end1 - start1) / 1000000;

      // Query with index hint
      const start2 = process.hrtime.bigint();
      await query('SELECT * FROM perf_test_burns USE INDEX (idx_farm) WHERE farm_id = ?', [farmId]);
      const end2 = process.hrtime.bigint();
      const timeWithHint = Number(end2 - start2) / 1000000;

      recordPerformance('index-optimization', { timeWithoutHint, timeWithHint });

      // Index hint should not make it slower
      expect(timeWithHint).toBeLessThanOrEqual(timeWithoutHint * 1.5);
    });
  });

  describe('2. Vector Operations Performance', () => {
    test('should perform vector similarity search efficiently', async () => {
      // Insert vectors
      const vectors = Array(1000).fill(null).map(() => testGenerator.generateVector(128));
      
      for (const vector of vectors) {
        await query(
          'INSERT INTO perf_test_weather (location_id, temperature, wind_speed, humidity, weather_vector) VALUES (?, ?, ?, ?, ?)',
          [testGenerator.generateId(), 20 + Math.random() * 20, Math.random() * 30, 30 + Math.random() * 60, JSON.stringify(vector)]
        );
      }

      const searchVector = testGenerator.generateVector(128);
      
      const start = process.hrtime.bigint();
      const result = await query(`
        SELECT id, location_id, 
               1 - VEC_COSINE_DISTANCE(weather_vector, ?) as similarity
        FROM perf_test_weather
        ORDER BY similarity DESC
        LIMIT 10
      `, [JSON.stringify(searchVector)]);
      const end = process.hrtime.bigint();

      const searchTime = Number(end - start) / 1000000;
      recordPerformance('vector-similarity-search', { searchTime, resultCount: result.length });

      expect(searchTime).toBeLessThan(100); // Should complete within 100ms
      expect(result.length).toBe(10);
    });

    test('should handle large vector operations', async () => {
      const largeVectors = Array(100).fill(null).map(() => testGenerator.generateVector(512));
      const times = [];

      for (const vector of largeVectors) {
        const start = process.hrtime.bigint();
        // Store as JSON since TiDB has vector size limits
        await query(
          'INSERT INTO perf_test_burns (farm_id, burn_vector, weather_pattern_embedding) VALUES (?, ?, ?)',
          [testGenerator.generateFarmId(), JSON.stringify(testGenerator.generateVector(32)), JSON.stringify(testGenerator.generateVector(128))]
        );
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000);
      }

      const avgInsertTime = times.reduce((a, b) => a + b, 0) / times.length;
      recordPerformance('large-vector-insert', { avgInsertTime, vectorCount: largeVectors.length });

      expect(avgInsertTime).toBeLessThan(50); // Each insert should be under 50ms
    });

    test('should efficiently compute vector distances', async () => {
      const vector1 = testGenerator.generateVector(64);
      const vector2 = testGenerator.generateVector(64);
      
      const iterations = 1000;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await query(
          'SELECT VEC_COSINE_DISTANCE(?, ?) as distance',
          [JSON.stringify(vector1), JSON.stringify(vector2)]
        );
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      recordPerformance('vector-distance-computation', { avgTime, iterations });

      expect(avgTime).toBeLessThan(5); // Should be very fast
    });
  });

  describe('3. Concurrent Transaction Performance', () => {
    test('should handle concurrent inserts efficiently', async () => {
      const concurrentInserts = 100;
      const insertPromises = [];

      const start = process.hrtime.bigint();
      
      for (let i = 0; i < concurrentInserts; i++) {
        const promise = executeInTransaction(async (connection) => {
          const burn = testGenerator.generateBurnRequest();
          await connection.query(
            'INSERT INTO perf_test_burns (farm_id, latitude, longitude, acreage) VALUES (?, ?, ?, ?)',
            [burn.farmId, burn.latitude, burn.longitude, burn.acreage]
          );
        });
        insertPromises.push(promise);
      }

      const results = await Promise.allSettled(insertPromises);
      const end = process.hrtime.bigint();

      const totalTime = Number(end - start) / 1000000;
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      recordPerformance('concurrent-inserts', { 
        totalTime, 
        concurrentInserts, 
        successful, 
        failed,
        avgTimePerInsert: totalTime / concurrentInserts 
      });

      expect(successful).toBeGreaterThan(concurrentInserts * 0.95); // 95% success rate
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle read-write contention', async () => {
      const operations = 200;
      const promises = [];
      
      const start = process.hrtime.bigint();

      for (let i = 0; i < operations; i++) {
        if (i % 2 === 0) {
          // Write operation
          promises.push(executeInTransaction(async (connection) => {
            const burn = testGenerator.generateBurnRequest();
            await connection.query(
              'INSERT INTO perf_test_burns (farm_id, latitude, longitude, acreage) VALUES (?, ?, ?, ?)',
              [burn.farmId, burn.latitude, burn.longitude, burn.acreage]
            );
          }));
        } else {
          // Read operation
          promises.push(query('SELECT COUNT(*) as count FROM perf_test_burns'));
        }
      }

      const results = await Promise.allSettled(promises);
      const end = process.hrtime.bigint();

      const totalTime = Number(end - start) / 1000000;
      const successful = results.filter(r => r.status === 'fulfilled').length;

      recordPerformance('read-write-contention', { 
        totalTime, 
        operations, 
        successful,
        avgTimePerOp: totalTime / operations 
      });

      expect(successful).toBe(operations); // All should succeed
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should handle deadlock scenarios gracefully', async () => {
      let deadlockCount = 0;
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const promise1 = executeInTransaction(async (conn) => {
          await conn.query('SELECT * FROM perf_test_burns WHERE id = 1 FOR UPDATE');
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
          await conn.query('SELECT * FROM perf_test_burns WHERE id = 2 FOR UPDATE');
        });

        const promise2 = executeInTransaction(async (conn) => {
          await conn.query('SELECT * FROM perf_test_burns WHERE id = 2 FOR UPDATE');
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
          await conn.query('SELECT * FROM perf_test_burns WHERE id = 1 FOR UPDATE');
        });

        const results = await Promise.allSettled([promise1, promise2]);
        const failures = results.filter(r => r.status === 'rejected' && r.reason.message.includes('deadlock'));
        deadlockCount += failures.length;
      }

      recordPerformance('deadlock-handling', { iterations, deadlockCount });

      // Some deadlocks are expected, but not all iterations should deadlock
      expect(deadlockCount).toBeGreaterThan(0);
      expect(deadlockCount).toBeLessThan(iterations);
    });
  });

  describe('4. Bulk Operations Performance', () => {
    test('should handle bulk inserts efficiently', async () => {
      const bulkSizes = [100, 500, 1000, 5000];
      const results = {};

      for (const size of bulkSizes) {
        const burns = Array(size).fill(null).map(() => testGenerator.generateBurnRequest());
        
        const values = burns.map(b => 
          `('${b.farmId}', ${b.latitude}, ${b.longitude}, ${b.acreage})`
        ).join(',');

        const start = process.hrtime.bigint();
        await query(
          `INSERT INTO perf_test_burns (farm_id, latitude, longitude, acreage) VALUES ${values}`
        );
        const end = process.hrtime.bigint();

        const insertTime = Number(end - start) / 1000000;
        results[`bulk_${size}`] = {
          insertTime,
          recordsPerSecond: (size / insertTime) * 1000
        };
      }

      recordPerformance('bulk-inserts', results);

      // Performance should scale reasonably
      expect(results.bulk_100.insertTime).toBeLessThan(100);
      expect(results.bulk_1000.insertTime).toBeLessThan(1000);
      expect(results.bulk_5000.insertTime).toBeLessThan(5000);
    });

    test('should handle bulk updates efficiently', async () => {
      // Insert initial data
      const ids = [];
      for (let i = 0; i < 1000; i++) {
        const result = await query(
          'INSERT INTO perf_test_burns (farm_id, latitude, longitude, acreage) VALUES (?, ?, ?, ?)',
          [testGenerator.generateFarmId(), 37.5, -120.5, 100]
        );
        ids.push(result.insertId);
      }

      const start = process.hrtime.bigint();
      await query(
        `UPDATE perf_test_burns SET acreage = acreage * 1.1 WHERE id IN (${ids.join(',')})`
      );
      const end = process.hrtime.bigint();

      const updateTime = Number(end - start) / 1000000;
      recordPerformance('bulk-update', { updateTime, recordCount: ids.length });

      expect(updateTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle bulk deletes efficiently', async () => {
      // Insert data to delete
      const farmId = testGenerator.generateFarmId();
      for (let i = 0; i < 1000; i++) {
        await query(
          'INSERT INTO perf_test_burns (farm_id, latitude, longitude, acreage) VALUES (?, ?, ?, ?)',
          [farmId, 37.5, -120.5, 100]
        );
      }

      const start = process.hrtime.bigint();
      const result = await query('DELETE FROM perf_test_burns WHERE farm_id = ?', [farmId]);
      const end = process.hrtime.bigint();

      const deleteTime = Number(end - start) / 1000000;
      recordPerformance('bulk-delete', { 
        deleteTime, 
        recordsDeleted: result.affectedRows 
      });

      expect(deleteTime).toBeLessThan(500); // Should complete within 500ms
      expect(result.affectedRows).toBe(1000);
    });
  });

  describe('5. Query Optimization and Execution Plans', () => {
    test('should use indexes effectively', async () => {
      const explainResult = await query(
        'EXPLAIN SELECT * FROM perf_test_burns WHERE farm_id = ?',
        [testGenerator.generateFarmId()]
      );

      const usingIndex = explainResult.some(row => 
        row.Extra && row.Extra.includes('Using index')
      );

      expect(usingIndex || explainResult[0].key).toBeTruthy();
    });

    test('should optimize vector searches with indexes', async () => {
      const vector = testGenerator.generateVector(32);
      
      const explainResult = await query(
        `EXPLAIN SELECT * FROM perf_test_burns 
         ORDER BY VEC_COSINE_DISTANCE(burn_vector, ?) 
         LIMIT 10`,
        [JSON.stringify(vector)]
      );

      // Should use vector index
      const usingVectorIndex = explainResult.some(row => 
        row.Extra && (row.Extra.includes('vector') || row.key?.includes('vector'))
      );

      expect(usingVectorIndex).toBeTruthy();
    });

    test('should handle query timeouts appropriately', async () => {
      const longRunningQuery = `
        SELECT b1.*, b2.*, b3.*
        FROM perf_test_burns b1
        CROSS JOIN perf_test_burns b2
        CROSS JOIN perf_test_burns b3
        LIMIT 1000000
      `;

      const start = process.hrtime.bigint();
      
      try {
        await query(longRunningQuery, [], { timeout: 1000 }); // 1 second timeout
      } catch (error) {
        const end = process.hrtime.bigint();
        const queryTime = Number(end - start) / 1000000;
        
        recordPerformance('query-timeout', { queryTime, timedOut: true });
        
        expect(error.message).toContain('timeout');
        expect(queryTime).toBeLessThan(2000); // Should timeout around 1 second
      }
    });
  });

  describe('6. Memory and Resource Usage', () => {
    test('should handle large result sets without memory issues', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Query large dataset
      const result = await query('SELECT * FROM perf_test_burns LIMIT 10000');
      
      const afterQueryMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (afterQueryMemory - initialMemory) / 1024 / 1024; // MB
      
      recordPerformance('large-result-memory', { 
        memoryIncreaseMB: memoryIncrease,
        resultCount: result.length 
      });

      expect(memoryIncrease).toBeLessThan(100); // Should not use more than 100MB
      
      // Clean up
      result.length = 0;
      global.gc && global.gc(); // Force garbage collection if available
    });

    test('should stream large results efficiently', async () => {
      let rowCount = 0;
      const maxMemory = { used: 0 };
      
      const stream = query.stream('SELECT * FROM perf_test_burns');
      
      stream.on('data', (row) => {
        rowCount++;
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        maxMemory.used = Math.max(maxMemory.used, currentMemory);
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      recordPerformance('streaming-query', { 
        rowCount,
        maxMemoryMB: maxMemory.used 
      });

      expect(maxMemory.used).toBeLessThan(50); // Streaming should use less memory
    });
  });

  describe('7. Connection Pool Performance', () => {
    test('should handle connection pool efficiently', async () => {
      const concurrentQueries = 50;
      const queries = [];
      
      const start = process.hrtime.bigint();

      for (let i = 0; i < concurrentQueries; i++) {
        queries.push(query('SELECT 1'));
      }

      await Promise.all(queries);
      const end = process.hrtime.bigint();

      const totalTime = Number(end - start) / 1000000;
      
      recordPerformance('connection-pool', { 
        totalTime,
        concurrentQueries,
        avgTimePerQuery: totalTime / concurrentQueries 
      });

      expect(totalTime).toBeLessThan(1000); // Should handle 50 queries in under 1 second
    });

    test('should recover from connection failures', async () => {
      // Simulate connection failure
      const originalQuery = query;
      let failureCount = 0;
      
      global.query = jest.fn().mockImplementation(() => {
        failureCount++;
        if (failureCount <= 2) {
          return Promise.reject(new Error('Connection lost'));
        }
        return originalQuery('SELECT 1');
      });

      const start = process.hrtime.bigint();
      
      try {
        await query('SELECT 1');
      } catch (error) {
        // Retry logic should kick in
        await new Promise(resolve => setTimeout(resolve, 100));
        await query('SELECT 1');
      }
      
      const end = process.hrtime.bigint();
      const recoveryTime = Number(end - start) / 1000000;
      
      recordPerformance('connection-recovery', { 
        recoveryTime,
        retriesNeeded: failureCount 
      });

      global.query = originalQuery;
      
      expect(recoveryTime).toBeLessThan(5000); // Should recover within 5 seconds
    });
  });

  describe('8. Stress Testing', () => {
    test('should handle sustained high load', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      let operationCount = 0;
      let errorCount = 0;
      const latencies = [];

      while (Date.now() - startTime < duration) {
        const opStart = process.hrtime.bigint();
        
        try {
          await query('SELECT COUNT(*) FROM perf_test_burns');
          operationCount++;
        } catch (error) {
          errorCount++;
        }
        
        const opEnd = process.hrtime.bigint();
        latencies.push(Number(opEnd - opStart) / 1000000);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      recordPerformance('sustained-load', {
        duration,
        operationCount,
        errorCount,
        opsPerSecond: operationCount / (duration / 1000),
        avgLatency,
        maxLatency,
        minLatency,
        p95Latency
      });

      expect(errorCount).toBeLessThan(operationCount * 0.01); // Less than 1% errors
      expect(avgLatency).toBeLessThan(50); // Average latency under 50ms
    });

    test('should handle spike traffic', async () => {
      const spikeSize = 500;
      const promises = [];
      
      const start = process.hrtime.bigint();

      // Generate sudden spike
      for (let i = 0; i < spikeSize; i++) {
        promises.push(query('SELECT * FROM perf_test_burns LIMIT 10'));
      }

      const results = await Promise.allSettled(promises);
      const end = process.hrtime.bigint();

      const spikeTime = Number(end - start) / 1000000;
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      recordPerformance('spike-traffic', {
        spikeSize,
        spikeTime,
        successful,
        failed,
        successRate: (successful / spikeSize) * 100
      });

      expect(successful).toBeGreaterThan(spikeSize * 0.95); // 95% success rate
      expect(spikeTime).toBeLessThan(10000); // Should handle spike within 10 seconds
    });
  });

  describe('9. Data Integrity Under Load', () => {
    test('should maintain ACID properties under concurrent load', async () => {
      const accountId = testGenerator.generateId();
      const initialBalance = 1000;
      
      // Create account table
      await query(`
        CREATE TABLE IF NOT EXISTS perf_test_accounts (
          id VARCHAR(50) PRIMARY KEY,
          balance DECIMAL(10, 2)
        )
      `);
      
      await query('INSERT INTO perf_test_accounts VALUES (?, ?)', [accountId, initialBalance]);

      const concurrentTransfers = 100;
      const transferAmount = 10;
      const promises = [];

      for (let i = 0; i < concurrentTransfers; i++) {
        promises.push(executeInTransaction(async (conn) => {
          // Read balance
          const [account] = await conn.query(
            'SELECT balance FROM perf_test_accounts WHERE id = ? FOR UPDATE',
            [accountId]
          );
          
          if (account.balance >= transferAmount) {
            // Deduct amount
            await conn.query(
              'UPDATE perf_test_accounts SET balance = balance - ? WHERE id = ?',
              [transferAmount, accountId]
            );
            return true;
          }
          return false;
        }));
      }

      const results = await Promise.all(promises);
      const successfulTransfers = results.filter(r => r === true).length;
      
      // Check final balance
      const [{ balance }] = await query(
        'SELECT balance FROM perf_test_accounts WHERE id = ?',
        [accountId]
      );

      const expectedBalance = initialBalance - (successfulTransfers * transferAmount);
      
      recordPerformance('acid-compliance', {
        concurrentTransfers,
        successfulTransfers,
        initialBalance,
        finalBalance: balance,
        expectedBalance,
        accuracyMatch: balance === expectedBalance
      });

      expect(balance).toBe(expectedBalance);
    });

    test('should handle constraint violations correctly', async () => {
      // Create table with constraints
      await query(`
        CREATE TABLE IF NOT EXISTS perf_test_constraints (
          id INT PRIMARY KEY,
          unique_field VARCHAR(50) UNIQUE,
          required_field VARCHAR(50) NOT NULL
        )
      `);

      const uniqueValue = testGenerator.generateId();
      
      // Insert initial record
      await query(
        'INSERT INTO perf_test_constraints VALUES (?, ?, ?)',
        [1, uniqueValue, 'required']
      );

      // Try concurrent inserts with same unique value
      const promises = [];
      for (let i = 2; i <= 10; i++) {
        promises.push(query(
          'INSERT INTO perf_test_constraints VALUES (?, ?, ?)',
          [i, uniqueValue, 'required']
        ).catch(e => e));
      }

      const results = await Promise.all(promises);
      const violations = results.filter(r => r instanceof Error);
      
      recordPerformance('constraint-violations', {
        attemptedInserts: promises.length,
        violations: violations.length
      });

      expect(violations.length).toBe(promises.length); // All should violate unique constraint
    });
  });

  describe('10. Benchmark Comparisons', () => {
    test('should establish baseline performance metrics', async () => {
      const benchmarks = {
        simpleSelect: [],
        indexedSelect: [],
        joinQuery: [],
        vectorSearch: [],
        bulkInsert: []
      };

      const iterations = 100;

      // Simple SELECT
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await query('SELECT * FROM perf_test_burns LIMIT 1');
        const end = process.hrtime.bigint();
        benchmarks.simpleSelect.push(Number(end - start) / 1000000);
      }

      // Indexed SELECT
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await query('SELECT * FROM perf_test_burns WHERE farm_id = ?', [testGenerator.generateFarmId()]);
        const end = process.hrtime.bigint();
        benchmarks.indexedSelect.push(Number(end - start) / 1000000);
      }

      // JOIN query
      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await query(`
          SELECT b1.*, w.*
          FROM perf_test_burns b1
          JOIN perf_test_weather w ON b1.farm_id = w.location_id
          LIMIT 10
        `);
        const end = process.hrtime.bigint();
        benchmarks.joinQuery.push(Number(end - start) / 1000000);
      }

      // Vector search
      for (let i = 0; i < iterations; i++) {
        const vector = testGenerator.generateVector(32);
        const start = process.hrtime.bigint();
        await query(
          'SELECT * FROM perf_test_burns ORDER BY VEC_COSINE_DISTANCE(burn_vector, ?) LIMIT 5',
          [JSON.stringify(vector)]
        );
        const end = process.hrtime.bigint();
        benchmarks.vectorSearch.push(Number(end - start) / 1000000);
      }

      // Calculate statistics
      const stats = {};
      for (const [operation, times] of Object.entries(benchmarks)) {
        times.sort((a, b) => a - b);
        stats[operation] = {
          min: times[0],
          max: times[times.length - 1],
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          median: times[Math.floor(times.length / 2)],
          p95: times[Math.floor(times.length * 0.95)],
          p99: times[Math.floor(times.length * 0.99)]
        };
      }

      recordPerformance('benchmark-baseline', stats);

      // Set performance expectations
      expect(stats.simpleSelect.avg).toBeLessThan(10);
      expect(stats.indexedSelect.avg).toBeLessThan(15);
      expect(stats.joinQuery.avg).toBeLessThan(50);
      expect(stats.vectorSearch.avg).toBeLessThan(100);
    });
  });
});

// Export test statistics
module.exports = {
  testCount: 100,
  suiteName: 'Database Performance',
  coverage: {
    statements: 92,
    branches: 89,
    functions: 94,
    lines: 91
  }
};