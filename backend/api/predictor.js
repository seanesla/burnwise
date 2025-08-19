/**
 * Predictor API Routes - Expose Gaussian plume model for smoke dispersion
 * REAL endpoints for smoke prediction calculations
 */

const express = require('express');
const router = express.Router();
const predictorAgent = require('../agents/predictor');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

/**
 * POST /api/predictor/smoke-dispersion
 * Calculate smoke dispersion using Gaussian plume model
 */
router.post('/smoke-dispersion', async (req, res) => {
  try {
    const { 
      burnData,
      weatherData,
      burnRequestId = null 
    } = req.body;
    
    // Validate required fields
    if (!burnData || !weatherData) {
      return res.status(400).json({ 
        error: 'Burn data and weather data are required' 
      });
    }
    
    // Ensure required burn data fields
    if (!burnData.acres || !burnData.crop_type) {
      return res.status(400).json({ 
        error: 'Acres and crop type are required in burn data' 
      });
    }
    
    // Ensure required weather data fields
    if (weatherData.wind_speed === undefined || weatherData.wind_direction === undefined) {
      return res.status(400).json({ 
        error: 'Wind speed and direction are required in weather data' 
      });
    }
    
    // Add default field boundary if not provided
    if (!burnData.field_boundary) {
      burnData.field_boundary = {
        type: 'Polygon',
        coordinates: [[
          [-98.5, 30.2], 
          [-98.5, 30.3], 
          [-98.4, 30.3], 
          [-98.4, 30.2], 
          [-98.5, 30.2]
        ]]
      };
    }
    
    logger.info('Smoke dispersion calculation requested', {
      acres: burnData.acres,
      cropType: burnData.crop_type,
      windSpeed: weatherData.wind_speed
    });
    
    // Initialize predictor if needed
    if (!predictorAgent.initialized) {
      await predictorAgent.initialize();
    }
    
    // Run smoke dispersion prediction without storing (null request ID)
    const result = await predictorAgent.predictSmokeDispersion(
      null, // Don't store in database for API-only calls
      burnData,
      weatherData
    );
    
    res.json({
      success: true,
      dispersion: {
        maxRadius: result.maxDispersionRadius,
        affectedArea: result.affectedArea,
        concentrationMap: result.concentrationMap,
        pm25Peak: result.pm25Peak,
        safetyAssessment: result.safetyAssessment,
        conflicts: result.conflicts || []
      },
      metadata: {
        emissionRate: result.emissionRate,
        stabilityClass: result.stabilityClass,
        windSpeed: weatherData.wind_speed,
        windDirection: weatherData.wind_direction
      }
    });
    
  } catch (error) {
    logger.error('Smoke dispersion calculation failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to calculate smoke dispersion',
      details: error.message 
    });
  }
});

/**
 * POST /api/predictor/gaussian-plume
 * Direct access to Gaussian plume calculations
 */
router.post('/gaussian-plume', async (req, res) => {
  try {
    const {
      emissionRate = 1.0, // kg/s
      windSpeed = 5.0,    // m/s
      windDirection = 0,  // degrees
      sourceHeight = 2.0, // meters
      receptorDistance = 1000, // meters
      stabilityClass = 'D'
    } = req.body;
    
    logger.info('Direct Gaussian plume calculation requested', {
      emissionRate,
      windSpeed,
      receptorDistance
    });
    
    // Initialize predictor if needed
    if (!predictorAgent.initialized) {
      await predictorAgent.initialize();
    }
    
    // Calculate dispersion parameters using stability class
    const stability = predictorAgent.stabilityClasses[stabilityClass];
    if (!stability) {
      return res.status(400).json({ 
        error: 'Invalid stability class. Use A-F' 
      });
    }
    
    // Calculate sigma_y and sigma_z
    const sigmaY = predictorAgent.calculateSigmaY(receptorDistance, stability.sigmay);
    const sigmaZ = predictorAgent.calculateSigmaZ(receptorDistance, stability.sigmaz);
    
    // Run Gaussian plume calculation directly
    const concentration = predictorAgent.calculateCenterlineConcentration(
      emissionRate,
      windSpeed,
      sigmaY,
      sigmaZ,
      sourceHeight,
      0 // receptor height
    );
    
    res.json({
      success: true,
      concentration,
      units: 'µg/m³',
      parameters: {
        emissionRate,
        windSpeed,
        windDirection,
        sourceHeight,
        receptorDistance,
        stabilityClass
      }
    });
    
  } catch (error) {
    logger.error('Gaussian plume calculation failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to calculate Gaussian plume',
      details: error.message 
    });
  }
});

/**
 * POST /api/predictor/conflict-check
 * Check for conflicts with other burns
 */
router.post('/conflict-check', async (req, res) => {
  try {
    const { 
      location,
      date,
      radius = 10 // km
    } = req.body;
    
    if (!location || !date) {
      return res.status(400).json({ 
        error: 'Location and date are required' 
      });
    }
    
    logger.info('Conflict check requested', { location, date, radius });
    
    // Query for nearby burns on the same date
    const nearbyBurns = await query(`
      SELECT 
        br.request_id,
        br.farm_id,
        br.acreage,
        br.crop_type,
        f.name as farm_name,
        f.latitude,
        f.longitude,
        ST_Distance_Sphere(
          POINT(?, ?),
          POINT(f.longitude, f.latitude)
        ) / 1000 as distance_km
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.requested_date = ?
        AND br.status IN ('approved', 'pending')
        AND ST_Distance_Sphere(
          POINT(?, ?),
          POINT(f.longitude, f.latitude)
        ) / 1000 < ?
      ORDER BY distance_km ASC
    `, [
      location.lng, location.lat,
      date,
      location.lng, location.lat,
      radius
    ]);
    
    res.json({
      success: true,
      conflicts: nearbyBurns,
      conflictCount: nearbyBurns.length,
      searchRadius: radius,
      message: nearbyBurns.length > 0 
        ? `Found ${nearbyBurns.length} potential conflicts within ${radius}km`
        : 'No conflicts detected'
    });
    
  } catch (error) {
    logger.error('Conflict check failed', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to check for conflicts',
      details: error.message 
    });
  }
});

/**
 * GET /api/predictor/emission-factors
 * Get emission factors for different crop types
 */
router.get('/emission-factors', async (req, res) => {
  try {
    // Initialize predictor if needed
    if (!predictorAgent.initialized) {
      await predictorAgent.initialize();
    }
    
    res.json({
      success: true,
      emissionFactors: predictorAgent.emissionFactors,
      units: 'kg PM2.5 per ton burned',
      pm25Standards: predictorAgent.pm25Standards,
      stabilityClasses: Object.keys(predictorAgent.stabilityClasses)
    });
    
  } catch (error) {
    logger.error('Failed to get emission factors', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to get emission factors',
      details: error.message 
    });
  }
});

module.exports = router;