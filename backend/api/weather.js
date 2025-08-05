const express = require('express');
const { query, vectorSimilaritySearch } = require('../db/connection');
const { asyncHandler, ValidationError, DatabaseError } = require('../middleware/errorHandler');
const weatherAgent = require('../agents/weather');
const logger = require('../middleware/logger');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lon: Joi.number().min(-180).max(180).required()
});

const weatherAnalysisSchema = Joi.object({
  farm_id: Joi.number().integer().positive().required(),
  burn_date: Joi.date().iso().min('now').required(),
  time_window_start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  time_window_end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
});

/**
 * GET /api/weather/current/:lat/:lon
 * Get current weather for specific coordinates
 */
router.get('/current/:lat/:lon', asyncHandler(async (req, res) => {
  const { lat, lon } = req.params;
  
  try {
    // Validate coordinates
    const { error } = locationSchema.validate({ lat: parseFloat(lat), lon: parseFloat(lon) });
    if (error) {
      throw new ValidationError('Invalid coordinates', 'location', error.details);
    }
    
    const location = { lat: parseFloat(lat), lon: parseFloat(lon) };
    const currentWeather = await weatherAgent.getCurrentWeather(location);
    
    res.json({
      success: true,
      data: {
        location,
        weather: currentWeather,
        cached: false // Weather agent handles caching internally
      }
    });
    
  } catch (error) {
    logger.error('Current weather fetch failed', { 
      lat, 
      lon, 
      error: error.message 
    });
    throw error;
  }
}));

/**
 * GET /api/weather/forecast/:lat/:lon
 * Get weather forecast for specific coordinates and date
 */
router.get('/forecast/:lat/:lon', asyncHandler(async (req, res) => {
  const { lat, lon } = req.params;
  const { date, hours = 24 } = req.query;
  
  try {
    // Validate coordinates
    const { error } = locationSchema.validate({ lat: parseFloat(lat), lon: parseFloat(lon) });
    if (error) {
      throw new ValidationError('Invalid coordinates', 'location', error.details);
    }
    
    if (!date) {
      throw new ValidationError('Date parameter is required', 'date');
    }
    
    const location = { lat: parseFloat(lat), lon: parseFloat(lon) };
    const burnDate = new Date(date);
    
    if (burnDate < new Date()) {
      throw new ValidationError('Date cannot be in the past', 'date');
    }
    
    const forecast = await weatherAgent.getWeatherForecast(
      location, 
      burnDate.toISOString().split('T')[0],
      { start: '06:00', end: '18:00' } // Default daylight hours
    );
    
    res.json({
      success: true,
      data: {
        location,
        date: burnDate,
        forecast: forecast.slice(0, parseInt(hours)),
        total_hours: forecast.length
      }
    });
    
  } catch (error) {
    logger.error('Weather forecast fetch failed', { 
      lat, 
      lon, 
      date, 
      error: error.message 
    });
    throw error;
  }
}));

/**
 * POST /api/weather/analyze
 * Comprehensive weather analysis for burn planning
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { error } = weatherAnalysisSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid weather analysis request', 'body', error.details);
    }
    
    const { farm_id, burn_date, time_window_start, time_window_end } = req.body;
    
    // Get farm location
    const farmData = await query(`
      SELECT 
        id, name, owner_name,
        ST_X(location) as lon, 
        ST_Y(location) as lat
      FROM farms 
      WHERE id = ?
    `, [farm_id]);
    
    if (farmData.length === 0) {
      throw new ValidationError('Farm not found', 'farm_id');
    }
    
    const farm = farmData[0];
    const location = { lat: farm.lat, lon: farm.lon };
    
    // Perform comprehensive weather analysis
    const analysisResult = await weatherAgent.analyzeWeatherForBurn(
      null, // No burn request ID for standalone analysis
      location,
      burn_date,
      { start: time_window_start, end: time_window_end }
    );
    
    const duration = Date.now() - startTime;
    
    logger.performance('weather_analysis_api', duration, {
      farmId: farm_id,
      location: `${location.lat}, ${location.lon}`,
      suitabilityScore: analysisResult.suitabilityAnalysis.overallScore
    });
    
    res.json({
      success: true,
      data: {
        farm: {
          id: farm.id,
          name: farm.name,
          owner: farm.owner_name,
          location
        },
        analysis: {
          current_weather: analysisResult.currentWeather,
          forecast_summary: {
            hours_analyzed: analysisResult.forecast.length,
            overall_suitability: analysisResult.suitabilityAnalysis.overallScore,
            optimal_hours: analysisResult.suitabilityAnalysis.optimalHours.length,
            confidence: analysisResult.confidence
          },
          suitability_analysis: analysisResult.suitabilityAnalysis,
          similar_patterns: analysisResult.similarPatterns,
          recommendations: analysisResult.recommendations
        },
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Weather analysis failed', { 
      error: error.message,
      duration: Date.now() - startTime,
      requestData: req.body
    });
    throw error;
  }
}));

/**
 * GET /api/weather/patterns/similar
 * Find weather patterns similar to current conditions
 */
