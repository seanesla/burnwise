const { 
  query, 
  vectorSimilaritySearch, 
  spatialQuery, 
  getConnectionPool,
  testConnection,
  executeInTransaction,
  initializeSchema,
  circuitBreaker
} = require('../../db/connection');
const mysql = require('mysql2/promise');
const logger = require('../../middleware/logger');

// Mock dependencies
jest.mock('mysql2/promise');
jest.mock('../../middleware/logger');

describe('Database Connection Tests', () => {
  let mockConnection;
  let mockPool;

  beforeEach(() => {
    jest.resetAllMocks();
    
    mockConnection = {
      execute: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      destroy: jest.fn(),
      ping: jest.fn()
    };

    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      execute: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    };

    mysql.createPool.mockReturnValue(mockPool);
  });

  describe('1. Connection Pool Management', () => {
    test('should create connection pool with correct configuration', () => {
      const expectedConfig = {
        host: process.env.TIDB_HOST,
        port: process.env.TIDB_PORT,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        ssl: { rejectUnauthorized: true },
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        multipleStatements: false
      };

      mysql.createPool.mockClear();
      const pool = getConnectionPool();

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining(expectedConfig)
      );
    });

    test('should handle SSL configuration based on environment', () => {
      process.env.TIDB_SSL_CA = '/path/to/ca.pem';
      
      mysql.createPool.mockClear();
      getConnectionPool();

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: {
            ca: '/path/to/ca.pem',
            rejectUnauthorized: true
          }
        })
      );
    });

    test('should configure connection pool event handlers', () => {
      getConnectionPool();

      expect(mockPool.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('release', expect.any(Function));
    });

    test('should handle pool connection acquisition', async () => {
      mockPool.getConnection.mockResolvedValueOnce(mockConnection);

      const connection = await getConnectionPool().getConnection();

      expect(connection).toBe(mockConnection);
      expect(mockPool.getConnection).toHaveBeenCalled();
    });

    test('should handle connection acquisition timeout', async () => {
      mockPool.getConnection.mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(getConnectionPool().getConnection()).rejects.toThrow('Connection timeout');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Connection acquisition failed'),
        expect.any(Object)
      );
    });

    test('should properly release connections back to pool', async () => {
      mockPool.getConnection.mockResolvedValueOnce(mockConnection);

      const connection = await getConnectionPool().getConnection();
      connection.release();

      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('2. Circuit Breaker Tests', () => {
    test('should track connection failures', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Connection failed'));

      try {
        await query('SELECT 1');
      } catch (error) {
        // Expected to fail
      }

      const status = circuitBreaker.getStatus();
      expect(status.failures).toBeGreaterThan(0);
    });

    test('should open circuit after failure threshold', async () => {
      // Simulate multiple failures
      mockPool.execute.mockRejectedValue(new Error('Database unavailable'));

      for (let i = 0; i < 6; i++) {
        try {
          await query('SELECT 1');
        } catch (error) {
          // Expected failures
        }
      }

      const status = circuitBreaker.getStatus();
      expect(status.state).toBe('open');
    });

    test('should reject requests when circuit is open', async () => {
      // Force circuit open
      circuitBreaker.forceOpen();

      await expect(query('SELECT 1')).rejects.toThrow('Circuit breaker is OPEN');
    });

    test('should transition to half-open after timeout', async () => {
      circuitBreaker.forceOpen();
      
      // Simulate timeout passage
      jest.advanceTimersByTime(60000); // 1 minute

      const status = circuitBreaker.getStatus();
      expect(status.state).toBe('half-open');
    });

    test('should reset circuit on successful operations', async () => {
      mockPool.execute.mockResolvedValueOnce([[], {}]);

      // Force circuit half-open
      circuitBreaker.forceHalfOpen();

      await query('SELECT 1');

      const status = circuitBreaker.getStatus();
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
    });
  });

  describe('3. Query Execution Tests', () => {
    test('should execute basic SELECT queries', async () => {
      const mockResults = [
        [{ id: 1, name: 'Test' }, { id: 2, name: 'Test2' }],
        { affectedRows: 0, insertId: 0 }
      ];
      
      mockPool.execute.mockResolvedValueOnce(mockResults);

      const result = await query('SELECT * FROM test_table WHERE id = ?', [1]);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM test_table WHERE id = ?', [1]);
      expect(result).toEqual(mockResults[0]);
    });

    test('should execute INSERT queries with parameters', async () => {
      const mockResults = [
        { affectedRows: 1, insertId: 123 },
        {}
      ];
      
      mockPool.execute.mockResolvedValueOnce(mockResults);

      const result = await query(
        'INSERT INTO burns (farm_id, acres, fuel_type) VALUES (?, ?, ?)',
        ['farm_123', 100, 'wheat_stubble']
      );

      expect(result).toEqual(mockResults[0]);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO burns (farm_id, acres, fuel_type) VALUES (?, ?, ?)',
        ['farm_123', 100, 'wheat_stubble']
      );
    });

    test('should execute UPDATE queries', async () => {
      const mockResults = [
        { affectedRows: 2, changedRows: 2 },
        {}
      ];
      
      mockPool.execute.mockResolvedValueOnce(mockResults);

      const result = await query(
        'UPDATE burns SET status = ? WHERE farm_id = ?',
        ['approved', 'farm_123']
      );

      expect(result).toEqual(mockResults[0]);
      expect(result.affectedRows).toBe(2);
    });

    test('should execute DELETE queries', async () => {
      const mockResults = [
        { affectedRows: 1 },
        {}
      ];
      
      mockPool.execute.mockResolvedValueOnce(mockResults);

      const result = await query('DELETE FROM burns WHERE id = ?', [456]);

      expect(result).toEqual(mockResults[0]);
      expect(result.affectedRows).toBe(1);
    });

    test('should handle SQL syntax errors', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('SQL syntax error near SELECT'));

      await expect(query('SELCT * FROM burns')).rejects.toThrow('SQL syntax error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Query execution failed'),
        expect.any(Object)
      );
    });

    test('should handle query timeout', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(query('SELECT SLEEP(30)')).rejects.toThrow('Query timeout');
    });

    test('should validate query parameters', async () => {
      await expect(query('SELECT * FROM burns WHERE id = ?', null)).rejects.toThrow('Invalid parameters');
      await expect(query('SELECT * FROM burns WHERE id = ?', 'not_array')).rejects.toThrow('Parameters must be array');
    });
  });

  describe('4. Vector Search Operations', () => {
    test('should perform vector similarity search', async () => {
      const mockResults = [
        [
          { id: 1, similarity: 0.95, weather_data: '{"temp": 20}' },
          { id: 2, similarity: 0.87, weather_data: '{"temp": 22}' },
          { id: 3, similarity: 0.82, weather_data: '{"temp": 18}' }
        ],
        {}
      ];

      mockPool.execute.mockResolvedValueOnce(mockResults);

      const vector = new Array(128).fill(0).map(() => Math.random());
      const results = await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        vector,
        5,
        0.8
      );

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('VEC_COSINE_DISTANCE'),
        expect.arrayContaining([JSON.stringify(vector), 5])
      );
      expect(results).toHaveLength(3);
      expect(results[0].similarity).toBe(0.95);
    });

    test('should validate vector dimensions', async () => {
      const invalidVector = new Array(64).fill(0.5); // Wrong dimension
      
      await expect(vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        invalidVector,
        5,
        0.8
      )).rejects.toThrow('Vector dimension mismatch');
    });

    test('should handle empty vector search results', async () => {
      mockPool.execute.mockResolvedValueOnce([[], {}]);

      const vector = new Array(128).fill(0.5);
      const results = await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        vector,
        5,
        0.9
      );

      expect(results).toEqual([]);
    });

    test('should perform vector search with different similarity functions', async () => {
      const mockResults = [
        [{ id: 1, similarity: 0.85, data: '{}' }],
        {}
      ];

      mockPool.execute.mockResolvedValueOnce(mockResults);

      const vector = new Array(64).fill(0.3);
      await vectorSimilaritySearch(
        'smoke_predictions',
        'plume_vector',
        vector,
        3,
        0.7,
        'VEC_L2_DISTANCE'
      );

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('VEC_L2_DISTANCE'),
        expect.any(Array)
      );
    });

    test('should validate vector search parameters', async () => {
      const vector = new Array(128).fill(0.5);

      await expect(vectorSimilaritySearch('', 'column', vector, 5, 0.8))
        .rejects.toThrow('Table name required');
      
      await expect(vectorSimilaritySearch('table', '', vector, 5, 0.8))
        .rejects.toThrow('Column name required');
      
      await expect(vectorSimilaritySearch('table', 'column', [], 5, 0.8))
        .rejects.toThrow('Vector cannot be empty');
      
      await expect(vectorSimilaritySearch('table', 'column', vector, 0, 0.8))
        .rejects.toThrow('Limit must be positive');
      
      await expect(vectorSimilaritySearch('table', 'column', vector, 5, -0.1))
        .rejects.toThrow('Threshold must be between 0 and 1');
    });

    test('should handle vector search performance optimization', async () => {
      const mockResults = [
        [{ id: 1, similarity: 0.92 }],
        {}
      ];

      mockPool.execute.mockResolvedValueOnce(mockResults);

      const vector = new Array(128).fill(0.5);
      const startTime = Date.now();
      
      await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        vector,
        10,
        0.8
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('5. Spatial Query Operations', () => {
    test('should perform spatial proximity queries', async () => {
      const mockResults = [
        [
          { id: 1, farm_name: 'Farm A', distance: 1.2 },
          { id: 2, farm_name: 'Farm B', distance: 2.8 }
        ],
        {}
      ];

      mockPool.execute.mockResolvedValueOnce(mockResults);

      const results = await spatialQuery(
        'farms',
        { latitude: 37.5, longitude: -120.5 },
        5000 // 5km radius
      );

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('ST_Distance_Sphere'),
        expect.arrayContaining([37.5, -120.5, 5000])
      );
      expect(results).toHaveLength(2);
      expect(results[0].distance).toBe(1.2);
    });

    test('should calculate distances in different units', async () => {
      const mockResults = [[{ id: 1, distance_miles: 3.1 }], {}];
      mockPool.execute.mockResolvedValueOnce(mockResults);

      await spatialQuery(
        'farms',
        { latitude: 37.5, longitude: -120.5 },
        8000,
        'miles'
      );

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('* 0.000621371'), // km to miles conversion
        expect.any(Array)
      );
    });

    test('should validate spatial query parameters', async () => {
      await expect(spatialQuery('', { latitude: 37.5, longitude: -120.5 }, 1000))
        .rejects.toThrow('Table name required');
      
      await expect(spatialQuery('farms', { latitude: 91, longitude: -120.5 }, 1000))
        .rejects.toThrow('Invalid latitude');
      
      await expect(spatialQuery('farms', { latitude: 37.5, longitude: -181 }, 1000))
        .rejects.toThrow('Invalid longitude');
      
      await expect(spatialQuery('farms', { latitude: 37.5, longitude: -120.5 }, -100))
        .rejects.toThrow('Radius must be positive');
    });

    test('should perform polygon containment queries', async () => {
      const mockResults = [
        [{ id: 1, farm_name: 'Farm Inside', contained: true }],
        {}
      ];

      mockPool.execute.mockResolvedValueOnce(mockResults);

      const polygon = [
        { latitude: 37.0, longitude: -121.0 },
        { latitude: 37.0, longitude: -120.0 },
        { latitude: 38.0, longitude: -120.0 },
        { latitude: 38.0, longitude: -121.0 },
        { latitude: 37.0, longitude: -121.0 }
      ];

      const results = await spatialQuery(
        'farms',
        polygon,
        null,
        null,
        'contains'
      );

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('ST_Contains'),
        expect.any(Array)
      );
      expect(results).toHaveLength(1);
    });

    test('should handle spatial index optimization', async () => {
      mockPool.execute.mockResolvedValueOnce([[], {}]);

      await spatialQuery(
        'farms',
        { latitude: 37.5, longitude: -120.5 },
        1000
      );

      // Should use spatial index for performance
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('USE INDEX'),
        expect.any(Array)
      );
    });
  });

  describe('6. Transaction Management', () => {
    test('should execute queries within transactions', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 123 }, {}])
        .mockResolvedValueOnce([{ affectedRows: 1 }, {}]);

      const result = await executeInTransaction(async (connection) => {
        await connection.execute('INSERT INTO burns (farm_id, acres) VALUES (?, ?)', ['farm_1', 100]);
        await connection.execute('UPDATE farms SET last_burn_date = NOW() WHERE id = ?', ['farm_1']);
        return { success: true, burnId: 123 };
      });

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.burnId).toBe(123);
    });

    test('should rollback transactions on error', async () => {
      mockConnection.execute
        .mockResolvedValueOnce([{ affectedRows: 1, insertId: 123 }, {}])
        .mockRejectedValueOnce(new Error('Constraint violation'));

      await expect(executeInTransaction(async (connection) => {
        await connection.execute('INSERT INTO burns (farm_id, acres) VALUES (?, ?)', ['farm_1', 100]);
        await connection.execute('INSERT INTO invalid_table (id) VALUES (?)', [1]);
      })).rejects.toThrow('Constraint violation');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    test('should handle nested transaction scenarios', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }, {}]);

      const result = await executeInTransaction(async (connection) => {
        await connection.execute('INSERT INTO burns (farm_id) VALUES (?)', ['farm_1']);
        
        // Simulate nested operation
        await executeInTransaction(async (nestedConnection) => {
          await nestedConnection.execute('INSERT INTO burn_history (burn_id) VALUES (?)', [1]);
        });
        
        return { success: true };
      });

      expect(result.success).toBe(true);
      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(2);
      expect(mockConnection.commit).toHaveBeenCalledTimes(2);
    });

    test('should handle transaction deadlocks', async () => {
      mockConnection.execute.mockRejectedValueOnce(new Error('Deadlock found when trying to get lock'));

      await expect(executeInTransaction(async (connection) => {
        await connection.execute('UPDATE burns SET status = ? WHERE id = ?', ['active', 1]);
        await connection.execute('UPDATE burns SET status = ? WHERE id = ?', ['active', 2]);
      })).rejects.toThrow('Deadlock found');

      expect(mockConnection.rollback).toHaveBeenCalled();
    });

    test('should properly release connections after transactions', async () => {
      mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, {}]);

      await executeInTransaction(async (connection) => {
        await connection.execute('INSERT INTO test (id) VALUES (?)', [1]);
      });

      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('7. Schema Management', () => {
    test('should initialize database schema', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], {}]) // CREATE DATABASE
        .mockResolvedValueOnce([[], {}]) // USE DATABASE
        .mockResolvedValueOnce([[], {}]) // CREATE TABLE burns
        .mockResolvedValueOnce([[], {}]) // CREATE TABLE weather_patterns
        .mockResolvedValueOnce([[], {}]) // CREATE VECTOR INDEX
        .mockResolvedValueOnce([[], {}]); // CREATE SPATIAL INDEX

      const result = await initializeSchema();

      expect(result.success).toBe(true);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE DATABASE IF NOT EXISTS'),
        expect.any(Array)
      );
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS burns'),
        expect.any(Array)
      );
    });

    test('should create vector indexes for similarity search', async () => {
      mockPool.execute.mockResolvedValue([[], {}]);

      await initializeSchema();

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('VECTOR INDEX'),
        expect.any(Array)
      );
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('VEC_COSINE_DISTANCE'),
        expect.any(Array)
      );
    });

    test('should create spatial indexes for geographic queries', async () => {
      mockPool.execute.mockResolvedValue([[], {}]);

      await initializeSchema();

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SPATIAL INDEX'),
        expect.any(Array)
      );
    });

    test('should handle schema version management', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], {}]) // Initial schema
        .mockResolvedValueOnce([[{ version: 1 }], {}]) // Get current version
        .mockResolvedValueOnce([[], {}]); // Apply migration

      const result = await initializeSchema({ targetVersion: 2 });

      expect(result.migrationsApplied).toBeGreaterThan(0);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT version FROM schema_migrations'),
        expect.any(Array)
      );
    });

    test('should validate schema integrity', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[
          { table_name: 'burns', column_name: 'burn_vector', data_type: 'vector(32)' },
          { table_name: 'weather_patterns', column_name: 'weather_pattern_embedding', data_type: 'vector(128)' }
        ], {}]);

      const validation = await testConnection.validateSchema();

      expect(validation.valid).toBe(true);
      expect(validation.vectorColumns).toHaveLength(2);
    });
  });

  describe('8. Performance and Monitoring', () => {
    test('should track query performance metrics', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ id: 1 }], {}]);

      const startTime = Date.now();
      await query('SELECT * FROM burns WHERE id = ?', [1]);
      const duration = Date.now() - startTime;

      expect(logger.performance).toHaveBeenCalledWith(
        'database_query',
        expect.any(Number),
        expect.objectContaining({
          query: expect.stringContaining('SELECT'),
          paramCount: 1
        })
      );
    });

    test('should monitor connection pool health', () => {
      const health = getConnectionPool().getHealthStatus();

      expect(health).toHaveProperty('totalConnections');
      expect(health).toHaveProperty('activeConnections');
      expect(health).toHaveProperty('idleConnections');
      expect(health).toHaveProperty('waitingConnections');
    });

    test('should handle slow query detection', async () => {
      // Simulate slow query
      mockPool.execute.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([[{ id: 1 }], {}]), 2000))
      );

      const startTime = Date.now();
      await query('SELECT * FROM large_table');
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThan(1000);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected'),
        expect.any(Object)
      );
    });

    test('should monitor vector search performance', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ id: 1, similarity: 0.9 }], {}]);

      const vector = new Array(128).fill(0.5);
      const startTime = Date.now();
      
      await vectorSimilaritySearch(
        'weather_patterns',
        'weather_pattern_embedding',
        vector,
        10,
        0.8
      );

      expect(logger.performance).toHaveBeenCalledWith(
        'vector_search',
        expect.any(Number),
        expect.objectContaining({
          dimensions: 128,
          limit: 10,
          threshold: 0.8
        })
      );
    });
  });

  describe('9. Error Handling and Recovery', () => {
    test('should handle connection lost scenarios', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(query('SELECT 1')).rejects.toThrow('Connection lost');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database connection error'),
        expect.any(Object)
      );
    });

    test('should implement exponential backoff for retries', async () => {
      let attempts = 0;
      mockPool.execute.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve([[{ success: true }], {}]);
      });

      const result = await query('SELECT 1', [], { retryAttempts: 3 });

      expect(attempts).toBe(3);
      expect(result).toEqual([{ success: true }]);
    });

    test('should handle database constraint violations', async () => {
      mockPool.execute.mockRejectedValueOnce(new Error('Duplicate entry for key PRIMARY'));

      await expect(query(
        'INSERT INTO burns (id, farm_id) VALUES (?, ?)',
        [1, 'farm_1']
      )).rejects.toThrow('Duplicate entry');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database constraint violation'),
        expect.any(Object)
      );
    });

    test('should handle query cancellation', async () => {
      const controller = new AbortController();
      
      setTimeout(() => controller.abort(), 100);

      await expect(query(
        'SELECT SLEEP(5)',
        [],
        { signal: controller.signal }
      )).rejects.toThrow('Query cancelled');
    });

    test('should recover from pool exhaustion', async () => {
      mockPool.getConnection.mockRejectedValueOnce(new Error('Pool exhausted'));
      mockPool.getConnection.mockResolvedValueOnce(mockConnection);
      mockConnection.execute.mockResolvedValueOnce([[{ id: 1 }], {}]);

      // Should retry and succeed
      const result = await query('SELECT 1');
      
      expect(result).toEqual([{ id: 1 }]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Connection pool exhausted'),
        expect.any(Object)
      );
    });
  });

  describe('10. Connection Testing and Health Checks', () => {
    test('should perform connection health checks', async () => {
      mockConnection.ping.mockResolvedValueOnce();

      const isHealthy = await testConnection();

      expect(isHealthy).toBe(true);
      expect(mockConnection.ping).toHaveBeenCalled();
    });

    test('should detect unhealthy connections', async () => {
      mockConnection.ping.mockRejectedValueOnce(new Error('Connection timeout'));

      const isHealthy = await testConnection();

      expect(isHealthy).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Connection health check failed'),
        expect.any(Object)
      );
    });

    test('should validate database configuration', async () => {
      mockPool.execute.mockResolvedValueOnce([[
        { Variable_name: 'max_connections', Value: '1000' },
        { Variable_name: 'innodb_buffer_pool_size', Value: '134217728' }
      ], {}]);

      const config = await testConnection.getDatabaseConfig();

      expect(config.max_connections).toBe('1000');
      expect(config.innodb_buffer_pool_size).toBe('134217728');
    });

    test('should check vector search capability', async () => {
      mockPool.execute.mockResolvedValueOnce([[
        { Function_name: 'VEC_COSINE_DISTANCE' },
        { Function_name: 'VEC_L2_DISTANCE' }
      ], {}]);

      const vectorSupport = await testConnection.checkVectorSupport();

      expect(vectorSupport.cosineDistance).toBe(true);
      expect(vectorSupport.l2Distance).toBe(true);
    });

    test('should verify spatial functionality', async () => {
      mockPool.execute.mockResolvedValueOnce([[
        { Function_name: 'ST_Distance_Sphere' },
        { Function_name: 'ST_Contains' }
      ], {}]);

      const spatialSupport = await testConnection.checkSpatialSupport();

      expect(spatialSupport.distanceCalculation).toBe(true);
      expect(spatialSupport.geometryOperations).toBe(true);
    });
  });

});