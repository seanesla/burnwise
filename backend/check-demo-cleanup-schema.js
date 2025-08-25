/**
 * Check database schema for demo cleanup job
 */

require('dotenv').config();
const { query, initializeDatabase } = require('./db/connection');

async function checkSchema() {
  try {
    await initializeDatabase();
    
    console.log('\n=== Checking database schema for demo cleanup ===\n');
    
    // Check weather_vectors columns
    const weatherVectorsCols = await query('DESCRIBE weather_vectors');
    console.log('weather_vectors columns:');
    weatherVectorsCols.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    // Check smoke_plume_vectors columns
    const smokePlumeCols = await query('DESCRIBE smoke_plume_vectors');
    console.log('\nsmoke_plume_vectors columns:');
    smokePlumeCols.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });
    
    // Check if demo_cost_summary exists
    const tables = await query('SHOW TABLES LIKE "demo_cost_summary"');
    console.log('\ndemo_cost_summary table exists:', tables.length > 0);
    
    // Check what demo-related columns exist in various tables
    console.log('\n=== Demo-related columns in tables ===\n');
    
    const tablesToCheck = [
      'agent_interactions',
      'alerts',
      'burn_embeddings',
      'burn_requests',
      'farms',
      'schedules',
      'weather_data',
      'weather_analyses'
    ];
    
    for (const table of tablesToCheck) {
      const cols = await query(`DESCRIBE ${table}`);
      const demoRelated = cols.filter(col => 
        col.Field.includes('demo') || 
        col.Field.includes('farm') || 
        col.Field.includes('session')
      );
      
      if (demoRelated.length > 0) {
        console.log(`${table}:`);
        demoRelated.forEach(col => {
          console.log(`  - ${col.Field} (${col.Type})`);
        });
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking schema:', error);
    process.exit(1);
  }
}

checkSchema();