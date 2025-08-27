const logger = require('./logger');

/**
 * Performance optimization middleware for API responses
 */

/**
 * Add ETag support for better caching
 */
function generateETag(data) {
  const crypto = require('crypto');
  return crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Response cache middleware with ETag support
 */
function responseCacheMiddleware(defaultTTL = 60) {
  return (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;

    // Override json method to add caching headers
    res.json = function(data) {
      // Generate ETag for response
      const etag = generateETag(data);
      
      // Check if client has matching ETag
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }

      // Set cache headers
      res.set({
        'ETag': etag,
        'Cache-Control': `private, max-age=${defaultTTL}`,
        'X-Response-Time': Date.now() - req.startTime + 'ms'
      });

      return originalJson.call(this, data);
    };

    // Track request start time
    req.startTime = Date.now();
    next();
  };
}

/**
 * Query parameter optimization - normalize and sanitize
 */
function optimizeQueryParams(req, res, next) {
  // Normalize pagination params
  if (req.query) {
    if (req.query.page) {
      req.query.page = Math.max(1, parseInt(req.query.page) || 1);
    }
    if (req.query.limit) {
      req.query.limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    }
    if (req.query.offset !== undefined) {
      req.query.offset = Math.max(0, parseInt(req.query.offset) || 0);
    }
  }
  next();
}

/**
 * Connection pooling monitor
 */
async function monitorConnectionPool(pool, io) {
  setInterval(async () => {
    try {
      const poolStatus = {
        total: pool.pool._allConnections.length,
        free: pool.pool._freeConnections.length,
        queued: pool.pool._connectionQueue.length
      };
      
      if (io) {
        io.emit('backend.pool', {
          ...poolStatus,
          timestamp: new Date().toISOString()
        });
      }
      
      // Log warning if pool is saturated
      if (poolStatus.free === 0 && poolStatus.queued > 10) {
        logger.warn('Connection pool saturated', poolStatus);
      }
    } catch (error) {
      // Silently handle monitoring errors
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Batch query optimization for related data
 */
async function batchQuery(queries, connection) {
  const results = await Promise.all(
    queries.map(({ sql, params, options }) =>
      connection.query(sql, params, options).catch(err => {
        logger.error('Batch query failed', { sql, error: err.message });
        return null;
      })
    )
  );
  return results;
}

/**
 * Request deduplication middleware
 */
const pendingRequests = new Map();

function deduplicateRequests() {
  return async (req, res, next) => {
    // Only deduplicate GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const requestKey = `${req.method}:${req.originalUrl}`;
    
    // Check if identical request is pending
    if (pendingRequests.has(requestKey)) {
      const pendingPromise = pendingRequests.get(requestKey);
      
      try {
        const result = await pendingPromise;
        return res.json(result);
      } catch (error) {
        // If pending request failed, continue with new request
        pendingRequests.delete(requestKey);
        return next();
      }
    }

    // Create promise for this request
    const requestPromise = new Promise((resolve, reject) => {
      const originalJson = res.json;
      const originalStatus = res.status;
      let statusCode = 200;

      res.status = function(code) {
        statusCode = code;
        return originalStatus.call(this, code);
      };

      res.json = function(data) {
        pendingRequests.delete(requestKey);
        
        if (statusCode >= 200 && statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Request failed with status ${statusCode}`));
        }
        
        return originalJson.call(this, data);
      };
    });

    pendingRequests.set(requestKey, requestPromise);
    
    // Clean up after timeout
    setTimeout(() => {
      pendingRequests.delete(requestKey);
    }, 5000);

    next();
  };
}

/**
 * Memory usage monitor
 */
function monitorMemoryUsage(io) {
  setInterval(() => {
    const usage = process.memoryUsage();
    const stats = {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      timestamp: new Date().toISOString()
    };

    if (io) {
      io.emit('backend.memory', stats);
    }

    // Warn if memory usage is high
    if (stats.heapUsed > 500) {
      logger.warn('High memory usage detected', stats);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection');
      }
    }
  }, 60000); // Check every minute
}

module.exports = {
  responseCacheMiddleware,
  optimizeQueryParams,
  monitorConnectionPool,
  batchQuery,
  deduplicateRequests,
  monitorMemoryUsage,
  generateETag
};