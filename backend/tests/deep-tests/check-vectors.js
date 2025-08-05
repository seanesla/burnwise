#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { initializeDatabase, query } = require('../../db/connection');

async function checkVectorColumns() {
  try {
    await initializeDatabase();
    console.log('=== VECTOR COLUMNS IN BURNWISE ===\n');
    
    // Check weather_conditions
    console.log('1. weather_conditions table:');
    const weatherCols = await query('SHOW COLUMNS FROM weather_conditions');
    weatherCols.forEach(col => {
      if (col.Type.includes('vector') || col.Type.includes('VECTOR')) {
        console.log(`  ✅ VECTOR COLUMN: ${col.Field} - ${col.Type}`);
      }
    });
    
    // Check smoke_predictions
    console.log('\n2. smoke_predictions table:');
    const smokeCols = await query('SHOW COLUMNS FROM smoke_predictions');
    smokeCols.forEach(col => {
      if (col.Type.includes('vector') || col.Type.includes('VECTOR')) {
        console.log(`  ✅ VECTOR COLUMN: ${col.Field} - ${col.Type}`);
      }
    });
    
    // Check burn_requests
    console.log('\n3. burn_requests table:');
    const burnCols = await query('SHOW COLUMNS FROM burn_requests');
    burnCols.forEach(col => {
      if (col.Type.includes('vector') || col.Type.includes('VECTOR')) {
        console.log(`  ✅ VECTOR COLUMN: ${col.Field} - ${col.Type}`);
      }
    });
    
    // Test actual vector operation
    console.log('\n=== TESTING REAL VECTOR OPERATIONS ===\n');
    
    // Insert test vector
    const testVector = '[' + Array(128).fill(0).map(() => Math.random()).join(',') + ']';
    await query(
      `INSERT INTO weather_conditions (location_lat, location_lng, weather_pattern_embedding, observation_time) 
       VALUES (?, ?, ?, NOW())`,
      [37.0, -120.0, testVector]
    );
    console.log('✅ Inserted 128-dimensional weather vector');
    
    // Search for similar vectors
    const similar = await query(
      `SELECT COUNT(*) as count, 
       MAX(1 - VEC_COSINE_DISTANCE(weather_pattern_embedding, ?)) as max_similarity
       FROM weather_conditions 
       WHERE weather_pattern_embedding IS NOT NULL`,
      [testVector]
    );
    
    console.log(`✅ Vector similarity search: Found ${similar[0].count} vectors`);
    console.log(`✅ Max similarity: ${similar[0].max_similarity}`);
    
    // Check if we have HNSW index
    const indexes = await query(`SHOW INDEXES FROM weather_conditions`);
    const vectorIndexes = indexes.filter(idx => 
      idx.Column_name.includes('embedding') || idx.Key_name.includes('vector')
    );
    
    if (vectorIndexes.length > 0) {
      console.log('\n✅ VECTOR INDEXES FOUND:');
      vectorIndexes.forEach(idx => {
        console.log(`  - ${idx.Key_name} on ${idx.Column_name}`);
      });
    }
    
    console.log('\n=== TIDB VECTOR CAPABILITIES UTILIZED ===');
    console.log('✅ Native VECTOR data type');
    console.log('✅ VEC_COSINE_DISTANCE function');
    console.log('✅ High-dimensional embeddings (128-dim)');
    console.log('✅ Real-time similarity search');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkVectorColumns();