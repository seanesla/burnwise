#!/usr/bin/env node

/**
 * Script to clean up pending alerts that are stuck in retry loops
 * and fix the alert retry mechanism
 */

require('dotenv').config();
const { query, initializeDatabase } = require('../db/connection');
const logger = require('../middleware/logger');

async function cleanupPendingAlerts() {
  console.log('🧹 Starting pending alerts cleanup...\n');
  
  try {
    await initializeDatabase();
    
    // Step 1: Get pending alert statistics
    console.log('1. Analyzing pending alerts...');
    const pendingStats = await query(`
      SELECT 
        COUNT(*) as total_pending,
        MIN(created_at) as oldest_alert,
        MAX(created_at) as newest_alert,
        COUNT(CASE WHEN delivery_attempts > 5 THEN 1 END) as excessive_retries
      FROM alerts
      WHERE status = 'pending'
    `);
    
    console.log(`   Found ${pendingStats[0].total_pending} pending alerts`);
    console.log(`   Oldest: ${pendingStats[0].oldest_alert}`);
    console.log(`   Newest: ${pendingStats[0].newest_alert}`);
    console.log(`   Excessive retries (>5): ${pendingStats[0].excessive_retries}\n`);
    
    if (pendingStats[0].total_pending === 0) {
      console.log('✅ No pending alerts to clean up!');
      process.exit(0);
    }
    
    // Step 2: Mark old pending alerts as failed
    console.log('2. Marking old pending alerts as failed...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const failedOldAlerts = await query(`
      UPDATE alerts 
      SET 
        status = 'cancelled',
        delivery_status = 'failed'
      WHERE status = 'pending'
      AND created_at < ?
    `, [oneHourAgo]);
    
    console.log(`   ✅ Marked ${failedOldAlerts.affectedRows} old alerts as failed\n`);
    
    // Step 3: Mark alerts with too many retry attempts as failed
    console.log('3. Marking alerts with excessive retries as failed...');
    const failedExcessiveRetries = await query(`
      UPDATE alerts 
      SET 
        status = 'cancelled',
        delivery_status = 'failed'
      WHERE status = 'pending'
      AND delivery_attempts > 5
    `);
    
    console.log(`   ✅ Marked ${failedExcessiveRetries.affectedRows} alerts with excessive retries as failed\n`);
    
    // Step 4: Clear test alerts from recent burn request testing
    console.log('4. Cleaning up test alerts from recent testing...');
    const testAlerts = await query(`
      DELETE FROM alerts
      WHERE burn_request_id >= 210000
      AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);
    
    console.log(`   ✅ Deleted ${testAlerts.affectedRows} test alerts\n`);
    
    // Step 5: Reset delivery attempts for remaining pending alerts
    console.log('5. Resetting delivery attempts for remaining pending alerts...');
    const resetAlerts = await query(`
      UPDATE alerts 
      SET 
        delivery_attempts = 0
      WHERE status = 'pending'
      AND delivery_attempts > 0
      AND created_at > ?
    `, [oneHourAgo]);
    
    console.log(`   ✅ Reset ${resetAlerts.affectedRows} alerts for retry\n`);
    
    // Step 6: Get final statistics
    console.log('6. Final statistics:');
    const finalStats = await query(`
      SELECT 
        status,
        delivery_status,
        COUNT(*) as count
      FROM alerts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY status, delivery_status
      ORDER BY status, delivery_status
    `);
    
    console.log('   Alert distribution (last 7 days):');
    finalStats.forEach(stat => {
      console.log(`   - ${stat.status}/${stat.delivery_status}: ${stat.count}`);
    });
    
    // Step 7: Verify no stuck alerts remain
    const remainingPending = await query(`
      SELECT COUNT(*) as count
      FROM alerts
      WHERE status = 'pending'
      AND created_at < ?
    `, [oneHourAgo]);
    
    if (remainingPending[0].count > 0) {
      console.log(`\n⚠️  Warning: ${remainingPending[0].count} pending alerts still remain`);
    } else {
      console.log('\n✅ All stuck pending alerts have been cleaned up!');
    }
    
    console.log('\n🎉 Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    logger.error('Alert cleanup script failed', { error: error.message });
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the cleanup
cleanupPendingAlerts();