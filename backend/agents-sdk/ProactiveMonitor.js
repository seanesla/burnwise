/**
 * ProactiveMonitor - 24/7 Autonomous Monitoring
 * Uses GPT-5-nano for cost-effective continuous monitoring
 * Proactively alerts about weather changes and conflicts
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const { query } = require('../db/connection');
const axios = require('axios');
const logger = require('../middleware/logger');

// Tool to monitor weather changes
const monitorWeatherChanges = tool({
  name: 'monitor_weather',
  description: 'Monitor weather conditions for upcoming burns',
  parameters: z.object({
    hoursAhead: z.number().default(48)
  }),
  execute: async (input) => {
    try {
      // Get burns scheduled in next 48 hours
      const sql = `
        SELECT br.*, f.latitude, f.longitude, f.name as farm_name
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.id
        WHERE br.burn_date <= DATE_ADD(NOW(), INTERVAL ? HOUR)
        AND br.burn_date >= NOW()
        AND br.status IN ('approved', 'scheduled')
      `;
      
      const upcomingBurns = await query(sql, [input.hoursAhead]);
      
      if (upcomingBurns.length === 0) {
        return { monitored: true, alerts: [], message: 'No upcoming burns to monitor' };
      }
      
      const alerts = [];
      const apiKey = process.env.OPENWEATHERMAP_API_KEY;
      
      for (const burn of upcomingBurns) {
        // Check weather forecast for each burn
        const forecast = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast`,
          {
            params: {
              lat: burn.latitude,
              lon: burn.longitude,
              appid: apiKey,
              units: 'imperial',
              cnt: 8 // 24 hours of 3-hour forecasts
            }
          }
        );
        
        // Analyze forecast for concerning conditions
        const concerns = analyzeForecast(forecast.data.list, burn);
        
        if (concerns.length > 0) {
          alerts.push({
            burnId: burn.id,
            farmName: burn.farm_name,
            scheduledDate: burn.burn_date,
            concerns,
            severity: determineSeverity(concerns),
            needsReview: true
          });
        }
      }
      
      return {
        monitored: true,
        burnsChecked: upcomingBurns.length,
        alerts,
        criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL')
      };
    } catch (error) {
      logger.error('Weather monitoring failed', error);
      return { monitored: false, error: error.message };
    }
  }
});

// Tool to detect emerging conflicts
const detectEmergingConflicts = tool({
  name: 'detect_emerging_conflicts',
  description: 'Proactively detect potential conflicts as new burns are added',
  parameters: z.object({
    daysAhead: z.number().default(7)
  }),
  execute: async (input) => {
    try {
      const sql = `
        SELECT 
          DATE(burn_date) as date,
          COUNT(*) as burn_count,
          SUM(acres) as total_acres,
          GROUP_CONCAT(id) as burn_ids
        FROM burn_requests
        WHERE burn_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
        AND status IN ('pending', 'approved', 'scheduled')
        GROUP BY DATE(burn_date)
        HAVING COUNT(*) > 3
      `;
      
      const congestedDays = await query(sql, [input.daysAhead]);
      
      const potentialConflicts = [];
      
      for (const day of congestedDays) {
        // Check spatial proximity for burns on same day
        const burnIds = day.burn_ids.split(',').map(Number);
        
        const burnDetails = await query(
          `SELECT br.*, f.latitude, f.longitude 
           FROM burn_requests br
           JOIN farms f ON br.farm_id = f.id
           WHERE br.id IN (${burnIds.map(() => '?').join(',')})`,
          burnIds
        );
        
        // Check for proximity conflicts
        for (let i = 0; i < burnDetails.length; i++) {
          for (let j = i + 1; j < burnDetails.length; j++) {
            const distance = calculateDistance(
              burnDetails[i].latitude, burnDetails[i].longitude,
              burnDetails[j].latitude, burnDetails[j].longitude
            );
            
            if (distance < 5) { // Within 5 miles
              potentialConflicts.push({
                date: day.date,
                burn1: burnDetails[i].id,
                burn2: burnDetails[j].id,
                distance,
                type: 'PROXIMITY_CONFLICT'
              });
            }
          }
        }
      }
      
      return {
        detected: true,
        congestedDays: congestedDays.length,
        potentialConflicts,
        needsOptimization: potentialConflicts.length > 0
      };
    } catch (error) {
      logger.error('Conflict detection failed', error);
      return { detected: false, error: error.message };
    }
  }
});

// Tool to check PM2.5 levels
const monitorAirQuality = tool({
  name: 'monitor_air_quality',
  description: 'Monitor PM2.5 levels from active burns',
  parameters: z.object({
    alertThreshold: z.number().default(35) // EPA 24-hour standard
  }),
  execute: async (input) => {
    try {
      // Get currently active burns
      const sql = `
        SELECT br.*, f.latitude, f.longitude, f.name as farm_name,
               sp.pm25_concentration, sp.dispersion_radius
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.id
        LEFT JOIN smoke_predictions sp ON br.id = sp.burn_request_id
        WHERE br.status = 'in_progress'
        AND br.actual_start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      
      const activeBurns = await query(sql);
      
      const alerts = [];
      
      for (const burn of activeBurns) {
        // Check if PM2.5 exceeds threshold
        if (burn.pm25_concentration && burn.pm25_concentration > input.alertThreshold) {
          alerts.push({
            burnId: burn.id,
            farmName: burn.farm_name,
            pm25Level: burn.pm25_concentration,
            exceedance: burn.pm25_concentration - input.alertThreshold,
            action: burn.pm25_concentration > 50 ? 'IMMEDIATE_STOP' : 'REDUCE_INTENSITY'
          });
        }
      }
      
      return {
        monitored: true,
        activeBurns: activeBurns.length,
        alerts,
        criticalAlerts: alerts.filter(a => a.action === 'IMMEDIATE_STOP')
      };
    } catch (error) {
      logger.error('Air quality monitoring failed', error);
      return { monitored: false, error: error.message };
    }
  }
});

// Tool to generate proactive recommendations
const generateRecommendations = tool({
  name: 'generate_recommendations',
  description: 'Generate proactive recommendations based on monitoring',
  parameters: z.object({
    weatherAlerts: z.array(z.any()),
    conflicts: z.array(z.any()),
    airQualityAlerts: z.array(z.any())
  }),
  execute: async (input) => {
    const recommendations = [];
    
    // Weather-based recommendations
    if (input.weatherAlerts.length > 0) {
      const criticalWeather = input.weatherAlerts.filter(a => a.severity === 'CRITICAL');
      if (criticalWeather.length > 0) {
        recommendations.push({
          type: 'WEATHER',
          priority: 'HIGH',
          action: 'POSTPONE_BURNS',
          burnIds: criticalWeather.map(a => a.burnId),
          reason: 'Critical weather conditions detected'
        });
      }
    }
    
    // Conflict-based recommendations
    if (input.conflicts.length > 0) {
      recommendations.push({
        type: 'CONFLICT',
        priority: 'MEDIUM',
        action: 'TRIGGER_OPTIMIZATION',
        details: `${input.conflicts.length} potential conflicts detected`,
        reason: 'Multiple burns scheduled in proximity'
      });
    }
    
    // Air quality recommendations
    if (input.airQualityAlerts.length > 0) {
      const critical = input.airQualityAlerts.filter(a => a.action === 'IMMEDIATE_STOP');
      if (critical.length > 0) {
        recommendations.push({
          type: 'AIR_QUALITY',
          priority: 'CRITICAL',
          action: 'STOP_BURNS',
          burnIds: critical.map(a => a.burnId),
          reason: 'PM2.5 levels exceed safe limits'
        });
      }
    }
    
    // Proactive optimization suggestion
    if (input.conflicts.length > 3) {
      recommendations.push({
        type: 'OPTIMIZATION',
        priority: 'LOW',
        action: 'SUGGEST_RESCHEDULE',
        reason: 'Schedule congestion detected - optimization recommended'
      });
    }
    
    return { recommendations, count: recommendations.length };
  }
});

// Helper functions
function analyzeForecast(forecasts, burn) {
  const concerns = [];
  
  for (const forecast of forecasts) {
    const forecastTime = new Date(forecast.dt * 1000);
    const burnTime = new Date(burn.burn_date);
    
    // Check if forecast is during burn window
    if (Math.abs(forecastTime - burnTime) < 12 * 60 * 60 * 1000) {
      // Check wind speed
      if (forecast.wind.speed > 15) {
        concerns.push({
          type: 'HIGH_WIND',
          value: forecast.wind.speed,
          time: forecastTime
        });
      }
      
      // Check humidity
      if (forecast.main.humidity < 30) {
        concerns.push({
          type: 'LOW_HUMIDITY',
          value: forecast.main.humidity,
          time: forecastTime
        });
      }
      
      // Check for precipitation
      if (forecast.rain && forecast.rain['3h'] > 0) {
        concerns.push({
          type: 'RAIN_EXPECTED',
          value: forecast.rain['3h'],
          time: forecastTime
        });
      }
    }
  }
  
  return concerns;
}

function determineSeverity(concerns) {
  if (concerns.some(c => c.type === 'HIGH_WIND' && c.value > 20)) {
    return 'CRITICAL';
  }
  if (concerns.some(c => c.type === 'LOW_HUMIDITY' && c.value < 25)) {
    return 'HIGH';
  }
  return 'MEDIUM';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * ProactiveMonitor Agent - 24/7 autonomous monitoring
 * Uses GPT-5-nano for cost-effective continuous operation
 */
