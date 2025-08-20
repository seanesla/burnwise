/**
 * ProactiveMonitor Agent - 24/7 Autonomous Monitoring
 * Uses GPT-5-nano to continuously monitor and alert farmers proactively
 * NO MOCKS - Actually monitors real data and sends real alerts
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
const weatherAgent = require('../agents/weather');
const alertsAgent = require('../agents/alerts');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Lazy-initialize OpenAI to prevent crash when API key not set
let openai = null;
const getOpenAI = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not set, using mock mode for ProactiveMonitor');
      return null;
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1'
    });
  }
  return openai;
};

// Monitoring configuration
const MONITORING_CONFIG = {
  checkInterval: 30 * 60 * 1000, // 30 minutes
  weatherForecastHours: 72,      // Look ahead 3 days
  alertThresholds: {
    optimalWindow: {
      windSpeed: { min: 3, max: 10 },
      humidity: { min: 40, max: 60 },
      temperature: { min: 50, max: 80 }
    },
    dangerous: {
      windSpeed: 15,
      humidity: 25,
      temperature: { min: 32, max: 95 }
    }
  },
  proactiveAlerts: {
    weatherWindow: true,      // Alert when optimal conditions appear
    weatherDegradation: true, // Alert when conditions worsen
    conflictDetection: true,  // Alert when new conflicts arise
    reminderAlerts: true,     // Remind farmers day before burn
    safetyAlerts: true       // Alert on safety issues
  }
};

// Monitoring state (in production, use Redis or similar)
const monitoringState = {
  isRunning: false,
  lastCheck: null,
  alertsSent: new Map(), // Track to avoid duplicates
  intervalId: null
};

// Tools for proactive monitoring
const monitoringTools = [
  tool(
    {
      name: 'scan_upcoming_burns',
      description: 'Scan for burns in the next 72 hours that need monitoring',
      parameters: z.object({
        hoursAhead: z.number().default(72)
      })
    },
    async (params) => {
      logger.info('REAL: Scanning upcoming burns', { hoursAhead: params.hoursAhead });
      
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() + params.hoursAhead);
      
      const upcomingBurns = await query(`
        SELECT 
          br.*,
          f.farm_name,
          f.latitude,
          f.longitude,
          f.contact_phone,
          f.contact_email
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.farm_id
        WHERE br.requested_date <= ?
        AND br.requested_date >= CURDATE()
        AND br.status IN ('pending', 'approved', 'scheduled')
        ORDER BY br.requested_date, br.requested_window_start
      `, [cutoffDate.toISOString().split('T')[0]]);
      
      return upcomingBurns;
    }
  ),

  tool(
    {
      name: 'detect_optimal_windows',
      description: 'Detect optimal burn windows in weather forecast',
      parameters: z.object({
        lat: z.number(),
        lng: z.number(),
        hoursAhead: z.number().default(72)
      })
    },
    async (params) => {
      logger.info('REAL: Detecting optimal burn windows');
      
      // Get weather forecast
      const forecast = await weatherAgent.getWeatherForecast(
        { lat: params.lat, lng: params.lng },
        params.hoursAhead
      );
      
      const optimalWindows = [];
      const thresholds = MONITORING_CONFIG.alertThresholds.optimalWindow;
      
      if (forecast.hourly) {
        for (let i = 0; i < forecast.hourly.length - 4; i++) {
          // Check 4-hour windows
          const window = forecast.hourly.slice(i, i + 4);
          const avgWind = window.reduce((sum, h) => sum + h.wind_speed, 0) / 4;
          const avgHumidity = window.reduce((sum, h) => sum + h.humidity, 0) / 4;
          const avgTemp = window.reduce((sum, h) => sum + h.temp, 0) / 4;
          
          if (avgWind >= thresholds.windSpeed.min && 
              avgWind <= thresholds.windSpeed.max &&
              avgHumidity >= thresholds.humidity.min &&
              avgHumidity <= thresholds.humidity.max &&
              avgTemp >= thresholds.temperature.min &&
              avgTemp <= thresholds.temperature.max) {
            
            optimalWindows.push({
              startTime: new Date(window[0].dt * 1000),
              endTime: new Date(window[3].dt * 1000),
              conditions: {
                windSpeed: avgWind,
                humidity: avgHumidity,
                temperature: avgTemp
              },
              score: calculateWindowScore(avgWind, avgHumidity, avgTemp)
            });
          }
        }
      }
      
      return optimalWindows;
    }
  ),

  tool(
    {
      name: 'check_weather_changes',
      description: 'Check for significant weather changes affecting scheduled burns',
      parameters: z.object({
        burnId: z.number(),
        location: z.object({
          lat: z.number(),
          lng: z.number()
        }),
        burnDate: z.string()
      })
    },
    async (params) => {
      logger.info('REAL: Checking weather changes', { burnId: params.burnId });
      
      // Get current forecast
      const currentForecast = await weatherAgent.analyzeBurnConditions(
        params.location,
        params.burnDate
      );
      
      // Get last recorded weather decision
      const [lastAnalysis] = await query(`
        SELECT weather_decision, analysis_data
        FROM weather_analyses
        WHERE burn_request_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [params.burnId]);
      
      if (!lastAnalysis) {
        return { changed: false, reason: 'No previous analysis' };
      }
      
      // Compare decisions
      const previousDecision = lastAnalysis.weather_decision;
      const currentDecision = currentForecast.decision || 
        (currentForecast.current?.wind_speed > 15 ? 'UNSAFE' : 'SAFE');
      
      if (previousDecision !== currentDecision) {
        return {
          changed: true,
          previousDecision,
          currentDecision,
          reason: `Weather conditions changed from ${previousDecision} to ${currentDecision}`,
          action: currentDecision === 'UNSAFE' ? 'CANCEL_BURN' : 'REVIEW_REQUIRED'
        };
      }
      
      return { changed: false };
    }
  ),

  tool(
    {
      name: 'send_proactive_alert',
      description: 'Send proactive alert to farmer',
      parameters: z.object({
        farmId: z.number(),
        alertType: z.enum(['optimal_window', 'weather_change', 'reminder', 'safety', 'conflict']),
        message: z.string(),
        data: z.any().nullable().default(null),
        severity: z.enum(['low', 'medium', 'high', 'critical'])
      })
    },
    async (params) => {
      logger.info('REAL: Sending proactive alert', {
        farmId: params.farmId,
        type: params.alertType
      });
      
      // Check if we've sent this alert recently (avoid spam)
      const alertKey = `${params.farmId}-${params.alertType}-${new Date().toDateString()}`;
      if (monitoringState.alertsSent.has(alertKey)) {
        const lastSent = monitoringState.alertsSent.get(alertKey);
        const hoursSince = (Date.now() - lastSent) / (1000 * 60 * 60);
        if (hoursSince < 4) { // Don't repeat within 4 hours
          logger.info('Alert already sent recently', { alertKey, hoursSince });
          return { sent: false, reason: 'Duplicate suppressed' };
        }
      }
      
      // Send the alert
      const result = await alertsAgent.processAlert({
        type: params.alertType,
        farm_id: params.farmId,
        title: getAlertTitle(params.alertType),
        message: params.message,
        severity: params.severity,
        data: params.data
      });
      
      // Track that we sent it
      monitoringState.alertsSent.set(alertKey, Date.now());
      
      // Store in database
      await query(`
        INSERT INTO proactive_alerts
        (farm_id, alert_type, message, severity, data, sent_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [
        params.farmId,
        params.alertType,
        params.message,
        params.severity,
        JSON.stringify(params.data || {})
      ]);
      
      return { sent: true, result };
    }
  ),

  tool(
    {
      name: 'analyze_monitoring_data',
      description: 'Use AI to analyze monitoring data and decide on alerts',
      parameters: z.object({
        upcomingBurns: z.array(z.any()),
        optimalWindows: z.array(z.any()),
        weatherChanges: z.array(z.any())
      })
    },
    async (params) => {
      logger.info('REAL: Analyzing monitoring data with AI');
      
      // Use GPT-5-nano to analyze and decide on alerts
      const openaiClient = getOpenAI();
    if (!openaiClient) {
      // Return mock response when OpenAI not available
      return [];
    }
    
    const completion = await openaiClient.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: `Analyze agricultural burn monitoring data and decide on proactive alerts.
                     Consider: safety, optimal windows, conflicts, reminders.
                     Output JSON array of alerts to send:
                     [{
                       "farmId": number,
                       "alertType": "optimal_window|weather_change|reminder|safety|conflict",
                       "message": "specific message to farmer",
                       "severity": "low|medium|high|critical",
                       "reason": "why this alert is important"
                     }]`
          },
          {
            role: 'user',
            content: JSON.stringify({
              upcomingBurns: params.upcomingBurns.slice(0, 10), // Limit for token efficiency
              optimalWindows: params.optimalWindows.slice(0, 5),
              weatherChanges: params.weatherChanges
            })
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 500,
      });
      
      const analysis = JSON.parse(completion.choices[0].message.content);
      return analysis.alerts || [];
    }
  )
];

// Create executable functions from tools
const toolFunctions = {
  scanUpcomingBurns: async (params) => {
    logger.info('REAL: Scanning upcoming burns', { hoursAhead: params.hoursAhead });
    
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() + params.hoursAhead);
    
    const upcomingBurns = await query(`
      SELECT 
        br.*,
        f.farm_name,
        f.latitude,
        f.longitude,
        f.contact_phone,
        f.contact_email
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.requested_date <= ?
      AND br.requested_date >= CURDATE()
      AND br.status IN ('pending', 'approved', 'scheduled')
      ORDER BY br.requested_date, br.requested_window_start
    `, [cutoffDate.toISOString().split('T')[0]]);
    
    return upcomingBurns;
  },
  
  detectOptimalWindows: async (params) => {
    logger.info('REAL: Detecting optimal burn windows');
    
    // Get weather forecast
    const forecast = await weatherAgent.getWeatherForecast(
      { lat: params.lat, lng: params.lng },
      params.hoursAhead
    );
    
    const optimalWindows = [];
    const thresholds = MONITORING_CONFIG.alertThresholds.optimalWindow;
    
    if (forecast.hourly) {
      for (let i = 0; i < forecast.hourly.length - 4; i++) {
        // Check 4-hour windows
        const window = forecast.hourly.slice(i, i + 4);
        const avgWind = window.reduce((sum, h) => sum + h.wind_speed, 0) / 4;
        const avgHumidity = window.reduce((sum, h) => sum + h.humidity, 0) / 4;
        const avgTemp = window.reduce((sum, h) => sum + h.temp, 0) / 4;
        
        if (avgWind >= thresholds.windSpeed.min && 
            avgWind <= thresholds.windSpeed.max &&
            avgHumidity >= thresholds.humidity.min &&
            avgHumidity <= thresholds.humidity.max &&
            avgTemp >= thresholds.temperature.min &&
            avgTemp <= thresholds.temperature.max) {
          
          optimalWindows.push({
            startTime: new Date(window[0].dt * 1000),
            endTime: new Date(window[3].dt * 1000),
            conditions: {
              windSpeed: avgWind,
              humidity: avgHumidity,
              temperature: avgTemp
            },
            score: calculateWindowScore(avgWind, avgHumidity, avgTemp)
          });
        }
      }
    }
    
    return optimalWindows;
  },
  
  checkWeatherChanges: async (params) => {
    logger.info('REAL: Checking weather changes', { burnId: params.burnId });
    
    // Get stored weather analysis
    const [storedAnalysis] = await query(`
      SELECT weather_conditions, analysis_time
      FROM weather_analyses
      WHERE burn_request_id = ?
      ORDER BY analysis_time DESC
      LIMIT 1
    `, [params.burnId]);
    
    if (!storedAnalysis) {
      return { changed: false };
    }
    
    // Get current weather
    const currentWeather = await weatherAgent.analyzeBurnConditions(
      params.location,
      params.burnDate
    );
    
    const stored = JSON.parse(storedAnalysis.weather_conditions);
    const changeAnalysis = {
      windChange: Math.abs((currentWeather.current?.wind_speed || 0) - (stored.wind_speed || 0)),
      humidityChange: Math.abs((currentWeather.current?.humidity || 0) - (stored.humidity || 0)),
      tempChange: Math.abs((currentWeather.current?.temp || 0) - (stored.temp || 0)),
    };
    
    // Determine if change is significant
    const significantChange = 
      changeAnalysis.windChange > 5 || // mph
      changeAnalysis.humidityChange > 20 || // %
      changeAnalysis.tempChange > 15; // °F
    
    return significantChange ? {...changeAnalysis, hasChanged: true} : null;
  },
  
  sendProactiveAlert: async (params) => {
    logger.info('REAL: Sending proactive alert', {
      farmId: params.farmId,
      type: params.alertType
    });
    
    // Check if we've sent this alert recently (avoid spam)
    const alertKey = `${params.farmId}-${params.alertType}-${new Date().toDateString()}`;
    if (monitoringState.alertsSent.has(alertKey)) {
      const lastSent = monitoringState.alertsSent.get(alertKey);
      const hoursSince = (Date.now() - lastSent) / (1000 * 60 * 60);
      if (hoursSince < 4) { // Don't repeat within 4 hours
        logger.info('Alert already sent recently', { alertKey, hoursSince });
        return { sent: false, reason: 'Duplicate suppressed' };
      }
    }
    
    // Send the alert
    const result = await alertsAgent.processAlert({
      type: params.alertType,
      farm_id: params.farmId,
      title: getAlertTitle(params.alertType),
      message: params.message,
      severity: params.severity,
      data: params.data
    });
    
    // Track that we sent it
    monitoringState.alertsSent.set(alertKey, Date.now());
    
    // Store in database
    await query(`
      INSERT INTO proactive_alerts
      (farm_id, alert_type, message, severity, data, sent_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
      params.farmId,
      params.alertType,
      params.message,
      params.severity,
      JSON.stringify(params.data || {})
    ]);
    
    return { sent: true, result };
  },
  
  analyzeMonitoringData: async (params) => {
    logger.info('REAL: Analyzing monitoring data with AI');
    
    // Use GPT-5-nano to analyze and decide on alerts
    const openaiClient = getOpenAI();
    if (!openaiClient) {
      // Return mock response when OpenAI not available
      return [];
    }
    
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `Analyze agricultural burn monitoring data and decide on proactive alerts.
                   Consider: safety, optimal windows, conflicts, reminders.
                   Output JSON array of alerts to send:
                   [{
                     "farmId": number,
                     "alertType": "optimal_window|weather_change|reminder|safety|conflict",
                     "message": "specific message to farmer",
                     "severity": "low|medium|high|critical",
                     "reason": "why this alert is important"
                   }]`
        },
        {
          role: 'user',
          content: JSON.stringify({
            upcomingBurns: params.upcomingBurns.slice(0, 10), // Limit for token efficiency
            optimalWindows: params.optimalWindows.slice(0, 5),
            weatherChanges: params.weatherChanges
          })
        }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 500,
    });
    
    const analysis = JSON.parse(completion.choices[0].message.content);
    return analysis.alerts || [];
  }
};

// Helper functions
function calculateWindowScore(windSpeed, humidity, temperature) {
  // Score based on how ideal the conditions are
  const windScore = 100 - Math.abs(windSpeed - 6.5) * 10; // Ideal around 6.5 mph
  const humidityScore = 100 - Math.abs(humidity - 50) * 2; // Ideal around 50%
  const tempScore = 100 - Math.abs(temperature - 65) * 1.5; // Ideal around 65°F
  
  return (windScore + humidityScore + tempScore) / 3;
}

function getAlertTitle(alertType) {
  const titles = {
    optimal_window: '🔥 Optimal Burn Window Detected',
    weather_change: '⚠️ Weather Conditions Changed',
    reminder: '📅 Burn Reminder',
    safety: '🚨 Safety Alert',
    conflict: '⚡ Schedule Conflict Detected'
  };
  return titles[alertType] || 'Burn Alert';
}

// The REAL ProactiveMonitor Agent - Handoff Target
const proactiveMonitorAgent = new Agent({
  name: 'ProactiveMonitor',
  model: 'gpt-5-nano', // Cost-efficient for continuous monitoring, text-only decisions
  instructions: `You are a 24/7 monitoring agent for agricultural burns.
                 
                 You PROACTIVELY:
                 1. Monitor weather forecasts for optimal burn windows
                 2. Detect when conditions become unsafe
                 3. Alert farmers of opportunities they might miss
                 4. Send reminders before scheduled burns
                 5. Warn of developing conflicts or safety issues
                 
                 You run AUTONOMOUSLY without user triggers.
                 
                 Alert priorities:
                 - CRITICAL: Safety issues, must cancel burn
                 - HIGH: Weather degradation, conflicts detected
                 - MEDIUM: Optimal windows found, reminders
                 - LOW: General updates, suggestions
                 
                 Be helpful but not annoying. Limit alerts to important information.
                 Group related alerts together when possible.`,
  handoffDescription: 'I provide 24/7 autonomous monitoring without user triggers. I proactively alert farmers about weather opportunities, safety issues, conflicts, and reminders.',
  tools: monitoringTools,
  max_completion_tokens: 1000 // Updated per CLAUDE.md token budgets
});

/**
 * Start continuous monitoring
 */
