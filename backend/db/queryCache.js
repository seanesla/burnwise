const logger = require('../middleware/logger');

// Store io reference for Socket.io emissions
let io = null;

/**
 * Simple in-memory cache for query results
 * Reduces database load for frequently accessed data
 */
class QueryCache {
  constructor() {
    this.cache = new Map();
    this.ttlTimers = new Map();
    this.hits = 0;
    this.misses = 0;
    this.maxSize = 1000; // Maximum number of cached items
    this.defaultTTL = 60000; // 1 minute default TTL
    
    // Start metrics logging
    setInterval(() => this.logMetrics(), 300000); // Log every 5 minutes
  }

  /**
   * Generate cache key from query and params
   */
  generateKey(query, params = []) {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();
    return `${normalizedQuery}::${JSON.stringify(params)}`;
  }

  /**
   * Get cached result if available and not expired
   */
  get(query, params = []) {
    const key = this.generateKey(query, params);
    const cached = this.cache.get(key);
    
    if (cached) {
      this.hits++;
      logger.debug('Cache hit', { key: key.substring(0, 50) });
      return cached.data;
    }
    
    this.misses++;
    return null;
  }

  /**
   * Store query result in cache with TTL
   */
  set(query, params, data, ttl = this.defaultTTL) {
    const key = this.generateKey(query, params);
    
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }
    
    // Clear existing timer if any
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
    }
    
    // Store data
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Set TTL timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);
    
    this.ttlTimers.set(key, timer);
    
    logger.debug('Cache set', { 
      key: key.substring(0, 50), 
      ttl,
      size: this.cache.size 
    });
  }

  /**
   * Delete specific cache entry
   */
  delete(key) {
    this.cache.delete(key);
    
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
      this.ttlTimers.delete(key);
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    // Clear all timers
    for (const timer of this.ttlTimers.values()) {
      clearTimeout(timer);
    }
    
    this.cache.clear();
    this.ttlTimers.clear();
    this.hits = 0;
    this.misses = 0;
    
    logger.info('Query cache cleared');
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern, 'i');
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key);
    }
    
    logger.debug('Cache invalidated', { 
      pattern, 
      invalidated: keysToDelete.length 
    });
  }

  /**
   * Log cache metrics
   */
  logMetrics() {
    const hitRate = this.hits + this.misses > 0 
      ? (this.hits / (this.hits + this.misses) * 100).toFixed(2)
      : 0;
      
    logger.info('Query cache metrics', {
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.maxSize
    });
    
    // Emit to frontend if io available
    if (io) {
      io.emit('backend.cache', {
        hits: this.hits,
        misses: this.misses,
        hitRate: `${hitRate}%`,
        size: this.cache.size,
        maxSize: this.maxSize,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 
        ? (this.hits / (this.hits + this.misses) * 100).toFixed(2) + '%'
        : '0%',
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

// Singleton instance
const queryCache = new QueryCache();

// Setter for Socket.io instance
queryCache.setIO = (socketIO) => {
  io = socketIO;
  logger.debug('Socket.io instance set for queryCache');
};

// Cache invalidation rules for different tables
const invalidationRules = {
  'burn_requests': ['burn_requests', 'v_burn_requests_summary', 'v_dashboard_metrics'],
  'farms': ['farms', 'v_burn_requests_summary'],
  'weather_data': ['weather_data'],
  'smoke_predictions': ['smoke_predictions', 'v_burn_requests_summary'],
  'alerts': ['alerts'],
  'burn_schedule': ['burn_schedule', 'v_dashboard_metrics']
};

/**
 * Invalidate related caches when data changes
 */
function invalidateRelatedCaches(tableName) {
  const patterns = invalidationRules[tableName] || [tableName];
  
  for (const pattern of patterns) {
    queryCache.invalidatePattern(pattern);
  }
}

module.exports = {
  queryCache,
  invalidateRelatedCaches
};