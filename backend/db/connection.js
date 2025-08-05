const mysql = require('mysql2/promise');
const logger = require('../middleware/logger');

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      logger.error(`Circuit breaker opened after ${this.failureCount} failures`);
    }
  }
}

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.retryDelay = 1000;
    this.maxRetries = 3;
  }

  async initialize() {
    try {
      // TiDB Serverless connection configuration
      this.pool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: process.env.TIDB_PORT || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        ssl: {
          rejectUnauthorized: true
        },
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        timezone: 'Z'
      });

      // Test connection
      await this.testConnection();
      logger.info('TiDB connection pool initialized successfully');
      
      // Initialize database schema
      await this.initializeSchema();
      
    } catch (error) {
      logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  async testConnection() {
    return this.circuitBreaker.execute(async () => {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      return true;
    });
  }

  async query(sql, params = []) {
    return this.circuitBreaker.execute(async () => {
      return this.executeWithRetry(async () => {
        const [rows] = await this.pool.execute(sql, params);
        return rows;
      });
    });
  }

  async executeWithRetry(operation, retryCount = 0) {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        logger.warn(`Database operation failed, retrying (${retryCount + 1}/${this.maxRetries}):`, error.message);
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        return this.executeWithRetry(operation, retryCount + 1);
      }
      throw error;
    }
  }

  isRetryableError(error) {
    const retryableCodes = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
    return retryableCodes.includes(error.code) || error.message.includes('Connection lost');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initializeSchema() {
    try {
      // Create farms table
      await this.query(`
        CREATE TABLE IF NOT EXISTS farms (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          owner_name VARCHAR(255) NOT NULL,
          location POINT NOT NULL,
          phone VARCHAR(20),
          email VARCHAR(255),
          total_acres DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          SPATIAL INDEX idx_location (location)
        )
      `);

      // Create burn_requests table with vector columns
      await this.query(`
        CREATE TABLE IF NOT EXISTS burn_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          farm_id INT NOT NULL,
          field_name VARCHAR(255) NOT NULL,
          field_boundary POLYGON NOT NULL,
          acres DECIMAL(10,2) NOT NULL,
          crop_type VARCHAR(100),
          burn_date DATE NOT NULL,
          time_window_start TIME NOT NULL,
          time_window_end TIME NOT NULL,
          priority_score INT DEFAULT 0,
          status ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
          weather_pattern_embedding VECTOR(128),
          burn_vector VECTOR(32),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (farm_id) REFERENCES farms(id),
          SPATIAL INDEX idx_field_boundary (field_boundary),
          VECTOR INDEX idx_weather_pattern (weather_pattern_embedding),
          VECTOR INDEX idx_burn_vector (burn_vector)
        )
      `);

      // Create weather_data table with vector columns
      await this.query(`
        CREATE TABLE IF NOT EXISTS weather_data (
          id INT AUTO_INCREMENT PRIMARY KEY,
          location POINT NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          temperature DECIMAL(5,2),
          humidity DECIMAL(5,2),
          wind_speed DECIMAL(5,2),
          wind_direction INT,
          pressure DECIMAL(7,2),
          visibility DECIMAL(5,2),
          weather_condition VARCHAR(100),
          weather_pattern_embedding VECTOR(128),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          SPATIAL INDEX idx_location (location),
          INDEX idx_timestamp (timestamp),
          VECTOR INDEX idx_weather_pattern (weather_pattern_embedding)
        )
      `);

      // Create smoke_predictions table with vector columns
      await this.query(`
        CREATE TABLE IF NOT EXISTS smoke_predictions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          burn_request_id INT NOT NULL,
          prediction_timestamp TIMESTAMP NOT NULL,
          max_dispersion_radius DECIMAL(8,2),
          affected_area POLYGON,
          pm25_concentrations JSON,
          plume_vector VECTOR(64),
          confidence_score DECIMAL(3,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id),
          SPATIAL INDEX idx_affected_area (affected_area),
          VECTOR INDEX idx_plume_vector (plume_vector)
        )
      `);

      // Create schedules table
      await this.query(`
        CREATE TABLE IF NOT EXISTS schedules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date DATE NOT NULL,
          optimization_score DECIMAL(8,4),
          total_conflicts INT DEFAULT 0,
          algorithm_version VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_date (date)
        )
      `);

      // Create schedule_items table
      await this.query(`
        CREATE TABLE IF NOT EXISTS schedule_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          schedule_id INT NOT NULL,
          burn_request_id INT NOT NULL,
          assigned_time_start TIME NOT NULL,
          assigned_time_end TIME NOT NULL,
          conflict_score DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id),
          FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id),
          UNIQUE KEY unique_schedule_burn (schedule_id, burn_request_id)
        )
      `);

      // Create alerts table
      await this.query(`
        CREATE TABLE IF NOT EXISTS alerts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          type ENUM('burn_starting', 'smoke_warning', 'weather_change', 'conflict_detected', 'schedule_update') NOT NULL,
          farm_id INT,
          burn_request_id INT,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
          status ENUM('pending', 'sent', 'acknowledged', 'resolved') DEFAULT 'pending',
          sent_via JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (farm_id) REFERENCES farms(id),
          FOREIGN KEY (burn_request_id) REFERENCES burn_requests(id),
          INDEX idx_status (status),
          INDEX idx_type (type),
          INDEX idx_created_at (created_at)
        )
      `);

      logger.info('Database schema initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  // Vector search methods
  async vectorSimilaritySearch(table, vectorColumn, queryVector, limit = 10) {
    const sql = `
      SELECT *, VEC_COSINE_DISTANCE(${vectorColumn}, ?) as similarity
      FROM ${table}
      WHERE ${vectorColumn} IS NOT NULL
      ORDER BY similarity ASC
      LIMIT ?
    `;
    return this.query(sql, [JSON.stringify(queryVector), limit]);
  }

  async spatialQuery(table, locationColumn, centerPoint, radiusKm) {
    const sql = `
      SELECT *, ST_DISTANCE_SPHERE(${locationColumn}, ST_GeomFromText(?)) as distance_meters
      FROM ${table}
      WHERE ST_DISTANCE_SPHERE(${locationColumn}, ST_GeomFromText(?)) <= ?
      ORDER BY distance_meters ASC
    `;
    const radiusMeters = radiusKm * 1000;
    return this.query(sql, [centerPoint, centerPoint, radiusMeters]);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection pool closed');
    }
  }
}

const dbConnection = new DatabaseConnection();

module.exports = {
  initializeDatabase: () => dbConnection.initialize(),
  query: (sql, params) => dbConnection.query(sql, params),
  vectorSimilaritySearch: (table, vectorColumn, queryVector, limit) =>
    dbConnection.vectorSimilaritySearch(table, vectorColumn, queryVector, limit),
  spatialQuery: (table, locationColumn, centerPoint, radiusKm) =>
    dbConnection.spatialQuery(table, locationColumn, centerPoint, radiusKm),
  close: () => dbConnection.close()
};