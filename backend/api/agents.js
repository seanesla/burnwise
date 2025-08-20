/**
 * Agent API Routes - Expose 5-agent system to frontend
 * REAL endpoints that trigger REAL agent actions
 */

const express = require('express');
const router = express.Router();
const { processUserRequest, executeFullWorkflow } = require('../agents-sdk/orchestrator');
const { extractBurnRequest, processNaturalLanguageBurnRequest } = require('../agents-sdk/BurnRequestAgent');
const { analyzeWeatherSafety, monitorWeatherChanges } = require('../agents-sdk/WeatherAnalyst');
const { resolveConflicts, mediateFarms } = require('../agents-sdk/ConflictResolver');
const { optimizeBurnSchedule, reoptimizeSchedule } = require('../agents-sdk/ScheduleOptimizer');
const { 
  startMonitoring, 
  stopMonitoring, 
  getMonitoringStatus, 
  triggerManualCheck 
} = require('../agents-sdk/ProactiveMonitor');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

/**
 * POST /api/agents/chat
 * Main chat endpoint for natural language interaction
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, userId = 'user', conversationId = Date.now().toString() } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    logger.info('Agent chat request', { userId, conversationId, messageLength: message.length });
    
    // Process with orchestrator agent (with demo context)
    const demoContext = req.isDemoMode ? {
      isDemo: true,
      sessionId: req.session?.demoSessionId,
      farmId: req.session?.demoFarmId
    } : null;
    
    const result = await processUserRequest(message, userId, conversationId, req.io, demoContext);
    
    res.json({
      success: true,
      response: result.message,
      toolsUsed: result.toolsUsed,
      conversationId,
      duration: result.duration
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
 * Process natural language burn request
 */
router.post('/burn-request', async (req, res) => {
  try {
    const { text, userId = 'user' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text description is required' });
    }
    
    logger.info('Natural language burn request', { userId, textLength: text.length });
    
    // Process with BurnRequestAgent
    const result = await processNaturalLanguageBurnRequest(text, userId, req.io);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Run full 5-agent workflow
    const workflow = await executeFullWorkflow(result.structured, req.io);
    
    res.json({
      success: true,
      burnRequestId: result.burnRequestId,
      structured: result.structured,
      workflow: {
        weatherDecision: workflow.weather?.decision,
        conflictsFound: workflow.prediction?.conflicts?.length || 0,
        scheduled: workflow.optimization?.success || false
      },
      message: result.message
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
 * Analyze weather safety for a burn
 */
router.post('/weather-analysis', async (req, res) => {
  try {
    const { location, burnDate, burnDetails = {} } = req.body;
    
    if (!location || !burnDate) {
      return res.status(400).json({ error: 'Location and burn date are required' });
    }
    
    logger.info('Weather analysis request', { location, burnDate });
    
    // Analyze with WeatherAnalyst, pass Socket.io for approval events
    const analysis = await analyzeWeatherSafety(location, burnDate, burnDetails, req.io);
    
    res.json({
      success: true,
      decision: analysis.decision,
      requiresApproval: analysis.requiresApproval,
      analysis: analysis.analysis,
      reasons: analysis.reasons,
      confidence: analysis.confidence,
      currentWeather: analysis.currentWeather,
      forecast: analysis.forecast
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