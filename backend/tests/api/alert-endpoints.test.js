const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { initializeDatabase, query, pool } = require('../../db/connection');
const AlertSystem = require('../../agents/alerts');
require('dotenv').config();

describe('Alert API Endpoints - Life-Saving Notification System', () => {
  let app;
  let server;
  let alertSystem;
  
  beforeAll(async () => {
    await initializeDatabase();
    alertSystem = new AlertSystem();
    
    // Create Express app with API routes
    app = express();
    app.use(express.json());
    
    // Import routes (assuming they exist)
    const alertRoutes = require('../../routes/alerts');
    app.use('/api/alerts', alertRoutes);
    
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
      await query('DELETE FROM alerts WHERE alert_id > 99000');
      await query('DELETE FROM alert_recipients WHERE recipient_id > 99000');
      await query('DELETE FROM alert_logs WHERE log_id > 99000');
    } catch (error) {
      // Tables might not exist yet
    }
  });

  describe('POST /api/alerts/send - Send Critical Alerts', () => {
    test('Should send PM2.5 exceedance alerts to affected populations', async () => {
      const alertData = {
        type: 'pm25_exceedance',
        severity: 'critical',
        pm25Level: 175,
        affectedArea: {
          centerLat: 40.0,
          centerLon: -120.0,
          radiusKm: 10
        },
        affectedPopulation: 15000,
        message: 'CRITICAL: PM2.5 levels exceeding 150 µg/m³. Stay indoors.',
        recipients: [
          { farmId: 1, phone: '+12125551001', email: 'farm1@test.com' },
          { farmId: 2, phone: '+12125551002', email: 'farm2@test.com' }
        ]
      };
      
      const response = await request(app)
        .post('/api/alerts/send')
        .send(alertData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sent');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('alertId');
      expect(response.body).toHaveProperty('deliveryStats');
      
      // Critical alerts should have high success rate
      const successRate = response.body.sent / (response.body.sent + response.body.failed);
      expect(successRate).toBeGreaterThan(0.8);
    });

    test('Should send burn schedule change notifications', async () => {
      const scheduleChange = {
        type: 'schedule_change',
        burnRequestId: 99001,
        farmId: 1,
        changes: {
          originalTime: '09:00',
          newTime: '14:00',
          originalDate: '2025-10-01',
          newDate: '2025-10-01',
          reason: 'Weather conditions improved for afternoon burn'
        },
        recipients: [
          { farmId: 1, phone: '+12125551001', preferredChannel: 'sms' },
          { farmId: 2, phone: '+12125551002', preferredChannel: 'voice' }
        ]
      };
      
      const response = await request(app)
        .post('/api/alerts/send')
        .send(scheduleChange);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notifications');
      
      const notifications = response.body.notifications;
      expect(Array.isArray(notifications)).toBeTruthy();
      
      notifications.forEach(notification => {
        expect(notification).toHaveProperty('recipientId');
        expect(notification).toHaveProperty('channel');
        expect(notification).toHaveProperty('status');
        expect(notification).toHaveProperty('timestamp');
      });
    });

    test('Should escalate critical safety alerts', async () => {
      const criticalAlert = {
        type: 'imminent_danger',
        severity: 'emergency',
        threat: 'wildfire_approaching',
        estimatedArrival: '30 minutes',
        affectedBurns: [99001, 99002, 99003],
        escalation: {
          levels: ['farmers', 'fire_department', 'emergency_services'],
          immediate: true
        }
      };
      
      const response = await request(app)
        .post('/api/alerts/send')
        .send(criticalAlert);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('escalated');
      expect(response.body.escalated).toBeTruthy();
      expect(response.body).toHaveProperty('escalationChain');
      
      const chain = response.body.escalationChain;
      expect(chain).toHaveLength(3);
      expect(chain[0].level).toBe('farmers');
      expect(chain[1].level).toBe('fire_department');
      expect(chain[2].level).toBe('emergency_services');
    });

    test('Should batch alerts for efficiency', async () => {
      const batchAlerts = {
        type: 'batch',
        alerts: [
          {
            type: 'burn_reminder',
            farmId: 1,
            message: 'Burn scheduled tomorrow at 9 AM'
          },
          {
            type: 'burn_reminder',
            farmId: 2,
            message: 'Burn scheduled tomorrow at 2 PM'
          },
          {
            type: 'burn_reminder',
            farmId: 3,
            message: 'Burn scheduled tomorrow at 4 PM'
          }
        ],
        batchSize: 10,
        priority: 'normal'
      };
      
      const response = await request(app)
        .post('/api/alerts/send')
        .send(batchAlerts);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('batches');
      expect(response.body).toHaveProperty('totalSent');
      expect(response.body.totalSent).toBe(3);
    });

    test('Should use fallback channels on primary failure', async () => {
      const alertWithFallback = {
        type: 'safety_alert',
        message: 'High wind warning - burns suspended',
        recipients: [
          {
            farmId: 1,
            primaryChannel: 'sms',
            primaryContact: '+1invalid',
            fallbackChannel: 'email',
            fallbackContact: 'farm1@test.com'
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/alerts/send')
        .send(alertWithFallback);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fallbacksUsed');
      expect(response.body.fallbacksUsed).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('deliveryDetails');
      
      const details = response.body.deliveryDetails[0];
      expect(details.channelUsed).toBe('email');
      expect(details.fallbackReason).toBeDefined();
    });

    test('Should enforce rate limiting for non-emergency alerts', async () => {
      const normalAlert = {
        type: 'information',
        severity: 'low',
        message: 'Weather update for tomorrow'
      };
      
      // Send multiple alerts rapidly
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/alerts/send')
          .send(normalAlert)
      );
      
      const responses = await Promise.all(requests);
      
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Emergency alerts should bypass rate limiting
      const emergencyAlert = {
        type: 'emergency',
        severity: 'critical',
        message: 'EMERGENCY: Evacuate immediately'
      };
      
      const emergencyResponse = await request(app)
        .post('/api/alerts/send')
        .send(emergencyAlert);
      
      expect(emergencyResponse.status).toBe(200);
    });
  });

  describe('GET /api/alerts/status/:alertId', () => {
    test('Should retrieve alert delivery status', async () => {
      // Insert test alert
      await query(`
        INSERT INTO alerts (alert_id, type, severity, created_at, status)
        VALUES (99001, 'pm25_warning', 'high', NOW(), 'delivered')
      `);
      
      const response = await request(app)
        .get('/api/alerts/status/99001');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alertId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('deliveryReport');
      
      const report = response.body.deliveryReport;
      expect(report).toHaveProperty('sent');
      expect(report).toHaveProperty('delivered');
      expect(report).toHaveProperty('failed');
      expect(report).toHaveProperty('pending');
    });

    test('Should show recipient acknowledgments', async () => {
      await query(`
        INSERT INTO alerts (alert_id, type, severity)
        VALUES (99002, 'schedule_change', 'medium')
      `);
      
      await query(`
        INSERT INTO alert_recipients 
        (recipient_id, alert_id, farm_id, acknowledged, acknowledged_at)
        VALUES 
        (99001, 99002, 1, true, NOW()),
        (99002, 99002, 2, false, NULL)
      `);
      
      const response = await request(app)
        .get('/api/alerts/status/99002');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('acknowledgments');
      
      const acks = response.body.acknowledgments;
      expect(acks.total).toBe(2);
      expect(acks.acknowledged).toBe(1);
      expect(acks.pending).toBe(1);
      expect(acks.details).toHaveLength(2);
    });
  });

  describe('POST /api/alerts/acknowledge', () => {
    test('Should record alert acknowledgment', async () => {
      const acknowledgment = {
        alertId: 99001,
        farmId: 1,
        acknowledgedBy: 'John Smith',
        method: 'sms_reply',
        response: 'CONFIRMED'
      };
      
      const response = await request(app)
        .post('/api/alerts/acknowledge')
        .send(acknowledgment);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('acknowledged');
      expect(response.body.acknowledged).toBeTruthy();
      expect(response.body).toHaveProperty('timestamp');
    });

    test('Should handle two-way communication responses', async () => {
      const twoWayResponse = {
        alertId: 99002,
        farmId: 2,
        response: 'NEED_RESCHEDULE',
        proposedTime: '16:00',
        reason: 'Equipment delay'
      };
      
      const response = await request(app)
        .post('/api/alerts/acknowledge')
        .send(twoWayResponse);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('actionRequired');
      expect(response.body.actionRequired).toBeTruthy();
      expect(response.body).toHaveProperty('followUp');
      expect(response.body.followUp).toBe('schedule_adjustment_requested');
    });
  });

  describe('GET /api/alerts/templates', () => {
    test('Should retrieve alert message templates', async () => {
      const response = await request(app)
        .get('/api/alerts/templates');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('templates');
      expect(Array.isArray(response.body.templates)).toBeTruthy();
      
      const templates = response.body.templates;
      expect(templates.length).toBeGreaterThan(0);
      
      templates.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('type');
        expect(template).toHaveProperty('severity');
        expect(template).toHaveProperty('messageTemplate');
        expect(template).toHaveProperty('variables');
      });
      
      // Check for critical templates
      const criticalTemplates = templates.filter(t => t.severity === 'critical');
      expect(criticalTemplates.length).toBeGreaterThan(0);
    });

    test('Should support multi-language templates', async () => {
      const response = await request(app)
        .get('/api/alerts/templates')
        .query({ language: 'es' });
      
      expect(response.status).toBe(200);
      
      if (response.body.templates.length > 0) {
        const template = response.body.templates[0];
        expect(template).toHaveProperty('language');
        expect(template.language).toBe('es');
      }
    });
  });

  describe('POST /api/alerts/subscribe', () => {
    test('Should subscribe to alert categories', async () => {
      const subscription = {
        farmId: 1,
        categories: ['safety', 'schedule', 'weather'],
        channels: {
          sms: '+12125551234',
          email: 'farmer@test.com',
          voice: '+12125551234'
        },
        preferences: {
          quietHours: { start: '22:00', end: '06:00' },
          severity: 'medium' // Minimum severity to receive
        }
      };
      
      const response = await request(app)
        .post('/api/alerts/subscribe')
        .send(subscription);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('subscriptionId');
      expect(response.body).toHaveProperty('active');
      expect(response.body.active).toBeTruthy();
    });

    test('Should update existing subscription preferences', async () => {
      const update = {
        farmId: 1,
        subscriptionId: 99001,
        changes: {
          categories: ['safety'], // Only safety alerts
          preferences: {
            severity: 'high'
          }
        }
      };
      
      const response = await request(app)
        .put('/api/alerts/subscribe')
        .send(update);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('updated');
      expect(response.body.updated).toBeTruthy();
      expect(response.body).toHaveProperty('subscription');
      expect(response.body.subscription.categories).toEqual(['safety']);
    });
  });

  describe('GET /api/alerts/history', () => {
    test('Should retrieve alert history for a farm', async () => {
      // Insert test alerts
      await query(`
        INSERT INTO alerts (alert_id, type, severity, farm_id, created_at)
        VALUES 
        (99001, 'pm25_warning', 'high', 1, DATE_SUB(NOW(), INTERVAL 1 DAY)),
        (99002, 'schedule_change', 'medium', 1, DATE_SUB(NOW(), INTERVAL 2 DAY)),
        (99003, 'weather_alert', 'low', 1, DATE_SUB(NOW(), INTERVAL 3 DAY))
      `);
      
      const response = await request(app)
        .get('/api/alerts/history')
        .query({ farmId: 1, days: 7 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alerts');
      expect(Array.isArray(response.body.alerts)).toBeTruthy();
      expect(response.body.alerts.length).toBeGreaterThanOrEqual(3);
      
      // Should be sorted by date (newest first)
      for (let i = 1; i < response.body.alerts.length; i++) {
        const prev = new Date(response.body.alerts[i - 1].createdAt);
        const curr = new Date(response.body.alerts[i].createdAt);
        expect(prev >= curr).toBeTruthy();
      }
    });

    test('Should filter history by alert type', async () => {
      const response = await request(app)
        .get('/api/alerts/history')
        .query({ 
          farmId: 1,
          type: 'pm25_warning',
          days: 30 
        });
      
      expect(response.status).toBe(200);
      
      response.body.alerts.forEach(alert => {
        expect(alert.type).toBe('pm25_warning');
      });
    });

    test('Should provide alert statistics', async () => {
      const response = await request(app)
        .get('/api/alerts/history/stats')
        .query({ farmId: 1, days: 30 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('statistics');
      
      const stats = response.body.statistics;
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('bySeverity');
      expect(stats).toHaveProperty('acknowledgmentRate');
      expect(stats).toHaveProperty('averageResponseTime');
    });
  });

  describe('POST /api/alerts/test', () => {
    test('Should send test alert to verify configuration', async () => {
      const testAlert = {
        farmId: 1,
        channel: 'sms',
        contact: '+12125551234'
      };
      
      const response = await request(app)
        .post('/api/alerts/test')
        .send(testAlert);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('channel');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('TEST');
    });
  });

  describe('Emergency Alert System', () => {
    test('Should broadcast emergency alerts to all farms in region', async () => {
      const emergency = {
        type: 'regional_emergency',
        severity: 'critical',
        threat: 'wildfire',
        affectedRegion: {
          minLat: 39.5,
          maxLat: 40.5,
          minLon: -120.5,
          maxLon: -119.5
        },
        message: 'EMERGENCY: Wildfire approaching. All burns cancelled. Evacuate if directed.',
        requireAcknowledgment: true
      };
      
      const response = await request(app)
        .post('/api/alerts/emergency')
        .send(emergency);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('broadcast');
      expect(response.body.broadcast).toBeTruthy();
      expect(response.body).toHaveProperty('recipientCount');
      expect(response.body).toHaveProperty('channels');
      
      // Emergency should use all available channels
      expect(response.body.channels).toContain('sms');
      expect(response.body.channels).toContain('voice');
      expect(response.body.channels).toContain('email');
    });

    test('Should implement alert cascading for critical events', async () => {
      const cascadeAlert = {
        type: 'cascade',
        initialSeverity: 'high',
        escalationTrigger: 'no_acknowledgment',
        escalationDelay: 300, // 5 minutes
        levels: [
          { recipients: 'farmers', severity: 'high' },
          { recipients: 'coordinators', severity: 'critical' },
          { recipients: 'emergency_services', severity: 'emergency' }
        ]
      };
      
      const response = await request(app)
        .post('/api/alerts/cascade')
        .send(cascadeAlert);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cascadeId');
      expect(response.body).toHaveProperty('currentLevel');
      expect(response.body.currentLevel).toBe(0);
      expect(response.body).toHaveProperty('nextEscalation');
    });

    test('Should track emergency response times', async () => {
      const emergencyId = 99001;
      
      const response = await request(app)
        .get(`/api/alerts/emergency/${emergencyId}/response-metrics`);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('metrics');
        
        const metrics = response.body.metrics;
        expect(metrics).toHaveProperty('alertSentTime');
        expect(metrics).toHaveProperty('firstAcknowledgment');
        expect(metrics).toHaveProperty('fullAcknowledgment');
        expect(metrics).toHaveProperty('responseRate');
        expect(metrics).toHaveProperty('averageResponseTime');
      }
    });
  });

  describe('Alert Analytics', () => {
    test('Should provide alert effectiveness metrics', async () => {
      const response = await request(app)
        .get('/api/alerts/analytics')
        .query({ period: 'month' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('effectiveness');
      
      const effectiveness = response.body.effectiveness;
      expect(effectiveness).toHaveProperty('deliveryRate');
      expect(effectiveness).toHaveProperty('acknowledgmentRate');
      expect(effectiveness).toHaveProperty('falsePositiveRate');
      expect(effectiveness).toHaveProperty('averageDeliveryTime');
      expect(effectiveness).toHaveProperty('channelPerformance');
    });

    test('Should identify alert fatigue patterns', async () => {
      const response = await request(app)
        .get('/api/alerts/analytics/fatigue')
        .query({ farmId: 1 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fatigueIndicators');
      
      const indicators = response.body.fatigueIndicators;
      expect(indicators).toHaveProperty('alertFrequency');
      expect(indicators).toHaveProperty('acknowledgmentTrend');
      expect(indicators).toHaveProperty('unsubscribeRate');
      expect(indicators).toHaveProperty('recommendation');
    });

    test('Should generate alert optimization recommendations', async () => {
      const response = await request(app)
        .get('/api/alerts/analytics/recommendations');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBeTruthy();
      
      response.body.recommendations.forEach(rec => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('impact');
        expect(rec).toHaveProperty('priority');
      });
    });
  });

  describe('Integration with External Services', () => {
    test('Should integrate with weather alert services', async () => {
      const response = await request(app)
        .get('/api/alerts/external/weather')
        .query({ lat: 40.0, lon: -120.0 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('weatherAlerts');
      
      if (response.body.weatherAlerts.length > 0) {
        const alert = response.body.weatherAlerts[0];
        expect(alert).toHaveProperty('source');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('validUntil');
      }
    });

    test('Should sync with emergency broadcast systems', async () => {
      const syncRequest = {
        system: 'county_emergency',
        region: 'sacramento_county',
        types: ['fire', 'air_quality', 'evacuation']
      };
      
      const response = await request(app)
        .post('/api/alerts/external/sync')
        .send(syncRequest);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('synced');
      expect(response.body).toHaveProperty('lastSync');
      expect(response.body).toHaveProperty('activeAlerts');
    });
  });

  describe('Security and Validation', () => {
    test('Should validate phone numbers before sending SMS', async () => {
      const invalidAlert = {
        type: 'test',
        recipients: [
          { phone: '123' }, // Too short
          { phone: 'not-a-number' },
          { phone: '+1234567890123456789' } // Too long
        ]
      };
      
      const response = await request(app)
        .post('/api/alerts/send')
        .send(invalidAlert);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toHaveProperty('invalidPhones');
      expect(response.body.errors.invalidPhones).toHaveLength(3);
    });

    test('Should sanitize alert messages', async () => {
      const alertWithScript = {
        type: 'custom',
        message: '<script>alert("XSS")</script>Important message',
        recipients: [{ farmId: 1 }]
      };
      
      const response = await request(app)
        .post('/api/alerts/send')
        .send(alertWithScript);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sanitizedMessage');
      expect(response.body.sanitizedMessage).not.toContain('<script>');
      expect(response.body.sanitizedMessage).toContain('Important message');
    });

    test('Should enforce authentication for alert management', async () => {
      const response = await request(app)
        .delete('/api/alerts/99001')
        .set('Authorization', 'Bearer invalid-token');
      
      expect([401, 403]).toContain(response.status);
    });
  });
});

module.exports = {
  // Helper functions for alert testing
  formatAlertMessage: (type, data) => {
    const templates = {
      pm25_warning: `WARNING: PM2.5 levels at ${data.level} µg/m³. ${data.action}`,
      schedule_change: `Schedule Update: Burn moved from ${data.oldTime} to ${data.newTime}`,
      emergency: `EMERGENCY: ${data.threat}. ${data.instruction}`
    };
    
    return templates[type] || 'Alert: Please check your burn schedule';
  },
  
  calculateDeliveryPriority: (severity, population) => {
    const severityScores = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
      emergency: 5
    };
    
    const severityScore = severityScores[severity] || 1;
    const populationScore = Math.min(5, Math.ceil(population / 5000));
    
    return severityScore * populationScore;
  },
  
  validatePhoneNumber: (phone) => {
    const phoneRegex = /^\+[1-9]\d{10,14}$/;
    return phoneRegex.test(phone);
  }
};