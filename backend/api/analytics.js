const express = require('express');
const { query, vectorSimilaritySearch } = require('../db/connection');
const { asyncHandler, ValidationError, DatabaseError } = require('../middleware/errorHandler');
const logger = require('../middleware/logger');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const analyticsRequestSchema = Joi.object({
  period: Joi.string().valid('24h', '7d', '30d', '90d', '1y').default('30d'),
  metrics: Joi.array().items(Joi.string().valid(
    'burns', 'farms', 'weather', 'conflicts', 'efficiency', 'safety', 'vectors'
  )).default(['burns', 'farms', 'conflicts']),
  region: Joi.string().valid('north_valley', 'central_valley', 'south_valley').optional(),
  include_predictions: Joi.boolean().default(false)
});

/**
 * GET /api/analytics/metrics
 * Get dashboard metrics for real-time display
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  try {
    // Get burn request metrics
    const burnMetrics = await query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_burns,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_burns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_burns,
        COUNT(CASE WHEN requested_date = CURDATE() THEN 1 END) as today_burns,
        COUNT(CASE WHEN requested_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as week_burns,
        SUM(acreage) as total_acreage,
        AVG(priority_score) as avg_priority
      FROM burn_requests
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Get farm metrics
    const farmMetrics = await query(`
      SELECT 
        COUNT(DISTINCT f.farm_id) as active_farms,
        COUNT(DISTINCT bf.field_id) as total_fields,
        SUM(bf.area_hectares) as total_field_area
      FROM farms f
      LEFT JOIN burn_fields bf ON f.farm_id = bf.farm_id
      WHERE f.farm_name NOT LIKE '%Test%' 
        AND f.farm_name NOT LIKE '%Load%'
    `);

    // Get weather suitability metrics
    const weatherMetrics = await query(`
      SELECT 
        COUNT(*) as weather_readings,
        AVG(temperature) as avg_temperature,
        AVG(wind_speed) as avg_wind_speed,
        AVG(humidity) as avg_humidity,
        COUNT(CASE 
          WHEN temperature BETWEEN 45 AND 85 
            AND humidity BETWEEN 30 AND 70
            AND wind_speed BETWEEN 2 AND 15
          THEN 1 
        END) as suitable_conditions
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    // Get alert metrics
    const alertMetrics = await query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as high_alerts,
        COUNT(CASE WHEN delivery_status = 'pending' THEN 1 END) as pending_alerts
      FROM alerts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Get smoke prediction metrics  
    const smokeMetrics = await query(`
      SELECT 
        COUNT(*) as total_predictions,
        AVG(affected_area_km2) as avg_dispersion_radius,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN affected_area_km2 > 10 THEN 1 END) as predictions_with_conflicts
      FROM burn_smoke_predictions
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Calculate burn suitability percentage
    const suitabilityPercentage = weatherMetrics[0].weather_readings > 0 
      ? Math.round((weatherMetrics[0].suitable_conditions / weatherMetrics[0].weather_readings) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        burns: {
          total: burnMetrics[0].total_requests || 0,
          pending: burnMetrics[0].pending_burns || 0,
          approved: burnMetrics[0].approved_burns || 0,
          completed: burnMetrics[0].completed_burns || 0,
          today: burnMetrics[0].today_burns || 0,
          this_week: burnMetrics[0].week_burns || 0,
          total_acreage: Math.round(burnMetrics[0].total_acreage || 0),
          avg_priority: parseFloat(parseFloat(burnMetrics[0].avg_priority || 0).toFixed(2))
        },
        farms: {
          active: farmMetrics[0].active_farms || 0,
          total_fields: farmMetrics[0].total_fields || 0,
          total_area_hectares: Math.round(farmMetrics[0].total_field_area || 0)
        },
        weather: {
          current_temp: Math.round(weatherMetrics[0].avg_temperature || 0),
          avg_wind_speed: parseFloat(parseFloat(weatherMetrics[0].avg_wind_speed || 0).toFixed(1)),
          avg_humidity: Math.round(weatherMetrics[0].avg_humidity || 0),
          suitability_percentage: suitabilityPercentage,
          readings_24h: weatherMetrics[0].weather_readings || 0
        },
        alerts: {
          total: alertMetrics[0].total_alerts || 0,
          critical: alertMetrics[0].critical_alerts || 0,
          high: alertMetrics[0].high_alerts || 0,
          pending: alertMetrics[0].pending_alerts || 0
        },
        smoke: {
          total_predictions: smokeMetrics[0].total_predictions || 0,
          avg_dispersion_km: parseFloat(parseFloat(smokeMetrics[0].avg_dispersion_radius || 0).toFixed(2)),
          avg_confidence: parseFloat(parseFloat(smokeMetrics[0].avg_confidence || 0).toFixed(2)),
          with_conflicts: smokeMetrics[0].predictions_with_conflicts || 0
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve analytics metrics', { error: error.message });
    throw new DatabaseError('Failed to retrieve analytics metrics', error);
  }
}));

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard analytics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { period = '30d', region } = req.query;
  const startTime = Date.now();
  
  try {
    const analytics = {};
    
    // Convert period to days
    const periodDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[period] || 30;
    
    // Region filtering
    let regionFilter = '';
    let regionParams = [];
    if (region) {
      const regions = {
        'north_valley': { minLat: 39.0, maxLat: 40.0, minLon: -122.0, maxLon: -121.0 },
        'central_valley': { minLat: 37.0, maxLat: 39.0, minLon: -122.0, maxLon: -120.0 },
        'south_valley': { minLat: 35.0, maxLat: 37.0, minLon: -121.0, maxLon: -119.0 }
      };
      
      if (regions[region]) {
        const r = regions[region];
        regionFilter = `
          AND ST_X(f.location) BETWEEN ? AND ?
          AND ST_Y(f.location) BETWEEN ? AND ?
        `;
        regionParams = [r.minLon, r.maxLon, r.minLat, r.maxLat];
      }
    }
    
    // 1. Burn Request Analytics
    analytics.burn_requests = await query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        SUM(br.acreage) as total_acres,
        AVG(br.acreage) as avg_acres_per_burn,
        AVG(priority_score) as avg_priority_score,
        COUNT(CASE WHEN priority_score >= 8 THEN 1 END) as high_priority_burns
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      ${regionFilter}
    `, [periodDays, ...regionParams]);
    
    // 2. Farm Activity Analytics
    analytics.farm_activity = await query(`
      SELECT 
        COUNT(DISTINCT f.farm_id) as total_farms,
        COUNT(DISTINCT CASE WHEN br.request_id IS NOT NULL THEN f.farm_id END) as active_farms,
        AVG(f.total_acreage) as avg_farm_size,
        SUM(f.total_acreage) as total_farm_acres,
        COUNT(br.request_id) as total_burn_requests
      FROM farms f
      LEFT JOIN burn_requests br ON f.farm_id = br.farm_id
        AND br.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      -- WHERE f.status = 'active' -- farms table doesn't have status column
      ${regionFilter}
    `, [periodDays, ...regionParams]);
    
    // 3. Weather Impact Analytics
    analytics.weather_impact = await query(`
      SELECT 
        COUNT(*) as total_weather_readings,
        AVG(temperature) as avg_temperature,
        AVG(humidity) as avg_humidity,
        AVG(wind_speed) as avg_wind_speed,
        COUNT(CASE WHEN weather_condition IN ('Clear', 'Clouds') THEN 1 END) as favorable_conditions,
        COUNT(CASE WHEN weather_condition IN ('Rain', 'Thunderstorm', 'Snow') THEN 1 END) as unfavorable_conditions
      FROM weather_data wd
      WHERE wd.timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [periodDays]);
    
    // 4. Conflict Resolution Analytics
    // burn_conflicts table doesn't exist, using schedule_conflicts or default values
    try {
      analytics.conflict_resolution = await query(`
        SELECT 
          COUNT(*) as total_conflicts,
          0 as resolved_conflicts,
          0 as critical_conflicts,
          0 as avg_resolution_time_hours,
          COUNT(*) as smoke_conflicts,
          0 as resource_conflicts
        FROM schedule_conflicts sc
        WHERE sc.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [periodDays]);
    } catch (err) {
      analytics.conflict_resolution = [{
        total_conflicts: 0,
        resolved_conflicts: 0,
        critical_conflicts: 0,
        avg_resolution_time_hours: 0,
        smoke_conflicts: 0,
        resource_conflicts: 0
      }];
    }
    
    // 5. Schedule Optimization Analytics
    analytics.optimization_performance = await query(`
      SELECT 
        COUNT(*) as total_optimizations,
        AVG(optimization_score) as avg_optimization_score,
        MAX(optimization_score) as best_score,
        MIN(optimization_score) as worst_score,
        AVG(total_conflicts) as avg_conflicts_per_schedule,
        COUNT(CASE WHEN optimization_algorithm = 'simulated_annealing' THEN 1 END) as simulated_annealing_count
      FROM schedules s
      WHERE s.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      -- AND s.status = 'active' -- schedules table doesn't have status column
    `, [periodDays]);
    
    // 6. Alert System Analytics
    analytics.alert_system = await query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_alerts,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        AVG(TIMESTAMPDIFF(SECOND, created_at, COALESCE(delivered_at, created_at))) as avg_delivery_time_seconds,
        COUNT(CASE WHEN type = 'smoke_warning' THEN 1 END) as smoke_warnings,
        COUNT(CASE WHEN type = 'conflict_detected' THEN 1 END) as conflict_alerts
      FROM alerts a
      WHERE a.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [periodDays]);
    
    // 7. Vector Operations Analytics
    analytics.vector_operations = await query(`
      SELECT 
        COUNT(CASE WHEN weather_pattern_embedding IS NOT NULL THEN 1 END) as weather_vectors,
        (SELECT COUNT(*) FROM burn_smoke_predictions WHERE plume_vector IS NOT NULL 
         AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)) as smoke_vectors,
        (SELECT COUNT(*) FROM burn_requests WHERE terrain_vector IS NOT NULL 
         AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)) as burn_vectors
      FROM weather_data
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [periodDays, periodDays, periodDays]);
    
    // 8. Daily Trends
    analytics.daily_trends = await query(`
      SELECT 
        DATE(br.created_at) as date,
        COUNT(br.request_id) as burn_requests,
        COUNT(CASE WHEN br.status = 'completed' THEN 1 END) as completed_burns,
        SUM(br.acreage) as acres_requested,
        AVG(br.priority_score) as avg_priority,
        COUNT(DISTINCT br.farm_id) as farms_active,
        (SELECT COUNT(*) FROM alerts WHERE DATE(created_at) = DATE(br.created_at)) as alerts_sent
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      ${regionFilter}
      GROUP BY DATE(br.created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [periodDays, ...regionParams]);
    
    // Calculate key performance indicators
    const kpis = calculateKPIs(analytics);
    
    const duration = Date.now() - startTime;
    
    logger.performance('dashboard_analytics', duration, {
      period,
      region,
      dataPoints: Object.keys(analytics).length
    });
    
    res.json({
      success: true,
      data: {
        period,
        region: region || 'all',
        generated_at: new Date(),
        key_performance_indicators: kpis,
        analytics: {
          burn_requests: analytics.burn_requests[0],
          farm_activity: analytics.farm_activity[0],
          weather_impact: analytics.weather_impact[0],
          conflict_resolution: analytics.conflict_resolution[0],
          optimization_performance: analytics.optimization_performance[0],
          alert_system: analytics.alert_system[0],
          vector_operations: analytics.vector_operations[0]
        },
        trends: analytics.daily_trends,
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Dashboard analytics generation failed', { 
      error: error.message,
      duration: Date.now() - startTime
    });
    throw new DatabaseError('Failed to generate dashboard analytics', error);
  }
}));

/**
 * GET /api/analytics/efficiency
 * Get system efficiency and performance analytics
 */
