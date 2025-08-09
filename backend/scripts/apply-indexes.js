#!/usr/bin/env node

/**
 * Script to apply database index optimizations for improved query performance
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, initializeDatabase } = require('../db/connection');
const logger = require('../middleware/logger');

async function applyIndexes() {
  console.log('🚀 Starting database index optimization...\n');
  
  try {
    await initializeDatabase();
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'optimize-indexes.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL statements (simple split by semicolon and newline)
    const statements = sqlContent
      .split(/;\s*\n/)
      .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'))
      .map(stmt => stmt.trim() + ';');
    
    console.log(`Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Process each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      // Skip comments and empty statements
      if (!stmt || stmt.startsWith('--')) {
        continue;
      }
      
      // Extract index name for logging
      const indexMatch = stmt.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
      const indexName = indexMatch ? indexMatch[1] : `Statement ${i + 1}`;
      
      try {
        // For CREATE INDEX statements, check if index already exists
        if (stmt.includes('CREATE INDEX')) {
          const tableName = stmt.match(/ON\s+(\w+)/i)?.[1];
          if (tableName) {
            // Check if index exists
            const existingIndex = await query(`
              SELECT COUNT(*) as count
              FROM information_schema.statistics
              WHERE table_schema = DATABASE()
              AND table_name = ?
              AND index_name = ?
            `, [tableName, indexName]);
            
            if (existingIndex[0].count > 0) {
              console.log(`⏭️  Skipping ${indexName} (already exists)`);
              skipCount++;
              continue;
            }
          }
        }
        
        // Execute the statement
        console.log(`📊 Executing: ${indexName}...`);
        const startTime = Date.now();
        await query(stmt.replace(/IF\s+NOT\s+EXISTS/gi, ''));
        const duration = Date.now() - startTime;
        
        console.log(`   ✅ Success (${duration}ms)`);
        successCount++;
        
      } catch (error) {
        // Handle duplicate key errors gracefully
        if (error.message.includes('Duplicate key name')) {
          console.log(`   ⏭️  Skipped (index already exists)`);
          skipCount++;
        } else if (error.message.includes('ANALYZE TABLE')) {
          // ANALYZE TABLE might not be supported, skip it
          console.log(`   ⏭️  Skipped (ANALYZE not needed)`);
          skipCount++;
        } else {
          console.log(`   ❌ Error: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log('\n📈 Index Optimization Summary:');
    console.log(`   ✅ Successfully created: ${successCount} indexes`);
    console.log(`   ⏭️  Skipped (existing): ${skipCount} indexes`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount}`);
    }
    
    // Verify indexes were created
    console.log('\n🔍 Verifying indexes...');
    const indexStats = await query(`
      SELECT 
        table_name,
        COUNT(DISTINCT index_name) as index_count
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
      AND table_name IN ('burn_requests', 'alerts', 'smoke_predictions', 
                         'schedule_items', 'schedules', 'weather_data', 
                         'farms', 'agent_execution_logs')
      GROUP BY table_name
      ORDER BY table_name
    `);
    
    console.log('   Index counts by table:');
    indexStats.forEach(stat => {
      console.log(`   - ${stat.table_name}: ${stat.index_count} indexes`);
    });
    
    // Test query performance improvement
    console.log('\n⚡ Testing query performance...');
    
    // Test 1: Burn requests by farm and status
    const test1Start = Date.now();
    await query(`
      SELECT COUNT(*) as count
      FROM burn_requests
      WHERE farm_id = 1 AND status = 'pending'
    `);
    const test1Duration = Date.now() - test1Start;
    console.log(`   Burn requests by farm+status: ${test1Duration}ms`);
    
    // Test 2: Pending alerts
    const test2Start = Date.now();
    await query(`
      SELECT COUNT(*) as count
      FROM alerts
      WHERE status = 'pending'
      AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);
    const test2Duration = Date.now() - test2Start;
    console.log(`   Pending alerts (24h): ${test2Duration}ms`);
    
    // Test 3: Schedule optimization
    const test3Start = Date.now();
    await query(`
      SELECT br.*, si.scheduled_start_time
      FROM burn_requests br
      LEFT JOIN schedule_items si ON br.request_id = si.burn_request_id
      WHERE br.requested_date = CURDATE()
      AND br.status IN ('pending', 'approved')
      ORDER BY br.priority_score DESC
      LIMIT 10
    `);
    const test3Duration = Date.now() - test3Start;
    console.log(`   Schedule optimization query: ${test3Duration}ms`);
    
    console.log('\n✨ Database index optimization completed successfully!');
    
    logger.info('Database indexes optimized', {
      successCount,
      skipCount,
      errorCount,
      indexStats: indexStats.length
    });
    
  } catch (error) {
    console.error('❌ Index optimization failed:', error.message);
    logger.error('Index optimization script failed', { error: error.message });
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the optimization
applyIndexes();