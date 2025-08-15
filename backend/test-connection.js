#!/usr/bin/env node

/**
 * Quick TiDB Connection Test
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('🔍 Testing TiDB Connection...\n');
  
  console.log('Current configuration:');
  console.log('- Host:', process.env.TIDB_HOST || 'NOT SET');
  console.log('- Port:', process.env.TIDB_PORT || 'NOT SET');
  console.log('- User:', process.env.TIDB_USER || 'NOT SET');
  console.log('- Password:', process.env.TIDB_PASSWORD ? '***SET***' : 'NOT SET');
  console.log('- Database:', process.env.TIDB_DATABASE || 'NOT SET');
  console.log();

  if (!process.env.TIDB_HOST || process.env.TIDB_HOST.includes('your-cluster')) {
    console.log('❌ TiDB credentials not configured!');
    console.log('\n📚 To fix this:');
    console.log('1. Run: npm run setup');
    console.log('2. Follow the prompts to enter your TiDB credentials');
    console.log('3. Get credentials from https://tidbcloud.com\n');
    console.log('Or read TIDB_SETUP_GUIDE.md for manual setup');
    process.exit(1);
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT || 4000),
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      ssl: {
        rejectUnauthorized: true
      }
    });

    console.log('✅ Connected to TiDB successfully!\n');

    // Test database existence
    const dbName = process.env.TIDB_DATABASE || 'burnwise';
    const [databases] = await connection.execute('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === dbName);
    
    if (dbExists) {
      console.log(`✅ Database '${dbName}' exists`);
      await connection.execute(`USE ${dbName}`);
      
      // Check tables
      const [tables] = await connection.execute('SHOW TABLES');
      console.log(`📊 Found ${tables.length} tables`);
      
      if (tables.length > 0) {
        // Check for vector tables
        const tableNames = tables.map(t => Object.values(t)[0]);
        const hasWeatherVectors = tableNames.includes('weather_vectors');
        const hasSmokeVectors = tableNames.includes('smoke_plume_vectors');
        const hasBurnEmbeddings = tableNames.includes('burn_embeddings');
        
        console.log('Vector tables:');
        console.log(`  - weather_vectors (128-dim): ${hasWeatherVectors ? '✅' : '❌'}`);
        console.log(`  - smoke_plume_vectors (64-dim): ${hasSmokeVectors ? '✅' : '❌'}`);
        console.log(`  - burn_embeddings (32-dim): ${hasBurnEmbeddings ? '✅' : '❌'}`);
      }
    } else {
      console.log(`⚠️  Database '${dbName}' does not exist`);
      console.log('Run: npm run setup:db to create it');
    }

    // Test vector functions
    console.log('\nTesting vector functions...');
    try {
      const [cosineResult] = await connection.execute(
        "SELECT VEC_COSINE_DISTANCE('[1,2,3]', '[4,5,6]') as dist"
      );
      console.log('✅ VEC_COSINE_DISTANCE works:', cosineResult[0].dist);
      
      const [l2Result] = await connection.execute(
        "SELECT VEC_L2_DISTANCE('[1,2,3]', '[4,5,6]') as dist"
      );
      console.log('✅ VEC_L2_DISTANCE works:', l2Result[0].dist);
    } catch (e) {
      console.log('❌ Vector functions not available:', e.message);
      console.log('Make sure you are using TiDB Serverless (not Dedicated)');
    }

    await connection.end();
    
    console.log('\n🎉 TiDB is ready for BURNWISE!');
    console.log('Next steps:');
    console.log('1. npm run setup:db  # Create tables');
    console.log('2. npm run seed      # Add demo data');
    console.log('3. npm start         # Start backend');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n⚠️  Cannot reach TiDB host. Check:');
      console.log('1. Cluster is active (not paused) in TiDB Cloud');
      console.log('2. Host address is correct');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n⚠️  Authentication failed. Check:');
      console.log('1. Username includes prefix (e.g., 3pTAoNNegb47Uc8.root)');
      console.log('2. Password is correct');
      console.log('3. Regenerate password in TiDB Cloud if needed');
    } else {
      console.log('\nPossible issues:');
      console.log('1. Network/firewall blocking connection');
      console.log('2. TiDB cluster is paused');
      console.log('3. Credentials are incorrect');
    }
    
    console.log('\n📚 Run: npm run setup');
    console.log('Or read TIDB_SETUP_GUIDE.md for help');
    process.exit(1);
  }
}

testConnection().catch(console.error);