router.get('/efficiency', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  try {
    const periodDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[period] || 30;
    
    // Agent performance metrics
    const agentPerformance = await analyzeAgentPerformance(periodDays);
    
    // System throughput
    const throughputMetrics = await query(`
      SELECT 
        COUNT(*) / ? as avg_requests_per_day,
        AVG(TIMESTAMPDIFF(SECOND, br.created_at, br.updated_at)) as avg_processing_time_seconds,
        COUNT(CASE WHEN sp.id IS NOT NULL THEN 1 END) / COUNT(*) as prediction_completion_rate,
        COUNT(CASE WHEN si.id IS NOT NULL THEN 1 END) / COUNT(*) as scheduling_completion_rate
      FROM burn_requests br
      LEFT JOIN burn_smoke_predictions sp ON br.request_id = sp.request_id
      LEFT JOIN schedule_items si ON br.request_id = si.burn_request_id
      WHERE br.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [periodDays, periodDays]);
    
    // Error rates and reliability
    const reliabilityMetrics = await query(`
      SELECT 
        'weather_agent' as agent,
        COUNT(*) as total_operations,
        COUNT(CASE WHEN wd.weather_condition IS NULL THEN 1 END) as failed_operations
      FROM burn_requests br
      LEFT JOIN weather_data wd ON DATE(wd.timestamp) = DATE(br.requested_date)
      WHERE br.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      
      UNION ALL
      
      SELECT 
        'predictor_agent' as agent,
        COUNT(*) as total_operations,
        COUNT(CASE WHEN sp.id IS NULL THEN 1 END) as failed_operations
      FROM burn_requests br
      LEFT JOIN burn_smoke_predictions sp ON br.request_id = sp.request_id
      WHERE br.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      
      UNION ALL
      
      SELECT 
        'alerts_agent' as agent,
        COUNT(*) as total_operations,
        COUNT(CASE WHEN a.status = 'failed' THEN 1 END) as failed_operations
      FROM alerts a
      WHERE a.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [periodDays, periodDays, periodDays]);
    
    // Calculate efficiency scores
    const efficiencyScores = {
      overall_system_efficiency: calculateOverallEfficiency(throughputMetrics[0], reliabilityMetrics),
      agent_efficiency: calculateAgentEfficiency(reliabilityMetrics),
      processing_efficiency: calculateProcessingEfficiency(throughputMetrics[0]),
      resource_utilization: await calculateResourceUtilization(periodDays)
    };
    
    res.json({
      success: true,
      data: {
        period,
        efficiency_scores: efficiencyScores,
        agent_performance: agentPerformance,
        throughput_metrics: throughputMetrics[0],
        reliability_metrics: reliabilityMetrics,
        recommendations: generateEfficiencyRecommendations(efficiencyScores, agentPerformance)
      }
    });
    
  } catch (error) {
    logger.error('Efficiency analytics generation failed', { error: error.message });
    throw new DatabaseError('Failed to generate efficiency analytics', error);
  }
}));

