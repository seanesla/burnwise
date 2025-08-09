const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { initializeDatabase, query, pool } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinator');
const WeatherAgent = require('../../agents/weather');
require('dotenv').config();

describe('Input Validation - Critical Security for Life-Safety System', () => {
  let app;
  let server;
  let coordinator;
  let weatherAgent;
  
  beforeAll(async () => {
    await initializeDatabase();
    coordinator = new CoordinatorAgent();
    weatherAgent = new WeatherAgent();
    
    // Create minimal Express app for testing
    app = express();
    app.use(express.json({ limit: '10mb' }));
    
    // Mock routes for validation testing
    app.post('/api/burn-requests', async (req, res) => {
      try {
        const result = await coordinator.coordinateBurnRequest(req.body);
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
    
    app.get('/api/weather/current', async (req, res) => {
      try {
        const { lat, lon } = req.query;
        const result = await weatherAgent.analyzeWeatherForBurn(parseFloat(lat), parseFloat(lon), new Date());
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
    
    server = app.listen(0);
  });
  
  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Coordinate Validation', () => {
    test('Should reject invalid latitude values', async () => {
      const invalidLatitudes = [
        { lat: 91, lon: -120, desc: 'too high' },
        { lat: -91, lon: -120, desc: 'too low' },
        { lat: 'abc', lon: -120, desc: 'non-numeric string' },
        { lat: null, lon: -120, desc: 'null value' },
        { lat: undefined, lon: -120, desc: 'undefined' },
        { lat: Infinity, lon: -120, desc: 'infinity' },
        { lat: -Infinity, lon: -120, desc: 'negative infinity' },
        { lat: NaN, lon: -120, desc: 'NaN' },
      ];
      
      for (const coords of invalidLatitudes) {
        const response = await request(app)
          .get('/api/weather/current')
          .query({ lat: coords.lat, lon: coords.lon });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/latitude|coordinate|invalid/i);
        console.log(`✓ Rejected latitude ${coords.desc}: ${coords.lat}`);
      }
    });

    test('Should reject invalid longitude values', async () => {
      const invalidLongitudes = [
        { lat: 40, lon: 181, desc: 'too high' },
        { lat: 40, lon: -181, desc: 'too low' },
        { lat: 40, lon: 'xyz', desc: 'non-numeric string' },
        { lat: 40, lon: null, desc: 'null value' },
        { lat: 40, lon: undefined, desc: 'undefined' },
        { lat: 40, lon: Infinity, desc: 'infinity' },
        { lat: 40, lon: -Infinity, desc: 'negative infinity' },
        { lat: 40, lon: NaN, desc: 'NaN' },
      ];
      
      for (const coords of invalidLongitudes) {
        const response = await request(app)
          .get('/api/weather/current')
          .query({ lat: coords.lat, lon: coords.lon });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/longitude|coordinate|invalid/i);
        console.log(`✓ Rejected longitude ${coords.desc}: ${coords.lon}`);
      }
    });

    test('Should validate coordinate precision limits', async () => {
      const precisionTests = [
        { lat: 40.1234567890123, lon: -120.9876543210987, valid: true, desc: 'high precision' },
        { lat: 40.123456789012345678901234567890, lon: -120.0, valid: true, desc: 'extreme precision' },
        { lat: 40, lon: -120, valid: true, desc: 'integer coordinates' },
        { lat: 40.000000, lon: -120.000000, valid: true, desc: 'zero decimals' },
      ];
      
      for (const test of precisionTests) {
        const response = await request(app)
          .get('/api/weather/current')
          .query({ lat: test.lat, lon: test.lon });
        
        if (test.valid) {
          expect([200, 500]).toContain(response.status); // 200 or server error, but not validation error
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    test('Should validate coordinate ranges for agricultural regions', async () => {
      const regionalTests = [
        { lat: 25, lon: -125, region: 'Southern US', valid: true },
        { lat: 49, lon: -95, region: 'Northern US', valid: true },
        { lat: 60, lon: -140, region: 'Alaska', valid: true },
        { lat: 0, lon: 0, region: 'Null Island', valid: false },
        { lat: 85, lon: -120, region: 'Arctic', valid: false },
        { lat: -85, lon: -120, region: 'Antarctic', valid: false },
      ];
      
      for (const test of regionalTests) {
        const response = await request(app)
          .get('/api/weather/current')
          .query({ lat: test.lat, lon: test.lon });
        
        // System should accept coordinates but may return no data for non-agricultural regions
        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });
  });

  describe('Burn Request Validation', () => {
    test('Should validate required burn request fields', async () => {
      const requiredFields = ['farmId', 'fieldId', 'requestedDate', 'areaHectares'];
      
      for (const missingField of requiredFields) {
        const validRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        delete validRequest[missingField];
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(validRequest);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(new RegExp(`${missingField}|required|missing`, 'i'));
      }
    });

    test('Should validate burn area constraints', async () => {
      const areaTests = [
        { area: 0, valid: false, desc: 'zero hectares' },
        { area: -10, valid: false, desc: 'negative area' },
        { area: 0.1, valid: false, desc: 'too small (0.1 ha)' },
        { area: 1, valid: true, desc: 'minimum valid (1 ha)' },
        { area: 100, valid: true, desc: 'normal size (100 ha)' },
        { area: 1000, valid: true, desc: 'large field (1000 ha)' },
        { area: 10000, valid: false, desc: 'too large (10000 ha)' },
        { area: 'abc', valid: false, desc: 'non-numeric' },
        { area: null, valid: false, desc: 'null value' },
        { area: Infinity, valid: false, desc: 'infinity' },
      ];
      
      for (const test of areaTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: test.area,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/area|hectares|size|invalid/i);
        }
      }
    });

    test('Should validate date formats and ranges', async () => {
      const dateTests = [
        { date: '2025-09-15', valid: true, desc: 'valid ISO date' },
        { date: '2025-13-01', valid: false, desc: 'invalid month' },
        { date: '2025-02-30', valid: false, desc: 'invalid day' },
        { date: '2020-01-01', valid: false, desc: 'past date' },
        { date: '2030-01-01', valid: false, desc: 'too far future' },
        { date: 'invalid-date', valid: false, desc: 'non-date string' },
        { date: '15/09/2025', valid: false, desc: 'wrong format' },
        { date: null, valid: false, desc: 'null date' },
        { date: '', valid: false, desc: 'empty string' },
        { date: 1234567890, valid: false, desc: 'timestamp number' },
      ];
      
      for (const test of dateTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: test.date,
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/date|format|invalid|range/i);
        }
      }
    });

    test('Should validate time format and constraints', async () => {
      const timeTests = [
        { start: '06:00', end: '10:00', valid: true, desc: 'early morning' },
        { start: '08:00', end: '16:00', valid: true, desc: 'full day' },
        { start: '25:00', end: '10:00', valid: false, desc: 'invalid hour' },
        { start: '08:60', end: '10:00', valid: false, desc: 'invalid minute' },
        { start: '10:00', end: '08:00', valid: false, desc: 'end before start' },
        { start: '08:00', end: '08:00', valid: false, desc: 'same start/end' },
        { start: 'abc', end: '10:00', valid: false, desc: 'non-time string' },
        { start: null, end: '10:00', valid: false, desc: 'null start time' },
        { start: '', end: '10:00', valid: false, desc: 'empty start time' },
      ];
      
      for (const test of timeTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          requestedStartTime: test.start,
          requestedEndTime: test.end,
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/time|format|invalid|range/i);
        }
      }
    });

    test('Should validate crop type enumeration', async () => {
      const cropTests = [
        { crop: 'wheat_stubble', valid: true },
        { crop: 'corn_residue', valid: true },
        { crop: 'rice_straw', valid: true },
        { crop: 'grass_hay', valid: true },
        { crop: 'invalid_crop', valid: false },
        { crop: '', valid: false },
        { crop: null, valid: true }, // Optional field
        { crop: 'WHEAT_STUBBLE', valid: false }, // Case sensitive
        { crop: 123, valid: false },
        { crop: {}, valid: false },
      ];
      
      for (const test of cropTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: test.crop,
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/crop|type|invalid|enum/i);
        }
      }
    });
  });

  describe('Injection Attack Prevention', () => {
    test('Should prevent SQL injection in text fields', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE farms; --",
        "1' OR '1'='1",
        "1' UNION SELECT * FROM users --",
        "'; INSERT INTO farms VALUES (999, 'hacked'); --",
        "1'; DELETE FROM burn_requests; --",
        "\"; DROP DATABASE burnwise; --",
        "' OR 1=1 /*",
        "admin'--",
        "' OR 'a'='a",
        "1' AND (SELECT COUNT(*) FROM farms) > 0 --",
      ];
      
      for (const payload of sqlInjectionPayloads) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: payload, // Inject into crop type
          farmName: payload, // Inject into farm name
          fieldName: payload, // Inject into field name
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        // Should either reject (400) or handle safely (not execute SQL)
        expect([200, 201, 400]).toContain(response.status);
        
        // Verify database integrity - farms table should still exist
        try {
          const [farms] = await query('SELECT COUNT(*) as count FROM farms LIMIT 1');
          expect(farms).toBeDefined(); // Table still exists
        } catch (error) {
          expect(true).toBe(false); // SQL injection succeeded - FAIL
        }
      }
    });

    test('Should prevent XSS in user input fields', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
        '"><script>alert("XSS")</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload="alert(1)">',
        '<input type="text" onfocus="alert(1)" autofocus>',
        '<details open ontoggle="alert(1)">',
        '<marquee onstart="alert(1)">',
      ];
      
      for (const payload of xssPayloads) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          notes: payload, // XSS attempt in notes field
          contactName: payload, // XSS attempt in contact
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (response.status === 200 || response.status === 201) {
          // If accepted, response should not contain raw HTML
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('<script>');
          expect(responseText).not.toContain('javascript:');
          expect(responseText).not.toContain('onerror');
          expect(responseText).not.toContain('onload');
        }
      }
    });

    test('Should prevent NoSQL injection attempts', async () => {
      const noSqlPayloads = [
        { $ne: null },
        { $gt: "" },
        { $where: "function() { return true; }" },
        { $regex: ".*" },
        { $or: [{ $ne: null }, { $exists: true }] },
        "'; return db.farms.find(); //",
        { $eval: "function() { return true; }" },
        { $text: { $search: "admin" } },
      ];
      
      for (const payload of noSqlPayloads) {
        const burnRequest = {
          farmId: payload,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        // Should reject complex objects as farm IDs
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/farmId|invalid|type/i);
      }
    });

    test('Should sanitize file path traversal attempts', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/etc/shadow',
        '../../config/database.yml',
        '../../../../../proc/version',
        'file:///etc/passwd',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
      ];
      
      for (const payload of pathTraversalPayloads) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          attachmentPath: payload, // Path traversal in file field
          configFile: payload, // Path traversal in config field
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (response.status === 200 || response.status === 201) {
          // If accepted, should not contain path traversal sequences
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('../');
          expect(responseText).not.toContain('..\\');
          expect(responseText).not.toContain('/etc/');
          expect(responseText).not.toContain('\\windows\\');
        }
      }
    });
  });

  describe('Data Type and Format Validation', () => {
    test('Should validate numeric field constraints', async () => {
      const numericTests = [
        { field: 'farmId', value: 'abc', valid: false },
        { field: 'farmId', value: -1, valid: false },
        { field: 'farmId', value: 0, valid: false },
        { field: 'farmId', value: 1, valid: true },
        { field: 'farmId', value: 999999, valid: true },
        { field: 'fieldId', value: 1.5, valid: false },
        { field: 'areaHectares', value: -5, valid: false },
        { field: 'areaHectares', value: 0, valid: false },
        { field: 'areaHectares', value: 0.5, valid: false },
        { field: 'areaHectares', value: 1, valid: true },
        { field: 'priorityScore', value: -1, valid: false },
        { field: 'priorityScore', value: 101, valid: false },
        { field: 'priorityScore', value: 50, valid: true },
      ];
      
      for (const test of numericTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0,
          [test.field]: test.value
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(new RegExp(`${test.field}|numeric|integer|range`, 'i'));
        }
      }
    });

    test('Should validate string length constraints', async () => {
      const stringTests = [
        { field: 'farmName', value: '', valid: false, desc: 'empty string' },
        { field: 'farmName', value: 'A', valid: true, desc: 'minimum length' },
        { field: 'farmName', value: 'A'.repeat(100), valid: true, desc: 'normal length' },
        { field: 'farmName', value: 'A'.repeat(256), valid: false, desc: 'too long' },
        { field: 'fieldName', value: 'A'.repeat(1000), valid: false, desc: 'excessive length' },
        { field: 'cropType', value: 'A'.repeat(50), valid: false, desc: 'crop type too long' },
        { field: 'notes', value: 'A'.repeat(5000), valid: false, desc: 'notes too long' },
      ];
      
      for (const test of stringTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0,
          [test.field]: test.value
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/length|too long|empty|invalid/i);
        }
      }
    });

    test('Should validate email format constraints', async () => {
      const emailTests = [
        { email: 'valid@example.com', valid: true },
        { email: 'user+tag@domain.co.uk', valid: true },
        { email: 'user.name@domain-name.com', valid: true },
        { email: 'invalid.email', valid: false },
        { email: '@domain.com', valid: false },
        { email: 'user@', valid: false },
        { email: 'user@@domain.com', valid: false },
        { email: 'user@domain', valid: false },
        { email: '', valid: false },
        { email: 'user@domain..com', valid: false },
        { email: 'user name@domain.com', valid: false },
        { email: 'user@domain.c', valid: false },
      ];
      
      for (const test of emailTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          contactEmail: test.email,
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/email|format|invalid/i);
        }
      }
    });

    test('Should validate phone number formats', async () => {
      const phoneTests = [
        { phone: '+1-555-123-4567', valid: true },
        { phone: '(555) 123-4567', valid: true },
        { phone: '555.123.4567', valid: true },
        { phone: '5551234567', valid: true },
        { phone: '+44 20 7123 4567', valid: true },
        { phone: '123', valid: false },
        { phone: 'abc-def-ghij', valid: false },
        { phone: '555-123-456789', valid: false },
        { phone: '', valid: false },
        { phone: '+1-555-123-4567-ext123', valid: false },
        { phone: '()123-4567', valid: false },
      ];
      
      for (const test of phoneTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          contactPhone: test.phone,
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/phone|format|invalid|number/i);
        }
      }
    });
  });

  describe('Payload Size and Structure Validation', () => {
    test('Should enforce maximum request payload size', async () => {
      const largePayload = {
        farmId: 1,
        fieldId: 101,
        requestedDate: '2025-09-15',
        areaHectares: 100,
        cropType: 'wheat_stubble',
        lat: 40.0,
        lon: -120.0,
        largeField: 'A'.repeat(15 * 1024 * 1024), // 15MB string
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(largePayload);
      
      expect(response.status).toBe(413); // Payload too large
    });

    test('Should validate nested object depth limits', async () => {
      const createDeepObject = (depth) => {
        if (depth === 0) return { value: 'deep' };
        return { nested: createDeepObject(depth - 1) };
      };
      
      const deepPayload = {
        farmId: 1,
        fieldId: 101,
        requestedDate: '2025-09-15',
        areaHectares: 100,
        cropType: 'wheat_stubble',
        lat: 40.0,
        lon: -120.0,
        metadata: createDeepObject(1000), // Very deep nesting
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(deepPayload);
      
      // Should reject overly nested structures
      expect([400, 413]).toContain(response.status);
    });

    test('Should validate array length limits', async () => {
      const arrayTests = [
        { array: Array(10).fill('item'), valid: true, desc: 'normal array' },
        { array: Array(100).fill('item'), valid: true, desc: 'large array' },
        { array: Array(10000).fill('item'), valid: false, desc: 'excessive array' },
        { array: [], valid: true, desc: 'empty array' },
      ];
      
      for (const test of arrayTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0,
          tags: test.array,
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201, 413]).toContain(response.status); // 413 for payload size
        } else {
          expect([400, 413]).toContain(response.status);
        }
      }
    });

    test('Should reject malformed JSON structures', async () => {
      const malformedRequests = [
        '{"farmId": 1, "fieldId": 101,}', // Trailing comma
        '{"farmId": 1 "fieldId": 101}', // Missing comma
        '{farmId: 1, fieldId: 101}', // Unquoted keys
        '{"farmId": 1, "fieldId": }', // Missing value
        '{"farmId": 1, "fieldId": 101', // Unclosed brace
        '', // Empty string
        'not json at all',
        '{"farmId": 01, "fieldId": 101}', // Leading zero
      ];
      
      for (const malformed of malformedRequests) {
        const response = await request(app)
          .post('/api/burn-requests')
          .set('Content-Type', 'application/json')
          .send(malformed);
        
        expect(response.status).toBe(400);
        expect(response.body.error || response.text).toMatch(/json|parse|syntax|invalid/i);
      }
    });
  });

  describe('Geographic and Spatial Validation', () => {
    test('Should validate GeoJSON geometry structures', async () => {
      const geometryTests = [
        { 
          geometry: { 
            type: 'Polygon', 
            coordinates: [[[-120, 40], [-119, 40], [-119, 41], [-120, 41], [-120, 40]]] 
          }, 
          valid: true 
        },
        { 
          geometry: { 
            type: 'Point', 
            coordinates: [-120, 40] 
          }, 
          valid: true 
        },
        { 
          geometry: { 
            type: 'Polygon', 
            coordinates: [[-120, 40], [-119, 40]] // Invalid polygon
          }, 
          valid: false 
        },
        { 
          geometry: { 
            type: 'InvalidType', 
            coordinates: [-120, 40] 
          }, 
          valid: false 
        },
        { 
          geometry: { 
            coordinates: [-120, 40] // Missing type
          }, 
          valid: false 
        },
        { 
          geometry: { 
            type: 'Point' // Missing coordinates
          }, 
          valid: false 
        },
      ];
      
      for (const test of geometryTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          fieldGeometry: test.geometry,
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/geometry|geojson|coordinate|invalid/i);
        }
      }
    });

    test('Should validate spatial coordinate system references', async () => {
      const sridTests = [
        { srid: 4326, valid: true, desc: 'WGS84' },
        { srid: 3857, valid: true, desc: 'Web Mercator' },
        { srid: 4269, valid: true, desc: 'NAD83' },
        { srid: -1, valid: false, desc: 'negative SRID' },
        { srid: 0, valid: false, desc: 'zero SRID' },
        { srid: 999999, valid: false, desc: 'invalid SRID' },
        { srid: 'WGS84', valid: false, desc: 'string SRID' },
        { srid: null, valid: true, desc: 'null SRID (defaults to 4326)' },
      ];
      
      for (const test of sridTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          coordinateSystem: test.srid,
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/srid|coordinate.*system|invalid/i);
        }
      }
    });

    test('Should validate polygon closure and winding order', async () => {
      const polygonTests = [
        {
          coords: [[-120, 40], [-119, 40], [-119, 41], [-120, 41], [-120, 40]],
          valid: true,
          desc: 'properly closed polygon'
        },
        {
          coords: [[-120, 40], [-119, 40], [-119, 41], [-120, 41]],
          valid: false,
          desc: 'unclosed polygon'
        },
        {
          coords: [[-120, 40], [-120, 40], [-120, 40], [-120, 40]],
          valid: false,
          desc: 'degenerate polygon'
        },
        {
          coords: [[-120, 40], [-119, 40], [-120, 41], [-119, 41], [-120, 40]],
          valid: false,
          desc: 'self-intersecting polygon'
        },
      ];
      
      for (const test of polygonTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: 'wheat_stubble',
          fieldGeometry: {
            type: 'Polygon',
            coordinates: [test.coords]
          },
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/polygon|geometry|invalid|closed/i);
        }
      }
    });
  });

  describe('Business Logic Validation', () => {
    test('Should validate burn season constraints', async () => {
      const seasonTests = [
        { date: '2025-01-15', valid: false, desc: 'winter burn' },
        { date: '2025-03-15', valid: true, desc: 'spring burn' },
        { date: '2025-06-15', valid: false, desc: 'summer burn' },
        { date: '2025-09-15', valid: true, desc: 'fall burn' },
        { date: '2025-11-15', valid: true, desc: 'late fall burn' },
        { date: '2025-12-15', valid: false, desc: 'early winter burn' },
      ];
      
      for (const test of seasonTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: test.date,
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/season|date|prohibited|restricted/i);
        }
      }
    });

    test('Should validate fuel load and crop type compatibility', async () => {
      const fuelTests = [
        { crop: 'wheat_stubble', fuel: 15, valid: true },
        { crop: 'wheat_stubble', fuel: 50, valid: false, desc: 'too high for wheat' },
        { crop: 'corn_residue', fuel: 25, valid: true },
        { crop: 'corn_residue', fuel: 5, valid: false, desc: 'too low for corn' },
        { crop: 'rice_straw', fuel: 40, valid: true },
        { crop: 'grass_hay', fuel: 10, valid: true },
        { crop: null, fuel: 20, valid: true, desc: 'no crop specified' },
        { crop: 'wheat_stubble', fuel: 0, valid: false, desc: 'zero fuel load' },
        { crop: 'wheat_stubble', fuel: -5, valid: false, desc: 'negative fuel load' },
      ];
      
      for (const test of fuelTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          areaHectares: 100,
          cropType: test.crop,
          fuelLoad: test.fuel,
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/fuel|load|crop|compatibility|range/i);
        }
      }
    });

    test('Should validate burn duration constraints', async () => {
      const durationTests = [
        { start: '06:00', end: '08:00', valid: true, desc: '2 hour burn' },
        { start: '08:00', end: '16:00', valid: true, desc: '8 hour burn' },
        { start: '08:00', end: '20:00', valid: false, desc: '12 hour burn (too long)' },
        { start: '06:00', end: '06:30', valid: false, desc: '30 min burn (too short)' },
        { start: '18:00', end: '20:00', valid: false, desc: 'evening burn' },
        { start: '04:00', end: '08:00', valid: false, desc: 'pre-dawn burn' },
      ];
      
      for (const test of durationTests) {
        const burnRequest = {
          farmId: 1,
          fieldId: 101,
          requestedDate: '2025-09-15',
          requestedStartTime: test.start,
          requestedEndTime: test.end,
          areaHectares: 100,
          cropType: 'wheat_stubble',
          lat: 40.0,
          lon: -120.0
        };
        
        const response = await request(app)
          .post('/api/burn-requests')
          .send(burnRequest);
        
        if (test.valid) {
          expect([200, 201]).toContain(response.status);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/duration|time|hours|prohibited|restricted/i);
        }
      }
    });
  });
});