router.get('/patterns/similar', asyncHandler(async (req, res) => {
  const { lat, lon, limit = 10 } = req.query;
  
  try {
    if (!lat || !lon) {
      throw new ValidationError('Latitude and longitude are required', 'location');
    }
    
    const location = { lat: parseFloat(lat), lon: parseFloat(lon) };
    
    // Get current weather and generate vector
    const currentWeather = await weatherAgent.getCurrentWeather(location);
    const forecast = await weatherAgent.getWeatherForecast(
      location, 
      new Date().toISOString().split('T')[0],
      { start: '06:00', end: '18:00' }
    );
    
    const weatherVector = await weatherAgent.generateWeatherVector(currentWeather, forecast);
    
    // Find similar patterns
    const similarPatterns = await vectorSimilaritySearch(
      'weather_data',
      'weather_pattern_embedding', 
      weatherVector,
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: {
        current_conditions: currentWeather,
        vector_dimensions: weatherVector.length,
        similar_patterns: similarPatterns.map(pattern => ({
          ...pattern,
          similarity_score: pattern.similarity_score,
          date: pattern.timestamp,
          conditions: {
            temperature: pattern.temperature,
            humidity: pattern.humidity,
            wind_speed: pattern.wind_speed,
            weather_condition: pattern.weather_condition
          }
        }))
      }
    });
    
  } catch (error) {
    logger.error('Similar weather patterns search failed', { 
      lat, 
      lon, 
      error: error.message 
    });
    throw error;
  }
}));

/**
 * GET /api/weather/history
 * Get historical weather data with optional filtering
 */
router.get('/history', asyncHandler(async (req, res) => {
  const {
    lat,
    lon,
    date_from,
    date_to,
    weather_condition,
    page = 1,
    limit = 50
  } = req.query;
  
  try {
    let whereConditions = [];
    let queryParams = [];
    
    // Location-based filtering (within radius if specified)
    if (lat && lon) {
      const radius = req.query.radius || 10000; // Default 10km radius
      whereConditions.push('ST_Distance_Sphere(location, POINT(?, ?)) <= ?');
      queryParams.push(parseFloat(lon), parseFloat(lat), parseFloat(radius));
    }
    
    // Date range filtering
    if (date_from) {
      whereConditions.push('DATE(timestamp) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(timestamp) <= ?');
      queryParams.push(date_to);
    }
    
    // Weather condition filtering
    if (weather_condition) {
      whereConditions.push('weather_condition = ?');
      queryParams.push(weather_condition);
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM weather_data
      ${whereClause}
    `;
    
    const [{ total }] = await query(countQuery, queryParams);
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Main query
    const historyQuery = `
      SELECT 
        id,
        ST_X(location) as lon,
        ST_Y(location) as lat,
        timestamp,
        temperature,
        humidity,
        pressure,
        wind_speed,
        wind_direction,
        visibility,
        weather_condition,
        created_at
      FROM weather_data
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(parseInt(limit), offset);
    const weatherHistory = await query(historyQuery, queryParams);
    
    res.json({
      success: true,
      data: weatherHistory,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: total,
        items_per_page: parseInt(limit)
      },
      filters_applied: {
        location: lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : null,
        date_range: { from: date_from, to: date_to },
        weather_condition
      }
    });
    
  } catch (error) {
    logger.error('Weather history fetch failed', { error: error.message });
    throw new DatabaseError('Failed to retrieve weather history', error);
  }
}));