/**
 * GET /api/analytics/safety
 * Get safety and compliance analytics
 */
router.get('/safety', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  try {
    const periodDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[period] || 30;
    
    // Air quality compliance
    const airQualityMetrics = await query(`
      SELECT 
        COUNT(*) as total_predictions,
        COUNT(CASE WHEN predicted_pm25 > 35 THEN 1 END) as unhealthy_predictions,
        COUNT(CASE WHEN predicted_pm25 > 150 THEN 1 END) as hazardous_predictions,
        AVG(predicted_pm25) as avg_predicted_pm25,
        MAX(predicted_pm25) as max_predicted_pm25,
        AVG(confidence_score) as avg_prediction_confidence
      FROM burn_smoke_predictions sp
      WHERE sp.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [periodDays]);
    
    // Conflict prevention effectiveness
    // burn_conflicts table doesn't exist, using default values
    const conflictPrevention = [{
      total_conflicts_detected: 0,
      conflicts_resolved: 0,
      critical_conflicts: 0,
      avg_conflict_distance: 0,
      resolved_by_rescheduling: 0,
      resolved_by_time_separation: 0
    }];
    
    // Weather safety compliance
    const weatherSafety = await query(`
      SELECT 
        COUNT(*) as weather_analyses,
        COUNT(CASE WHEN JSON_EXTRACT(suitability_analysis, '$.overallScore') >= 7 THEN 1 END) as safe_conditions,
        COUNT(CASE WHEN JSON_EXTRACT(suitability_analysis, '$.overallScore') < 5 THEN 1 END) as unsafe_conditions,
        AVG(JSON_EXTRACT(suitability_analysis, '$.overallScore')) as avg_safety_score
      FROM weather_data wd
      WHERE wd.timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
      AND suitability_analysis IS NOT NULL
    `, [periodDays]);
    
    // Emergency response analytics
    const emergencyMetrics = await query(`
      SELECT 
        COUNT(*) as total_emergency_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(acknowledged_at, created_at))) as avg_response_time_minutes,
        COUNT(CASE WHEN type = 'emergency_stop' THEN 1 END) as emergency_stops,
        COUNT(CASE WHEN type = 'smoke_warning' AND severity = 'critical' THEN 1 END) as critical_smoke_warnings
      FROM alerts a
      WHERE a.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      AND (a.type LIKE '%emergency%' OR a.severity = 'critical')
    `, [periodDays]);
    
    // Calculate safety scores
    const safetyScores = {
      air_quality_compliance: calculateAirQualityScore(airQualityMetrics[0]),
      conflict_prevention_score: calculateConflictPreventionScore(conflictPrevention[0]),
      weather_safety_score: calculateWeatherSafetyScore(weatherSafety[0]),
      emergency_response_score: calculateEmergencyResponseScore(emergencyMetrics[0]),
      overall_safety_score: 0
    };
    
    safetyScores.overall_safety_score = (
      safetyScores.air_quality_compliance +
      safetyScores.conflict_prevention_score +
      safetyScores.weather_safety_score +
      safetyScores.emergency_response_score
    ) / 4;
    
    res.json({
      success: true,
      data: {
        period,
        safety_scores: safetyScores,
        air_quality_metrics: airQualityMetrics[0],
        conflict_prevention: conflictPrevention[0],
        weather_safety: weatherSafety[0],
        emergency_metrics: emergencyMetrics[0],
        compliance_status: assessComplianceStatus(safetyScores),
        safety_recommendations: generateSafetyRecommendations(safetyScores)
      }
    });
    
  } catch (error) {
    logger.error('Safety analytics generation failed', { error: error.message });
    throw new DatabaseError('Failed to generate safety analytics', error);
  }
}));

/**
 * GET /api/analytics/predictions
 * Get prediction accuracy and model performance analytics
 */
router.get('/predictions', asyncHandler(async (req, res) => {
  const { period = '30d', model_type = 'all' } = req.query;
  
  try {
    const periodDays = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[period] || 30;
    
    // Smoke prediction accuracy
    const smokePredictionAccuracy = await query(`
      SELECT 
        COUNT(*) as total_predictions,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN confidence_score >= 0.8 THEN 1 END) as high_confidence_predictions,
        AVG(max_dispersion_radius) as avg_dispersion_radius,
        COUNT(CASE WHEN predicted_pm25 > 35 THEN 1 END) as air_quality_exceedances
      FROM burn_smoke_predictions sp
      WHERE sp.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [periodDays]);
    
    // Weather prediction accuracy
    const weatherPredictionAccuracy = await query(`
      SELECT 
        COUNT(*) as total_weather_analyses,
        AVG(JSON_EXTRACT(suitability_analysis, '$.overallScore')) as avg_suitability_score,
        COUNT(CASE WHEN JSON_EXTRACT(suitability_analysis, '$.overallScore') >= 7 THEN 1 END) as favorable_predictions,
        COUNT(*) as weather_vectors_generated
      FROM weather_data wd
      WHERE wd.timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
      AND suitability_analysis IS NOT NULL
    `, [periodDays]);
    
    // Model performance comparison
    const modelComparison = await compareModelPerformance(periodDays);
    
    // Vector similarity analysis
    const vectorAnalysis = await analyzeVectorPerformance(periodDays);
    
    res.json({
      success: true,
      data: {
        period,
        smoke_prediction_accuracy: smokePredictionAccuracy[0],
        weather_prediction_accuracy: weatherPredictionAccuracy[0],
        model_comparison: modelComparison,
        vector_analysis: vectorAnalysis,
        prediction_quality_score: calculatePredictionQualityScore(
          smokePredictionAccuracy[0],
          weatherPredictionAccuracy[0]
        )
      }
    });
    
  } catch (error) {
    logger.error('Prediction analytics generation failed', { error: error.message });
    throw new DatabaseError('Failed to generate prediction analytics', error);
  }
}));

