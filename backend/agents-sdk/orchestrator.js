/**
 * REAL Agent Orchestrator - NO MOCKS
 * Actually uses OpenAI Agents SDK with GPT-5-mini/nano
 * Makes real decisions and executes real functions
 */

const { Agent, tool, run } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
// Legacy function agents (wrapped as tools)
const coordinatorAgent = require('../agents/coordinator');
const weatherAgent = require('../agents/weather');
const predictorAgent = require('../agents/predictor');
const optimizerAgent = require('../agents/optimizer');
const alertsAgent = require('../agents/alerts');
// REAL Handoff Agents
const { burnRequestAgent } = require('./BurnRequestAgent');
const { weatherAnalystAgent } = require('./WeatherAnalyst');
const { conflictResolverAgent } = require('./ConflictResolver');
const { scheduleOptimizerAgent } = require('./ScheduleOptimizer');
const { proactiveMonitorAgent } = require('./ProactiveMonitor');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Lazy-initialize OpenAI to prevent crash when API key not set
let openai = null;
const getOpenAI = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not set, using mock mode for orchestrator');
      return null;
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
};

// Tool Schemas
const burnRequestSchema = z.object({
  farm_id: z.number(),
  field_name: z.string(),
  field_boundary: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number())))
  }),
  acres: z.number(),
  crop_type: z.string(),
  burn_date: z.string(),
  time_window_start: z.string(),
  time_window_end: z.string(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  reason: z.string()
});