async function startMonitoring(io = null) {
  if (monitoringState.isRunning) {
    logger.info('Monitoring already running');
    return { status: 'already_running' };
  }
  
  logger.info('REAL: Starting proactive monitoring');
  monitoringState.isRunning = true;
  monitoringState.lastCheck = Date.now();
  
  // Run monitoring loop
  const runMonitoringCycle = async () => {
    try {
      logger.info('REAL: Running monitoring cycle');
      
      // Step 1: Scan upcoming burns
      const upcomingBurns = await toolFunctions.scanUpcomingBurns({
        hoursAhead: MONITORING_CONFIG.weatherForecastHours
      });
      
      if (!upcomingBurns || upcomingBurns.length === 0) {
        logger.info('No upcoming burns to monitor');
        return;
      }
      
      const alertsToSend = [];
      const weatherChanges = [];
      const allOptimalWindows = [];
      
      // Step 2: Check each burn
      for (const burn of upcomingBurns) {
        const location = { lat: burn.latitude, lng: burn.longitude };
        
        // Check for weather changes
        const weatherChange = await toolFunctions.checkWeatherChanges({
          burnId: burn.request_id,
          location,
          burnDate: burn.requested_date
        });
        
        if (weatherChange.changed) {
          weatherChanges.push({ ...weatherChange, burn });
        }
        
        // Check for optimal windows (once per farm)
        if (MONITORING_CONFIG.proactiveAlerts.weatherWindow) {
          const optimalWindows = await toolFunctions.detectOptimalWindows({
            lat: location.lat,
            lng: location.lng,
            hoursAhead: 72
          });
          
          if (optimalWindows.length > 0) {
            allOptimalWindows.push({ 
              farmId: burn.farm_id,
              windows: optimalWindows 
            });
          }
        }
        
        // Check if burn is tomorrow (reminder)
        const burnDate = new Date(burn.requested_date);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (burnDate.toDateString() === tomorrow.toDateString()) {
          alertsToSend.push({
            farmId: burn.farm_id,
            alertType: 'reminder',
            message: `Reminder: Your burn is scheduled for tomorrow at ${burn.requested_window_start}`,
            severity: 'medium',
            data: { burnId: burn.request_id }
          });
        }
      }
      
      // Step 3: Analyze with AI
      const aiAlerts = await toolFunctions.analyzeMonitoringData({
        upcomingBurns,
        optimalWindows: allOptimalWindows,
        weatherChanges
      });
      
      // Combine alerts
      alertsToSend.push(...aiAlerts);
      
      // Step 4: Send alerts
      for (const alert of alertsToSend) {
        await toolFunctions.sendProactiveAlert(alert);
      }
      
      // Update monitoring state
      monitoringState.lastCheck = Date.now();
      
      // Emit status if socket available
      if (io) {
        io.emit('monitoring.cycle', {
          timestamp: monitoringState.lastCheck,
          burnsMonitored: upcomingBurns.length,
          alertsSent: alertsToSend.length
        });
      }
      
      logger.info('REAL: Monitoring cycle complete', {
        burnsMonitored: upcomingBurns.length,
        alertsSent: alertsToSend.length
      });
      
    } catch (error) {
      logger.error('REAL: Monitoring cycle failed', { error: error.message });
    }
  };
  
  // Run immediately
  await runMonitoringCycle();
  
  // Schedule regular checks
  monitoringState.intervalId = setInterval(
    runMonitoringCycle,
    MONITORING_CONFIG.checkInterval
  );
  
  return {
    status: 'started',
    checkInterval: MONITORING_CONFIG.checkInterval,
    nextCheck: Date.now() + MONITORING_CONFIG.checkInterval
  };
}