const proactiveMonitor = new Agent({
  name: 'ProactiveMonitor',
  handoffDescription: 'I continuously monitor conditions and proactively alert about issues',
  
  instructions: `You are the ProactiveMonitor, running 24/7 to prevent problems before they occur.
    
    Your monitoring cycle (every 15 minutes):
    1. Check weather forecasts using monitor_weather tool
    2. Detect emerging conflicts using detect_emerging_conflicts tool
    3. Monitor air quality using monitor_air_quality tool
    4. Generate recommendations using generate_recommendations tool
    
    Proactive actions:
    - Alert farmers 24 hours before dangerous weather
    - Detect conflicts as soon as new burns are added
    - Monitor PM2.5 levels during active burns
    - Suggest optimizations before congestion occurs
    
    Alert thresholds:
    - CRITICAL: Immediate action required (stop burns)
    - HIGH: Urgent review needed (postpone/reschedule)
    - MEDIUM: Schedule adjustment recommended
    - LOW: Informational only
    
    When critical issues detected:
    - Generate detailed weather analysis alerts
    - Provide conflict resolution recommendations
    - Always flag for human review if safety at risk
    
    Provide clear, actionable alerts with specific recommendations.`,
  
  model: 'gpt-5-nano', // Cost-effective for 24/7 operation
  
  tools: [
    monitorWeatherChanges,
    detectEmergingConflicts,
    monitorAirQuality,
    generateRecommendations
  ]
});

module.exports = proactiveMonitor;