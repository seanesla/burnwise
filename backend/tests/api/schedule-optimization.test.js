const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { initializeDatabase, query, pool } = require('../../db/connection');
const ScheduleOptimizer = require('../../agents/optimizer');
require('dotenv').config();

describe('Schedule Optimization API Endpoints - Minimizing Deaths Through Optimal Scheduling', () => {
  let app;
  let server;
  let optimizer;
  
  beforeAll(async () => {
    await initializeDatabase();
    optimizer = new ScheduleOptimizer();
    
    // Create Express app with API routes
    app = express();
    app.use(express.json());
    
    // Import routes (assuming they exist)
    const scheduleRoutes = require('../../routes/schedule');
    app.use('/api/schedule', scheduleRoutes);
    
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
      await query('DELETE FROM burn_schedules WHERE schedule_id > 99000');
      await query('DELETE FROM optimization_runs WHERE run_id > 99000');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('POST /api/schedule/optimize - Simulated Annealing Optimization', () => {
    test('Should optimize schedule using simulated annealing algorithm', async () => {
      const burnRequests = [
        {
          requestId: 99001,
          farmId: 1,
          fieldId: 101,
          lat: 40.0,
          lon: -120.0,
          areaHectares: 100,
          priorityScore: 85,
          requestedDate: '2025-09-30',
          requestedStartTime: '09:00',
          requestedEndTime: '13:00'
        },
        {
          requestId: 99002,
          farmId: 2,
          fieldId: 102,
          lat: 40.01,
          lon: -120.01,
          areaHectares: 150,
          priorityScore: 90,
          requestedDate: '2025-09-30',
          requestedStartTime: '09:00',
          requestedEndTime: '13:00'
        },
        {
          requestId: 99003,
          farmId: 3,
          fieldId: 103,
          lat: 39.99,
          lon: -119.99,
          areaHectares: 75,
          priorityScore: 70,
          requestedDate: '2025-09-30',
          requestedStartTime: '10:00',
          requestedEndTime: '14:00'
        }
      ];
      
      const conflicts = [
        {
          requestId1: 99001,
          requestId2: 99002,
          severity: 'high',
          maxCombinedPM25: 85
        }
      ];
      
      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({ 
          burnRequests,
          conflicts,
          parameters: {
            maxIterations: 1000,
            initialTemperature: 1000,
            coolingRate: 0.95
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schedule');
      expect(response.body).toHaveProperty('cost');
      expect(response.body).toHaveProperty('improvements');
      expect(response.body).toHaveProperty('iterations');
      
      // Verify improvements
      const improvements = response.body.improvements;
      expect(improvements).toHaveProperty('conflictsResolved');
      expect(improvements).toHaveProperty('safetyScore');
      expect(improvements).toHaveProperty('priorityPreserved');
      
      // Cost should be minimized
      expect(response.body.cost).toBeGreaterThanOrEqual(0);
      
      // Schedule should contain all requests
      const schedule = response.body.schedule;
      expect(Object.keys(schedule)).toHaveLength(burnRequests.length);
    });

    test('Should respect priority scores during optimization', async () => {
      const burnRequests = [
        { requestId: 99001, priorityScore: 95, areaHectares: 100, lat: 40.0, lon: -120.0 },
        { requestId: 99002, priorityScore: 60, areaHectares: 100, lat: 40.0, lon: -120.0 },
        { requestId: 99003, priorityScore: 80, areaHectares: 100, lat: 40.0, lon: -120.0 }
      ];
      
      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({ 
          burnRequests,
          preservePriority: true 
        });
      
      expect(response.status).toBe(200);
      
      const schedule = response.body.schedule;
      
      // High priority burns should get preferred time slots
      const highPrioritySlot = schedule[99001];
      const lowPrioritySlot = schedule[99002];
      
      expect(highPrioritySlot).toBeDefined();
      expect(lowPrioritySlot).toBeDefined();
      
      // High priority should not be significantly delayed
      if (highPrioritySlot.delayed) {
        expect(highPrioritySlot.delayHours).toBeLessThan(6);
      }
    });

    test('Should minimize total PM2.5 exposure', async () => {
      const burnRequests = [
        { requestId: 99001, areaHectares: 200, fuelLoad: 25, lat: 40.0, lon: -120.0 },
        { requestId: 99002, areaHectares: 150, fuelLoad: 20, lat: 40.01, lon: -120.01 },
        { requestId: 99003, areaHectares: 100, fuelLoad: 15, lat: 39.99, lon: -119.99 }
      ];
      
      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({ 
          burnRequests,
          optimizationGoal: 'minimize_pm25' 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalPM25');
      expect(response.body).toHaveProperty('peakPM25');
      
      // Should be below dangerous levels
      expect(response.body.peakPM25).toBeLessThan(150); // Very unhealthy threshold
      
      // Should provide exposure timeline
      expect(response.body).toHaveProperty('exposureTimeline');
      const timeline = response.body.exposureTimeline;
      expect(Array.isArray(timeline)).toBeTruthy();
    });

    test('Should handle weather constraints in optimization', async () => {
      const burnRequests = [
        { requestId: 99001, lat: 40.0, lon: -120.0, requestedDate: '2025-09-30' },
        { requestId: 99002, lat: 40.1, lon: -120.1, requestedDate: '2025-09-30' }
      ];
      
      const weatherForecast = {
        '2025-09-30': {
          '06:00': { windSpeed: 5, humidity: 70, suitable: true },
          '09:00': { windSpeed: 15, humidity: 50, suitable: true },
          '12:00': { windSpeed: 25, humidity: 30, suitable: false },
          '15:00': { windSpeed: 20, humidity: 40, suitable: false }
        }
      };
      
      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({ 
          burnRequests,
          weatherForecast 
        });
      
      expect(response.status).toBe(200);
      
      const schedule = response.body.schedule;
      
      // Burns should be scheduled during suitable weather
      Object.values(schedule).forEach(slot => {
        if (slot.date === '2025-09-30') {
          const hour = parseInt(slot.start.split(':')[0]);
          expect(hour).toBeLessThan(12); // Before unsuitable weather
        }
      });
    });

    test('Should provide alternative schedules', async () => {
      const burnRequests = [
        { requestId: 99001, lat: 40.0, lon: -120.0, areaHectares: 100 },
        { requestId: 99002, lat: 40.01, lon: -120.01, areaHectares: 100 }
      ];
      
      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({ 
          burnRequests,
          generateAlternatives: true,
          alternativeCount: 3 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primary');
      expect(response.body).toHaveProperty('alternatives');
      
      const alternatives = response.body.alternatives;
      expect(Array.isArray(alternatives)).toBeTruthy();
      expect(alternatives.length).toBeLessThanOrEqual(3);
      
      alternatives.forEach(alt => {
        expect(alt).toHaveProperty('schedule');
        expect(alt).toHaveProperty('cost');
        expect(alt).toHaveProperty('tradeoffs');
      });
    });

    test('Should optimize multi-day burn campaigns', async () => {
      const burnRequests = Array.from({ length: 10 }, (_, i) => ({
        requestId: 99100 + i,
        lat: 40.0 + i * 0.01,
        lon: -120.0 + i * 0.01,
        areaHectares: 50 + i * 10,
        requestedDate: `2025-10-0${Math.floor(i / 3) + 1}`
      }));
      
      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({ 
          burnRequests,
          campaignMode: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('dailySchedules');
      
      const dailySchedules = response.body.dailySchedules;
      expect(Object.keys(dailySchedules).length).toBeGreaterThanOrEqual(3);
      
      // Each day should have reasonable number of burns
      Object.values(dailySchedules).forEach(daySchedule => {
        expect(daySchedule.burns.length).toBeLessThanOrEqual(5);
        expect(daySchedule).toHaveProperty('totalPM25');
        expect(daySchedule).toHaveProperty('safetyScore');
      });
    });
  });

  describe('GET /api/schedule/current - Retrieve Current Schedule', () => {
    test('Should retrieve schedule for specific date', async () => {
      // Insert test schedule
      await query(`
        INSERT INTO burn_schedules 
        (schedule_id, burn_request_id, scheduled_date, start_time, end_time, status)
        VALUES 
        (99001, 99101, '2025-09-30', '09:00', '11:00', 'confirmed'),
        (99002, 99102, '2025-09-30', '12:00', '14:00', 'confirmed'),
        (99003, 99103, '2025-09-30', '15:00', '17:00', 'tentative')
      `);
      
      const response = await request(app)
        .get('/api/schedule/current')
        .query({ date: '2025-09-30' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('date');
      expect(response.body).toHaveProperty('burns');
      expect(response.body.burns).toHaveLength(3);
      
      response.body.burns.forEach(burn => {
        expect(burn).toHaveProperty('burnRequestId');
        expect(burn).toHaveProperty('startTime');
        expect(burn).toHaveProperty('endTime');
        expect(burn).toHaveProperty('status');
      });
    });

    test('Should include conflict warnings in schedule', async () => {
      const response = await request(app)
        .get('/api/schedule/current')
        .query({ 
          date: '2025-09-30',
          includeWarnings: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('warnings');
      
      if (response.body.warnings.length > 0) {
        response.body.warnings.forEach(warning => {
          expect(warning).toHaveProperty('type');
          expect(warning).toHaveProperty('severity');
          expect(warning).toHaveProperty('affectedBurns');
          expect(warning).toHaveProperty('message');
        });
      }
    });

    test('Should show schedule utilization metrics', async () => {
      const response = await request(app)
        .get('/api/schedule/current')
        .query({ 
          date: '2025-09-30',
          includeMetrics: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
      
      const metrics = response.body.metrics;
      expect(metrics).toHaveProperty('totalBurns');
      expect(metrics).toHaveProperty('totalHectares');
      expect(metrics).toHaveProperty('utilizationRate');
      expect(metrics).toHaveProperty('safetyScore');
      expect(metrics).toHaveProperty('estimatedPM25Peak');
    });
  });

  describe('PUT /api/schedule/update - Manual Schedule Adjustments', () => {
    test('Should allow manual schedule adjustment', async () => {
      const adjustment = {
        burnRequestId: 99001,
        originalTime: '09:00',
        newTime: '14:00',
        date: '2025-09-30',
        reason: 'Farmer request'
      };
      
      const response = await request(app)
        .put('/api/schedule/update')
        .send(adjustment);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('updated');
      expect(response.body.updated).toBeTruthy();
      expect(response.body).toHaveProperty('newSchedule');
      expect(response.body).toHaveProperty('conflictCheck');
      
      // Should check for new conflicts
      if (response.body.conflictCheck.hasNewConflicts) {
        expect(response.body.conflictCheck.conflicts).toBeDefined();
      }
    });

    test('Should validate schedule changes for safety', async () => {
      const unsafeAdjustment = {
        burnRequestId: 99001,
        newTime: '14:00', // Peak heat time
        date: '2025-09-30',
        weather: {
          temperature: 95,
          humidity: 15,
          windSpeed: 30
        }
      };
      
      const response = await request(app)
        .put('/api/schedule/update')
        .send(unsafeAdjustment);
      
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/unsafe|weather|conditions/i);
        expect(response.body).toHaveProperty('safetyViolations');
      }
    });

    test('Should handle schedule swaps between burns', async () => {
      const swap = {
        burn1: { requestId: 99001, time: '09:00' },
        burn2: { requestId: 99002, time: '14:00' },
        date: '2025-09-30'
      };
      
      const response = await request(app)
        .put('/api/schedule/swap')
        .send(swap);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('swapped');
      expect(response.body.swapped).toBeTruthy();
      expect(response.body).toHaveProperty('newSchedule');
      
      // Verify times were swapped
      const newSchedule = response.body.newSchedule;
      expect(newSchedule[99001].time).toBe('14:00');
      expect(newSchedule[99002].time).toBe('09:00');
    });
  });

  describe('POST /api/schedule/constraints - Schedule with Constraints', () => {
    test('Should respect hard time constraints', async () => {
      const constraints = {
        burnRequests: [
          { requestId: 99001, lat: 40.0, lon: -120.0 },
          { requestId: 99002, lat: 40.1, lon: -120.1 }
        ],
        hardConstraints: {
          99001: { mustStartAfter: '10:00', mustEndBefore: '14:00' },
          99002: { blackoutPeriods: [{ start: '11:00', end: '13:00' }] }
        }
      };
      
      const response = await request(app)
        .post('/api/schedule/constraints')
        .send(constraints);
      
      expect(response.status).toBe(200);
      
      const schedule = response.body.schedule;
      
      // Verify constraints were respected
      const burn1 = schedule[99001];
      expect(parseInt(burn1.start.split(':')[0])).toBeGreaterThanOrEqual(10);
      expect(parseInt(burn1.end.split(':')[0])).toBeLessThanOrEqual(14);
      
      const burn2 = schedule[99002];
      const burn2Start = parseInt(burn2.start.split(':')[0]);
      expect(burn2Start < 11 || burn2Start >= 13).toBeTruthy();
    });

    test('Should handle equipment availability constraints', async () => {
      const constraints = {
        burnRequests: [
          { requestId: 99001, equipmentNeeded: ['water_truck', 'crew_a'] },
          { requestId: 99002, equipmentNeeded: ['water_truck', 'crew_b'] },
          { requestId: 99003, equipmentNeeded: ['crew_a'] }
        ],
        equipment: {
          water_truck: { count: 1 },
          crew_a: { count: 1 },
          crew_b: { count: 1 }
        }
      };
      
      const response = await request(app)
        .post('/api/schedule/constraints')
        .send(constraints);
      
      expect(response.status).toBe(200);
      
      const schedule = response.body.schedule;
      
      // Burns needing same equipment shouldn't overlap
      const burn1 = schedule[99001];
      const burn2 = schedule[99002];
      
      const overlap = (
        burn1.start < burn2.end && 
        burn2.start < burn1.end
      );
      
      expect(overlap).toBeFalsy();
    });

    test('Should enforce minimum separation between burns', async () => {
      const constraints = {
        burnRequests: [
          { requestId: 99001, lat: 40.0, lon: -120.0 },
          { requestId: 99002, lat: 40.001, lon: -120.001 } // Very close
        ],
        minimumSeparation: {
          time: 2, // 2 hours minimum between nearby burns
          distance: 1 // Within 1 km
        }
      };
      
      const response = await request(app)
        .post('/api/schedule/constraints')
        .send(constraints);
      
      expect(response.status).toBe(200);
      
      const schedule = response.body.schedule;
      const timeDiff = Math.abs(
        new Date(`2025-09-30 ${schedule[99001].end}`) - 
        new Date(`2025-09-30 ${schedule[99002].start}`)
      ) / 3600000;
      
      expect(timeDiff).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/schedule/optimization-history', () => {
    test('Should retrieve optimization run history', async () => {
      // Insert test optimization runs
      await query(`
        INSERT INTO optimization_runs 
        (run_id, run_date, initial_cost, final_cost, iterations, conflicts_resolved)
        VALUES 
        (99001, '2025-09-29', 1000, 250, 1000, 5),
        (99002, '2025-09-28', 800, 150, 800, 3)
      `);
      
      const response = await request(app)
        .get('/api/schedule/optimization-history');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
      response.body.forEach(run => {
        expect(run).toHaveProperty('runId');
        expect(run).toHaveProperty('initialCost');
        expect(run).toHaveProperty('finalCost');
        expect(run).toHaveProperty('improvement');
        expect(run.improvement).toBeGreaterThan(0);
      });
    });

    test('Should show optimization performance metrics', async () => {
      const response = await request(app)
        .get('/api/schedule/optimization-history/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('averageImprovement');
      expect(response.body).toHaveProperty('averageIterations');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('averageConflictsResolved');
    });
  });

  describe('POST /api/schedule/trade - Burn Window Trading', () => {
    test('Should allow farmers to trade burn windows', async () => {
      const trade = {
        farmer1: { farmId: 1, burnRequestId: 99001, currentSlot: '09:00' },
        farmer2: { farmId: 2, burnRequestId: 99002, currentSlot: '14:00' },
        date: '2025-09-30',
        reason: 'Better weather conditions for farmer 2 in morning'
      };
      
      const response = await request(app)
        .post('/api/schedule/trade')
        .send(trade);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tradeApproved');
      expect(response.body).toHaveProperty('newSchedule');
      expect(response.body).toHaveProperty('notifications');
      
      // Both farmers should be notified
      expect(response.body.notifications).toHaveLength(2);
    });

    test('Should validate trade safety before approval', async () => {
      const unsafeTrade = {
        farmer1: { 
          farmId: 1, 
          burnRequestId: 99001, 
          areaHectares: 200,
          currentSlot: '06:00' 
        },
        farmer2: { 
          farmId: 2, 
          burnRequestId: 99002, 
          areaHectares: 300,
          currentSlot: '14:00' // Would create dangerous PM2.5 if swapped
        }
      };
      
      const response = await request(app)
        .post('/api/schedule/trade')
        .send(unsafeTrade);
      
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('safetyViolation');
      }
    });
  });

  describe('GET /api/schedule/conflicts/:date', () => {
    test('Should identify scheduling conflicts for a date', async () => {
      const response = await request(app)
        .get('/api/schedule/conflicts/2025-09-30');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conflicts');
      expect(Array.isArray(response.body.conflicts)).toBeTruthy();
      
      response.body.conflicts.forEach(conflict => {
        expect(conflict).toHaveProperty('type');
        expect(conflict).toHaveProperty('burns');
        expect(conflict).toHaveProperty('severity');
        expect(conflict).toHaveProperty('resolution');
      });
    });
  });

  describe('POST /api/schedule/emergency-halt', () => {
    test('Should halt all burns for emergency conditions', async () => {
      const emergency = {
        date: '2025-09-30',
        reason: 'Wildfire detected in region',
        affectedArea: {
          minLat: 39.5,
          maxLat: 40.5,
          minLon: -120.5,
          maxLon: -119.5
        }
      };
      
      const response = await request(app)
        .post('/api/schedule/emergency-halt')
        .send(emergency);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('halted');
      expect(response.body.halted).toBeTruthy();
      expect(response.body).toHaveProperty('affectedBurns');
      expect(response.body).toHaveProperty('notificationsSent');
      
      // All affected burns should be cancelled
      response.body.affectedBurns.forEach(burn => {
        expect(burn.status).toBe('cancelled');
      });
    });
  });

  describe('Performance and Scalability', () => {
    test('Should optimize large-scale schedules efficiently', async () => {
      const largeBurnSet = Array.from({ length: 100 }, (_, i) => ({
        requestId: 99000 + i,
        lat: 40.0 + (i % 10) * 0.01,
        lon: -120.0 + Math.floor(i / 10) * 0.01,
        areaHectares: 50 + Math.random() * 100,
        priorityScore: 50 + Math.random() * 50
      }));
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/schedule/optimize')
        .send({ 
          burnRequests: largeBurnSet,
          parameters: {
            maxIterations: 500,
            quickMode: true
          }
        });
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(response.body.schedule).toBeDefined();
      expect(Object.keys(response.body.schedule)).toHaveLength(100);
    });

    test('Should cache optimization results', async () => {
      const burnRequests = [
        { requestId: 99001, lat: 40.0, lon: -120.0, areaHectares: 100 }
      ];
      
      // First request
      const response1 = await request(app)
        .post('/api/schedule/optimize')
        .send({ burnRequests });
      
      expect(response1.status).toBe(200);
      expect(response1.headers['x-cache']).toBe('miss');
      
      // Second identical request
      const response2 = await request(app)
        .post('/api/schedule/optimize')
        .send({ burnRequests });
      
      expect(response2.status).toBe(200);
      expect(response2.headers['x-cache']).toBe('hit');
      expect(response2.body).toEqual(response1.body);
    });
  });

  describe('Real-time Schedule Updates', () => {
    test('Should support WebSocket for schedule updates', async () => {
      const response = await request(app)
        .get('/api/schedule/subscribe')
        .query({ date: '2025-09-30' });
      
      expect([101, 200, 426]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('subscriptionId');
        expect(response.body).toHaveProperty('updateFrequency');
      }
    });

    test('Should notify affected parties of schedule changes', async () => {
      const change = {
        burnRequestId: 99001,
        changeType: 'time_change',
        oldTime: '09:00',
        newTime: '14:00',
        reason: 'Weather update'
      };
      
      const response = await request(app)
        .post('/api/schedule/notify-change')
        .send(change);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notified');
      expect(Array.isArray(response.body.notified)).toBeTruthy();
      expect(response.body.notified.length).toBeGreaterThan(0);
    });
  });
});

module.exports = {
  // Helper functions for schedule optimization testing
  calculateOptimizationCost: (schedule, conflicts, priorities) => {
    let cost = 0;
    
    // Conflict cost
    cost += conflicts.length * 100;
    
    // Priority violation cost
    priorities.forEach(p => {
      if (schedule[p.id]?.delayed) {
        cost += p.priority * schedule[p.id].delayHours;
      }
    });
    
    return cost;
  },
  
  validateScheduleSafety: (schedule) => {
    const issues = [];
    
    Object.values(schedule).forEach(slot => {
      if (slot.pm25 > 35) {
        issues.push({ type: 'pm25_violation', slot });
      }
      
      const hour = parseInt(slot.start.split(':')[0]);
      if (hour >= 12 && hour < 16) {
        issues.push({ type: 'peak_heat', slot });
      }
    });
    
    return { safe: issues.length === 0, issues };
  }
};