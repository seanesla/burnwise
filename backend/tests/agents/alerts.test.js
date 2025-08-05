const alertsAgent = require('../../agents/alerts');
const { query } = require('../../db/connection');
const logger = require('../../middleware/logger');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');
jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn()
    }
  }))
}));

// Mock Socket.io
const mockIo = {
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis()
};

describe('Alerts Agent Tests', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { 
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'test_sid',
      TWILIO_AUTH_TOKEN: 'test_token',
      TWILIO_PHONE_NUMBER: '+1234567890'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Initialization Tests', () => {
    test('should initialize with default configuration', () => {
      expect(alertsAgent.isInitialized()).toBe(false);
      expect(() => alertsAgent.initialize(mockIo)).not.toThrow();
      expect(alertsAgent.isInitialized()).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      const config = {
        maxSmsPerHour: 50,
        maxSmsPerDay: 200,
        retryAttempts: 5,
        retryDelay: 2000,
        alertPriorities: ['critical', 'high', 'medium', 'low']
      };
      
      expect(() => alertsAgent.initialize(mockIo, config)).not.toThrow();
      const status = alertsAgent.getStatus();
      expect(status.config.maxSmsPerHour).toBe(50);
      expect(status.config.retryAttempts).toBe(5);
    });

    test('should handle missing Twilio credentials gracefully', () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      
      expect(() => alertsAgent.initialize(mockIo)).not.toThrow();
      const status = alertsAgent.getStatus();
      expect(status.twilioConfigured).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Twilio credentials not configured')
      );
    });

    test('should validate Socket.io instance', () => {
      expect(() => alertsAgent.initialize(null)).toThrow('Socket.io instance required');
      expect(() => alertsAgent.initialize({})).toThrow('Invalid Socket.io instance');
    });

    test('should not reinitialize if already initialized', () => {
      alertsAgent.initialize(mockIo);
      const firstStatus = alertsAgent.getStatus();
      alertsAgent.initialize(mockIo);
      const secondStatus = alertsAgent.getStatus();
      expect(firstStatus.initializedAt).toEqual(secondStatus.initializedAt);
    });
  });

  describe('2. SMS Alert Tests', () => {
    let mockTwilioClient;

    beforeEach(() => {
      const Twilio = require('twilio');
      mockTwilioClient = {
        messages: {
          create: jest.fn().mockResolvedValue({
            sid: 'SM1234567890',
            status: 'sent',
            to: '+1987654321',
            body: 'Test message'
          })
        }
      };
      Twilio.mockReturnValue(mockTwilioClient);
      alertsAgent.initialize(mockIo);
    });

    test('should send basic SMS alerts successfully', async () => {
      const alertData = {
        type: 'air_quality_alert',
        priority: 'high',
        message: 'PM2.5 levels exceeding EPA standards detected in your area',
        recipients: ['+1987654321'],
        burnId: 1,
        location: { latitude: 37.5, longitude: -120.5 }
      };

      const result = await alertsAgent.sendSmsAlert(alertData);
      
      expect(result.success).toBe(true);
      expect(result.messagesSent).toBe(1);
      expect(result.deliveryIds).toHaveLength(1);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: expect.stringContaining('PM2.5 levels exceeding'),
        to: '+1987654321',
        from: '+1234567890'
      });
    });

    test('should handle multiple recipients', async () => {
      const alertData = {
        type: 'conflict_alert',
        priority: 'critical',
        message: 'Burn conflict detected between Farm A and Farm B',
        recipients: ['+1987654321', '+1555666777', '+1999888777'],
        burnId: 1
      };

      mockTwilioClient.messages.create
        .mockResolvedValueOnce({ sid: 'SM001', status: 'sent' })
        .mockResolvedValueOnce({ sid: 'SM002', status: 'sent' })
        .mockResolvedValueOnce({ sid: 'SM003', status: 'sent' });

      const result = await alertsAgent.sendSmsAlert(alertData);
      
      expect(result.success).toBe(true);
      expect(result.messagesSent).toBe(3);
      expect(result.deliveryIds).toHaveLength(3);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(3);
    });

    test('should apply rate limiting for SMS', async () => {
      alertsAgent.initialize(mockIo, { maxSmsPerHour: 2 });

      const alertData = {
        type: 'weather_alert',
        priority: 'medium',
        message: 'Weather conditions changing',
        recipients: ['+1987654321'],
        burnId: 1
      };

      // Send 3 alerts, should rate limit the 3rd
      await alertsAgent.sendSmsAlert(alertData);
      await alertsAgent.sendSmsAlert(alertData);
      const thirdResult = await alertsAgent.sendSmsAlert(alertData);
      
      expect(thirdResult.success).toBe(false);
      expect(thirdResult.error).toContain('rate limit');
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
    });

    test('should retry failed SMS deliveries', async () => {
      const alertData = {
        type: 'urgent_alert',
        priority: 'critical',
        message: 'Immediate attention required',
        recipients: ['+1987654321'],
        burnId: 1
      };

      mockTwilioClient.messages.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({ sid: 'SM123', status: 'sent' });

      const result = await alertsAgent.sendSmsAlert(alertData);
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(2);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(3);
    });

    test('should handle SMS delivery failures gracefully', async () => {
      const alertData = {
        type: 'test_alert',
        priority: 'low',
        message: 'Test message',
        recipients: ['+1987654321'],
        burnId: 1
      };

      mockTwilioClient.messages.create.mockRejectedValue(new Error('Invalid phone number'));

      const result = await alertsAgent.sendSmsAlert(alertData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SMS delivery failed'),
        expect.any(Object)
      );
    });

    test('should validate phone number formats', () => {
      const validNumbers = ['+1234567890', '+1-234-567-8900', '(234) 567-8900'];
      const invalidNumbers = ['123456789', 'not-a-phone', '', null];

      validNumbers.forEach(number => {
        expect(alertsAgent.validatePhoneNumber(number)).toBe(true);
      });

      invalidNumbers.forEach(number => {
        expect(alertsAgent.validatePhoneNumber(number)).toBe(false);
      });
    });

    test('should format SMS messages according to templates', () => {
      const alertData = {
        type: 'air_quality_alert',
        priority: 'high',
        farmName: 'Johnson Farm',
        pm25Level: 45.2,
        epaLimit: 35,
        location: 'Fresno County',
        burnId: 123
      };

      const message = alertsAgent.formatSmsMessage(alertData);
      
      expect(message).toContain('Johnson Farm');
      expect(message).toContain('45.2');
      expect(message).toContain('35');
      expect(message).toContain('Fresno County');
      expect(message.length).toBeLessThanOrEqual(160); // SMS character limit
    });
  });

  describe('3. Socket.io Real-time Alerts Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should emit global alerts to all connected clients', async () => {
      const alertData = {
        type: 'system_alert',
        priority: 'critical',
        message: 'System maintenance scheduled',
        scope: 'global'
      };

      await alertsAgent.sendSocketAlert(alertData);
      
      expect(mockIo.emit).toHaveBeenCalledWith('global_alert', {
        type: 'system_alert',
        priority: 'critical',
        message: 'System maintenance scheduled',
        timestamp: expect.any(Date),
        alertId: expect.any(String)
      });
    });

    test('should emit farm-specific alerts to farm rooms', async () => {
      const alertData = {
        type: 'burn_approved',
        priority: 'medium',
        message: 'Your burn request has been approved',
        farmId: 'farm_123',
        burnId: 456
      };

      await alertsAgent.sendSocketAlert(alertData);
      
      expect(mockIo.to).toHaveBeenCalledWith('farm_123');
      expect(mockIo.emit).toHaveBeenCalledWith('farm_alert', {
        type: 'burn_approved',
        priority: 'medium',
        message: 'Your burn request has been approved',
        farmId: 'farm_123',
        burnId: 456,
        timestamp: expect.any(Date),
        alertId: expect.any(String)
      });
    });

    test('should emit region-specific alerts', async () => {
      const alertData = {
        type: 'weather_warning',
        priority: 'high',
        message: 'High wind warning for Central Valley region',
        region: 'central_valley',
        affectedFarms: ['farm_123', 'farm_456', 'farm_789']
      };

      await alertsAgent.sendSocketAlert(alertData);
      
      expect(mockIo.in).toHaveBeenCalledWith('region_central_valley');
      expect(mockIo.emit).toHaveBeenCalledWith('region_alert', expect.objectContaining({
        type: 'weather_warning',
        priority: 'high',
        region: 'central_valley',
        affectedFarms: ['farm_123', 'farm_456', 'farm_789']
      }));
    });

    test('should handle Socket.io emission failures', async () => {
      mockIo.emit.mockImplementation(() => {
        throw new Error('Socket connection lost');
      });

      const alertData = {
        type: 'test_alert',
        priority: 'low',
        message: 'Test message'
      };

      const result = await alertsAgent.sendSocketAlert(alertData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Socket connection lost');
      expect(logger.error).toHaveBeenCalled();
    });

    test('should track active socket connections', () => {
      const connections = alertsAgent.getActiveConnections();
      
      expect(connections).toHaveProperty('total');
      expect(connections).toHaveProperty('byFarm');
      expect(connections).toHaveProperty('byRegion');
      expect(connections.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. Alert Types and Templates Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should support air quality alert templates', () => {
      const alertData = {
        type: 'air_quality_alert',
        pm25Level: 42.3,
        epaLimit: 35,
        location: 'Davis, CA',
        exceedancePercentage: 21
      };

      const template = alertsAgent.getAlertTemplate('air_quality_alert');
      const message = alertsAgent.applyTemplate(template, alertData);
      
      expect(message).toContain('42.3');
      expect(message).toContain('35');
      expect(message).toContain('Davis, CA');
      expect(message).toContain('21%');
    });

    test('should support conflict alert templates', () => {
      const alertData = {
        type: 'conflict_alert',
        farm1Name: 'Johnson Farm',
        farm2Name: 'Smith Ranch',
        conflictType: 'smoke_overlap',
        severity: 'high',
        distance: 1.2,
        estimatedPM25: 38.5
      };

      const template = alertsAgent.getAlertTemplate('conflict_alert');
      const message = alertsAgent.applyTemplate(template, alertData);
      
      expect(message).toContain('Johnson Farm');
      expect(message).toContain('Smith Ranch');
      expect(message).toContain('smoke_overlap');
      expect(message).toContain('1.2');
    });

    test('should support weather alert templates', () => {
      const alertData = {
        type: 'weather_alert',
        weatherType: 'high_wind',
        windSpeed: 25,
        threshold: 15,
        region: 'Sacramento Valley',
        recommendedAction: 'postpone_burns'
      };

      const template = alertsAgent.getAlertTemplate('weather_alert');
      const message = alertsAgent.applyTemplate(template, alertData);
      
      expect(message).toContain('high_wind');
      expect(message).toContain('25');
      expect(message).toContain('15');
      expect(message).toContain('Sacramento Valley');
    });

    test('should support burn status alert templates', () => {
      const alertData = {
        type: 'burn_status_alert',
        status: 'approved',
        farmName: 'Green Valley Farm',
        burnId: 789,
        scheduledDate: '2025-08-10',
        scheduledTime: '09:00 AM',
        acres: 150
      };

      const template = alertsAgent.getAlertTemplate('burn_status_alert');
      const message = alertsAgent.applyTemplate(template, alertData);
      
      expect(message).toContain('approved');
      expect(message).toContain('Green Valley Farm');
      expect(message).toContain('789');
      expect(message).toContain('2025-08-10');
      expect(message).toContain('150');
    });

    test('should handle custom alert templates', () => {
      const customTemplate = {
        type: 'custom_alert',
        template: 'Custom alert for {farmName}: {message}. Priority: {priority}',
        priority: 'medium'
      };

      alertsAgent.registerCustomTemplate(customTemplate);

      const alertData = {
        type: 'custom_alert',
        farmName: 'Test Farm',
        message: 'Custom message content',
        priority: 'high'
      };

      const message = alertsAgent.applyTemplate(customTemplate.template, alertData);
      
      expect(message).toBe('Custom alert for Test Farm: Custom message content. Priority: high');
    });

    test('should validate alert template parameters', () => {
      const template = alertsAgent.getAlertTemplate('air_quality_alert');
      const requiredParams = alertsAgent.getRequiredParameters(template);
      
      expect(requiredParams).toBeInstanceOf(Array);
      expect(requiredParams).toContain('pm25Level');
      expect(requiredParams).toContain('epaLimit');
      expect(requiredParams).toContain('location');
    });
  });

  describe('5. Alert Priority and Routing Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should route critical alerts to all available channels', async () => {
      const criticalAlert = {
        type: 'emergency_alert',
        priority: 'critical',
        message: 'Immediate evacuation required',
        recipients: ['+1987654321'],
        farmId: 'farm_123'
      };

      const result = await alertsAgent.sendAlert(criticalAlert);
      
      expect(result.channels).toContain('sms');
      expect(result.channels).toContain('socket');
      expect(result.allChannelsUsed).toBe(true);
    });

    test('should route high priority alerts to primary channels', async () => {
      const highAlert = {
        type: 'air_quality_alert',
        priority: 'high',
        message: 'PM2.5 levels elevated',
        recipients: ['+1987654321'],
        farmId: 'farm_123'
      };

      const result = await alertsAgent.sendAlert(highAlert);
      
      expect(result.channels).toContain('sms');
      expect(result.channels).toContain('socket');
    });

    test('should route medium priority alerts to socket only', async () => {
      const mediumAlert = {
        type: 'burn_approved',
        priority: 'medium',
        message: 'Burn request approved',
        farmId: 'farm_123'
      };

      const result = await alertsAgent.sendAlert(mediumAlert);
      
      expect(result.channels).toContain('socket');
      expect(result.channels).not.toContain('sms');
    });

    test('should route low priority alerts based on user preferences', async () => {
      query.mockResolvedValueOnce([{
        farm_id: 'farm_123',
        alert_preferences: JSON.stringify({
          low_priority_sms: false,
          low_priority_socket: true
        })
      }]);

      const lowAlert = {
        type: 'system_notification',
        priority: 'low',
        message: 'System update completed',
        farmId: 'farm_123'
      };

      const result = await alertsAgent.sendAlert(lowAlert);
      
      expect(result.channels).toContain('socket');
      expect(result.channels).not.toContain('sms');
    });

    test('should escalate unacknowledged critical alerts', async () => {
      const criticalAlert = {
        type: 'emergency_alert',
        priority: 'critical',
        message: 'Immediate attention required',
        recipients: ['+1987654321'],
        farmId: 'farm_123',
        escalationDelay: 300000 // 5 minutes
      };

      query.mockResolvedValueOnce([{ insertId: 999 }]);

      const result = await alertsAgent.sendAlert(criticalAlert);
      
      expect(result.escalationScheduled).toBe(true);
      expect(result.escalationTime).toBeDefined();
    });

    test('should filter duplicate alerts within time window', async () => {
      const alert = {
        type: 'air_quality_alert',
        priority: 'high',
        message: 'PM2.5 elevated',
        farmId: 'farm_123'
      };

      // Send same alert twice within short time window
      const result1 = await alertsAgent.sendAlert(alert);
      const result2 = await alertsAgent.sendAlert(alert);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.reason).toContain('duplicate');
    });
  });

  describe('6. Alert Persistence and Tracking Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
      query.mockClear();
    });

    test('should store alerts in database', async () => {
      const alertData = {
        type: 'air_quality_alert',
        priority: 'high',
        message: 'PM2.5 levels elevated',
        recipients: ['+1987654321'],
        farmId: 'farm_123'
      };

      query.mockResolvedValueOnce([{ insertId: 456 }]);

      await alertsAgent.sendAlert(alertData);
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO alerts'),
        expect.arrayContaining([
          'air_quality_alert',
          'high',
          expect.stringContaining('PM2.5 levels elevated'),
          'farm_123',
          expect.any(String), // recipients JSON
          expect.any(String), // alert_data JSON
          expect.any(Date)
        ])
      );
    });

    test('should track alert delivery status', async () => {
      const alertData = {
        type: 'conflict_alert',
        priority: 'critical',
        message: 'Burn conflict detected',
        recipients: ['+1987654321', '+1555666777'],
        farmId: 'farm_123'
      };

      query.mockResolvedValueOnce([{ insertId: 789 }]);

      const result = await alertsAgent.sendAlert(alertData);
      
      expect(result.deliveryTracking).toBeDefined();
      expect(result.deliveryTracking.totalRecipients).toBe(2);
      expect(result.deliveryTracking.deliveryStatuses).toBeInstanceOf(Array);
    });

    test('should update alert acknowledgment status', async () => {
      const alertId = 'alert_123';
      const farmId = 'farm_456';
      const acknowledgmentData = {
        acknowledgedAt: new Date(),
        acknowledgedBy: 'user_789',
        response: 'understood'
      };

      query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await alertsAgent.acknowledgeAlert(alertId, farmId, acknowledgmentData);
      
      expect(result.success).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE alerts SET acknowledged = TRUE'),
        expect.arrayContaining([
          expect.any(String), // acknowledgment_data JSON
          acknowledgmentData.acknowledgedAt,
          alertId
        ])
      );
    });

    test('should retrieve alert history for farms', async () => {
      const farmId = 'farm_123';
      query.mockResolvedValueOnce([
        {
          id: 'alert_001',
          type: 'air_quality_alert',
          priority: 'high',
          message: 'PM2.5 elevated',
          created_at: new Date('2025-08-09T10:00:00Z'),
          acknowledged: true
        },
        {
          id: 'alert_002',
          type: 'weather_alert',
          priority: 'medium',
          message: 'Wind conditions changing',
          created_at: new Date('2025-08-09T12:00:00Z'),
          acknowledged: false
        }
      ]);

      const history = await alertsAgent.getAlertHistory(farmId);
      
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM alerts WHERE farm_id = ?'),
        [farmId]
      );
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('air_quality_alert');
    });

    test('should handle database storage failures gracefully', async () => {
      const alertData = {
        type: 'test_alert',
        priority: 'low',
        message: 'Test message',
        farmId: 'farm_123'
      };

      query.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await alertsAgent.sendAlert(alertData);
      
      expect(result.success).toBe(true); // Should still send alert
      expect(result.databaseError).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store alert in database'),
        expect.any(Object)
      );
    });
  });

  describe('7. Alert Scheduling and Automation Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should schedule delayed alerts', async () => {
      const scheduledAlert = {
        type: 'burn_reminder',
        priority: 'medium',
        message: 'Your burn is scheduled to start in 1 hour',
        farmId: 'farm_123',
        scheduleTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      };

      const result = await alertsAgent.scheduleAlert(scheduledAlert);
      
      expect(result.success).toBe(true);
      expect(result.scheduledId).toBeDefined();
      expect(result.scheduleTime).toEqual(scheduledAlert.scheduleTime);
    });

    test('should cancel scheduled alerts', async () => {
      const scheduledAlert = {
        type: 'burn_reminder',
        priority: 'medium',
        message: 'Reminder message',
        farmId: 'farm_123',
        scheduleTime: new Date(Date.now() + 30 * 60 * 1000)
      };

      const scheduleResult = await alertsAgent.scheduleAlert(scheduledAlert);
      const cancelResult = await alertsAgent.cancelScheduledAlert(scheduleResult.scheduledId);
      
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.cancelled).toBe(true);
    });

    test('should handle recurring alert patterns', async () => {
      const recurringAlert = {
        type: 'weather_check',
        priority: 'low',
        message: 'Daily weather conditions check',
        farmId: 'farm_123',
        recurrencePattern: {
          type: 'daily',
          time: '08:00',
          daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      };

      const result = await alertsAgent.setupRecurringAlert(recurringAlert);
      
      expect(result.success).toBe(true);
      expect(result.recurringId).toBeDefined();
      expect(result.nextExecution).toBeDefined();
    });

    test('should trigger automatic alerts based on conditions', async () => {
      const condition = {
        type: 'pm25_threshold',
        threshold: 35,
        operator: 'greater_than',
        location: { latitude: 37.5, longitude: -120.5 },
        radius: 10000 // 10km radius
      };

      const autoAlert = {
        type: 'air_quality_alert',
        priority: 'high',
        template: 'air_quality_alert',
        recipients: ['+1987654321'],
        condition: condition
      };

      const result = await alertsAgent.setupAutomaticAlert(autoAlert);
      
      expect(result.success).toBe(true);
      expect(result.conditionId).toBeDefined();
      expect(result.monitoring).toBe(true);
    });

    test('should process scheduled alert queue', async () => {
      // Mock scheduled alerts in queue
      query.mockResolvedValueOnce([
        {
          id: 'scheduled_001',
          alert_data: JSON.stringify({
            type: 'burn_reminder',
            message: 'Burn starting soon',
            farmId: 'farm_123'
          }),
          scheduled_time: new Date(Date.now() - 1000) // Past due
        }
      ]);

      query.mockResolvedValueOnce([{ affectedRows: 1 }]); // Mark as processed

      const result = await alertsAgent.processScheduledAlerts();
      
      expect(result.processed).toBe(1);
      expect(result.alerts).toHaveLength(1);
      expect(mockIo.to).toHaveBeenCalledWith('farm_123');
    });
  });

  describe('8. Error Handling and Recovery Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should handle Twilio API failures gracefully', async () => {
      const Twilio = require('twilio');
      const mockTwilioClient = {
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Twilio API unavailable'))
        }
      };
      Twilio.mockReturnValue(mockTwilioClient);

      const alertData = {
        type: 'test_alert',
        priority: 'high',
        message: 'Test message',
        recipients: ['+1987654321']
      };

      const result = await alertsAgent.sendSmsAlert(alertData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Twilio API unavailable');
      expect(result.fallbackUsed).toBe(true);
    });

    test('should queue alerts when systems are unavailable', async () => {
      // Simulate system unavailability
      mockIo.emit.mockImplementation(() => {
        throw new Error('Socket.io unavailable');
      });

      const alertData = {
        type: 'system_alert',
        priority: 'medium',
        message: 'System message'
      };

      const result = await alertsAgent.sendAlert(alertData);
      
      expect(result.queued).toBe(true);
      expect(result.queuePosition).toBeGreaterThan(0);
    });

    test('should retry failed alert deliveries', async () => {
      const alertData = {
        type: 'retry_test',
        priority: 'high',
        message: 'Retry test message',
        recipients: ['+1987654321'],
        maxRetries: 3
      };

      let attemptCount = 0;
      mockIo.emit.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return true; // Success on 3rd attempt
      });

      const result = await alertsAgent.sendAlert(alertData);
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(2);
      expect(attemptCount).toBe(3);
    });

    test('should handle invalid alert data gracefully', async () => {
      const invalidAlerts = [
        { type: null, message: 'Invalid type' },
        { type: 'valid_type', priority: 'invalid_priority' },
        { type: 'valid_type', recipients: 'not_an_array' },
        { type: 'valid_type', message: '' }
      ];

      for (const invalidAlert of invalidAlerts) {
        const result = await alertsAgent.sendAlert(invalidAlert);
        expect(result.success).toBe(false);
        expect(result.validationErrors).toBeInstanceOf(Array);
        expect(result.validationErrors.length).toBeGreaterThan(0);
      }
    });

    test('should maintain alert queue integrity during failures', async () => {
      const alerts = [
        { type: 'alert1', priority: 'high', message: 'Message 1' },
        { type: 'alert2', priority: 'medium', message: 'Message 2' },
        { type: 'alert3', priority: 'critical', message: 'Message 3' }
      ];

      // Simulate partial system failure
      let callCount = 0;
      mockIo.emit.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Second alert fails');
        }
        return true;
      });

      const results = await Promise.allSettled(
        alerts.map(alert => alertsAgent.sendAlert(alert))
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failureCount = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;

      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
    });
  });

  describe('9. Performance and Load Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should handle high-volume alert processing', async () => {
      const alerts = Array.from({ length: 100 }, (_, i) => ({
        type: 'bulk_test',
        priority: 'medium',
        message: `Bulk alert ${i + 1}`,
        farmId: `farm_${i % 10}`
      }));

      const startTime = Date.now();
      const results = await Promise.all(alerts.map(alert => alertsAgent.sendAlert(alert)));
      const duration = Date.now() - startTime;

      const successCount = results.filter(r => r.success).length;
      
      expect(successCount).toBeGreaterThan(90); // At least 90% success rate
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });

    test('should maintain performance under sustained load', async () => {
      const iterations = 10;
      const alertsPerIteration = 20;
      const performanceMetrics = [];

      for (let i = 0; i < iterations; i++) {
        const alerts = Array.from({ length: alertsPerIteration }, (_, j) => ({
          type: 'performance_test',
          priority: 'low',
          message: `Performance test ${i}-${j}`,
          farmId: `farm_${j % 5}`
        }));

        const startTime = Date.now();
        const results = await Promise.all(alerts.map(alert => alertsAgent.sendAlert(alert)));
        const duration = Date.now() - startTime;

        performanceMetrics.push({
          iteration: i,
          duration,
          successCount: results.filter(r => r.success).length
        });
      }

      const avgDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / iterations;
      const avgSuccessCount = performanceMetrics.reduce((sum, m) => sum + m.successCount, 0) / iterations;

      expect(avgDuration).toBeLessThan(2000); // Average under 2 seconds
      expect(avgSuccessCount).toBeGreaterThan(18); // 90% success rate
    });

    test('should manage memory usage efficiently', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process large number of alerts
      for (let i = 0; i < 500; i++) {
        await alertsAgent.sendAlert({
          type: 'memory_test',
          priority: 'low',
          message: `Memory test ${i}`,
          farmId: `farm_${i % 20}`
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });

  describe('10. Integration and Multi-Channel Tests', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should coordinate with other agents for alert triggers', async () => {
      const predictorOutput = {
        burnId: 123,
        maxPM25: 42.5,
        epaExceedance: true,
        affectedAreas: ['farm_456', 'farm_789']
      };

      const result = await alertsAgent.processPredictorAlert(predictorOutput);
      
      expect(result.alertsTriggered).toBeGreaterThan(0);
      expect(result.affectedFarms).toEqual(['farm_456', 'farm_789']);
      expect(result.alertType).toBe('air_quality_alert');
    });

    test('should integrate with optimizer for schedule notifications', async () => {
      const optimizerOutput = {
        optimizedSchedule: [
          { burnId: 1, farmId: 'farm_123', scheduledTime: new Date('2025-08-10T09:00:00Z') },
          { burnId: 2, farmId: 'farm_456', scheduledTime: new Date('2025-08-10T14:00:00Z') }
        ],
        conflicts: [],
        totalScore: 85.2
      };

      const result = await alertsAgent.processOptimizerAlert(optimizerOutput);
      
      expect(result.notificationsSent).toBe(2);
      expect(result.farmsNotified).toEqual(['farm_123', 'farm_456']);
    });

    test('should coordinate with weather agent for weather alerts', async () => {
      const weatherOutput = {
        windSpeed: 25,
        windDirection: 180,
        temperature: 35,
        humidity: 15,
        alertConditions: ['high_wind', 'high_temperature', 'low_humidity']
      };

      const result = await alertsAgent.processWeatherAlert(weatherOutput);
      
      expect(result.alertsGenerated).toBeGreaterThan(0);
      expect(result.alertTypes).toContain('weather_alert');
      expect(result.conditions).toEqual(['high_wind', 'high_temperature', 'low_humidity']);
    });

    test('should handle cross-channel message consistency', async () => {
      const alertData = {
        type: 'consistency_test',
        priority: 'high',
        message: 'Cross-channel test message',
        recipients: ['+1987654321'],
        farmId: 'farm_123'
      };

      const result = await alertsAgent.sendAlert(alertData);
      
      expect(result.channels).toContain('sms');
      expect(result.channels).toContain('socket');
      expect(result.messageConsistency).toBe(true);
      expect(result.channelErrors).toEqual([]);
    });
  });

  describe('11. Status and Health Monitoring', () => {
    beforeEach(() => {
      alertsAgent.initialize(mockIo);
    });

    test('should provide comprehensive agent status', () => {
      const status = alertsAgent.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('config');
      expect(status).toHaveProperty('statistics');
      expect(status).toHaveProperty('lastAlert');
      expect(status).toHaveProperty('twilioConfigured');
      expect(status).toHaveProperty('socketConnected');
    });

    test('should track alert statistics', async () => {
      // Send various types of alerts
      const alerts = [
        { type: 'air_quality_alert', priority: 'high', message: 'Test 1' },
        { type: 'weather_alert', priority: 'medium', message: 'Test 2' },
        { type: 'system_alert', priority: 'low', message: 'Test 3' }
      ];

      for (const alert of alerts) {
        await alertsAgent.sendAlert(alert);
      }

      const status = alertsAgent.getStatus();
      
      expect(status.statistics.totalAlerts).toBeGreaterThan(0);
      expect(status.statistics.alertsByType).toBeDefined();
      expect(status.statistics.alertsByPriority).toBeDefined();
      expect(status.statistics.successRate).toBeGreaterThan(0);
    });

    test('should detect system health issues', () => {
      const healthChecks = [
        { 
          smsRateLimit: { current: 10, limit: 100 },
          queueSize: 5,
          memory: { heapUsed: 100 * 1024 * 1024 },
          expected: 'healthy' 
        },
        { 
          smsRateLimit: { current: 95, limit: 100 },
          queueSize: 50,
          memory: { heapUsed: 800 * 1024 * 1024 },
          expected: 'warning' 
        },
        { 
          smsRateLimit: { current: 100, limit: 100 },
          queueSize: 200,
          memory: { heapUsed: 1500 * 1024 * 1024 },
          expected: 'critical' 
        }
      ];

      healthChecks.forEach(({ smsRateLimit, queueSize, memory, expected }) => {
        const health = alertsAgent.checkHealth({ smsRateLimit, queueSize, memory });
        expect(health.status).toBe(expected);
      });
    });

    test('should provide diagnostic information', () => {
      const diagnostics = alertsAgent.getDiagnostics();
      
      expect(diagnostics).toHaveProperty('alertQueue');
      expect(diagnostics).toHaveProperty('rateLimits');
      expect(diagnostics).toHaveProperty('connectionStatus');
      expect(diagnostics).toHaveProperty('deliveryStats');
      expect(diagnostics.alertQueue).toHaveProperty('pending');
      expect(diagnostics.rateLimits).toHaveProperty('sms');
      expect(diagnostics.connectionStatus).toHaveProperty('twilio');
      expect(diagnostics.connectionStatus).toHaveProperty('socket');
    });
  });

});