/**
 * Demo Cost Tracking Utility
 * Monitors and limits GPT-5 costs for demo sessions
 * Ensures demos don't exceed budget limits
 */

const db = require('../db/connection');
const logger = require('../middleware/logger');

// Cost limits for demo sessions
const COST_LIMITS = {
  perSession: 1.00,     // $1 per demo session max
  daily: 25.00,         // $25 daily across all demos
  perAgent: {
    'gpt-5-mini': 0.25,  // Max cost per agent call
    'gpt-5-nano': 0.05,
    'orchestrator': 0.30,
    'burn_request': 0.20,
    'weather_analyst': 0.15,
    'conflict_resolver': 0.25,
    'schedule_optimizer': 0.15,
    'proactive_monitor': 0.10
  }
};

// Pricing per token (matches OpenAI pricing)
const TOKEN_PRICING = {
  'gpt-5-mini': {
    input: 0.00000025,   // $0.25 per 1M input tokens
    output: 0.000002     // $2.00 per 1M output tokens  
  },
  'gpt-5-nano': {
    input: 0.00000005,   // $0.05 per 1M input tokens
    output: 0.0000004    // $0.40 per 1M output tokens
  }
};

/**
 * Track demo cost for an agent interaction
 * @param {Object} demoSession - Demo session context
 * @param {Object} usage - Token usage from OpenAI response
 * @param {string} agentType - Type of agent making the call
 * @param {Object} metadata - Additional interaction metadata
 * @returns {Object} Cost tracking result
 */
async function trackDemoCost(demoSession, usage, agentType, metadata = {}) {
  if (!demoSession?.isDemoMode || !usage) {
    return { tracked: false, reason: 'Not demo mode or no usage data' };
  }

  try {
    const sessionId = demoSession.session?.demoSessionId;
    const farmId = demoSession.session?.demoFarmId;

    if (!sessionId || !farmId) {
      logger.warn('DEMO: Missing session or farm ID for cost tracking', { sessionId, farmId });
      return { tracked: false, reason: 'Missing session data' };
    }

    // Calculate cost based on token usage
    const cost = calculateTokenCost(usage, agentType);
    
    if (cost === 0) {
      return { tracked: false, reason: 'Zero cost calculated' };
    }

    // Check if this would exceed limits
    const currentCosts = await getCurrentCosts(sessionId);
    const newSessionTotal = currentCosts.sessionTotal + cost;
    const newDailyTotal = currentCosts.dailyTotal + cost;

    // Validate against limits
    if (newSessionTotal > COST_LIMITS.perSession) {
      throw new Error(`Demo session cost limit exceeded: $${newSessionTotal.toFixed(4)} > $${COST_LIMITS.perSession}`);
    }

    if (newDailyTotal > COST_LIMITS.daily) {
      throw new Error(`Daily demo cost limit exceeded: $${newDailyTotal.toFixed(4)} > $${COST_LIMITS.daily}`);
    }

    if (cost > COST_LIMITS.perAgent[agentType]) {
      logger.warn('DEMO: Agent call exceeded recommended cost limit', {
        agentType,
        cost: cost.toFixed(4),
        limit: COST_LIMITS.perAgent[agentType]
      });
    }

    // Record the interaction in database
    await db.transaction(async (trx) => {
      // Update session total cost
      await trx('demo_sessions')
        .where('session_id', sessionId)
        .increment('total_cost', cost)
        .update({ last_activity: new Date() });

      // Log interaction details
      await trx('agent_interactions').insert({
        farm_id: farmId,
        agent_type: agentType,
        request: JSON.stringify(metadata.request || {}),
        response: JSON.stringify(metadata.response || {}),
        tokens_used: usage.total_tokens,
        cost: cost,
        model_used: detectModel(agentType),
        is_demo: true,
        created_at: new Date()
      });
    });

    logger.info('DEMO: Cost tracked successfully', {
      sessionId,
      farmId,
      agentType,
      cost: cost.toFixed(4),
      tokens: usage.total_tokens,
      sessionTotal: newSessionTotal.toFixed(4),
      remaining: (COST_LIMITS.perSession - newSessionTotal).toFixed(4)
    });

    return {
      tracked: true,
      cost,
      sessionTotal: newSessionTotal,
      dailyTotal: newDailyTotal,
      remaining: COST_LIMITS.perSession - newSessionTotal,
      limits: COST_LIMITS
    };

  } catch (error) {
    logger.error('DEMO: Cost tracking failed', {
      error: error.message,
      sessionId: demoSession.session?.demoSessionId,
      agentType
    });
    throw error; // Re-throw to handle at caller level
  }
}

/**
 * Calculate cost based on token usage and agent type
 * @param {Object} usage - Token usage object from OpenAI
 * @param {string} agentType - Agent type for model detection
 * @returns {number} Cost in USD
 */