/**
 * POST /api/analytics/custom
 * Generate custom analytics based on specific parameters
 */
router.post('/custom', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { error, value } = analyticsRequestSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid analytics request', 'body', error.details);
    }
    
    const { period, metrics, region, include_predictions } = value;
    
    const customAnalytics = {};
    
    // Execute requested metrics
    for (const metric of metrics) {
      switch (metric) {
        case 'burns':
          customAnalytics.burns = await getBurnMetrics(period, region);
          break;
        case 'farms':
          customAnalytics.farms = await getFarmMetrics(period, region);
          break;
        case 'weather':
          customAnalytics.weather = await getWeatherMetrics(period, region);
          break;
        case 'conflicts':
          customAnalytics.conflicts = await getConflictMetrics(period, region);
          break;
        case 'efficiency':
          customAnalytics.efficiency = await getEfficiencyMetrics(period, region);
          break;
        case 'safety':
          customAnalytics.safety = await getSafetyMetrics(period, region);
          break;
        case 'vectors':
          customAnalytics.vectors = await getVectorMetrics(period, region);
          break;
      }
    }
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        request_parameters: { period, metrics, region, include_predictions },
        analytics: customAnalytics,
        processing_time_ms: duration,
        generated_at: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Custom analytics generation failed', { 
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}));

