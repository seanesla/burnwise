/**
 * Demo Cleanup Cron Job
 * Automatically removes expired demo sessions and all related data from TiDB
 * Runs every hour to maintain database cleanliness
 */

const { query } = require('../db/connection');
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
    const expired = await query(
      `SELECT session_id, farm_id, demo_type, expires_at, total_cost 
       FROM demo_sessions 
       WHERE expires_at < NOW() OR is_active = false`
    );

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
  const { session_id, farm_id } = session;

  try {

    // Delete all demo data in the correct order (foreign key constraints)
    
    // 1. Delete agent interactions
    const agentInteractionsResult = await query(
      'DELETE FROM agent_interactions WHERE farm_id = ?',
      [farm_id]
    );
    totalDeleted += agentInteractionsResult.affectedRows || 0;

    // 2. Delete vector embeddings
    // Delete weather_vectors that belong to demo weather_data
    const weatherVectorsResult = await query(
      `DELETE wv FROM weather_vectors wv 
       JOIN weather_data wd ON wv.weather_id = wd.weather_id 
       WHERE wd.is_demo = true`,
      []
    );
    totalDeleted += weatherVectorsResult.affectedRows || 0;

    // Delete smoke_plume_vectors that belong to burn_requests from this farm
    const smokeVectorsResult = await query(
      `DELETE spv FROM smoke_plume_vectors spv 
       JOIN burn_requests br ON spv.request_id = br.id 
       WHERE br.farm_id = ?`,
      [farm_id]
    );
    totalDeleted += smokeVectorsResult.affectedRows || 0;

    // Delete burn_embeddings linked to burn_requests from this farm  
    const burnEmbeddingsResult = await query(
      `DELETE be FROM burn_embeddings be
       JOIN burn_requests br ON be.request_id = br.id
       WHERE br.farm_id = ?`,
      [farm_id]
    );
    totalDeleted += burnEmbeddingsResult.affectedRows || 0;

    // 3. Delete alerts
    const alertsResult = await query(
      'DELETE FROM alerts WHERE farm_id = ?',
      [farm_id]
    );
    totalDeleted += alertsResult.affectedRows || 0;

    // 4. Delete schedules and schedule_items
    const scheduleItemsResult = await query(
      'DELETE si FROM schedule_items si JOIN schedules s ON si.schedule_id = s.id WHERE s.farm_id = ?',
      [farm_id]
    );
    totalDeleted += scheduleItemsResult.affectedRows || 0;

    const schedulesResult = await query(
      'DELETE FROM schedules WHERE farm_id = ?',
      [farm_id]
    );
    totalDeleted += schedulesResult.affectedRows || 0;

    // 5. Delete burn requests and related data
    // Delete burn_fields first (foreign key constraint)
    const burnFieldsResult = await query(
      'DELETE bf FROM burn_fields bf JOIN burn_requests br ON bf.burn_request_id = br.id WHERE br.farm_id = ?',
      [farm_id]
    );
    totalDeleted += burnFieldsResult.affectedRows || 0;

    // Delete burn_smoke_predictions
    const burnSmokePredictionsResult = await query(
      'DELETE bsp FROM burn_smoke_predictions bsp JOIN burn_requests br ON bsp.request_id = br.id WHERE br.farm_id = ?',
      [farm_id]
    );
    totalDeleted += burnSmokePredictionsResult.affectedRows || 0;

    // Delete burn_optimization_results
    const burnOptimizationResult = await query(
      'DELETE bor FROM burn_optimization_results bor JOIN burn_requests br ON bor.request_id = br.id WHERE br.farm_id = ?',
      [farm_id]
    );
    totalDeleted += burnOptimizationResult.affectedRows || 0;

    // Now delete burn_requests
    const burnRequestsResult = await query(
      'DELETE FROM burn_requests WHERE farm_id = ?',
      [farm_id]
    );
    totalDeleted += burnRequestsResult.affectedRows || 0;

    // 6. Delete weather data and analyses
    const weatherAnalysesResult = await query(
      'DELETE FROM weather_analyses WHERE farm_id = ?',
      [farm_id]
    );
    totalDeleted += weatherAnalysesResult.affectedRows || 0;

    // weather_data doesn't have farm_id, delete by is_demo flag
    const weatherDataResult = await query(
      'DELETE FROM weather_data WHERE is_demo = true',
      []
    );
    totalDeleted += weatherDataResult.affectedRows || 0;

    // 7. Find and delete nearby demo farms created with this session
    // (These are farms created around the same time as the main demo farm)
    const sessionCreatedAt = await query(
      'SELECT created_at FROM demo_sessions WHERE session_id = ?',
      [session_id]
    );

    if (sessionCreatedAt && sessionCreatedAt.length > 0) {
      const timeWindow = 5 * 60 * 1000; // 5 minutes
      const windowStart = new Date(new Date(sessionCreatedAt[0].created_at).getTime() - timeWindow);
      const windowEnd = new Date(new Date(sessionCreatedAt[0].created_at).getTime() + timeWindow);

      const nearbyDemoFarmsResult = await query(
        'DELETE FROM farms WHERE is_demo = true AND created_at BETWEEN ? AND ? AND id != ?',
        [windowStart, windowEnd, farm_id]
      );
      totalDeleted += nearbyDemoFarmsResult.affectedRows || 0;
    }

    // 8. Delete main demo farm
    const mainFarmResult = await query(
      'DELETE FROM farms WHERE id = ? AND is_demo = true',
      [farm_id]
    );
    totalDeleted += mainFarmResult.affectedRows || 0;

    // 9. Finally, delete the demo session
    const demoSessionResult = await query(
      'DELETE FROM demo_sessions WHERE session_id = ?',
      [session_id]
    );
    totalDeleted += demoSessionResult.affectedRows || 0;

  } catch (error) {
    console.error(`❌ [DEMO CLEANUP] Error cleaning session ${session_id}:`, error);
    throw error;
  }

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
    // Skip updating stats if demo_cost_summary table doesn't exist
    // This table is optional for tracking cleanup statistics
    const tables = await query('SHOW TABLES LIKE "demo_cost_summary"');
    if (tables.length === 0) {
      console.log('[DEMO CLEANUP] Skipping stats update - demo_cost_summary table not found');
      return;
    }
    
    // Check if record exists for today
    const existing = await query(
      'SELECT * FROM demo_cost_summary WHERE date = ? LIMIT 1',
      [date]
    );

    if (existing && existing.length > 0) {
      // Update existing record
      await query(
        `UPDATE demo_cost_summary 
         SET total_sessions = total_sessions + ?, 
             total_cost = total_cost + ?, 
             sessions_cleaned = sessions_cleaned + ?, 
             cost_recovered = cost_recovered + ?, 
             updated_at = NOW() 
         WHERE date = ?`,
        [sessionsDeleted, costRecovered, sessionsDeleted, costRecovered, date]
      );
    } else {
      // Create new record
      await query(
        `INSERT INTO demo_cost_summary (date, total_sessions, total_cost, sessions_cleaned, cost_recovered, active_sessions, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
        [date, sessionsDeleted, costRecovered, sessionsDeleted, costRecovered]
      );
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

    const stats = await query(
      `SELECT 
        SUM(total_sessions) as total_sessions_cleaned,
        SUM(total_cost) as total_cost_recovered,
        COUNT(*) as cleanup_days,
        AVG(total_sessions) as avg_sessions_per_day
       FROM demo_cost_summary
       WHERE date >= ?`,
      [sinceDateStr]
    );

    const currentActive = await query(
      'SELECT COUNT(*) as count FROM demo_sessions WHERE is_active = true AND expires_at > NOW()'
    );

    return {
      period: `${days} days`,
      totalSessionsCleaned: stats && stats[0] ? parseInt(stats[0].total_sessions_cleaned) || 0 : 0,
      totalCostRecovered: stats && stats[0] ? parseFloat(stats[0].total_cost_recovered) || 0 : 0,
      cleanupDays: stats && stats[0] ? parseInt(stats[0].cleanup_days) || 0 : 0,
      avgSessionsPerDay: stats && stats[0] ? parseFloat(stats[0].avg_sessions_per_day) || 0 : 0,
      currentActiveSessions: currentActive && currentActive[0] ? parseInt(currentActive[0].count) || 0 : 0
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
    const sessionResult = await query(
      'SELECT * FROM demo_sessions WHERE session_id = ? LIMIT 1',
      [sessionId]
    );
    const session = sessionResult && sessionResult[0] ? sessionResult[0] : null;

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