/**
 * Clean test alerts from database
 * Removes any alerts with test/demo keywords
 */

const { query, initializeDatabase } = require('./db/connection');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

async function cleanTestAlerts() {
  console.log(`${BLUE}Cleaning test alerts from database...${RESET}`);
  
  try {
    await initializeDatabase();
    
    // First, check how many test alerts exist
    const checkResult = await query(`
      SELECT COUNT(*) as count 
      FROM alerts 
      WHERE message LIKE '%test%' 
         OR message LIKE '%demo%' 
         OR title LIKE '%test%'
         OR title LIKE '%demo%'
    `);
    
    const testAlertCount = checkResult[0].count;
    console.log(`Found ${testAlertCount} test alerts`);
    
    if (testAlertCount > 0) {
      // Delete test alerts
      const deleteResult = await query(`
        DELETE FROM alerts 
        WHERE message LIKE '%test%' 
           OR message LIKE '%demo%' 
           OR title LIKE '%test%'
           OR title LIKE '%demo%'
      `);
      
      console.log(`${GREEN}✅ Deleted ${deleteResult.affectedRows} test alerts${RESET}`);
    } else {
      console.log(`${GREEN}✅ No test alerts found${RESET}`);
    }
    
    // Verify clean state
    const verifyResult = await query(`
      SELECT COUNT(*) as total_alerts,
             COUNT(CASE WHEN message LIKE '%test%' THEN 1 END) as test_alerts
      FROM alerts
    `);
    
    console.log(`\n${BLUE}Final state:${RESET}`);
    console.log(`  Total alerts: ${verifyResult[0].total_alerts}`);
    console.log(`  Test alerts: ${verifyResult[0].test_alerts}`);
    
    if (verifyResult[0].test_alerts === 0) {
      console.log(`\n${GREEN}✅ Database cleaned - NO TEST DATA${RESET}`);
    } else {
      console.log(`\n${RED}❌ Still have ${verifyResult[0].test_alerts} test alerts${RESET}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`${RED}Error: ${error.message}${RESET}`);
    process.exit(1);
  }
}

cleanTestAlerts();