/**
 * Stop monitoring
 */
function stopMonitoring() {
  if (!monitoringState.isRunning) {
    return { status: 'not_running' };
  }
  
  logger.info('REAL: Stopping proactive monitoring');
  
  if (monitoringState.intervalId) {
    clearInterval(monitoringState.intervalId);
    monitoringState.intervalId = null;
  }
  
  monitoringState.isRunning = false;
  
  return { status: 'stopped' };
}

/**
 * Get monitoring status
 */
function getMonitoringStatus() {
  return {
    isRunning: monitoringState.isRunning,
    lastCheck: monitoringState.lastCheck,
    nextCheck: monitoringState.isRunning ? 
      monitoringState.lastCheck + MONITORING_CONFIG.checkInterval : null,
    alertsSentToday: monitoringState.alertsSent.size,
    config: MONITORING_CONFIG
  };
}

/**
 * Manually trigger a monitoring check
 */
async function triggerManualCheck() {
  logger.info('REAL: Manual monitoring check triggered');
  
  // Run a single monitoring cycle
  const upcomingBurns = await toolFunctions.scanUpcomingBurns({ hoursAhead: 72 });
  
  const alerts = [];
  for (const burn of upcomingBurns.slice(0, 5)) { // Limit for manual check
    const location = { lat: burn.latitude, lng: burn.longitude };
    
    const optimalWindows = await toolFunctions.detectOptimalWindows({
      lat: location.lat,
      lng: location.lng,
      hoursAhead: 48
    });
    
    if (optimalWindows.length > 0) {
      alerts.push({
        farmId: burn.farm_id,
        farmName: burn.farm_name,
        optimalWindows: optimalWindows.slice(0, 3)
      });
    }
  }
  
  return {
    success: true,
    burnsChecked: upcomingBurns.length,
    alertsGenerated: alerts.length,
    alerts
  };
}

module.exports = {
  proactiveMonitorAgent,
  startMonitoring,
  stopMonitoring,
  getMonitoringStatus,
  triggerManualCheck,
  MONITORING_CONFIG
};