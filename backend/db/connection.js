const mysql = require('mysql2/promise');
const logger = require('../middleware/logger');
const { queryCache, invalidateRelatedCaches } = require('./queryCache');

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
      // TiDB Serverless connection configuration - OPTIMIZED
      this.pool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        ssl: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2'
        },
        connectionLimit: 30, // Increased from 10 for better concurrency
        connectTimeout: 30000, // Reduced from 60000 for faster failure detection
        waitForConnections: true,
        queueLimit: 100, // Set limit to prevent memory issues
        charset: 'utf8mb4',
        timezone: 'Z',
        // Performance optimizations
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        maxPreparedStatements: 200, // Cache prepared statements
        flags: ['-FOUND_ROWS'] // Optimize for COUNT queries
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

  async query(sql, params = [], options = {}) {
    const { 
      useCache = true, 
      ttl = 60000, // 1 minute default
      forceRefresh = false 
    } = options;
    
    // Check if this is a SELECT query that can be cached
    const isSelectQuery = sql.trim().toUpperCase().startsWith('SELECT');
    const shouldCache = useCache && isSelectQuery && !forceRefresh;
    
    // Try to get from cache first
    if (shouldCache) {
      const cached = queryCache.get(sql, params);
      if (cached !== null) {
        return cached;
      }
    }
    
    // Execute query
    const result = await this.circuitBreaker.execute(async () => {
      return this.executeWithRetry(async () => {
        const [rows] = await this.pool.execute(sql, params);
        return rows;
      });
    });
    
    // Cache the result if applicable
    if (shouldCache && result) {
      queryCache.set(sql, params, result, ttl);
    }
    
    // Invalidate cache for write operations
    if (!isSelectQuery) {
      // Extract table name from query
      const tableMatch = sql.match(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+`?(\w+)`?/i);
      if (tableMatch) {
        invalidateRelatedCaches(tableMatch[1]);
      }
    }
    
    return result;
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
      // Check if tables exist
      const tables = await this.query(`SHOW TABLES`);
      const tableNames = tables.map(row => Object.values(row)[0]);
      logger.info(`Connected to TiDB. Found ${tables.length} tables.`);
      
      // If no tables exist, create schema
      if (tables.length === 0) {
        logger.info('No tables found. Creating database schema...');
        
        // Read and execute schema file
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, 'schema.sql');
        
        if (fs.existsSync(schemaPath)) {
          const schema = fs.readFileSync(schemaPath, 'utf8');
          const statements = schema
            .split(';')
            .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'))
            .map(stmt => stmt.trim() + ';');
          
          for (const statement of statements) {
            if (statement.trim()) {
              try {
                await this.query(statement);
              } catch (err) {
                // Ignore duplicate key errors for seed data
                if (!err.message.includes('Duplicate entry')) {
                  logger.warn('Schema statement failed:', err.message);
                }
              }
            }
          }
          
          logger.info('Database schema created successfully');
        } else {
          logger.warn('Schema file not found. Tables may need to be created manually.');
        }
      } else {
        logger.info('Existing tables:', tableNames);
      }
      
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
  query: (sql, params, options) => dbConnection.query(sql, params, options),
  vectorSimilaritySearch: (table, vectorColumn, queryVector, limit) =>
    dbConnection.vectorSimilaritySearch(table, vectorColumn, queryVector, limit),
  spatialQuery: (table, locationColumn, centerPoint, radiusKm) =>
    dbConnection.spatialQuery(table, locationColumn, centerPoint, radiusKm),
  close: () => dbConnection.close(),
  // Export cache utilities for monitoring
  getCacheStats: () => queryCache.getStats(),
  clearCache: () => queryCache.clear()
};