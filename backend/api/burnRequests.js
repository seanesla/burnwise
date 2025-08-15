const express = require('express');
const { query } = require('../db/connection');
const { asyncHandler, ValidationError, DatabaseError } = require('../middleware/errorHandler');
const coordinatorAgent = require('../agents/coordinator');
const weatherAgent = require('../agents/weather');
const predictorAgent = require('../agents/predictor');
const optimizerAgent = require('../agents/optimizer');
const alertsAgent = require('../agents/alerts');
const logger = require('../middleware/logger');

const router = express.Router();

/**
 * GET /api/burn-requests
 * Retrieve burn requests with filtering and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    farm_id,
    status,
    date_from,
    date_to,
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'DESC'
  } = req.query;

  try {
    // Build dynamic query
    let whereConditions = [];
    let queryParams = [];
    
    if (farm_id) {
      whereConditions.push('br.farm_id = ?');
      queryParams.push(farm_id);
    }
    
    if (status) {
      whereConditions.push('br.status = ?');
      queryParams.push(status);
    }
    
    if (date_from) {
      whereConditions.push('br.burn_date >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('br.burn_date <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count - optimized with cache
    const countQuery = `
      SELECT COUNT(*) as total
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      ${whereClause}
    `;
    
    // Cache count queries longer as they change less frequently
    const [{ total }] = await query(countQuery, queryParams, { ttl: 300000 }); // 5 minute cache
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Main query with joins
    const mainQuery = `
      SELECT 
        br.request_id,
        br.farm_id,
        f.farm_name,
        f.owner_name,
        br.field_id,
        NULL as field_boundary,
        br.acreage,
        br.crop_type,
        br.requested_date as burn_date,
        br.requested_window_start as time_window_start,
        br.requested_window_end as time_window_end,
        br.priority_score,
        br.status,
        br.created_at,
        br.updated_at,
        sp.dispersion_radius_km as max_dispersion_radius,
        sp.confidence_score as prediction_confidence
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      LEFT JOIN smoke_predictions sp ON br.request_id = sp.burn_request_id
      ${whereClause}
      ORDER BY br.${sort_by} ${sort_order}
      LIMIT ${parseInt(limit) || 10} OFFSET ${offset || 0}
    `;
    
    // Don't push limit and offset to params array since they're now literals
    // Cache main queries for shorter duration
    const burnRequests = await query(mainQuery, queryParams, { ttl: 60000 }); // 1 minute cache
    
    // Parse GeoJSON field boundaries
    burnRequests.forEach(request => {
      if (request.field_boundary) {
        try {
          request.field_boundary = JSON.parse(request.field_boundary);
        } catch (e) {
          logger.warn('Failed to parse field boundary GeoJSON', { burnRequestId: request.id });
          request.field_boundary = null;
        }
      }
    });
    
    res.json({
      success: true,
      data: burnRequests,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: total,
        items_per_page: parseInt(limit),
        has_next: page < totalPages,
        has_prev: page > 1
      },
      filters_applied: {
        farm_id,
        status,
        date_from,
        date_to
      }
    });
    
  } catch (error) {
    logger.error('Failed to retrieve burn requests', { error: error.message });
    throw new DatabaseError('Failed to retrieve burn requests', error);
  }
}));

/**
 * GET /api/burn-requests/:id
 * Retrieve a specific burn request with full details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const burnRequest = await query(`
      SELECT 
        br.*,
        f.farm_name,
        f.owner_name,
        f.contact_phone as farm_phone,
        f.contact_email as farm_email,
        f.latitude as farm_lat,
        f.longitude as farm_lon
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.request_id = ?
    `, [id]);
    
    if (burnRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Burn request not found'
      });
    }
    
    const request = burnRequest[0];
    
    // Get associated weather data (handle different column names)
    const burnDate = request.burn_date || request.requested_date;
    const startTime = request.time_window_start || request.requested_window_start || '08:00';
    
    const weatherData = burnDate ? await query(`
      SELECT * FROM weather_data
      WHERE DATE(timestamp) = DATE(?)
      ORDER BY ABS(TIMESTAMPDIFF(SECOND, timestamp, CONCAT(?, ' ', ?)))
      LIMIT 1
    `, [burnDate, burnDate, startTime]) : [];
    
    // Get smoke predictions  
    const smokePredictions = await query(`
      SELECT *
      FROM smoke_predictions
      WHERE burn_request_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [id]);
    
    // Get schedule information
    const scheduleInfo = await query(`
      SELECT 
        si.*,
        s.optimization_score,
        s.total_conflicts
      FROM schedule_items si
      JOIN schedules s ON si.schedule_id = s.id
      WHERE si.burn_request_id = ?
      ORDER BY si.created_at DESC
      LIMIT 1
    `, [id]);
    
    // Get related alerts
    const alerts = await query(`
      SELECT alert_type as type, message, severity, status, created_at
      FROM alerts
      WHERE burn_request_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);
    
    res.json({
      success: true,
      data: {
        ...request,
        weather_data: weatherData[0] || null,
        smoke_predictions: smokePredictions[0] || null,
        schedule_info: scheduleInfo[0] || null,
        recent_alerts: alerts
      }
    });
    
  } catch (error) {
    logger.error('Failed to retrieve burn request details', { burnRequestId: id, error: error.message });
    throw new DatabaseError('Failed to retrieve burn request details', error);
  }
}));

/**
 * POST /api/burn-requests
 * Create a new burn request and trigger the 5-agent workflow
 */
