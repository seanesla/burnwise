/**
 * BURNWISE Performance Benchmarking Suite
 * 
 * Ultra-deep performance testing to ensure system meets performance requirements
 * under various load conditions and maintains acceptable response times.
 */

const request = require('supertest');
const { performance } = require('perf_hooks');
const { initializeDatabase, query, closePool } = require('../db/connection');
const BurnRequestCoordinator = require('../agents/coordinatorFixed5Agent');

describe('Performance Benchmarking Suite', () => {
  let app;
  let coordinator;
  let baselineMetrics;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initializeDatabase();
    
    const server = require('../server');
    app = server.app || server;
    coordinator = new BurnRequestCoordinator();
    
    // Establish baseline metrics
    baselineMetrics = await collectBaselineMetrics();
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  const collectBaselineMetrics = async () => {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage();
    
    // Perform a simple operation to establish baseline
    await query('SELECT 1 as baseline_test');
    
    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    
    return {
      simpleQueryTime: endTime - startTime,
      baselineHeapUsed: initialMemory.heapUsed,
      baselineExternal: initialMemory.external
    };
  };

  const measurePerformance = async (operation, name) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    const result = await operation();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const metrics = {
      name,
      duration: endTime - startTime,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      result
    };
    
    console.log(`   ${name}: ${metrics.duration.toFixed(2)}ms, Memory: ${(metrics.memoryDelta / 1024).toFixed(1)}KB`);
    
    return metrics;
  };

  describe('API Response Time Benchmarks', () => {
    
    test('should meet response time requirements for single burn request', async () => {
      console.log(`\n⚡ Single Request Response Time Benchmark:`);
      
      const burnRequest = {
        farmId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
        },
        requestedDate: '2025-08-20',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        purpose: 'Performance benchmark test',
        elevationMeters: 250,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 18
      };

      const metrics = await measurePerformance(async () => {
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest)
          .timeout(30000);
        return response;
      }, 'Single burn request');

      // Performance requirements
      expect(metrics.duration).toBeLessThan(5000); // Less than 5 seconds
      expect(metrics.result.status).toBeOneOf([200, 201]);
      
      console.log(`   Performance target: < 5000ms ✅`);
    });

    test('should maintain acceptable response times under concurrent load', async () => {
      console.log(`\n⚡ Concurrent Load Response Time Benchmark:`);
      
      const concurrentRequests = 20;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        farmId: (i % 2) + 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120 - i * 0.001, 40 + i * 0.001],
            [-119.99 - i * 0.001, 40 + i * 0.001],
            [-119.99 - i * 0.001, 40.01 + i * 0.001],
            [-120 - i * 0.001, 40.01 + i * 0.001],
            [-120 - i * 0.001, 40 + i * 0.001]
          ]]
        },
        requestedDate: `2025-08-${String(20 + (i % 5)).padStart(2, '0')}`,
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        purpose: `Concurrent benchmark ${i}`
      }));

      const metrics = await measurePerformance(async () => {
        const responses = await Promise.allSettled(
          requests.map(req => 
            request(app)
              .post('/api/burn-requests')
              .send(req)
              .timeout(30000)
          )
        );
        
        return responses;
      }, `${concurrentRequests} concurrent requests`);

      const successful = metrics.result.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      ).length;

      const avgResponseTime = metrics.duration / concurrentRequests;
      
      console.log(`   Successful: ${successful}/${concurrentRequests}`);
      console.log(`   Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Success rate: ${(successful / concurrentRequests * 100).toFixed(1)}%`);

      // Performance requirements
      expect(metrics.duration).toBeLessThan(30000); // Total time under 30 seconds
      expect(successful).toBeGreaterThan(concurrentRequests * 0.8); // 80% success rate
      expect(avgResponseTime).toBeLessThan(10000); // Average under 10 seconds
      
      console.log(`   Performance targets met ✅`);
    });

    test('should handle health checks with minimal latency', async () => {
      console.log(`\n💗 Health Check Latency Benchmark:`);
      
      const healthChecks = 100;
      const individualTimes = [];

      for (let i = 0; i < healthChecks; i++) {
        const startTime = performance.now();
        const response = await request(app).get('/health');
        const endTime = performance.now();
        
        if (response.status === 200) {
          individualTimes.push(endTime - startTime);
        }
      }

      const avgLatency = individualTimes.reduce((sum, time) => sum + time, 0) / individualTimes.length;
      const maxLatency = Math.max(...individualTimes);
      const minLatency = Math.min(...individualTimes);
      const p95Latency = individualTimes.sort((a, b) => a - b)[Math.floor(individualTimes.length * 0.95)];

      console.log(`   Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Min latency: ${minLatency.toFixed(2)}ms`);
      console.log(`   Max latency: ${maxLatency.toFixed(2)}ms`);
      console.log(`   95th percentile: ${p95Latency.toFixed(2)}ms`);

      // Health check performance requirements
      expect(avgLatency).toBeLessThan(100); // Average under 100ms
      expect(p95Latency).toBeLessThan(500); // 95th percentile under 500ms
      expect(individualTimes.length).toBe(healthChecks); // All should succeed
      
      console.log(`   Health check performance targets met ✅`);
    });
  });

  describe('Database Performance Benchmarks', () => {
    
    test('should perform vector operations within acceptable time limits', async () => {
      console.log(`\n📊 Vector Operation Performance Benchmark:`);
      
      // Generate test vector
      const testVector = coordinator.generateTerrainVector({
        elevationMeters: 250,
        terrainSlope: 12,
        fuelLoadTonsPerHectare: 18,
        requestedDate: '2025-08-15'
      }, 50, [-120, 40]);

      const vectorString = `[${testVector.join(',')}]`;

      // Test vector insertion
      const insertMetrics = await measurePerformance(async () => {
        const result = await query(`
          INSERT INTO burn_requests (
            field_id, requested_date, purpose, terrain_vector
          ) VALUES (?, ?, ?, ?)
        `, [1, '2025-08-15', 'Vector performance test', vectorString]);
        return result.insertId;
      }, 'Vector insertion');

      const requestId = insertMetrics.result;

      // Test vector retrieval
      const retrievalMetrics = await measurePerformance(async () => {
        const [result] = await query(
          'SELECT terrain_vector FROM burn_requests WHERE request_id = ?',
          [requestId]
        );
        return result;
      }, 'Vector retrieval');

      // Test vector similarity search
      const similarityMetrics = await measurePerformance(async () => {
        const results = await query(`
          SELECT request_id, VEC_COSINE_DISTANCE(terrain_vector, ?) as distance
          FROM burn_requests 
          WHERE terrain_vector IS NOT NULL
          ORDER BY distance 
          LIMIT 5
        `, [vectorString]);
        return results;
      }, 'Vector similarity search');

      // Performance requirements
      expect(insertMetrics.duration).toBeLessThan(1000); // Insert under 1 second
      expect(retrievalMetrics.duration).toBeLessThan(100); // Retrieve under 100ms
      expect(similarityMetrics.duration).toBeLessThan(2000); // Similarity search under 2 seconds

      // Verify results
      expect(retrievalMetrics.result).toBeDefined();
      expect(similarityMetrics.result).toHaveLength(1); // At least the inserted vector

      // Clean up
      await query('DELETE FROM burn_requests WHERE request_id = ?', [requestId]);
      
      console.log(`   Vector operations performance targets met ✅`);
    });

    test('should handle large dataset queries efficiently', async () => {
      console.log(`\n🗄️ Large Dataset Query Performance Benchmark:`);
      
      // Insert test data
      const testDataSize = 100;
      const insertPromises = Array.from({ length: testDataSize }, (_, i) => 
        query(`
          INSERT INTO burn_requests (
            field_id, requested_date, purpose, priority_score
          ) VALUES (?, ?, ?, ?)
        `, [1, `2025-08-${String(15 + (i % 10)).padStart(2, '0')}`, `Large dataset test ${i}`, 50 + i])
      );

      const insertAllMetrics = await measurePerformance(async () => {
        const results = await Promise.all(insertPromises);
        return results.map(r => r.insertId);
      }, `Insert ${testDataSize} records`);

      const insertedIds = insertAllMetrics.result;

      // Test large SELECT query
      const selectMetrics = await measurePerformance(async () => {
        const results = await query(`
          SELECT request_id, requested_date, purpose, priority_score 
          FROM burn_requests 
          WHERE request_id IN (${insertedIds.join(',')})
          ORDER BY priority_score DESC
        `);
        return results;
      }, `Select ${testDataSize} records`);

      // Test aggregation query
      const aggregationMetrics = await measurePerformance(async () => {
        const results = await query(`
          SELECT 
            requested_date,
            COUNT(*) as request_count,
            AVG(priority_score) as avg_priority,
            MAX(priority_score) as max_priority
          FROM burn_requests 
          WHERE request_id IN (${insertedIds.join(',')})
          GROUP BY requested_date
          ORDER BY requested_date
        `);
        return results;
      }, 'Aggregation query');

      // Performance requirements
      expect(insertAllMetrics.duration).toBeLessThan(10000); // Bulk insert under 10 seconds
      expect(selectMetrics.duration).toBeLessThan(1000); // Select under 1 second
      expect(aggregationMetrics.duration).toBeLessThan(2000); // Aggregation under 2 seconds

      // Verify results
      expect(selectMetrics.result).toHaveLength(testDataSize);
      expect(aggregationMetrics.result.length).toBeGreaterThan(0);

      // Clean up
      await query(`DELETE FROM burn_requests WHERE request_id IN (${insertedIds.join(',')})`);
      
      console.log(`   Large dataset query performance targets met ✅`);
    });

    test('should maintain connection pool efficiency under stress', async () => {
      console.log(`\n🏊 Connection Pool Performance Benchmark:`);
      
      const connectionStressTests = 50;
      const connectionMetrics = [];

      for (let i = 0; i < connectionStressTests; i++) {
        const metrics = await measurePerformance(async () => {
          const result = await query('SELECT ? as connection_test', [i]);
          return result;
        }, `Connection ${i + 1}`);
        
        connectionMetrics.push(metrics.duration);
      }

      const avgConnectionTime = connectionMetrics.reduce((sum, time) => sum + time, 0) / connectionMetrics.length;
      const maxConnectionTime = Math.max(...connectionMetrics);
      const minConnectionTime = Math.min(...connectionMetrics);

      console.log(`   Average connection time: ${avgConnectionTime.toFixed(2)}ms`);
      console.log(`   Min connection time: ${minConnectionTime.toFixed(2)}ms`);
      console.log(`   Max connection time: ${maxConnectionTime.toFixed(2)}ms`);

      // Connection pool performance requirements
      expect(avgConnectionTime).toBeLessThan(50); // Average under 50ms
      expect(maxConnectionTime).toBeLessThan(500); // Max under 500ms
      
      console.log(`   Connection pool performance targets met ✅`);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    
    test('should maintain stable memory usage during extended operations', async () => {
      console.log(`\n🧠 Memory Usage Stability Benchmark:`);
      
      const initialMemory = process.memoryUsage();
      const memorySnapshots = [initialMemory];
      
      // Perform 50 operations and track memory
      for (let i = 0; i < 50; i++) {
        await query('SELECT ? as memory_test', [i]);
        memorySnapshots.push(process.memoryUsage());
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxHeapUsed = Math.max(...memorySnapshots.map(m => m.heapUsed));

      console.log(`   Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Max heap: ${(maxHeapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory stability requirements
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      expect(maxHeapUsed - initialMemory.heapUsed).toBeLessThan(100 * 1024 * 1024); // Peak increase under 100MB
      
      console.log(`   Memory stability targets met ✅`);
    });

    test('should handle memory-intensive vector operations efficiently', async () => {
      console.log(`\n📊 Memory-Intensive Vector Benchmark:`);
      
      const initialMemory = process.memoryUsage();
      
      // Generate many vectors
      const vectorCount = 100;
      const vectors = [];
      
      for (let i = 0; i < vectorCount; i++) {
        const vector = coordinator.generateTerrainVector({
          elevationMeters: 100 + i * 10,
          terrainSlope: i % 45,
          fuelLoadTonsPerHectare: 10 + (i % 40),
          requestedDate: '2025-08-15'
        }, 20 + i, [-120 + i * 0.01, 40 + i * 0.01]);
        
        vectors.push(vector);
      }

      const vectorMemory = process.memoryUsage();
      
      // Clear vectors and force GC
      vectors.length = 0;
      if (global.gc) global.gc();
      
      const finalMemory = process.memoryUsage();
      
      const vectorMemoryIncrease = vectorMemory.heapUsed - initialMemory.heapUsed;
      const remainingMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`   Vector generation memory: ${(vectorMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Remaining after cleanup: ${(remainingMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory per vector: ${(vectorMemoryIncrease / vectorCount / 1024).toFixed(2)}KB`);

      // Vector memory efficiency requirements
      expect(vectorMemoryIncrease / vectorCount).toBeLessThan(10 * 1024); // Less than 10KB per vector
      expect(remainingMemoryIncrease).toBeLessThan(vectorMemoryIncrease * 0.5); // Good cleanup
      
      console.log(`   Vector memory efficiency targets met ✅`);
    });
  });

  describe('Throughput Benchmarks', () => {
    
    test('should achieve target throughput for API requests', async () => {
      console.log(`\n🚀 API Throughput Benchmark:`);
      
      const testDuration = 10000; // 10 seconds
      const startTime = performance.now();
      let requestCount = 0;
      let successCount = 0;
      
      const throughputTest = new Promise((resolve) => {
        const interval = setInterval(async () => {
          requestCount++;
          
          try {
            const response = await request(app)
              .get('/health')
              .timeout(2000);
            
            if (response.status === 200) {
              successCount++;
            }
          } catch (error) {
            // Count failed requests
          }

          if (performance.now() - startTime >= testDuration) {
            clearInterval(interval);
            resolve();
          }
        }, 50); // 20 requests per second target
      });

      await throughputTest;
      
      const actualDuration = performance.now() - startTime;
      const requestsPerSecond = (requestCount / (actualDuration / 1000));
      const successRate = (successCount / requestCount * 100);

      console.log(`   Duration: ${(actualDuration / 1000).toFixed(2)}s`);
      console.log(`   Total requests: ${requestCount}`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Requests/sec: ${requestsPerSecond.toFixed(2)}`);
      console.log(`   Success rate: ${successRate.toFixed(1)}%`);

      // Throughput requirements
      expect(requestsPerSecond).toBeGreaterThan(15); // At least 15 requests/sec
      expect(successRate).toBeGreaterThan(95); // 95% success rate
      
      console.log(`   Throughput targets met ✅`);
    });

    test('should maintain throughput under sustained load', async () => {
      console.log(`\n⏱️ Sustained Load Throughput Benchmark:`);
      
      const intervals = 5; // 5 intervals of 5 seconds each
      const intervalDuration = 5000;
      const throughputResults = [];
      
      for (let interval = 0; interval < intervals; interval++) {
        const startTime = performance.now();
        let intervalRequests = 0;
        let intervalSuccess = 0;
        
        const intervalTest = new Promise((resolve) => {
          const timer = setInterval(async () => {
            intervalRequests++;
            
            try {
              const response = await request(app)
                .get('/health')
                .timeout(1000);
              
              if (response.status === 200) {
                intervalSuccess++;
              }
            } catch (error) {
              // Count failures
            }

            if (performance.now() - startTime >= intervalDuration) {
              clearInterval(timer);
              resolve();
            }
          }, 100); // 10 requests per second
        });

        await intervalTest;
        
        const actualInterval = performance.now() - startTime;
        const intervalThroughput = intervalRequests / (actualInterval / 1000);
        
        throughputResults.push({
          interval: interval + 1,
          throughput: intervalThroughput,
          successRate: (intervalSuccess / intervalRequests * 100)
        });
        
        console.log(`   Interval ${interval + 1}: ${intervalThroughput.toFixed(2)} req/s, ${(intervalSuccess / intervalRequests * 100).toFixed(1)}% success`);
      }

      // Analyze throughput stability
      const avgThroughput = throughputResults.reduce((sum, r) => sum + r.throughput, 0) / throughputResults.length;
      const minThroughput = Math.min(...throughputResults.map(r => r.throughput));
      const maxThroughput = Math.max(...throughputResults.map(r => r.throughput));
      const throughputVariance = maxThroughput - minThroughput;

      console.log(`   Average throughput: ${avgThroughput.toFixed(2)} req/s`);
      console.log(`   Throughput variance: ${throughputVariance.toFixed(2)} req/s`);

      // Sustained load requirements
      expect(avgThroughput).toBeGreaterThan(8); // Average above 8 req/s
      expect(minThroughput).toBeGreaterThan(5); // Minimum above 5 req/s
      expect(throughputVariance).toBeLessThan(5); // Stable performance (variance < 5 req/s)
      
      console.log(`   Sustained throughput targets met ✅`);
    });
  });

  describe('Performance Regression Detection', () => {
    
    test('should detect performance regressions against baseline', async () => {
      console.log(`\n📈 Performance Regression Detection:`);
      
      // Current simple query performance
      const currentMetrics = await measurePerformance(async () => {
        return await query('SELECT 1 as regression_test');
      }, 'Current simple query');

      // Compare against baseline
      const performanceRatio = currentMetrics.duration / baselineMetrics.simpleQueryTime;
      
      console.log(`   Baseline query time: ${baselineMetrics.simpleQueryTime.toFixed(2)}ms`);
      console.log(`   Current query time: ${currentMetrics.duration.toFixed(2)}ms`);
      console.log(`   Performance ratio: ${performanceRatio.toFixed(2)}x`);

      // Performance should not degrade significantly
      expect(performanceRatio).toBeLessThan(2.0); // No more than 2x slower than baseline
      
      if (performanceRatio < 1.2) {
        console.log(`   ✅ No performance regression detected`);
      } else if (performanceRatio < 2.0) {
        console.log(`   ⚠️ Minor performance regression detected`);
      } else {
        console.log(`   ❌ Significant performance regression detected`);
      }
    });

    test('should track performance trends across test runs', async () => {
      console.log(`\n📊 Performance Trend Analysis:`);
      
      // Simulate multiple test runs
      const testRuns = 10;
      const performanceHistory = [];
      
      for (let run = 0; run < testRuns; run++) {
        const metrics = await measurePerformance(async () => {
          return await query('SELECT ? as trend_test', [run]);
        }, `Trend test run ${run + 1}`);
        
        performanceHistory.push(metrics.duration);
      }

      const avgPerformance = performanceHistory.reduce((sum, time) => sum + time, 0) / performanceHistory.length;
      const performanceStdDev = Math.sqrt(
        performanceHistory.reduce((sum, time) => sum + Math.pow(time - avgPerformance, 2), 0) / performanceHistory.length
      );

      console.log(`   Average performance: ${avgPerformance.toFixed(2)}ms`);
      console.log(`   Standard deviation: ${performanceStdDev.toFixed(2)}ms`);
      console.log(`   Coefficient of variation: ${(performanceStdDev / avgPerformance * 100).toFixed(1)}%`);

      // Performance should be consistent
      expect(performanceStdDev / avgPerformance).toBeLessThan(0.5); // CV less than 50%
      
      console.log(`   ✅ Performance consistency maintained`);
    });
  });
});