function calculateTokenCost(usage, agentType) {
  const model = detectModel(agentType);
  const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['gpt-5-mini']; // Default to mini
  
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  
  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Detect which model is used based on agent type
 * @param {string} agentType - Type of agent
 * @returns {string} Model name
 */
function detectModel(agentType) {
  // Based on CLAUDE.md specifications
  const miniAgents = ['burn_request', 'conflict_resolver', 'orchestrator'];
  const nanoAgents = ['weather_analyst', 'schedule_optimizer', 'proactive_monitor'];
  
  if (miniAgents.includes(agentType)) {
    return 'gpt-5-mini';
  } else if (nanoAgents.includes(agentType)) {
    return 'gpt-5-nano';
  } else {
    return 'gpt-5-mini'; // Default to mini for safety
  }
}

/**
 * Get current cost totals for session and daily limits
 * @param {string} sessionId - Demo session ID
 * @returns {Object} Current cost totals
 */
async function getCurrentCosts(sessionId) {
  try {
    // Get session total
    const session = await db('demo_sessions')
      .where('session_id', sessionId)
      .select('total_cost')
      .first();

    const sessionTotal = session ? parseFloat(session.total_cost) : 0;

    // Get daily total across all demos
    const today = new Date().toISOString().split('T')[0];
    const dailyResult = await db('demo_sessions')
      .whereRaw('DATE(created_at) = ?', [today])
      .sum('total_cost as daily_total')
      .first();

    const dailyTotal = dailyResult ? parseFloat(dailyResult.daily_total) || 0 : 0;

    return {
      sessionTotal,
      dailyTotal
    };

  } catch (error) {
    logger.error('DEMO: Failed to get current costs', { error: error.message, sessionId });
    return {
      sessionTotal: 0,
      dailyTotal: 0
    };
  }
}

/**
 * Get demo cost statistics for monitoring
 * @param {string} period - 'today', 'week', or 'month'
 * @returns {Object} Cost statistics
 */
async function getDemoCostStats(period = 'today') {
  try {
    let dateFilter;
    switch (period) {
      case 'week':
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'today':
      default:
        dateFilter = new Date().toISOString().split('T')[0];
        break;
    }

    // Session statistics
    const sessionStats = await db('demo_sessions')
      .where('created_at', '>=', dateFilter)
      .select(
        db.raw('COUNT(*) as total_sessions'),
        db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions'),
        db.raw('SUM(total_cost) as total_cost'),
        db.raw('AVG(total_cost) as avg_cost_per_session'),
        db.raw('MAX(total_cost) as max_session_cost')
      )
      .first();

    // Agent breakdown
    const agentStats = await db('agent_interactions')
      .where('created_at', '>=', dateFilter)
      .where('is_demo', true)
      .groupBy('agent_type')
      .select(
        'agent_type',
        db.raw('COUNT(*) as call_count'),
        db.raw('SUM(tokens_used) as total_tokens'),
        db.raw('SUM(cost) as total_cost'),
        db.raw('AVG(cost) as avg_cost_per_call')
      );

    return {
      period,
      dateFilter,
      sessions: {
        total: parseInt(sessionStats.total_sessions) || 0,
        active: parseInt(sessionStats.active_sessions) || 0,
        totalCost: parseFloat(sessionStats.total_cost) || 0,
        avgCostPerSession: parseFloat(sessionStats.avg_cost_per_session) || 0,
        maxSessionCost: parseFloat(sessionStats.max_session_cost) || 0
      },
      agents: agentStats.map(stat => ({
        agentType: stat.agent_type,
        callCount: parseInt(stat.call_count),
        totalTokens: parseInt(stat.total_tokens),
        totalCost: parseFloat(stat.total_cost),
        avgCostPerCall: parseFloat(stat.avg_cost_per_call)
      })),
      limits: COST_LIMITS,
      utilization: {
        dailyPercent: ((parseFloat(sessionStats.total_cost) || 0) / COST_LIMITS.daily * 100).toFixed(1)
      }
    };

  } catch (error) {
    logger.error('DEMO: Failed to get cost statistics', { error: error.message, period });
    throw error;
  }
}

/**
 * Check if demo session is approaching cost limits
 * @param {string} sessionId - Demo session ID
 * @returns {Object} Warning status
 */
async function checkCostWarnings(sessionId) {
  try {
    const costs = await getCurrentCosts(sessionId);
    const warnings = [];

    // Session limit warnings
    const sessionPercent = (costs.sessionTotal / COST_LIMITS.perSession) * 100;
    if (sessionPercent >= 90) {
      warnings.push({
        type: 'session_limit',
        severity: 'critical',
        message: `Session cost at ${sessionPercent.toFixed(1)}% of limit ($${costs.sessionTotal.toFixed(4)}/$${COST_LIMITS.perSession})`
      });
    } else if (sessionPercent >= 75) {
      warnings.push({
        type: 'session_limit',
        severity: 'warning', 
        message: `Session cost at ${sessionPercent.toFixed(1)}% of limit`
      });
    }

    // Daily limit warnings
    const dailyPercent = (costs.dailyTotal / COST_LIMITS.daily) * 100;
    if (dailyPercent >= 90) {
      warnings.push({
        type: 'daily_limit',
        severity: 'critical',
        message: `Daily demo cost at ${dailyPercent.toFixed(1)}% of limit ($${costs.dailyTotal.toFixed(4)}/$${COST_LIMITS.daily})`
      });
    } else if (dailyPercent >= 75) {
      warnings.push({
        type: 'daily_limit',
        severity: 'warning',
        message: `Daily demo cost at ${dailyPercent.toFixed(1)}% of limit`
      });
    }

    return {
      sessionId,
      hasWarnings: warnings.length > 0,
      warnings,
      costs,
      limits: COST_LIMITS
    };

  } catch (error) {
    logger.error('DEMO: Failed to check cost warnings', { error: error.message, sessionId });
    return {
      sessionId,
      hasWarnings: false,
      warnings: [],
      error: error.message
    };
  }
}

module.exports = {
  trackDemoCost,
  calculateTokenCost,
  getCurrentCosts,
  getDemoCostStats,
  checkCostWarnings,
  COST_LIMITS,
  TOKEN_PRICING
};