router.post('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Creating new burn request', { farmId: req.body.farm_id });
    
    // Transform API fields to match coordinator's expected schema
    // Note: Don't send field_id to coordinator - it handles that internally
    const transformedRequest = {
      farm_id: req.body.farm_id,
      field_name: req.body.field_name || `Field-${req.body.farm_id}`,
      // field_id removed - coordinator handles this
      field_boundary: req.body.field_boundary || {
        type: 'Polygon',
        coordinates: [[[-98.5, 30.2], [-98.5, 30.3], [-98.4, 30.3], [-98.4, 30.2], [-98.5, 30.2]]]
      },
      acres: req.body.acreage || req.body.acres || 50,
      crop_type: req.body.crop_type || 'wheat',
      burn_date: req.body.requested_date || req.body.burn_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time_window_start: req.body.requested_window_start || req.body.time_window_start || '08:00',
      time_window_end: req.body.requested_window_end || req.body.time_window_end || '12:00',
      reason: req.body.reason || 'Agricultural burn'
    };
    
    logger.info('Transformed burn request:', transformedRequest);
    
    // Step 1: Coordinator Agent - Validate and store burn request
    let coordinatorResult;
    try {
      coordinatorResult = await coordinatorAgent.coordinateBurnRequest(transformedRequest);
    } catch (coordError) {
      logger.error('Coordinator validation failed:', coordError);
      return res.status(400).json({
        success: false,
        error: coordError.message || 'Burn request validation failed',
        details: coordError.details || null,
        field: coordError.field || null
      });
    }
    
    if (!coordinatorResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Burn request coordination failed',
        details: coordinatorResult
      });
    }
    
    const burnRequestId = coordinatorResult.burnRequestId;
    
    // Step 2: Weather Agent - Analyze weather conditions
    const farmLocation = await query(`
      SELECT longitude as lon, latitude as lat
      FROM farms WHERE farm_id = ?
    `, [transformedRequest.farm_id]);
    
    if (farmLocation.length === 0) {
      throw new ValidationError('Farm not found', 'farm_id');
    }
    
    const weatherResult = await weatherAgent.analyzeWeatherForBurn(
      burnRequestId,
      farmLocation[0],
      transformedRequest.burn_date,
      {
        start: transformedRequest.time_window_start,
        end: transformedRequest.time_window_end
      }
    );
    
    // Step 3: Predictor Agent - Calculate smoke dispersion
    const predictionResult = await predictorAgent.predictSmokeDispersion(
      burnRequestId,
      transformedRequest,
      weatherResult.currentWeather
    );
    
    // Step 4: Check if immediate scheduling is needed
    let optimizationResult = null;
    const burnDate = new Date(transformedRequest.burn_date);
    const today = new Date();
    const daysUntilBurn = (burnDate - today) / (1000 * 60 * 60 * 24);
    
    if (daysUntilBurn <= 7) {
      // Step 4: Optimizer Agent - Schedule optimization for near-term burns
      const allBurnRequests = await query(`
        SELECT * FROM burn_requests
        WHERE requested_date = ? AND status IN ('pending', 'approved')
      `, [transformedRequest.burn_date]);
      
      optimizationResult = await optimizerAgent.optimizeSchedule(
        transformedRequest.burn_date,
        allBurnRequests,
        weatherResult.currentWeather,
        [predictionResult]
      );
    }
    
    // Step 5: Alerts Agent - Send notifications
    const io = req.app.get('io');
    
    // Enhanced real-time broadcasts for all connected clients
    io.emit('burn_request_created', {
      burnRequestId,
      farmId: transformedRequest.farm_id,
      fieldName: transformedRequest.field_name,
      status: 'processing',
      timestamp: new Date().toISOString()
    });
    
    io.emit('weather_analyzed', {
      burnRequestId,
      weatherScore: weatherResult.weatherScore,
      conditions: weatherResult.currentWeather,
      timestamp: new Date().toISOString()
    });
    
    io.emit('smoke_predicted', {
      burnRequestId,
      maxDispersionRadius: predictionResult.maxDispersionRadius,
      conflictsDetected: predictionResult.conflicts?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    if (optimizationResult) {
      io.emit('schedule_optimized', {
        burnRequestId,
        scheduled: optimizationResult.schedule?.items?.length > 0,
        optimizationScore: optimizationResult.metrics?.overallScore,
        timestamp: new Date().toISOString()
      });
    }
    
    const alertResult = await alertsAgent.processAlert({
      type: 'schedule_change',
      farm_id: transformedRequest.farm_id,
      burn_request_id: burnRequestId,
      title: 'New Burn Request Submitted',
      message: `Burn request for ${transformedRequest.field_name} has been submitted and processed`,
      severity: 'medium',
      data: {
        farmId: transformedRequest.farm_id,
        fieldName: transformedRequest.field_name,
        acres: transformedRequest.acres,
        burnDate: transformedRequest.burn_date
      }
    }, optimizationResult, io);
    
    // Update burn request status
    await query(`
      UPDATE burn_requests 
      SET status = ?
      WHERE request_id = ?
    `, [predictionResult.conflicts && predictionResult.conflicts.length > 0 ? 'pending' : 'approved', burnRequestId]);
    
    const totalDuration = Date.now() - startTime;
    
    logger.performance('complete_5_agent_workflow', totalDuration, {
      burnRequestId,
      workflowSteps: {
        coordinator: coordinatorResult.success,
        weather: weatherResult.success,
        predictor: predictionResult.success,
        optimizer: optimizationResult ? optimizationResult.success : 'skipped',
        alerts: alertResult.success
      }
    });
    
    res.status(201).json({
      success: true,
      message: '5-Agent workflow completed successfully',
      data: {
        burn_request_id: burnRequestId,
        priority_score: coordinatorResult.priorityScore,
        weather_analysis: {
          suitability_score: weatherResult.suitabilityAnalysis.overallScore,
          confidence: weatherResult.confidence
        },
        smoke_prediction: {
          max_dispersion_radius: predictionResult.maxDispersionRadius,
          conflicts_detected: predictionResult.conflicts.length,
          confidence: predictionResult.confidenceScore
        },
        schedule_optimization: optimizationResult ? {
          scheduled: optimizationResult.success,
          optimization_score: optimizationResult.metrics?.overallScore || null
        } : null,
        alerts_sent: alertResult.recipients
      },
      workflow_performance: {
        total_duration_ms: totalDuration,
        agent_sequence: ['coordinator', 'weather', 'predictor', 'optimizer', 'alerts']
      }
    });
    
  } catch (error) {
    logger.error('5-agent workflow failed', { 
      error: error.message,
      duration: Date.now() - startTime,
      requestData: req.body
    });
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message,
        field: error.field,
        details: error.details
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Burn request processing failed',
        message: error.message
      });
    }
  }
}));

