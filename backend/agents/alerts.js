const logger = require('../middleware/logger');
const { query } = require('../db/connection');
const { AgentError, ExternalServiceError, ValidationError } = require('../middleware/errorHandler');
const twilio = require('twilio');
const nodeCron = require('node-cron');

/**
 * AGENT 5: ALERT SYSTEM AGENT
 * 
 * Responsibilities:
 * - Manages alert system for farms and stakeholders
 * - Sends SMS notifications via Twilio
 * - Handles Socket.io real-time updates
 * - Maintains alert history and delivery tracking
 * - Schedules automated notifications and reminders
 * - Provides alert analytics and delivery statistics
 */
class AlertsAgent {
  constructor() {
    this.agentName = 'alerts';
    this.version = '1.0.0';
    this.initialized = false;
    
    // Twilio configuration
    this.twilioClient = null;
    this.twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    };
    
    // Alert types and their configurations (matching database enum)
    this.alertTypes = {
      'burn_scheduled': {
        priority: 'medium',
        channels: ['sms', 'socket'],
        template: 'Burn scheduled for {farmName} - {fieldName} on {date} at {time}.',
        advance_notice: 60 // minutes
      },
      'burn_starting': {
        priority: 'high',
        channels: ['sms', 'socket'],
        template: 'Burn starting at {farmName} - {fieldName}. Est. duration: {duration}h. Monitor smoke conditions.',
        advance_notice: 30 // minutes
      },
      'smoke_warning': {
        priority: 'critical',
        channels: ['sms', 'socket'],
        template: 'SMOKE WARNING: High PM2.5 levels detected near {location}. Take precautions if sensitive to air quality.',
        advance_notice: 0
      },
      'weather_alert': {
        priority: 'medium',
        channels: ['socket'],
        template: 'Weather conditions changing for scheduled burn at {farmName}. New conditions: {conditions}',
        advance_notice: 60
      },
      'conflict_detected': {
        priority: 'high',
        channels: ['sms', 'socket'],
        template: 'Burn conflict detected between {farm1} and {farm2}. Coordination required.',
        advance_notice: 0
      },
      'schedule_change': {
        priority: 'medium',
        channels: ['sms', 'socket'],
        template: 'Your burn request has been rescheduled to {newTime}. Reason: {reason}',
        advance_notice: 0
      }
    };
    
    // Delivery tracking
    this.deliveryStats = {
      totalSent: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageDeliveryTime: 0
    };
    
    // Rate limiting for notifications
    this.notificationLimits = {
      perFarm: { max: 10, window: 60 * 60 * 1000 }, // 10 per hour per farm
      global: { max: 100, window: 60 * 60 * 1000 }   // 100 per hour globally
    };
    
