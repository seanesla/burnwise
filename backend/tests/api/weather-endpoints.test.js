const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { initializeDatabase, query, pool } = require('../../db/connection');
const WeatherAgent = require('../../agents/weather');
require('dotenv').config();

describe('Weather API Endpoints - Critical Safety Analysis', () => {
  let app;
  let server;
  let weatherAgent;
  
  beforeAll(async () => {
    await initializeDatabase();
    weatherAgent = new WeatherAgent();
    
    // Create Express app with API routes
    app = express();
    app.use(express.json());
    
    // Import routes (assuming they exist)
    const weatherRoutes = require('../../routes/weather');
    app.use('/api/weather', weatherRoutes);
    
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
      await query('DELETE FROM weather_conditions WHERE observation_id LIKE "test_%"');
      await query('DELETE FROM weather_alerts WHERE alert_id > 99000');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('GET /api/weather/current - Current Weather Conditions', () => {
    test('Should fetch current weather for valid coordinates', async () => {
      const response = await request(app)
        .get('/api/weather/current')
        .query({ lat: 40.7128, lon: -74.0060 }); // New York
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('temperature');
      expect(response.body).toHaveProperty('humidity');
      expect(response.body).toHaveProperty('windSpeed');
      expect(response.body).toHaveProperty('windDirection');
      expect(response.body).toHaveProperty('pressure');
      
      // Validate ranges
      expect(response.body.humidity).toBeGreaterThanOrEqual(0);
      expect(response.body.humidity).toBeLessThanOrEqual(100);
      expect(response.body.windSpeed).toBeGreaterThanOrEqual(0);
    });

    test('Should identify dangerous burn conditions', async () => {
      const response = await request(app)
        .get('/api/weather/current')
        .query({ lat: 40.0, lon: -120.0 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('burnSafety');
      
      const safety = response.body.burnSafety;
      expect(safety).toHaveProperty('isSafe');
      expect(safety).toHaveProperty('warnings');
      expect(safety).toHaveProperty('riskLevel');
      
      // If dangerous conditions exist
      if (!safety.isSafe) {
        expect(safety.warnings.length).toBeGreaterThan(0);
        expect(['low', 'moderate', 'high', 'extreme']).toContain(safety.riskLevel);
      }
    });

    test('Should calculate atmospheric stability class', async () => {
      const response = await request(app)
        .get('/api/weather/current')
        .query({ lat: 40.0, lon: -120.0 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stabilityClass');
      
      const stability = response.body.stabilityClass;
      expect(['A', 'B', 'C', 'D', 'E', 'F']).toContain(stability.class);
      expect(stability).toHaveProperty('description');
      expect(stability).toHaveProperty('mixingHeight');
      expect(stability.mixingHeight).toBeGreaterThan(0);
    });

    test('Should generate 128-dimensional weather vector', async () => {
      const response = await request(app)
        .get('/api/weather/current')
        .query({ 
          lat: 40.0, 
          lon: -120.0,
          includeVector: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('weatherVector');
      expect(response.body.weatherVector).toHaveLength(128);
      expect(response.body.weatherVector.every(v => typeof v === 'number')).toBeTruthy();
      expect(response.body.weatherVector.every(v => !isNaN(v) && isFinite(v))).toBeTruthy();
    });

    test('Should cache weather data for efficiency', async () => {
      const coords = { lat: 40.0, lon: -120.0 };
      
      // First request
      const response1 = await request(app)
        .get('/api/weather/current')
        .query(coords);
      
      expect(response1.status).toBe(200);
      expect(response1.headers).toHaveProperty('x-cache');
      expect(response1.headers['x-cache']).toBe('miss');
      
      // Second request (should be cached)
      const response2 = await request(app)
        .get('/api/weather/current')
        .query(coords);
      
      expect(response2.status).toBe(200);
      expect(response2.headers['x-cache']).toBe('hit');
      expect(response2.body).toEqual(response1.body);
    });

    test('Should reject invalid coordinates', async () => {
      const invalidRequests = [
        { lat: 200, lon: 0 },      // Invalid latitude
        { lat: 0, lon: 300 },       // Invalid longitude
        { lat: 'abc', lon: 'def' }, // Non-numeric
        { lat: null, lon: null },   // Null values
        {}                          // Missing coordinates
      ];
      
      for (const coords of invalidRequests) {
        const response = await request(app)
          .get('/api/weather/current')
          .query(coords);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/coordinate|invalid|required/i);
      }
    });

    test('Should handle API failures gracefully', async () => {
      // Test with coordinates that might trigger rate limiting
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/weather/current')
          .query({ lat: Math.random() * 180 - 90, lon: Math.random() * 360 - 180 })
      );
      
      const responses = await Promise.all(requests);
      
      // Should handle failures gracefully
      responses.forEach(response => {
        expect([200, 429, 503]).toContain(response.status);
        if (response.status !== 200) {
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('fallback');
        }
      });
    });
  });

  describe('GET /api/weather/forecast - Weather Forecast', () => {
    test('Should fetch 5-day weather forecast', async () => {
      const response = await request(app)
        .get('/api/weather/forecast')
        .query({ lat: 40.0, lon: -120.0, days: 5 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('forecast');
      expect(Array.isArray(response.body.forecast)).toBeTruthy();
      expect(response.body.forecast.length).toBeGreaterThan(0);
      
      // Validate forecast structure
      response.body.forecast.forEach(entry => {
        expect(entry).toHaveProperty('datetime');
        expect(entry).toHaveProperty('temperature');
        expect(entry).toHaveProperty('humidity');
        expect(entry).toHaveProperty('windSpeed');
        expect(entry).toHaveProperty('precipitation');
        expect(entry).toHaveProperty('burnSuitability');
      });
    });

    test('Should identify optimal burn windows', async () => {
      const response = await request(app)
        .get('/api/weather/forecast')
        .query({ 
          lat: 40.0, 
          lon: -120.0,
          findBurnWindows: true 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('burnWindows');
      expect(Array.isArray(response.body.burnWindows)).toBeTruthy();
      
      response.body.burnWindows.forEach(window => {
        expect(window).toHaveProperty('start');
        expect(window).toHaveProperty('end');
        expect(window).toHaveProperty('quality');
        expect(window).toHaveProperty('avgPM25');
        expect(['excellent', 'good', 'fair', 'poor']).toContain(window.quality);
      });
    });

    test('Should calculate cumulative PM2.5 exposure', async () => {
      const response = await request(app)
        .get('/api/weather/forecast')
        .query({
          lat: 40.0,
          lon: -120.0,
          burnArea: 100,
          fuelLoad: 20
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pm25Forecast');
      
      const pm25 = response.body.pm25Forecast;
      expect(Array.isArray(pm25)).toBeTruthy();
      
      pm25.forEach(entry => {
        expect(entry).toHaveProperty('datetime');
        expect(entry).toHaveProperty('concentration');
        expect(entry).toHaveProperty('aqi');
        expect(entry).toHaveProperty('healthCategory');
      });
    });

    test('Should detect extreme weather events', async () => {
      const response = await request(app)
        .get('/api/weather/forecast')
        .query({ lat: 40.0, lon: -120.0 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alerts');
      
      if (response.body.alerts.length > 0) {
        response.body.alerts.forEach(alert => {
          expect(alert).toHaveProperty('type');
          expect(alert).toHaveProperty('severity');
          expect(alert).toHaveProperty('startTime');
          expect(alert).toHaveProperty('endTime');
          expect(alert).toHaveProperty('impact');
          expect(['advisory', 'watch', 'warning', 'emergency']).toContain(alert.severity);
        });
      }
    });

    test('Should validate forecast time range', async () => {
      const invalidRanges = [
        { days: 0 },
        { days: -1 },
        { days: 20 }, // Too far
        { days: 'abc' }
      ];
      
      for (const range of invalidRanges) {
        const response = await request(app)
          .get('/api/weather/forecast')
          .query({ lat: 40.0, lon: -120.0, ...range });
        
        expect([200, 400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.error).toMatch(/range|days|invalid/i);
        }
      }
    });

    test('Should provide hourly forecast granularity', async () => {
      const response = await request(app)
        .get('/api/weather/forecast')
        .query({
          lat: 40.0,
          lon: -120.0,
          hours: 24,
          granularity: 'hourly'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.forecast).toHaveLength(24);
      
      // Verify hourly progression
      for (let i = 1; i < response.body.forecast.length; i++) {
        const prev = new Date(response.body.forecast[i - 1].datetime);
        const curr = new Date(response.body.forecast[i].datetime);
        const hourDiff = (curr - prev) / (1000 * 60 * 60);
        expect(hourDiff).toBeCloseTo(1, 0);
      }
    });
  });

  describe('POST /api/weather/analyze - Burn Weather Analysis', () => {
    test('Should analyze weather suitability for burn request', async () => {
      const burnRequest = {
        lat: 40.0,
        lon: -120.0,
        requestedDate: '2025-09-20',
        requestedStartTime: '09:00',
        requestedEndTime: '13:00',
        areaHectares: 100,
        cropType: 'wheat_stubble',
        fuelLoad: 20
      };
      
      const response = await request(app)
        .post('/api/weather/analyze')
        .send(burnRequest);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('suitable');
      expect(response.body).toHaveProperty('score');
      expect(response.body).toHaveProperty('factors');
      
      const factors = response.body.factors;
      expect(factors).toHaveProperty('windSpeed');
      expect(factors).toHaveProperty('humidity');
      expect(factors).toHaveProperty('stability');
      expect(factors).toHaveProperty('precipitation');
    });

    test('Should calculate Gaussian plume dispersion', async () => {
      const burnData = {
        lat: 40.0,
        lon: -120.0,
        areaHectares: 150,
        fuelLoad: 25,
        windSpeed: 10,
        windDirection: 180,
        stabilityClass: 'D'
      };
      
      const response = await request(app)
        .post('/api/weather/analyze')
        .send(burnData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('plume');
      
      const plume = response.body.plume;
      expect(plume).toHaveProperty('maxConcentration');
      expect(plume).toHaveProperty('maxDistance');
      expect(plume).toHaveProperty('impactRadius');
      expect(plume).toHaveProperty('concentrationMap');
      
      // Verify concentration decreases with distance
      if (Array.isArray(plume.concentrationMap)) {
        for (let i = 1; i < plume.concentrationMap.length; i++) {
          expect(plume.concentrationMap[i].concentration)
            .toBeLessThanOrEqual(plume.concentrationMap[i - 1].concentration);
        }
      }
    });

    test('Should identify population exposure risks', async () => {
      const burnData = {
        lat: 40.0,
        lon: -120.0,
        areaHectares: 200,
        nearbyPopulationCenters: [
          { lat: 40.01, lon: -120.01, population: 5000 },
          { lat: 39.99, lon: -119.99, population: 10000 }
        ]
      };
      
      const response = await request(app)
        .post('/api/weather/analyze')
        .send(burnData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('populationExposure');
      
      const exposure = response.body.populationExposure;
      expect(exposure).toHaveProperty('totalExposed');
      expect(exposure).toHaveProperty('riskLevel');
      expect(exposure).toHaveProperty('recommendations');
      
      if (exposure.totalExposed > 0) {
        expect(exposure.recommendations.length).toBeGreaterThan(0);
      }
    });

    test('Should recommend alternative burn times', async () => {
      const burnRequest = {
        lat: 40.0,
        lon: -120.0,
        requestedDate: '2025-09-20',
        requestedStartTime: '14:00', // Afternoon - often poor conditions
        areaHectares: 100
      };
      
      const response = await request(app)
        .post('/api/weather/analyze')
        .send(burnRequest);
      
      expect(response.status).toBe(200);
      
      if (!response.body.suitable) {
        expect(response.body).toHaveProperty('alternatives');
        expect(Array.isArray(response.body.alternatives)).toBeTruthy();
        
        response.body.alternatives.forEach(alt => {
          expect(alt).toHaveProperty('datetime');
          expect(alt).toHaveProperty('score');
          expect(alt).toHaveProperty('advantages');
          expect(alt.score).toBeGreaterThan(response.body.score);
        });
      }
    });

    test('Should integrate historical weather patterns', async () => {
      const burnRequest = {
        lat: 40.0,
        lon: -120.0,
        requestedDate: '2025-09-20',
        includeHistorical: true
      };
      
      const response = await request(app)
        .post('/api/weather/analyze')
        .send(burnRequest);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('historicalAnalysis');
      
      const historical = response.body.historicalAnalysis;
      expect(historical).toHaveProperty('typicalConditions');
      expect(historical).toHaveProperty('successRate');
      expect(historical).toHaveProperty('previousIncidents');
    });
  });

  describe('GET /api/weather/alerts - Weather Alerts', () => {
    test('Should fetch active weather alerts for region', async () => {
      const response = await request(app)
        .get('/api/weather/alerts')
        .query({ lat: 40.0, lon: -120.0, radius: 50 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alerts');
      expect(Array.isArray(response.body.alerts)).toBeTruthy();
      
      if (response.body.alerts.length > 0) {
        response.body.alerts.forEach(alert => {
          expect(alert).toHaveProperty('id');
          expect(alert).toHaveProperty('type');
          expect(alert).toHaveProperty('severity');
          expect(alert).toHaveProperty('headline');
          expect(alert).toHaveProperty('description');
          expect(alert).toHaveProperty('effective');
          expect(alert).toHaveProperty('expires');
        });
      }
    });

    test('Should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/api/weather/alerts')
        .query({
          lat: 40.0,
          lon: -120.0,
          minSeverity: 'warning'
        });
      
      expect(response.status).toBe(200);
      
      const severityOrder = ['advisory', 'watch', 'warning', 'emergency'];
      const minIndex = severityOrder.indexOf('warning');
      
      response.body.alerts.forEach(alert => {
        const alertIndex = severityOrder.indexOf(alert.severity);
        expect(alertIndex).toBeGreaterThanOrEqual(minIndex);
      });
    });

    test('Should identify red flag warnings', async () => {
      const response = await request(app)
        .get('/api/weather/alerts')
        .query({
          lat: 40.0,
          lon: -120.0,
          type: 'fire'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasRedFlag');
      
      if (response.body.hasRedFlag) {
        expect(response.body).toHaveProperty('restrictions');
        expect(response.body.restrictions).toHaveProperty('burnBan');
        expect(response.body.restrictions).toHaveProperty('permitsSuspended');
      }
    });

    test('Should create custom alerts for dangerous conditions', async () => {
      const conditions = {
        windSpeed: 35,
        humidity: 15,
        temperature: 95
      };
      
      const response = await request(app)
        .post('/api/weather/alerts/evaluate')
        .send(conditions);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('customAlerts');
      expect(response.body.customAlerts.length).toBeGreaterThan(0);
      
      // Should have high wind and low humidity alerts
      const alertTypes = response.body.customAlerts.map(a => a.type);
      expect(alertTypes).toContain('HIGH_WIND');
      expect(alertTypes).toContain('LOW_HUMIDITY');
    });
  });

  describe('POST /api/weather/historical - Historical Weather Data', () => {
    test('Should retrieve historical weather patterns', async () => {
      const request_data = {
        lat: 40.0,
        lon: -120.0,
        startDate: '2024-09-01',
        endDate: '2024-09-30'
      };
      
      const response = await request(app)
        .post('/api/weather/historical')
        .send(request_data);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBeTruthy();
      
      if (response.body.data.length > 0) {
        response.body.data.forEach(entry => {
          expect(entry).toHaveProperty('date');
          expect(entry).toHaveProperty('avgTemperature');
          expect(entry).toHaveProperty('avgHumidity');
          expect(entry).toHaveProperty('avgWindSpeed');
        });
      }
    });

    test('Should identify historical burn success rates', async () => {
      const request_data = {
        lat: 40.0,
        lon: -120.0,
        month: 9, // September
        analyzeSuccess: true
      };
      
      const response = await request(app)
        .post('/api/weather/historical')
        .send(request_data);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('burnSuccess');
      
      const success = response.body.burnSuccess;
      expect(success).toHaveProperty('totalBurns');
      expect(success).toHaveProperty('successfulBurns');
      expect(success).toHaveProperty('successRate');
      expect(success).toHaveProperty('optimalConditions');
    });

    test('Should compare current to historical averages', async () => {
      const response = await request(app)
        .get('/api/weather/comparison')
        .query({
          lat: 40.0,
          lon: -120.0,
          date: '2025-09-20'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('historical');
      expect(response.body).toHaveProperty('deviation');
      
      const deviation = response.body.deviation;
      expect(deviation).toHaveProperty('temperature');
      expect(deviation).toHaveProperty('humidity');
      expect(deviation).toHaveProperty('windSpeed');
    });
  });

  describe('Weather Data Storage and Retrieval', () => {
    test('Should store weather observations with vectors', async () => {
      const observation = {
        lat: 40.0,
        lon: -120.0,
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013
      };
      
      const response = await request(app)
        .post('/api/weather/store')
        .send(observation);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('observationId');
      expect(response.body).toHaveProperty('vectorStored');
      expect(response.body.vectorStored).toBeTruthy();
    });

    test('Should find similar weather patterns', async () => {
      const searchPattern = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        limit: 5
      };
      
      const response = await request(app)
        .post('/api/weather/similar')
        .send(searchPattern);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('similar');
      expect(Array.isArray(response.body.similar)).toBeTruthy();
      
      response.body.similar.forEach(pattern => {
        expect(pattern).toHaveProperty('similarity');
        expect(pattern).toHaveProperty('date');
        expect(pattern).toHaveProperty('conditions');
        expect(pattern.similarity).toBeGreaterThanOrEqual(0);
        expect(pattern.similarity).toBeLessThanOrEqual(1);
      });
    });

    test('Should aggregate regional weather data', async () => {
      const response = await request(app)
        .get('/api/weather/regional')
        .query({
          minLat: 39.5,
          maxLat: 40.5,
          minLon: -120.5,
          maxLon: -119.5
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('regional');
      
      const regional = response.body.regional;
      expect(regional).toHaveProperty('avgTemperature');
      expect(regional).toHaveProperty('avgHumidity');
      expect(regional).toHaveProperty('avgWindSpeed');
      expect(regional).toHaveProperty('dominantWindDirection');
      expect(regional).toHaveProperty('stationCount');
    });
  });

  describe('Real-time Weather Updates', () => {
    test('Should support WebSocket connections for live updates', async () => {
      // Note: This would typically use a WebSocket client
      // For HTTP testing, we check if the endpoint exists
      const response = await request(app)
        .get('/api/weather/subscribe')
        .query({ lat: 40.0, lon: -120.0 });
      
      expect([101, 200, 426]).toContain(response.status); // 101 for WebSocket upgrade
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('subscriptionId');
        expect(response.body).toHaveProperty('updateInterval');
      }
    });

    test('Should trigger alerts on sudden weather changes', async () => {
      const weatherChange = {
        lat: 40.0,
        lon: -120.0,
        previousWindSpeed: 10,
        currentWindSpeed: 35,
        timestamp: new Date().toISOString()
      };
      
      const response = await request(app)
        .post('/api/weather/change-detection')
        .send(weatherChange);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('changeDetected');
      expect(response.body.changeDetected).toBeTruthy();
      expect(response.body).toHaveProperty('alerts');
      expect(response.body.alerts.length).toBeGreaterThan(0);
    });

    test('Should calculate rate of change for key parameters', async () => {
      const response = await request(app)
        .get('/api/weather/trends')
        .query({
          lat: 40.0,
          lon: -120.0,
          hours: 6
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('trends');
      
      const trends = response.body.trends;
      expect(trends).toHaveProperty('temperatureRate');
      expect(trends).toHaveProperty('humidityRate');
      expect(trends).toHaveProperty('pressureRate');
      expect(trends).toHaveProperty('windSpeedRate');
    });
  });

  describe('Integration with Burn Scheduling', () => {
    test('Should provide weather scores for scheduling optimization', async () => {
      const scheduleRequest = {
        burnRequests: [
          { id: 1, lat: 40.0, lon: -120.0, date: '2025-09-20' },
          { id: 2, lat: 40.1, lon: -120.1, date: '2025-09-20' },
          { id: 3, lat: 39.9, lon: -119.9, date: '2025-09-20' }
        ]
      };
      
      const response = await request(app)
        .post('/api/weather/schedule-scoring')
        .send(scheduleRequest);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('scores');
      
      Object.values(response.body.scores).forEach(score => {
        expect(score).toHaveProperty('weatherScore');
        expect(score).toHaveProperty('safetyScore');
        expect(score).toHaveProperty('overallScore');
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
        expect(score.overallScore).toBeLessThanOrEqual(100);
      });
    });

    test('Should identify weather-based conflicts', async () => {
      const conflictCheck = {
        burns: [
          { lat: 40.0, lon: -120.0, time: '09:00' },
          { lat: 40.01, lon: -120.0, time: '09:00' } // Upwind
        ],
        windDirection: 0, // North wind
        windSpeed: 15
      };
      
      const response = await request(app)
        .post('/api/weather/conflict-check')
        .send(conflictCheck);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasConflict');
      expect(response.body.hasConflict).toBeTruthy();
      expect(response.body).toHaveProperty('conflictType');
      expect(response.body.conflictType).toBe('downwind_smoke');
    });
  });

  describe('Performance and Reliability', () => {
    test('Should handle high-frequency requests efficiently', async () => {
      const startTime = Date.now();
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/weather/current')
          .query({ lat: 40.0, lon: -120.0 })
      );
      
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;
      
      // All should complete
      expect(responses.every(r => r.status === 200 || r.status === 429)).toBeTruthy();
      
      // Should complete within reasonable time (5 seconds for 20 requests)
      expect(duration).toBeLessThan(5000);
    });

    test('Should implement circuit breaker for external API', async () => {
      // Simulate multiple failures
      const failureRequests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/weather/current')
          .query({ lat: 999, lon: 999 }) // Invalid coords to trigger failures
      );
      
      await Promise.all(failureRequests);
      
      // Circuit should be open
      const response = await request(app)
        .get('/api/weather/current')
        .query({ lat: 40.0, lon: -120.0 });
      
      expect([200, 503]).toContain(response.status);
      if (response.status === 503) {
        expect(response.body.error).toMatch(/circuit.*open|unavailable/i);
        expect(response.body).toHaveProperty('retryAfter');
      }
    });

    test('Should validate all weather data inputs', async () => {
      const invalidInputs = [
        { temperature: 200 },    // Too high
        { humidity: 150 },        // Over 100%
        { windSpeed: -10 },       // Negative
        { pressure: 0 },          // Invalid
        { windDirection: 400 }    // Over 360
      ];
      
      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/api/weather/validate')
          .send(input);
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toBeGreaterThan(0);
      }
    });
  });
});

module.exports = {
  // Helper functions for weather testing
  generateMockWeatherData: () => ({
    temperature: 20 + Math.random() * 15,
    humidity: 40 + Math.random() * 40,
    windSpeed: Math.random() * 20,
    windDirection: Math.random() * 360,
    pressure: 1000 + Math.random() * 30,
    visibility: 5000 + Math.random() * 5000,
    cloudCover: Math.random() * 100
  }),
  
  calculateStabilityClass: (weather) => {
    const { windSpeed, cloudCover, hour } = weather;
    const isDay = hour >= 6 && hour <= 18;
    
    if (isDay) {
      if (windSpeed < 2) return 'A';
      if (windSpeed < 3 && cloudCover < 50) return 'B';
      if (windSpeed < 5) return 'C';
      return 'D';
    } else {
      if (windSpeed < 2 && cloudCover < 40) return 'F';
      if (windSpeed < 3) return 'E';
      return 'D';
    }
  }
};