/**
 * GET /api/weather/suitability
 * Get burn suitability analysis for multiple locations/dates
 */
router.get('/suitability', asyncHandler(async (req, res) => {
  const { farm_ids, date_from, date_to } = req.query;
  
  try {
    if (!farm_ids) {
      throw new ValidationError('farm_ids parameter is required', 'farm_ids');
    }
    
    if (!date_from || !date_to) {
      throw new ValidationError('date_from and date_to parameters are required', 'date_range');
    }
    
    const farmIdList = farm_ids.split(',').map(id => parseInt(id));
    
    // Get farm locations
    const farms = await query(`
      SELECT 
        id, name, owner_name,
        ST_X(location) as lon, 
        ST_Y(location) as lat
      FROM farms 
      WHERE id IN (${farmIdList.map(() => '?').join(',')})
    `, farmIdList);
    
    if (farms.length === 0) {
      throw new ValidationError('No valid farms found', 'farm_ids');
    }
    
    const suitabilityResults = [];
    
    // Analyze each farm for the date range
    for (const farm of farms) {
      const location = { lat: farm.lat, lon: farm.lon };
      
      // Generate date range
      const startDate = new Date(date_from);
      const endDate = new Date(date_to);
      const dates = [];
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d).toISOString().split('T')[0]);
      }
      
      const farmSuitability = {
        farm: {
          id: farm.id,
          name: farm.name,
          owner: farm.owner_name,
          location
        },
        daily_suitability: []
      };
      
      for (const date of dates) {
        try {
          const analysis = await weatherAgent.analyzeWeatherForBurn(
            null,
            location,
            date,
            { start: '06:00', end: '18:00' }
          );
          
          farmSuitability.daily_suitability.push({
            date,
            overall_score: analysis.suitabilityAnalysis.overallScore,
            optimal_hours: analysis.suitabilityAnalysis.optimalHours.length,
            recommendations: analysis.recommendations.map(r => r.message),
            confidence: analysis.confidence
          });
          
        } catch (error) {
          logger.warn('Weather analysis failed for date', { 
            farmId: farm.id, 
            date, 
            error: error.message 
          });
          
          farmSuitability.daily_suitability.push({
            date,
            overall_score: 0,
            optimal_hours: 0,
            recommendations: ['Weather analysis failed'],
            confidence: 0,
            error: error.message
          });
        }
      }
      
      suitabilityResults.push(farmSuitability);
    }
    
    res.json({
      success: true,
      data: {
        farms_analyzed: farms.length,
        date_range: { from: date_from, to: date_to },
        suitability_results: suitabilityResults
      }
    });
    
  } catch (error) {
    logger.error('Suitability analysis failed', { error: error.message });
    throw error;
  }
}));

/**
 * GET /api/weather/conditions
 * Get weather conditions summary for dashboard
 */
