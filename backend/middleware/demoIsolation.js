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

      // Ensure demo session exists (only if session is available)
      if (req.session) {
        if (!req.session.demoSessionId) {
          req.session.demoSessionId = uuidv4();
        }
        
        // Create or find demo farm for this session
        if (!req.session.demoFarmId) {
          try {
            // Try to find existing session using raw query instead of knex
            const existingSessions = await db.query(
              'SELECT farm_id FROM demo_sessions WHERE session_id = ?',
              [req.session.demoSessionId]
            );

            if (existingSessions && existingSessions.length > 0) {
              req.session.demoFarmId = existingSessions[0].farm_id;
            } else {
              // Will be created in demo initialization API
              req.session.needsDemoSetup = true;
            }
          } catch (error) {
            console.error('[DEMO] Error finding existing session:', error);
            req.session.needsDemoSetup = true;
          }
        }
      }

      // Add demo context to request
      req.demoContext = {
        sessionId: req.session?.demoSessionId,
        farmId: req.session?.demoFarmId,
        isDemo: true
      };

      console.log(`[DEMO] Demo user session: ${req.session?.demoSessionId}, farm: ${req.session?.demoFarmId}`);
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
  if (!req.isDemoMode || !req.session) {
    return next();
  }

  try {
    const sessionResults = await db.query(
      'SELECT * FROM demo_sessions WHERE session_id = ?',
      [req.session.demoSessionId]
    );
    const session = sessionResults.length > 0 ? sessionResults[0] : null;

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
    await db.query(
      'UPDATE demo_sessions SET last_activity = NOW() WHERE session_id = ?',
      [req.session.demoSessionId]
    );

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
    // Get session details
    const sessionResults = await db.query(
      'SELECT * FROM demo_sessions WHERE session_id = ?',
      [sessionId]
    );
    
    if (sessionResults.length === 0) return;
    
    const session = sessionResults[0];
    const farmId = session.farm_id;

    // Delete all demo data related to this session
    await db.query('DELETE FROM burn_requests WHERE farm_id = ? AND is_demo = true', [farmId]);
    await db.query('DELETE FROM schedules WHERE farm_id = ? AND is_demo = true', [farmId]);
    await db.query('DELETE FROM alerts WHERE farm_id = ? AND is_demo = true', [farmId]);
    await db.query('DELETE FROM agent_interactions WHERE farm_id = ? AND is_demo = true', [farmId]);
    
    // Delete demo farm
    await db.query('DELETE FROM farms WHERE id = ? AND is_demo = true', [farmId]);
    
    // Delete session
    await db.query('DELETE FROM demo_sessions WHERE session_id = ?', [sessionId]);

    console.log(`[DEMO] Cleaned up expired session: ${sessionId}, farm: ${farmId}`);
  } catch (error) {
    console.error('[DEMO] Error cleaning up expired session:', error);
    throw error;
  }
};

/**
 * Cost tracking middleware for demo sessions
 */
const trackDemoCost = async (req, usage, agentType) => {
  if (!req.isDemoMode || !req.session) return;

  try {
    const cost = calculateTokenCost(usage, agentType);
    
    // Update session cost
    await db.query(
      'UPDATE demo_sessions SET total_cost = total_cost + ? WHERE session_id = ?',
      [cost, req.session.demoSessionId]
    );

    // Log interaction
    await db.query(
      'INSERT INTO agent_interactions (farm_id, agent_type, tokens_used, cost, is_demo, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [req.session.demoFarmId, agentType, usage.total_tokens, cost, true]
    );

    // Check cost limits
    const sessionResults = await db.query(
      'SELECT * FROM demo_sessions WHERE session_id = ?',
      [req.session.demoSessionId]
    );
    const session = sessionResults.length > 0 ? sessionResults[0] : null;

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