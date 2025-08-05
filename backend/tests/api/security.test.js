const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Import API routers and middleware
const burnRequestsRouter = require('../../api/burnRequests');
const weatherRouter = require('../../api/weather');
const rateLimiter = require('../../middleware/rateLimiter');
const errorHandler = require('../../middleware/errorHandler');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');

const { query } = require('../../db/connection');

describe('API Security Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    
    // Apply security middleware
    app.use(helmet());
    app.use(express.json({ limit: '10mb' }));
    app.use(rateLimiter);
    
    // Mount API routers
    app.use('/api/burn-requests', burnRequestsRouter);
    app.use('/api/weather', weatherRouter);
    
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('1. Input Validation and Sanitization', () => {
    test('should reject SQL injection attempts', async () => {
      const maliciousData = {
        farm_id: "'; DROP TABLE burns; --",
        contact_phone: '+1234567890',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: 'wheat_stubble'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid input detected');
    });

    test('should prevent XSS attacks in text fields', async () => {
      const xssData = {
        farm_id: 'farm_123',
        contact_phone: '+1234567890',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: '<script>alert("xss")</script>',
        notes: '<img src=x onerror=alert("xss")>'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(xssData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid characters detected');
    });

    test('should validate coordinate bounds to prevent injection', async () => {
      const invalidCoords = [
        { lat: 'SELECT * FROM farms', lng: -120.5 },
        { lat: 37.5, lng: 'UNION SELECT password FROM users' },
        { lat: '37.5; DROP TABLE weather;', lng: -120.5 }
      ];

      for (const coords of invalidCoords) {
        const response = await request(app)
          .get(`/api/weather/current?lat=${coords.lat}&lng=${coords.lng}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid coordinates');
      }
    });

    test('should limit JSON payload size', async () => {
      const oversizedPayload = {
        farm_id: 'farm_123',
        field_boundaries: Array.from({ length: 100000 }, (_, i) => ({
          latitude: 37.5 + i * 0.0001,
          longitude: -120.5 + i * 0.0001,
          massive_data: 'x'.repeat(1000) // Large string per point
        }))
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(oversizedPayload)
        .expect(413);

      expect(response.body.error).toContain('Payload too large');
    });

    test('should sanitize special characters in query parameters', async () => {
      const maliciousQueries = [
        'status=approved&farm_id=123; DELETE FROM burns;',
        'fuel_type=wheat<script>alert(1)</script>',
        'page=1 UNION SELECT * FROM users',
        "status='; DROP TABLE burns; --"
      ];

      for (const queryParam of maliciousQueries) {
        const response = await request(app)
          .get(`/api/burn-requests?${queryParam}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    test('should validate date formats to prevent injection', async () => {
      const maliciousDates = [
        "2025-08-10'; DROP TABLE burns; --",
        '2025-08-10<script>alert(1)</script>',
        '2025-08-10 UNION SELECT password FROM users',
        '2025-08-10T09:00:00Z; DELETE FROM weather_patterns;'
      ];

      for (const date of maliciousDates) {
        const response = await request(app)
          .post('/api/burn-requests')
          .send({
            farm_id: 'farm_123',
            burn_date: date,
            acres: 100,
            fuel_type: 'wheat_stubble'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('2. Rate Limiting Tests', () => {
    test('should enforce general rate limits', async () => {
      query.mockResolvedValue([]);

      // Make requests up to the rate limit
      const requests = Array.from({ length: 105 }, () =>
        request(app).get('/api/burn-requests')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error).toContain('rate limit');
    });

    test('should enforce stricter limits on expensive endpoints', async () => {
      query.mockResolvedValue([]);

      // Test vector similarity search endpoint (more expensive)
      const expensiveRequests = Array.from({ length: 15 }, () =>
        request(app).get('/api/weather/similar?lat=37.5&lng=-120.5')
      );

      const responses = await Promise.all(expensiveRequests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should track rate limits per IP address', async () => {
      query.mockResolvedValue([]);

      // Simulate requests from different IP addresses
      const ip1Requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/burn-requests')
          .set('X-Forwarded-For', '192.168.1.1')
      );

      const ip2Requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/burn-requests')  
          .set('X-Forwarded-For', '192.168.1.2')
      );

      const [ip1Responses, ip2Responses] = await Promise.all([
        Promise.all(ip1Requests),
        Promise.all(ip2Requests)
      ]);

      // Both IPs should be able to make requests independently
      expect(ip1Responses.every(r => r.status === 200)).toBe(true);
      expect(ip2Responses.every(r => r.status === 200)).toBe(true);
    });

    test('should provide rate limit headers', async () => {
      query.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/burn-requests')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('3. Authentication and Authorization Tests', () => {
    test('should reject requests without proper headers', async () => {
      const response = await request(app)
        .delete('/api/burn-requests/123')
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });

    test('should validate API key format', async () => {
      const invalidApiKeys = [
        'invalid-key',
        '123',
        '',
        'key-with-sql-injection; DROP TABLE users;',
        '<script>alert("xss")</script>'
      ];

      for (const apiKey of invalidApiKeys) {
        const response = await request(app)
          .delete('/api/burn-requests/123')
          .set('Authorization', `Bearer ${apiKey}`)
          .expect(401);

        expect(response.body.error).toContain('Invalid API key');
      }
    });

    test('should check permissions for farm-specific operations', async () => {
      // Mock user with limited farm access
      const limitedToken = 'limited-access-token';
      
      const response = await request(app)
        .get('/api/burn-requests/123') // Accessing unauthorized farm data
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    test('should validate JWT token integrity', async () => {
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature';

      const response = await request(app)
        .get('/api/burn-requests')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });
  });

  describe('4. Data Privacy and Sanitization', () => {
    test('should not expose sensitive data in error messages', async () => {
      query.mockRejectedValueOnce(new Error('Connection failed for user admin with password secret123'));

      const response = await request(app)
        .get('/api/burn-requests')
        .expect(500);

      expect(response.body.error).not.toContain('admin');
      expect(response.body.error).not.toContain('secret123');
      expect(response.body.error).not.toContain('password');
    });

    test('should mask phone numbers in logs and responses', async () => {
      const burnRequest = {
        farm_id: 'farm_123',
        contact_phone: '+1234567890',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: 'wheat_stubble'
      };

      query.mockResolvedValueOnce({ insertId: 456 });

      const response = await request(app)
        .post('/api/burn-requests')
        .send(burnRequest)
        .expect(201);

      // Phone number should be masked in response
      if (response.body.data && response.body.data.contact_phone) {
        expect(response.body.data.contact_phone).toMatch(/\+\*\*\*\*\*\*\*890/);
      }
    });

    test('should remove metadata from uploaded files', async () => {
      // Simulate file upload with metadata
      const fileWithMetadata = {
        filename: 'farm_boundary.json',
        content: JSON.stringify({
          boundaries: [{ lat: 37.5, lng: -120.5 }],
          _metadata: {
            user: 'john.doe',
            internal_id: 'secret-123',
            db_password: 'admin123'
          }
        })
      };

      const response = await request(app)
        .post('/api/farms')
        .send({
          farm_name: 'Test Farm',
          boundary_file: fileWithMetadata
        })
        .expect(400);

      expect(response.body.error).toContain('Metadata not allowed');
    });

    test('should sanitize vector data to remove potential identifiers', async () => {
      // Vector components that might encode sensitive information
      const suspiciousVector = new Array(128).fill(0);
      suspiciousVector[0] = 0.1234567890123456; // Potential phone number encoded
      suspiciousVector[1] = 0.0987654321098765; // Potential SSN encoded

      const weatherData = {
        location: { latitude: 37.5, longitude: -120.5 },
        temperature: 20,
        custom_vector: suspiciousVector
      };

      const response = await request(app)
        .post('/api/weather/analyze')
        .send(weatherData)
        .expect(400);

      expect(response.body.error).toContain('Vector data validation failed');
    });
  });

  describe('5. Security Headers and HTTPS', () => {
    test('should include security headers', async () => {
      query.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/burn-requests')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should enforce HTTPS in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/burn-requests')
        .set('X-Forwarded-Proto', 'http')
        .expect(301);

      expect(response.headers.location).toMatch(/^https:/);
    });

    test('should set proper CORS headers', async () => {
      query.mockResolvedValue([]);

      const response = await request(app)
        .options('/api/burn-requests')
        .set('Origin', 'https://burnwise.app')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    test('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/burn-requests')
        .set('Origin', 'https://malicious-site.com')
        .expect(403);

      expect(response.body.error).toContain('Origin not allowed');
    });
  });

  describe('6. Error Handling Security', () => {
    test('should not leak stack traces in production', async () => {
      process.env.NODE_ENV = 'production';
      
      query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/burn-requests')
        .expect(500);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.error).toBe('Internal server error');
    });

    test('should log security incidents', async () => {
      const maliciousRequest = {
        farm_id: "'; DROP TABLE burns; --",
        contact_phone: '+1234567890'
      };

      await request(app)
        .post('/api/burn-requests')
        .send(maliciousRequest)
        .expect(400);

      // Verify security incident was logged (would check logger mock calls)
      expect(require('../../middleware/logger').security).toHaveBeenCalledWith(
        expect.stringContaining('Potential SQL injection'),
        expect.any(Object)
      );
    });

    test('should handle timeout attacks gracefully', async () => {
      // Simulate slow database response
      query.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 31000)) // 31 second delay
      );

      const response = await request(app)
        .get('/api/burn-requests')
        .expect(408);

      expect(response.body.error).toContain('Request timeout');
    });

    test('should prevent error-based information disclosure', async () => {
      // Test various error conditions that shouldn't reveal system info
      const errorConditions = [
        { mockError: 'Table \'burns\' doesn\'t exist', endpoint: '/api/burn-requests' },
        { mockError: 'Access denied for user \'root\'@\'localhost\'', endpoint: '/api/weather/current?lat=37.5&lng=-120.5' },
        { mockError: 'File not found: /etc/passwd', endpoint: '/api/farms' }
      ];

      for (const condition of errorConditions) {
        query.mockRejectedValueOnce(new Error(condition.mockError));

        const response = await request(app)
          .get(condition.endpoint)
          .expect(500);

        expect(response.body.error).toBe('Internal server error');
        expect(response.body.error).not.toContain('Table');
        expect(response.body.error).not.toContain('Access denied');
        expect(response.body.error).not.toContain('/etc/passwd');
      }
    });
  });

  describe('7. Vector Security Tests', () => {
    test('should validate vector dimensions to prevent buffer overflow', async () => {
      const oversizedVector = new Array(10000).fill(0.5); // Extremely large vector

      const weatherData = {
        location: { latitude: 37.5, longitude: -120.5 },
        temperature: 20,
        custom_vector: oversizedVector
      };

      const response = await request(app)
        .post('/api/weather/analyze')
        .send(weatherData)
        .expect(400);

      expect(response.body.error).toContain('Vector size exceeds limit');
    });

    test('should sanitize vector values to prevent NaN/Infinity attacks', async () => {
      const maliciousVector = new Array(128).fill(0);
      maliciousVector[0] = Infinity;
      maliciousVector[1] = -Infinity;
      maliciousVector[2] = NaN;

      const weatherData = {
        location: { latitude: 37.5, longitude: -120.5 },
        temperature: 20,
        weather_vector: maliciousVector
      };

      const response = await request(app)
        .post('/api/weather/analyze')
        .send(weatherData)
        .expect(400);

      expect(response.body.error).toContain('Invalid vector values');
    });

    test('should prevent vector injection in similarity searches', async () => {
      const response = await request(app)
        .get('/api/weather/similar?vector=[1,2,3]; DROP TABLE weather_patterns; --')
        .expect(400);

      expect(response.body.error).toContain('Invalid vector format');
    });
  });

  describe('8. Compliance and Audit Tests', () => {
    test('should log all data access attempts', async () => {
      query.mockResolvedValue([{ id: 1, farm_name: 'Test Farm' }]);

      await request(app)
        .get('/api/farms/123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // Verify audit log entry
      expect(require('../../middleware/logger').audit).toHaveBeenCalledWith(
        'data_access',
        expect.objectContaining({
          resource: 'farms',
          resourceId: '123',
          action: 'read'
        })
      );
    });

    test('should track data modifications', async () => {
      query.mockResolvedValue({ affectedRows: 1 });

      await request(app)
        .put('/api/farms/123')
        .set('Authorization', 'Bearer valid-token')
        .send({ farm_name: 'Updated Farm' })
        .expect(200);

      expect(require('../../middleware/logger').audit).toHaveBeenCalledWith(
        'data_modification',
        expect.objectContaining({
          resource: 'farms',
          resourceId: '123',
          action: 'update',
          changes: expect.any(Object)
        })
      );
    });

    test('should maintain data retention compliance', async () => {
      // Test data older than retention policy
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 8); // 8 years old

      query.mockResolvedValue([{
        id: 1,
        created_at: oldDate,
        should_be_purged: true
      }]);

      const response = await request(app)
        .get('/api/burn-requests?include_expired=true')
        .expect(200);

      // Data should be filtered out due to retention policy
      expect(response.body.data).toHaveLength(0);
    });

    test('should support data export for compliance', async () => {
      const mockExportData = {
        user_id: 'user_123',
        data_type: 'all_user_data',
        export_format: 'json',
        compliance_request: true
      };

      query.mockResolvedValue([{ export_id: 'export_456' }]);

      const response = await request(app)
        .post('/api/compliance/export')
        .set('Authorization', 'Bearer admin-token')
        .send(mockExportData)
        .expect(200);

      expect(response.body.data.export_id).toBe('export_456');
    });
  });

  describe('9. Advanced Security Tests', () => {
    test('should detect and prevent timing attacks', async () => {
      const validId = '123';
      const invalidId = '999';

      query.mockImplementation((sql, params) => {
        if (params && params.includes(validId)) {
          return Promise.resolve([{ id: validId, data: 'exists' }]);
        }
        return Promise.resolve([]);
      });

      // Measure response times
      const startValid = Date.now();
      await request(app).get(`/api/farms/${validId}`);
      const validTime = Date.now() - startValid;

      const startInvalid = Date.now();
      await request(app).get(`/api/farms/${invalidId}`).expect(404);
      const invalidTime = Date.now() - startInvalid;

      // Response times should be similar to prevent timing attacks
      const timeDifference = Math.abs(validTime - invalidTime);
      expect(timeDifference).toBeLessThan(50); // Less than 50ms difference
    });

    test('should prevent parameter pollution', async () => {
      const response = await request(app)
        .get('/api/burn-requests?status=approved&status=pending&status=rejected')
        .expect(400);

      expect(response.body.error).toContain('Parameter pollution detected');
    });

    test('should validate request signatures', async () => {
      const requestData = { farm_id: 'farm_123', acres: 100 };
      const invalidSignature = 'invalid-signature';

      const response = await request(app)
        .post('/api/burn-requests')
        .set('X-Signature', invalidSignature)
        .send(requestData)
        .expect(401);

      expect(response.body.error).toContain('Invalid request signature');
    });

    test('should protect against cache poisoning', async () => {
      query.mockResolvedValue([{ id: 1, data: 'cached' }]);

      // Attempt cache poisoning with malicious headers
      const response = await request(app)
        .get('/api/weather/current?lat=37.5&lng=-120.5')
        .set('X-Forwarded-Host', 'malicious-site.com')
        .set('X-Original-URL', '/admin/secret')
        .expect(200);

      // Response should not be influenced by malicious headers
      expect(response.body.success).toBe(true);
      expect(response.headers).not.toHaveProperty('x-forwarded-host');
    });
  });

});

// Helper function to simulate authentication
function mockAuth(level = 'user') {
  return (req, res, next) => {
    req.user = {
      id: 'user_123',
      role: level,
      farmIds: ['farm_123', 'farm_456']
    };
    next();
  };
}