    this.notificationCounts = new Map();
  }

  async initialize() {
    try {
      logger.agent(this.agentName, 'info', 'Initializing Alert System Agent');
      
      // Initialize Twilio client if credentials available
      await this.initializeTwilioClient();
      
      // Load delivery history and statistics
      await this.loadDeliveryHistory();
      
      // Initialize scheduled tasks
      await this.initializeScheduledTasks();
      
      // Initialize notification rate limiting
      this.initializeRateLimiting();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Alerts Agent initialized successfully');
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize Alerts Agent', { error: error.message });
      throw new AgentError(this.agentName, 'initialization', error.message, error);
    }
  }

  async initializeTwilioClient() {
    try {
      if (this.twilioConfig.accountSid && this.twilioConfig.authToken) {
        this.twilioClient = twilio(this.twilioConfig.accountSid, this.twilioConfig.authToken);
        
        // Test Twilio connection
        await this.testTwilioConnection();
        
        logger.agent(this.agentName, 'info', 'Twilio client initialized successfully');
      } else {
        logger.agent(this.agentName, 'warn', 'Twilio credentials not configured - SMS disabled');
      }
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Twilio initialization failed', { error: error.message });
      throw new ExternalServiceError('Twilio', `Initialization failed: ${error.message}`);
    }
  }

  async testTwilioConnection() {
    if (!this.twilioClient) return;
    
    try {
      // Verify account details
      const account = await this.twilioClient.api.accounts(this.twilioConfig.accountSid).fetch();
      logger.agent(this.agentName, 'debug', 'Twilio account verified', {
        accountStatus: account.status,
        accountSid: this.twilioConfig.accountSid
      });
    } catch (error) {
      throw new Error(`Twilio account verification failed: ${error.message}`);
    }
  }

  async loadDeliveryHistory() {
    try {
      const deliveryHistory = await query(`
        SELECT 
          alert_type as type,
          delivery_status as status,
          delivery_method as sent_via,
          COUNT(*) as count,
          AVG(TIMESTAMPDIFF(SECOND, created_at, COALESCE(delivered_at, created_at))) as avg_delivery_time
        FROM alerts
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY alert_type, delivery_status, delivery_method
      `);
      
      // Process delivery statistics
      this.deliveryStats = {
        totalSent: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageDeliveryTime: 0,
        byType: {}
      };
      
      deliveryHistory.forEach(row => {
        this.deliveryStats.totalSent += row.count;
        
        if (row.status === 'sent') {
          this.deliveryStats.successfulDeliveries += row.count;
        } else if (row.status === 'failed') {
          this.deliveryStats.failedDeliveries += row.count;
        }
        
        if (!this.deliveryStats.byType[row.type]) {
          this.deliveryStats.byType[row.type] = { total: 0, successful: 0, failed: 0 };
        }
        
        this.deliveryStats.byType[row.type].total += row.count;
        if (row.status === 'sent') {
          this.deliveryStats.byType[row.type].successful += row.count;
        } else if (row.status === 'failed') {
          this.deliveryStats.byType[row.type].failed += row.count;
        }
      });
      
      logger.agent(this.agentName, 'debug', 'Delivery history loaded', {
        totalAlerts: this.deliveryStats.totalSent,
        successRate: this.deliveryStats.totalSent > 0 ? 
          this.deliveryStats.successfulDeliveries / this.deliveryStats.totalSent : 0
      });
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Could not load delivery history', { error: error.message });
    }
  }

  async initializeScheduledTasks() {
    // Schedule automated tasks for alert management
    
    // Daily cleanup of old alerts (run at 2 AM)
    nodeCron.schedule('0 2 * * *', async () => {
      await this.cleanupOldAlerts();
    });
    
    // Hourly delivery statistics update
    nodeCron.schedule('0 * * * *', async () => {
      await this.updateDeliveryStatistics();
    });
    
    // Check for pending alerts every 5 minutes
    nodeCron.schedule('*/5 * * * *', async () => {
      await this.processPendingAlerts();
    });
    
    logger.agent(this.agentName, 'debug', 'Scheduled tasks initialized');
  }

  initializeRateLimiting() {
    // Clean up rate limiting counters every hour
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.notificationCounts.entries()) {
        if (now - data.windowStart > this.notificationLimits.global.window) {
          this.notificationCounts.delete(key);
        }
      }
    }, 60 * 60 * 1000);
    
    logger.agent(this.agentName, 'debug', 'Rate limiting initialized');
  }

  /**
   * Main alert processing method
   */
  async processAlert(alertData, scheduleData = null, io = null) {
    if (!this.initialized) {
      throw new AgentError(this.agentName, 'alert_processing', 'Agent not initialized');
    }

    const startTime = Date.now();
    const alertId = require('crypto').randomBytes(8).toString('hex');
    
    try {
      logger.agent(this.agentName, 'info', 'Processing alert', {
        alertId,
        type: alertData.type,
        severity: alertData.severity
      });
      
      // Step 1: Validate alert data
      const validatedAlert = await this.validateAlertData(alertData);
      
      // Step 2: Check rate limiting
      if (!this.checkRateLimit(validatedAlert)) {
        throw new AgentError(this.agentName, 'rate_limiting', 'Alert rate limit exceeded');
      }
      
      // Step 3: Generate alert message
      const alertMessage = this.generateAlertMessage(validatedAlert);
      
      // Step 4: Determine recipients
      const recipients = await this.determineRecipients(validatedAlert);
      
      // Step 5: Store alert in database
      const dbAlertId = await this.storeAlert(validatedAlert, alertMessage, recipients);
      
      // Step 6: Send notifications via configured channels
      const deliveryResults = await this.sendNotifications(
        validatedAlert,
        alertMessage,
        recipients,
        dbAlertId,
        io
      );
      
      // Step 7: Update delivery statistics
      this.updateDeliveryStats(deliveryResults);
      
      // Step 8: Process any follow-up actions
      await this.processFollowUpActions(validatedAlert, scheduleData);
      
      const duration = Date.now() - startTime;
      logger.performance('alert_processing', duration, {
        alertId,
        dbAlertId,
        type: validatedAlert.type,
        recipientsCount: recipients.length,
        deliveryChannels: deliveryResults.channels
      });
      
      return {
        success: true,
        alertId: dbAlertId,
        type: validatedAlert.type,
        severity: validatedAlert.severity,
        recipients: recipients.length,
        deliveryResults,
        processingTime: duration,
        message: alertMessage.content
      };
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Alert processing failed', {
        alertId,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async validateAlertData(alertData) {
    const requiredFields = ['type', 'message'];
    
    for (const field of requiredFields) {
      if (!alertData[field]) {
        throw new ValidationError(`Missing required field: ${field}`, field);
      }
    }
    
    if (!this.alertTypes[alertData.type]) {
      throw new ValidationError(`Invalid alert type: ${alertData.type}`, 'type');
    }
    
    return {
      type: alertData.type,
      farm_id: alertData.farm_id || null,
      burn_request_id: alertData.burn_request_id || null,
      title: alertData.title || 'Alert Notification',
      message: alertData.message,
      severity: alertData.severity || this.alertTypes[alertData.type].priority,
      data: alertData.data || {},
      channels: alertData.channels || this.alertTypes[alertData.type].channels
    };
  }

  checkRateLimit(alertData) {
    const now = Date.now();
    const globalKey = 'global';
    const farmKey = `farm_${alertData.farm_id}`;
    
    // Check global rate limit
    let globalCount = this.notificationCounts.get(globalKey);
    if (!globalCount || now - globalCount.windowStart > this.notificationLimits.global.window) {
      globalCount = { count: 0, windowStart: now };
    }
    
    if (globalCount.count >= this.notificationLimits.global.max) {
      logger.security('Global notification rate limit exceeded', { globalCount });
      return false;
    }
    
    // Check per-farm rate limit
    if (alertData.farm_id) {
      let farmCount = this.notificationCounts.get(farmKey);
      if (!farmCount || now - farmCount.windowStart > this.notificationLimits.perFarm.window) {
        farmCount = { count: 0, windowStart: now };
      }
      
      if (farmCount.count >= this.notificationLimits.perFarm.max) {
        logger.security('Farm notification rate limit exceeded', { farmId: alertData.farm_id, farmCount });
        return false;
      }
      
      // Update farm counter
      farmCount.count++;
      this.notificationCounts.set(farmKey, farmCount);
    }
    
    // Update global counter
    globalCount.count++;
    this.notificationCounts.set(globalKey, globalCount);
    
    return true;
  }

  generateAlertMessage(alertData) {
    const template = this.alertTypes[alertData.type].template;
    let content = template;
    
    // Replace placeholders with actual data
    if (alertData.data) {
      Object.keys(alertData.data).forEach(key => {
        const placeholder = `{${key}}`;
        if (content.includes(placeholder)) {
          content = content.replace(new RegExp(placeholder, 'g'), alertData.data[key]);
        }
      });
    }
    
    // Add timestamp and alert ID
    const timestamp = new Date().toLocaleString();
    
    return {
      content,
      subject: alertData.title || 'Alert Notification',
      timestamp,
      type: alertData.type,
      severity: alertData.severity,
      formatted: {
        sms: this.formatForSMS(content, alertData),
        email: this.formatForEmail(alertData.title || 'Alert Notification', content, alertData),
        socket: this.formatForSocket(alertData, content)
      }
    };
  }

  formatForSMS(content, alertData) {
    // SMS format: concise, under 160 characters
    let smsText = `[BURNWISE] ${content}`;
    
    if (smsText.length > 160) {
      smsText = smsText.substring(0, 157) + '...';
    }
    
    return smsText;
  }

  formatForEmail(subject, content, alertData) {
    return {
      subject: `[BURNWISE] ${subject}`,
      body: `
        <h2>BURNWISE Agricultural Burn Alert</h2>
        <p><strong>Alert Type:</strong> ${alertData.type.replace('_', ' ').toUpperCase()}</p>
        <p><strong>Severity:</strong> ${alertData.severity.toUpperCase()}</p>
        <p><strong>Message:</strong></p>
        <p>${content}</p>
        <hr>
        <p><small>This is an automated alert from the BURNWISE Agricultural Burn Coordination System.</small></p>
      `,
      text: content
    };
  }

  formatForSocket(alertData, content) {
    return {
      id: require('crypto').randomBytes(8).toString('hex'),
      type: alertData.type,
      severity: alertData.severity,
      title: alertData.title || 'Alert Notification',
      message: content,
      farm_id: alertData.farm_id,
      burn_request_id: alertData.burn_request_id,
      timestamp: new Date().toISOString(),
      data: alertData.data
    };
  }

  async determineRecipients(alertData) {
    const recipients = [];
    
    try {
      // Get farm-specific recipients
      if (alertData.farm_id) {
        const farmContacts = await query(`
          SELECT contact_phone as phone, contact_email as email, farm_name as name, owner_name
          FROM farms
          WHERE farm_id = ?
        `, [alertData.farm_id]);
        
        if (farmContacts.length > 0) {
          const farm = farmContacts[0];
          recipients.push({
            type: 'farm_owner',
            farm_id: alertData.farm_id,
            name: farm.owner_name,
            phone: farm.phone,
            email: farm.email,
            channels: alertData.channels
          });
        }
      }
      
      // For certain alert types, add nearby farms
      if (['smoke_warning', 'conflict_detected'].includes(alertData.type) && alertData.farm_id) {
        const nearbyFarms = await this.getNearbyFarms(alertData.farm_id, 5000); // 5km radius
        
        nearbyFarms.forEach(farm => {
          recipients.push({
            type: 'nearby_farm',
            farm_id: farm.id,
            name: farm.owner_name,
            phone: farm.phone,
            email: farm.email,
            channels: ['socket'], // Less intrusive for nearby farms
            distance: farm.distance
          });
        });
      }
      
      // Add system administrators for critical alerts
      if (alertData.severity === 'critical') {
        recipients.push({
          type: 'system_admin',
          name: 'BURNWISE Admin',
          phone: process.env.ADMIN_PHONE,
          email: process.env.ADMIN_EMAIL,
          channels: ['sms', 'email']
        });
      }
      
      logger.agent(this.agentName, 'debug', `Determined ${recipients.length} recipients for alert`);
      return recipients;
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Recipient determination failed', { error: error.message });
      return [];
    }
  }

  async getNearbyFarms(farmId, radiusMeters) {
    try {
      const nearbyFarms = await query(`
        SELECT 
          f2.id,
          f2.name,
          f2.owner_name,
          f2.phone,
          f2.email,
          ST_Distance_Sphere(f1.location, f2.location) as distance
        FROM farms f1
        CROSS JOIN farms f2
        WHERE f1.farm_id = ?
        AND f2.farm_id != f1.farm_id
        AND ST_Distance_Sphere(f1.location, f2.location) <= ?
        ORDER BY distance ASC
        LIMIT 10
      `, [farmId, radiusMeters]);
      
      return nearbyFarms;
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Nearby farms query failed', { error: error.message });
      return [];
    }
  }

  async sendNotifications(alertData, alertMessage, recipients, dbAlertId, io) {
    const deliveryResults = {
      channels: [],
      successful: [],
      failed: [],
      summary: {}
    };
    
    // Send SMS notifications
    if (alertData.channels.includes('sms') && this.twilioClient) {
      const smsResults = await this.sendSMSNotifications(
        alertMessage.formatted.sms,
        recipients.filter(r => r.phone && r.channels.includes('sms')),
        dbAlertId
      );
      
      deliveryResults.channels.push('sms');
      deliveryResults.successful.push(...smsResults.successful);
      deliveryResults.failed.push(...smsResults.failed);
      deliveryResults.summary.sms = smsResults.summary;
    }
    
    // Send Socket.io notifications
    if (alertData.channels.includes('socket') && io) {
      const socketResults = await this.sendSocketNotifications(
        alertMessage.formatted.socket,
        recipients,
        io
      );
      
      deliveryResults.channels.push('socket');
      deliveryResults.successful.push(...socketResults.successful);
      deliveryResults.summary.socket = socketResults.summary;
    }
    
    // Send email notifications (if configured)
    if (alertData.channels.includes('email') && process.env.EMAIL_ENABLED === 'true') {
      const emailResults = await this.sendEmailNotifications(
        alertMessage.formatted.email,
        recipients.filter(r => r.email && r.channels.includes('email')),
        dbAlertId
      );
      
      deliveryResults.channels.push('email');
      deliveryResults.successful.push(...emailResults.successful);
      deliveryResults.failed.push(...emailResults.failed);
      deliveryResults.summary.email = emailResults.summary;
    }
    
    return deliveryResults;
  }

  async sendSMSNotifications(message, recipients, alertId) {
    const results = {
      successful: [],
      failed: [],
      summary: { sent: 0, failed: 0 }
    };
    
    if (!this.twilioClient) {
      logger.agent(this.agentName, 'warn', 'SMS sending skipped - Twilio not configured');
      return results;
    }
    
    for (const recipient of recipients) {
      try {
        if (!recipient.phone) continue;
        
        const smsResult = await this.twilioClient.messages.create({
          body: message,
          from: this.twilioConfig.phoneNumber,
          to: recipient.phone
        });
        
        results.successful.push({
          recipient: recipient.name,
          phone: recipient.phone,
          messageSid: smsResult.sid,
          status: smsResult.status
        });
        
        results.summary.sent++;
        
        // Update alert delivery status
        await this.updateAlertDeliveryStatus(alertId, 'sms', recipient.phone, 'sent', smsResult.sid);
        
        logger.agent(this.agentName, 'debug', 'SMS sent successfully', {
          recipient: recipient.name,
          messageSid: smsResult.sid
        });
        
      } catch (error) {
        results.failed.push({
          recipient: recipient.name,
          phone: recipient.phone,
          error: error.message
        });
        
        results.summary.failed++;
        
        // Update alert delivery status
        await this.updateAlertDeliveryStatus(alertId, 'sms', recipient.phone, 'failed', null, error.message);
        
        logger.agent(this.agentName, 'error', 'SMS sending failed', {
          recipient: recipient.name,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async sendSocketNotifications(socketMessage, recipients, io) {
    const results = {
      successful: [],
      summary: { sent: 0 }
    };
    
    if (!io) {
      logger.agent(this.agentName, 'warn', 'Socket notification skipped - Socket.io not available');
      return results;
    }
    
    try {
      // Send to specific farm rooms
      const farmIds = [...new Set(recipients.map(r => r.farm_id).filter(id => id))];
      
      farmIds.forEach(farmId => {
        io.to(`farm-${farmId}`).emit('burn_alert', socketMessage);
        results.successful.push({
          type: 'farm_room',
          farm_id: farmId,
          message: 'sent'
        });
        results.summary.sent++;
      });
      
      // Send to global dashboard if critical
      if (socketMessage.severity === 'critical') {
        io.emit('global_alert', socketMessage);
        results.successful.push({
          type: 'global_broadcast',
          message: 'sent'
        });
        results.summary.sent++;
      }
      
      logger.agent(this.agentName, 'debug', 'Socket notifications sent', {
        farmRooms: farmIds.length,
        globalBroadcast: socketMessage.severity === 'critical'
      });
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Socket notification failed', { error: error.message });
    }
    
    return results;
  }

  async sendEmailNotifications(emailData, recipients, alertId) {
    // Email functionality would be implemented here
    // For now, just log that email would be sent
    
    const results = {
      successful: [],
      failed: [],
      summary: { sent: 0, failed: 0 }
    };
    
    recipients.forEach(recipient => {
      if (recipient.email) {
        // Simulate email sending
        results.successful.push({
          recipient: recipient.name,
          email: recipient.email,
          status: 'simulated'
        });
        results.summary.sent++;
        
        logger.agent(this.agentName, 'debug', 'Email notification simulated', {
          recipient: recipient.name,
          email: recipient.email
        });
      }
    });
    
    return results;
  }

  async storeAlert(alertData, alertMessage, recipients) {
    try {
      // Determine primary delivery method (first available)
      const primaryMethod = alertData.channels.includes('sms') ? 'sms' : 
                           alertData.channels.includes('email') ? 'email' :
                           alertData.channels.includes('push') ? 'push' : 'in_app';
      
      // Get first recipient contact
      const primaryRecipient = recipients.length > 0 ? 
        (recipients[0].phone || recipients[0].email || null) : null;
      
      const result = await query(`
        INSERT INTO alerts (
          alert_type, farm_id, burn_request_id, message,
          severity, status, delivery_method, recipient_contact, 
          delivery_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        alertData.type,
        alertData.farm_id,
        alertData.burn_request_id,
        `${alertData.title || 'Alert'}: ${alertMessage.content}`,
        alertData.severity || 'info',
        'pending',  // For 'status' column
        primaryMethod,  // Single enum value for delivery_method
        primaryRecipient,
        'pending'  // For 'delivery_status' column
      ]);
      
      return result.insertId;
      
    } catch (error) {
      throw new AgentError(this.agentName, 'storage', `Failed to store alert: ${error.message}`, error);
    }
  }

  async updateAlertDeliveryStatus(alertId, channel, recipient, status, externalId = null, errorMessage = null) {
    try {
      // Map status to appropriate delivery_status value
      const deliveryStatus = status === 'sent' ? 'sent' : 
                           status === 'delivered' ? 'delivered' :
                           status === 'failed' ? 'failed' : 'pending';
      
      await query(`
        UPDATE alerts 
        SET 
          delivery_status = ?,
          delivered_at = CASE WHEN ? = 'delivered' THEN NOW() ELSE delivered_at END,
          delivery_attempts = delivery_attempts + 1
        WHERE alert_id = ?
      `, [deliveryStatus, deliveryStatus, alertId]);
      
      // Could also store detailed delivery tracking in a separate table
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Alert status update failed', { error: error.message });
    }
  }

  updateDeliveryStats(deliveryResults) {
    this.deliveryStats.totalSent += deliveryResults.successful.length;
    this.deliveryStats.successfulDeliveries += deliveryResults.successful.length;
    this.deliveryStats.failedDeliveries += deliveryResults.failed.length;
  }

  async processFollowUpActions(alertData, scheduleData) {
    // Process any follow-up actions based on alert type
    
    switch (alertData.type) {
      case 'conflict_detected':
        // Schedule automated re-optimization
        if (scheduleData) {
          await this.scheduleReOptimization(scheduleData.date);
        }
        break;
        
      case 'weather_change':
        // Trigger weather re-analysis for affected burns
        if (alertData.burn_request_id) {
          await this.triggerWeatherReAnalysis(alertData.burn_request_id);
        }
        break;
        
      case 'smoke_warning':
        // Escalate to authorities if PM2.5 levels are dangerous
        if (alertData.data && alertData.data.pm25Level > 100) {
          await this.escalateToAuthorities(alertData);
        }
        break;
    }
  }

  async scheduleReOptimization(date) {
    // Schedule re-optimization for conflicts
    logger.agent(this.agentName, 'info', 'Scheduling re-optimization due to conflicts', { date });
    
    // This would trigger the optimizer agent again
    // Implementation would depend on job queue system
  }

  async triggerWeatherReAnalysis(burnRequestId) {
    // Trigger weather agent re-analysis
    logger.agent(this.agentName, 'info', 'Triggering weather re-analysis', { burnRequestId });
    
    // This would trigger the weather agent again
    // Implementation would depend on job queue system
  }

  async escalateToAuthorities(alertData) {
    // Escalate severe air quality issues to authorities
    logger.agent(this.agentName, 'warn', 'Escalating air quality alert to authorities', {
      pm25Level: alertData.data.pm25Level,
      location: alertData.data.location
    });
    
    // Implementation would send alerts to EPA, local authorities, etc.
  }

  async cleanupOldAlerts() {
    try {
      const result = await query(`
        DELETE FROM alerts
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND (delivery_status IN ('sent', 'delivered') OR status IN ('completed', 'cancelled'))
      `);
      
      logger.agent(this.agentName, 'info', `Cleaned up ${result.affectedRows} old alerts`);
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Alert cleanup failed', { error: error.message });
    }
  }

  async updateDeliveryStatistics() {
    try {
      const stats = await query(`
        SELECT 
          alert_type as type,
          delivery_status as status,
          COUNT(*) as count
        FROM alerts
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        GROUP BY alert_type, delivery_status
      `);
      
      // Update hourly statistics
      stats.forEach(stat => {
        if (!this.deliveryStats.byType[stat.type]) {
          this.deliveryStats.byType[stat.type] = { total: 0, successful: 0, failed: 0 };
        }
        
        if (stat.status === 'sent') {
          this.deliveryStats.byType[stat.type].successful += stat.count;
        } else if (stat.status === 'failed') {
          this.deliveryStats.byType[stat.type].failed += stat.count;
        }
        
        this.deliveryStats.byType[stat.type].total += stat.count;
      });
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Statistics update failed', { error: error.message });
    }
  }

  async processPendingAlerts() {
    try {
      const pendingAlerts = await query(`
        SELECT alert_id as id, alert_type as type, farm_id, message, severity, created_at
        FROM alerts
        WHERE status = 'pending'
        AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        LIMIT 50
      `);
      
      for (const alert of pendingAlerts) {
        try {
          // Retry failed alerts
          await this.retryAlert(alert);
        } catch (retryError) {
          logger.agent(this.agentName, 'error', 'Alert retry failed', {
            alertId: alert.id,
            error: retryError.message
          });
        }
      }
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Pending alerts processing failed', { error: error.message });
    }
  }

  async retryAlert(alert) {
    // Retry logic for failed alerts
    logger.agent(this.agentName, 'debug', 'Retrying failed alert', { alertId: alert.id });
    
    // Mark as failed if too old (over 1 hour)
    if (Date.now() - new Date(alert.created_at).getTime() > 60 * 60 * 1000) {
      // Use 'cancelled' for status and 'failed' for delivery_status
      await query('UPDATE alerts SET status = ?, delivery_status = ? WHERE alert_id = ?', ['cancelled', 'failed', alert.id]);
    }
  }

  // Utility methods
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
  }

  async getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    try {
      const alertStats = await query(`
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN delivery_status = 'sent' THEN 1 END) as sent_alerts,
          COUNT(CASE WHEN delivery_status = 'pending' THEN 1 END) as pending_alerts,
          COUNT(CASE WHEN delivery_status = 'failed' THEN 1 END) as failed_alerts
        FROM alerts
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);
      
      return {
        status: 'active',
        agent: this.agentName,
        version: this.version,
        initialized: this.initialized,
        twilioConfigured: !!this.twilioClient,
        alertTypes: Object.keys(this.alertTypes),
        deliveryStats: this.deliveryStats,
        rateLimits: this.notificationLimits,
        last24Hours: alertStats[0]
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new AlertsAgent();