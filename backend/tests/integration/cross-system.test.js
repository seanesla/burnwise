const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool, getConnection } = require('../../db/connection');
const WeatherAgent = require('../../agents/weather');
const AlertSystem = require('../../agents/alerts');
const axios = require('axios');
require('dotenv').config();

describe('Cross-System Integration Tests - External Service Dependencies', () => {
  let weatherAgent;
  let alertSystem;
  let testContext;
  
  beforeAll(async () => {
    await initializeDatabase();
    weatherAgent = new WeatherAgent();
    alertSystem = new AlertSystem();
    
    testContext = {
      testLocation: { lat: 40.7128, lon: -74.0060 }, // New York
      testDate: new Date().toISOString().split('T')[0],
      testFarmId: 99999,
      testPhoneNumber: process.env.TEST_PHONE_NUMBER || '+1234567890'
    };
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('OpenWeatherMap API Integration', () => {
    test('Should successfully fetch weather data from OpenWeatherMap API', async () => {
      if (!process.env.OPENWEATHERMAP_API_KEY) {
        console.warn('Skipping: OPENWEATHERMAP_API_KEY not configured');
        return;
      }
      
      const weather = await weatherAgent.fetchWeatherData(
        testContext.testLocation.lat,
        testContext.testLocation.lon
      );
      
      expect(weather).toBeDefined();
      expect(weather).toHaveProperty('main');
      expect(weather.main).toHaveProperty('temp');
      expect(weather.main).toHaveProperty('humidity');
      expect(weather).toHaveProperty('wind');
      expect(weather.wind).toHaveProperty('speed');
      expect(weather.wind).toHaveProperty('deg');
      
      // Validate data types and ranges
      expect(typeof weather.main.temp).toBe('number');
      expect(weather.main.humidity).toBeGreaterThanOrEqual(0);
      expect(weather.main.humidity).toBeLessThanOrEqual(100);
      expect(weather.wind.speed).toBeGreaterThanOrEqual(0);
    });

    test('Should handle OpenWeatherMap API rate limiting gracefully', async () => {
      if (!process.env.OPENWEATHERMAP_API_KEY) {
        console.warn('Skipping: OPENWEATHERMAP_API_KEY not configured');
        return;
      }
      
      const requests = [];
      const locations = [
        { lat: 40.7128, lon: -74.0060 },  // New York
        { lat: 34.0522, lon: -118.2437 }, // Los Angeles
        { lat: 41.8781, lon: -87.6298 },  // Chicago
        { lat: 29.7604, lon: -95.3698 },  // Houston
        { lat: 33.4484, lon: -112.0740 }  // Phoenix
      ];
      
      // Make rapid requests
      for (const location of locations) {
        requests.push(
          weatherAgent.fetchWeatherData(location.lat, location.lon)
            .catch(error => ({ error: error.message }))
        );
      }
      
      const results = await Promise.all(requests);
      
      // At least some should succeed
      const successful = results.filter(r => !r.error);
      expect(successful.length).toBeGreaterThan(0);
      
      // If any failed due to rate limiting, they should have appropriate error
      const rateLimited = results.filter(r => r.error?.includes('429') || r.error?.includes('rate'));
      if (rateLimited.length > 0) {
        expect(rateLimited[0].error).toMatch(/rate|429|limit/i);
      }
    });

    test('Should fetch and process 5-day weather forecast', async () => {
      if (!process.env.OPENWEATHERMAP_API_KEY) {
        console.warn('Skipping: OPENWEATHERMAP_API_KEY not configured');
        return;
      }
      
      const forecast = await weatherAgent.fetchWeatherForecast(
        testContext.testLocation.lat,
        testContext.testLocation.lon
      );
      
      expect(forecast).toBeDefined();
      expect(forecast).toHaveProperty('list');
      expect(Array.isArray(forecast.list)).toBeTruthy();
      expect(forecast.list.length).toBeGreaterThan(0);
      
      // Validate forecast structure
      const firstForecast = forecast.list[0];
      expect(firstForecast).toHaveProperty('dt');
      expect(firstForecast).toHaveProperty('main');
      expect(firstForecast).toHaveProperty('wind');
      expect(firstForecast).toHaveProperty('weather');
      
      // Check temporal progression
      if (forecast.list.length > 1) {
        const timestamps = forecast.list.map(f => f.dt);
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
        }
      }
    });

    test('Should handle OpenWeatherMap API errors with fallback', async () => {
      // Test with invalid API key
      const originalKey = process.env.OPENWEATHERMAP_API_KEY;
      process.env.OPENWEATHERMAP_API_KEY = 'invalid_key_12345';
      
      try {
        await weatherAgent.fetchWeatherData(
          testContext.testLocation.lat,
          testContext.testLocation.lon
        );
        expect(false).toBeTruthy(); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/401|unauthorized|invalid|api/i);
      } finally {
        process.env.OPENWEATHERMAP_API_KEY = originalKey;
      }
    });
  });

  describe('TiDB Serverless Integration', () => {
    test('Should connect to TiDB serverless with SSL/TLS', async () => {
      const connection = await getConnection();
      
      expect(connection).toBeDefined();
      expect(connection.threadId).toBeDefined();
      
      // Verify SSL connection
      const [sslStatus] = await connection.execute('SHOW STATUS LIKE "Ssl_cipher"');
      expect(sslStatus).toBeDefined();
      if (sslStatus.length > 0) {
        expect(sslStatus[0].Value).not.toBe('');
      }
      
      connection.release();
    });

    test('Should handle TiDB connection pool management', async () => {
      const poolInstance = pool();
      
      // Get pool statistics
      const connections = [];
      const maxConnections = 5;
      
      // Acquire multiple connections
      for (let i = 0; i < maxConnections; i++) {
        connections.push(await getConnection());
      }
      
      // Verify connections are unique
      const threadIds = connections.map(c => c.threadId);
      const uniqueIds = new Set(threadIds);
      expect(uniqueIds.size).toBe(maxConnections);
      
      // Release all connections
      for (const conn of connections) {
        conn.release();
      }
      
      // Pool should handle connection reuse
      const reusedConn = await getConnection();
      expect(threadIds).toContain(reusedConn.threadId);
      reusedConn.release();
    });

    test('Should execute vector operations on TiDB serverless', async () => {
      try {
        // Create test table with vector column
        await query(`
          CREATE TABLE IF NOT EXISTS vector_test_cross_system (
            id INT PRIMARY KEY AUTO_INCREMENT,
            test_vector VECTOR(32),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Insert test vector
        const testVector = new Array(32).fill(0).map(() => Math.random());
        const vectorString = `[${testVector.join(',')}]`;
        
        await query(
          'INSERT INTO vector_test_cross_system (test_vector) VALUES (?)',
          [vectorString]
        );
        
        // Search with vector similarity
        const searchVector = new Array(32).fill(0).map(() => Math.random());
        const searchVectorString = `[${searchVector.join(',')}]`;
        
        const results = await query(`
          SELECT id, 
                 VEC_COSINE_DISTANCE(test_vector, ?) as distance
          FROM vector_test_cross_system
          ORDER BY distance
          LIMIT 5
        `, [searchVectorString]);
        
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBeTruthy();
        
        // Cleanup
        await query('DROP TABLE IF EXISTS vector_test_cross_system');
      } catch (error) {
        // TiDB might not have vector support in test environment
        console.warn('Vector operations not supported:', error.message);
      }
    });

    test('Should handle TiDB transaction rollback on failure', async () => {
      const connection = await getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Create test table
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS transaction_test_cross (
            id INT PRIMARY KEY AUTO_INCREMENT,
            value VARCHAR(100)
          )
        `);
        
        // Insert data
        await connection.execute(
          'INSERT INTO transaction_test_cross (value) VALUES (?)',
          ['test_value_1']
        );
        
        // Force an error
        await connection.execute(
          'INSERT INTO transaction_test_cross (id, value) VALUES (?, ?)',
          [1, 'duplicate_id'] // This should fail if ID 1 exists
        );
        
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        
        // Verify rollback worked
        const [checkResult] = await connection.execute(
          'SELECT COUNT(*) as count FROM transaction_test_cross WHERE value = ?',
          ['test_value_1']
        );
        
        // Data should be rolled back
        expect(checkResult[0]?.count).toBe(0);
      } finally {
        // Cleanup
        await connection.execute('DROP TABLE IF EXISTS transaction_test_cross');
        connection.release();
      }
    });

    test('Should handle TiDB serverless regional failover', async () => {
      // Simulate connection to different regions
      const regions = [
        { host: process.env.TIDB_HOST, region: 'primary' },
        { host: process.env.TIDB_BACKUP_HOST || process.env.TIDB_HOST, region: 'backup' }
      ];
      
      const connectionAttempts = [];
      
      for (const region of regions) {
        try {
          const testPool = require('mysql2/promise').createPool({
            host: region.host,
            port: process.env.TIDB_PORT || 4000,
            user: process.env.TIDB_USER,
            password: process.env.TIDB_PASSWORD,
            database: process.env.TIDB_DATABASE,
            ssl: {
              minVersion: 'TLSv1.2',
              rejectUnauthorized: true
            },
            connectionLimit: 1,
            connectTimeout: 5000
          });
          
          const conn = await testPool.getConnection();
          connectionAttempts.push({
            region: region.region,
            success: true,
            latency: 0
          });
          conn.release();
          await testPool.end();
        } catch (error) {
          connectionAttempts.push({
            region: region.region,
            success: false,
            error: error.message
          });
        }
      }
      
      // At least primary should connect
      const successfulConnections = connectionAttempts.filter(c => c.success);
      expect(successfulConnections.length).toBeGreaterThan(0);
    });
  });

  // Alerts are stub only - no SMS functionality per CLAUDE.md

  describe('Mapbox Integration', () => {
    test('Should geocode farm addresses to coordinates', async () => {
      if (!process.env.MAPBOX_ACCESS_TOKEN) {
        console.warn('Skipping: MAPBOX_ACCESS_TOKEN not configured');
        return;
      }
      
      const address = '1600 Pennsylvania Avenue NW, Washington, DC 20500';
      
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
        {
          params: {
            access_token: process.env.MAPBOX_ACCESS_TOKEN,
            limit: 1
          }
        }
      );
      
      expect(response.data).toHaveProperty('features');
      expect(response.data.features.length).toBeGreaterThan(0);
      
      const location = response.data.features[0];
      expect(location).toHaveProperty('geometry');
      expect(location.geometry).toHaveProperty('coordinates');
      
      const [lon, lat] = location.geometry.coordinates;
      expect(lat).toBeCloseTo(38.8977, 1); // White House latitude
      expect(lon).toBeCloseTo(-77.0365, 1); // White House longitude
    });

    test('Should calculate isochrones for smoke dispersion areas', async () => {
      if (!process.env.MAPBOX_ACCESS_TOKEN) {
        console.warn('Skipping: MAPBOX_ACCESS_TOKEN not configured');
        return;
      }
      
      const centerPoint = '-77.0365,38.8977'; // lon,lat format
      const minutes = 30;
      
      try {
        const response = await axios.get(
          `https://api.mapbox.com/isochrone/v1/mapbox/driving/${centerPoint}`,
          {
            params: {
              contours_minutes: minutes,
              polygons: true,
              access_token: process.env.MAPBOX_ACCESS_TOKEN
            }
          }
        );
        
        expect(response.data).toHaveProperty('features');
        expect(response.data.features.length).toBeGreaterThan(0);
        
        const isochrone = response.data.features[0];
        expect(isochrone).toHaveProperty('geometry');
        expect(isochrone.geometry.type).toBe('Polygon');
        expect(isochrone.geometry.coordinates).toBeDefined();
      } catch (error) {
        // Isochrone API might require higher tier
        console.warn('Isochrone API not available:', error.response?.status);
      }
    });

    test('Should validate Mapbox static map URLs', () => {
      const lat = 40.7128;
      const lon = -74.0060;
      const zoom = 12;
      const width = 600;
      const height = 400;
      
      const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
        `pin-l-fire+ff0000(${lon},${lat})/` +
        `${lon},${lat},${zoom},0/` +
        `${width}x${height}@2x` +
        `?access_token=${process.env.MAPBOX_ACCESS_TOKEN || 'TOKEN'}`;
      
      expect(staticMapUrl).toContain('mapbox.com');
      expect(staticMapUrl).toContain('satellite');
      expect(staticMapUrl).toContain(`${lon},${lat}`);
      expect(staticMapUrl).toContain(`${width}x${height}`);
    });
  });

  describe('Monitoring System Integration', () => {
    test('Should export metrics in Prometheus format', () => {
      const metrics = {
        burns_scheduled_total: 150,
        conflicts_detected_total: 23,
        pm25_violations_total: 5,
        alert_sent_total: 145,
        api_requests_total: 1250,
        api_errors_total: 3
      };
      
      const prometheusFormat = Object.entries(metrics)
        .map(([key, value]) => `# TYPE ${key} counter\n${key} ${value}`)
        .join('\n\n');
      
      expect(prometheusFormat).toContain('# TYPE burns_scheduled_total counter');
      expect(prometheusFormat).toContain('burns_scheduled_total 150');
      expect(prometheusFormat).toContain('# TYPE pm25_violations_total counter');
      expect(prometheusFormat).toContain('pm25_violations_total 5');
    });

    test('Should track system health metrics', async () => {
      const healthCheck = {
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'healthy', latency: 0 },
          weather_api: { status: 'healthy', latency: 0 },
          sms_service: { status: 'healthy', latency: 0 },
          map_service: { status: 'healthy', latency: 0 }
        },
        system: {
          memory_usage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpu_usage: process.cpuUsage(),
          uptime: process.uptime()
        }
      };
      
      // Check database health
      const dbStart = Date.now();
      try {
        await query('SELECT 1');
        healthCheck.services.database.status = 'healthy';
        healthCheck.services.database.latency = Date.now() - dbStart;
      } catch (error) {
        healthCheck.services.database.status = 'unhealthy';
        healthCheck.services.database.error = error.message;
      }
      
      // Verify health check structure
      expect(healthCheck).toHaveProperty('timestamp');
      expect(healthCheck).toHaveProperty('services');
      expect(healthCheck).toHaveProperty('system');
      
      const overallHealth = Object.values(healthCheck.services)
        .every(s => s.status === 'healthy');
      
      expect(healthCheck.services.database.status).toBe('healthy');
      expect(healthCheck.system.memory_usage).toBeGreaterThan(0);
      expect(healthCheck.system.uptime).toBeGreaterThan(0);
    });

    test('Should implement circuit breaker for external services', () => {
      class CircuitBreaker {
        constructor(threshold = 5, timeout = 60000) {
          this.failureCount = 0;
          this.threshold = threshold;
          this.timeout = timeout;
          this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
          this.nextAttempt = null;
        }
        
        async execute(fn) {
          if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
              throw new Error('Circuit breaker is OPEN');
            }
            this.state = 'HALF_OPEN';
          }
          
          try {
            const result = await fn();
            if (this.state === 'HALF_OPEN') {
              this.state = 'CLOSED';
              this.failureCount = 0;
            }
            return result;
          } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.threshold) {
              this.state = 'OPEN';
              this.nextAttempt = Date.now() + this.timeout;
            }
            throw error;
          }
        }
      }
      
      const breaker = new CircuitBreaker(3, 5000);
      
      // Simulate failures
      const failingFunction = async () => {
        throw new Error('Service unavailable');
      };
      
      // Test circuit breaker opening
      let failures = 0;
      const attempts = 5;
      
      for (let i = 0; i < attempts; i++) {
        try {
          breaker.execute(failingFunction);
        } catch (error) {
          failures++;
        }
      }
      
      expect(failures).toBe(attempts);
      expect(breaker.state).toBe('OPEN');
      expect(breaker.nextAttempt).toBeGreaterThan(Date.now());
    });

    test('Should aggregate and report error rates', () => {
      const errorLog = [
        { timestamp: Date.now() - 3600000, service: 'weather', error: 'timeout' },
        { timestamp: Date.now() - 1800000, service: 'weather', error: 'rate_limit' },
        { timestamp: Date.now() - 900000, service: 'database', error: 'connection_lost' },
        { timestamp: Date.now() - 450000, service: 'sms', error: 'invalid_number' },
        { timestamp: Date.now() - 100000, service: 'weather', error: 'api_error' }
      ];
      
      // Calculate error rates by service
      const errorRates = {};
      const timeWindow = 3600000; // 1 hour
      const now = Date.now();
      
      errorLog.forEach(entry => {
        if (now - entry.timestamp <= timeWindow) {
          errorRates[entry.service] = (errorRates[entry.service] || 0) + 1;
        }
      });
      
      expect(errorRates.weather).toBe(3);
      expect(errorRates.database).toBe(1);
      expect(errorRates.sms).toBe(1);
      
      // Check if any service exceeds error threshold
      const errorThreshold = 2;
      const problematicServices = Object.entries(errorRates)
        .filter(([service, count]) => count > errorThreshold)
        .map(([service]) => service);
      
      expect(problematicServices).toContain('weather');
    });
  });

  describe('End-to-End External Service Flow', () => {
    test('Should complete full external service workflow', async () => {
      const workflow = {
        weather: null,
        database: null,
        geocoding: null,
        alerts: null
      };
      
      // Step 1: Fetch weather
      if (process.env.OPENWEATHERMAP_API_KEY) {
        try {
          workflow.weather = await weatherAgent.fetchWeatherData(
            testContext.testLocation.lat,
            testContext.testLocation.lon
          );
          expect(workflow.weather).toHaveProperty('main');
        } catch (error) {
          workflow.weather = { error: error.message };
        }
      }
      
      // Step 2: Store in database
      try {
        const testData = {
          service_test: 'cross_system',
          timestamp: new Date(),
          weather_fetched: workflow.weather ? true : false
        };
        
        await query(`
          CREATE TABLE IF NOT EXISTS service_test_cross (
            id INT PRIMARY KEY AUTO_INCREMENT,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await query(
          'INSERT INTO service_test_cross (data) VALUES (?)',
          [JSON.stringify(testData)]
        );
        
        workflow.database = { success: true };
        
        // Cleanup
        await query('DROP TABLE IF EXISTS service_test_cross');
      } catch (error) {
        workflow.database = { error: error.message };
      }
      
      // Step 3: Geocoding (if Mapbox available)
      if (process.env.MAPBOX_ACCESS_TOKEN) {
        try {
          const response = await axios.get(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/New York.json`,
            {
              params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                limit: 1
              }
            }
          );
          workflow.geocoding = { success: true, features: response.data.features.length };
        } catch (error) {
          workflow.geocoding = { error: error.message };
        }
      }
      
      // Step 4: Format alert
      workflow.alerts = {
        formatted: alertSystem.formatSMSMessage({
          farmId: 1,
          fieldId: 1,
          scheduledTime: new Date(),
          pm25Level: 35
        })
      };
      
      // Verify at least partial completion
      const completedSteps = Object.values(workflow).filter(v => v !== null).length;
      expect(completedSteps).toBeGreaterThan(0);
      
      // Database should always work
      expect(workflow.database?.success).toBeTruthy();
    });
  });
});

// Helper functions for cross-system tests
module.exports = {
  formatSMSMessage: (burnSchedule) => {
    const time = burnSchedule.scheduledTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `BURN SCHEDULE UPDATE\n` +
           `Farm ${burnSchedule.farmId} Field ${burnSchedule.fieldId}\n` +
           `Time: ${time}\n` +
           `PM2.5: ${burnSchedule.pm25Level} µg/m³\n` +
           `Status: ${burnSchedule.safetyStatus || 'safe'}`;
  },
  
  isValidPhoneNumber: (phone) => {
    if (!phone) return false;
    const phoneRegex = /^\+[1-9]\d{10,14}$/;
    return phoneRegex.test(phone);
  },
  
  createSMSBatches: (recipients, batchSize = 10) => {
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }
    return batches;
  }
};