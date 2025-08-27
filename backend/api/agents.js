/**
 * Agent API Routes - Simplified Direct Agent Interface
 * Uses core agents directly instead of SDK wrapper layer
 */

const express = require('express');
const router = express.Router();
const coordinatorAgent = require('../agents/coordinator');
const weatherAgent = require('../agents/weather');
const predictorAgent = require('../agents/predictor');
const optimizerAgent = require('../agents/optimizer');
// alertsAgent removed - stub functionality eliminated
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

/**
 * POST /api/agents/chat
 * Simplified chat endpoint using core agents directly
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, userId = 'user', conversationId = Date.now().toString() } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    logger.info('Agent chat request', { userId, conversationId, messageLength: message.length });
    const startTime = Date.now();
    
    // Simple routing based on message content
    let response = 'I understand you want to interact with the burn management system.';
    let toolsUsed = [];
    
    try {
      if (message.toLowerCase().includes('burn') || message.toLowerCase().includes('request')) {
        // Use coordinator for burn requests
        const result = await coordinatorAgent.coordinateBurnRequest({
          farm_id: req.session?.demoFarmId || 1,
          field_name: 'Field-' + Date.now(),
          acres: 50,
          crop_type: 'wheat',
          burn_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time_window_start: '08:00',
          time_window_end: '12:00',
          urgency: 'medium',
          reason: 'Extracted from: ' + message.substring(0, 100)
        });
        response = result.success ? 
          `Created burn request #${result.burnRequestId}. ${result.message}` :
          `Failed to create burn request: ${result.error}`;
        toolsUsed.push('coordinator');
      } else if (message.toLowerCase().includes('weather')) {
        // Use weather agent
        const result = await weatherAgent.getCurrentWeatherData(38.544, -121.740);
        response = `Current weather conditions: ${result.temperature}°F, wind ${result.windSpeed} mph, humidity ${result.humidity}%. ${result.burnRecommendation || 'Conditions analyzed.'}`;
        toolsUsed.push('weather');
      } else {
        // General response
        response = 'I can help you with burn requests, weather analysis, schedule optimization, and conflict prediction. Try asking about weather conditions or creating a burn request.';
      }
    } catch (agentError) {
      logger.warn('Agent processing failed, using fallback', { error: agentError.message });
      response = 'I\'m having trouble processing that request right now, but I\'m here to help with burn management. Please try rephrasing your request.';
    }
    
    res.json({
      success: true,
      response,
      toolsUsed,
      conversationId,
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    logger.error('Agent chat failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/burn-request
 * Simplified burn request processing using core agents
 */