/**
 * PUT /api/burn-requests/:id
 * Update an existing burn request and re-trigger relevant agents
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();
  
  try {
    // Check if burn request exists
    const existingRequest = await query(`
      SELECT * FROM burn_requests WHERE id = ?
    `, [id]);
    
    if (existingRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Burn request not found'
      });
    }
    
    const originalRequest = existingRequest[0];
    
    // Validate update data
    const coordinatorResult = await coordinatorAgent.coordinateBurnRequest(req.body);
    
    // Check what changed to determine which agents to re-run
    const significantChanges = this.detectSignificantChanges(originalRequest, req.body);
    
    let reprocessResults = {};
    
    // Re-run weather analysis if date or location changed
    if (significantChanges.weather) {
      const farmLocation = await query(`
        SELECT ST_X(location) as lon, ST_Y(location) as lat
        FROM farms WHERE id = ?
      `, [req.body.farm_id]);
      
      reprocessResults.weather = await weatherAgent.analyzeWeatherForBurn(
        id,
        farmLocation[0],
        req.body.burn_date,
        { start: req.body.time_window_start, end: req.body.time_window_end }
      );
    }
    
    // Re-run smoke prediction if weather or field changed
    if (significantChanges.prediction) {
      reprocessResults.prediction = await predictorAgent.predictSmokeDispersion(
        id,
        req.body,
        reprocessResults.weather?.currentWeather || originalRequest
      );
    }
    
    // Re-run optimization if schedule-affecting changes
    if (significantChanges.schedule) {
      const allBurnRequests = await query(`
        SELECT * FROM burn_requests
        WHERE burn_date = ? AND status IN ('pending', 'approved')
      `, [req.body.burn_date]);
      
      reprocessResults.optimization = await optimizerAgent.optimizeSchedule(
        req.body.burn_date,
        allBurnRequests,
        reprocessResults.weather?.currentWeather || originalRequest,
        reprocessResults.prediction ? [reprocessResults.prediction] : []
      );
    }
    
    // Send update notifications
    const io = req.app.get('io');
    reprocessResults.alerts = await alertsAgent.processAlert({
      type: 'burn_request_updated',
      farm_id: req.body.farm_id,
      burn_request_id: id,
      title: 'Burn Request Updated',
      message: `Burn request for ${req.body.field_name} has been updated`,
      severity: 'medium',
      data: {
        changes: significantChanges,
        fieldName: req.body.field_name
      }
    }, reprocessResults.optimization, io);
    
    const duration = Date.now() - startTime;
    
    logger.performance('burn_request_update', duration, {
      burnRequestId: id,
      changesDetected: Object.keys(significantChanges).filter(k => significantChanges[k]),
      agentsReprocessed: Object.keys(reprocessResults)
    });
    
    res.json({
      success: true,
      message: 'Burn request updated successfully',
      data: {
        burn_request_id: id,
        changes_detected: significantChanges,
        reprocessing_results: reprocessResults
      },
      processing_time_ms: duration
    });
    
  } catch (error) {
    logger.error('Burn request update failed', { 
      burnRequestId: id,
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}));

/**
 * DELETE /api/burn-requests/:id
 * Cancel a burn request
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    // Check if burn request exists and can be cancelled
    const burnRequest = await query(`
      SELECT br.*, f.farm_name, f.owner_name
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.request_id = ?
    `, [id]);
    
    if (burnRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Burn request not found'
      });
    }
    
    const request = burnRequest[0];
    
    if (request.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel completed burn request'
      });
    }
    
    // Update status to cancelled
    await query(`
      UPDATE burn_requests 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ?
    `, [id]);
    
    // Remove from any existing schedules
    await query(`
      DELETE FROM schedule_items 
      WHERE burn_request_id = ?
    `, [id]);
    
    // Send cancellation notifications
    const io = req.app.get('io');
    await alertsAgent.processAlert({
      type: 'burn_cancelled',
      farm_id: request.farm_id,
      burn_request_id: id,
      title: 'Burn Request Cancelled',
      message: `Burn request for ${request.field_name} has been cancelled`,
      severity: 'medium',
      data: {
        farmName: request.farm_name,
        fieldName: request.field_name,
        reason: reason || 'No reason provided'
      }
    }, null, io);
    
    logger.info('Burn request cancelled', {
      burnRequestId: id,
      farmId: request.farm_id,
      reason
    });
    
    res.json({
      success: true,
      message: 'Burn request cancelled successfully',
      data: {
        burn_request_id: id,
        previous_status: request.status,
        cancellation_reason: reason
      }
    });
    
  } catch (error) {
    logger.error('Burn request cancellation failed', { 
      burnRequestId: id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/burn-requests/:id/workflow-status
 * Get the status of the 5-agent workflow for a specific burn request
 */
