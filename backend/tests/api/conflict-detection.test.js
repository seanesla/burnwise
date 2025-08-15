const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { initializeDatabase, query, pool } = require('../../db/connection');
const SmokeOverlapPredictor = require('../../agents/predictor');
require('dotenv').config();

describe('Conflict Detection API Endpoints - Preventing Deaths from Smoke Overlap', () => {
  let app;
  let server;
  let predictor;
  
  beforeAll(async () => {
    await initializeDatabase();
    predictor = new SmokeOverlapPredictor();
    
    // Create Express app with API routes
    app = express();
    app.use(express.json());
    
    // Import routes (assuming they exist)
    const conflictRoutes = require('../../routes/conflicts');
    app.use('/api/conflicts', conflictRoutes);
    
    // Start test server
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
  
  beforeEach(async () => {
    // Clean test data
    try {
      await query('DELETE FROM burn_conflicts WHERE request_id_1 > 99000 OR request_id_2 > 99000');
      await query('DELETE FROM smoke_predictions WHERE burn_request_id > 99000');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('POST /api/conflicts/detect - Smoke Overlap Detection', () => {
    test('Should detect critical PM2.5 overlap between adjacent burns', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 200,
          fuelLoad: 25,
          requestedDate: '2025-09-25',
          requestedStartTime: '09:00',
          requestedEndTime: '13:00'
        },
        {
          requestId: 99002,
          lat: 40.005, // ~550m away
          lon: -120.005,
          areaHectares: 150,
          fuelLoad: 20,
          requestedDate: '2025-09-25',
          requestedStartTime: '09:00',
          requestedEndTime: '13:00'
        }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ 
          burnRequests,
          weather: { windSpeed: 10, windDirection: 180, humidity: 40 }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conflicts');
      expect(response.body.conflicts.length).toBeGreaterThan(0);
      
      const conflict = response.body.conflicts[0];
      expect(conflict).toHaveProperty('requestId1');
      expect(conflict).toHaveProperty('requestId2');
      expect(conflict).toHaveProperty('severity');
      expect(conflict).toHaveProperty('maxCombinedPM25');
      expect(conflict.maxCombinedPM25).toBeGreaterThan(35); // EPA threshold
      expect(['critical', 'high']).toContain(conflict.severity);
    });

    test('Should calculate smoke plume intersection zones', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 100,
          windSpeed: 15,
          windDirection: 270 // West wind
        },
        {
          requestId: 99002,
          lat: 40.0,
          lon: -119.99, // East of first burn (downwind)
          areaHectares: 100
        }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('intersectionZones');
      
      const zones = response.body.intersectionZones;
      expect(Array.isArray(zones)).toBeTruthy();
      
      if (zones.length > 0) {
        expect(zones[0]).toHaveProperty('geometry');
        expect(zones[0]).toHaveProperty('area');
        expect(zones[0]).toHaveProperty('peakPM25');
        expect(zones[0]).toHaveProperty('affectedPopulation');
      }
    });

    test('Should identify downwind smoke drift conflicts', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 150
        },
        {
          requestId: 99002,
          lat: 40.05, // North
          lon: -120.0,
          areaHectares: 100
        },
        {
          requestId: 99003,
          lat: 39.95, // South
          lon: -120.0,
          areaHectares: 100
        }
      ];
      
      const weather = {
        windSpeed: 20,
        windDirection: 0 // North wind (blowing south)
      };
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests, weather });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('downwindConflicts');
      
      // Burn 99002 smoke should affect burns to the south
      const downwindConflicts = response.body.downwindConflicts;
      const northToSouthConflict = downwindConflicts.find(
        c => c.upwindBurn === 99002 && (c.downwindBurn === 99001 || c.downwindBurn === 99003)
      );
      
      expect(northToSouthConflict).toBeDefined();
      expect(northToSouthConflict).toHaveProperty('driftDistance');
      expect(northToSouthConflict).toHaveProperty('arrivalTime');
    });

    test('Should detect temporal conflicts with smoke persistence', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 200,
          requestedDate: '2025-09-25',
          requestedStartTime: '09:00',
          requestedEndTime: '11:00'
        },
        {
          requestId: 99002,
          lat: 40.01,
          lon: -120.01,
          areaHectares: 150,
          requestedDate: '2025-09-25',
          requestedStartTime: '12:00', // After first burn ends
          requestedEndTime: '14:00'
        }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ 
          burnRequests,
          checkPersistence: true 
        });
      
      expect(response.status).toBe(200);
      
      // Should detect conflict if smoke persists
      if (response.body.persistenceConflicts?.length > 0) {
        const conflict = response.body.persistenceConflicts[0];
        expect(conflict).toHaveProperty('persistenceHours');
        expect(conflict).toHaveProperty('residualPM25');
        expect(conflict.persistenceHours).toBeGreaterThan(0);
      }
    });

    test('Should generate 64-dimensional smoke vectors for conflicts', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 100
        }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ 
          burnRequests,
          includeVectors: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('smokeVectors');
      
      const vectors = response.body.smokeVectors;
      expect(vectors[99001]).toBeDefined();
      expect(vectors[99001]).toHaveLength(64);
      expect(vectors[99001].every(v => typeof v === 'number')).toBeTruthy();
    });

    test('Should identify population center impacts', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 300
        }
      ];
      
      const populationCenters = [
        { name: 'Town A', lat: 40.02, lon: -120.02, population: 5000 },
        { name: 'City B', lat: 40.05, lon: -120.05, population: 20000 }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests, populationCenters });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('populationImpacts');
      
      const impacts = response.body.populationImpacts;
      expect(Array.isArray(impacts)).toBeTruthy();
      
      impacts.forEach(impact => {
        expect(impact).toHaveProperty('centerName');
        expect(impact).toHaveProperty('population');
        expect(impact).toHaveProperty('estimatedPM25');
        expect(impact).toHaveProperty('healthRisk');
        expect(['low', 'moderate', 'high', 'severe']).toContain(impact.healthRisk);
      });
    });

    test('Should calculate cumulative PM2.5 exposure', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 100,
          duration: 4
        },
        {
          requestId: 99002,
          lat: 40.01,
          lon: -120.01,
          areaHectares: 150,
          duration: 4
        },
        {
          requestId: 99003,
          lat: 39.99,
          lon: -119.99,
          areaHectares: 200,
          duration: 4
        }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cumulativeExposure');
      
      const exposure = response.body.cumulativeExposure;
      expect(exposure).toHaveProperty('peak24HourPM25');
      expect(exposure).toHaveProperty('exceedsNAAQS');
      expect(exposure.peak24HourPM25).toBeGreaterThan(0);
      
      if (exposure.peak24HourPM25 > 35) {
        expect(exposure.exceedsNAAQS).toBeTruthy();
      }
    });

    test('Should handle no conflicts scenario', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 10,
          requestedDate: '2025-09-25'
        },
        {
          requestId: 99002,
          lat: 45.0, // Very far away
          lon: -115.0,
          areaHectares: 10,
          requestedDate: '2025-09-26' // Different day
        }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conflicts');
      expect(response.body.conflicts).toHaveLength(0);
      expect(response.body).toHaveProperty('safe');
      expect(response.body.safe).toBeTruthy();
    });
  });

  describe('GET /api/conflicts/active - Retrieve Active Conflicts', () => {
    test('Should retrieve all active conflicts', async () => {
      // Insert test conflicts
      await query(`
        INSERT INTO burn_conflicts 
        (request_id_1, request_id_2, conflict_severity, max_combined_pm25, detected_at)
        VALUES 
        (99001, 99002, 'high', 85.5, NOW()),
        (99003, 99004, 'critical', 150.2, NOW()),
        (99005, 99006, 'moderate', 45.0, NOW())
      `);
      
      const response = await request(app)
        .get('/api/conflicts/active');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThanOrEqual(3);
      
      response.body.forEach(conflict => {
        expect(conflict).toHaveProperty('requestId1');
        expect(conflict).toHaveProperty('requestId2');
        expect(conflict).toHaveProperty('severity');
        expect(conflict).toHaveProperty('maxCombinedPM25');
      });
    });

    test('Should filter conflicts by severity', async () => {
      await query(`
        INSERT INTO burn_conflicts 
        (request_id_1, request_id_2, conflict_severity, max_combined_pm25)
        VALUES 
        (99001, 99002, 'critical', 200.0),
        (99003, 99004, 'high', 85.0),
        (99005, 99006, 'moderate', 45.0),
        (99007, 99008, 'low', 20.0)
      `);
      
      const response = await request(app)
        .get('/api/conflicts/active?minSeverity=high');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      
      response.body.forEach(conflict => {
        expect(['critical', 'high']).toContain(conflict.severity);
      });
    });

    test('Should filter conflicts by date range', async () => {
      const response = await request(app)
        .get('/api/conflicts/active')
        .query({
          startDate: '2025-09-25',
          endDate: '2025-09-27'
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      
      response.body.forEach(conflict => {
        const date = new Date(conflict.detectedAt);
        expect(date >= new Date('2025-09-25')).toBeTruthy();
        expect(date <= new Date('2025-09-27T23:59:59')).toBeTruthy();
      });
    });

    test('Should include resolution status', async () => {
      await query(`
        INSERT INTO burn_conflicts 
        (request_id_1, request_id_2, conflict_severity, resolution_status)
        VALUES 
        (99001, 99002, 'high', 'resolved'),
        (99003, 99004, 'critical', 'pending'),
        (99005, 99006, 'moderate', 'ignored')
      `);
      
      const response = await request(app)
        .get('/api/conflicts/active?includeResolved=false');
      
      expect(response.status).toBe(200);
      
      response.body.forEach(conflict => {
        expect(conflict.resolutionStatus).not.toBe('resolved');
      });
    });
  });

  describe('POST /api/conflicts/resolve - Conflict Resolution', () => {
    test('Should resolve conflict by rescheduling', async () => {
      const resolution = {
        conflictId: 99001,
        resolution: 'reschedule',
        changes: {
          request99001: { newStartTime: '14:00', newEndTime: '18:00' },
          request99002: { newDate: '2025-09-26' }
        }
      };
      
      const response = await request(app)
        .post('/api/conflicts/resolve')
        .send(resolution);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resolved');
      expect(response.body.resolved).toBeTruthy();
      expect(response.body).toHaveProperty('updatedSchedule');
      expect(response.body).toHaveProperty('notifications');
    });

    test('Should resolve conflict by area reduction', async () => {
      const resolution = {
        conflictId: 99002,
        resolution: 'reduce_area',
        changes: {
          request99001: { newAreaHectares: 50 },
          request99002: { newAreaHectares: 75 }
        }
      };
      
      const response = await request(app)
        .post('/api/conflicts/resolve')
        .send(resolution);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('newPM25Estimate');
      expect(response.body.newPM25Estimate).toBeLessThan(35); // Should be safe now
    });

    test('Should cancel burn request to resolve conflict', async () => {
      const resolution = {
        conflictId: 99003,
        resolution: 'cancel',
        cancelRequestId: 99002,
        reason: 'Safety priority - excessive PM2.5'
      };
      
      const response = await request(app)
        .post('/api/conflicts/resolve')
        .send(resolution);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cancelled');
      expect(response.body.cancelled).toBeTruthy();
      expect(response.body).toHaveProperty('affectedFarmers');
      expect(response.body).toHaveProperty('notificationsSent');
    });

    test('Should validate resolution feasibility', async () => {
      const invalidResolution = {
        conflictId: 99004,
        resolution: 'reschedule',
        changes: {
          request99001: { newStartTime: '25:00' } // Invalid time
        }
      };
      
      const response = await request(app)
        .post('/api/conflicts/resolve')
        .send(invalidResolution);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|time/i);
    });

    test('Should trigger re-analysis after resolution', async () => {
      const resolution = {
        conflictId: 99005,
        resolution: 'reschedule',
        changes: {
          request99001: { newStartTime: '06:00' }
        },
        reanalyze: true
      };
      
      const response = await request(app)
        .post('/api/conflicts/resolve')
        .send(resolution);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reanalysis');
      expect(response.body.reanalysis).toHaveProperty('newConflicts');
      expect(response.body.reanalysis).toHaveProperty('safety');
    });
  });

  describe('GET /api/conflicts/matrix - Conflict Matrix', () => {
    test('Should generate conflict matrix for all burns', async () => {
      const response = await request(app)
        .get('/api/conflicts/matrix')
        .query({ date: '2025-09-25' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matrix');
      expect(response.body).toHaveProperty('burns');
      
      const matrix = response.body.matrix;
      const burns = response.body.burns;
      
      // Matrix should be square
      expect(matrix.length).toBe(burns.length);
      matrix.forEach(row => {
        expect(row.length).toBe(burns.length);
      });
      
      // Diagonal should be null (no self-conflict)
      for (let i = 0; i < matrix.length; i++) {
        expect(matrix[i][i]).toBeNull();
      }
    });

    test('Should show conflict severity in matrix', async () => {
      const response = await request(app)
        .get('/api/conflicts/matrix')
        .query({ 
          date: '2025-09-25',
          includeSeverity: true 
        });
      
      expect(response.status).toBe(200);
      
      const matrix = response.body.matrix;
      matrix.forEach(row => {
        row.forEach(cell => {
          if (cell !== null) {
            expect(['none', 'low', 'moderate', 'high', 'critical']).toContain(cell);
          }
        });
      });
    });

    test('Should identify conflict clusters', async () => {
      const response = await request(app)
        .get('/api/conflicts/matrix')
        .query({ 
          date: '2025-09-25',
          identifyClusters: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('clusters');
      
      const clusters = response.body.clusters;
      expect(Array.isArray(clusters)).toBeTruthy();
      
      clusters.forEach(cluster => {
        expect(cluster).toHaveProperty('burns');
        expect(cluster).toHaveProperty('severity');
        expect(cluster).toHaveProperty('centerPoint');
        expect(Array.isArray(cluster.burns)).toBeTruthy();
        expect(cluster.burns.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('POST /api/conflicts/simulate - Conflict Simulation', () => {
    test('Should simulate conflicts for proposed burn', async () => {
      const proposedBurn = {
        lat: 40.0,
        lon: -120.0,
        areaHectares: 150,
        requestedDate: '2025-09-25',
        requestedStartTime: '09:00'
      };
      
      const existingBurns = [
        { requestId: 99001, lat: 40.01, lon: -120.01, areaHectares: 100 },
        { requestId: 99002, lat: 39.99, lon: -119.99, areaHectares: 100 }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/simulate')
        .send({ proposedBurn, existingBurns });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('simulatedConflicts');
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body).toHaveProperty('alternativeTimes');
    });

    test('Should find conflict-free time slots', async () => {
      const proposedBurn = {
        lat: 40.0,
        lon: -120.0,
        areaHectares: 100,
        requestedDate: '2025-09-25',
        duration: 4
      };
      
      const response = await request(app)
        .post('/api/conflicts/simulate')
        .send({ 
          proposedBurn,
          findOptimalTime: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('optimalSlots');
      
      const slots = response.body.optimalSlots;
      expect(Array.isArray(slots)).toBeTruthy();
      
      slots.forEach(slot => {
        expect(slot).toHaveProperty('startTime');
        expect(slot).toHaveProperty('endTime');
        expect(slot).toHaveProperty('conflictScore');
        expect(slot).toHaveProperty('weatherScore');
        expect(slot).toHaveProperty('overallScore');
      });
    });

    test('Should simulate wind direction changes', async () => {
      const proposedBurn = {
        lat: 40.0,
        lon: -120.0,
        areaHectares: 100
      };
      
      const windScenarios = [
        { direction: 0, speed: 10 },   // North
        { direction: 90, speed: 10 },  // East
        { direction: 180, speed: 10 }, // South
        { direction: 270, speed: 10 }  // West
      ];
      
      const response = await request(app)
        .post('/api/conflicts/simulate')
        .send({ 
          proposedBurn,
          windScenarios 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('windAnalysis');
      
      const analysis = response.body.windAnalysis;
      expect(Array.isArray(analysis)).toBeTruthy();
      expect(analysis).toHaveLength(4);
      
      analysis.forEach((scenario, index) => {
        expect(scenario).toHaveProperty('windDirection');
        expect(scenario.windDirection).toBe(windScenarios[index].direction);
        expect(scenario).toHaveProperty('affectedAreas');
        expect(scenario).toHaveProperty('conflicts');
      });
    });
  });

  describe('GET /api/conflicts/history - Historical Conflicts', () => {
    test('Should retrieve conflict history', async () => {
      const response = await request(app)
        .get('/api/conflicts/history')
        .query({
          startDate: '2025-08-01',
          endDate: '2025-08-31'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conflicts');
      expect(response.body).toHaveProperty('statistics');
      
      const stats = response.body.statistics;
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('resolved');
      expect(stats).toHaveProperty('cancelled');
      expect(stats).toHaveProperty('averagePM25');
    });

    test('Should analyze conflict patterns', async () => {
      const response = await request(app)
        .get('/api/conflicts/history/patterns');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('patterns');
      
      const patterns = response.body.patterns;
      expect(patterns).toHaveProperty('commonTimes');
      expect(patterns).toHaveProperty('commonLocations');
      expect(patterns).toHaveProperty('weatherConditions');
      expect(patterns).toHaveProperty('resolutionMethods');
    });

    test('Should provide conflict prevention insights', async () => {
      const response = await request(app)
        .get('/api/conflicts/history/insights');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('insights');
      
      const insights = response.body.insights;
      expect(Array.isArray(insights)).toBeTruthy();
      
      insights.forEach(insight => {
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('frequency');
        expect(insight).toHaveProperty('recommendation');
      });
    });
  });

  describe('POST /api/conflicts/batch-analysis - Batch Conflict Analysis', () => {
    test('Should analyze conflicts for multiple burn sets', async () => {
      const burnSets = [
        {
          setId: 'A',
          burns: [
            { lat: 40.0, lon: -120.0, area: 100 },
            { lat: 40.01, lon: -120.01, area: 100 }
          ]
        },
        {
          setId: 'B',
          burns: [
            { lat: 40.0, lon: -120.0, area: 50 },
            { lat: 40.02, lon: -120.02, area: 50 }
          ]
        }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/batch-analysis')
        .send({ burnSets });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      
      const results = response.body.results;
      expect(results.A).toBeDefined();
      expect(results.B).toBeDefined();
      
      Object.values(results).forEach(result => {
        expect(result).toHaveProperty('conflicts');
        expect(result).toHaveProperty('totalPM25');
        expect(result).toHaveProperty('safetyScore');
      });
    });

    test('Should rank burn sets by safety', async () => {
      const burnSets = [
        { setId: 'A', burns: [{ lat: 40.0, lon: -120.0, area: 200 }] },
        { setId: 'B', burns: [{ lat: 40.0, lon: -120.0, area: 50 }] },
        { setId: 'C', burns: [{ lat: 40.0, lon: -120.0, area: 100 }] }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/batch-analysis')
        .send({ 
          burnSets,
          rankBySafety: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ranking');
      
      const ranking = response.body.ranking;
      expect(Array.isArray(ranking)).toBeTruthy();
      expect(ranking[0].safetyScore).toBeGreaterThanOrEqual(ranking[1].safetyScore);
    });
  });

  describe('Real-time Conflict Monitoring', () => {
    test('Should support WebSocket for real-time conflict updates', async () => {
      const response = await request(app)
        .get('/api/conflicts/subscribe')
        .query({ burnRequestId: 99001 });
      
      expect([101, 200, 426]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('subscriptionId');
        expect(response.body).toHaveProperty('channel');
      }
    });

    test('Should trigger alerts for new conflicts', async () => {
      const newBurn = {
        requestId: 99010,
        lat: 40.0,
        lon: -120.0,
        areaHectares: 200
      };
      
      const response = await request(app)
        .post('/api/conflicts/check-immediate')
        .send({ newBurn });
      
      expect(response.status).toBe(200);
      
      if (response.body.hasConflicts) {
        expect(response.body).toHaveProperty('alerts');
        expect(response.body.alerts.length).toBeGreaterThan(0);
        expect(response.body).toHaveProperty('urgency');
        expect(['low', 'medium', 'high', 'critical']).toContain(response.body.urgency);
      }
    });
  });

  describe('Conflict Visualization Data', () => {
    test('Should provide GeoJSON for conflict zones', async () => {
      const response = await request(app)
        .get('/api/conflicts/geojson')
        .query({ date: '2025-09-25' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('type');
      expect(response.body.type).toBe('FeatureCollection');
      expect(response.body).toHaveProperty('features');
      
      response.body.features.forEach(feature => {
        expect(feature).toHaveProperty('type');
        expect(feature.type).toBe('Feature');
        expect(feature).toHaveProperty('geometry');
        expect(feature).toHaveProperty('properties');
        expect(feature.properties).toHaveProperty('severity');
        expect(feature.properties).toHaveProperty('pm25Level');
      });
    });

    test('Should generate heatmap data for PM2.5 concentrations', async () => {
      const response = await request(app)
        .get('/api/conflicts/heatmap')
        .query({
          minLat: 39.5,
          maxLat: 40.5,
          minLon: -120.5,
          maxLon: -119.5,
          resolution: 0.01
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('grid');
      expect(Array.isArray(response.body.grid)).toBeTruthy();
      
      response.body.grid.forEach(cell => {
        expect(cell).toHaveProperty('lat');
        expect(cell).toHaveProperty('lon');
        expect(cell).toHaveProperty('pm25');
        expect(cell).toHaveProperty('sources');
      });
    });
  });

  describe('Security and Validation', () => {
    test('Should validate coordinate bounds', async () => {
      const invalidBurns = [
        { requestId: 1, lat: 200, lon: 0, area: 100 },
        { requestId: 2, lat: 0, lon: 400, area: 100 }
      ];
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests: invalidBurns });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/coordinate|invalid/i);
    });

    test('Should sanitize input data', async () => {
      const maliciousBurn = {
        requestId: "1'; DROP TABLE burn_conflicts; --",
        lat: 40.0,
        lon: -120.0,
        areaHectares: 100
      };
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests: [maliciousBurn] });
      
      expect([200, 400]).toContain(response.status);
      
      // Verify table still exists
      const tableCheck = await query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'burn_conflicts'"
      );
      expect(tableCheck[0].count).toBeGreaterThan(0);
    });

    test('Should enforce request size limits', async () => {
      const tooManyBurns = Array.from({ length: 1001 }, (_, i) => ({
        requestId: i,
        lat: 40.0 + Math.random(),
        lon: -120.0 + Math.random(),
        areaHectares: 50
      }));
      
      const response = await request(app)
        .post('/api/conflicts/detect')
        .send({ burnRequests: tooManyBurns });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/too many|limit/i);
    });
  });
});

module.exports = {
  // Helper functions for conflict testing
  calculatePM25Overlap: (burn1, burn2, windSpeed, windDirection) => {
    const distance = Math.sqrt(
      Math.pow(burn1.lat - burn2.lat, 2) + 
      Math.pow(burn1.lon - burn2.lon, 2)
    ) * 111; // Convert to km
    
    const pm25_1 = burn1.areaHectares * 0.5; // Simplified
    const pm25_2 = burn2.areaHectares * 0.5;
    
    const overlap = Math.max(0, 1 - distance / 10); // Decay with distance
    return (pm25_1 + pm25_2) * overlap;
  },
  
  determineSeverity: (pm25) => {
    if (pm25 > 150) return 'critical';
    if (pm25 > 55) return 'high';
    if (pm25 > 35) return 'moderate';
    return 'low';
  }
};