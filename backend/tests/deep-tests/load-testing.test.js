/**
 * LOAD TESTING WITH REAL DATABASE OPERATIONS
 * Tests system performance under various load conditions
 * Measures throughput, latency, and resource utilization
 */

require('dotenv').config({ path: '../../.env' });
const { initializeDatabase, query } = require('../../db/connection');
const coordinatorAgent = require('../../agents/coordinator');
const weatherAgent = require('../../agents/weather');
const predictorAgent = require('../../agents/predictor');
const optimizerAgent = require('../../agents/optimizer');
const alertsAgent = require('../../agents/alerts');
const os = require('os');

class LoadTester {
  constructor() {
    this.metrics = {
      requests: 0,
      successful: 0,
      failed: 0,
      latencies: [],
      throughput: [],
      errors: [],
      resourceUsage: [],
      startTime: null,
      endTime: null
    };
  }

  async measureLatency(operation) {
    const start = process.hrtime.bigint();
    try {
      const result = await operation();
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1e6;
      this.metrics.latencies.push(latencyMs);
      this.metrics.successful++;
      return { success: true, latency: latencyMs, result };
    } catch (error) {
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1e6;
      this.metrics.failed++;
      this.metrics.errors.push(error.message);
      return { success: false, latency: latencyMs, error: error.message };
    } finally {
      this.metrics.requests++;
    }
  }

  captureResourceUsage() {
    const usage = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      loadAvg: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    };
    this.metrics.resourceUsage.push(usage);
    return usage;
  }

  calculateStatistics() {
    const latencies = this.metrics.latencies.sort((a, b) => a - b);
    const count = latencies.length;
    
    if (count === 0) return null;

    const sum = latencies.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const p50 = latencies[Math.floor(count * 0.5)];
    const p90 = latencies[Math.floor(count * 0.9)];
    const p95 = latencies[Math.floor(count * 0.95)];
    const p99 = latencies[Math.floor(count * 0.99)];
    const min = latencies[0];
    const max = latencies[count - 1];

    const duration = (this.metrics.endTime - this.metrics.startTime) / 1000;
    const throughput = this.metrics.requests / duration;
    const successRate = (this.metrics.successful / this.metrics.requests) * 100;

    return {
      latency: {
        mean: mean.toFixed(2),
        median: p50.toFixed(2),
        p90: p90.toFixed(2),
        p95: p95.toFixed(2),
        p99: p99.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2)
      },
      throughput: throughput.toFixed(2),
      successRate: successRate.toFixed(2),
      totalRequests: this.metrics.requests,
      successful: this.metrics.successful,
      failed: this.metrics.failed,
      duration: duration.toFixed(2)
    };
  }

  printReport() {
    const stats = this.calculateStatistics();
    if (!stats) {
      console.log('No data to report');
      return;
    }

    console.log('\n📊 LOAD TEST REPORT');
    console.log('═'.repeat(50));
    console.log(`\n⏱️  Duration: ${stats.duration}s`);
    console.log(`📈 Total Requests: ${stats.totalRequests}`);
    console.log(`✅ Successful: ${stats.successful} (${stats.successRate}%)`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`🚀 Throughput: ${stats.throughput} req/s`);
    console.log('\n📏 Latency (ms):');
    console.log(`   Mean: ${stats.latency.mean}`);
    console.log(`   Median (p50): ${stats.latency.median}`);
    console.log(`   p90: ${stats.latency.p90}`);
    console.log(`   p95: ${stats.latency.p95}`);
    console.log(`   p99: ${stats.latency.p99}`);
    console.log(`   Min: ${stats.latency.min}`);
    console.log(`   Max: ${stats.latency.max}`);

    if (this.metrics.resourceUsage.length > 0) {
      const lastUsage = this.metrics.resourceUsage[this.metrics.resourceUsage.length - 1];
      const memUsedMB = (lastUsage.memory.heapUsed / 1024 / 1024).toFixed(2);
      const memTotalMB = (lastUsage.memory.heapTotal / 1024 / 1024).toFixed(2);
      console.log('\n💾 Resource Usage:');
      console.log(`   Heap Used: ${memUsedMB}MB / ${memTotalMB}MB`);
      console.log(`   Load Average: ${lastUsage.loadAvg.map(l => l.toFixed(2)).join(', ')}`);
    }

    if (this.metrics.errors.length > 0) {
      console.log('\n⚠️  Top Errors:');
      const errorCounts = {};
      this.metrics.errors.forEach(err => {
        errorCounts[err] = (errorCounts[err] || 0) + 1;
      });
      Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`   ${error}: ${count} occurrences`);
        });
    }

    return stats;
  }
}

