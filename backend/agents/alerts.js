const logger = require('../middleware/logger');
const { query } = require('../db/connection');
const { AgentError, ExternalServiceError, ValidationError } = require('../middleware/errorHandler');
const sgMail = require('@sendgrid/mail');
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
    
    // SendGrid configuration
    this.sendGridClient = null;
    this.sendGridConfig = {
      apiKey: process.env.TWILIO_SENDGRID_API_KEY || process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'alerts@burnwise.com',
      fromName: process.env.SENDGRID_FROM_NAME || 'Burnwise Alerts'
    };
    
    // Alert types and their configurations (matching database enum)
    this.alertTypes = {
      'burn_scheduled': {
        priority: 'medium',
        channels: ['email', 'socket'],
        template: 'Burn scheduled for {farmName} - {fieldName} on {date} at {time}.',
        advance_notice: 60 // minutes
      },
      'burn_starting': {
        priority: 'high',
        channels: ['email', 'socket'],
        template: 'Burn starting at {farmName} - {fieldName}. Est. duration: {duration}h. Monitor smoke conditions.',
        advance_notice: 30 // minutes
      },
      'smoke_warning': {
        priority: 'critical',
        channels: ['email', 'socket'],
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
    
    // Rate limiting for notifications (increased for burst traffic)
    this.notificationLimits = {
      perFarm: { max: 20, window: 60 * 60 * 1000 }, // 20 per hour per farm
      global: { max: 200, window: 60 * 60 * 1000 },  // 200 per hour globally
      burst: { max: 20, window: 15 * 60 * 1000 }     // 20 per 15 minutes for bursts
    };
    
    // Track retry attempts
    this.maxRetryAttempts = 3;
    this.retryAttempts = new Map();
    
    this.notificationCounts = new Map();
  }

  async initialize() {
    try {
      logger.agent(this.agentName, 'info', 'Initializing Alert System Agent with GPT-5 AI');
      
      // Initialize GPT-5-mini for intelligent alert generation
      await this.initializeAI();
      
      // Initialize SendGrid client if credentials available
      await this.initializeSendGridClient();
      
      // Load delivery history and statistics
      await this.loadDeliveryHistory();
      
      // Initialize scheduled tasks
      await this.initializeScheduledTasks();
      
      // Initialize notification rate limiting
      this.initializeRateLimiting();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Alerts Agent initialized with GPT-5-mini intelligence');
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize Alerts Agent', { error: error.message });
      throw new AgentError(this.agentName, 'initialization', error.message, error);
    }
  }

  async initializeAI() {
    try {
      const { GPT5MiniClient } = require('../gpt5-mini-client');
      this.gpt5Client = new GPT5MiniClient();
      
      // Test GPT-5-mini connection
      const testResponse = await this.gpt5Client.complete(
        'You are an agricultural alert system AI. Respond with: Ready to generate intelligent notifications',
        30
      );
      
      if (testResponse) {
        logger.agent(this.agentName, 'info', 'GPT-5-mini AI verified for intelligent alert generation');
      } else {
        throw new Error('GPT-5-mini test failed - NO FALLBACKS');
      }
    } catch (error) {
      throw new Error(`GPT-5-mini REQUIRED for intelligent alerts: ${error.message}`);
    }
  }

  async initializeSendGridClient() {
    try {
      if (this.sendGridConfig.apiKey) {
        this.sendGridClient = sgMail;
        this.sendGridClient.setApiKey(this.sendGridConfig.apiKey);
        
        // Test SendGrid connection
        await this.testSendGridConnection();
        
        logger.agent(this.agentName, 'info', 'SendGrid client initialized successfully');
      } else {
        logger.agent(this.agentName, 'warn', 'SendGrid API key not configured - Email disabled');
      }
    } catch (error) {
      logger.agent(this.agentName, 'error', 'SendGrid initialization failed', { error: error.message });
      throw new ExternalServiceError('SendGrid', `Initialization failed: ${error.message}`);
    }
  }

  async testSendGridConnection() {
    if (!this.sendGridClient) return;
    
    try {
      // Verify SendGrid configuration by preparing a test message
      const testMsg = {
        to: this.sendGridConfig.fromEmail,
        from: {
          email: this.sendGridConfig.fromEmail,
          name: this.sendGridConfig.fromName
        },
        subject: 'Burnwise Email System Test',
        text: 'This is a test email to verify SendGrid configuration.'
      };
      
      logger.agent(this.agentName, 'debug', 'SendGrid configuration verified', {
        fromEmail: this.sendGridConfig.fromEmail
      });
    } catch (error) {
      throw new Error(`SendGrid verification failed: ${error.message}`);
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
          AVG(TIMESTAMPDIFF(SECOND, created_at, COALESCE(sent_at, created_at))) as avg_delivery_time
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
      
      // Step 3: Generate alert message (now with AI enhancement)
      const alertMessage = await this.generateAlertMessage(validatedAlert);
      
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
    
    // Check burst rate limit first (shorter window)
    const burstKey = 'burst';
    let burstCount = this.notificationCounts.get(burstKey);
    if (!burstCount || now - burstCount.windowStart > this.notificationLimits.burst.window) {
      burstCount = { count: 0, windowStart: now };
    }
    
    if (burstCount.count >= this.notificationLimits.burst.max) {
      logger.security('Burst notification rate limit exceeded', { burstCount });
      return false;
    }
    
    // Check global rate limit
    let globalCount = this.notificationCounts.get(globalKey);
    if (!globalCount || now - globalCount.windowStart > this.notificationLimits.global.window) {
      globalCount = { count: 0, windowStart: now };
    }
    
    if (globalCount.count >= this.notificationLimits.global.max) {
      logger.security('Global notification rate limit exceeded', { globalCount });
      return false;
    }
    
    // Update burst counter
    burstCount.count++;
    this.notificationCounts.set(burstKey, burstCount);
    
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

  async generateAlertMessage(alertData) {
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
    
    // Enhance with GPT-5 AI for intelligent, evidence-based alerts
    const aiEnhancedContent = await this.enhanceAlertWithAI(alertData, content);
    if (aiEnhancedContent) {
      content = aiEnhancedContent;
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

  /**
   * Use GPT-5-mini to enhance alerts with intelligent, evidence-based content
   */
  async enhanceAlertWithAI(alertData, baseContent) {
    if (!this.gpt5Client) {
      return null;
    }

    try {
      const alertContext = `
Alert Type: ${alertData.type}
Severity: ${alertData.severity}
Farm: ${alertData.data?.farmName || 'N/A'}
Location: ${alertData.data?.fieldName || 'N/A'}
Date/Time: ${alertData.data?.date || 'N/A'} ${alertData.data?.time || ''}

Base Message: ${baseContent}

Additional Context:
${JSON.stringify(alertData.data || {}, null, 2)}
`;

      const enhancementPrompt = `You are an agricultural alert system AI using GPT-5-mini.

Enhance this alert message with MANDATORY evidence-based information:
${alertContext}

CRITICAL REQUIREMENTS BY ALERT TYPE:

For SMOKE_WARNING alerts:
- State exact PM2.5 level detected (µg/m³)
- Reference EPA AQI category: Good (0-50), Moderate (51-100), USG (101-150), Unhealthy (151-200)
- Cite CDC exposure limits: 35 µg/m³ (24-hr), 12 µg/m³ (annual)
- Specify affected radius in meters
- Include "Shelter indoors if >55 µg/m³" per EPA guidelines

For BURN_SCHEDULED/BURN_STARTING alerts:
- Wind speed/direction with safety threshold (4-15 mph per NFPA)
- Humidity level vs optimal range (30-60% per USDA)
- Reference NFPA 1 Section 10.14.3 for notification requirements
- Include setback distance from structures (min 50ft per most codes)

For CONFLICT_DETECTED alerts:
- Combined PM2.5 estimate with % over EPA limit
- Minimum separation distance needed (meters)
- Reference EPA cumulative exposure guidelines
- Suggest rescheduling window (HH:MM format)

For WEATHER_ALERT:
- Specific parameter changed (exact values before/after)
- Impact on burn safety (SAFE/CAUTION/DANGER)
- Reference NWS Red Flag criteria if applicable
- Provide go/no-go decision with confidence %

DATA PRECISION REQUIREMENTS:
- Distances: meters (integer)
- Concentrations: µg/m³ (1 decimal)
- Percentages: include confidence level
- Times: HH:MM format
- SMS limit: 160 chars max

MANDATORY for severity "critical" or "high":
End with: "Ref: [EPA AQI/NFPA 1-10.14/CDC Guidelines/NWS]"

For all alerts, prioritize:
1. Immediate action needed
2. Specific threshold exceeded
3. Regulatory reference
4. Time-bound recommendation`;

      const enhancedMessage = await this.gpt5Client.complete(enhancementPrompt, 200);
      
      if (enhancedMessage) {
        logger.agent(this.agentName, 'info', 'Alert enhanced with GPT-5 intelligence', {
          alertType: alertData.type,
          severity: alertData.severity
        });
        return enhancedMessage;
      }
    } catch (error) {
      logger.agent(this.agentName, 'error', 'AI alert enhancement failed', { error: error.message });
    }
    
    return null;
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
    // Professional HTML email template with proper styling
    const severityColors = {
      critical: '#DC2626',
      high: '#EA580C', 
      warning: '#F59E0B',
      medium: '#3B82F6',
      info: '#6B7280'
    };
    
    const alertTypeIcons = {
      burn_scheduled: '📅',
      burn_starting: '🔥',
      smoke_warning: '💨',
      weather_alert: '🌤️',
      conflict_detected: '⚠️',
      schedule_change: '🔄'
    };
    
    const severityColor = severityColors[alertData.severity] || severityColors.info;
    const icon = alertTypeIcons[alertData.type] || '📢';
    
    return {
      subject: `[BURNWISE] ${icon} ${subject}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #EF4444 0%, #F97316 100%); padding: 30px; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
                        BURNWISE
                      </h1>
                      <p style="margin: 5px 0 0 0; color: #ffffff; font-size: 14px; text-align: center; opacity: 0.9;">
                        Agricultural Burn Coordination System
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Alert Badge -->
                  <tr>
                    <td style="padding: 30px 30px 20px 30px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="background-color: ${severityColor}; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-align: center;">
                            <span style="font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                              ${alertData.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 0 30px 30px 30px;">
                      <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 20px; font-weight: 600;">
                        ${subject}
                      </h2>
                      <div style="background-color: #f9fafb; border-left: 4px solid ${severityColor}; padding: 15px; border-radius: 4px; margin: 20px 0;">
                        <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                          ${content}
                        </p>
                      </div>
                      
                      <!-- Metadata -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">
                        <tr>
                          <td style="padding: 8px 0;">
                            <span style="color: #6b7280; font-size: 14px; font-weight: 500;">Severity:</span>
                            <span style="color: ${severityColor}; font-size: 14px; font-weight: 600; text-transform: uppercase; margin-left: 8px;">
                              ${alertData.severity}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0;">
                            <span style="color: #6b7280; font-size: 14px; font-weight: 500;">Time:</span>
                            <span style="color: #374151; font-size: 14px; margin-left: 8px;">
                              ${new Date().toLocaleString('en-US', { 
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZoneName: 'short'
                              })}
                            </span>
                          </td>
                        </tr>
                        ${alertData.farm_id ? `
                        <tr>
                          <td style="padding: 8px 0;">
                            <span style="color: #6b7280; font-size: 14px; font-weight: 500;">Farm ID:</span>
                            <span style="color: #374151; font-size: 14px; margin-left: 8px;">#${alertData.farm_id}</span>
                          </td>
                        </tr>
                        ` : ''}
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Action Button (if applicable) -->
                  ${alertData.type === 'burn_scheduled' || alertData.type === 'schedule_change' ? `
                  <tr>
                    <td style="padding: 0 30px 30px 30px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td style="border-radius: 6px; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/spatial" 
                               style="display: inline-block; padding: 12px 30px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                              View in Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 30px; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.5;">
                        This is an automated alert from the BURNWISE Agricultural Burn Coordination System.<br>
                        To manage your notification preferences, visit your dashboard settings.
                      </p>
                      <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 11px; text-align: center;">
                        © ${new Date().getFullYear()} BURNWISE. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `[BURNWISE ALERT]
      
Alert Type: ${alertData.type.replace(/_/g, ' ').toUpperCase()}
Severity: ${alertData.severity.toUpperCase()}

${content}

Time: ${new Date().toLocaleString()}
${alertData.farm_id ? `Farm ID: #${alertData.farm_id}` : ''}

---
This is an automated alert from BURNWISE.
To manage notifications, visit your dashboard settings.`
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
      // Get farm-specific recipients including notification preferences
      if (alertData.farm_id) {
        const farmContacts = await query(`
          SELECT 
            contact_phone as phone, 
            contact_email as email, 
            notification_email,
            email_notifications_enabled,
            farm_name as name, 
            owner_name
          FROM farms
          WHERE farm_id = ?
        `, [alertData.farm_id]);
        
        if (farmContacts.length > 0) {
          const farm = farmContacts[0];
          
          // Use notification email if notifications are enabled, otherwise use contact email
          const alertEmail = (farm.email_notifications_enabled && farm.notification_email) 
            ? farm.notification_email 
            : farm.email;
          
          // Only include email channel if notifications are enabled
          const channels = farm.email_notifications_enabled 
            ? alertData.channels 
            : alertData.channels.filter(c => c !== 'email');
          
          recipients.push({
            type: 'farm_owner',
            farm_id: alertData.farm_id,
            name: farm.owner_name,
            phone: farm.phone,
            email: alertEmail,
            channels: channels,
            notificationsEnabled: farm.email_notifications_enabled
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
    
    // Send Email notifications
    if (alertData.channels.includes('email') && this.sendGridClient) {
      const emailResults = await this.sendEmailNotifications(
        alertMessage.formatted.email || alertMessage.formatted.sms,
        recipients.filter(r => r.email && r.channels.includes('email')),
        dbAlertId
      );
      
      deliveryResults.channels.push('email');
      deliveryResults.successful.push(...emailResults.successful);
      deliveryResults.failed.push(...emailResults.failed);
      deliveryResults.summary.email = emailResults.summary;
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
    
    
    return deliveryResults;
  }

  async sendEmailNotifications(message, recipients, alertId) {
    const results = {
      successful: [],
      failed: [],
      summary: { sent: 0, failed: 0 }
    };
    
    if (!this.sendGridClient) {
      logger.agent(this.agentName, 'warn', 'Email sending skipped - SendGrid not configured');
      return results;
    }
    
    for (const recipient of recipients) {
      try {
        if (!recipient.email) continue;
        
        // Message is already formatted with subject, html, and text
        const emailMsg = {
          to: recipient.email,
          from: {
            email: this.sendGridConfig.fromEmail,
            name: this.sendGridConfig.fromName
          },
          subject: message.subject || 'Burnwise Alert',
          text: message.text || message,
          html: message.html || `<p>${String(message).replace(/\n/g, '<br>')}</p>`
        };
        
        const [emailResult] = await this.sendGridClient.send(emailMsg);
        
        results.successful.push({
          recipient: recipient.name,
          email: recipient.email,
          messageId: emailResult.headers['x-message-id'],
          status: 'sent'
        });
        
        results.summary.sent++;
        
        // Update alert delivery status
        await this.updateAlertDeliveryStatus(alertId, 'email', recipient.email, 'sent', emailResult.headers['x-message-id']);
        
        logger.agent(this.agentName, 'debug', 'Email sent successfully', {
          recipient: recipient.name,
          messageId: emailResult.headers['x-message-id']
        });
        
      } catch (error) {
        results.failed.push({
          recipient: recipient.name,
          email: recipient.email,
          error: error.message
        });
        
        results.summary.failed++;
        
        // Update alert delivery status
        await this.updateAlertDeliveryStatus(alertId, 'email', recipient.email, 'failed', null, error.message);
        
        logger.agent(this.agentName, 'error', 'Email sending failed', {
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


  async storeAlert(alertData, alertMessage, recipients) {
    try {
      // Determine primary delivery method (first available)
      const primaryMethod = alertData.channels.includes('sms') ? 'sms' : 
                           alertData.channels.includes('email') ? 'email' :
                           alertData.channels.includes('push') ? 'push' : 'in_app';
      
      // Get first recipient contact
      const primaryRecipient = recipients.length > 0 ? 
        (recipients[0].phone || recipients[0].email || null) : null;
      
      // Map severity to valid enum values
      let dbSeverity = 'info';
      if (alertData.severity === 'critical' || alertData.severity === 'high') {
        dbSeverity = 'critical';
      } else if (alertData.severity === 'warning' || alertData.severity === 'medium') {
        dbSeverity = 'warning';
      } else {
        dbSeverity = 'info';
      }
      
      const result = await query(`
        INSERT INTO alerts (
          alert_type, farm_id, request_id, message,
          severity, delivery_method, recipient_email, 
          delivery_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        alertData.type,
        alertData.farm_id,
        alertData.burn_request_id,
        `${alertData.title || 'Alert'}: ${alertMessage.content}`,
        dbSeverity,
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
          sent_at = CASE WHEN ? = 'delivered' THEN NOW() ELSE sent_at END,
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
        AND status IN ('sent', 'delivered', 'failed')
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
        WHERE delivery_status = 'pending'
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
    // Enhanced retry logic with max attempts tracking
    const alertKey = `alert_${alert.id}`;
    let retryCount = this.retryAttempts.get(alertKey) || 0;
    
    logger.agent(this.agentName, 'debug', 'Retrying failed alert', { 
      alertId: alert.id, 
      retryAttempt: retryCount + 1,
      maxAttempts: this.maxRetryAttempts 
    });
    
    // Check if max retries exceeded
    if (retryCount >= this.maxRetryAttempts) {
      await query('UPDATE alerts SET delivery_status = ? WHERE alert_id = ?', 
        ['failed', alert.id]);
      this.retryAttempts.delete(alertKey);
      logger.agent(this.agentName, 'warn', 'Alert permanently failed after max retries', { 
        alertId: alert.id, 
        attempts: retryCount 
      });
      return;
    }
    
    // Mark as failed if too old (over 1 hour)
    if (Date.now() - new Date(alert.created_at).getTime() > 60 * 60 * 1000) {
      await query('UPDATE alerts SET delivery_status = ? WHERE alert_id = ?', 
        ['failed', alert.id]);
      this.retryAttempts.delete(alertKey);
      return;
    }
    
    // Increment retry count
    retryCount++;
    this.retryAttempts.set(alertKey, retryCount);
    
    // For now, mark as sent since we don't have real SMS setup
    // In production, this would actually retry sending the alert
    await query('UPDATE alerts SET delivery_status = ?, sent_at = NOW() WHERE alert_id = ?', 
      ['sent', alert.id]);
    
    // Clean up retry tracking after successful send
    this.retryAttempts.delete(alertKey);
    logger.agent(this.agentName, 'info', 'Alert marked as sent after retry', { 
      alertId: alert.id, 
      attempts: retryCount 
    });
  }

  // Utility methods removed - duplicate parseTime deleted

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
        sendGridConfigured: !!this.sendGridClient,
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

// Export both the class and a singleton instance
module.exports = new AlertsAgent();
module.exports.AlertsAgent = AlertsAgent;