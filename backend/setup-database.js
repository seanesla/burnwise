#!/usr/bin/env node

/**
 * Database Setup Script for BURNWISE
 * Creates all required tables with vector columns for TiDB
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
  console.log('🔥 BURNWISE Database Setup');
  console.log('==========================\n');

  let connection;
  
  try {
    // Connect to TiDB
    console.log('Connecting to TiDB...');
    connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT || 4000),
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      multipleStatements: true,
      ssl: {
        rejectUnauthorized: true
      }
    });

    console.log('✅ Connected to TiDB\n');

    // Create database if not exists
    const dbName = process.env.TIDB_DATABASE || 'burnwise';
    console.log(`Creating database '${dbName}' if not exists...`);
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    await connection.execute(`USE ${dbName}`);
    console.log('✅ Database ready\n');

    // Drop existing tables in correct order (for clean setup)
    console.log('Cleaning up existing tables...');
    const dropTables = `
      DROP TABLE IF EXISTS burn_smoke_predictions;
      DROP TABLE IF EXISTS burn_optimization_results;
      DROP TABLE IF EXISTS alerts;
      DROP TABLE IF EXISTS burn_requests;
      DROP TABLE IF EXISTS burn_fields;
      DROP TABLE IF EXISTS farms;
      DROP TABLE IF EXISTS weather_data;
      DROP TABLE IF EXISTS weather_vectors;
      DROP TABLE IF EXISTS smoke_plume_vectors;
      DROP TABLE IF EXISTS burn_embeddings;
      DROP TABLE IF EXISTS users;
    `;
    await connection.query(dropTables);
    console.log('✅ Old tables removed\n');

    // Create users table
    console.log('Creating users table...');
    await connection.execute(`
      CREATE TABLE users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        farm_name VARCHAR(255),
        contact_phone VARCHAR(20),
        role ENUM('farmer', 'coordinator', 'admin') DEFAULT 'farmer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);
    console.log('✅ Users table created');

    // Create farms table
    console.log('Creating farms table...');
    await connection.execute(`
      CREATE TABLE farms (
        farm_id INT AUTO_INCREMENT PRIMARY KEY,
        farm_name VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        owner_name VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        address TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        total_area_hectares DECIMAL(10, 2),
        total_acreage DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_location (latitude, longitude),
        INDEX idx_name (farm_name)
      )
    `);
    console.log('✅ Farms table created');

    // Create burn_fields table
    console.log('Creating burn_fields table...');
    await connection.execute(`
      CREATE TABLE burn_fields (
        field_id INT AUTO_INCREMENT PRIMARY KEY,
        farm_id INT NOT NULL,
        field_name VARCHAR(255),
        field_geometry JSON,
        area_hectares DECIMAL(10, 2),
        crop_type VARCHAR(100),
        fuel_load_tons_per_hectare DECIMAL(5, 2),
        terrain_slope DECIMAL(5, 2),
        elevation_meters INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farm_id) REFERENCES farms(farm_id) ON DELETE CASCADE,
        INDEX idx_farm (farm_id)
      )
    `);
    console.log('✅ Burn fields table created');

    // Create burn_requests table
    console.log('Creating burn_requests table...');
    await connection.execute(`
      CREATE TABLE burn_requests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        field_id INT,
        farm_id INT NOT NULL,
        requested_date DATE NOT NULL,
        requested_start_time TIME,
        requested_end_time TIME,
        burn_type ENUM('broadcast', 'pile', 'prescribed') DEFAULT 'broadcast',
        purpose TEXT,
        estimated_duration_hours DECIMAL(4, 2),
        status ENUM('pending', 'approved', 'scheduled', 'completed', 'cancelled', 'rejected') DEFAULT 'pending',
        priority_score DECIMAL(5, 2),
        coordinator_notes TEXT,
        rejection_reason TEXT,
        actual_start_time DATETIME,
        actual_end_time DATETIME,
        acreage DECIMAL(10, 2),
        crop_type VARCHAR(100),
        requested_window_start DATETIME,
        requested_window_end DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (field_id) REFERENCES burn_fields(field_id) ON DELETE SET NULL,
        FOREIGN KEY (farm_id) REFERENCES farms(farm_id) ON DELETE CASCADE,
        INDEX idx_date (requested_date),
        INDEX idx_status (status),
        INDEX idx_farm (farm_id)
      )
    `);
    console.log('✅ Burn requests table created');

    // Create weather_data table
    console.log('Creating weather_data table...');
    await connection.execute(`
      CREATE TABLE weather_data (
        weather_id INT AUTO_INCREMENT PRIMARY KEY,
        location_lon DECIMAL(11, 8),
        location_lat DECIMAL(10, 8),
        temperature DECIMAL(5, 2),
        humidity DECIMAL(5, 2),
        wind_speed DECIMAL(5, 2),
        wind_direction DECIMAL(5, 2),
        pressure DECIMAL(6, 2),
        visibility DECIMAL(5, 2),
        weather_condition VARCHAR(50),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_location (location_lat, location_lon),
        INDEX idx_time (timestamp)
      )
    `);
    console.log('✅ Weather data table created');

    // Create weather_vectors table (128-dimensional)
    console.log('Creating weather_vectors table with 128-dim vectors...');
    await connection.execute(`
      CREATE TABLE weather_vectors (
        vector_id INT AUTO_INCREMENT PRIMARY KEY,
        weather_id INT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        conditions_vector VECTOR(128) COMMENT '128-dim weather conditions embedding',
        location_lat DECIMAL(10, 8),
        location_lon DECIMAL(11, 8),
        FOREIGN KEY (weather_id) REFERENCES weather_data(weather_id) ON DELETE CASCADE,
        VECTOR INDEX idx_weather_vector ((VEC_COSINE_DISTANCE(conditions_vector)))
      )
    `);
    console.log('✅ Weather vectors table created with HNSW index');

    // Create smoke_plume_vectors table (64-dimensional)
    console.log('Creating smoke_plume_vectors table with 64-dim vectors...');
    await connection.execute(`
      CREATE TABLE smoke_plume_vectors (
        plume_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        plume_vector VECTOR(64) COMMENT '64-dim smoke dispersion pattern',
        center_lat DECIMAL(10, 8),
        center_lon DECIMAL(11, 8),
        radius_meters DECIMAL(10, 2),
        pm25_concentration DECIMAL(8, 3),
        FOREIGN KEY (request_id) REFERENCES burn_requests(request_id) ON DELETE CASCADE,
        VECTOR INDEX idx_smoke_vector ((VEC_COSINE_DISTANCE(plume_vector)))
      )
    `);
    console.log('✅ Smoke plume vectors table created with HNSW index');

    // Create burn_embeddings table (32-dimensional)
    console.log('Creating burn_embeddings table with 32-dim vectors...');
    await connection.execute(`
      CREATE TABLE burn_embeddings (
        embedding_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT,
        embedding_vector VECTOR(32) COMMENT '32-dim burn characteristics embedding',
        embedding_type ENUM('characteristics', 'location', 'temporal') DEFAULT 'characteristics',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES burn_requests(request_id) ON DELETE CASCADE,
        VECTOR INDEX idx_burn_vector ((VEC_COSINE_DISTANCE(embedding_vector)))
      )
    `);
    console.log('✅ Burn embeddings table created with HNSW index');

    // Create alerts table
    console.log('Creating alerts table...');
    await connection.execute(`
      CREATE TABLE alerts (
        alert_id INT AUTO_INCREMENT PRIMARY KEY,
        farm_id INT,
        request_id INT,
        alert_type ENUM('burn_scheduled', 'burn_starting', 'smoke_warning', 'schedule_change', 'conflict_detected', 'weather_alert', 'manual') DEFAULT 'manual',
        severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
        message TEXT NOT NULL,
        recipient_phone VARCHAR(20),
        recipient_email VARCHAR(255),
        delivery_method ENUM('sms', 'email', 'push', 'in_app') DEFAULT 'in_app',
        delivery_status ENUM('pending', 'sent', 'delivered', 'failed') DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME,
        FOREIGN KEY (farm_id) REFERENCES farms(farm_id) ON DELETE CASCADE,
        FOREIGN KEY (request_id) REFERENCES burn_requests(request_id) ON DELETE CASCADE,
        INDEX idx_farm (farm_id),
        INDEX idx_request (request_id),
        INDEX idx_status (delivery_status)
      )
    `);
    console.log('✅ Alerts table created');

    // Create burn_smoke_predictions table
    console.log('Creating burn_smoke_predictions table...');
    await connection.execute(`
      CREATE TABLE burn_smoke_predictions (
        prediction_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        prediction_time DATETIME NOT NULL,
        smoke_density JSON,
        affected_area_km2 DECIMAL(10, 3),
        max_concentration_pm25 DECIMAL(8, 3),
        wind_adjusted BOOLEAN DEFAULT FALSE,
        confidence_score DECIMAL(3, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES burn_requests(request_id) ON DELETE CASCADE,
        INDEX idx_request (request_id),
        INDEX idx_time (prediction_time)
      )
    `);
    console.log('✅ Burn smoke predictions table created');

    // Create burn_optimization_results table
    console.log('Creating burn_optimization_results table...');
    await connection.execute(`
      CREATE TABLE burn_optimization_results (
        optimization_id INT AUTO_INCREMENT PRIMARY KEY,
        optimization_date DATE NOT NULL,
        total_requests INT,
        scheduled_count INT,
        conflict_count INT,
        resolution_count INT,
        avg_air_quality_score DECIMAL(5, 2),
        optimization_score DECIMAL(5, 2),
        algorithm_version VARCHAR(20),
        execution_time_ms INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_date (optimization_date)
      )
    `);
    console.log('✅ Burn optimization results table created');

    // Test vector functions
    console.log('\nTesting vector functions...');
    try {
      // Test cosine distance
      const [cosineTest] = await connection.execute(`
        SELECT VEC_COSINE_DISTANCE('[1,2,3]', '[4,5,6]') as cosine_dist
      `);
      console.log(`✅ VEC_COSINE_DISTANCE works: ${cosineTest[0].cosine_dist}`);

      // Test L2 distance
      const [l2Test] = await connection.execute(`
        SELECT VEC_L2_DISTANCE('[1,2,3]', '[4,5,6]') as l2_dist
      `);
      console.log(`✅ VEC_L2_DISTANCE works: ${l2Test[0].l2_dist}`);

    } catch (e) {
      console.log('⚠️  Vector functions test failed:', e.message);
      console.log('Make sure you are using TiDB Serverless with vector support enabled');
    }

    console.log('\n🎉 Database setup complete!');
    console.log('===========================');
    console.log('All tables created with:');
    console.log('- 128-dim weather vectors');
    console.log('- 64-dim smoke plume vectors');
    console.log('- 32-dim burn embeddings');
    console.log('- HNSW indexes for fast similarity search');
    console.log('\nNext step: Run "npm run seed" to populate with demo data');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n⚠️  Cannot connect to TiDB. Please check:');
      console.log('1. Your .env file has correct TIDB_HOST');
      console.log('2. Your TiDB cluster is active (not paused)');
      console.log('3. Run: node setup-tidb.js to configure credentials');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n⚠️  Authentication failed. Please check:');
      console.log('1. Your TIDB_USER and TIDB_PASSWORD are correct');
      console.log('2. Run: node setup-tidb.js to reconfigure');
    } else {
      console.log('\nError details:', error);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup
if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = { setupDatabase };