/**
 * GET /api/analytics/reports/summary
 * Generate comprehensive system summary report
 */
router.get('/reports/summary', asyncHandler(async (req, res) => {
  const { format = 'json' } = req.query;
  const startTime = Date.now();
  
  try {
    // Generate comprehensive report
    const report = {
      report_metadata: {
        generated_at: new Date(),
        report_type: 'system_summary',
        coverage_period: '30 days',
        format
      },
      executive_summary: await generateExecutiveSummary(),
      system_health: await assessSystemHealth(),
      performance_metrics: await getPerformanceMetrics(),
      safety_compliance: await getSafetyCompliance(),
      operational_insights: await getOperationalInsights(),
      recommendations: await generateSystemRecommendations()
    };
    
    const duration = Date.now() - startTime;
    
    logger.performance('summary_report_generation', duration, {
      format,
      reportSections: Object.keys(report).length
    });
    
    if (format === 'json') {
      res.json({
        success: true,
        data: report
      });
    } else {
      // Could support other formats like PDF, CSV in the future
      res.status(400).json({
        success: false,
        error: 'Only JSON format is currently supported'
      });
    }
    
  } catch (error) {
    logger.error('Summary report generation failed', { 
      error: error.message,
      duration: Date.now() - startTime
    });
    throw new DatabaseError('Failed to generate summary report', error);
  }
}));

// Helper methods for analytics calculations
function calculateKPIs(analytics) {
  const burnData = analytics.burn_requests[0] || {};
  const farmData = analytics.farm_activity[0] || {};
  const conflictData = analytics.conflict_resolution[0] || {};
  const alertData = analytics.alert_system[0] || {};
  
  return {
    burn_completion_rate: burnData.total_requests > 0 ? 
      (burnData.completed || 0) / burnData.total_requests : 0,
    farm_engagement_rate: farmData.total_farms > 0 ? 
      (farmData.active_farms || 0) / farmData.total_farms : 0,
    conflict_resolution_rate: conflictData.total_conflicts > 0 ?
      (conflictData.resolved_conflicts || 0) / conflictData.total_conflicts : 1,
    alert_success_rate: alertData.total_alerts > 0 ?
      (alertData.sent_alerts || 0) / alertData.total_alerts : 1,
    avg_priority_score: burnData.avg_priority_score || 0,
    safety_compliance_score: calculateSafetyComplianceScore(analytics)
  };
}

function calculateSafetyComplianceScore(analytics) {
  // Simplified safety compliance calculation
  const weatherData = analytics.weather_impact[0] || {};
  const conflictData = analytics.conflict_resolution[0] || {};
  
  let score = 1.0;
  
  // Reduce score for unfavorable weather usage
  if (weatherData.total_weather_readings > 0) {
    const unfavorableRatio = (weatherData.unfavorable_conditions || 0) / weatherData.total_weather_readings;
    score -= unfavorableRatio * 0.3;
  }
  
  // Reduce score for unresolved conflicts
  if (conflictData.total_conflicts > 0) {
    const unresolvedRatio = 1 - ((conflictData.resolved_conflicts || 0) / conflictData.total_conflicts);
    score -= unresolvedRatio * 0.4;
  }
  
  return Math.max(0, Math.min(1, score));
}

async function analyzeAgentPerformance(periodDays) {
  try {
    // This would analyze performance logs for each agent
    // For now, return simulated metrics based on database activity
    
    const agentMetrics = {
      coordinator: await getCoordinatorMetrics(periodDays),
      weather: await getWeatherAgentMetrics(periodDays),
      predictor: await getPredictorMetrics(periodDays),
      optimizer: await getOptimizerMetrics(periodDays),
      alerts: await getAlertsMetrics(periodDays)
    };
    
    return agentMetrics;
    
  } catch (error) {
    logger.warn('Agent performance analysis failed', { error: error.message });
    return {};
  }
}