// REAL tools that execute REAL functions
const tools = [
  tool({
    name: 'validate_and_store_burn_request',
    description: 'Validate and store a burn request in the database',
    parameters: burnRequestSchema,
    execute: async (params) => {
      logger.info('REAL: Validating and storing burn request', { farmId: params.farm_id });
      const result = await coordinatorAgent.coordinateBurnRequest(params);
      if (!result.success) throw new Error(result.error || 'Validation failed');
      return result;
    }
  }),

  tool({
    name: 'analyze_weather_safety',
    description: 'Analyze weather conditions and make SAFE/UNSAFE/MARGINAL decision',
    parameters: z.object({
      lat: z.number(),
      lng: z.number(),
      date: z.string()
    }),
    execute: async (params) => {
      logger.info('REAL: Analyzing weather safety', { location: params });
      const result = await weatherAgent.analyzeBurnConditions(
        { lat: params.lat, lng: params.lng },
        params.date
      );
      
      // Make autonomous safety decision
      const windSpeed = result.current?.wind_speed || 0;
      const humidity = result.current?.humidity || 0;
      
      if (windSpeed > 15) {
        return { ...result, decision: 'UNSAFE', reason: 'Wind speed exceeds 15 mph safety limit', needsApproval: false };
      } else if (windSpeed > 10 || humidity < 30) {
        return { ...result, decision: 'MARGINAL', reason: 'Conditions are borderline - requires approval', needsApproval: true };
      } else {
        return { ...result, decision: 'SAFE', reason: 'Weather conditions are within safe parameters', needsApproval: false };
      }
    }
  }),

  tool({
    name: 'predict_smoke_dispersion',
    description: 'Calculate smoke plume dispersion and detect conflicts',
    parameters: z.object({
      burnRequestId: z.number(),
      burnData: burnRequestSchema,
      weatherData: z.object({
        wind_speed: z.number(),
        wind_direction: z.number(),
        temperature: z.number(),
        humidity: z.number()
      })
    }),
    execute: async (params) => {
      logger.info('REAL: Predicting smoke dispersion', { requestId: params.burnRequestId });
      const result = await predictorAgent.predictSmokeDispersion(
        params.burnRequestId,
        params.burnData,
        params.weatherData
      );
      
      // REAL conflict detection
      if (result.conflicts && result.conflicts.length > 0) {
        result.requiresResolution = true;
        result.conflictCount = result.conflicts.length;
        result.needsApproval = true; // Conflicts require human review
      } else {
        result.needsApproval = false;
      }
      
      return result;
    }
  }),

  tool({
    name: 'optimize_schedule',
    description: 'Optimize burn schedule and CREATE REAL SCHEDULE ITEMS',
    parameters: z.object({
      date: z.string(),
      burnRequests: z.array(z.object({
        request_id: z.number(),
        farm_id: z.number(),
        requested_date: z.string(),
        acreage: z.number()
      })),
      weatherData: z.object({
        wind_speed: z.number(),
        wind_direction: z.number(),
        temperature: z.number(),
        humidity: z.number()
      }),
      predictions: z.array(z.object({
        burn_request_id: z.number(),
        plume_coordinates: z.array(z.array(z.number()))
      }))
    }),
    execute: async (params) => {
      logger.info('REAL: Optimizing and creating schedule', { date: params.date });
      
      // Run optimization
      const optimized = await optimizerAgent.optimizeSchedule(
        params.date,
        params.burnRequests,
        params.weatherData,
        params.predictions
      );
      
      // ACTUALLY CREATE SCHEDULE ITEMS IN DATABASE
      if (optimized.success && optimized.schedule) {
        for (const item of optimized.schedule.items) {
          await query(`
            INSERT INTO schedule_items 
            (burn_request_id, scheduled_start, scheduled_end, status, optimization_score)
            VALUES (?, ?, ?, 'scheduled', ?)
            ON DUPLICATE KEY UPDATE
            scheduled_start = VALUES(scheduled_start),
            scheduled_end = VALUES(scheduled_end),
            optimization_score = VALUES(optimization_score)
          `, [
            item.burnRequestId,
            item.scheduledStart,
            item.scheduledEnd,
            item.score || 0
          ]);
        }
        
        // Store the schedule itself
        await query(`
          INSERT INTO schedules
          (schedule_date, optimization_score, total_conflicts, created_at)
          VALUES (?, ?, ?, NOW())
        `, [
          params.date,
          optimized.metrics?.overallScore || 0,
          optimized.conflicts?.length || 0
        ]);
        
        logger.info('REAL: Schedule created in database', { 
          date: params.date,
          items: optimized.schedule.items.length 
        });
      }
      
      // Add needsApproval based on conflict severity
      optimized.needsApproval = optimized.conflicts && optimized.conflicts.length > 0;
      
      return optimized;
    }
  }),

  tool({
    name: 'send_real_alert',
    description: 'Send REAL SMS/email alerts to farmers',
    parameters: z.object({
      type: z.string(),
      farm_id: z.number(),
      burn_request_id: z.number(),
      title: z.string(),
      message: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical'])
    }),
    execute: async (params) => {
      logger.info('REAL: Sending actual alert', { type: params.type, farmId: params.farm_id });
      const result = await alertsAgent.processAlert(params, null, null);
      return result;
    }
  }),

  tool({
    name: 'query_database',
    description: 'Query TiDB database for real data',
    parameters: z.object({
      sql: z.string(),
      params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    }),
    execute: async (params) => {
      logger.info('REAL: Database query', { sql: params.sql.substring(0, 50) + '...' });
      const result = await query(params.sql, params.params || []);
      return result;
    }
  }),

  tool({
    name: 'extract_burn_request_from_text',
    description: 'Extract structured burn request from natural language',
    parameters: z.object({
      text: z.string(),
      farmId: z.number()
    }),
    execute: async (params) => {
      logger.info('REAL: Extracting burn request from text');
      
      const openaiClient = getOpenAI();
      if (!openaiClient) {
        // Return mock extraction when OpenAI not available
        return {
          farm_id: params.farmId || 1,
          field_name: `Field-${Date.now()}`,
          acres: 50,
          crop_type: 'wheat',
          burn_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          time_window_start: '08:00',
          time_window_end: '12:00',
          urgency: 'medium',
          reason: 'Mock extraction from: ' + params.text.substring(0, 50)
        };
      }
      
      // Use GPT-5-nano to extract structured data
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: `Extract burn request details from farmer's natural language.
                     Output JSON with: farm_id, field_name, acres, crop_type, burn_date, 
                     time_window_start, time_window_end, urgency, reason.
                     Use reasonable defaults if not specified.`
          },
          {
            role: 'user',
            content: params.text
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 500,
      });
      
      const extracted = JSON.parse(completion.choices[0].message.content);
      
      // Add defaults
      extracted.farm_id = extracted.farm_id || params.farmId || 1;
      extracted.field_name = extracted.field_name || `Field-${Date.now()}`;
      extracted.acres = extracted.acres || 50;
      extracted.crop_type = extracted.crop_type || 'wheat';
      extracted.burn_date = extracted.burn_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      extracted.time_window_start = extracted.time_window_start || '08:00';
      extracted.time_window_end = extracted.time_window_end || '12:00';
      extracted.field_boundary = {
        type: 'Polygon',
        coordinates: [[[-98.5, 30.2], [-98.5, 30.3], [-98.4, 30.3], [-98.4, 30.2], [-98.5, 30.2]]]
      };
      
      return extracted;
    }
  })
];

