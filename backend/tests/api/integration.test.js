const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import API routers
const burnRequestsRouter = require('../../api/burnRequests');
const weatherRouter = require('../../api/weather');
const scheduleRouter = require('../../api/schedule');
const alertsRouter = require('../../api/alerts');
const farmsRouter = require('../../api/farms');
const analyticsRouter = require('../../api/analytics');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');
jest.mock('../../agents/coordinator');
jest.mock('../../agents/weather');
jest.mock('../../agents/predictor');
jest.mock('../../agents/optimizer');
jest.mock('../../agents/alerts');

const { query, vectorSimilaritySearch, spatialQuery } = require('../../db/connection');
const coordinatorAgent = require('../../agents/coordinator');
const weatherAgent = require('../../agents/weather');
const predictorAgent = require('../../agents/predictor');
const optimizerAgent = require('../../agents/optimizer');
const alertsAgent = require('../../agents/alerts');

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Mount API routers
    app.use('/api/burn-requests', burnRequestsRouter);
    app.use('/api/weather', weatherRouter);
    app.use('/api/schedule', scheduleRouter);
    app.use('/api/alerts', alertsRouter);
    app.use('/api/farms', farmsRouter);
    app.use('/api/analytics', analyticsRouter);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('1. Burn Requests API Tests', () => {
    test('POST /api/burn-requests should create new burn request with 5-agent workflow', async () => {
      const burnRequestData = {
        farm_id: 'farm_123',
        contact_phone: '+1234567890',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: 'wheat_stubble',
        burn_intensity: 'moderate',
        field_boundaries: [
          { latitude: 37.5, longitude: -120.5 },
          { latitude: 37.501, longitude: -120.5 },
          { latitude: 37.501, longitude: -120.501 },
          { latitude: 37.5, longitude: -120.501 }
        ]
      };

      // Mock agent responses
      coordinatorAgent.processBurnRequest.mockResolvedValueOnce({
        burnId: 456,
        priorityScore: 8.5,
        burnVector: new Array(32).fill(0.5),
        validationResults: { isValid: true }
      });

      weatherAgent.analyzeWeatherConditions.mockResolvedValueOnce({
        weatherId: 789,
        suitabilityScore: 7.8,
        weatherVector: new Array(128).fill(0.3)
      });

      predictorAgent.createPrediction.mockResolvedValueOnce({
        maxDispersionRadius: 8000,
        maxPM25: 28.5,
        conflictsDetected: [],
        plumeVector: new Array(64).fill(0.7)
      });

      optimizerAgent.optimizeSchedule.mockResolvedValueOnce({
        scheduledTime: new Date('2025-08-10T10:00:00Z'),
        totalScore: 85.2,
        conflicts: []
      });

      alertsAgent.sendAlert.mockResolvedValueOnce({
        success: true,
        alertsSent: 2
      });

      query.mockResolvedValueOnce({ insertId: 456, affectedRows: 1 });

      const response = await request(app)
        .post('/api/burn-requests')
        .send(burnRequestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.burnId).toBe(456);
      expect(response.body.workflowCompleted).toBe(true);
      expect(response.body.agentResults).toHaveProperty('coordinator');
      expect(response.body.agentResults).toHaveProperty('weather');
      expect(response.body.agentResults).toHaveProperty('predictor');
      expect(response.body.agentResults).toHaveProperty('optimizer');
      expect(response.body.agentResults).toHaveProperty('alerts');
    });

    test('GET /api/burn-requests should return paginated burn requests', async () => {
      const mockBurnRequests = [
        {
          id: 1,
          farm_id: 'farm_123',
          burn_date: '2025-08-10T09:00:00Z',
          acres: 100,
          status: 'approved'
        },
        {
          id: 2,
          farm_id: 'farm_456',
          burn_date: '2025-08-11T10:00:00Z',
          acres: 80,
          status: 'pending'
        }
      ];

      query.mockResolvedValueOnce(mockBurnRequests);
      query.mockResolvedValueOnce([{ total: 25 }]);

      const response = await request(app)
        .get('/api/burn-requests?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(25);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    test('GET /api/burn-requests/:id should return specific burn request', async () => {
      const mockBurnRequest = {
        id: 123,
        farm_id: 'farm_789',
        burn_date: '2025-08-12T08:00:00Z',
        acres: 150,
        status: 'approved',
        workflow_results: {
          coordinator: { priorityScore: 8.5 },
          weather: { suitabilityScore: 7.8 },
          predictor: { maxPM25: 28.5 },
          optimizer: { totalScore: 85.2 },
          alerts: { alertsSent: 2 }
        }
      };

      query.mockResolvedValueOnce([mockBurnRequest]);

      const response = await request(app)
        .get('/api/burn-requests/123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(123);
      expect(response.body.data.workflow_results).toBeDefined();
    });

    test('PUT /api/burn-requests/:id should update burn request', async () => {
      const updateData = {
        acres: 120,
        burn_intensity: 'high',
        status: 'approved'
      };

      query.mockResolvedValueOnce({ affectedRows: 1, changedRows: 1 });

      const response = await request(app)
        .put('/api/burn-requests/123')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(true);
    });

    test('DELETE /api/burn-requests/:id should delete burn request', async () => {
      query.mockResolvedValueOnce({ affectedRows: 1 });

      const response = await request(app)
        .delete('/api/burn-requests/123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(true);
    });

    test('POST /api/burn-requests should validate required fields', async () => {
      const invalidData = {
        farm_id: 'farm_123'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeInstanceOf(Array);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    test('GET /api/burn-requests should support filtering', async () => {
      query.mockResolvedValueOnce([]);
      query.mockResolvedValueOnce([{ total: 0 }]);

      const response = await request(app)
        .get('/api/burn-requests?status=approved&fuel_type=wheat_stubble&date_from=2025-08-01')
        .expect(200);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = ? AND fuel_type = ? AND burn_date >= ?'),
        expect.arrayContaining(['approved', 'wheat_stubble', '2025-08-01'])
      );
    });

    test('POST /api/burn-requests should handle agent workflow failures', async () => {
      const burnRequestData = {
        farm_id: 'farm_123',
        contact_phone: '+1234567890',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: 'wheat_stubble'
      };

      coordinatorAgent.processBurnRequest.mockRejectedValueOnce(
        new Error('Coordinator agent failed')
      );

      const response = await request(app)
        .post('/api/burn-requests')
        .send(burnRequestData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Agent workflow failed');
    });
  });

  describe('2. Weather API Tests', () => {
    test('GET /api/weather/current should return current weather data', async () => {
      const mockWeatherData = {
        location: { latitude: 37.5, longitude: -120.5 },
        temperature: 22.5,
        humidity: 45,
        wind_speed: 8.2,
        wind_direction: 180,
        atmospheric_stability: 'neutral',
        weather_pattern_embedding: new Array(128).fill(0.3)
      };

      weatherAgent.getCurrentWeather.mockResolvedValueOnce(mockWeatherData);

      const response = await request(app)
        .get('/api/weather/current?lat=37.5&lng=-120.5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.temperature).toBe(22.5);
      expect(response.body.data.atmospheric_stability).toBe('neutral');
    });

    test('GET /api/weather/forecast should return weather forecast', async () => {
      const mockForecast = [
        { datetime: '2025-08-10T09:00:00Z', temperature: 20, wind_speed: 5 },
        { datetime: '2025-08-10T12:00:00Z', temperature: 25, wind_speed: 8 },
        { datetime: '2025-08-10T15:00:00Z', temperature: 28, wind_speed: 10 }
      ];

      weatherAgent.getForecast.mockResolvedValueOnce(mockForecast);

      const response = await request(app)
        .get('/api/weather/forecast?lat=37.5&lng=-120.5&hours=72')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].temperature).toBe(20);
    });

    test('POST /api/weather/analyze should analyze weather conditions', async () => {
      const analysisRequest = {
        location: { latitude: 37.5, longitude: -120.5 },
        burn_date: '2025-08-10T10:00:00Z',
        burn_duration: 4
      };

      const mockAnalysis = {
        suitabilityScore: 8.2,
        riskFactors: ['moderate_wind'],
        recommendations: ['Monitor wind conditions'],
        weatherVector: new Array(128).fill(0.4)
      };

      weatherAgent.analyzeWeatherConditions.mockResolvedValueOnce(mockAnalysis);

      const response = await request(app)
        .post('/api/weather/analyze')
        .send(analysisRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suitabilityScore).toBe(8.2);
      expect(response.body.data.riskFactors).toContain('moderate_wind');
    });

    test('GET /api/weather/similar should find similar weather patterns', async () => {
      const queryVector = new Array(128).fill(0.5);
      const mockSimilarPatterns = [
        { id: 1, similarity: 0.92, date: '2025-07-15', temperature: 23 },
        { id: 2, similarity: 0.88, date: '2025-06-20', temperature: 21 }
      ];

      vectorSimilaritySearch.mockResolvedValueOnce(mockSimilarPatterns);

      const response = await request(app)
        .get('/api/weather/similar?lat=37.5&lng=-120.5&threshold=0.85')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].similarity).toBe(0.92);
    });

    test('GET /api/weather/suitability should return burn suitability assessment', async () => {
      const mockSuitability = {
        overallScore: 7.5,
        windSuitability: 8.0,
        temperatureSuitability: 7.0,
        humiditySuitability: 8.5,
        stabilityScore: 6.5,
        recommendations: ['Good conditions for burning', 'Monitor humidity levels']
      };

      weatherAgent.assessBurnSuitability.mockResolvedValueOnce(mockSuitability);

      const response = await request(app)
        .get('/api/weather/suitability?lat=37.5&lng=-120.5&date=2025-08-10T10:00:00Z')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overallScore).toBe(7.5);
      expect(response.body.data.recommendations).toHaveLength(2);
    });

    test('GET /api/weather/current should handle invalid coordinates', async () => {
      const response = await request(app)
        .get('/api/weather/current?lat=91&lng=-200')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid coordinates');
    });

    test('GET /api/weather/forecast should handle API failures', async () => {
      weatherAgent.getForecast.mockRejectedValueOnce(
        new Error('Weather API unavailable')
      );

      const response = await request(app)
        .get('/api/weather/forecast?lat=37.5&lng=-120.5')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Weather service unavailable');
    });
  });

  describe('3. Schedule API Tests', () => {
    test('GET /api/schedule should return optimized schedule', async () => {
      const mockSchedule = [
        {
          burn_id: 1,
          farm_id: 'farm_123',
          scheduled_time: '2025-08-10T09:00:00Z',
          estimated_duration: 4,
          priority_score: 8.5
        },
        {
          burn_id: 2,
          farm_id: 'farm_456',
          scheduled_time: '2025-08-10T14:00:00Z',
          estimated_duration: 3,
          priority_score: 7.2
        }
      ];

      query.mockResolvedValueOnce(mockSchedule);

      const response = await request(app)
        .get('/api/schedule?date=2025-08-10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].burn_id).toBe(1);
    });

    test('POST /api/schedule/optimize should optimize burn schedule', async () => {
      const optimizeRequest = {
        burn_requests: [
          { id: 1, priority_score: 8.5, preferred_date: '2025-08-10T09:00:00Z' },
          { id: 2, priority_score: 7.2, preferred_date: '2025-08-10T11:00:00Z' },
          { id: 3, priority_score: 9.0, preferred_date: '2025-08-10T14:00:00Z' }
        ],
        optimization_params: {
          priorityWeight: 0.4,
          timePreferenceWeight: 0.3,
          conflictAvoidanceWeight: 0.3
        }
      };

      const mockOptimizedSchedule = {
        schedule: [
          { burn_id: 3, scheduled_time: '2025-08-10T09:00:00Z' },
          { burn_id: 1, scheduled_time: '2025-08-10T12:00:00Z' },
          { burn_id: 2, scheduled_time: '2025-08-10T15:00:00Z' }
        ],
        totalScore: 87.5,
        conflicts: 0,
        iterations: 342
      };

      optimizerAgent.optimizeSchedule.mockResolvedValueOnce(mockOptimizedSchedule);
      query.mockResolvedValueOnce({ insertId: 789 });

      const response = await request(app)
        .post('/api/schedule/optimize')
        .send(optimizeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalScore).toBe(87.5);
      expect(response.body.data.schedule).toHaveLength(3);
      expect(response.body.data.conflicts).toBe(0);
    });

    test('GET /api/schedule/conflicts should return schedule conflicts', async () => {
      const mockConflicts = [
        {
          burn_id_1: 1,
          burn_id_2: 2,
          conflict_type: 'smoke_overlap',
          severity: 'high',
          distance: 1.2,
          time_overlap: 2
        }
      ];

      query.mockResolvedValueOnce(mockConflicts);

      const response = await request(app)
        .get('/api/schedule/conflicts?date=2025-08-10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].severity).toBe('high');
    });

    test('PUT /api/schedule/:id should update scheduled burn', async () => {
      const updateData = {
        scheduled_time: '2025-08-10T11:00:00Z',
        estimated_duration: 5
      };

      query.mockResolvedValueOnce({ affectedRows: 1 });

      const response = await request(app)
        .put('/api/schedule/123')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(true);
    });

    test('GET /api/schedule/timeline should return timeline view', async () => {
      const mockTimeline = {
        date: '2025-08-10',
        total_burns: 5,
        timeline: [
          { time: '09:00', burn_id: 1, farm_name: 'Farm A', duration: 4 },
          { time: '12:00', burn_id: 2, farm_name: 'Farm B', duration: 3 },
          { time: '15:00', burn_id: 3, farm_name: 'Farm C', duration: 2 }
        ],
        efficiency_score: 8.7,
        gap_analysis: { total_gaps: 2, avg_gap_hours: 1.5 }
      };

      query.mockResolvedValueOnce(mockTimeline.timeline);
      query.mockResolvedValueOnce([{ efficiency_score: 8.7 }]);

      const response = await request(app)
        .get('/api/schedule/timeline?date=2025-08-10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeline).toHaveLength(3);
      expect(response.body.data.efficiency_score).toBe(8.7);
    });

    test('POST /api/schedule/reoptimize should reoptimize existing schedule', async () => {
      const reoptimizeRequest = {
        schedule_id: 789,
        new_constraints: {
          max_concurrent_burns: 3,
          min_separation_distance: 5000
        }
      };

      const mockReoptimized = {
        schedule: [{ burn_id: 1, scheduled_time: '2025-08-10T10:00:00Z' }],
        improvementScore: 5.2,
        iterations: 156
      };

      optimizerAgent.reoptimizeSchedule.mockResolvedValueOnce(mockReoptimized);

      const response = await request(app)
        .post('/api/schedule/reoptimize')
        .send(reoptimizeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.improvementScore).toBe(5.2);
    });
  });

  describe('4. Alerts API Tests', () => {
    test('POST /api/alerts should create and send alert', async () => {
      const alertData = {
        type: 'air_quality_alert',
        priority: 'high',
        message: 'PM2.5 levels elevated in your area',
        recipients: ['+1234567890', '+0987654321'],
        farm_id: 'farm_123'
      };

      const mockAlertResult = {
        success: true,
        alert_id: 'alert_456',
        channels_used: ['sms', 'socket'],
        messages_sent: 2
      };

      alertsAgent.sendAlert.mockResolvedValueOnce(mockAlertResult);
      query.mockResolvedValueOnce({ insertId: 456 });

      const response = await request(app)
        .post('/api/alerts')
        .send(alertData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.alert_id).toBe('alert_456');
      expect(response.body.messages_sent).toBe(2);
    });

    test('GET /api/alerts should return paginated alerts', async () => {
      const mockAlerts = [
        {
          id: 1,
          type: 'air_quality_alert',
          priority: 'high',
          message: 'PM2.5 elevated',
          created_at: '2025-08-10T09:00:00Z',
          acknowledged: false
        },
        {
          id: 2,
          type: 'weather_alert',
          priority: 'medium',
          message: 'Wind conditions changing',
          created_at: '2025-08-10T10:00:00Z',
          acknowledged: true
        }
      ];

      query.mockResolvedValueOnce(mockAlerts);
      query.mockResolvedValueOnce([{ total: 15 }]);

      const response = await request(app)
        .get('/api/alerts?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(15);
    });

    test('PUT /api/alerts/:id/acknowledge should acknowledge alert', async () => {
      const acknowledgeData = {
        acknowledged_by: 'user_789',
        response: 'Alert received and understood'
      };

      query.mockResolvedValueOnce({ affectedRows: 1 });

      const response = await request(app)
        .put('/api/alerts/123/acknowledge')
        .send(acknowledgeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.acknowledged).toBe(true);
    });

    test('GET /api/alerts/history/:farm_id should return farm alert history', async () => {
      const mockHistory = [
        {
          id: 1,
          type: 'burn_approved',
          priority: 'medium',
          created_at: '2025-08-09T14:00:00Z'
        },
        {
          id: 2,
          type: 'conflict_alert',
          priority: 'high',
          created_at: '2025-08-08T11:00:00Z'
        }
      ];

      query.mockResolvedValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/alerts/history/farm_123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].type).toBe('burn_approved');
    });

    test('POST /api/alerts/bulk should send bulk alerts', async () => {
      const bulkAlertData = {
        type: 'weather_warning',
        priority: 'high',
        message: 'High wind warning for Central Valley',
        recipients: [
          { phone: '+1111111111', farm_id: 'farm_1' },
          { phone: '+2222222222', farm_id: 'farm_2' },
          { phone: '+3333333333', farm_id: 'farm_3' }
        ]
      };

      const mockBulkResult = {
        success: true,
        total_alerts: 3,
        successful: 3,
        failed: 0,
        alert_ids: ['alert_1', 'alert_2', 'alert_3']
      };

      alertsAgent.sendBulkAlerts.mockResolvedValueOnce(mockBulkResult);

      const response = await request(app)
        .post('/api/alerts/bulk')
        .send(bulkAlertData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.total_alerts).toBe(3);
      expect(response.body.successful).toBe(3);
    });

    test('DELETE /api/alerts/:id should delete alert', async () => {
      query.mockResolvedValueOnce({ affectedRows: 1 });

      const response = await request(app)
        .delete('/api/alerts/123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(true);
    });

    test('GET /api/alerts/stats should return alert statistics', async () => {
      const mockStats = {
        total_alerts: 150,
        by_type: {
          air_quality_alert: 45,
          weather_alert: 35,
          conflict_alert: 25,
          burn_status_alert: 45
        },
        by_priority: {
          critical: 10,
          high: 35,
          medium: 60,
          low: 45
        },
        acknowledgment_rate: 0.87,
        avg_response_time: 180 // seconds
      };

      query.mockResolvedValueOnce([mockStats]);

      const response = await request(app)
        .get('/api/alerts/stats?from=2025-08-01&to=2025-08-10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_alerts).toBe(150);
      expect(response.body.data.acknowledgment_rate).toBe(0.87);
    });
  });

  describe('5. Farms API Tests', () => {
    test('POST /api/farms should create new farm', async () => {
      const farmData = {
        farm_name: 'Green Valley Farm',
        owner_name: 'John Smith',
        contact_phone: '+1234567890',
        contact_email: 'john@greenvalley.com',
        address: '123 Farm Road, Davis, CA',
        latitude: 37.5,
        longitude: -120.5,
        total_acres: 500,
        primary_crops: ['wheat', 'corn'],
        farm_boundaries: [
          { latitude: 37.5, longitude: -120.5 },
          { latitude: 37.51, longitude: -120.5 },
          { latitude: 37.51, longitude: -120.51 },
          { latitude: 37.5, longitude: -120.51 }
        ]
      };

      query.mockResolvedValueOnce({ insertId: 789, affectedRows: 1 });

      const response = await request(app)
        .post('/api/farms')
        .send(farmData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.farm_id).toBe(789);
      expect(response.body.data.farm_name).toBe('Green Valley Farm');
    });

    test('GET /api/farms should return paginated farms list', async () => {
      const mockFarms = [
        {
          id: 1,
          farm_name: 'Green Valley Farm',
          owner_name: 'John Smith',
          total_acres: 500,
          latitude: 37.5,
          longitude: -120.5
        },
        {
          id: 2,
          farm_name: 'Sunset Ranch',
          owner_name: 'Jane Doe',
          total_acres: 350,
          latitude: 37.52,
          longitude: -120.48
        }
      ];

      query.mockResolvedValueOnce(mockFarms);
      query.mockResolvedValueOnce([{ total: 42 }]);

      const response = await request(app)
        .get('/api/farms?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(42);
    });

    test('GET /api/farms/:id should return specific farm details', async () => {
      const mockFarm = {
        id: 123,
        farm_name: 'Green Valley Farm',
        owner_name: 'John Smith',
        contact_phone: '+1234567890',
        total_acres: 500,
        latitude: 37.5,
        longitude: -120.5,
        burn_history: [
          { burn_date: '2025-07-15', acres: 100, success_rating: 8.5 },
          { burn_date: '2025-06-20', acres: 80, success_rating: 9.0 }
        ]
      };

      query.mockResolvedValueOnce([mockFarm]);

      const response = await request(app)
        .get('/api/farms/123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.farm_name).toBe('Green Valley Farm');
      expect(response.body.data.burn_history).toHaveLength(2);
    });

    test('GET /api/farms/nearby should find nearby farms', async () => {
      const mockNearbyFarms = [
        { id: 2, farm_name: 'Nearby Farm 1', distance: 2.3 },
        { id: 3, farm_name: 'Nearby Farm 2', distance: 4.7 },
        { id: 4, farm_name: 'Nearby Farm 3', distance: 7.1 }
      ];

      spatialQuery.mockResolvedValueOnce(mockNearbyFarms);

      const response = await request(app)
        .get('/api/farms/nearby?lat=37.5&lng=-120.5&radius=10000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].distance).toBe(2.3);
    });

    test('PUT /api/farms/:id should update farm information', async () => {
      const updateData = {
        contact_phone: '+0987654321',
        total_acres: 600,
        primary_crops: ['wheat', 'corn', 'soybeans']
      };

      query.mockResolvedValueOnce({ affectedRows: 1, changedRows: 1 });

      const response = await request(app)
        .put('/api/farms/123')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(true);
    });

    test('DELETE /api/farms/:id should delete farm', async () => {
      query.mockResolvedValueOnce({ affectedRows: 1 });

      const response = await request(app)
        .delete('/api/farms/123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(true);
    });

    test('GET /api/farms/search should search farms by criteria', async () => {
      const mockSearchResults = [
        {
          id: 1,
          farm_name: 'Wheat Valley Farm',
          primary_crops: ['wheat'],
          total_acres: 400
        }
      ];

      query.mockResolvedValueOnce(mockSearchResults);

      const response = await request(app)
        .get('/api/farms/search?crop=wheat&min_acres=300&max_distance=20')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].primary_crops).toContain('wheat');
    });

    test('POST /api/farms/:id/validate-location should validate farm location', async () => {
      const locationData = {
        proposed_latitude: 37.505,
        proposed_longitude: -120.495,
        buffer_zone_radius: 1000
      };

      const mockValidation = {
        valid: true,
        conflicts: [],
        nearest_farm_distance: 2500,
        regulatory_compliance: true
      };

      query.mockResolvedValueOnce([mockValidation]);

      const response = await request(app)
        .post('/api/farms/123/validate-location')
        .send(locationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.nearest_farm_distance).toBe(2500);
    });
  });

  describe('6. Analytics API Tests', () => {
    test('GET /api/analytics/dashboard should return dashboard metrics', async () => {
      const mockDashboardData = {
        total_burns: 156,
        active_burns: 8,
        pending_requests: 23,
        avg_air_quality: 22.3,
        system_efficiency: 87.5,
        alert_statistics: {
          total_alerts: 45,
          critical_alerts: 3,
          acknowledgment_rate: 0.89
        },
        recent_activity: [
          { type: 'burn_completed', timestamp: '2025-08-10T14:00:00Z', farm: 'Farm A' },
          { type: 'alert_sent', timestamp: '2025-08-10T13:30:00Z', farm: 'Farm B' }
        ]
      };

      query.mockResolvedValueOnce([mockDashboardData]);

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_burns).toBe(156);
      expect(response.body.data.system_efficiency).toBe(87.5);
    });

    test('GET /api/analytics/efficiency should return system efficiency metrics', async () => {
      const mockEfficiencyData = {
        overall_efficiency: 85.7,
        optimization_success_rate: 0.92,
        avg_conflict_resolution_time: 45, // minutes
        schedule_adherence_rate: 0.88,
        resource_utilization: 0.76,
        trends: [
          { date: '2025-08-01', efficiency: 82.3 },
          { date: '2025-08-02', efficiency: 84.1 },
          { date: '2025-08-03', efficiency: 85.7 }
        ]
      };

      query.mockResolvedValueOnce([mockEfficiencyData]);

      const response = await request(app)
        .get('/api/analytics/efficiency?from=2025-08-01&to=2025-08-10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall_efficiency).toBe(85.7);
      expect(response.body.data.trends).toHaveLength(3);
    });

    test('GET /api/analytics/safety should return safety compliance metrics', async () => {
      const mockSafetyData = {
        safety_score: 94.2,
        epa_compliance_rate: 0.96,
        avg_pm25_levels: 18.5,
        safety_incidents: 2,
        air_quality_violations: 1,
        compliance_trends: [
          { month: '2025-06', compliance_rate: 0.94 },
          { month: '2025-07', compliance_rate: 0.95 },
          { month: '2025-08', compliance_rate: 0.96 }
        ]
      };

      query.mockResolvedValueOnce([mockSafetyData]);

      const response = await request(app)
        .get('/api/analytics/safety?period=3months')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.safety_score).toBe(94.2);
      expect(response.body.data.epa_compliance_rate).toBe(0.96);
    });

    test('GET /api/analytics/predictions should return prediction accuracy metrics', async () => {
      const mockPredictionData = {
        overall_accuracy: 88.3,
        smoke_prediction_accuracy: 91.2,
        weather_prediction_accuracy: 86.7,
        conflict_detection_accuracy: 87.1,
        model_performance: {
          precision: 0.89,
          recall: 0.86,
          f1_score: 0.875
        },
        accuracy_trends: [
          { date: '2025-08-01', accuracy: 85.2 },
          { date: '2025-08-05', accuracy: 87.1 },
          { date: '2025-08-10', accuracy: 88.3 }
        ]
      };

      query.mockResolvedValueOnce([mockPredictionData]);

      const response = await request(app)
        .get('/api/analytics/predictions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall_accuracy).toBe(88.3);
      expect(response.body.data.model_performance.f1_score).toBe(0.875);
    });

    test('POST /api/analytics/custom should generate custom analytics', async () => {
      const customRequest = {
        metrics: ['total_burns', 'avg_pm25', 'efficiency_score'],
        filters: {
          date_range: { from: '2025-08-01', to: '2025-08-10' },
          farm_ids: ['farm_123', 'farm_456'],
          fuel_types: ['wheat_stubble', 'rice_straw']
        },
        grouping: 'daily',
        export_format: 'json'
      };

      const mockCustomData = {
        data: [
          { date: '2025-08-01', total_burns: 12, avg_pm25: 19.2, efficiency_score: 85.1 },
          { date: '2025-08-02', total_burns: 15, avg_pm25: 21.7, efficiency_score: 87.3 }
        ],
        summary: {
          total_records: 2,
          avg_burns_per_day: 13.5,
          avg_pm25_overall: 20.45,
          avg_efficiency: 86.2
        }
      };

      query.mockResolvedValueOnce(mockCustomData.data);

      const response = await request(app)
        .post('/api/analytics/custom')
        .send(customRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(2);
      expect(response.body.data.summary.avg_burns_per_day).toBe(13.5);
    });

    test('GET /api/analytics/export should export analytics data', async () => {
      const mockExportData = {
        filename: 'burnwise_analytics_20250810.csv',
        download_url: '/downloads/burnwise_analytics_20250810.csv',
        record_count: 1500,
        file_size: '256KB'
      };

      query.mockResolvedValueOnce([mockExportData]);

      const response = await request(app)
        .get('/api/analytics/export?format=csv&from=2025-08-01&to=2025-08-10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filename).toBe('burnwise_analytics_20250810.csv');
      expect(response.body.data.record_count).toBe(1500);
    });
  });

  describe('7. Cross-API Integration Tests', () => {
    test('should handle complete burn request workflow across all APIs', async () => {
      // Step 1: Create burn request
      const burnRequestData = {
        farm_id: 'farm_123',
        contact_phone: '+1234567890',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: 'wheat_stubble'
      };

      coordinatorAgent.processBurnRequest.mockResolvedValueOnce({
        burnId: 456,
        priorityScore: 8.5
      });

      weatherAgent.analyzeWeatherConditions.mockResolvedValueOnce({
        suitabilityScore: 7.8
      });

      predictorAgent.createPrediction.mockResolvedValueOnce({
        maxPM25: 28.5,
        conflictsDetected: []
      });

      optimizerAgent.optimizeSchedule.mockResolvedValueOnce({
        scheduledTime: new Date('2025-08-10T10:00:00Z'),
        totalScore: 85.2
      });

      alertsAgent.sendAlert.mockResolvedValueOnce({
        success: true,
        alertsSent: 2
      });

      query.mockResolvedValue({ insertId: 456, affectedRows: 1 });

      const createResponse = await request(app)
        .post('/api/burn-requests')
        .send(burnRequestData)
        .expect(201);

      expect(createResponse.body.workflowCompleted).toBe(true);

      // Step 2: Get schedule
      const mockSchedule = [{
        burn_id: 456,
        scheduled_time: '2025-08-10T10:00:00Z'
      }];

      query.mockResolvedValueOnce(mockSchedule);

      const scheduleResponse = await request(app)
        .get('/api/schedule?date=2025-08-10')
        .expect(200);

      expect(scheduleResponse.body.data).toHaveLength(1);
      expect(scheduleResponse.body.data[0].burn_id).toBe(456);

      // Step 3: Get analytics after workflow
      const mockAnalytics = {
        total_burns: 1,
        system_efficiency: 85.2
      };

      query.mockResolvedValueOnce([mockAnalytics]);

      const analyticsResponse = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(analyticsResponse.body.data.total_burns).toBe(1);
    });

    test('should handle error propagation across API calls', async () => {
      // Weather API failure should affect burn request workflow
      coordinatorAgent.processBurnRequest.mockResolvedValueOnce({
        burnId: 456,
        priorityScore: 8.5
      });

      weatherAgent.analyzeWeatherConditions.mockRejectedValueOnce(
        new Error('Weather API unavailable')
      );

      const burnRequestData = {
        farm_id: 'farm_123',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: 'wheat_stubble'
      };

      const response = await request(app)
        .post('/api/burn-requests')
        .send(burnRequestData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Agent workflow failed');
    });

    test('should maintain data consistency across APIs', async () => {
      // Create farm
      query.mockResolvedValueOnce({ insertId: 789 });

      const farmResponse = await request(app)
        .post('/api/farms')
        .send({
          farm_name: 'Test Farm',
          latitude: 37.5,
          longitude: -120.5
        })
        .expect(201);

      const farmId = farmResponse.body.farm_id;

      // Create burn request for that farm
      coordinatorAgent.processBurnRequest.mockResolvedValueOnce({
        burnId: 456,
        priorityScore: 8.5
      });

      // Mock other agents
      weatherAgent.analyzeWeatherConditions.mockResolvedValueOnce({ suitabilityScore: 7.8 });
      predictorAgent.createPrediction.mockResolvedValueOnce({ maxPM25: 28.5 });
      optimizerAgent.optimizeSchedule.mockResolvedValueOnce({ totalScore: 85.2 });
      alertsAgent.sendAlert.mockResolvedValueOnce({ success: true });

      query.mockResolvedValue({ insertId: 456, affectedRows: 1 });

      const burnResponse = await request(app)
        .post('/api/burn-requests')
        .send({
          farm_id: farmId,
          burn_date: '2025-08-10T09:00:00Z',
          acres: 100,
          fuel_type: 'wheat_stubble'
        })
        .expect(201);

      expect(burnResponse.body.workflowCompleted).toBe(true);

      // Verify farm data is consistent
      query.mockResolvedValueOnce([{
        id: farmId,
        farm_name: 'Test Farm',
        recent_burns: 1
      }]);

      const farmCheckResponse = await request(app)
        .get(`/api/farms/${farmId}`)
        .expect(200);

      expect(farmCheckResponse.body.data.recent_burns).toBe(1);
    });
  });

  describe('8. Performance and Load Tests', () => {
    test('should handle concurrent API requests', async () => {
      query.mockResolvedValue([{ id: 1, name: 'test' }]);

      const concurrentRequests = Array.from({ length: 50 }, (_, i) =>
        request(app).get(`/api/farms?page=${i % 5 + 1}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const duration = Date.now() - startTime;

      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(duration).toBeLessThan(5000); // Complete within 5 seconds
    });

    test('should handle large payloads efficiently', async () => {
      const largeBurnRequest = {
        farm_id: 'farm_123',
        burn_date: '2025-08-10T09:00:00Z',
        acres: 100,
        fuel_type: 'wheat_stubble',
        field_boundaries: Array.from({ length: 1000 }, (_, i) => ({
          latitude: 37.5 + i * 0.0001,
          longitude: -120.5 + i * 0.0001
        }))
      };

      coordinatorAgent.processBurnRequest.mockResolvedValueOnce({
        burnId: 456,
        priorityScore: 8.5
      });

      // Mock other agents with minimal responses
      weatherAgent.analyzeWeatherConditions.mockResolvedValueOnce({ suitabilityScore: 7.8 });
      predictorAgent.createPrediction.mockResolvedValueOnce({ maxPM25: 28.5 });
      optimizerAgent.optimizeSchedule.mockResolvedValueOnce({ totalScore: 85.2 });
      alertsAgent.sendAlert.mockResolvedValueOnce({ success: true });

      query.mockResolvedValue({ insertId: 456, affectedRows: 1 });

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/burn-requests')
        .send(largeBurnRequest)
        .expect(201);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });

    test('should maintain response times under load', async () => {
      query.mockResolvedValue([{ id: 1, data: 'test' }]);

      const iterations = 100;
      const responseTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/analytics/dashboard')
          .expect(200);
        
        responseTimes.push(Date.now() - startTime);
      }

      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds
    });
  });

});