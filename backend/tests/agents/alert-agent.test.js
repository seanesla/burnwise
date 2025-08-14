const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const AlertSystem = require('../../agents/alerts');
const { initializeDatabase, query, pool } = require('../../db/connection');

describe('Alert Agent Tests - Notification and Burn Window Management', () => {
  let alertSystem;
  let testFarms;
  let testBurnRequests;
  
  beforeAll(async () => {
    await initializeDatabase();
    alertSystem = new AlertSystem();
    
    // Create test data
    testFarms = [
      {
        farm_id: 101,
        farm_name: 'Valley Farm',
        owner_name: 'John Smith',
        contact_phone: '+15551234567',
        contact_email: 'john@valleyfarm.com',
        latitude: 40.0,
        longitude: -120.0
      },
      {
        farm_id: 102,
        farm_name: 'Hill Ranch',
        owner_name: 'Jane Doe',
        contact_phone: '+15559876543',
        contact_email: 'jane@hillranch.com',
        latitude: 40.01,
        longitude: -120.01
      },
      {
        farm_id: 103,
        farm_name: 'River Fields',
        owner_name: 'Bob Wilson',
        contact_phone: '+15555551234',
        contact_email: 'bob@riverfields.com',
        latitude: 40.02,
        longitude: -119.99
      }
    ];
    
    testBurnRequests = [
      {
        request_id: 7001,
        field_id: 201,
        farm_id: 101,
        requested_date: '2025-08-25',
        requested_start_time: '09:00',
        requested_end_time: '13:00',
        scheduled_date: '2025-08-25',
        scheduled_start_time: '09:00',
        scheduled_end_time: '13:00',
        status: 'scheduled'
      },
      {
        request_id: 7002,
        field_id: 202,
        farm_id: 102,
        requested_date: '2025-08-25',
        requested_start_time: '10:00',
        requested_end_time: '14:00',
        status: 'pending'
      }
    ];
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('PM2.5 Hazard Level Determination', () => {
    test('Should correctly classify Good air quality (<12 µg/m³)', () => {
      const levels = [0, 5, 10, 11.9];
      levels.forEach(pm25 => {
        expect(alertSystem.getPM25HazardLevel(pm25)).toBe('Good');
      });
    });

    test('Should correctly classify Moderate air quality (12-35 µg/m³)', () => {
      const levels = [12, 20, 30, 34.9];
      levels.forEach(pm25 => {
        expect(alertSystem.getPM25HazardLevel(pm25)).toBe('Moderate');
      });
    });

    test('Should correctly classify Unhealthy for Sensitive Groups (35-55 µg/m³)', () => {
      const levels = [35, 40, 50, 54.9];
      levels.forEach(pm25 => {
        expect(alertSystem.getPM25HazardLevel(pm25)).toBe('Unhealthy for Sensitive Groups');
      });
    });

    test('Should correctly classify Unhealthy (55-150 µg/m³)', () => {
      const levels = [55, 75, 100, 149.9];
      levels.forEach(pm25 => {
        expect(alertSystem.getPM25HazardLevel(pm25)).toBe('Unhealthy');
      });
    });

    test('Should correctly classify Very Unhealthy (150-250 µg/m³)', () => {
      const levels = [150, 175, 200, 249.9];
      levels.forEach(pm25 => {
        expect(alertSystem.getPM25HazardLevel(pm25)).toBe('Very Unhealthy');
      });
    });

    test('Should correctly classify Hazardous (>250 µg/m³)', () => {
      const levels = [250, 300, 400, 500];
      levels.forEach(pm25 => {
        expect(alertSystem.getPM25HazardLevel(pm25)).toBe('Hazardous');
      });
    });
  });

  describe('Safety Recommendations', () => {
    test('Should provide appropriate recommendations for each hazard level', () => {
      const recommendations = {
        'Good': 'Air quality is satisfactory.',
        'Moderate': 'Unusually sensitive people should consider limiting prolonged outdoor exertion.',
        'Unhealthy for Sensitive Groups': 'Sensitive groups should limit prolonged outdoor exertion.',
        'Unhealthy': 'Everyone should limit prolonged outdoor exertion. Keep windows closed.',
        'Very Unhealthy': 'Everyone should avoid outdoor exertion. Keep windows and doors closed.',
        'Hazardous': 'Everyone should avoid all outdoor activities. Seal windows and doors.'
      };
      
      Object.entries(recommendations).forEach(([level, expected]) => {
        const actual = alertSystem.getSafetyRecommendations(level);
        expect(actual).toBe(expected);
      });
    });

    test('Should provide default recommendation for unknown levels', () => {
      const recommendation = alertSystem.getSafetyRecommendations('Unknown');
      expect(recommendation).toBe('Monitor air quality closely.');
    });
  });

  describe('Alert Creation and Storage', () => {
    test('Should create alert with all required fields', async () => {
      const alertData = {
        farmId: 101,
        burnRequestId: 7001,
        alertType: 'burn_scheduled',
        severity: 'info',
        message: 'Your burn has been scheduled',
        deliveryMethod: 'sms',
        recipientContact: '+15551234567'
      };
      
      // Mock the query function to return an insert result
      const originalQuery = query;
      const mockQuery = jest.fn().mockResolvedValue({ insertId: 8001 });
      require('../../db/connection').query = mockQuery;
      
      const alertId = await alertSystem.createAlert(alertData);
      
      expect(alertId).toBe(8001);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alerts'),
        expect.arrayContaining([
          101, 7001, 'burn_scheduled', 'info',
          'Your burn has been scheduled', 'sms', '+15551234567'
        ])
      );
      
      require('../../db/connection').query = originalQuery;
    });

    test('Should handle null burn request ID', async () => {
      const alertData = {
        farmId: 101,
        burnRequestId: null,
        alertType: 'general_warning',
        severity: 'warning',
        message: 'High wind warning',
        deliveryMethod: 'sms',
        recipientContact: '+15551234567'
      };
      
      const originalQuery = query;
      const mockQuery = jest.fn().mockResolvedValue({ insertId: 8002 });
      require('../../db/connection').query = mockQuery;
      
      const alertId = await alertSystem.createAlert(alertData);
      
      expect(alertId).toBe(8002);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([101, null])
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Phone Number Formatting', () => {
    test('Should format 10-digit US numbers correctly', () => {
      const numbers = [
        { input: '5551234567', expected: '+15551234567' },
        { input: '(555) 123-4567', expected: '+15551234567' },
        { input: '555-123-4567', expected: '+15551234567' },
        { input: '555.123.4567', expected: '+15551234567' }
      ];
      
      numbers.forEach(({ input, expected }) => {
        expect(alertSystem.formatPhoneNumber(input)).toBe(expected);
      });
    });

    test('Should handle 11-digit numbers with country code', () => {
      const numbers = [
        { input: '15551234567', expected: '+15551234567' },
        { input: '1-555-123-4567', expected: '+15551234567' },
        { input: '+15551234567', expected: '+15551234567' }
      ];
      
      numbers.forEach(({ input, expected }) => {
        expect(alertSystem.formatPhoneNumber(input)).toBe(expected);
      });
    });

    test('Should return original for invalid formats', () => {
      const numbers = ['123', '555123456', '12345678901234', 'invalid'];
      
      numbers.forEach(number => {
        expect(alertSystem.formatPhoneNumber(number)).toBe(number);
      });
    });
  });

  describe('Burn Scheduled Alerts', () => {
    test('Should send burn scheduled alert with correct message format', async () => {
      const burnRequest = {
        request_id: 7001,
        field_id: 201,
        scheduled_date: '2025-08-25',
        scheduled_start_time: '09:00',
        scheduled_end_time: '13:00'
      };
      
      // Mock database and SMS
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([{ // Farm query
          farm_id: 101,
          field_name: 'North Field',
          contact_phone: '5551234567'
        }])
        .mockResolvedValueOnce({ insertId: 8003 }); // Alert creation
      
      require('../../db/connection').query = mockQuery;
      
      // Mock SMS sending
      alertSystem.sendSMS = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'MSG123',
        status: 'queued'
      });
      
      const result = await alertSystem.sendBurnScheduledAlert(burnRequest);
      
      expect(result.alertId).toBe(8003);
      expect(result.smsResult.success).toBeTruthy();
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        '+15551234567',
        expect.stringContaining('North Field')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('2025-08-25')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('09:00')
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Burn Starting Alerts', () => {
    test('Should notify neighbors within 10km radius', async () => {
      const burnRequest = {
        request_id: 7001,
        field_id: 201
      };
      
      // Mock database queries
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([ // Neighbors query
          { farm_id: 102, farm_name: 'Hill Ranch', contact_phone: '5559876543', distance_km: 2.5 },
          { farm_id: 103, farm_name: 'River Fields', contact_phone: '5555551234', distance_km: 5.8 }
        ])
        .mockResolvedValue({ insertId: 8004 }); // Alert creations
      
      require('../../db/connection').query = mockQuery;
      
      // Mock SMS
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      const alerts = await alertSystem.sendBurnStartingAlert(burnRequest);
      
      expect(alerts).toHaveLength(2);
      expect(alerts[0].distance).toBe(2.5);
      expect(alerts[1].distance).toBe(5.8);
      
      // Should send SMS to each neighbor
      expect(alertSystem.sendSMS).toHaveBeenCalledTimes(2);
      
      // Messages should include distance
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('2.5km')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('5.8km')
      );
      
      require('../../db/connection').query = originalQuery;
    });

    test('Should include smoke impact warning in message', async () => {
      const burnRequest = { request_id: 7001, field_id: 201 };
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([
          { farm_id: 102, contact_phone: '5559876543', distance_km: 3.0 }
        ])
        .mockResolvedValue({ insertId: 8005 });
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      await alertSystem.sendBurnStartingAlert(burnRequest);
      
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('smoke may affect')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('2-4 hours')
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Smoke Warning Alerts', () => {
    test('Should send critical alerts for hazardous PM2.5 levels', async () => {
      const affectedArea = {
        type: 'Polygon',
        coordinates: [[[-120.01, 40.01], [-119.99, 40.01], [-119.99, 39.99], [-120.01, 39.99], [-120.01, 40.01]]]
      };
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([ // Affected farms
          { farm_id: 101, farm_name: 'Valley Farm', contact_phone: '5551234567' },
          { farm_id: 102, farm_name: 'Hill Ranch', contact_phone: '5559876543' }
        ])
        .mockResolvedValue({ insertId: 8006 });
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      const alerts = await alertSystem.sendSmokeWarning(affectedArea, 175, 3);
      
      expect(alerts).toHaveLength(2);
      
      // Should send Very Unhealthy warning
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Very Unhealthy')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('175µg/m³')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('3 hours')
      );
      
      // Should include safety recommendations
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('avoid outdoor exertion')
      );
      
      require('../../db/connection').query = originalQuery;
    });

    test('Should set severity based on PM2.5 levels', async () => {
      const affectedArea = { type: 'Polygon', coordinates: [[]] };
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([{ farm_id: 101, contact_phone: '5551234567' }])
        .mockResolvedValue({ insertId: 8007 });
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      // Test critical severity (PM2.5 > 150)
      await alertSystem.sendSmokeWarning(affectedArea, 200, 2);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alerts'),
        expect.arrayContaining(['critical'])
      );
      
      // Reset mock
      mockQuery.mockClear();
      mockQuery
        .mockResolvedValueOnce([{ farm_id: 101, contact_phone: '5551234567' }])
        .mockResolvedValue({ insertId: 8008 });
      
      // Test warning severity (PM2.5 <= 150)
      await alertSystem.sendSmokeWarning(affectedArea, 100, 2);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alerts'),
        expect.arrayContaining(['warning'])
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Schedule Change Alerts', () => {
    test('Should notify farmer of schedule changes with reason', async () => {
      const burnRequest = { request_id: 7001, field_id: 201 };
      const oldSchedule = { date: '2025-08-25', time: '09:00' };
      const newSchedule = { date: '2025-08-26', time: '10:00', reason: 'weather conditions' };
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([{ // Farm query
          farm_id: 101,
          contact_phone: '5551234567'
        }])
        .mockResolvedValue({ insertId: 8009 });
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      const result = await alertSystem.sendScheduleChangeAlert(
        burnRequest,
        oldSchedule,
        newSchedule
      );
      
      expect(result.alertId).toBe(8009);
      
      // Message should include old and new schedule
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('2025-08-25 09:00')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('2025-08-26 10:00')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('weather conditions')
      );
      
      // Should include action options
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('ACCEPT')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('DISCUSS')
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Conflict Detection Alerts', () => {
    test('Should alert both farms involved in conflict', async () => {
      const conflict = {
        request_id_1: 7001,
        request_id_2: 7002,
        conflict_severity: 'critical',
        max_combined_pm25: 185
      };
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([ // Farms query
          { farm_id: 101, contact_phone: '5551234567' },
          { farm_id: 102, contact_phone: '5559876543' }
        ])
        .mockResolvedValue({ insertId: 8010 });
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      const alerts = await alertSystem.sendConflictDetectedAlert(conflict);
      
      expect(alerts).toHaveLength(2);
      expect(alertSystem.sendSMS).toHaveBeenCalledTimes(2);
      
      // Message should include PM2.5 level
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('185µg/m³')
      );
      
      // Should promise resolution
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('within 2 hours')
      );
      
      require('../../db/connection').query = originalQuery;
    });

    test('Should set critical severity for critical conflicts', async () => {
      const conflict = {
        request_id_1: 7001,
        request_id_2: 7002,
        conflict_severity: 'critical',
        max_combined_pm25: 200
      };
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([{ farm_id: 101, contact_phone: '5551234567' }])
        .mockResolvedValue({ insertId: 8011 });
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      await alertSystem.sendConflictDetectedAlert(conflict);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alerts'),
        expect.arrayContaining(['critical'])
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Burn Window Trading', () => {
    test('Should process burn window trade proposals', async () => {
      const trade = {
        offering_farm_id: 101,
        requesting_farm_id: 102,
        offering_request_id: 7001,
        requesting_request_id: 7002,
        trade_type: 'swap',
        compensation_type: 'monetary',
        compensation_amount: 500,
        notes: 'Urgent harvest needed'
      };
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([ // Farms query
          { farm_id: 101, farm_name: 'Valley Farm', owner_name: 'John', contact_phone: '5551234567' },
          { farm_id: 102, farm_name: 'Hill Ranch', owner_name: 'Jane', contact_phone: '5559876543' }
        ])
        .mockResolvedValueOnce({ insertId: 8012 }) // Alert creation
        .mockResolvedValueOnce({ insertId: 9001 }); // Trade creation
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn().mockResolvedValue({ success: true });
      
      const result = await alertSystem.processBurnWindowTrade(trade);
      
      expect(result.tradeId).toBe(9001);
      expect(result.alertId).toBe(8012);
      expect(result.status).toBe('proposed');
      
      // Should notify offering farm
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        '+15551234567',
        expect.stringContaining('Hill Ranch')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('monetary: 500')
      );
      
      // Should include response options
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('ACCEPT')
      );
      expect(alertSystem.sendSMS).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('DECLINE')
      );
      
      // Should store trade in database
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO burn_trades'),
        expect.arrayContaining([101, 102, 7001, 7002, 'swap', 500, 'monetary'])
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Alert Delivery and Retry', () => {
    test('Should process pending alerts with retry limit', async () => {
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce([ // Pending alerts
          {
            alert_id: 8013,
            delivery_method: 'sms',
            recipient_contact: '5551234567',
            message: 'Test alert 1',
            delivery_attempts: 1
          },
          {
            alert_id: 8014,
            delivery_method: 'sms',
            recipient_contact: '5559876543',
            message: 'Test alert 2',
            delivery_attempts: 2
          }
        ])
        .mockResolvedValue({ affectedRows: 1 });
      
      require('../../db/connection').query = mockQuery;
      
      alertSystem.sendSMS = jest.fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false });
      
      const processed = await alertSystem.processPendingAlerts();
      
      expect(processed).toBe(2);
      expect(alertSystem.sendSMS).toHaveBeenCalledTimes(2);
      
      // Should query for pending alerts with retry limit
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('delivery_attempts < 3')
      );
      
      require('../../db/connection').query = originalQuery;
    });

    test('Should update alert status after delivery attempt', async () => {
      const originalQuery = query;
      const mockQuery = jest.fn().mockResolvedValue({ affectedRows: 1 });
      
      require('../../db/connection').query = mockQuery;
      
      await alertSystem.updateAlertStatus(8015, 'delivered');
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE alerts'),
        expect.arrayContaining(['delivered', 'delivered', 8015])
      );
      
      // Should increment delivery attempts
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('delivery_attempts = delivery_attempts + 1'),
        expect.any(Array)
      );
      
      // Should set delivered_at timestamp for successful delivery
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('Alert Statistics and History', () => {
    test('Should retrieve alert history for a farm', async () => {
      const originalQuery = query;
      const mockQuery = jest.fn().mockResolvedValue([
        {
          alert_id: 8016,
          alert_type: 'burn_scheduled',
          severity: 'info',
          created_at: '2025-08-24 10:00:00',
          burn_status: 'scheduled'
        },
        {
          alert_id: 8017,
          alert_type: 'smoke_warning',
          severity: 'warning',
          created_at: '2025-08-23 14:00:00',
          burn_status: null
        }
      ]);
      
      require('../../db/connection').query = mockQuery;
      
      const history = await alertSystem.getAlertHistory(101, 10);
      
      expect(history).toHaveLength(2);
      expect(history[0].alert_id).toBe(8016);
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY a.created_at DESC'),
        [101, 10]
      );
      
      require('../../db/connection').query = originalQuery;
    });

    test('Should calculate alert statistics', async () => {
      const originalQuery = query;
      const mockQuery = jest.fn().mockResolvedValue([
        {
          alert_type: 'burn_scheduled',
          severity: 'info',
          delivery_status: 'sent',
          count: 10,
          avg_delivery_time_minutes: 2.5
        },
        {
          alert_type: 'smoke_warning',
          severity: 'warning',
          delivery_status: 'sent',
          count: 5,
          avg_delivery_time_minutes: 3.0
        },
        {
          alert_type: 'conflict_detected',
          severity: 'critical',
          delivery_status: 'failed',
          count: 2,
          avg_delivery_time_minutes: null
        }
      ]);
      
      require('../../db/connection').query = mockQuery;
      
      const stats = await alertSystem.getAlertStatistics('2025-08-01', '2025-08-31');
      
      expect(stats.total).toBe(17);
      expect(stats.byType.burn_scheduled).toBe(10);
      expect(stats.byType.smoke_warning).toBe(5);
      expect(stats.byType.conflict_detected).toBe(2);
      expect(stats.bySeverity.info).toBe(10);
      expect(stats.bySeverity.warning).toBe(5);
      expect(stats.bySeverity.critical).toBe(2);
      expect(stats.deliverySuccess).toBe(15);
      expect(stats.deliveryRate).toBe('88.2');
      
      require('../../db/connection').query = originalQuery;
    });
  });

  describe('sendAlerts Method for Schedule Integration', () => {
    test('Should create alerts for schedule changes', async () => {
      const schedule = [
        {
          burnRequestId: 7001,
          farmId: 101,
          scheduledTime: new Date('2025-08-26 10:00'),
          changes: {
            rescheduled: true,
            newTime: new Date('2025-08-26 10:00')
          }
        },
        {
          burnRequestId: 7002,
          farmId: 102,
          scheduledTime: new Date('2025-08-25 14:00'),
          changes: null
        }
      ];
      
      const originalQuery = query;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ insertId: 8018 }) // Schedule change alert
        .mockResolvedValueOnce({ insertId: 8019 }) // Reminder for first
        .mockResolvedValueOnce({ insertId: 8020 }); // Reminder for second
      
      require('../../db/connection').query = mockQuery;
      
      const result = await alertSystem.sendAlerts(schedule);
      
      expect(result.sent).toHaveLength(3);
      
      // Should have one schedule change alert
      const changeAlerts = result.sent.filter(a => a.type === 'schedule_change');
      expect(changeAlerts).toHaveLength(1);
      expect(changeAlerts[0].severity).toBe('warning');
      
      // Should have two reminder alerts
      const reminderAlerts = result.sent.filter(a => a.type === 'burn_reminder');
      expect(reminderAlerts).toHaveLength(2);
      expect(reminderAlerts[0].severity).toBe('info');
      
      require('../../db/connection').query = originalQuery;
    });

    test('Should handle errors gracefully', async () => {
      const schedule = [{ burnRequestId: 7001, farmId: 101 }];
      
      const originalQuery = query;
      const mockQuery = jest.fn().mockRejectedValue(new Error('Database error'));
      
      require('../../db/connection').query = mockQuery;
      
      const result = await alertSystem.sendAlerts(schedule);
      
      expect(result.sent).toEqual([]);
      expect(result.error).toBe('Database error');
      
      require('../../db/connection').query = originalQuery;
    });
  });
});