async function getCoordinatorMetrics(periodDays) {
  const metrics = await query(`
    SELECT 
      COUNT(*) as requests_processed,
      AVG(priority_score) as avg_priority_assigned,
      COUNT(CASE WHEN terrain_vector IS NOT NULL THEN 1 END) as vectors_generated
    FROM burn_requests
    WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [periodDays]);
  
  return {
    name: 'coordinator',
    requests_processed: metrics[0].requests_processed,
    avg_priority_assigned: metrics[0].avg_priority_assigned,
    vectors_generated: metrics[0].vectors_generated,
    success_rate: 0.98 // Would be calculated from actual logs
  };
}

async function getWeatherAgentMetrics(periodDays) {
  const metrics = await query(`
    SELECT 
      COUNT(*) as weather_analyses,
      COUNT(CASE WHEN weather_pattern_embedding IS NOT NULL THEN 1 END) as vectors_generated,
      AVG(temperature) as avg_temperature_analyzed
    FROM weather_data
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [periodDays]);
  
  return {
    name: 'weather',
    analyses_performed: metrics[0].weather_analyses,
    vectors_generated: metrics[0].vectors_generated,
    success_rate: 0.95
  };
}

async function getPredictorMetrics(periodDays) {
  const metrics = await query(`
    SELECT 
      COUNT(*) as predictions_made,
      AVG(confidence_score) as avg_confidence,
      COUNT(CASE WHEN plume_vector IS NOT NULL THEN 1 END) as vectors_generated
    FROM burn_smoke_predictions
    WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [periodDays]);
  
  return {
    name: 'predictor',
    predictions_made: metrics[0].predictions_made,
    avg_confidence: metrics[0].avg_confidence,
    vectors_generated: metrics[0].vectors_generated,
    success_rate: 0.92
  };
}

async function getOptimizerMetrics(periodDays) {
  const metrics = await query(`
    SELECT 
      COUNT(*) as optimizations_run,
      AVG(optimization_score) as avg_optimization_score,
      AVG(total_conflicts) as avg_conflicts_handled
    FROM schedules
    WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [periodDays]);
  
  return {
    name: 'optimizer',
    optimizations_run: metrics[0].optimizations_run,
    avg_score: metrics[0].avg_optimization_score,
    avg_conflicts_handled: metrics[0].avg_conflicts_handled,
    success_rate: 0.89
  };
}

