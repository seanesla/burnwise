/**
 * HTTP Cache Headers Middleware
 * Optimizes client-side caching to reduce server load
 */

const cacheProfiles = {
  // No caching for sensitive data
  noCache: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
  
  // Short cache for frequently changing data
  shortCache: {
    'Cache-Control': 'public, max-age=60, s-maxage=60', // 1 minute
    'Vary': 'Accept-Encoding'
  },
  
  // Medium cache for semi-static data
  mediumCache: {
    'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minutes
    'Vary': 'Accept-Encoding'
  },
  
  // Long cache for static data
  longCache: {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1 hour
    'Vary': 'Accept-Encoding'
  },
  
  // Immutable cache for truly static assets
  immutable: {
    'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
    'Vary': 'Accept-Encoding'
  }
};

/**
 * Apply cache headers based on route pattern
 */
function applyCacheHeaders(profile = 'noCache') {
  return (req, res, next) => {
    const headers = cacheProfiles[profile] || cacheProfiles.noCache;
    
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // Add ETag support for conditional requests
    if (profile !== 'noCache') {
      res.setHeader('ETag', `W/"${Date.now()}"`);
    }
    
    next();
  };
}

/**
 * Smart caching middleware that determines cache strategy based on route
 */
function smartCache(req, res, next) {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();
  
  // Only cache GET requests
  if (method !== 'GET') {
    return applyCacheHeaders('noCache')(req, res, next);
  }
  
  // Determine cache profile based on route
  if (path.includes('/api/weather')) {
    // Weather data changes frequently but can be cached briefly
    return applyCacheHeaders('shortCache')(req, res, next);
  } else if (path.includes('/api/farms')) {
    // Farm data doesn't change often
    return applyCacheHeaders('mediumCache')(req, res, next);
  } else if (path.includes('/api/analytics')) {
    // Analytics can be cached for medium duration
    return applyCacheHeaders('mediumCache')(req, res, next);
  } else if (path.includes('/api/burn-requests') && !path.includes('/api/burn-requests/')) {
    // List queries can be cached briefly
    return applyCacheHeaders('shortCache')(req, res, next);
  } else if (path.includes('/health')) {
    // Health checks shouldn't be cached
    return applyCacheHeaders('noCache')(req, res, next);
  } else if (path.includes('/static/')) {
    // Static assets can be cached long-term
    return applyCacheHeaders('immutable')(req, res, next);
  } else {
    // Default to no cache for safety
    return applyCacheHeaders('noCache')(req, res, next);
  }
}

/**
 * Add conditional request support (If-Modified-Since, If-None-Match)
 */
function conditionalRequests(req, res, next) {
  const ifModifiedSince = req.headers['if-modified-since'];
  const ifNoneMatch = req.headers['if-none-match'];
  
  // Store original json method
  const originalJson = res.json;
  
  res.json = function(data) {
    // Generate ETag based on data
    const etag = `W/"${JSON.stringify(data).length}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', new Date().toUTCString());
    
    // Check if client has valid cached version
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
}

module.exports = {
  applyCacheHeaders,
  smartCache,
  conditionalRequests,
  cacheProfiles
};