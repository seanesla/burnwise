/**
 * Demo Cleanup Cron Job
 * Automatically removes expired demo sessions and all related data from TiDB
 * Runs every hour to maintain database cleanliness
 */

const db = require('../db/connection');
const logger = require('../middleware/logger');
const cron = require('node-cron');

/**
 * Clean up expired demo sessions and all related data
 */
async function cleanupExpiredDemos() {
  const startTime = Date.now();
  console.log('\n🧹 [DEMO CLEANUP] Starting automated cleanup job...');

  try {
    // Find expired demo sessions
    const expired = await db('demo_sessions')
      .where('expires_at', '<', new Date())
      .orWhere('is_active', false)
      .select('session_id', 'farm_id', 'demo_type', 'expires_at', 'total_cost');

    if (expired.length === 0) {
      console.log('✅ [DEMO CLEANUP] No expired sessions found');
      return {
        success: true,
        cleaned: 0,
        message: 'No expired sessions found'
      };
    }

    console.log(`📋 [DEMO CLEANUP] Found ${expired.length} expired demo sessions to clean up`);

    let totalCostCleaned = 0;
    let totalRecordsDeleted = 0;

    // Clean up each expired session
    for (const session of expired) {
      try {
        const recordsDeleted = await cleanupSingleSession(session);
        totalRecordsDeleted += recordsDeleted;
        totalCostCleaned += parseFloat(session.total_cost) || 0;

        console.log(`🗑️  [DEMO CLEANUP] Session ${session.session_id.substring(0, 8)}... cleaned up (${recordsDeleted} records, $${parseFloat(session.total_cost || 0).toFixed(4)})`);
      } catch (error) {
        console.error(`❌ [DEMO CLEANUP] Failed to clean session ${session.session_id}:`, error.message);
        logger.error('Demo cleanup session error', {
          sessionId: session.session_id,
          error: error.message
        });
      }
    }

    // Update cleanup statistics
    const today = new Date().toISOString().split('T')[0];
    await updateCleanupStats(today, expired.length, totalCostCleaned);

    const duration = Date.now() - startTime;
    console.log(`✅ [DEMO CLEANUP] Cleanup completed successfully in ${duration}ms`);
    console.log(`📊 [DEMO CLEANUP] Summary: ${expired.length} sessions, ${totalRecordsDeleted} records, $${totalCostCleaned.toFixed(4)} cost recovered\n`);

    logger.info('Demo cleanup completed', {
      sessionsDeleted: expired.length,
      recordsDeleted: totalRecordsDeleted,
      costRecovered: totalCostCleaned,
      duration
    });

    return {
      success: true,
      cleaned: expired.length,
      recordsDeleted: totalRecordsDeleted,
      costRecovered: totalCostCleaned,
      duration
    };

  } catch (error) {
    console.error('❌ [DEMO CLEANUP] Cleanup job failed:', error);
    logger.error('Demo cleanup job failed', { error: error.message });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up a single demo session and all related data
 * @param {Object} session - Demo session to clean up
 * @returns {number} Number of records deleted
 */
async function cleanupSingleSession(session) {
  let totalDeleted = 0;

  await db.transaction(async (trx) => {
    const { session_id, farm_id } = session;

    // Delete all demo data in the correct order (foreign key constraints)
    
    // 1. Delete agent interactions
    const agentInteractions = await trx('agent_interactions')
      .where({ farm_id, is_demo: true })
      .del();
    totalDeleted += agentInteractions;

    // 2. Delete vector embeddings
    const weatherEmbeddings = await trx('weather_embeddings')
      .where({ farm_id, is_demo: true })
      .del();
    totalDeleted += weatherEmbeddings;

    const smokeEmbeddings = await trx('smoke_embeddings')
      .where({ is_demo: true })
      .del();
    totalDeleted += smokeEmbeddings;

    const burnEmbeddings = await trx('burn_embeddings')
      .where({ farm_id, is_demo: true })
      .del();
    totalDeleted += burnEmbeddings;

    // 3. Delete alerts
    const alerts = await trx('alerts')
      .where({ farm_id, is_demo: true })
      .del();
    totalDeleted += alerts;

    // 4. Delete schedules
    const schedules = await trx('schedules')
      .where({ farm_id, is_demo: true })
      .del();
    totalDeleted += schedules;

    // 5. Delete burn requests
    const burnRequests = await trx('burn_requests')
      .where({ farm_id, is_demo: true })
      .del();
    totalDeleted += burnRequests;

    // 6. Delete weather data
    const weatherData = await trx('weather_data')
      .where({ is_demo: true })
      .del();
    totalDeleted += weatherData;

    // 7. Find and delete nearby demo farms created with this session
    // (These are farms created around the same time as the main demo farm)
    const sessionCreatedAt = await trx('demo_sessions')
      .where('session_id', session_id)
      .select('created_at')
      .first();

    if (sessionCreatedAt) {
      const timeWindow = 5 * 60 * 1000; // 5 minutes
      const windowStart = new Date(new Date(sessionCreatedAt.created_at).getTime() - timeWindow);
      const windowEnd = new Date(new Date(sessionCreatedAt.created_at).getTime() + timeWindow);

      const nearbyDemoFarms = await trx('farms')
        .where({ is_demo: true })
        .whereBetween('created_at', [windowStart, windowEnd])
        .whereNot('id', farm_id)
        .del();
      totalDeleted += nearbyDemoFarms;
    }

    // 8. Delete main demo farm
    const mainFarm = await trx('farms')
      .where({ id: farm_id, is_demo: true })
      .del();
    totalDeleted += mainFarm;

    // 9. Finally, delete the demo session
    const demoSession = await trx('demo_sessions')
      .where('session_id', session_id)
      .del();
    totalDeleted += demoSession;
  });

  return totalDeleted;
}

/**
 * Update cleanup statistics for monitoring
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {number} sessionsDeleted - Number of sessions deleted
 * @param {number} costRecovered - Cost recovered from deleted sessions
 */
async function updateCleanupStats(date, sessionsDeleted, costRecovered) {
  try {
    // Check if record exists for today
    const existing = await db('demo_cost_summary')
      .where('date', date)
      .first();

    if (existing) {
      // Update existing record
      await db('demo_cost_summary')
        .where('date', date)
        .update({
          total_sessions: db.raw('total_sessions + ?', [sessionsDeleted]),
          total_cost: db.raw('total_cost + ?', [costRecovered])
        });
    } else {
      // Create new record
      await db('demo_cost_summary').insert({
        date,
        total_sessions: sessionsDeleted,
        total_cost: costRecovered,
        active_sessions: 0
      });
    }
  } catch (error) {
    console.error('[DEMO CLEANUP] Failed to update cleanup stats:', error.message);
  }
}

/**
 * Get cleanup statistics for monitoring
 * @param {number} days - Number of days to look back
 * @returns {Object} Cleanup statistics
 */
async function getCleanupStats(days = 7) {
  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    const stats = await db('demo_cost_summary')
      .where('date', '>=', sinceDateStr)
      .select(
        db.raw('SUM(total_sessions) as total_sessions_cleaned'),
        db.raw('SUM(total_cost) as total_cost_recovered'),
        db.raw('COUNT(*) as cleanup_days'),
        db.raw('AVG(total_sessions) as avg_sessions_per_day')
      )
      .first();

    const currentActive = await db('demo_sessions')
      .where('is_active', true)
      .where('expires_at', '>', new Date())
      .count('* as count')
      .first();

    return {
      period: `${days} days`,
      totalSessionsCleaned: parseInt(stats.total_sessions_cleaned) || 0,
      totalCostRecovered: parseFloat(stats.total_cost_recovered) || 0,
      cleanupDays: parseInt(stats.cleanup_days) || 0,
      avgSessionsPerDay: parseFloat(stats.avg_sessions_per_day) || 0,
      currentActiveSessions: parseInt(currentActive.count) || 0
    };
  } catch (error) {
    console.error('[DEMO CLEANUP] Failed to get cleanup stats:', error.message);
    return {
      error: error.message
    };
  }
}

/**
 * Force cleanup of a specific demo session (for manual cleanup)
 * @param {string} sessionId - Session ID to clean up
 * @returns {Object} Cleanup result
 */
async function forceCleanupSession(sessionId) {
  try {
    const session = await db('demo_sessions')
      .where('session_id', sessionId)
      .first();

    if (!session) {
      return {
        success: false,
        error: 'Demo session not found'
      };
    }

    const recordsDeleted = await cleanupSingleSession(session);

    console.log(`🗑️  [DEMO CLEANUP] Force cleanup completed for session ${sessionId.substring(0, 8)}...`);

    return {
      success: true,
      sessionId,
      recordsDeleted,
      costRecovered: parseFloat(session.total_cost) || 0
    };
  } catch (error) {
    console.error(`[DEMO CLEANUP] Force cleanup failed for session ${sessionId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialize and start the demo cleanup cron job
 */
function startCleanupJob() {
  console.log('🚀 [DEMO CLEANUP] Initializing automated demo cleanup job...');

  // Run every hour at minute 0
  const job = cron.schedule('0 * * * *', async () => {
    await cleanupExpiredDemos();
  }, {
    scheduled: false,
    timezone: "America/Chicago"
  });

  // Start the job
  job.start();

  console.log('✅ [DEMO CLEANUP] Cron job started - runs every hour');
  console.log('📅 [DEMO CLEANUP] Next cleanup at the top of the hour');

  // Run initial cleanup after startup (with delay)
  setTimeout(async () => {
    console.log('🔄 [DEMO CLEANUP] Running initial startup cleanup...');
    await cleanupExpiredDemos();
  }, 30000); // 30 seconds after startup

  return job;
}

/**
 * Stop the cleanup job (for graceful shutdown)
 */
function stopCleanupJob(job) {
  if (job) {
    job.stop();
    console.log('🛑 [DEMO CLEANUP] Cleanup job stopped');
  }
}

// Export functions
module.exports = {
  cleanupExpiredDemos,
  cleanupSingleSession,
  getCleanupStats,
  forceCleanupSession,
  startCleanupJob,
  stopCleanupJob
};

// Auto-start if run directly
if (require.main === module) {
  startCleanupJob();
}