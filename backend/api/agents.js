/**
 * Agent API Routes - Real OpenAI Agents SDK Integration
 * Uses 5-Agent System with proper handoffs
 */

const express = require('express');
const router = express.Router();
const { run } = require('@openai/agents');
const orchestrator = require('../agents-sdk/orchestrator');
const burnRequestAgent = require('../agents-sdk/BurnRequestAgent');
const weatherAnalyst = require('../agents-sdk/WeatherAnalyst');
const conflictResolver = require('../agents-sdk/ConflictResolver');
const scheduleOptimizer = require('../agents-sdk/ScheduleOptimizer');
const proactiveMonitor = require('../agents-sdk/ProactiveMonitor');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Monitoring state
let monitoringState = {
  isRunning: false,
  lastCheck: null,
  checkInterval: null
};

// Helper function to resolve conflicts
async function resolveConflicts(burnDate, conflictData) {
  try {
    const request = `Resolve conflicts for burns scheduled on ${burnDate}. ${conflictData ? `Additional data: ${JSON.stringify(conflictData)}` : ''}`;
    
    const result = await run(conflictResolver, request, {
      context: { burnDate, conflictData }
    });
    
    return {
      success: true,
      resolution: result.finalOutput || 'Conflicts resolved',
      agentUsed: 'ConflictResolver'
    };
  } catch (error) {
    logger.error('Conflict resolution failed', error);
    return { success: false, error: error.message };
  }
}

// Helper function to optimize burn schedule
async function optimizeBurnSchedule(date, burnRequests) {
  try {
    const request = `Optimize burn schedule for ${date}. ${burnRequests ? `Burns to schedule: ${JSON.stringify(burnRequests)}` : ''}`;
    
    const result = await run(scheduleOptimizer, request, {
      context: { date, burnRequests }
    });
    
    return {
      success: true,
      optimizedSchedule: result.finalOutput || 'Schedule optimized',
      agentUsed: 'ScheduleOptimizer'
    };
  } catch (error) {
    logger.error('Schedule optimization failed', error);
    return { success: false, error: error.message };
  }
}

// Helper function to start monitoring
async function startMonitoring(io) {
  if (monitoringState.isRunning) {
    return { message: 'Monitoring already running' };
  }
  
  monitoringState.isRunning = true;
  monitoringState.lastCheck = new Date();
  
  // Run monitoring check every 15 minutes
  monitoringState.checkInterval = setInterval(async () => {
    try {
      const result = await run(proactiveMonitor, 'Perform routine monitoring check', {
        context: { timestamp: new Date() }
      });
      
      monitoringState.lastCheck = new Date();
      
      // Emit alerts via Socket.io if any
      if (result.finalOutput && io) {
        io.emit('monitoring-alert', {
          timestamp: new Date(),
          alerts: result.finalOutput
        });
      }
    } catch (error) {
      logger.error('Monitoring check failed', error);
    }
  }, 15 * 60 * 1000); // 15 minutes
  
  return { message: 'Monitoring started', interval: '15 minutes' };
}

// Helper function to stop monitoring
function stopMonitoring() {
  if (monitoringState.checkInterval) {
    clearInterval(monitoringState.checkInterval);
    monitoringState.checkInterval = null;
  }
  
  monitoringState.isRunning = false;
  return { message: 'Monitoring stopped' };
}

// Helper function to get monitoring status
function getMonitoringStatus() {
  return {
    isRunning: monitoringState.isRunning,
    lastCheck: monitoringState.lastCheck,
    nextCheck: monitoringState.isRunning && monitoringState.lastCheck
      ? new Date(monitoringState.lastCheck.getTime() + 15 * 60 * 1000)
      : null
  };
}

// Helper function to trigger manual check
async function triggerManualCheck() {
  try {
    const result = await run(proactiveMonitor, 'Perform immediate monitoring check - manual trigger', {
      context: { 
        timestamp: new Date(),
        manual: true
      }
    });
    
    monitoringState.lastCheck = new Date();
    
    return {
      success: true,
      results: result.finalOutput || 'Manual check completed',
      timestamp: monitoringState.lastCheck
    };
  } catch (error) {
    logger.error('Manual check failed', error);
    return { success: false, error: error.message };
  }
}

// Helper function to execute full workflow
async function executeFullWorkflow(burnRequest, io) {
  const workflow = {
    timestamp: new Date(),
    stages: []
  };
  
  try {
    // Stage 1: Process burn request
    const stage1 = await run(burnRequestAgent, JSON.stringify(burnRequest), {
      context: { burnRequest }
    });
    workflow.stages.push({ agent: 'BurnRequestAgent', success: true });
    
    // Stage 2: Weather analysis
    const stage2 = await run(weatherAnalyst, `Analyze weather for burn at ${burnRequest.location}`, {
      context: { burnRequest }
    });
    workflow.stages.push({ agent: 'WeatherAnalyst', success: true });
    
    // Stage 3: Conflict detection
    const stage3 = await run(conflictResolver, `Check conflicts for burn on ${burnRequest.burn_date}`, {
      context: { burnRequest }
    });
    workflow.stages.push({ agent: 'ConflictResolver', success: true });
    
    // Stage 4: Schedule optimization
    const stage4 = await run(scheduleOptimizer, `Optimize schedule including new burn`, {
      context: { burnRequest }
    });
    workflow.stages.push({ agent: 'ScheduleOptimizer', success: true });
    
    // Stage 5: Start monitoring
    const stage5 = await run(proactiveMonitor, `Begin monitoring for new burn`, {
      context: { burnRequest }
    });
    workflow.stages.push({ agent: 'ProactiveMonitor', success: true });
    
    workflow.success = true;
    workflow.summary = 'Full workflow executed successfully';
    
    // Emit workflow completion via Socket.io
    if (io) {
      io.emit('workflow-complete', workflow);
    }
    
    return workflow;
  } catch (error) {
    logger.error('Workflow execution failed', error);
    workflow.success = false;
    workflow.error = error.message;
    return workflow;
  }
}

