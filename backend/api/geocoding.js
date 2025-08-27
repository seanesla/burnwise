/**
 * Geocoding API - Proxy for Mapbox Geocoding API v6
 * Handles location search with autocomplete for farm location selection
 * Real implementation - no mocks
 */

const express = require('express');
const axios = require('axios');
const logger = require('../middleware/logger');

const router = express.Router();

// Mapbox configuration
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || process.env.REACT_APP_MAPBOX_TOKEN;
const MAPBOX_GEOCODING_API = 'https://api.mapbox.com/search/geocode/v6/forward';

/**
 * GET /api/geocoding/search
 * Forward geocoding - search for locations by text query
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    
    if (!q || q.trim().length < 3) {
      return res.json({ features: [] });
    }
    
    if (!MAPBOX_TOKEN) {
      logger.error('Mapbox token not configured');
      return res.status(500).json({
        error: 'Geocoding service not configured'
      });
    }
    
    // Make request to Mapbox Geocoding API v6
    const response = await axios.get(MAPBOX_GEOCODING_API, {
      params: {
        q: q.trim(),
        access_token: MAPBOX_TOKEN,
        autocomplete: true,
        limit: limit,
        types: 'address,place,poi,locality,neighborhood',
        country: 'US',
        language: 'en'
      }
    });
    
    // Return the features directly
    res.json({
      features: response.data.features || []
    });
    
  } catch (error) {
    logger.error('Geocoding search failed', {
      error: error.message,
      query: req.query.q,
      status: error.response?.status
    });
    
    if (error.response?.status === 401) {
      res.status(401).json({
        error: 'Invalid Mapbox token'
      });
    } else if (error.response?.status === 429) {
      res.status(429).json({
        error: 'Rate limit exceeded'
      });
    } else {
      res.status(500).json({
        error: 'Geocoding search failed'
      });
    }
  }
});

/**
 * GET /api/geocoding/reverse
 * Reverse geocoding - get location from coordinates
 */
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lng, lon } = req.query;
    const longitude = lng || lon;
    
    if (!lat || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required'
      });
    }
    
    if (!MAPBOX_TOKEN) {
      logger.error('Mapbox token not configured');
      return res.status(500).json({
        error: 'Geocoding service not configured'
      });
    }
    
    // Make request to Mapbox Geocoding API v6 reverse endpoint
    const response = await axios.get(
      `https://api.mapbox.com/search/geocode/v6/reverse`,
      {
        params: {
          longitude: parseFloat(longitude),
          latitude: parseFloat(lat),
          access_token: MAPBOX_TOKEN,
          types: 'address,place,locality',
          language: 'en'
        }
      }
    );
    
    res.json({
      features: response.data.features || []
    });
    
  } catch (error) {
    logger.error('Reverse geocoding failed', {
      error: error.message,
      lat: req.query.lat,
      lng: req.query.lng || req.query.lon
    });
    
    res.status(500).json({
      error: 'Reverse geocoding failed'
    });
  }
});

module.exports = router;