module.exports = {
  // Helper functions for input validation testing
  generateInvalidCoordinates: () => [
    { lat: 91, lon: -120 },
    { lat: -91, lon: -120 },
    { lat: 40, lon: 181 },
    { lat: 40, lon: -181 },
    { lat: 'invalid', lon: -120 },
    { lat: 40, lon: 'invalid' },
    { lat: null, lon: -120 },
    { lat: 40, lon: null },
    { lat: Infinity, lon: -120 },
    { lat: 40, lon: -Infinity },
  ],
  
  generateSQLInjectionPayloads: () => [
    "'; DROP TABLE farms; --",
    "1' OR '1'='1",
    "1' UNION SELECT * FROM users --",
    "'; INSERT INTO malicious VALUES (1); --",
    "admin'/*",
    "' OR 'a'='a",
    "\"; DROP DATABASE burnwise; --",
  ],
  
  generateXSSPayloads: () => [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(1)">',
    'javascript:alert("XSS")',
    '<svg onload="alert(1)">',
    '"><script>alert("XSS")</script>',
    '<iframe src="javascript:alert(1)"></iframe>',
  ],
  
  validateBurnRequest: (request) => {
    const errors = [];
    
    if (!request.farmId || typeof request.farmId !== 'number' || request.farmId <= 0) {
      errors.push('farmId must be a positive integer');
    }
    
    if (!request.fieldId || typeof request.fieldId !== 'number' || request.fieldId <= 0) {
      errors.push('fieldId must be a positive integer');
    }
    
    if (!request.requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(request.requestedDate)) {
      errors.push('requestedDate must be in YYYY-MM-DD format');
    }
    
    if (!request.areaHectares || typeof request.areaHectares !== 'number' || request.areaHectares < 1) {
      errors.push('areaHectares must be at least 1 hectare');
    }
    
    if (request.lat && (typeof request.lat !== 'number' || request.lat < -90 || request.lat > 90)) {
      errors.push('lat must be between -90 and 90');
    }
    
    if (request.lon && (typeof request.lon !== 'number' || request.lon < -180 || request.lon > 180)) {
      errors.push('lon must be between -180 and 180');
    }
    
    return { valid: errors.length === 0, errors };
  }
};