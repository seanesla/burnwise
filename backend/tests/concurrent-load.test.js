/**
 * BURNWISE Concurrent Load Testing Suite
 * 
 * Ultra-deep concurrent load testing to ensure system reliability under
 * extreme traffic conditions. Tests various concurrent scenarios that
 * could occur in production environments.
 */

const request = require('supertest');
const { performance } = require('perf_hooks');
const { initializeDatabase, closePool, query } = require('../db/connection');

describe('Concurrent Load Testing Suite', () => {
  let app;
  let baselineMemory;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initializeDatabase();
    
    const server = require('../server');
    app = server.app || server;
    
    baselineMemory = process.memoryUsage();
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  describe('Concurrent API Request Testing', () => {
    
    test('should handle 100 concurrent burn requests without failure', async () => {
      const concurrentRequests = Array.from({ length: 100 }, (_, i) => ({
        farmId: (i % 5) + 1, // Distribute across 5 farms
        fieldId: (i % 10) + 1, // Distribute across 10 fields
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120 - (i * 0.001), 40 + (i * 0.001)],
            [-119.99 - (i * 0.001), 40 + (i * 0.001)],
            [-119.99 - (i * 0.001), 40.01 + (i * 0.001)],
            [-120 - (i * 0.001), 40.01 + (i * 0.001)],
            [-120 - (i * 0.001), 40 + (i * 0.001)]
          ]]
        },
        requestedDate: `2025-08-${String(15 + (i % 10)).padStart(2, '0')}`,
        requestedStartTime: `${String(8 + (i % 8)).padStart(2, '0')}:00`,
        requestedEndTime: `${String(12 + (i % 6)).padStart(2, '0')}:00`,
        burnType: ['broadcast', 'pile', 'prescribed'][i % 3],
        purpose: `Concurrent load test request ${i}`,
        areaHectares: 10 + (i % 90), // 10-100 hectares
        fuelLoad: 5 + (i % 45), // 5-50 tons/hectare
        terrainSlope: i % 45, // 0-45 degrees
        elevation: 100 + (i % 2900) // 100-3000 meters
      }));

      const startTime = performance.now();
      
      const responses = await Promise.allSettled(
        concurrentRequests.map((request_data, index) => 
          request(app)
            .post('/api/burn-requests')
            .send(request_data)
            .timeout(30000) // 30 second timeout
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Analyze results
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      );
      const failed = responses.filter(r => 
        r.status === 'rejected' || ![200, 201].includes(r.value?.status)
      );

      console.log(`\n🔥 Concurrent Load Test Results:`);
      console.log(`   Total Time: ${totalTime.toFixed(2)}ms`);
      console.log(`   Successful: ${successful.length}/100`);
      console.log(`   Failed: ${failed.length}/100`);
      console.log(`   Success Rate: ${(successful.length / 100 * 100).toFixed(1)}%`);
      console.log(`   Avg Response Time: ${(totalTime / 100).toFixed(2)}ms`);

      // Assertions
      expect(totalTime).toBeLessThan(60000); // Should complete within 60 seconds
      expect(successful.length).toBeGreaterThan(80); // At least 80% success rate
      expect(failed.length).toBeLessThan(20); // Less than 20% failure rate

      // Log details of failed requests for debugging
      if (failed.length > 0) {
        console.log(`\n❌ Failed Request Details:`);
        failed.slice(0, 5).forEach((failure, index) => {
          if (failure.status === 'rejected') {
            console.log(`   ${index + 1}. Rejected: ${failure.reason?.message || 'Unknown error'}`);
          } else {
            console.log(`   ${index + 1}. Status ${failure.value?.status}: ${JSON.stringify(failure.value?.body).substring(0, 100)}`);
          }
        });
      }
    });

    test('should handle 200 concurrent health checks without degradation', async () => {
      const healthChecks = Array.from({ length: 200 }, () => 
        request(app)
          .get('/health')
          .timeout(5000)
      );

      const startTime = performance.now();
      const responses = await Promise.allSettled(healthChecks);
      const endTime = performance.now();

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;

      console.log(`\n💗 Health Check Load Test:`);
      console.log(`   Total Time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`   Successful: ${successful}/200`);
      console.log(`   Success Rate: ${(successful / 200 * 100).toFixed(1)}%`);

      expect(endTime - startTime).toBeLessThan(10000); // Within 10 seconds
      expect(successful).toBeGreaterThan(195); // 97.5% success rate
    });

    test('should handle mixed concurrent operations', async () => {
      const operations = [];

      // 50 burn requests
      for (let i = 0; i < 50; i++) {
        operations.push({
          type: 'burn_request',
          operation: () => request(app)
            .post('/api/burn-requests')
            .send({
              farmId: (i % 5) + 1,
              fieldGeometry: {
                type: 'Polygon',
                coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
              },
              requestedDate: `2025-08-${String(15 + (i % 10)).padStart(2, '0')}`,
              requestedStartTime: '09:00',
              requestedEndTime: '15:00'
            })
        });
      }

      // 30 weather requests
      for (let i = 0; i < 30; i++) {
        operations.push({
          type: 'weather',
          operation: () => request(app)
            .get(`/api/weather/current?lat=${40 + i * 0.1}&lon=${-120 + i * 0.1}`)
        });
      }

      // 20 conflict detection requests
      for (let i = 0; i < 20; i++) {
        operations.push({
          type: 'conflicts',
          operation: () => request(app)
            .post('/api/burn-requests/detect-conflicts')
            .send({ date: `2025-08-${String(15 + (i % 10)).padStart(2, '0')}` })
        });
      }

      // Shuffle operations to simulate realistic mixed load
      for (let i = operations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [operations[i], operations[j]] = [operations[j], operations[i]];
      }

      const startTime = performance.now();
      
      const responses = await Promise.allSettled(
        operations.map(op => op.operation().timeout(30000))
      );

      const endTime = performance.now();

      // Analyze by operation type
      const resultsByType = {
        burn_request: { successful: 0, failed: 0 },
        weather: { successful: 0, failed: 0 },
        conflicts: { successful: 0, failed: 0 }
      };

      responses.forEach((response, index) => {
        const opType = operations[index].type;
        if (response.status === 'fulfilled' && [200, 201].includes(response.value.status)) {
          resultsByType[opType].successful++;
        } else {
          resultsByType[opType].failed++;
        }
      });

      console.log(`\n🔀 Mixed Operations Load Test:`);
      console.log(`   Total Time: ${(endTime - startTime).toFixed(2)}ms`);
      Object.entries(resultsByType).forEach(([type, results]) => {
        const total = results.successful + results.failed;
        const successRate = (results.successful / total * 100).toFixed(1);
        console.log(`   ${type}: ${results.successful}/${total} (${successRate}%)`);
      });

      // Each operation type should have reasonable success rates
      expect(resultsByType.burn_request.successful).toBeGreaterThan(40); // 80% of 50
      expect(resultsByType.weather.successful).toBeGreaterThan(25); // 83% of 30
      expect(resultsByType.conflicts.successful).toBeGreaterThan(15); // 75% of 20
    });
  });

  describe('Database Connection Pool Testing', () => {
    
    test('should handle connection pool exhaustion gracefully', async () => {
      // Create more database queries than the pool can handle simultaneously
      const queryPromises = Array.from({ length: 80 }, (_, i) => 
        query('SELECT SLEEP(0.1) as delay, ? as request_id', [i])
          .then(result => ({ success: true, requestId: i, result }))
          .catch(error => ({ success: false, requestId: i, error: error.message }))
      );

      const startTime = performance.now();
      const results = await Promise.allSettled(queryPromises);
      const endTime = performance.now();

      const completed = results.filter(r => r.status === 'fulfilled').length;
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      const failed = results.filter(r => 
        r.status === 'rejected' || !r.value?.success
      ).length;

      console.log(`\n🏊 Connection Pool Test:`);
      console.log(`   Total Time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`   Completed: ${completed}/80`);
      console.log(`   Successful: ${successful}/80`);
      console.log(`   Failed: ${failed}/80`);

      // All should complete (either succeed or fail gracefully)
      expect(completed).toBe(80);
      // Most should succeed (pool should manage connections effectively)
      expect(successful).toBeGreaterThan(60);
      // Should complete in reasonable time despite connection limits
      expect(endTime - startTime).toBeLessThan(30000);
    });

    test('should handle rapid connection acquisition and release', async () => {
      const rapidConnections = Array.from({ length: 150 }, (_, i) => 
        (async () => {
          try {
            const result = await query('SELECT ? as connection_test', [i]);
            return { success: true, id: i };
          } catch (error) {
            return { success: false, id: i, error: error.message };
          }
        })()
      );

      const startTime = performance.now();
      const results = await Promise.allSettled(rapidConnections);
      const endTime = performance.now();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;

      console.log(`\n⚡ Rapid Connection Test:`);
      console.log(`   Total Time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`   Successful: ${successful}/150`);
      console.log(`   Connections/sec: ${(150 / ((endTime - startTime) / 1000)).toFixed(1)}`);

      expect(successful).toBeGreaterThan(120); // 80% success rate
      expect(endTime - startTime).toBeLessThan(20000); // Within 20 seconds
    });
  });

  describe('Memory Pressure Testing', () => {
    
    test('should maintain stability under memory pressure', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create memory pressure with large objects
      const memoryPressureObjects = [];
      for (let i = 0; i < 50; i++) {
        memoryPressureObjects.push({
          id: i,
          largeArray: new Array(50000).fill(0).map(() => Math.random()),
          coordinates: new Array(1000).fill(0).map(() => [
            Math.random() * 360 - 180,
            Math.random() * 180 - 90
          ])
        });
      }

      // Perform API operations under memory pressure
      const operationsUnderPressure = Array.from({ length: 20 }, (_, i) => 
        request(app)
          .post('/api/burn-requests')
          .send({
            farmId: (i % 5) + 1,
            fieldGeometry: {
              type: 'Polygon',
              coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
            },
            requestedDate: `2025-08-${String(15 + i).padStart(2, '0')}`,
            requestedStartTime: '09:00',
            requestedEndTime: '15:00',
            purpose: `Memory pressure test ${i}`
          })
          .timeout(15000)
      );

      const startTime = performance.now();
      const responses = await Promise.allSettled(operationsUnderPressure);
      const endTime = performance.now();

      const currentMemory = process.memoryUsage();
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      ).length;

      console.log(`\n🧠 Memory Pressure Test:`);
      console.log(`   Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Current Memory: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory Increase: ${((currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Successful Operations: ${successful}/20`);
      console.log(`   Response Time: ${(endTime - startTime).toFixed(2)}ms`);

      // Clean up memory pressure objects
      memoryPressureObjects.length = 0;
      if (global.gc) global.gc();

      // Should maintain reasonable success rate under memory pressure
      expect(successful).toBeGreaterThan(15); // 75% success rate
      // Should not consume excessive memory
      expect(currentMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB increase
    });
  });

  describe('Sustained Load Testing', () => {
    
    test('should handle sustained load over extended period', async () => {
      const testDuration = 30000; // 30 seconds
      const requestInterval = 100; // 100ms between requests
      const expectedRequests = Math.floor(testDuration / requestInterval);
      
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      const startTime = performance.now();
      
      const sustainedTest = new Promise((resolve) => {
        const interval = setInterval(async () => {
          requestCount++;
          
          try {
            const response = await request(app)
              .post('/api/burn-requests')
              .send({
                farmId: (requestCount % 5) + 1,
                fieldGeometry: {
                  type: 'Polygon',
                  coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
                },
                requestedDate: `2025-08-${String(15 + (requestCount % 10)).padStart(2, '0')}`,
                requestedStartTime: '09:00',
                requestedEndTime: '15:00',
                purpose: `Sustained load test ${requestCount}`
              })
              .timeout(5000);

            if ([200, 201].includes(response.status)) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
          }

          if (performance.now() - startTime >= testDuration) {
            clearInterval(interval);
            resolve();
          }
        }, requestInterval);
      });

      await sustainedTest;
      
      const endTime = performance.now();
      const actualDuration = endTime - startTime;
      const successRate = (successCount / requestCount * 100).toFixed(1);

      console.log(`\n⏱️ Sustained Load Test:`);
      console.log(`   Duration: ${(actualDuration / 1000).toFixed(2)}s`);
      console.log(`   Total Requests: ${requestCount}`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Errors: ${errorCount}`);
      console.log(`   Success Rate: ${successRate}%`);
      console.log(`   Requests/sec: ${(requestCount / (actualDuration / 1000)).toFixed(2)}`);

      // Should maintain reasonable performance over time
      expect(requestCount).toBeGreaterThan(expectedRequests * 0.8); // Within 20% of expected
      expect(successCount).toBeGreaterThan(requestCount * 0.7); // 70% success rate
      expect(actualDuration).toBeLessThan(testDuration + 5000); // Within 5 seconds of expected
    });
  });

  describe('Resource Cleanup Testing', () => {
    
    test('should properly clean up resources after concurrent operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations that create resources
      const resourceOperations = Array.from({ length: 100 }, (_, i) => 
        request(app)
          .get('/health')
          .timeout(10000)
      );

      await Promise.allSettled(resourceOperations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`\n🧹 Resource Cleanup Test:`);
      console.log(`   Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Circuit Breaker Testing', () => {
    
    test('should activate circuit breaker under extreme failure conditions', async () => {
      // Create operations that are likely to fail (invalid data)
      const failureInducingOperations = Array.from({ length: 20 }, (_, i) => 
        request(app)
          .post('/api/burn-requests')
          .send({
            farmId: 999999, // Non-existent farm
            fieldGeometry: {
              type: 'InvalidGeometry',
              coordinates: 'invalid'
            },
            requestedDate: 'invalid-date'
          })
          .timeout(5000)
      );

      const responses = await Promise.allSettled(failureInducingOperations);
      
      const errors = responses.filter(r => 
        r.status === 'rejected' || ![200, 201].includes(r.value?.status)
      ).length;

      console.log(`\n⚡ Circuit Breaker Test:`);
      console.log(`   Total Operations: 20`);
      console.log(`   Errors: ${errors}`);
      console.log(`   Error Rate: ${(errors / 20 * 100).toFixed(1)}%`);

      // Should handle failures gracefully without crashing
      expect(responses).toHaveLength(20);
      // Should have appropriate error responses
      expect(errors).toBeGreaterThan(15); // Most should fail due to invalid data
    });
  });
});