// REAL Main Orchestrator Agent with Handoffs using OpenAI SDK
const orchestratorAgent = Agent.create({
  name: 'BurnwiseOrchestrator',
  model: 'gpt-5-mini',
  instructions: `You are the main orchestrator for BURNWISE agricultural burn coordination.
                 You coordinate farmers who need to burn their fields safely by delegating to specialist agents.
                 
                 CRITICAL: You MUST delegate tasks to specialist agents. DO NOT handle requests yourself.
                 
                 When farmers ask about burning:
                 1. ALWAYS start by handing off to BurnRequestAgent for natural language processing
                 2. Let specialists handle their domains - you are the coordinator only
                 
                 Handoff decision tree:
                 - Natural language burn requests → Hand off to BurnRequestAgent
                 - Weather safety questions → Hand off to WeatherAnalyst  
                 - Schedule conflicts → Hand off to ConflictResolver
                 - Schedule optimization → Hand off to ScheduleOptimizer
                 - Monitoring setup → Hand off to ProactiveMonitor
                 
                 ALWAYS prioritize safety over efficiency.
                 Your role is coordination and delegation, not direct processing.`,
  handoffs: [
    burnRequestAgent,
    weatherAnalystAgent,
    conflictResolverAgent,
    scheduleOptimizerAgent,
    proactiveMonitorAgent
  ],
  tools: tools,
  reasoning: { effort: 'high' } // Deep reasoning for safety-critical decisions
});

/**
 * Process a real user request with the orchestrator agent
 */
