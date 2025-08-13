/**
 * Apply retry count fix to alerts table
 */

const { initializeDatabase, query, closeDatabase } = require('./db/connection');
const fs = require('fs');

async function applyRetryFix() {
  try {
    console.log('Initializing database connection...');
    await initializeDatabase();
    
    console.log('Applying retry count column...');
    const sql = fs.readFileSync('./db/add-retry-count.sql', 'utf8');
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await query(stmt);
          console.log('✓ Applied:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
        } catch (error) {
          if (error.message.includes('Duplicate column name')) {
            console.log('⚠️  Column already exists, skipping...');
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ Retry count fix applied successfully!');
    
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying fix:', error.message);
    process.exit(1);
  }
}

applyRetryFix();