async function getAlertsMetrics(periodDays) {
  const metrics = await query(`
    SELECT 
      COUNT(*) as alerts_sent,
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful_deliveries,
      AVG(TIMESTAMPDIFF(SECOND, created_at, COALESCE(delivered_at, created_at))) as avg_delivery_time
    FROM alerts
    WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [periodDays]);
  
  return {
    name: 'alerts',
    alerts_sent: metrics[0].alerts_sent,
    successful_deliveries: metrics[0].successful_deliveries,
    avg_delivery_time: metrics[0].avg_delivery_time,
    success_rate: metrics[0].alerts_sent > 0 ? 
      metrics[0].successful_deliveries / metrics[0].alerts_sent : 1
  };
}

function calculateOverallEfficiency(throughput, reliability) {
  // Calculate system efficiency based on throughput and reliability
  const throughputScore = throughput.avg_requests_per_day > 5 ? 1 : throughput.avg_requests_per_day / 5;
  const reliabilityScore = calculateAgentEfficiency(reliability);
  
  return (throughputScore + reliabilityScore) / 2;
}

function calculateAgentEfficiency(reliabilityMetrics) {
  if (reliabilityMetrics.length === 0) return 1;
  
  const efficiencyScores = reliabilityMetrics.map(metric => {
    if (metric.total_operations === 0) return 1;
    return 1 - (metric.failed_operations / metric.total_operations);
  });
  
  return efficiencyScores.reduce((sum, score) => sum + score, 0) / efficiencyScores.length;
}

function calculateProcessingEfficiency(throughputData) {
  if (!throughputData.avg_processing_time_seconds) return 0.8;
  
  // Ideal processing time is under 30 seconds
  const idealTime = 30;
  const actualTime = throughputData.avg_processing_time_seconds;
  
  return actualTime <= idealTime ? 1 : Math.max(0.1, idealTime / actualTime);
}

async function calculateResourceUtilization(periodDays) {
  try {
    const utilization = await query(`
      SELECT 
        (COUNT(DISTINCT si.schedule_id) * 4) as total_time_slots_available,
        COUNT(si.id) as time_slots_used,
        COUNT(DISTINCT DATE(s.schedule_date)) as days_with_schedules
      FROM schedules s
      LEFT JOIN schedule_items si ON s.id = si.schedule_id
      WHERE s.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      -- AND s.status = 'active' -- schedules table doesn't have status column
    `, [periodDays]);
    
    const data = utilization[0];
    return data.total_time_slots_available > 0 ? 
      data.time_slots_used / data.total_time_slots_available : 0;
    
  } catch (error) {
    return 0.5; // Default utilization
  }
}

function generateEfficiencyRecommendations(efficiencyScores, agentPerformance) {
  const recommendations = [];
  
  if (efficiencyScores.overall_system_efficiency < 0.8) {
    recommendations.push({
      category: 'system_performance',
      priority: 'high',
      message: 'System efficiency below optimal - review agent performance and resource allocation'
    });
  }
  
  if (efficiencyScores.processing_efficiency < 0.7) {
    recommendations.push({
      category: 'processing_speed',
      priority: 'medium',
      message: 'Processing times are high - consider optimization of algorithms or database queries'
    });
  }
  
  Object.values(agentPerformance).forEach(agent => {
    if (agent.success_rate < 0.9) {
      recommendations.push({
        category: 'agent_reliability',
        priority: 'medium',
        message: `${agent.name} agent has lower success rate - review error logs and increase monitoring`
      });
    }
  });
  
  return recommendations;
}

/**
 * GET /api/analytics/burn-trends
 * Get burn trends data for charts
 */
router.get('/burn-trends', asyncHandler(async (req, res) => {
  const { range = '30d' } = req.query;
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;
  
  try {
    const trends = await query(`
      SELECT 
        DATE(requested_date) as date,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        SUM(acreage) as acres
      FROM burn_requests
      WHERE requested_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(requested_date)
      ORDER BY date DESC
      LIMIT 30
    `, [days]);
    
    res.json({ success: true, data: trends });
  } catch (error) {
    logger.error('Failed to fetch burn trends', { error: error.message });
    res.json({ success: false, data: [] });
  }
}));

/**
 * GET /api/analytics/weather-patterns
 * Get weather pattern analytics
 */
router.get('/weather-patterns', asyncHandler(async (req, res) => {
  const { range = '30d' } = req.query;
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;
  
  try {
    const patterns = await query(`
      SELECT 
        DAYNAME(timestamp) as day,
        AVG(temperature) as temperature,
        AVG(humidity) as humidity,
        AVG(wind_speed) as windSpeed,
        AVG(air_quality_index) as burnScore
      FROM weather_data
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DAYOFWEEK(timestamp), DAYNAME(timestamp)
      ORDER BY DAYOFWEEK(timestamp)
    `, [days]);
    
    res.json({ success: true, data: patterns });
  } catch (error) {
    logger.error('Failed to fetch weather patterns', { error: error.message });
    res.json({ success: false, data: [] });
  }
}));

/**
 * GET /api/analytics/conflict-analysis
 * Get conflict analysis data
 */
router.get('/conflict-analysis', asyncHandler(async (req, res) => {
  const { range = '30d' } = req.query;
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;
  
  try {
    const conflicts = await query(`
      SELECT 
        conflict_type as type,
        COUNT(*) as count,
        severity
      FROM conflict_analysis
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY conflict_type, severity
      ORDER BY count DESC
    `, [days]);
    
    res.json({ success: true, data: conflicts });
  } catch (error) {
    logger.error('Failed to fetch conflict analysis', { error: error.message });
    res.json({ success: false, data: [] });
  }
}));

/**
 * GET /api/analytics/farm-performance
 * Get farm performance metrics
 */
router.get('/farm-performance', asyncHandler(async (req, res) => {
  const { range = '30d' } = req.query;
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;
  
  try {
    const performance = await query(`
      SELECT 
        f.name,
        COUNT(br.request_id) as requests,
        COUNT(CASE WHEN br.status = 'approved' THEN 1 END) as approved,
        ROUND(COUNT(CASE WHEN br.status = 'approved' THEN 1 END) * 100.0 / NULLIF(COUNT(br.request_id), 0), 2) as efficiency
      FROM farms f
      LEFT JOIN burn_requests br ON f.farm_id = br.farm_id
        AND br.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY f.farm_id, f.name
      HAVING requests > 0
      ORDER BY efficiency DESC
      LIMIT 10
    `, [days]);
    
    res.json({ success: true, data: performance });
  } catch (error) {
    logger.error('Failed to fetch farm performance', { error: error.message });
    res.json({ success: false, data: [] });
  }
}));

/**
 * GET /api/analytics/dashboard-stats
 * Get dashboard statistics
 */
router.get('/dashboard-stats', asyncHandler(async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM burn_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as totalBurns,
        (SELECT COUNT(DISTINCT farm_id) FROM burn_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as activeFarms,
        (SELECT AVG(air_quality_index) FROM weather_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)) as weatherScore,
        (SELECT COUNT(*) FROM alerts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) AND status = 'pending') as alerts,
        (SELECT COUNT(*) FROM burn_requests WHERE status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as completedBurns,
        (SELECT COUNT(*) FROM burn_requests WHERE status = 'approved' AND requested_date >= CURDATE()) as upcomingBurns
    `);
    
    res.json({ 
      success: true, 
      data: stats[0] || {
        totalBurns: 0,
        activeFarms: 0,
        weatherScore: 0,
        alerts: 0,
        completedBurns: 0,
        upcomingBurns: 0
      }
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard stats', { error: error.message });
    res.json({ 
      success: false, 
      data: {
        totalBurns: 0,
        activeFarms: 0,
        weatherScore: 0,
        alerts: 0,
        completedBurns: 0,
        upcomingBurns: 0
      }
    });
  }
}));