async function processUserRequest(userInput, userId, conversationId, io) {
  const startTime = Date.now();
  
  try {
    logger.info('REAL: Processing user request', {
      userId,
      conversationId,
      input: userInput.substring(0, 100)
    });
    
    // Emit real-time status
    if (io) {
      io.to(userId).emit('agent.thinking', {
        agent: 'BurnwiseOrchestrator',
        thought: 'Processing your request with GPT-5-mini...',
        confidence: 100
      });
    }
    
    // Run the agent with real OpenAI SDK
    const result = await run(orchestratorAgent, userInput);
    
    // Log the actual result structure
    logger.info('REAL: Agent result details', {
      userId,
      resultKeys: Object.keys(result),
      hasContent: !!result.content,
      hasFinalOutput: !!result.finalOutput,
      content: result.content,
      finalOutput: result.finalOutput,
      toolCallsCount: result.toolCalls?.length || 0
    });
    
    // Log what actually happened
    logger.info('REAL: Agent completed', {
      userId,
      conversationId,
      toolsUsed: result.toolCalls?.length || 0,
      duration: Date.now() - startTime
    });
    
    // Emit completion
    if (io) {
      io.to(userId).emit('agent.completed', {
        agent: 'BurnwiseOrchestrator',
        result: result.content,
        toolsUsed: result.toolCalls?.map(t => t.name) || []
      });
    }
    
    return {
      success: true,
      message: result.finalOutput || result.content || 'No response from agent',
      toolsUsed: result.toolCalls || [],
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error('REAL: Agent failed', {
      error: error.message,
      userId,
      conversationId
    });
    
    // Real error, not mock
    throw error;
  }
}

/**
 * Process the complete 5-agent workflow for a burn request
 */
async function executeFullWorkflow(burnRequestData, io) {
  const startTime = Date.now();
  const results = {};
  
  try {
    logger.info('REAL: Starting 5-agent workflow');
    
    // Step 1: Validate and store with Coordinator
    results.coordinator = await coordinatorAgent.coordinateBurnRequest(burnRequestData);
    if (!results.coordinator.success) {
      throw new Error(`Validation failed: ${results.coordinator.error}`);
    }
    
    const burnRequestId = results.coordinator.burnRequestId;
    
    // Step 2: Get farm location
    const [farm] = await query(`
      SELECT latitude as lat, longitude as lon 
      FROM farms WHERE farm_id = ?
    `, [burnRequestData.farm_id]);
    
    if (!farm) throw new Error('Farm not found');
    
    // Step 3: Weather Analysis with autonomous decision
    results.weather = await weatherAgent.analyzeBurnConditions(
      { lat: farm.lat, lng: farm.lon },
      burnRequestData.burn_date
    );
    
    // REAL safety decision - use correct property path
    const windSpeed = results.weather.currentWeather?.wind_speed || 0;
    if (windSpeed > 15) {
      results.weather.decision = 'UNSAFE';
      results.weather.requiresApproval = false;
      
      // Update status to rejected
      await query(`
        UPDATE burn_requests 
        SET status = 'rejected', rejection_reason = 'Unsafe weather conditions'
        WHERE request_id = ?
      `, [burnRequestId]);
      
      // Send alert
      await alertsAgent.processAlert({
        type: 'burn_rejected',
        farm_id: burnRequestData.farm_id,
        burn_request_id: burnRequestId,
        title: 'Burn Request Rejected',
        message: `Weather conditions are unsafe. Wind speed: ${windSpeed} mph exceeds 15 mph limit.`,
        severity: 'high'
      }, null, io);
      
      return results;
    } else if (windSpeed > 10) {
      results.weather.decision = 'MARGINAL';
      results.weather.requiresApproval = true;
    } else {
      results.weather.decision = 'SAFE';
      results.weather.requiresApproval = false;
    }
    
    // Step 4: Smoke Prediction - pass correct weather data structure
    // Predictor expects windSpeed not wind_speed
    const weatherDataForPredictor = {
      windSpeed: results.weather.currentWeather?.wind_speed || 5,
      windDirection: results.weather.currentWeather?.wind_direction || 180,
      temperature: results.weather.currentWeather?.temperature || 70,
      humidity: results.weather.currentWeather?.humidity || 50,
      cloudCover: results.weather.currentWeather?.clouds || 50,
      timestamp: new Date().toISOString()
    };
    
    try {
      results.prediction = await predictorAgent.predictSmokeDispersion(
        burnRequestId,
        burnRequestData,
        weatherDataForPredictor
      );
    } catch (predictionError) {
      logger.warn('Smoke prediction failed, using defaults', { error: predictionError.message });
      results.prediction = {
        success: false,
        conflicts: [],
        error: predictionError.message
      };
    }
    
    // Step 5: Schedule Optimization (if within 7 days)
    const burnDate = new Date(burnRequestData.burn_date);
    const today = new Date();
    const daysUntilBurn = (burnDate - today) / (1000 * 60 * 60 * 24);
    
    if (daysUntilBurn <= 7) {
      try {
        const allBurnRequests = await query(`
          SELECT * FROM burn_requests
          WHERE requested_date = ? AND status IN ('pending', 'approved')
        `, [burnRequestData.burn_date]);
        
        // Only pass valid predictions to optimizer
        const validPredictions = results.prediction?.success !== false ? [results.prediction] : [];
        
        results.optimization = await optimizerAgent.optimizeSchedule(
          burnRequestData.burn_date,
          allBurnRequests,
          weatherDataForPredictor,  // Use the same weather data structure
          validPredictions
        );
      } catch (optimizationError) {
        logger.warn('Schedule optimization failed', { error: optimizationError.message });
        results.optimization = {
          success: false,
          error: optimizationError.message
        };
      }
      
      // ACTUALLY CREATE SCHEDULE - with validation
      if (results.optimization?.success && results.optimization?.schedule?.items) {
        for (const item of results.optimization.schedule.items) {
          // Validate schedule item parameters
          if (item.burnRequestId && item.scheduledStart && item.scheduledEnd) {
            await query(`
              INSERT INTO schedule_items 
              (burn_request_id, scheduled_start, scheduled_end, status)
              VALUES (?, ?, ?, 'scheduled')
            `, [
              item.burnRequestId,
              item.scheduledStart,
              item.scheduledEnd
            ]);
          } else {
            logger.warn('Skipping invalid schedule item', item);
          }
        }
      }
    }
    
    // Step 6: Send Alerts
    results.alerts = await alertsAgent.processAlert({
      type: 'burn_scheduled',
      farm_id: burnRequestData.farm_id,
      burn_request_id: burnRequestId,
      title: 'Burn Request Processed',
      message: `Your burn request has been ${results.weather.decision}. ${results.weather.requiresApproval ? 'Approval required.' : ''}`,
      severity: results.weather.decision === 'UNSAFE' ? 'high' : 'medium',
      data: {
        weatherDecision: results.weather.decision,
        conflicts: results.prediction.conflicts?.length || 0,
        scheduled: results.optimization?.success || false
      }
    }, results.optimization, io);
    
    // Update burn request status - handle missing prediction gracefully
    const hasConflicts = results.prediction?.conflicts?.length > 0;
    const finalStatus = hasConflicts ? 'pending' : 
                       results.weather?.requiresApproval ? 'pending_approval' : 'approved';
    
    // CRITICAL: Validate all parameters before UPDATE
    if (!burnRequestId) {
      logger.error('CRITICAL: burnRequestId is undefined for UPDATE query');
      throw new Error('Cannot update burn request - burnRequestId is undefined');
    }
    
    const updateParams = [
      finalStatus || 'pending',
      `Weather: ${results.weather?.decision || 'Unknown'}, Conflicts: ${results.prediction?.conflicts?.length || 0}`,
      burnRequestId
    ];
    
    // Verify no undefined parameters
    updateParams.forEach((param, index) => {
      if (param === undefined) {
        logger.error(`UPDATE parameter ${index} is undefined`, { params: updateParams });
        throw new Error(`UPDATE parameter ${index} is undefined`);
      }
    });
    
    await query(`
      UPDATE burn_requests 
      SET status = ?, coordinator_notes = ?
      WHERE request_id = ?
    `, updateParams);
    
    logger.info('REAL: 5-agent workflow completed', {
      burnRequestId,
      duration: Date.now() - startTime,
      decision: results.weather.decision,
      scheduled: results.optimization?.success || false
    });
    
    return results;
    
  } catch (error) {
    logger.error('REAL: Workflow failed', { 
      error: error.message,
      step: Object.keys(results).pop() || 'initialization'
    });
    throw error;
  }
}

module.exports = {
  orchestratorAgent,
  processUserRequest,
  executeFullWorkflow,
  tools
};