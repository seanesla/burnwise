const db = require('./db/connection');

async function test() {
  try {
    await db.initializeDatabase();
    
    console.log('Testing INSERT with farms table...');
    const result = await db.query(
      'INSERT INTO farms (farm_name, owner_name, contact_email, latitude, longitude, total_acreage, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      ['Test Farm', 'Test User', 'test@demo.local', null, null, 100, true]
    );
    
    console.log('Raw result:', result);
    console.log('Result type:', typeof result);
    console.log('Result keys:', Object.keys(result));
    console.log('insertId:', result.insertId);
    console.log('affectedRows:', result.affectedRows);
    
    // Clean up
    if (result.insertId) {
      await db.query('DELETE FROM farms WHERE farm_id = ?', [result.insertId]);
      console.log('Cleaned up test farm');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test();