/**
 * GET /api/analytics/recent-activity
 * Get recent activity feed
 */
router.get('/recent-activity', asyncHandler(async (req, res) => {
  try {
    const activity = await query(`
      SELECT 
        CONCAT('Burn request ', 
          CASE 
            WHEN br.status = 'approved' THEN 'approved'
            WHEN br.status = 'completed' THEN 'completed'
            WHEN br.status = 'submitted' THEN 'submitted'
            ELSE br.status
          END,
          ' for ', br.field_name
        ) as description,
        f.name as farm,
        DATE_FORMAT(br.created_at, '%H:%i') as time
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY br.created_at DESC
      LIMIT 10
    `);
    
    res.json({ success: true, data: activity });
  } catch (error) {
    logger.error('Failed to fetch recent activity', { error: error.message });
    res.json({ success: false, data: [] });
  }
}));

// Additional helper functions that need implementation
function calculateAirQualityScore(metrics) {
  if (!metrics) return 0.5;
  const unhealthyRatio = metrics.total_predictions > 0 
    ? metrics.unhealthy_predictions / metrics.total_predictions 
    : 0;
  return Math.max(0, 1 - unhealthyRatio);
}

function calculateConflictPreventionScore(conflicts) {
  if (!conflicts || conflicts.total_conflicts === 0) return 1;
  return conflicts.resolved_conflicts / conflicts.total_conflicts;
}

function calculateWeatherSafetyScore(weather) {
  if (!weather || weather.weather_analyses === 0) return 0.5;
  return weather.safe_conditions / weather.weather_analyses;
}

function calculateEmergencyResponseScore(emergency) {
  if (!emergency || emergency.total_emergency_alerts === 0) return 1;
  const responseScore = Math.max(0, 1 - (emergency.avg_response_time_minutes / 60));
  return responseScore;
}

function assessComplianceStatus(scores) {
  const overall = scores.overall_safety_score || 0;
  if (overall >= 0.9) return 'excellent';
  if (overall >= 0.7) return 'good';
  if (overall >= 0.5) return 'needs_improvement';
  return 'critical';
}

function generateSafetyRecommendations(scores) {
  const recommendations = [];
  if (scores.air_quality_compliance < 0.7) {
    recommendations.push('Improve smoke prediction models');
  }
  if (scores.weather_safety_score < 0.8) {
    recommendations.push('Enhance weather monitoring');
  }
  return recommendations;
}

async function compareModelPerformance(periodDays) {
  return {
    gaussian_plume: { accuracy: 0.85, predictions_count: 100 },
    simulated_annealing: { efficiency: 0.90, optimizations_count: 50 }
  };
}

async function analyzeVectorPerformance(periodDays) {
  return {
    weather_vectors: { count: 1000, avg_dimension: 128 },
    smoke_vectors: { count: 500, avg_dimension: 64 }
  };
}

function calculatePredictionQualityScore(smokeMetrics, weatherMetrics) {
  const smokeScore = smokeMetrics ? smokeMetrics.avg_confidence || 0.5 : 0.5;
  const weatherScore = weatherMetrics ? weatherMetrics.avg_suitability_score / 10 || 0.5 : 0.5;
  return (smokeScore + weatherScore) / 2;
}

// Placeholder functions for custom analytics
async function getBurnMetrics(period, region) {
  return { total_burns: 100, completed_burns: 85 };
}

async function getFarmMetrics(period, region) {
  return { total_farms: 20, active_farms: 15 };
}

async function getWeatherMetrics(period, region) {
  return { favorable_days: 25, unfavorable_days: 5 };
}

async function getConflictMetrics(period, region) {
  return { total_conflicts: 10, resolved: 8 };
}

async function getEfficiencyMetrics(period, region) {
  return { system_efficiency: 0.85, processing_time: 30 };
}

async function getSafetyMetrics(period, region) {
  return { safety_score: 0.92, incidents: 0 };
}

async function getVectorMetrics(period, region) {
  return { vectors_generated: 1500, vectors_used: 1200 };
}

// Report generation functions
async function generateExecutiveSummary() {
  return {
    period: '30 days',
    total_burns: 100,
    safety_score: 0.92,
    efficiency_score: 0.85
  };
}

async function assessSystemHealth() {
  return {
    status: 'healthy',
    agents_active: 5,
    database_status: 'connected',
    uptime: '99.9%'
  };
}

async function getPerformanceMetrics() {
  return {
    avg_response_time: 250,
    throughput: 100,
    error_rate: 0.01
  };
}

async function getSafetyCompliance() {
  return {
    compliance_score: 0.95,
    violations: 0,
    warnings: 2
  };
}

async function getOperationalInsights() {
  return {
    peak_usage_time: '10:00 AM',
    busiest_day: 'Tuesday',
    most_active_farm: 'Green Acres'
  };
}

async function generateSystemRecommendations() {
  return [
    'Increase monitoring during peak hours',
    'Update smoke prediction models',
    'Optimize database queries'
  ];
}

module.exports = router;