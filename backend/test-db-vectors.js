require('dotenv').config();
const mysql = require('mysql2/promise');

async function testDatabaseAndVectors() {
  let connection;
  const results = {
    connection: false,
    vectorInsert128: false,
    vectorInsert64: false,
    vectorInsert32: false,
    vectorSearch: false,
    errors: []
  };

  try {
    // Test connection
    console.log('Testing TiDB connection...');
    connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });
    results.connection = true;
    console.log('✓ Database connected');

    // Create parent records for foreign key constraints
    try {
      // Create a farm
      await connection.execute(
        'INSERT INTO farms (farm_name, owner_name, contact_email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE farm_id=LAST_INSERT_ID(farm_id)',
        ['Test Farm', 'Test Owner', 'test@example.com']
      );
      const [farmResult] = await connection.execute('SELECT LAST_INSERT_ID() as id');
      const farmId = farmResult[0].id;
      
      // Create a burn field
      await connection.execute(
        'INSERT INTO burn_fields (farm_id, field_name, area_hectares) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE field_id=LAST_INSERT_ID(field_id)',
        [farmId, 'Test Field', 50]
      );
      const [fieldResult] = await connection.execute('SELECT LAST_INSERT_ID() as id');
      const fieldId = fieldResult[0].id;
      
      // Create a burn request
      await connection.execute(
        'INSERT INTO burn_requests (field_id, requested_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE request_id=LAST_INSERT_ID(request_id)',
        [fieldId, '2025-08-10']
      );
      const [requestResult] = await connection.execute('SELECT LAST_INSERT_ID() as id');
      const requestId = requestResult[0].id;
      
      // Store these for later use
      connection.testFieldId = fieldId;
      connection.testRequestId = requestId;
    } catch (e) {
      console.error('Setup error:', e.message);
    }

    // Test 128-dim vector (weather)
    try {
      const testVector128 = Array(128).fill(0).map(() => Math.random());
      await connection.execute(
        'INSERT INTO weather_conditions (latitude, longitude, observation_time, weather_pattern_embedding) VALUES (?, ?, NOW(), ?)',
        [45.5, -122.6, JSON.stringify(testVector128)]
      );
      results.vectorInsert128 = true;
      console.log('✓ 128-dim vector insertion works');
    } catch (e) {
      results.errors.push(`128-dim insert: ${e.message}`);
      console.error('✗ 128-dim vector error:', e.message);
    }

    // Test 64-dim vector (smoke)
    try {
      const testVector64 = Array(64).fill(0).map(() => Math.random());
      await connection.execute(
        'INSERT INTO smoke_predictions (burn_request_id, prediction_time, plume_vector, max_pm25_ugm3) VALUES (?, NOW(), ?, ?)',
        [connection.testRequestId || 1, JSON.stringify(testVector64), 25.5]
      );
      results.vectorInsert64 = true;
      console.log('✓ 64-dim vector insertion works');
    } catch (e) {
      results.errors.push(`64-dim insert: ${e.message}`);
      console.error('✗ 64-dim vector error:', e.message);
    }

    // Test 32-dim vector (terrain)
    try {
      const testVector32 = Array(32).fill(0).map(() => Math.random());
      await connection.execute(
        'INSERT INTO historical_burns (field_id, burn_date, burn_vector) VALUES (?, ?, ?)',
        [connection.testFieldId || 1, '2025-08-04', JSON.stringify(testVector32)]
      );
      results.vectorInsert32 = true;
      console.log('✓ 32-dim vector insertion works');
    } catch (e) {
      results.errors.push(`32-dim insert: ${e.message}`);
      console.error('✗ 32-dim vector error:', e.message);
    }

    // Test vector search
    try {
      const searchVector = Array(128).fill(0).map(() => Math.random());
      const [rows] = await connection.execute(
        'SELECT weather_id FROM weather_conditions WHERE VEC_Cosine_Distance(weather_pattern_embedding, ?) < 1.0 LIMIT 1',
        [JSON.stringify(searchVector)]
      );
      results.vectorSearch = true;
      console.log('✓ Vector search works');
    } catch (e) {
      results.errors.push(`Vector search: ${e.message}`);
      console.error('✗ Vector search error:', e.message);
    }

  } catch (e) {
    results.errors.push(`Connection: ${e.message || e.toString()}`);
    console.error('✗ Database connection error:', e.message || e.toString());
    console.error('Stack:', e.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  // Summary
  console.log('\n=== Database Test Summary ===');
  console.log('Connection:', results.connection ? '✓' : '✗');
  console.log('128-dim vectors:', results.vectorInsert128 ? '✓' : '✗');
  console.log('64-dim vectors:', results.vectorInsert64 ? '✓' : '✗');
  console.log('32-dim vectors:', results.vectorInsert32 ? '✓' : '✗');
  console.log('Vector search:', results.vectorSearch ? '✓' : '✗');
  
  if (results.errors.length > 0) {
    console.log('\nErrors found:');
    results.errors.forEach(err => console.log(' -', err));
    process.exit(1);
  } else {
    console.log('\nAll database tests passed!');
    process.exit(0);
  }
}

testDatabaseAndVectors();