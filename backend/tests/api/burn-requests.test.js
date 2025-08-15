const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { initializeDatabase, query, pool } = require('../../db/connection');
require('dotenv').config();

describe('Burn Requests API Endpoints - Life-Critical Operations', () => {
  let app;
  let server;
  
  beforeAll(async () => {
    await initializeDatabase();
    
    // Create Express app with API routes
    app = express();
    app.use(express.json());
    
    // Import routes (assuming they exist)
    const burnRequestRoutes = require('../../routes/burnRequests');
    app.use('/api/burn-requests', burnRequestRoutes);
    
    // Start test server
    server = app.listen(0); // Random port
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
  
  beforeEach(async () => {
    // Clean test data
    try {
      await query('DELETE FROM burn_requests WHERE farm_id > 99000');
      await query('DELETE FROM burn_fields WHERE farm_id > 99000');
      await query('DELETE FROM farms WHERE farm_id > 99000');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('POST /api/burn-requests - Submit Burn Request', () => {
    test('Should successfully submit valid burn request', async () => {
      const validRequest = {
        farmId: 99001,
        fieldId: 99101,
        requestedDate: '2025-09-15',
        requestedStartTime: '09:00',
        requestedEndTime: '13:00',
        areaHectares: 150,
        cropType: 'wheat_stubble',
        fuelLoad: 20,
        lat: 40.5,
        lon: -120.5,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.51, 40.51],
            [-120.49, 40.51],
            [-120.49, 40.49],
            [-120.51, 40.49],
            [-120.51, 40.51]
          ]]
        }
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(validRequest)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('priorityScore');
      expect(response.body.priorityScore).toBeGreaterThan(0);
      expect(response.body.priorityScore).toBeLessThanOrEqual(100);
    });

    test('Should reject burn request with invalid area (negative)', async () => {
      const invalidRequest = {
        farmId: 99001,
        fieldId: 99101,
        requestedDate: '2025-09-15',
        areaHectares: -50, // Invalid negative area
        cropType: 'wheat_stubble'
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(invalidRequest);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('area');
    });

    test('Should reject burn request during dangerous weather', async () => {
      const dangerousRequest = {
        farmId: 99001,
        fieldId: 99101,
        requestedDate: '2025-09-15',
        areaHectares: 100,
        windSpeed: 40, // Dangerous wind speed
        humidity: 10,   // Very dry conditions
        lat: 40.5,
        lon: -120.5
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(dangerousRequest);
      
      // Should reject or flag as unsafe
      if (response.status === 201) {
        expect(response.body.warnings).toContain('HIGH_WIND');
        expect(response.body.safetyStatus).toBe('unsafe');
      } else {
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/weather|wind|unsafe/i);
      }
    });

    test('Should trigger full 5-agent workflow on submission', async () => {
      const workflowRequest = {
        farmId: 99002,
        fieldId: 99102,
        requestedDate: '2025-09-16',
        requestedStartTime: '08:00',
        requestedEndTime: '12:00',
        areaHectares: 75,
        cropType: 'rice_stubble',
        lat: 40.0,
        lon: -120.0
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(workflowRequest);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('workflowId');
      expect(response.body).toHaveProperty('agents');
      
      // Verify agents were triggered
      const expectedAgents = ['coordinator', 'weather', 'predictor', 'optimizer', 'alerts'];
      if (response.body.agents) {
        expectedAgents.forEach(agent => {
          expect(response.body.agents).toHaveProperty(agent);
        });
      }
    });

    test('Should validate field geometry polygon', async () => {
      const invalidGeometry = {
        farmId: 99001,
        fieldId: 99101,
        requestedDate: '2025-09-15',
        areaHectares: 100,
        fieldGeometry: {
          type: 'Polygon',
          coordinates: [[
            [-120.5, 40.5],
            [-120.5, 40.5] // Invalid - only 2 points
          ]]
        }
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(invalidGeometry);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/geometry|polygon|invalid/i);
    });

    test('Should enforce PM2.5 safety thresholds', async () => {
      const highPM25Request = {
        farmId: 99003,
        fieldId: 99103,
        requestedDate: '2025-09-15',
        areaHectares: 500, // Large area = high PM2.5
        cropType: 'wheat_stubble',
        fuelLoad: 40, // High fuel load
        lat: 40.0,
        lon: -120.0,
        nearbyPopulation: 10000 // Near population center
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(highPM25Request);
      
      if (response.status === 201) {
        expect(response.body).toHaveProperty('estimatedPM25');
        expect(response.body.estimatedPM25).toBeGreaterThan(35); // EPA threshold
        expect(response.body.safetyWarnings).toContain('PM25_EXCEEDS_SAFE_LIMIT');
      }
    });

    test('Should handle concurrent burn requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        farmId: 99100 + i,
        fieldId: 99200 + i,
        requestedDate: '2025-09-15',
        requestedStartTime: '09:00',
        requestedEndTime: '11:00',
        areaHectares: 50 + i * 10,
        cropType: 'wheat_stubble',
        lat: 40.0 + i * 0.01,
        lon: -120.0 + i * 0.01
      }));
      
      const responses = await Promise.all(
        requests.map(req => 
          request(app)
            .post('/api/burn-requests')
            .send(req)
        )
      );
      
      // All should be processed
      responses.forEach(res => {
        expect([200, 201, 409]).toContain(res.status); // 409 for conflicts
      });
      
      // Check for conflict detection
      const conflicts = responses.filter(r => r.status === 409);
      if (conflicts.length > 0) {
        expect(conflicts[0].body).toHaveProperty('conflictsWith');
      }
    });

    test('Should validate required fields', async () => {
      const missingFields = {
        farmId: 99001
        // Missing all other required fields
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(missingFields);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/required|missing/i);
      expect(response.body.missingFields).toBeDefined();
    });

    test('Should prevent duplicate burn requests', async () => {
      const burnRequest = {
        farmId: 99004,
        fieldId: 99104,
        requestedDate: '2025-09-17',
        areaHectares: 100,
        cropType: 'wheat_stubble'
      };
      
      // First request
      const response1 = await request(app)
        .post('/api/burn-requests')
        .send(burnRequest);
      
      expect(response1.status).toBe(201);
      
      // Duplicate request
      const response2 = await request(app)
        .post('/api/burn-requests')
        .send(burnRequest);
      
      expect(response2.status).toBe(409);
      expect(response2.body.error).toMatch(/duplicate|exists/i);
    });

    test('Should calculate priority based on multiple factors', async () => {
      const factors = [
        { areaHectares: 200, cropType: 'wheat_stubble', expectedPriority: 'high' },
        { areaHectares: 50, cropType: 'grass', expectedPriority: 'medium' },
        { areaHectares: 10, cropType: 'weeds', expectedPriority: 'low' }
      ];
      
      const responses = await Promise.all(
        factors.map((factor, i) => 
          request(app)
            .post('/api/burn-requests')
            .send({
              farmId: 99200 + i,
              fieldId: 99300 + i,
              requestedDate: '2025-09-18',
              ...factor
            })
        )
      );
      
      // Higher area should get higher priority
      const priorities = responses.map(r => r.body.priorityScore);
      expect(priorities[0]).toBeGreaterThan(priorities[2]);
    });
  });

  describe('GET /api/burn-requests - Retrieve Burn Requests', () => {
    test('Should retrieve all burn requests', async () => {
      // Create test data
      await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES 
          (99001, 99101, '2025-09-15', 'pending'),
          (99002, 99102, '2025-09-16', 'approved'),
          (99003, 99103, '2025-09-17', 'scheduled')
      `);
      
      const response = await request(app)
        .get('/api/burn-requests')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });

    test('Should filter burn requests by status', async () => {
      await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES 
          (99001, 99101, '2025-09-15', 'pending'),
          (99002, 99102, '2025-09-16', 'approved'),
          (99003, 99103, '2025-09-17', 'completed')
      `);
      
      const response = await request(app)
        .get('/api/burn-requests?status=pending');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      response.body.forEach(request => {
        expect(request.status).toBe('pending');
      });
    });

    test('Should filter by date range', async () => {
      const response = await request(app)
        .get('/api/burn-requests?startDate=2025-09-15&endDate=2025-09-17');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      response.body.forEach(request => {
        const date = new Date(request.requestedDate);
        expect(date >= new Date('2025-09-15')).toBeTruthy();
        expect(date <= new Date('2025-09-17')).toBeTruthy();
      });
    });

    test('Should paginate results', async () => {
      // Create many test records
      const records = Array.from({ length: 25 }, (_, i) => 
        `(${99500 + i}, ${99600 + i}, '2025-09-15', 'pending')`
      ).join(',');
      
      await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES ${records}
      `);
      
      const page1 = await request(app)
        .get('/api/burn-requests?page=1&limit=10');
      
      const page2 = await request(app)
        .get('/api/burn-requests?page=2&limit=10');
      
      expect(page1.status).toBe(200);
      expect(page1.body.data.length).toBeLessThanOrEqual(10);
      expect(page1.body.pagination.page).toBe(1);
      
      expect(page2.status).toBe(200);
      expect(page2.body.data.length).toBeLessThanOrEqual(10);
      expect(page2.body.pagination.page).toBe(2);
      
      // Ensure no duplicate IDs between pages
      const ids1 = page1.body.data.map(r => r.requestId);
      const ids2 = page2.body.data.map(r => r.requestId);
      const intersection = ids1.filter(id => ids2.includes(id));
      expect(intersection.length).toBe(0);
    });

    test('Should include weather data when requested', async () => {
      const response = await request(app)
        .get('/api/burn-requests?includeWeather=true');
      
      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('weatherData');
        if (response.body[0].weatherData) {
          expect(response.body[0].weatherData).toHaveProperty('windSpeed');
          expect(response.body[0].weatherData).toHaveProperty('humidity');
        }
      }
    });

    test('Should sort by priority score', async () => {
      await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, priority_score, status)
        VALUES 
          (99001, 99101, '2025-09-15', 75, 'pending'),
          (99002, 99102, '2025-09-16', 90, 'pending'),
          (99003, 99103, '2025-09-17', 60, 'pending')
      `);
      
      const response = await request(app)
        .get('/api/burn-requests?sort=priority&order=desc');
      
      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      
      // Verify descending order
      for (let i = 1; i < response.body.length; i++) {
        expect(response.body[i - 1].priorityScore).toBeGreaterThanOrEqual(
          response.body[i].priorityScore
        );
      }
    });

    test('Should handle invalid query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/burn-requests?status=invalid_status&page=abc');
      
      expect([200, 400]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('GET /api/burn-requests/:id - Get Single Burn Request', () => {
    test('Should retrieve specific burn request by ID', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'pending')
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .get(`/api/burn-requests/${requestId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.requestId).toBe(requestId);
      expect(response.body.farmId).toBe(99001);
      expect(response.body.fieldId).toBe(99101);
    });

    test('Should return 404 for non-existent burn request', async () => {
      const response = await request(app)
        .get('/api/burn-requests/999999999');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });

    test('Should include full details with expanded flag', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status, priority_score)
        VALUES (99001, 99101, '2025-09-15', 'pending', 85)
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .get(`/api/burn-requests/${requestId}?expanded=true`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('farmDetails');
      expect(response.body).toHaveProperty('fieldDetails');
      expect(response.body).toHaveProperty('weatherAnalysis');
      expect(response.body).toHaveProperty('conflictAnalysis');
    });

    test('Should validate ID parameter format', async () => {
      const response = await request(app)
        .get('/api/burn-requests/not-a-number');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid.*id/i);
    });
  });

  describe('PUT /api/burn-requests/:id - Update Burn Request', () => {
    test('Should update burn request status', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'pending')
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .put(`/api/burn-requests/${requestId}`)
        .send({ status: 'approved' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');
      
      // Verify in database
      const check = await query(
        'SELECT status FROM burn_requests WHERE request_id = ?',
        [requestId]
      );
      expect(check[0].status).toBe('approved');
    });

    test('Should prevent invalid status transitions', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'completed')
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .put(`/api/burn-requests/${requestId}`)
        .send({ status: 'pending' }); // Can't go back to pending from completed
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid.*transition/i);
    });

    test('Should update scheduled time', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'approved')
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .put(`/api/burn-requests/${requestId}`)
        .send({
          scheduledStartTime: '10:00',
          scheduledEndTime: '14:00'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.scheduledStartTime).toBe('10:00');
      expect(response.body.scheduledEndTime).toBe('14:00');
    });

    test('Should validate time conflicts on update', async () => {
      // Create existing burn
      await query(`
        INSERT INTO burn_requests 
        (farm_id, field_id, requested_date, scheduled_start_time, scheduled_end_time, status)
        VALUES (99001, 99101, '2025-09-15', '09:00', '11:00', 'scheduled')
      `);
      
      // Create another burn
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99002, 99102, '2025-09-15', 'approved')
      `);
      
      const requestId = result.insertId;
      
      // Try to schedule overlapping time
      const response = await request(app)
        .put(`/api/burn-requests/${requestId}`)
        .send({
          scheduledStartTime: '10:00', // Conflicts with first burn
          scheduledEndTime: '12:00'
        });
      
      expect([200, 409]).toContain(response.status);
      if (response.status === 409) {
        expect(response.body.error).toMatch(/conflict/i);
        expect(response.body.conflictsWith).toBeDefined();
      }
    });

    test('Should record update history', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'pending')
      `);
      
      const requestId = result.insertId;
      
      // Multiple updates
      await request(app)
        .put(`/api/burn-requests/${requestId}`)
        .send({ status: 'approved' });
      
      await request(app)
        .put(`/api/burn-requests/${requestId}`)
        .send({ status: 'scheduled' });
      
      const response = await request(app)
        .get(`/api/burn-requests/${requestId}/history`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body[0].previousStatus).toBe('pending');
      expect(response.body[0].newStatus).toBe('approved');
    });
  });

  describe('DELETE /api/burn-requests/:id - Cancel Burn Request', () => {
    test('Should cancel pending burn request', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'pending')
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .delete(`/api/burn-requests/${requestId}`)
        .send({ reason: 'Weather conditions changed' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
      expect(response.body.cancellationReason).toBe('Weather conditions changed');
    });

    test('Should prevent cancellation of completed burns', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'completed')
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .delete(`/api/burn-requests/${requestId}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/cannot.*cancel.*completed/i);
    });

    test('Should notify affected parties on cancellation', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'scheduled')
      `);
      
      const requestId = result.insertId;
      
      const response = await request(app)
        .delete(`/api/burn-requests/${requestId}`)
        .send({ 
          reason: 'Emergency wildfire in region',
          notifyNeighbors: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body.notificationsSent).toBeDefined();
      expect(response.body.notificationsSent).toBeGreaterThan(0);
    });

    test('Should handle cascade deletion of related data', async () => {
      const result = await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status)
        VALUES (99001, 99101, '2025-09-15', 'pending')
      `);
      
      const requestId = result.insertId;
      
      // Add related data
      await query(`
        INSERT INTO burn_conflicts (request_id_1, request_id_2, severity)
        VALUES (?, 99999, 'high')
      `, [requestId]);
      
      const response = await request(app)
        .delete(`/api/burn-requests/${requestId}`);
      
      expect(response.status).toBe(200);
      
      // Verify cascaded deletion
      const conflicts = await query(
        'SELECT * FROM burn_conflicts WHERE request_id_1 = ? OR request_id_2 = ?',
        [requestId, requestId]
      );
      expect(conflicts.length).toBe(0);
    });
  });

  describe('POST /api/burn-requests/detect-conflicts', () => {
    test('Should detect spatial conflicts between burns', async () => {
      const burns = [
        {
          requestId: 1,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 100,
          requestedDate: '2025-09-15',
          requestedStartTime: '09:00'
        },
        {
          requestId: 2,
          lat: 40.01, // Very close to first burn
          lon: -120.01,
          areaHectares: 100,
          requestedDate: '2025-09-15',
          requestedStartTime: '09:00'
        }
      ];
      
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({ burnRequests: burns });
      
      expect(response.status).toBe(200);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBeGreaterThan(0);
      expect(response.body.conflicts[0]).toHaveProperty('severity');
      expect(response.body.conflicts[0]).toHaveProperty('estimatedPM25');
    });

    test('Should calculate combined PM2.5 levels', async () => {
      const burns = [
        {
          requestId: 1,
          areaHectares: 200,
          fuelLoad: 25,
          lat: 40.0,
          lon: -120.0
        },
        {
          requestId: 2,
          areaHectares: 150,
          fuelLoad: 20,
          lat: 40.005,
          lon: -120.005
        }
      ];
      
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({ burnRequests: burns });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('combinedPM25');
      expect(response.body.combinedPM25).toBeGreaterThan(35); // Should exceed EPA threshold
      expect(response.body.safetyViolation).toBeTruthy();
    });

    test('Should identify time-based conflicts', async () => {
      const burns = [
        {
          requestId: 1,
          requestedDate: '2025-09-15',
          requestedStartTime: '09:00',
          requestedEndTime: '11:00'
        },
        {
          requestId: 2,
          requestedDate: '2025-09-15',
          requestedStartTime: '10:00', // Overlaps with first
          requestedEndTime: '12:00'
        }
      ];
      
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({ burnRequests: burns });
      
      expect(response.status).toBe(200);
      expect(response.body.timeConflicts).toBeDefined();
      expect(response.body.timeConflicts.length).toBeGreaterThan(0);
    });

    test('Should handle wind direction in conflict detection', async () => {
      const burns = [
        {
          requestId: 1,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 100
        },
        {
          requestId: 2,
          lat: 40.0,
          lon: -119.99, // East of first burn
          areaHectares: 100
        }
      ];
      
      const weatherData = {
        windSpeed: 15,
        windDirection: 270 // Wind from west, blowing smoke east
      };
      
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({ burnRequests: burns, weather: weatherData });
      
      expect(response.status).toBe(200);
      expect(response.body.downwindConflicts).toBeDefined();
      // Burn 2 is downwind of Burn 1
      expect(response.body.downwindConflicts).toContainEqual(
        expect.objectContaining({
          upwindBurn: 1,
          downwindBurn: 2
        })
      );
    });

    test('Should return conflict-free status when appropriate', async () => {
      const burns = [
        {
          requestId: 1,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 10,
          requestedDate: '2025-09-15'
        },
        {
          requestId: 2,
          lat: 45.0, // Far away
          lon: -115.0,
          areaHectares: 10,
          requestedDate: '2025-09-16' // Different day
        }
      ];
      
      const response = await request(app)
        .post('/api/burn-requests/detect-conflicts')
        .send({ burnRequests: burns });
      
      expect(response.status).toBe(200);
      expect(response.body.conflicts).toHaveLength(0);
      expect(response.body.message).toMatch(/no conflicts/i);
    });
  });

  describe('POST /api/burn-requests/batch', () => {
    test('Should process multiple burn requests in batch', async () => {
      const batchRequests = [
        {
          farmId: 99001,
          fieldId: 99101,
          requestedDate: '2025-09-15',
          areaHectares: 50
        },
        {
          farmId: 99002,
          fieldId: 99102,
          requestedDate: '2025-09-15',
          areaHectares: 75
        },
        {
          farmId: 99003,
          fieldId: 99103,
          requestedDate: '2025-09-15',
          areaHectares: 100
        }
      ];
      
      const response = await request(app)
        .post('/api/burn-requests/batch')
        .send({ requests: batchRequests });
      
      expect(response.status).toBe(201);
      expect(response.body.processed).toBe(3);
      expect(response.body.successful).toBeLessThanOrEqual(3);
      expect(response.body.results).toHaveLength(3);
    });

    test('Should handle partial batch failures', async () => {
      const batchRequests = [
        {
          farmId: 99001,
          fieldId: 99101,
          requestedDate: '2025-09-15',
          areaHectares: 50
        },
        {
          farmId: 99002,
          fieldId: 99102,
          requestedDate: 'invalid-date', // Will fail
          areaHectares: 75
        },
        {
          farmId: 99003,
          fieldId: 99103,
          requestedDate: '2025-09-15',
          areaHectares: -100 // Will fail
        }
      ];
      
      const response = await request(app)
        .post('/api/burn-requests/batch')
        .send({ requests: batchRequests });
      
      expect(response.status).toBe(207); // Multi-status
      expect(response.body.successful).toBe(1);
      expect(response.body.failed).toBe(2);
      expect(response.body.errors).toHaveLength(2);
    });

    test('Should enforce batch size limits', async () => {
      const tooManyRequests = Array.from({ length: 101 }, (_, i) => ({
        farmId: 99000 + i,
        fieldId: 99100 + i,
        requestedDate: '2025-09-15',
        areaHectares: 50
      }));
      
      const response = await request(app)
        .post('/api/burn-requests/batch')
        .send({ requests: tooManyRequests });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/batch.*size.*limit/i);
      expect(response.body.maxBatchSize).toBe(100);
    });
  });

  describe('GET /api/burn-requests/analytics', () => {
    test('Should return burn request statistics', async () => {
      // Create test data
      await query(`
        INSERT INTO burn_requests (farm_id, field_id, requested_date, status, area_hectares)
        VALUES 
          (99001, 99101, '2025-09-15', 'completed', 100),
          (99002, 99102, '2025-09-16', 'completed', 150),
          (99003, 99103, '2025-09-17', 'scheduled', 75),
          (99004, 99104, '2025-09-18', 'pending', 50),
          (99005, 99105, '2025-09-19', 'cancelled', 25)
      `);
      
      const response = await request(app)
        .get('/api/burn-requests/analytics');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRequests');
      expect(response.body).toHaveProperty('completedBurns');
      expect(response.body).toHaveProperty('totalAreaBurned');
      expect(response.body).toHaveProperty('averageAreaPerBurn');
      expect(response.body).toHaveProperty('statusBreakdown');
      expect(response.body.totalRequests).toBeGreaterThanOrEqual(5);
    });

    test('Should calculate PM2.5 reduction metrics', async () => {
      const response = await request(app)
        .get('/api/burn-requests/analytics?includeEnvironmental=true');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('estimatedPM25Prevented');
      expect(response.body).toHaveProperty('conflictsResolved');
      expect(response.body).toHaveProperty('safetyIncidents');
    });

    test('Should provide time-series data', async () => {
      const response = await request(app)
        .get('/api/burn-requests/analytics/time-series?days=30');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeLessThanOrEqual(30);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('date');
        expect(response.body[0]).toHaveProperty('requests');
        expect(response.body[0]).toHaveProperty('completed');
        expect(response.body[0]).toHaveProperty('cancelled');
      }
    });
  });

  describe('Security and Validation', () => {
    test('Should sanitize input to prevent SQL injection', async () => {
      const maliciousRequest = {
        farmId: "1'; DROP TABLE burn_requests; --",
        fieldId: 99101,
        requestedDate: '2025-09-15',
        areaHectares: 100
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(maliciousRequest);
      
      // Should either sanitize or reject
      expect([400, 201]).toContain(response.status);
      
      // Verify table still exists
      const tableCheck = await query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'burn_requests'"
      );
      expect(tableCheck[0].count).toBeGreaterThan(0);
    });

    test('Should validate coordinate bounds', async () => {
      const invalidCoordinates = {
        farmId: 99001,
        fieldId: 99101,
        requestedDate: '2025-09-15',
        areaHectares: 100,
        lat: 200, // Invalid latitude
        lon: -500 // Invalid longitude
      };
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(invalidCoordinates);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/coordinate|latitude|longitude/i);
    });

    test('Should enforce authentication for sensitive operations', async () => {
      // Assuming auth middleware is in place
      const response = await request(app)
        .delete('/api/burn-requests/1')
        .set('Authorization', 'Bearer invalid-token');
      
      expect([401, 403]).toContain(response.status);
    });

    test('Should rate limit API requests', async () => {
      const requests = Array.from({ length: 150 }, () => 
        request(app).get('/api/burn-requests')
      );
      
      const responses = await Promise.all(requests);
      
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      if (rateLimited.length > 0) {
        expect(rateLimited[0].headers).toHaveProperty('x-ratelimit-limit');
        expect(rateLimited[0].headers).toHaveProperty('x-ratelimit-remaining');
      }
    });
  });
});

module.exports = {
  // Helper functions for testing
  createTestBurnRequest: async (data = {}) => {
    const defaults = {
      farmId: 99999,
      fieldId: 99999,
      requestedDate: '2025-09-15',
      areaHectares: 100,
      cropType: 'wheat_stubble',
      status: 'pending'
    };
    
    const requestData = { ...defaults, ...data };
    
    const result = await query(`
      INSERT INTO burn_requests 
      (farm_id, field_id, requested_date, area_hectares, crop_type, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      requestData.farmId,
      requestData.fieldId,
      requestData.requestedDate,
      requestData.areaHectares,
      requestData.cropType,
      requestData.status
    ]);
    
    return result.insertId;
  },
  
  cleanupTestData: async () => {
    await query('DELETE FROM burn_requests WHERE farm_id > 99000');
    await query('DELETE FROM burn_fields WHERE farm_id > 99000');
    await query('DELETE FROM farms WHERE farm_id > 99000');
  }
};