router.get('/:id/workflow-status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get burn request
    const burnRequest = await query(`
      SELECT * FROM burn_requests WHERE id = ?
    `, [id]);
    
    if (burnRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Burn request not found'
      });
    }
    
    // Check each agent's processing status
    const workflowStatus = {
      burn_request_id: id,
      overall_status: burnRequest[0].status,
      agent_status: {
        coordinator: { completed: true, timestamp: burnRequest[0].created_at },
        weather: { completed: false },
        predictor: { completed: false },
        optimizer: { completed: false },
        alerts: { completed: false }
      },
      completion_percentage: 20 // Coordinator completed
    };
    
    // Check weather analysis
    const weatherData = await query(`
      SELECT created_at FROM weather_data
      WHERE DATE(timestamp) = DATE(?)
      LIMIT 1
    `, [burnRequest[0].burn_date]);
    
    if (weatherData.length > 0) {
      workflowStatus.agent_status.weather = {
        completed: true,
        timestamp: weatherData[0].created_at
      };
      workflowStatus.completion_percentage = 40;
    }
    
    // Check smoke predictions
    const predictions = await query(`
      SELECT created_at FROM smoke_predictions
      WHERE burn_request_id = ?
      LIMIT 1
    `, [id]);
    
    if (predictions.length > 0) {
      workflowStatus.agent_status.predictor = {
        completed: true,
        timestamp: predictions[0].created_at
      };
      workflowStatus.completion_percentage = 60;
    }
    
    // Check optimization
    const scheduleItems = await query(`
      SELECT si.created_at FROM schedule_items si
      WHERE si.burn_request_id = ?
      LIMIT 1
    `, [id]);
    
    if (scheduleItems.length > 0) {
      workflowStatus.agent_status.optimizer = {
        completed: true,
        timestamp: scheduleItems[0].created_at
      };
      workflowStatus.completion_percentage = 80;
    }
    
    // Check alerts
    const alerts = await query(`
      SELECT created_at FROM alerts
      WHERE burn_request_id = ?
      LIMIT 1
    `, [id]);
    
    if (alerts.length > 0) {
      workflowStatus.agent_status.alerts = {
        completed: true,
        timestamp: alerts[0].created_at
      };
      workflowStatus.completion_percentage = 100;
    }
    
    res.json({
      success: true,
      data: workflowStatus
    });
    
  } catch (error) {
    logger.error('Workflow status check failed', { 
      burnRequestId: id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/burn-requests/:id/reprocess
 * Re-trigger the 5-agent workflow for a specific burn request
 */
router.post('/:id/reprocess', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { agents = ['weather', 'predictor', 'optimizer', 'alerts'] } = req.body;
  
  const startTime = Date.now();
  
  try {
    // Get burn request details
    const burnRequest = await query(`
      SELECT br.*, f.farm_name, ST_X(f.location) as lon, ST_Y(f.location) as lat
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.request_id = ?
    `, [id]);
    
    if (burnRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Burn request not found'
      });
    }
    
    const request = burnRequest[0];
    const reprocessResults = {};
    
    // Reprocess selected agents in sequence
    if (agents.includes('weather')) {
      reprocessResults.weather = await weatherAgent.analyzeWeatherForBurn(
        id,
        { lat: request.lat, lon: request.lon },
        request.burn_date,
        { start: request.time_window_start, end: request.time_window_end }
      );
    }
    
    if (agents.includes('predictor')) {
      const weatherData = reprocessResults.weather?.currentWeather || {};
      reprocessResults.predictor = await predictorAgent.predictSmokeDispersion(
        id,
        request,
        weatherData
      );
    }
    
    if (agents.includes('optimizer')) {
      const allBurnRequests = await query(`
        SELECT * FROM burn_requests
        WHERE burn_date = ? AND status IN ('pending', 'approved')
      `, [request.burn_date]);
      
      const weatherData = reprocessResults.weather?.currentWeather || {};
      const predictionData = reprocessResults.predictor ? [reprocessResults.predictor] : [];
      
      reprocessResults.optimizer = await optimizerAgent.optimizeSchedule(
        request.burn_date,
        allBurnRequests,
        weatherData,
        predictionData
      );
    }
    
    if (agents.includes('alerts')) {
      const io = req.app.get('io');
      reprocessResults.alerts = await alertsAgent.processAlert({
        type: 'burn_request_reprocessed',
        farm_id: request.farm_id,
        burn_request_id: id,
        title: 'Burn Request Reprocessed',
        message: `Burn request for ${request.field_name} has been reprocessed`,
        severity: 'medium',
        data: {
          farmName: request.farm_name,
          fieldName: request.field_name,
          agentsReprocessed: agents
        }
      }, reprocessResults.optimizer, io);
    }
    
    const duration = Date.now() - startTime;
    
    logger.performance('workflow_reprocessing', duration, {
      burnRequestId: id,
      agentsReprocessed: agents,
      reprocessingResults: Object.keys(reprocessResults)
    });
    
    res.json({
      success: true,
      message: 'Workflow reprocessing completed',
      data: {
        burn_request_id: id,
        agents_reprocessed: agents,
        results: reprocessResults
      },
      processing_time_ms: duration
    });
    
  } catch (error) {
    logger.error('Workflow reprocessing failed', {
      burnRequestId: id,
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}));

/**
 * GET /api/burn-requests/analytics/summary
 * Get summary analytics for burn requests
 */
router.get('/analytics/summary', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    // Summary statistics
    const summary = await query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        AVG(priority_score) as avg_priority_score,
        SUM(acres) as total_acres
      FROM burn_requests
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);
    
    // Crop type distribution
    const cropDistribution = await query(`
      SELECT 
        crop_type,
        COUNT(*) as count,
        SUM(acres) as total_acres,
        AVG(priority_score) as avg_priority
      FROM burn_requests
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY crop_type
      ORDER BY count DESC
    `, [days]);
    
    // Daily trend
    const dailyTrend = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as requests,
        SUM(acres) as acres,
        AVG(priority_score) as avg_priority
      FROM burn_requests
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);
    
    res.json({
      success: true,
      data: {
        summary: summary[0],
        crop_distribution: cropDistribution,
        daily_trend: dailyTrend,
        period_days: parseInt(days)
      }
    });
    
  } catch (error) {
    logger.error('Analytics summary failed', { error: error.message });
    throw new DatabaseError('Failed to retrieve analytics summary', error);
  }
}));