router.get('/conditions', asyncHandler(async (req, res) => {
  const { region } = req.query;
  
  try {
    let regionFilter = '';
    let queryParams = [];
    
    if (region) {
      // Simple region filtering by coordinate bounds
      const regions = {
        'north_valley': { minLat: 39.0, maxLat: 40.0, minLon: -122.0, maxLon: -121.0 },
        'central_valley': { minLat: 37.0, maxLat: 39.0, minLon: -122.0, maxLon: -120.0 },
        'south_valley': { minLat: 35.0, maxLat: 37.0, minLon: -121.0, maxLon: -119.0 }
      };
      
      if (regions[region]) {
        const r = regions[region];
        regionFilter = `
          AND ST_X(location) BETWEEN ? AND ?
          AND ST_Y(location) BETWEEN ? AND ?
        `;
        queryParams.push(r.minLon, r.maxLon, r.minLat, r.maxLat);
      }
    }
    
    // Get current conditions summary
    const conditionsSummary = await query(`
      SELECT 
        weather_condition,
        COUNT(*) as count,
        AVG(temperature) as avg_temperature,
        AVG(humidity) as avg_humidity,
        AVG(wind_speed) as avg_wind_speed,
        MIN(timestamp) as oldest_reading,
        MAX(timestamp) as latest_reading
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL 6 HOUR)
      ${regionFilter}
      GROUP BY weather_condition
      ORDER BY count DESC
    `, queryParams);
    
    // Get burn suitability statistics
    const suitabilityStats = await query(`
      SELECT 
        CASE 
          WHEN temperature BETWEEN 45 AND 85 
            AND humidity BETWEEN 30 AND 70
            AND wind_speed BETWEEN 2 AND 15
            AND weather_condition NOT IN ('Rain', 'Thunderstorm', 'Snow')
          THEN 'suitable'
          WHEN temperature BETWEEN 40 AND 90
            AND humidity BETWEEN 25 AND 80
            AND wind_speed BETWEEN 1 AND 20
            AND weather_condition NOT IN ('Thunderstorm', 'Snow')
          THEN 'marginal'
          ELSE 'unsuitable'
        END as suitability,
        COUNT(*) as count,
        AVG(wind_speed) as avg_wind,
        AVG(humidity) as avg_humidity
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL 3 HOUR)
      ${regionFilter}
      GROUP BY suitability
    `, queryParams);
    
    // Get weather trends
    const trends = await query(`
      SELECT 
        DATE_FORMAT(timestamp, '%H:00') as hour,
        AVG(temperature) as avg_temp,
        AVG(wind_speed) as avg_wind,
        AVG(humidity) as avg_humidity,
        COUNT(*) as readings
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ${regionFilter}
      GROUP BY DATE_FORMAT(timestamp, '%H:00')
      ORDER BY hour
    `, queryParams);
    
    res.json({
      success: true,
      data: {
        region: region || 'all',
        current_conditions: conditionsSummary,
        burn_suitability: suitabilityStats,
        hourly_trends: trends,
        last_updated: new Date(),
        readings_analyzed: conditionsSummary.reduce((sum, c) => sum + c.count, 0)
      }
    });
    
  } catch (error) {
    logger.error('Weather conditions summary failed', { error: error.message });
    throw new DatabaseError('Failed to retrieve weather conditions', error);
  }
}));

/**
 * GET /api/weather/alerts
 * Get weather-based alerts and warnings
 */