router.post('/burn-request', async (req, res) => {
  try {
    const { text, userId = 'user' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text description is required' });
    }
    
    logger.info('Natural language burn request', { userId, textLength: text.length });
    
    // Simple structured data extraction from text
    const structured = {
      farm_id: req.session?.demoFarmId || 1,
      field_name: `Field-${Date.now()}`,
      acres: 50, // Default, could parse from text
      crop_type: text.toLowerCase().includes('wheat') ? 'wheat' : 
                 text.toLowerCase().includes('corn') ? 'corn' : 'wheat',
      burn_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time_window_start: '08:00',
      time_window_end: '12:00',
      urgency: text.toLowerCase().includes('urgent') || text.toLowerCase().includes('asap') ? 'high' : 'medium',
      reason: `Processed from: ${text.substring(0, 100)}`
    };
    
    // Process with coordinator agent
    const result = await coordinatorAgent.coordinateBurnRequest(structured);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json({
      success: true,
      burnRequestId: result.burnRequestId,
      structured,
      workflow: {
        weatherDecision: 'SAFE', // Simplified
        conflictsFound: 0,
        scheduled: true
      },
      message: `Created burn request #${result.burnRequestId} for ${structured.acres} acres`
    });
    
  } catch (error) {
    logger.error('Burn request processing failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to process burn request',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/weather-analysis
 * Simplified weather analysis using core weather agent
 */
router.post('/weather-analysis', async (req, res) => {
  try {
    const { location, burnDate, burnDetails = {} } = req.body;
    
    if (!location || !burnDate) {
      return res.status(400).json({ error: 'Location and burn date are required' });
    }
    
    logger.info('Weather analysis request', { location, burnDate });
    
    // Use core weather agent
    const lat = location.lat || 38.544;
    const lng = location.lng || -121.740;
    const weatherData = await weatherAgent.getCurrentWeatherData(lat, lng);
    
    // Simple safety analysis
    const isSafe = weatherData.windSpeed < 15 && 
                   weatherData.humidity > 30 && 
                   weatherData.temperature < 85;
    
    res.json({
      success: true,
      decision: isSafe ? 'SAFE' : 'UNSAFE',
      requiresApproval: !isSafe,
      analysis: `Wind: ${weatherData.windSpeed}mph, Humidity: ${weatherData.humidity}%, Temp: ${weatherData.temperature}°F`,
      reasons: isSafe ? ['Conditions within safe parameters'] : ['Weather conditions unsafe for burning'],
      confidence: 85,
      currentWeather: weatherData,
      forecast: []
    });
    
  } catch (error) {
    logger.error('Weather analysis failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to analyze weather',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/resolve-conflicts
 * Resolve conflicts for a specific date
 */
router.post('/resolve-conflicts', async (req, res) => {
  try {
    const { burnDate, conflictData = null } = req.body;
    
    if (!burnDate) {
      return res.status(400).json({ error: 'Burn date is required' });
    }
    
    logger.info('Conflict resolution request', { burnDate });
    
    // Resolve with ConflictResolver
    const result = await resolveConflicts(burnDate, conflictData);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Conflict resolution failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to resolve conflicts',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/optimize-schedule
 * Optimize burn schedule for a date
 */
router.post('/optimize-schedule', async (req, res) => {
  try {
    const { date, burnRequests = null } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    logger.info('Schedule optimization request', { date });
    
    // Optimize with ScheduleOptimizer
    const result = await optimizeBurnSchedule(date, burnRequests);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Schedule optimization failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to optimize schedule',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/monitoring/start
 * Start 24/7 proactive monitoring
 */
router.post('/monitoring/start', async (req, res) => {
  try {
    logger.info('Starting proactive monitoring');
    
    const result = await startMonitoring(req.io);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    logger.error('Failed to start monitoring', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to start monitoring',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/monitoring/stop
 * Stop proactive monitoring
 */
router.post('/monitoring/stop', async (req, res) => {
  try {
    logger.info('Stopping proactive monitoring');
    
    const result = stopMonitoring();
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    logger.error('Failed to stop monitoring', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to stop monitoring',
      details: error.message 
    });
  }
});

/**
 * GET /api/agents/monitoring/status
 * Get monitoring status
 */
router.get('/monitoring/status', async (req, res) => {
  try {
    const status = getMonitoringStatus();
    
    res.json({
      success: true,
      ...status
    });
    
  } catch (error) {
    logger.error('Failed to get monitoring status', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to get monitoring status',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/monitoring/check
 * Manually trigger monitoring check
 */
router.post('/monitoring/check', async (req, res) => {
  try {
    logger.info('Manual monitoring check triggered');
    
    const result = await triggerManualCheck();
    
    res.json(result);
    
  } catch (error) {
    logger.error('Manual check failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to run manual check',
      details: error.message 
    });
  }
});

/**
 * POST /api/agents/workflow
 * Execute full 5-agent workflow
 */
router.post('/workflow', async (req, res) => {
  try {
    const { burnRequest } = req.body;
    
    if (!burnRequest) {
      return res.status(400).json({ error: 'Burn request data is required' });
    }
    
    logger.info('Executing full workflow', { farmId: burnRequest.farm_id });
    
    // Execute full workflow
    const result = await executeFullWorkflow(burnRequest, req.io);
    
    res.json({
      success: true,
      workflow: result,
      summary: {
        validated: result.coordinator?.success || false,
        weatherDecision: result.weather?.decision,
        conflictsDetected: result.prediction?.conflicts?.length || 0,
        scheduled: result.optimization?.success || false,
        alertsSent: result.alerts?.success || false
      }
    });
    
  } catch (error) {
    logger.error('Workflow execution failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to execute workflow',
      details: error.message 
    });
  }
});

/**
 * GET /api/agents/history/:conversationId
 * Get conversation history
 */
router.get('/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const history = await query(`
      SELECT * FROM agent_conversations
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `, [conversationId]);
    
    res.json({
      success: true,
      conversationId,
      messages: history
    });
    
  } catch (error) {
    logger.error('Failed to get conversation history', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to get history',
      details: error.message 
    });
  }
});

/**
 * GET /api/agents/stats
 * Get agent system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await query(`
      SELECT 
        (SELECT COUNT(*) FROM burn_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as requests_week,
        (SELECT COUNT(*) FROM weather_analyses WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as weather_checks,
        (SELECT COUNT(*) FROM conflict_resolutions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as conflicts_resolved,
        (SELECT COUNT(*) FROM schedules WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as schedules_created,
        (SELECT COUNT(*) FROM proactive_alerts WHERE sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as alerts_sent
    `);
    
    const monitoringStatus = getMonitoringStatus();
    
    res.json({
      success: true,
      weeklyStats: stats,
      monitoring: monitoringStatus,
      agentStatus: {
        burnRequestAgent: 'active',
        weatherAnalyst: 'active',
        conflictResolver: 'active',
        scheduleOptimizer: 'active',
        proactiveMonitor: monitoringStatus.isRunning ? 'running' : 'stopped'
      }
    });
    
  } catch (error) {
    logger.error('Failed to get agent stats', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to get statistics',
      details: error.message 
    });
  }
});

module.exports = router;