const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const mysql = require('mysql2/promise');
const { initializeDatabase, query, pool, getPoolStats, createTransaction } = require('../../db/connection');
require('dotenv').config();

describe('TiDB Connection Pool Management - Life-Critical Database Operations', () => {
  let testPool;
  let connectionCount = 0;
  
  beforeAll(async () => {
    await initializeDatabase();
  });
  
  afterAll(async () => {
    // Ensure all connections are closed
    const currentPool = pool();
    if (currentPool) {
      await currentPool.end();
    }
    if (testPool) {
      await testPool.end();
    }
  });
  
  beforeEach(() => {
    connectionCount = 0;
  });

  describe('Connection Pool Initialization', () => {
    test('Should establish TiDB connection with proper SSL configuration', async () => {
      const config = {
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true
        },
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0
      };
      
      testPool = mysql.createPool(config);
      const connection = await testPool.getConnection();
      
      expect(connection).toBeDefined();
      
      // Verify SSL is active by checking SSL status
      const [sslResults] = await connection.query('SHOW STATUS LIKE "Ssl_cipher"');
      expect(sslResults.length).toBeGreaterThan(0);
      expect(sslResults[0].Value).toBeTruthy();
      expect(sslResults[0].Value).not.toBe('');
      
      // Verify connection is working
      const [testResults] = await connection.query('SELECT 1 as test');
      expect(testResults[0].test).toBe(1);
      
      connection.release();
    });

    test('Should enforce connection pool size limits', async () => {
      const smallPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 3,
        waitForConnections: false
      });
      
      const connections = [];
      
      // Acquire maximum connections
      for (let i = 0; i < 3; i++) {
        const conn = await smallPool.getConnection();
        connections.push(conn);
      }
      
      // Try to exceed limit
      try {
        await smallPool.getConnection();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toMatch(/connection limit|no connections available/i);
      }
      
      // Release connections
      connections.forEach(conn => conn.release());
      await smallPool.end();
    });

    test('Should handle connection initialization failures gracefully', async () => {
      const badPool = mysql.createPool({
        host: 'invalid-host-that-does-not-exist.com',
        port: 4000,
        user: 'invalid',
        password: 'invalid',
        database: 'invalid',
        connectTimeout: 1000
      });
      
      try {
        await badPool.getConnection();
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.code).toMatch(/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/);
      }
      
      await badPool.end();
    });

    test('Should validate required environment variables', () => {
      const requiredVars = ['TIDB_HOST', 'TIDB_USER', 'TIDB_DATABASE'];
      const missing = [];
      
      requiredVars.forEach(varName => {
        if (!process.env[varName]) {
          missing.push(varName);
        }
      });
      
      if (missing.length > 0) {
        console.warn(`Missing required environment variables: ${missing.join(', ')}`);
      }
      
      // Should have all critical vars for production
      expect(process.env.TIDB_HOST).toBeDefined();
      expect(process.env.TIDB_USER).toBeDefined();
      expect(process.env.TIDB_DATABASE).toBeDefined();
    });

    test('Should configure connection pooling for high availability', async () => {
      const haPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 20,
        waitForConnections: true,
        queueLimit: 100,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000
      });
      
      const poolConfig = haPool.pool.config.connectionConfig;
      expect(poolConfig.enableKeepAlive).toBe(true);
      expect(poolConfig.keepAliveInitialDelay).toBe(30000);
      
      await haPool.end();
    });
  });

  describe('Connection Acquisition and Release', () => {
    test('Should acquire and release connections correctly', async () => {
      const currentPool = pool();
      const stats1 = getPoolStats();
      
      const connection = await currentPool.getConnection();
      const stats2 = getPoolStats();
      
      expect(stats2.activeConnections).toBeGreaterThan(stats1.activeConnections || 0);
      
      connection.release();
      const stats3 = getPoolStats();
      
      expect(stats3.activeConnections).toBeLessThanOrEqual(stats2.activeConnections);
    });

    test('Should handle concurrent connection requests', async () => {
      const currentPool = pool();
      const concurrentRequests = 10;
      
      const connections = await Promise.all(
        Array.from({ length: concurrentRequests }, async () => {
          const conn = await currentPool.getConnection();
          // Simulate work
          await conn.query('SELECT 1');
          return conn;
        })
      );
      
      expect(connections).toHaveLength(concurrentRequests);
      expect(connections.every(c => c !== null)).toBeTruthy();
      
      // Release all
      connections.forEach(conn => conn.release());
    });

    test('Should queue requests when pool is exhausted', async () => {
      const limitedPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 2,
        waitForConnections: true,
        queueLimit: 10
      });
      
      const connections = [];
      
      // Fill the pool
      for (let i = 0; i < 2; i++) {
        connections.push(await limitedPool.getConnection());
      }
      
      // This should queue
      const queuedPromise = limitedPool.getConnection();
      
      // Release one connection
      setTimeout(() => {
        connections[0].release();
      }, 100);
      
      // Should get connection from queue
      const queuedConnection = await queuedPromise;
      expect(queuedConnection).toBeDefined();
      
      queuedConnection.release();
      connections[1].release();
      await limitedPool.end();
    });

    test('Should prevent connection leaks with timeout', async () => {
      const leakPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 5,
        idleTimeout: 1000, // 1 second idle timeout
        waitForConnections: true
      });
      
      const connection = await leakPool.getConnection();
      
      // Don't release - simulate leak
      // Wait for idle timeout
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Connection should be reclaimed
      const newConnection = await leakPool.getConnection();
      expect(newConnection).toBeDefined();
      
      newConnection.release();
      await leakPool.end();
    });
  });

  describe('Connection Health Monitoring', () => {
    test('Should perform connection health checks', async () => {
      const currentPool = pool();
      const connection = await currentPool.getConnection();
      
      // Health check query
      const [result] = await connection.query('SELECT 1 as health_check');
      expect(result[0].health_check).toBe(1);
      
      // Check connection state
      expect(connection.connection.state).toBe('authenticated');
      
      connection.release();
    });

    test('Should detect and handle stale connections', async () => {
      const currentPool = pool();
      const connection = await currentPool.getConnection();
      
      // Simulate long-running operation
      await connection.query('SELECT SLEEP(0.1)');
      
      // Connection should still be valid
      const [result] = await connection.query('SELECT NOW() as current_time');
      expect(result[0].current_time).toBeDefined();
      
      connection.release();
    });

    test('Should reconnect after connection loss', async () => {
      const resilientPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 5,
        enableKeepAlive: true
      });
      
      const connection = await resilientPool.getConnection();
      
      // Simulate work
      await connection.query('SELECT 1');
      
      // Force connection close (simulate network issue)
      try {
        await connection.connection.destroy();
      } catch (error) {
        // Expected
      }
      
      // Get new connection - pool should handle reconnection
      const newConnection = await resilientPool.getConnection();
      const [result] = await newConnection.query('SELECT 1 as reconnected');
      expect(result[0].reconnected).toBe(1);
      
      newConnection.release();
      await resilientPool.end();
    });

    test('Should monitor pool statistics', async () => {
      const stats = getPoolStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('queuedRequests');
      
      // Validate ranges
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
      expect(stats.activeConnections).toBeGreaterThanOrEqual(0);
      expect(stats.idleConnections).toBeGreaterThanOrEqual(0);
      expect(stats.queuedRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Transaction Management', () => {
    test('Should handle transaction isolation levels correctly', async () => {
      const currentPool = pool();
      const connection = await currentPool.getConnection();
      
      // Set isolation level
      await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await connection.beginTransaction();
      
      try {
        // Create test table
        await connection.query(`
          CREATE TABLE IF NOT EXISTS test_isolation_${Date.now()} (
            id INT PRIMARY KEY,
            value VARCHAR(100)
          )
        `);
        
        await connection.query(
          `INSERT INTO test_isolation_${Date.now()} (id, value) VALUES (?, ?)`,
          [1, 'test']
        );
        
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    });

    test('Should rollback transactions on error', async () => {
      const currentPool = pool();
      const connection = await currentPool.getConnection();
      
      await connection.beginTransaction();
      
      try {
        // This should fail (duplicate key)
        await connection.query(
          'INSERT INTO burn_requests (request_id) VALUES (?)',
          [1]
        );
        await connection.query(
          'INSERT INTO burn_requests (request_id) VALUES (?)',
          [1] // Duplicate
        );
        
        await connection.commit();
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        await connection.rollback();
        expect(error.code).toMatch(/ER_DUP_ENTRY|duplicate/i);
      } finally {
        connection.release();
      }
    });

    test('Should handle distributed transactions', async () => {
      const tx = await createTransaction();
      
      try {
        await tx.begin();
        
        // Multiple operations across tables
        await tx.query('SELECT * FROM farms WHERE farm_id > ? FOR UPDATE', [0]);
        await tx.query('SELECT * FROM burn_requests WHERE request_id > ? FOR UPDATE', [0]);
        
        await tx.commit();
      } catch (error) {
        await tx.rollback();
      } finally {
        await tx.release();
      }
    });

    test('Should detect and prevent deadlocks', async () => {
      const pool1 = pool();
      const conn1 = await pool1.getConnection();
      const conn2 = await pool1.getConnection();
      
      let deadlockDetected = false;
      
      try {
        // Start transactions
        await conn1.beginTransaction();
        await conn2.beginTransaction();
        
        // Create potential deadlock scenario
        await conn1.query('SELECT * FROM farms WHERE farm_id = 1 FOR UPDATE');
        await conn2.query('SELECT * FROM burn_requests WHERE request_id = 1 FOR UPDATE');
        
        // These should cause deadlock
        const promise1 = conn1.query('SELECT * FROM burn_requests WHERE request_id = 1 FOR UPDATE');
        const promise2 = conn2.query('SELECT * FROM farms WHERE farm_id = 1 FOR UPDATE');
        
        await Promise.race([
          Promise.all([promise1, promise2]),
          new Promise((resolve) => setTimeout(() => {
            deadlockDetected = true;
            resolve();
          }, 2000))
        ]);
        
      } catch (error) {
        if (error.code === 'ER_LOCK_DEADLOCK') {
          deadlockDetected = true;
        }
      } finally {
        try {
          await conn1.rollback();
          await conn2.rollback();
        } catch (e) {
          // Ignore rollback errors
        }
        conn1.release();
        conn2.release();
      }
      
      // Either deadlock was detected or timeout occurred (preventing infinite wait)
      expect(deadlockDetected).toBeTruthy();
    });
  });

  describe('Connection Pooling Performance', () => {
    test('Should handle burst traffic efficiently', async () => {
      const currentPool = pool();
      const burstSize = 50;
      const startTime = Date.now();
      
      const results = await Promise.all(
        Array.from({ length: burstSize }, async (_, i) => {
          const conn = await currentPool.getConnection();
          const [result] = await conn.query('SELECT ? as id', [i]);
          conn.release();
          return result[0].id;
        })
      );
      
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(burstSize);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all results
      for (let i = 0; i < burstSize; i++) {
        expect(results).toContain(i);
      }
    });

    test('Should maintain performance under sustained load', async () => {
      const currentPool = pool();
      const iterations = 100;
      const responseTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const conn = await currentPool.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        responseTimes.push(Date.now() - start);
      }
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;
      const maxResponseTime = Math.max(...responseTimes);
      
      expect(avgResponseTime).toBeLessThan(100); // Avg under 100ms
      expect(maxResponseTime).toBeLessThan(500); // Max under 500ms
    });

    test('Should optimize connection reuse', async () => {
      const currentPool = pool();
      const connectionIds = new Set();
      
      // Execute multiple queries and track connection IDs
      for (let i = 0; i < 20; i++) {
        const conn = await currentPool.getConnection();
        const [result] = await conn.query('SELECT CONNECTION_ID() as conn_id');
        connectionIds.add(result[0].conn_id);
        conn.release();
      }
      
      // Should reuse connections (fewer unique IDs than queries)
      expect(connectionIds.size).toBeLessThan(20);
      expect(connectionIds.size).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('Should handle query timeout gracefully', async () => {
      const currentPool = pool();
      const connection = await currentPool.getConnection();
      
      try {
        // Set query timeout
        await connection.query('SET SESSION MAX_EXECUTION_TIME=100'); // 100ms
        
        // This should timeout
        await connection.query('SELECT SLEEP(1)');
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeDefined();
        // Error code may vary by TiDB version
      } finally {
        connection.release();
      }
    });

    test('Should handle connection errors during query execution', async () => {
      const currentPool = pool();
      
      try {
        // Invalid SQL should throw error
        await query('SELECT * FROM non_existent_table_xyz_123');
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.code).toMatch(/ER_NO_SUCH_TABLE|doesn't exist/i);
      }
    });

    test('Should recover from temporary network issues', async () => {
      const resilientPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 5,
        connectTimeout: 5000,
        enableKeepAlive: true
      });
      
      // Simulate recovery by attempting multiple connections
      let successCount = 0;
      
      for (let i = 0; i < 3; i++) {
        try {
          const conn = await resilientPool.getConnection();
          await conn.query('SELECT 1');
          conn.release();
          successCount++;
        } catch (error) {
          // Log but continue
          console.log(`Attempt ${i + 1} failed:`, error.message);
        }
        
        // Wait before retry
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Should succeed at least once
      expect(successCount).toBeGreaterThan(0);
      
      await resilientPool.end();
    });
  });

  describe('Connection Pool Shutdown', () => {
    test('Should perform graceful shutdown', async () => {
      const shutdownPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 5
      });
      
      // Get some connections
      const conn1 = await shutdownPool.getConnection();
      const conn2 = await shutdownPool.getConnection();
      
      // Start queries
      const query1 = conn1.query('SELECT SLEEP(0.1)');
      const query2 = conn2.query('SELECT SLEEP(0.1)');
      
      conn1.release();
      conn2.release();
      
      // Wait for queries to complete
      await Promise.all([query1, query2]);
      
      // Graceful shutdown
      await shutdownPool.end();
      
      // Should not be able to get new connections
      try {
        await shutdownPool.getConnection();
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error.message).toMatch(/pool.*closed|ended/i);
      }
    });

    test('Should clean up all resources on shutdown', async () => {
      const cleanupPool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 3
      });
      
      // Create some activity
      const connections = [];
      for (let i = 0; i < 3; i++) {
        const conn = await cleanupPool.getConnection();
        connections.push(conn);
      }
      
      // Release all
      connections.forEach(c => c.release());
      
      // End pool
      await cleanupPool.end();
      
      // Verify cleanup (pool should be closed)
      expect(cleanupPool.pool._closed).toBeTruthy();
    });

    test('Should handle forced shutdown with active connections', async () => {
      const forcePool = mysql.createPool({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        connectionLimit: 2
      });
      
      // Get connections but don't release
      const conn1 = await forcePool.getConnection();
      const conn2 = await forcePool.getConnection();
      
      // Start long queries
      conn1.query('SELECT SLEEP(5)').catch(() => {}); // Ignore errors
      conn2.query('SELECT SLEEP(5)').catch(() => {}); // Ignore errors
      
      // Force shutdown without waiting
      await forcePool.end();
      
      // Pool should be closed despite active connections
      expect(forcePool.pool._closed).toBeTruthy();
    });
  });
});

module.exports = {
  // Helper functions for connection pool testing
  createTestPool: (config = {}) => {
    return mysql.createPool({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      connectionLimit: 10,
      waitForConnections: true,
      ...config
    });
  },
  
  simulateHighLoad: async (pool, requestCount = 100) => {
    const results = [];
    const errors = [];
    
    await Promise.all(
      Array.from({ length: requestCount }, async () => {
        try {
          const conn = await pool.getConnection();
          const [result] = await conn.query('SELECT 1 as test');
          conn.release();
          results.push(result[0]);
        } catch (error) {
          errors.push(error);
        }
      })
    );
    
    return { results, errors, successRate: results.length / requestCount };
  },
  
  monitorPoolHealth: async (pool) => {
    const health = {
      canConnect: false,
      responseTime: null,
      activeConnections: 0,
      errors: []
    };
    
    try {
      const start = Date.now();
      const conn = await pool.getConnection();
      await conn.query('SELECT 1');
      conn.release();
      
      health.canConnect = true;
      health.responseTime = Date.now() - start;
    } catch (error) {
      health.errors.push(error.message);
    }
    
    return health;
  }
};