/**
 * POST /api/agents/chat
 * Real OpenAI Agents SDK chat endpoint with orchestrator
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, userId = 'user', conversationId = Date.now().toString() } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    logger.info('Agent chat request', { userId, conversationId, messageLength: message.length });
    const startTime = Date.now();
    
    try {
      // Use OpenAI Agents SDK to run the orchestrator
      const result = await run(orchestrator, message, {
        context: {
          userId,
          conversationId,
          farmId: req.session?.demoFarmId || 1,
          sessionId: req.sessionID
        }
      });
      
      // Extract agent handoffs and tools used from the result
      const toolsUsed = [];
      const agentsInvolved = ['BurnwiseOrchestrator'];
      
      if (result.runItems) {
        result.runItems.forEach(item => {
          if (item.type === 'tool_call') {
            toolsUsed.push(item.name);
          } else if (item.type === 'handoff_call') {
            agentsInvolved.push(item.name);
          }
        });
      }
      
      res.json({
        success: true,
        response: result.finalOutput || 'Request processed successfully',
        toolsUsed,
        agentsInvolved,
        conversationId,
        duration: Date.now() - startTime,
        handoffs: agentsInvolved.length - 1 // Number of agent handoffs
      });
      
    } catch (agentError) {
      logger.warn('Agent processing failed', { error: agentError.message });
      res.json({
        success: false,
        response: 'I encountered an issue processing your request. Please try rephrasing or be more specific.',
        error: agentError.message,
        conversationId,
        duration: Date.now() - startTime
      });
    }
    
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
 * Natural language burn request using BurnRequestAgent
 */
router.post('/burn-request', async (req, res) => {
  try {
    const { text, userId = 'user' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text description is required' });
    }
    
    logger.info('Natural language burn request', { userId, textLength: text.length });
    
    // Use BurnRequestAgent directly for natural language processing
    const result = await run(burnRequestAgent, text, {
      context: {
        userId,
        farmId: req.session?.demoFarmId || 1,
        sessionId: req.sessionID
      }
    });
    
    // Extract structured data and validation from agent result
    const structured = {};
    let burnRequestId = null;
    let validationIssues = [];
    
    if (result.runItems) {
      result.runItems.forEach(item => {
        if (item.type === 'tool_call' && item.name === 'store_burn_request') {
          burnRequestId = item.result?.requestId;
          structured.acres = item.arguments?.acres;
          structured.crop_type = item.arguments?.crop_type;
          structured.burn_date = item.arguments?.burn_date;
        } else if (item.type === 'tool_call' && item.name === 'validate_parameters') {
          validationIssues = item.result?.issues || [];
        }
      });
    }
    
    res.json({
      success: !!burnRequestId,
      burnRequestId,
      structured,
      validation: {
        issues: validationIssues,
        needsApproval: structured.acres > 100
      },
      message: result.finalOutput || `Processed burn request for ${structured.acres || 'unknown'} acres`,
      agentUsed: 'BurnRequestAgent'
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
 * Autonomous weather analysis using WeatherAnalyst agent
 */
router.post('/weather-analysis', async (req, res) => {
  try {
    const { location, burnDate, burnDetails = {} } = req.body;
    
    if (!location || !burnDate) {
      return res.status(400).json({ error: 'Location and burn date are required' });
    }
    
    logger.info('Weather analysis request', { location, burnDate });
    
    // Prepare context for WeatherAnalyst
    const analysisRequest = `Analyze weather conditions for a burn at latitude ${location.lat || 38.544}, longitude ${location.lng || -121.740} on ${burnDate}. Burn details: ${burnDetails.acres || 50} acres of ${burnDetails.crop_type || 'wheat'}.`;
    
    // Use WeatherAnalyst with OpenAI SDK
    const result = await run(weatherAnalyst, analysisRequest, {
      context: {
        burnDate,
        location,
        burnDetails,
        burnRequestId: burnDetails.id || null
      }
    });
    
    // Extract decision and analysis from agent result
    let decision = 'MARGINAL';
    let needsApproval = false;
    let confidence = 75;
    let issues = [];
    
    if (result.runItems) {
      result.runItems.forEach(item => {
        if (item.type === 'tool_call' && item.name === 'analyze_burn_safety') {
          decision = item.result?.decision || 'MARGINAL';
          needsApproval = item.result?.needsApproval || false;
          confidence = item.result?.confidence || 75;
          issues = item.result?.issues || [];
        }
      });
    }
    
    res.json({
      success: true,
      decision,
      requiresApproval: needsApproval,
      analysis: result.finalOutput || 'Weather analysis complete',
      reasons: issues,
      confidence,
      agentUsed: 'WeatherAnalyst'
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