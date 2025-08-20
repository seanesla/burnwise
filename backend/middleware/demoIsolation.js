/**
 * Demo Isolation Middleware
 * Ensures demo and real data are completely separated in TiDB
 * Automatically adds is_demo filters to all database queries
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');

/**
 * Demo isolation middleware that ensures data separation
 * - Demo users only see demo data (is_demo = true)
 * - Real users only see real data (is_demo = false)
 */
const demoIsolation = async (req, res, next) => {
  try {
    // Check if user is in demo mode
    const isDemo = req.session?.isDemo || 
                   req.headers['x-demo-mode'] === 'true' ||
                   req.query.demo === 'true';

    if (isDemo) {
      // Demo mode setup
      req.demoFilter = { is_demo: true };
      req.isDemoMode = true;

      // Ensure demo session exists
      if (!req.session.demoSessionId) {
        req.session.demoSessionId = uuidv4();
        
        // Create or find demo farm for this session
        if (!req.session.demoFarmId) {
          const existingSession = await db('demo_sessions')
            .where('session_id', req.session.demoSessionId)
            .first();

          if (existingSession) {
            req.session.demoFarmId = existingSession.farm_id;
          } else {
            // Will be created in demo initialization API
            req.session.needsDemoSetup = true;
          }
        }
      }

      // Add demo context to request
      req.demoContext = {
        sessionId: req.session.demoSessionId,
        farmId: req.session.demoFarmId,
        isDemo: true
      };

      console.log(`[DEMO] Demo user session: ${req.session.demoSessionId}, farm: ${req.session.demoFarmId}`);
    } else {
      // Production mode setup
      req.demoFilter = { is_demo: false };
      req.isDemoMode = false;
      req.demoContext = {
        isDemo: false
      };
    }

    // Add helper methods to req object
    req.addDemoFilter = (query) => {
      if (typeof query === 'object' && query !== null) {
        return { ...query, ...req.demoFilter };
      }
      return req.demoFilter;
    };

    // Enhanced query builder with automatic demo filtering
    req.queryWithDemo = (tableName) => {
      const baseQuery = db(tableName);
      
      // Automatically add demo filter
      return baseQuery.where(req.demoFilter);
    };

    // Transaction helper with demo context
    req.demoTransaction = async (callback) => {
      return await db.transaction(async (trx) => {
        // Add demo filtering to transaction
        const enhancedTrx = {
          ...trx,
          queryWithDemo: (tableName) => trx(tableName).where(req.demoFilter)
        };
        
        return await callback(enhancedTrx);
      });
    };

    next();
  } catch (error) {
    console.error('[DEMO] Demo isolation middleware error:', error);
    next(error);
  }
};

/**
 * Demo session validator - ensures demo sessions haven't expired
 */
const validateDemoSession = async (req, res, next) => {
  if (!req.isDemoMode) {
    return next();
  }

  try {
    const session = await db('demo_sessions')
      .where('session_id', req.session.demoSessionId)
      .first();

    if (!session) {
      // Session doesn't exist, needs setup
      req.session.needsDemoSetup = true;
      return next();
    }

    // Check if session expired
    if (new Date() > new Date(session.expires_at)) {
      // Session expired, clean up
      await cleanupExpiredSession(session.session_id);
      
      // Clear session data
      req.session.isDemo = false;
      req.session.demoSessionId = null;
      req.session.demoFarmId = null;
      
      return res.status(401).json({
        error: 'Demo session expired',
        code: 'DEMO_SESSION_EXPIRED',
        message: 'Your demo session has expired. Please start a new demo.'
      });
    }

    // Session is valid, update last activity
    await db('demo_sessions')
      .where('session_id', req.session.demoSessionId)
      .update({
        last_activity: new Date()
      });

    next();
  } catch (error) {
    console.error('[DEMO] Demo session validation error:', error);
    next(error);
  }
};

/**
 * Clean up expired demo session and all related data
 */
const cleanupExpiredSession = async (sessionId) => {
  try {
    await db.transaction(async (trx) => {
      // Get session details
      const session = await trx('demo_sessions')
        .where('session_id', sessionId)
        .first();

      if (!session) return;

      const farmId = session.farm_id;

      // Delete all demo data related to this session
      await trx('burn_requests').where({ farm_id: farmId, is_demo: true }).del();
      await trx('schedules').where({ farm_id: farmId, is_demo: true }).del();
      await trx('alerts').where({ farm_id: farmId, is_demo: true }).del();
      await trx('agent_interactions').where({ farm_id: farmId, is_demo: true }).del();
      
      // Delete vector embeddings
      await trx('weather_embeddings').where({ farm_id: farmId, is_demo: true }).del();
      await trx('smoke_embeddings').where({ is_demo: true }).del();
      await trx('burn_embeddings').where({ farm_id: farmId, is_demo: true }).del();
      
      // Delete demo farm
      await trx('farms').where({ id: farmId, is_demo: true }).del();
      
      // Delete session
      await trx('demo_sessions').where('session_id', sessionId).del();

      console.log(`[DEMO] Cleaned up expired session: ${sessionId}, farm: ${farmId}`);
    });
  } catch (error) {
    console.error('[DEMO] Error cleaning up expired session:', error);
    throw error;
  }
};

/**
 * Cost tracking middleware for demo sessions
 */
const trackDemoCost = async (req, usage, agentType) => {
  if (!req.isDemoMode) return;

  try {
    const cost = calculateTokenCost(usage, agentType);
    
    // Update session cost
    await db('demo_sessions')
      .where('session_id', req.session.demoSessionId)
      .increment('total_cost', cost);

    // Log interaction
    await db('agent_interactions').insert({
      farm_id: req.session.demoFarmId,
      agent_type: agentType,
      tokens_used: usage.total_tokens,
      cost: cost,
      is_demo: true,
      created_at: new Date()
    });

    // Check cost limits
    const session = await db('demo_sessions')
      .where('session_id', req.session.demoSessionId)
      .first();

    const COST_LIMITS = {
      perSession: 1.00, // $1 per demo session
      daily: 10.00      // $10 daily across all demos
    };

    if (session.total_cost > COST_LIMITS.perSession) {
      throw new Error(`Demo session cost limit reached: $${session.total_cost.toFixed(4)}`);
    }

    console.log(`[DEMO] Cost tracked: ${agentType}, $${cost.toFixed(4)}, session total: $${session.total_cost.toFixed(4)}`);
    
    return { 
      cost, 
      sessionTotal: session.total_cost,
      remaining: COST_LIMITS.perSession - session.total_cost 
    };
  } catch (error) {
    console.error('[DEMO] Cost tracking error:', error);
    throw error;
  }
};

/**
 * Calculate token cost based on agent type and usage
 */
const calculateTokenCost = (usage, agentType) => {
  const PRICING = {
    'gpt-5-mini': {
      input: 0.00000025,  // $0.25 per 1M tokens
      output: 0.000002    // $2.00 per 1M tokens
    },
    'gpt-5-nano': {
      input: 0.00000005,  // $0.05 per 1M tokens
      output: 0.0000004   // $0.40 per 1M tokens
    }
  };

  // Default to mini pricing if agent type not specified
  const modelPricing = PRICING[agentType] || PRICING['gpt-5-mini'];
  
  const inputCost = (usage.prompt_tokens || 0) * modelPricing.input;
  const outputCost = (usage.completion_tokens || 0) * modelPricing.output;
  
  return inputCost + outputCost;
};

module.exports = {
  demoIsolation,
  validateDemoSession,
  trackDemoCost,
  cleanupExpiredSession,
  calculateTokenCost
};