const mysql = require('mysql2/promise');
const logger = require('../middleware/logger');
const { queryCache, invalidateRelatedCaches } = require('./queryCache');

// Mock database implementation for testing
class MockDatabase {
  constructor() {
    this.data = {
      users: [
        { id: 1, email: 'test@burnwise.com', name: 'Test User', role: 'farmer' }
      ],
      farms: [
        { id: 1, name: 'Test Farm', location: JSON.stringify({lat: 38.5, lng: -121.5}), owner_id: 1 }
      ],
      burn_requests: [],
      weather_data: [
        { id: 1, temperature: 72, humidity: 45, wind_speed: 5, wind_direction: 180 }
      ],
      alerts: [],
      burn_fields: [],
      weather_vectors: [],
      smoke_plume_vectors: [],
      burn_embeddings: []
    };
    this.nextId = 100;
  }

  async initialize() {
    logger.info('Mock database initialized for testing');
    return true;
  }

  async testConnection() {
    return true;
  }

  async query(sql, params = []) {
    const upperSql = sql.trim().toUpperCase();
    
    // Handle SHOW TABLES
    if (upperSql.startsWith('SHOW TABLES')) {
      return Object.keys(this.data).map(table => ({ [`Tables_in_${process.env.TIDB_DATABASE}`]: table }));
    }

    // Handle SELECT
    if (upperSql.startsWith('SELECT')) {
      const tableMatch = sql.match(/FROM\s+`?(\w+)`?/i);
      if (tableMatch) {
        const table = tableMatch[1];
        if (this.data[table]) {
          // Simple mock - return all data from table
          return this.data[table];
        }
      }
      return [];
    }

    // Handle INSERT
    if (upperSql.startsWith('INSERT')) {
      const tableMatch = sql.match(/INSERT INTO\s+`?(\w+)`?/i);
      if (tableMatch) {
        const table = tableMatch[1];
        if (this.data[table]) {
          const newItem = { id: this.nextId++, created_at: new Date() };
          this.data[table].push(newItem);
          return { insertId: newItem.id, affectedRows: 1 };
        }
      }
      return { insertId: this.nextId++, affectedRows: 1 };
    }

    // Handle UPDATE
    if (upperSql.startsWith('UPDATE')) {
      return { affectedRows: 1, changedRows: 1 };
    }

    // Handle DELETE
    if (upperSql.startsWith('DELETE')) {
      return { affectedRows: 1 };
    }

    // Handle CREATE TABLE
    if (upperSql.startsWith('CREATE TABLE')) {
      const tableMatch = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/i);
      if (tableMatch && !this.data[tableMatch[1]]) {
        this.data[tableMatch[1]] = [];
      }
      return { affectedRows: 0 };
    }

    // Default response
    return [];
  }

  async close() {
    logger.info('Mock database connection closed');
  }
}

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
    this.mockDb = null;
    this.useMock = process.env.USE_MOCK_DB === 'true';
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.retryDelay = 1000;
    this.maxRetries = 3;
  }

  async initialize() {
    try {
      // Use mock database if configured
      if (this.useMock) {
        this.mockDb = new MockDatabase();
        await this.mockDb.initialize();
        logger.info('Using mock database for testing');
        return;
      }

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
    if (this.useMock) {
      return this.mockDb.testConnection();
    }
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
    
    // Use mock database if configured
    if (this.useMock) {
      return this.mockDb.query(sql, params);
    }
    
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
    
    // Check if pool is initialized
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initializeDatabase() first.');
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
      // Skip schema initialization for mock database
      if (this.useMock) {
        logger.info('Mock database - schema initialization skipped');
        return;
      }
      
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

  // Removed vector search and spatial methods - overengineered and unused

  async close() {
    if (this.useMock && this.mockDb) {
      await this.mockDb.close();
    } else if (this.pool) {
      await this.pool.end();
      logger.info('Database connection pool closed');
    }
  }
}

const dbConnection = new DatabaseConnection();

// Vector similarity search using TiDB's native vector functions
async function vectorSimilaritySearch(tableName, vectorColumn, searchVector, limit = 10, filters = {}) {
  try {
    // Convert array to TiDB vector format
    const vectorString = `[${searchVector.join(',')}]`;
    
    // Build WHERE clause from filters
    let whereConditions = [];
    let params = [vectorString];
    
    if (filters && Object.keys(filters).length > 0) {
      for (const [key, value] of Object.entries(filters)) {
        whereConditions.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Use VEC_COSINE_DISTANCE for similarity calculation
    const sql = `
      SELECT *, 
             1 - VEC_COSINE_DISTANCE(${vectorColumn}, ?) as similarity
      FROM ${tableName}
      ${whereClause}
      ORDER BY similarity DESC
      LIMIT ?
    `;
    
    params.push(limit);
    
    const results = await dbConnection.query(sql, params);
    
    logger.debug('Vector similarity search completed', {
      table: tableName,
      column: vectorColumn,
      resultsFound: results.length
    });
    
    return results;
  } catch (error) {
    logger.error('Vector similarity search failed', { 
      error: error.message,
      table: tableName,
      column: vectorColumn 
    });
    return [];
  }
}

module.exports = {
  initializeDatabase: () => dbConnection.initialize(),
  query: (sql, params, options) => dbConnection.query(sql, params, options),
  close: () => dbConnection.close(),
  // Export cache utilities for monitoring
  getCacheStats: () => queryCache.getStats(),
  clearCache: () => queryCache.clear(),
  // Export vector operations with stub for compatibility
  vectorSimilaritySearch
};