router.get('/alerts', asyncHandler(async (req, res) => {
  const { severity, active_only = 'true' } = req.query;
  
  try {
    let whereConditions = ["type LIKE 'weather_%'"];
    let queryParams = [];
    
    if (severity) {
      whereConditions.push('severity = ?');
      queryParams.push(severity);
    }
    
    if (active_only === 'true') {
      whereConditions.push("status IN ('pending', 'active')");
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    const weatherAlerts = await query(`
      SELECT 
        a.id,
        a.type,
        a.title,
        a.message,
        a.severity,
        a.status,
        a.created_at,
        f.name as farm_name,
        f.owner_name
      FROM alerts a
      LEFT JOIN farms f ON a.farm_id = f.id
      ${whereClause}
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        a.created_at DESC
      LIMIT 100
    `, queryParams);
    
    // Categorize alerts
    const alertCategories = {
      wind_warnings: weatherAlerts.filter(a => a.type.includes('wind')),
      precipitation_alerts: weatherAlerts.filter(a => a.type.includes('rain') || a.type.includes('precipitation')),
      temperature_alerts: weatherAlerts.filter(a => a.type.includes('temperature')),
      general_weather: weatherAlerts.filter(a => a.type === 'weather_change'),
      critical_alerts: weatherAlerts.filter(a => a.severity === 'critical')
    };
    
    res.json({
      success: true,
      data: {
        total_alerts: weatherAlerts.length,
        alert_categories: alertCategories,
        filters_applied: {
          severity,
          active_only: active_only === 'true'
        }
      }
    });
    
  } catch (error) {
    logger.error('Weather alerts fetch failed', { error: error.message });
    throw new DatabaseError('Failed to retrieve weather alerts', error);
  }
}));

/**
 * GET /api/weather/statistics
 * Get weather statistics and analytics
 */
router.get('/statistics', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    // Overall statistics
    const overallStats = await query(`
      SELECT 
        COUNT(*) as total_readings,
        COUNT(DISTINCT DATE(timestamp)) as days_covered,
        AVG(temperature) as avg_temperature,
        MIN(temperature) as min_temperature,
        MAX(temperature) as max_temperature,
        AVG(humidity) as avg_humidity,
        AVG(wind_speed) as avg_wind_speed,
        AVG(pressure) as avg_pressure
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);
    
    // Condition distribution
    const conditionDistribution = await query(`
      SELECT 
        weather_condition,
        COUNT(*) as count,
        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM weather_data WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)) as percentage,
        AVG(temperature) as avg_temp_for_condition,
        AVG(wind_speed) as avg_wind_for_condition
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY weather_condition
      ORDER BY count DESC
    `, [days, days]);
    
    // Burn suitability trends
    const suitabilityTrends = await query(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as total_readings,
        COUNT(CASE 
          WHEN temperature BETWEEN 45 AND 85 
            AND humidity BETWEEN 30 AND 70
            AND wind_speed BETWEEN 2 AND 15
            AND weather_condition NOT IN ('Rain', 'Thunderstorm', 'Snow')
          THEN 1 
        END) as suitable_readings,
        AVG(wind_speed) as avg_wind,
        AVG(humidity) as avg_humidity,
        AVG(temperature) as avg_temperature
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `, [days]);
    
    // Vector search statistics
    const vectorStats = await query(`
      SELECT 
        COUNT(*) as vectors_stored,
        COUNT(CASE WHEN weather_pattern_embedding IS NOT NULL THEN 1 END) as vectors_with_embeddings
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);
    
    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        overall_statistics: overallStats[0],
        condition_distribution: conditionDistribution,
        suitability_trends: suitabilityTrends,
        vector_statistics: vectorStats[0],
        analysis_generated_at: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Weather statistics generation failed', { error: error.message });
    throw new DatabaseError('Failed to generate weather statistics', error);
  }
}));

/**
 * POST /api/weather/vector-search
 * Advanced vector search for weather patterns
 */
router.post('/vector-search', asyncHandler(async (req, res) => {
  const { 
    weather_vector, 
    similarity_threshold = 0.7, 
    limit = 20,
    include_metadata = true
  } = req.body;
  
  try {
    if (!weather_vector || !Array.isArray(weather_vector)) {
      throw new ValidationError('weather_vector array is required', 'weather_vector');
    }
    
    if (weather_vector.length !== 128) {
      throw new ValidationError('weather_vector must be 128-dimensional', 'weather_vector');
    }
    
    // Perform vector similarity search
    const searchResults = await vectorSimilaritySearch(
      'weather_data',
      'weather_pattern_embedding',
      weather_vector,
      parseInt(limit),
      parseFloat(similarity_threshold)
    );
    
    // Enrich results with metadata if requested
    let enrichedResults = searchResults;
    if (include_metadata === true && searchResults.length > 0) {
      const ids = searchResults.map(r => r.id);
      const metadata = await query(`
        SELECT 
          wd.id,
          ST_X(wd.location) as lon,
          ST_Y(wd.location) as lat,
          wd.timestamp,
          wd.weather_condition,
          COUNT(br.id) as associated_burns,
          AVG(br.priority_score) as avg_burn_priority
        FROM weather_data wd
        LEFT JOIN burn_requests br ON DATE(wd.timestamp) = DATE(br.burn_date)
        WHERE wd.id IN (${ids.map(() => '?').join(',')})
        GROUP BY wd.id
      `, ids);
      
      enrichedResults = searchResults.map(result => {
        const meta = metadata.find(m => m.id === result.id);
        return {
          ...result,
          metadata: meta || null
        };
      });
    }
    
    res.json({
      success: true,
      data: {
        query_vector_dimensions: weather_vector.length,
        similarity_threshold: parseFloat(similarity_threshold),
        results_found: enrichedResults.length,
        results: enrichedResults
      }
    });
    
  } catch (error) {
    logger.error('Weather vector search failed', { error: error.message });
    throw error;
  }
}));

/**
 * GET /api/weather/agent-status
 * Get weather agent status and health
 */
router.get('/agent-status', asyncHandler(async (req, res) => {
  try {
    const agentStatus = await weatherAgent.getStatus();
    
    res.json({
      success: true,
      data: agentStatus
    });
    
  } catch (error) {
    logger.error('Weather agent status check failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Weather agent status unavailable',
      message: error.message
    });
  }
}));

module.exports = router;