/**
 * POST /api/burn-requests/detect-conflicts
 * Detect conflicts for burn requests
 */
router.post('/detect-conflicts', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { burn_request_ids, date } = req.body;
    
    // Validate input
    if (!burn_request_ids && !date) {
      throw new ValidationError('Either burn_request_ids or date must be provided', 'input');
    }
    
    let burnRequests;
    
    if (burn_request_ids) {
      // Get specific burn requests
      burnRequests = await query(`
        SELECT br.*, 
               bf.longitude, bf.latitude,
               sp.plume_geometry, sp.max_concentration
        FROM burn_requests br
        JOIN burn_fields bf ON br.field_id = bf.field_id
        LEFT JOIN smoke_predictions sp ON br.request_id = sp.burn_request_id
        WHERE br.request_id IN (${burn_request_ids.map(() => '?').join(',')})
      `, burn_request_ids);
    } else {
      // Get all burn requests for a date
      burnRequests = await query(`
        SELECT br.*, 
               bf.longitude, bf.latitude,
               sp.plume_geometry, sp.max_concentration
        FROM burn_requests br
        JOIN burn_fields bf ON br.field_id = bf.field_id
        LEFT JOIN smoke_predictions sp ON br.request_id = sp.burn_request_id
        WHERE DATE(br.requested_date) = ?
        AND br.status IN ('pending', 'approved')
      `, [date]);
    }
    
    if (burnRequests.length < 2) {
      return res.json({
        success: true,
        conflicts: [],
        message: 'No conflicts detected (less than 2 burns to compare)'
      });
    }
    
    // Detect conflicts using predictor agent
    const conflicts = [];
    
    for (let i = 0; i < burnRequests.length; i++) {
      for (let j = i + 1; j < burnRequests.length; j++) {
        const burn1 = burnRequests[i];
        const burn2 = burnRequests[j];
        
        // Check temporal overlap
        const start1 = new Date(`${burn1.requested_date} ${burn1.requested_window_start}`);
        const end1 = new Date(`${burn1.requested_date} ${burn1.requested_window_end}`);
        const start2 = new Date(`${burn2.requested_date} ${burn2.requested_window_start}`);
        const end2 = new Date(`${burn2.requested_date} ${burn2.requested_window_end}`);
        
        const hasTimeOverlap = (start1 <= end2 && end1 >= start2);
        
        if (hasTimeOverlap) {
          // Calculate smoke overlap using predictor
          const overlapResult = await predictorAgent.detectOverlap(
            burn1,
            burn2,
            { windSpeed: 5, windDirection: 270 } // Use current weather if available
          );
          
          if (overlapResult.hasConflict) {
            conflicts.push({
              burn1_id: burn1.request_id,
              burn2_id: burn2.request_id,
              burn1_farm: burn1.farm_name,
              burn2_farm: burn2.farm_name,
              conflict_type: overlapResult.type,
              severity: overlapResult.severity,
              overlap_area: overlapResult.overlapArea,
              max_pm25: overlapResult.maxConcentration,
              resolution_suggestions: overlapResult.suggestions
            });
          }
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    logger.performance('conflict_detection', duration, {
      burnsAnalyzed: burnRequests.length,
      conflictsFound: conflicts.length
    });
    
    res.json({
      success: true,
      conflicts,
      burns_analyzed: burnRequests.length,
      processing_time_ms: duration
    });
    
  } catch (error) {
    logger.error('Conflict detection failed', { error: error.message });
    throw error;
  }
}));

// Helper method to detect significant changes requiring reprocessing
function detectSignificantChanges(original, updated) {
  const changes = {
    weather: false,
    prediction: false,
    schedule: false
  };
  
  // Changes that require weather reanalysis
  if (original.burn_date !== updated.burn_date ||
      original.time_window_start !== updated.time_window_start ||
      original.time_window_end !== updated.time_window_end) {
    changes.weather = true;
  }
  
  // Changes that require prediction reanalysis
  if (changes.weather ||
      original.acres !== updated.acres ||
      original.crop_type !== updated.crop_type ||
      JSON.stringify(original.field_boundary) !== JSON.stringify(updated.field_boundary)) {
    changes.prediction = true;
  }
  
  // Changes that require schedule optimization
  if (changes.prediction ||
      original.priority_score !== updated.priority_score ||
      original.time_window_start !== updated.time_window_start ||
      original.time_window_end !== updated.time_window_end) {
    changes.schedule = true;
  }
  
  return changes;
}

module.exports = router;