describe('Load Testing with Real Database Operations', () => {
  let dbInitialized = false;

  beforeAll(async () => {
    console.log('🚀 Initializing database for load testing...');
    try {
      await initializeDatabase();
      dbInitialized = true;
      console.log('✅ Database ready for load testing');
    } catch (error) {
      console.error('Failed to initialize:', error);
      throw error;
    }
  }, 30000);

  describe('1. Database Query Load Tests', () => {
    test('should handle concurrent SELECT queries', async () => {
      const tester = new LoadTester();
      const concurrency = 50;
      const iterations = 5;

      tester.metrics.startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const promises = [];
        
        for (let j = 0; j < concurrency; j++) {
          promises.push(
            tester.measureLatency(async () => {
              return query('SELECT * FROM burn_requests LIMIT 10');
            })
          );
        }

        await Promise.all(promises);
        tester.captureResourceUsage();
      }

      tester.metrics.endTime = Date.now();
      const stats = tester.printReport();

      expect(stats.successRate).toBeGreaterThan(95);
      expect(parseFloat(stats.latency.p95)).toBeLessThan(1000); // p95 < 1 second
    }, 60000);

    test('should handle concurrent INSERT operations', async () => {
      const tester = new LoadTester();
      const concurrency = 20;
      const iterations = 3;

      tester.metrics.startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const promises = [];
        
        for (let j = 0; j < concurrency; j++) {
          promises.push(
            tester.measureLatency(async () => {
              const testData = {
                field_id: `load_test_${Date.now()}_${Math.random()}`,
                requested_date: new Date(Date.now() + 86400000),
                requested_acreage: Math.floor(Math.random() * 500) + 50,
                requester_name: `Load Tester ${i}-${j}`,
                requester_phone: `555-${Math.floor(Math.random() * 10000)}`,
                request_status: 'pending'
              };

              return query(
                `INSERT INTO burn_requests (field_id, requested_date, requested_acreage, 
                 requester_name, requester_phone, request_status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                Object.values(testData)
              );
            })
          );
        }

        await Promise.all(promises);
        tester.captureResourceUsage();
      }

      tester.metrics.endTime = Date.now();
      const stats = tester.printReport();

      expect(stats.successRate).toBeGreaterThan(90);
      expect(parseFloat(stats.throughput)).toBeGreaterThan(10); // > 10 req/s
    }, 60000);

    test('should handle mixed read/write workload', async () => {
      const tester = new LoadTester();
      const totalOperations = 100;
      const readRatio = 0.8; // 80% reads, 20% writes

      tester.metrics.startTime = Date.now();

      const promises = [];
      for (let i = 0; i < totalOperations; i++) {
        const isRead = Math.random() < readRatio;
        
        if (isRead) {
          promises.push(
            tester.measureLatency(async () => {
              return query('SELECT COUNT(*) as count FROM burn_requests WHERE request_status = ?', ['pending']);
            })
          );
        } else {
          promises.push(
            tester.measureLatency(async () => {
              return query(
                `UPDATE burn_requests SET priority_score = ? 
                 WHERE request_id = (SELECT request_id FROM burn_requests LIMIT 1)`,
                [Math.floor(Math.random() * 100)]
              );
            })
          );
        }
      }

      await Promise.all(promises);
      tester.metrics.endTime = Date.now();
      
      const stats = tester.printReport();
      expect(stats.successRate).toBeGreaterThan(85);
    }, 60000);
  });

  describe('2. Agent Processing Load Tests', () => {
    test('should handle concurrent burn request validations', async () => {
      const tester = new LoadTester();
      const concurrency = 10;
      const iterations = 5;

      tester.metrics.startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const promises = [];
        
        for (let j = 0; j < concurrency; j++) {
          const request = {
            field_id: `load_field_${i}_${j}`,
            requested_acreage: Math.floor(Math.random() * 400) + 50,
            requested_date: new Date(Date.now() + 86400000 * (j + 1)),
            requester_name: `Load Test ${i}-${j}`,
            requester_phone: '555-0000'
          };

          promises.push(
            tester.measureLatency(async () => {
              return coordinatorAgent.validateBurnRequest(request);
            })
          );
        }

        await Promise.all(promises);
        tester.captureResourceUsage();
      }

      tester.metrics.endTime = Date.now();
      const stats = tester.printReport();

      expect(stats.successRate).toBeGreaterThan(80);
      expect(parseFloat(stats.latency.median)).toBeLessThan(500);
    }, 60000);

    test('should handle concurrent weather analyses', async () => {
      const tester = new LoadTester();
      const locations = [
        { lat: 37.5, lng: -120.5 },
        { lat: 36.7, lng: -119.8 },
        { lat: 38.2, lng: -121.3 },
        { lat: 37.0, lng: -120.0 },
        { lat: 36.5, lng: -119.5 }
      ];
      const concurrency = 5;
      const iterations = 3;

      tester.metrics.startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const promises = [];
        
        for (let j = 0; j < concurrency; j++) {
          const location = locations[j % locations.length];
          promises.push(
            tester.measureLatency(async () => {
              return weatherAgent.analyzeWeatherConditions(
                location.lat,
                location.lng,
                new Date(Date.now() + 86400000)
              );
            })
          );
        }

        await Promise.all(promises);
        tester.captureResourceUsage();
      }

      tester.metrics.endTime = Date.now();
      const stats = tester.printReport();

      expect(stats.totalRequests).toBe(concurrency * iterations);
      expect(parseFloat(stats.latency.p90)).toBeLessThan(2000);
    }, 60000);

    test('should handle concurrent smoke predictions', async () => {
      const tester = new LoadTester();
      const concurrency = 15;

      tester.metrics.startTime = Date.now();

      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        const params = {
          emission_rate: 100 + Math.random() * 900,
          wind_speed: 1 + Math.random() * 19,
          wind_direction: Math.floor(Math.random() * 360),
          stability_class: ['stable', 'neutral', 'unstable'][Math.floor(Math.random() * 3)],
          stack_height: 2 + Math.random() * 8,
          temperature: 10 + Math.random() * 30
        };

        promises.push(
          tester.measureLatency(async () => {
            return predictorAgent.calculateGaussianPlume(params);
          })
        );
      }

      await Promise.all(promises);
      tester.metrics.endTime = Date.now();
      
      const stats = tester.printReport();
      expect(stats.successRate).toBeGreaterThan(95);
      expect(parseFloat(stats.latency.mean)).toBeLessThan(100); // Should be fast
    }, 30000);
  });

  describe('3. Full Workflow Load Tests', () => {
    test('should handle multiple complete 5-agent workflows', async () => {
      const tester = new LoadTester();
      const workflows = 10;

      tester.metrics.startTime = Date.now();

      const promises = [];
      for (let i = 0; i < workflows; i++) {
        promises.push(
          tester.measureLatency(async () => {
            // 1. Create burn request
            const request = {
              field_id: `workflow_field_${Date.now()}_${i}`,
              requested_acreage: 100 + i * 10,
              requested_date: new Date(Date.now() + 86400000 * (i + 1)),
              requester_name: `Workflow Test ${i}`,
              requester_phone: '555-1000',
              latitude: 37 + i * 0.1,
              longitude: -120 - i * 0.1
            };

            // 2. Validate
            const validation = await coordinatorAgent.validateBurnRequest(request);
            
            // 3. Weather analysis
            const weather = await weatherAgent.analyzeWeatherConditions(
              request.latitude,
              request.longitude,
              request.requested_date
            );

            // 4. Smoke prediction
            const smoke = await predictorAgent.calculateGaussianPlume({
              emission_rate: request.requested_acreage * 10,
              wind_speed: weather.windSpeed || 5,
              wind_direction: weather.windDirection || 180,
              stability_class: weather.stability || 'neutral',
              stack_height: 2,
              temperature: weather.temperature || 20
            });

            // 5. Optimization
            const optimization = await optimizerAgent.optimizeSchedule({
              newRequest: { ...request, ...smoke },
              existingBurns: [],
              weatherForecast: weather
            });

            // 6. Alert check
            if (optimization.conflictScore > 50) {
              await alertsAgent.createAlert({
                farm_id: `workflow_farm_${i}`,
                burn_request_id: i,
                alert_type: 'conflict',
                severity: 'medium',
                message: `Workflow test alert ${i}`
              });
            }

            return {
              validation,
              weather,
              smoke,
              optimization
            };
          })
        );
      }

      const results = await Promise.all(promises);
      tester.metrics.endTime = Date.now();
      
      const stats = tester.printReport();
      
      // Full workflow should complete
      expect(stats.successRate).toBeGreaterThan(70);
      expect(results.filter(r => r.success).length).toBeGreaterThan(workflows * 0.7);
    }, 120000); // 2 minute timeout
  });

  describe('4. Spike Load Tests', () => {
    test('should handle sudden traffic spikes', async () => {
      const tester = new LoadTester();
      
      // Normal load
      const normalLoad = 5;
      // Spike load (10x normal)
      const spikeLoad = 50;

      tester.metrics.startTime = Date.now();

      // Phase 1: Normal load
      console.log('Phase 1: Normal load...');
      let promises = [];
      for (let i = 0; i < normalLoad; i++) {
        promises.push(
          tester.measureLatency(async () => {
            return query('SELECT 1');
          })
        );
      }
      await Promise.all(promises);
      const normalMetrics = { ...tester.metrics };

      // Phase 2: Spike
      console.log('Phase 2: Traffic spike...');
      promises = [];
      for (let i = 0; i < spikeLoad; i++) {
        promises.push(
          tester.measureLatency(async () => {
            return query('SELECT 1');
          })
        );
      }
      await Promise.all(promises);

      // Phase 3: Return to normal
      console.log('Phase 3: Return to normal...');
      promises = [];
      for (let i = 0; i < normalLoad; i++) {
        promises.push(
          tester.measureLatency(async () => {
            return query('SELECT 1');
          })
        );
      }
      await Promise.all(promises);

      tester.metrics.endTime = Date.now();
      const stats = tester.printReport();

      // System should handle spike without crashing
      expect(stats.successRate).toBeGreaterThan(80);
    }, 60000);

    test('should handle sustained high load', async () => {
      const tester = new LoadTester();
      const sustainedLoad = 20;
      const duration = 10000; // 10 seconds
      const interval = 100; // Every 100ms

      tester.metrics.startTime = Date.now();

      const endTime = Date.now() + duration;
      while (Date.now() < endTime) {
        const promises = [];
        for (let i = 0; i < sustainedLoad; i++) {
          promises.push(
            tester.measureLatency(async () => {
              return query('SELECT COUNT(*) FROM burn_requests');
            })
          );
        }
        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, interval));
        tester.captureResourceUsage();
      }

      tester.metrics.endTime = Date.now();
      const stats = tester.printReport();

      // Should maintain performance under sustained load
      expect(stats.successRate).toBeGreaterThan(90);
      expect(parseFloat(stats.latency.p99)).toBeLessThan(2000);
    }, 30000);
  });

  describe('5. Resource Limit Tests', () => {
    test('should handle connection pool exhaustion gracefully', async () => {
      const tester = new LoadTester();
      const connections = 100; // Way more than pool size

      tester.metrics.startTime = Date.now();

      const promises = [];
      for (let i = 0; i < connections; i++) {
        promises.push(
          tester.measureLatency(async () => {
            // Long-running query to hold connection
            return query(
              'SELECT * FROM burn_requests WHERE request_status = ? LIMIT 100',
              ['pending']
            );
          })
        );
      }

      const results = await Promise.all(promises);
      tester.metrics.endTime = Date.now();
      
      const stats = tester.printReport();

      // Some should succeed even with pool exhaustion
      expect(stats.successful).toBeGreaterThan(0);
      expect(stats.failed).toBeGreaterThan(0); // Some expected to fail
      
      // Check for pool exhaustion errors
      const poolErrors = tester.metrics.errors.filter(e => 
        e.includes('connection') || e.includes('pool') || e.includes('timeout')
      );
      console.log(`Pool exhaustion errors: ${poolErrors.length}`);
    }, 60000);

    test('should measure memory usage under load', async () => {
      const tester = new LoadTester();
      const iterations = 50;
      const dataSize = 1000; // Records per iteration

      const initialMemory = process.memoryUsage().heapUsed;
      tester.metrics.startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await tester.measureLatency(async () => {
          // Generate large result set
          const data = await query(
            'SELECT * FROM burn_requests LIMIT ?',
            [dataSize]
          );
          // Process data to ensure it's in memory
          return data.map(row => ({ ...row, processed: true }));
        });

        if (i % 10 === 0) {
          tester.captureResourceUsage();
          if (global.gc) global.gc(); // Force GC if available
        }
      }

      tester.metrics.endTime = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      const stats = tester.printReport();

      // Memory should not grow unbounded
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    }, 60000);
  });

  describe('6. Comparative Load Tests', () => {
    test('should compare performance of different query patterns', async () => {
      const patterns = [
        {
          name: 'Simple SELECT',
          query: 'SELECT * FROM burn_requests LIMIT 10'
        },
        {
          name: 'Aggregation',
          query: 'SELECT COUNT(*), AVG(requested_acreage) FROM burn_requests'
        },
        {
          name: 'JOIN',
          query: `SELECT br.*, f.field_name 
                  FROM burn_requests br 
                  LEFT JOIN burn_fields f ON br.field_id = f.field_id 
                  LIMIT 10`
        },
        {
          name: 'Subquery',
          query: `SELECT * FROM burn_requests 
                  WHERE requested_acreage > (SELECT AVG(requested_acreage) FROM burn_requests)`
        }
      ];

      const results = {};

      for (const pattern of patterns) {
        const tester = new LoadTester();
        const iterations = 20;

        tester.metrics.startTime = Date.now();

        const promises = [];
        for (let i = 0; i < iterations; i++) {
          promises.push(
            tester.measureLatency(async () => {
              return query(pattern.query);
            })
          );
        }

        await Promise.all(promises);
        tester.metrics.endTime = Date.now();

        const stats = tester.calculateStatistics();
        results[pattern.name] = stats;

        console.log(`\n${pattern.name}:`);
        console.log(`  Median: ${stats.latency.median}ms`);
        console.log(`  p95: ${stats.latency.p95}ms`);
      }

      // Simple SELECT should be fastest
      expect(parseFloat(results['Simple SELECT'].latency.median))
        .toBeLessThan(parseFloat(results['Subquery'].latency.median));
    }, 90000);
  });

  describe('7. Endurance Tests', () => {
    test('should maintain performance over extended period', async () => {
      const tester = new LoadTester();
      const duration = 30000; // 30 seconds
      const requestsPerSecond = 10;
      const checkpoints = [];

      tester.metrics.startTime = Date.now();
      const endTime = Date.now() + duration;

      let checkpoint = 0;
      while (Date.now() < endTime) {
        const batchStart = Date.now();
        const promises = [];

        for (let i = 0; i < requestsPerSecond; i++) {
          promises.push(
            tester.measureLatency(async () => {
              return query('SELECT NOW()');
            })
          );
        }

        await Promise.all(promises);

        // Capture checkpoint every 10 seconds
        if (Date.now() - tester.metrics.startTime > (checkpoint + 1) * 10000) {
          checkpoint++;
          const stats = tester.calculateStatistics();
          checkpoints.push({
            time: checkpoint * 10,
            stats: { ...stats }
          });
          console.log(`Checkpoint ${checkpoint}: p95=${stats.latency.p95}ms`);
        }

        // Wait for next second
        const elapsed = Date.now() - batchStart;
        if (elapsed < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
        }
      }

      tester.metrics.endTime = Date.now();
      const finalStats = tester.printReport();

      // Performance should not degrade significantly over time
      if (checkpoints.length >= 2) {
        const firstP95 = parseFloat(checkpoints[0].stats.latency.p95);
        const lastP95 = parseFloat(checkpoints[checkpoints.length - 1].stats.latency.p95);
        const degradation = ((lastP95 - firstP95) / firstP95) * 100;
        
        console.log(`Performance degradation: ${degradation.toFixed(2)}%`);
        expect(Math.abs(degradation)).toBeLessThan(50); // Less than 50% degradation
      }

      expect(finalStats.successRate).toBeGreaterThan(95);
    }, 60000);
  });

  describe('8. Load Test Summary', () => {
    test('should generate comprehensive load test report', async () => {
      const summary = {
        timestamp: new Date().toISOString(),
        environment: {
          node: process.version,
          platform: os.platform(),
          cpus: os.cpus().length,
          memory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`
        },
        tests: [],
        overall: {
          totalRequests: 0,
          totalSuccess: 0,
          totalFailed: 0,
          avgLatency: 0,
          maxThroughput: 0
        }
      };

      // Run mini load test for summary
      const tester = new LoadTester();
      const operations = 100;

      tester.metrics.startTime = Date.now();

      const promises = [];
      for (let i = 0; i < operations; i++) {
        promises.push(
          tester.measureLatency(async () => {
            const operation = Math.random();
            if (operation < 0.6) {
              return query('SELECT 1');
            } else if (operation < 0.8) {
              return query('SELECT COUNT(*) FROM burn_requests');
            } else {
              return query(
                'INSERT INTO burn_requests (field_id, requested_date, requested_acreage, requester_name, requester_phone, request_status) VALUES (?, ?, ?, ?, ?, ?)',
                [`summary_${Date.now()}`, new Date(), 100, 'Summary', '555-0000', 'pending']
              );
            }
          })
        );
      }

      await Promise.all(promises);
      tester.metrics.endTime = Date.now();

      const stats = tester.calculateStatistics();
      
      summary.tests.push({
        name: 'Mixed Workload',
        ...stats
      });

      summary.overall.totalRequests = stats.totalRequests;
      summary.overall.totalSuccess = stats.successful;
      summary.overall.totalFailed = stats.failed;
      summary.overall.avgLatency = stats.latency.mean;
      summary.overall.maxThroughput = stats.throughput;

      console.log('\n🎯 LOAD TEST SUMMARY');
      console.log('═'.repeat(50));
      console.log(JSON.stringify(summary, null, 2));

      // Save report
      const fs = require('fs').promises;
      await fs.writeFile(
        require('path').join(__dirname, 'load-test-report.json'),
        JSON.stringify(summary, null, 2)
      );

      expect(summary.overall.totalRequests).toBeGreaterThan(0);
      expect(parseFloat(stats.successRate)).toBeGreaterThan(80);
    }, 30000);
  });
});

module.exports = {
  testCount: 20,
  testType: 'load-testing',
  description: 'Load tests with real database operations measuring performance under various conditions'
};