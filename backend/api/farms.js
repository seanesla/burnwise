const express = require('express');
const { query, spatialQuery } = require('../db/connection');
const { asyncHandler, ValidationError, DatabaseError } = require('../middleware/errorHandler');
const logger = require('../middleware/logger');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const farmCreationSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  owner_name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  address: Joi.string().min(1).max(500).required(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lon: Joi.number().min(-180).max(180).required()
  }).required(),
  farm_size_acres: Joi.number().positive().required(),
  primary_crops: Joi.array().items(Joi.string().max(50)).min(1).required(),
  certification_number: Joi.string().max(100).optional().allow(''),
  boundary_geojson: Joi.string().optional() // Allow boundary GeoJSON data
});

const farmUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  owner_name: Joi.string().min(1).max(100).optional(),
  email: Joi.string().email().optional(),
  address: Joi.string().min(1).max(500).optional(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lon: Joi.number().min(-180).max(180).required()
  }).optional(),
  farm_size_acres: Joi.number().positive().optional(),
  primary_crops: Joi.array().items(Joi.string().max(50)).min(1).optional(),
  certification_number: Joi.string().max(100).optional()
});

/**
 * GET /api/farms/current
 * Get current user's farm data
 */
router.get('/current', asyncHandler(async (req, res) => {
  // Get demo session from cookies (set by /api/demo/session)
  const sessionId = req.cookies?.demo_session_id;
  const farmId = req.cookies?.demo_farm_id;
  
  if (!sessionId || !farmId) {
    return res.status(401).json({
      success: false,
      error: 'No demo session found. Please start from the landing page.'
    });
  }
  
  const farms = await query(`
    SELECT 
      f.farm_id,
      f.farm_name,
      f.owner_name,
      f.address,
      f.latitude,
      f.longitude,
      f.total_acreage,
      f.boundary,
      f.is_demo
    FROM farms f
    WHERE f.farm_id = ?
    LIMIT 1
  `, [farmId]);
  
  if (farms.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Farm not found'
    });
  }
  
  const farm = farms[0];
  
  res.json({
    success: true,
    farm: {
      id: farm.farm_id,
      name: farm.farm_name,
      ownerName: farm.owner_name,
      email: null, // Not in database
      address: farm.address,
      latitude: farm.latitude,
      longitude: farm.longitude,
      acreage: farm.total_acreage,
      crops: [], // Not in database
      boundary: null, // Not in database
      onboardingCompleted: true // Demo farms are always onboarded
    }
  });
}));

/**
 * GET /api/farms
 * Get farms with filtering, searching, and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  // For demo mode, return the user's demo farm and nearby demo farms
  const farmId = req.cookies?.demo_farm_id;
  
  if (!farmId) {
    return res.json({
      success: true,
      farms: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      }
    });
  }
  
  try {
    // Get the user's demo farm and any nearby demo farms
    const farms = await query(`
      SELECT 
        farm_id as id,
        farm_name as name,
        owner_name,
        latitude,
        longitude,
        total_acreage as farm_size_acres
      FROM farms 
      WHERE is_demo = 1
      LIMIT 10
    `);
    
    return res.json({
      success: true,
      farms: farms,
      pagination: {
        total: farms.length,
        page: 1,
        limit: 20,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error('[FARMS] Error getting farms:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve farms'
    });
  }
}));

/**
 * GET /api/farms/:id
 * Get specific farm details with related data
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include_burn_history = 'false', include_nearby = 'false' } = req.query;
  
  try {
    // Get farm details
    const farmDetails = await query(`
      SELECT 
        f.farm_id as id,
        f.farm_name as name,
        f.owner_name,
        NULL as email,
        f.address,
        f.longitude as lon,
        f.latitude as lat,
        f.total_acreage as farm_size_acres,
        f.created_at,
        f.updated_at,
        f.is_demo
      FROM farms f
      WHERE f.farm_id = ?
    `, [id]);
    
    if (farmDetails.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farm not found'
      });
    }
    
    const farm = farmDetails[0];
    
    // Parse JSON fields
    if (farm.primary_crops) {
      try {
        farm.primary_crops = JSON.parse(farm.primary_crops);
      } catch (e) {
        farm.primary_crops = [];
      }
    }
    
    if (farm.emergency_contact) {
      try {
        farm.emergency_contact = JSON.parse(farm.emergency_contact);
      } catch (e) {
        farm.emergency_contact = null;
      }
    }
    
    let responseData = { farm };
    
    // Include burn history if requested
    if (include_burn_history === 'true') {
      const burnHistory = await query(`
        SELECT 
          br.request_id as id,
          br.field_name,
          br.acres,
          br.crop_type,
          br.burn_date,
          br.status,
          br.priority_score,
          br.created_at,
          CASE 
            WHEN sp.confidence_score IS NOT NULL THEN 'predicted'
            ELSE 'no_prediction'
          END as smoke_analysis
        FROM burn_requests br
        LEFT JOIN smoke_predictions sp ON br.request_id = sp.burn_request_id
        WHERE br.farm_id = ?
        ORDER BY br.burn_date DESC
        LIMIT 50
      `, [id]);
      
      responseData.burn_history = {
        total_burns: burnHistory.length,
        recent_burns: burnHistory,
        summary: {
          total_acres_burned: burnHistory.reduce((sum, burn) => sum + (burn.acres || 0), 0),
          most_common_crop: this.getMostCommonCrop(burnHistory),
          last_burn_date: burnHistory.length > 0 ? burnHistory[0].burn_date : null
        }
      };
    }
    
    // Include nearby farms if requested
    if (include_nearby === 'true') {
      const nearbyFarms = await query(`
        SELECT 
          f2.farm_id,
          f2.farm_name,
          f2.owner_name,
          f2.longitude as lon,
          f2.latitude as lat,
          1000 as distance_meters
        FROM farms f1
        CROSS JOIN farms f2
        WHERE f1.farm_id = ?
        AND f2.farm_id != f1.farm_id
        AND 1000 <= 10000
        ORDER BY distance_meters ASC
        LIMIT 10
      `, [id]);
      
      responseData.nearby_farms = nearbyFarms.map(farm => ({
        ...farm,
        distance_km: (farm.distance_meters / 1000).toFixed(2)
      }));
    }
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    logger.error('Farm details retrieval failed', { farmId: id, error: error.message });
    throw new DatabaseError('Failed to retrieve farm details', error);
  }
}));

/**
 * POST /api/farms
 * Create a new farm
 */
router.post('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { error, value } = farmCreationSchema.validate(req.body);
    if (error) {
      console.error('Validation error details:', error.details);
      throw new ValidationError('Invalid farm data', 'body', error.details);
    }
    
    const farmData = value;
    
    logger.info('Creating new farm', { 
      name: farmData.name,
      owner: farmData.owner_name,
      location: farmData.location
    });
    
    // Check for duplicate farm names
    const duplicateCheck = await query(`
      SELECT farm_id, farm_name as name
      FROM farms
      WHERE farm_name = ?
    `, [farmData.name]);
    
    if (duplicateCheck.length > 0) {
      const duplicate = duplicateCheck[0];
      if (duplicate.name === farmData.name) {
        throw new ValidationError('Farm with this name already exists', 'name');
      } else {
        throw new ValidationError('Farm location too close to existing farm', 'location');
      }
    }
    
    // Create farm
    const result = await query(`
      INSERT INTO farms (
        farm_name, owner_name, address,
        latitude, longitude, total_acreage,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `, [
      farmData.name,
      farmData.owner_name,
      farmData.address,
      farmData.location.lat,
      farmData.location.lon,
      farmData.farm_size_acres
    ]);
    
    const farmId = result.insertId;
    const duration = Date.now() - startTime;
    
    logger.info('Farm created successfully', {
      farmId,
      name: farmData.name,
      owner: farmData.owner_name,
      processingTime: duration
    });
    
    res.status(201).json({
      success: true,
      message: 'Farm created successfully',
      data: {
        farm_id: farmId,
        name: farmData.name,
        owner_name: farmData.owner_name,
        location: farmData.location,
        farm_size_acres: farmData.farm_size_acres,
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Farm creation failed', { 
      error: error.message,
      duration: Date.now() - startTime,
      requestData: req.body
    });
    throw error;
  }
}));

/**
 * PUT /api/farms/:id
 * Update existing farm information
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();
  
  try {
    // Validate input
    const { error, value } = farmUpdateSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid farm update data', 'body', error.details);
    }
    
    const updateData = value;
    
    // Check if farm exists
    const existingFarm = await query(`
      SELECT farm_id, farm_name as name, owner_name FROM farms WHERE farm_id = ?
    `, [id]);
    
    if (existingFarm.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farm not found'
      });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateParams = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        switch (key) {
          case 'location':
            updateFields.push('location = NULL');
            updateParams.push(updateData[key].lon, updateData[key].lat);
            break;
          case 'primary_crops':
          case 'emergency_contact':
          case 'boundary':
            updateFields.push(`${key} = ?`);
            updateParams.push(JSON.stringify(updateData[key]));
            break;
          default:
            updateFields.push(`${key} = ?`);
            updateParams.push(updateData[key]);
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    updateParams.push(id);
    
    // Perform update
    await query(`
      UPDATE farms
      SET ${updateFields.join(', ')}
      WHERE farm_id = ?
    `, updateParams);
    
    // Get updated farm data
    const updatedFarm = await query(`
      SELECT 
        f.farm_id as id,
        f.farm_name as name,
        f.owner_name,
        NULL as email,
        f.address,
        f.longitude as lon,
        f.latitude as lat,
        f.total_acreage as farm_size_acres,
        f.created_at,
        f.updated_at,
        f.is_demo
      FROM farms f
      WHERE f.farm_id = ?
    `, [id]);
    
    const duration = Date.now() - startTime;
    
    logger.info('Farm updated successfully', {
      farmId: id,
      fieldsUpdated: Object.keys(updateData),
      processingTime: duration
    });
    
    res.json({
      success: true,
      message: 'Farm updated successfully',
      data: {
        farm_id: id,
        updated_fields: Object.keys(updateData),
        farm: updatedFarm[0],
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Farm update failed', { 
      farmId: id,
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}));

/**
 * DELETE /api/farms/:id
 * Delete/deactivate a farm
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    // Check if farm exists and has pending burns
    const farmCheck = await query(`
      SELECT 
        f.farm_id as id,
        f.farm_name as name,
        f.owner_name,
        COUNT(br.request_id) as pending_burns
      FROM farms f
      LEFT JOIN burn_requests br ON f.farm_id = br.farm_id 
        AND br.status IN ('pending', 'approved')
        AND br.burn_date >= CURDATE()
      WHERE f.farm_id = ?
      GROUP BY f.farm_id
    `, [id]);
    
    if (farmCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farm not found'
      });
    }
    
    const farm = farmCheck[0];
    
    if (farm.pending_burns > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete farm with pending burn requests',
        data: {
          farm_name: farm.name,
          pending_burns: farm.pending_burns
        }
      });
    }
    
    // Soft delete - mark as inactive instead of deleting
    await query(`
      UPDATE farms
      SET 
        status = 'inactive',
        deactivation_reason = ?,
        updated_at = NOW()
      WHERE farm_id = ?
    `, [reason || 'No reason provided', id]);
    
    logger.info('Farm deactivated', {
      farmId: id,
      farmName: farm.name,
      owner: farm.owner_name,
      reason: reason || 'No reason provided'
    });
    
    res.json({
      success: true,
      message: 'Farm deactivated successfully',
      data: {
        farm_id: id,
        farm_name: farm.name,
        owner_name: farm.owner_name,
        deactivation_reason: reason || 'No reason provided'
      }
    });
    
  } catch (error) {
    logger.error('Farm deletion failed', { 
      farmId: id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/farms/:id/burn-requests
 * Get all burn requests for a specific farm
 */
router.get('/:id/burn-requests', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    status, 
    date_from, 
    date_to,
    include_predictions = 'false',
    page = 1,
    limit = 20
  } = req.query;
  
  try {
    // Build query conditions
    let whereConditions = ['br.farm_id = ?'];
    let queryParams = [id];
    
    if (status) {
      whereConditions.push('br.status = ?');
      queryParams.push(status);
    }
    
    if (date_from) {
      whereConditions.push('br.burn_date >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('br.burn_date <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Get total count
    const [{ total }] = await query(`
      SELECT COUNT(*) as total
      FROM burn_requests br
      ${whereClause}
    `, queryParams);
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Main query
    let selectFields = `
      br.request_id as id,
      br.field_name,
      br.acres,
      br.crop_type,
      br.burn_date,
      br.time_window_start,
      br.time_window_end,
      br.priority_score,
      br.status,
      br.created_at,
      NULL as field_boundary
    `;
    
    let joinClause = '';
    if (include_predictions === 'true') {
      selectFields += `,
        sp.max_dispersion_radius,
        sp.confidence_score as prediction_confidence,
        sp.created_at as prediction_date
      `;
      joinClause = 'LEFT JOIN smoke_predictions sp ON br.request_id = sp.burn_request_id';
    }
    
    const burnRequestsQuery = `
      SELECT ${selectFields}
      FROM burn_requests br
      ${joinClause}
      ${whereClause}
      ORDER BY br.burn_date DESC, br.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(parseInt(limit), offset);
    const burnRequests = await query(burnRequestsQuery, queryParams);
    
    // Process field boundaries
    burnRequests.forEach(request => {
      if (request.field_boundary) {
        try {
          request.field_boundary = JSON.parse(request.field_boundary);
        } catch (e) {
          request.field_boundary = null;
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        farm_id: parseInt(id),
        burn_requests: burnRequests,
        summary: {
          total_requests: total,
          status_distribution: await this.getBurnStatusDistribution(id),
          average_priority: burnRequests.length > 0 ? 
            burnRequests.reduce((sum, br) => sum + br.priority_score, 0) / burnRequests.length : 0
        },
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    logger.error('Farm burn requests retrieval failed', { farmId: id, error: error.message });
    throw new DatabaseError('Failed to retrieve farm burn requests', error);
  }
}));

/**
 * GET /api/farms/nearby/:lat/:lon
 * Find farms near specific coordinates
 */
router.get('/nearby/:lat/:lon', asyncHandler(async (req, res) => {
  const { lat, lon } = req.params;
  const { radius_km = 10, limit = 20, include_details = 'false' } = req.query;
  
  try {
    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude) || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      throw new ValidationError('Invalid coordinates', 'coordinates');
    }
    
    const radiusMeters = parseFloat(radius_km) * 1000;
    
    let selectFields = `
      f.farm_id as id,
      f.farm_name as name,
      f.owner_name,
      f.longitude as lon,
      f.latitude as lat,
      f.total_acreage as farm_size_acres,
      SQRT(POW((f.latitude - ?), 2) + POW((f.longitude - ?), 2)) * 111139 as distance_meters
    `;
    
    if (include_details === 'true') {
      selectFields += `,
        NULL as email,
        f.address,
        NULL as primary_crops,
        NULL as certification_number
      `;
    }
    
    const nearbyFarms = await query(`
      SELECT ${selectFields}
      FROM farms f
      WHERE SQRT(POW((f.latitude - ?), 2) + POW((f.longitude - ?), 2)) * 111139 <= ?
      AND 1=1
      ORDER BY distance_meters ASC
      LIMIT ?
    `, [longitude, latitude, longitude, latitude, radiusMeters, parseInt(limit)]);
    
    // Process results
    nearbyFarms.forEach(farm => {
      farm.distance_km = (farm.distance_meters / 1000).toFixed(2);
      
      if (farm.primary_crops) {
        try {
          farm.primary_crops = JSON.parse(farm.primary_crops);
        } catch (e) {
          farm.primary_crops = [];
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        search_center: { lat: latitude, lon: longitude },
        search_radius_km: parseFloat(radius_km),
        farms_found: nearbyFarms.length,
        nearby_farms: nearbyFarms
      }
    });
    
  } catch (error) {
    logger.error('Nearby farms search failed', { lat, lon, error: error.message });
    throw error;
  }
}));

/**
 * GET /api/farms/statistics
 * Get farm statistics and analytics
 */
router.get('/statistics', asyncHandler(async (req, res) => {
  const { region } = req.query;
  
  try {
    let regionFilter = '';
    let queryParams = [];
    
    if (region) {
      // Region filtering by coordinate bounds
      const regions = {
        'north_valley': { minLat: 39.0, maxLat: 40.0, minLon: -122.0, maxLon: -121.0 },
        'central_valley': { minLat: 37.0, maxLat: 39.0, minLon: -122.0, maxLon: -120.0 },
        'south_valley': { minLat: 35.0, maxLat: 37.0, minLon: -121.0, maxLon: -119.0 }
      };
      
      if (regions[region]) {
        const r = regions[region];
        regionFilter = `
          WHERE f.longitude BETWEEN ? AND ?
          AND f.latitude BETWEEN ? AND ?
        `;
        queryParams.push(r.minLon, r.maxLon, r.minLat, r.maxLat);
      }
    }
    
    // Overall farm statistics
    const overallStats = await query(`
      SELECT 
        COUNT(*) as total_farms,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_farms,
        SUM(farm_size_acres) as total_acres,
        AVG(farm_size_acres) as avg_farm_size,
        MIN(farm_size_acres) as smallest_farm,
        MAX(farm_size_acres) as largest_farm
      FROM farms f
      ${regionFilter}
    `, queryParams);
    
    // Crop distribution
    const cropStats = await query(`
      SELECT 
        crop,
        COUNT(*) as farm_count,
        SUM(f.farm_size_acres) as total_acres,
        AVG(f.farm_size_acres) as avg_farm_size
      FROM farms f
      CROSS JOIN JSON_TABLE(f.primary_crops, '$[*]' COLUMNS (crop VARCHAR(50) PATH '$')) as crops
      ${regionFilter.replace('WHERE', 'WHERE f.status = "active" AND')}
      GROUP BY crop
      ORDER BY farm_count DESC
    `, queryParams);
    
    // Burn activity by farm
    const burnActivity = await query(`
      SELECT 
        COUNT(DISTINCT f.farm_id) as farms_with_burns,
        COUNT(br.request_id) as total_burn_requests,
        COUNT(CASE WHEN br.status = 'completed' THEN 1 END) as completed_burns,
        SUM(br.acres) as total_acres_burned,
        AVG(br.priority_score) as avg_priority_score
      FROM farms f
      LEFT JOIN burn_requests br ON f.farm_id = br.farm_id
        AND br.created_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
      ${regionFilter}
      GROUP BY ()
    `, queryParams);
    
    // Geographic distribution
    const geoDistribution = await query(`
      SELECT 
        ROUND(longitude, 1) as lon_rounded,
        ROUND(latitude, 1) as lat_rounded,
        COUNT(*) as farm_count,
        AVG(farm_size_acres) as avg_size
      FROM farms f
      ${regionFilter}
      GROUP BY ROUND(longitude, 1), ROUND(latitude, 1)
      HAVING farm_count > 1
      ORDER BY farm_count DESC
      LIMIT 20
    `, queryParams);
    
    // Recent activity
    const recentActivity = await query(`
      SELECT 
        f.farm_id as id,
        f.farm_name as name,
        f.owner_name,
        COUNT(br.request_id) as recent_burns,
        MAX(br.created_at) as last_burn_request,
        SUM(br.acres) as total_acres_requested
      FROM farms f
      LEFT JOIN burn_requests br ON f.farm_id = br.farm_id
        AND br.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      ${regionFilter}
      GROUP BY f.farm_id, f.farm_name, f.owner_name
      HAVING recent_burns > 0
      ORDER BY recent_burns DESC, last_burn_request DESC
      LIMIT 10
    `, queryParams);
    
    res.json({
      success: true,
      data: {
        region: region || 'all',
        overall_statistics: overallStats[0],
        crop_distribution: cropStats,
        burn_activity: burnActivity[0],
        geographic_distribution: geoDistribution,
        recent_activity: recentActivity,
        analysis_generated_at: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Farm statistics generation failed', { error: error.message });
    throw new DatabaseError('Failed to generate farm statistics', error);
  }
}));

/**
 * GET /api/farms/:id/neighbors
 * Get neighboring farms within specified radius with conflict analysis
 */
router.get('/:id/neighbors', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { radius_km = 5, include_conflicts = 'true' } = req.query;
  
  try {
    // Get farm location
    const farm = await query(`
      SELECT farm_id, farm_name as name, longitude as lon, latitude as lat
      FROM farms
      WHERE farm_id = ?
    `, [id]);
    
    if (farm.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farm not found'
      });
    }
    
    const farmData = farm[0];
    const radiusMeters = parseFloat(radius_km) * 1000;
    
    // Find neighboring farms
    const neighbors = await query(`
      SELECT 
        f2.farm_id,
        f2.farm_name,
        f2.owner_name,
        f2.phone,
        f2.longitude as lon,
        f2.latitude as lat,
        f2.farm_size_acres,
        1000 as distance_meters
      FROM farms f1
      CROSS JOIN farms f2
      WHERE f1.farm_id = ?
      AND f2.farm_id != f1.farm_id
      AND f2.status = 'active'
      AND 1000 <= ?
      ORDER BY distance_meters ASC
    `, [id, radiusMeters]);
    
    let responseData = {
      farm: farmData,
      radius_km: parseFloat(radius_km),
      neighbors_found: neighbors.length,
      neighboring_farms: neighbors.map(n => ({
        ...n,
        distance_km: (n.distance_meters / 1000).toFixed(2)
      }))
    };
    
    // Include conflict analysis if requested
    if (include_conflicts === 'true' && neighbors.length > 0) {
      const neighborIds = neighbors.map(n => n.id);
      
      // Get historical conflicts
      const conflicts = await query(`
        SELECT 
          bc.conflict_type,
          bc.severity_level,
          bc.distance_meters,
          bc.resolved,
          bc.created_at,
          br1.field_name as field1,
          br2.field_name as field2,
          f2.farm_name as neighbor_farm,
          f2.farm_id as neighbor_farm_id
        FROM burn_conflicts bc
        JOIN burn_requests br1 ON bc.burn_request_1_id = br1.request_id
        JOIN burn_requests br2 ON bc.burn_request_2_id = br2.request_id
        JOIN farms f2 ON br2.farm_id = f2.farm_id
        WHERE (br1.farm_id = ? AND br2.farm_id IN (${neighborIds.map(() => '?').join(',')}))
           OR (br2.farm_id = ? AND br1.farm_id IN (${neighborIds.map(() => '?').join(',')}))
        ORDER BY bc.created_at DESC
        LIMIT 50
      `, [id, ...neighborIds, id, ...neighborIds]);
      
      // Analyze conflict patterns
      const conflictAnalysis = {
        total_conflicts: conflicts.length,
        resolved_conflicts: conflicts.filter(c => c.resolved).length,
        by_neighbor: {},
        by_severity: {},
        recent_conflicts: conflicts.filter(c => 
          new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length
      };
      
      conflicts.forEach(conflict => {
        // By neighbor
        if (!conflictAnalysis.by_neighbor[conflict.neighbor_farm_id]) {
          conflictAnalysis.by_neighbor[conflict.neighbor_farm_id] = {
            farm_name: conflict.neighbor_farm,
            total: 0,
            resolved: 0
          };
        }
        conflictAnalysis.by_neighbor[conflict.neighbor_farm_id].total++;
        if (conflict.resolved) {
          conflictAnalysis.by_neighbor[conflict.neighbor_farm_id].resolved++;
        }
        
        // By severity
        if (!conflictAnalysis.by_severity[conflict.severity_level]) {
          conflictAnalysis.by_severity[conflict.severity_level] = 0;
        }
        conflictAnalysis.by_severity[conflict.severity_level]++;
      });
      
      responseData.conflict_analysis = conflictAnalysis;
      responseData.historical_conflicts = conflicts;
    }
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    logger.error('Farm neighbors analysis failed', { farmId: id, error: error.message });
    throw new DatabaseError('Failed to analyze farm neighbors', error);
  }
}));

/**
 * POST /api/farms/:id/validate-location
 * Validate farm location for potential conflicts
 */
router.post('/:id/validate-location', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { new_location } = req.body;
  
  try {
    if (!new_location || !new_location.lat || !new_location.lon) {
      throw new ValidationError('new_location with lat/lon is required', 'new_location');
    }
    
    const { lat, lon } = new_location;
    
    // Check minimum distance from other farms
    const nearbyFarms = await query(`
      SELECT 
        f.farm_id as id,
        f.farm_name as name,
        SQRT(POW((f.latitude - ?), 2) + POW((f.longitude - ?), 2)) * 111139 as distance_meters
      FROM farms f
      WHERE f.farm_id != ?
      AND 1=1
      AND SQRT(POW((f.latitude - ?), 2) + POW((f.longitude - ?), 2)) * 111139 < 1000
      ORDER BY distance_meters ASC
    `, [lon, lat, id, lon, lat]);
    
    // Check against regulatory boundaries (if available)
    const regulatoryCheck = await this.checkRegulatoryBoundaries(lat, lon);
    
    // Analyze potential burn conflicts at this location
    const conflictAnalysis = await this.analyzeLocationConflictPotential(lat, lon);
    
    const validation = {
      location: { lat, lon },
      valid: true,
      warnings: [],
      restrictions: [],
      nearby_farms: nearbyFarms
    };
    
    // Check minimum separation distance
    if (nearbyFarms.length > 0) {
      const closestFarm = nearbyFarms[0];
      if (closestFarm.distance_meters < 500) {
        validation.valid = false;
        validation.restrictions.push({
          type: 'minimum_separation',
          message: `Too close to ${closestFarm.name} (${(closestFarm.distance_meters).toFixed(0)}m away)`,
          minimum_required: 500,
          current_distance: closestFarm.distance_meters
        });
      } else if (closestFarm.distance_meters < 1000) {
        validation.warnings.push({
          type: 'close_proximity',
          message: `Close to ${closestFarm.name} - coordination may be required for burns`,
          distance_meters: closestFarm.distance_meters
        });
      }
    }
    
    // Add regulatory restrictions
    if (regulatoryCheck.restrictions.length > 0) {
      validation.restrictions.push(...regulatoryCheck.restrictions);
      validation.valid = false;
    }
    
    if (regulatoryCheck.warnings.length > 0) {
      validation.warnings.push(...regulatoryCheck.warnings);
    }
    
    res.json({
      success: true,
      data: {
        validation,
        regulatory_check: regulatoryCheck,
        conflict_analysis: conflictAnalysis,
        recommendation: validation.valid ? 
          'Location is suitable for farm registration' :
          'Location has restrictions that must be addressed'
      }
    });
    
  } catch (error) {
    logger.error('Farm location validation failed', { farmId: id, error: error.message });
    throw error;
  }
}));

/**
 * GET /api/farms/crop-types
 * Get available crop types and their distribution
 */
router.get('/crop-types', asyncHandler(async (req, res) => {
  try {
    const cropDistribution = await query(`
      SELECT 
        crop,
        COUNT(*) as farm_count,
        SUM(f.farm_size_acres) as total_acres,
        AVG(f.farm_size_acres) as avg_farm_size,
        COUNT(DISTINCT br.request_id) as burn_requests,
        AVG(br.priority_score) as avg_burn_priority
      FROM farms f
      CROSS JOIN JSON_TABLE(f.primary_crops, '$[*]' COLUMNS (crop VARCHAR(50) PATH '$')) as crops
      LEFT JOIN burn_requests br ON f.farm_id = br.farm_id
        AND br.created_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
      WHERE f.status = 'active'
      GROUP BY crop
      ORDER BY farm_count DESC
    `);
    
    // Calculate burn frequency by crop type
    const burnFrequency = await query(`
      SELECT 
        crop_type,
        COUNT(*) as total_burns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_burns,
        AVG(acres) as avg_acres_per_burn,
        AVG(priority_score) as avg_priority
      FROM burn_requests
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
      GROUP BY crop_type
      ORDER BY total_burns DESC
    `);
    
    res.json({
      success: true,
      data: {
        crop_distribution: cropDistribution,
        burn_frequency: burnFrequency,
        total_crop_types: cropDistribution.length,
        most_common_crop: cropDistribution.length > 0 ? cropDistribution[0].crop : null,
        analysis_period: '1 year'
      }
    });
    
  } catch (error) {
    logger.error('Crop types analysis failed', { error: error.message });
    throw new DatabaseError('Failed to analyze crop types', error);
  }
}));

// Helper methods
async function getBurnStatusDistribution(farmId) {
  const statusDist = await query(`
    SELECT 
      status,
      COUNT(*) as count
    FROM burn_requests
    WHERE farm_id = ?
    AND created_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
    GROUP BY status
  `, [farmId]);
  
  const distribution = {};
  statusDist.forEach(stat => {
    distribution[stat.status] = stat.count;
  });
  
  return distribution;
}

function getMostCommonCrop(burnHistory) {
  if (burnHistory.length === 0) return null;
  
  const cropCounts = {};
  burnHistory.forEach(burn => {
    if (burn.crop_type) {
      cropCounts[burn.crop_type] = (cropCounts[burn.crop_type] || 0) + 1;
    }
  });
  
  let mostCommon = null;
  let maxCount = 0;
  
  Object.entries(cropCounts).forEach(([crop, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = crop;
    }
  });
  
  return mostCommon;
}

async function checkRegulatoryBoundaries(lat, lon) {
  // Placeholder for regulatory boundary checks
  // In a real implementation, this would check against:
  // - Protected areas
  // - Urban boundaries
  // - Airport flight paths
  // - Water bodies
  // - National/state parks
  
  const checks = {
    valid: true,
    warnings: [],
    restrictions: []
  };
  
  try {
    // Simulate regulatory checks
    // Check distance from major population centers
    const populationCenters = [
      { name: 'Sacramento', lat: 38.5816, lon: -121.4944, radius: 25000 },
      { name: 'Davis', lat: 38.5449, lon: -121.7405, radius: 15000 },
      { name: 'Woodland', lat: 38.6785, lon: -121.7733, radius: 10000 }
    ];
    
    populationCenters.forEach(center => {
      const distance = calculateDistance(lat, lon, center.lat, center.lon) * 1000; // Convert to meters
      
      if (distance < center.radius) {
        if (distance < center.radius * 0.5) {
          checks.restrictions.push({
            type: 'population_center',
            message: `Too close to ${center.name} - burns may be restricted`,
            distance_meters: distance,
            minimum_distance: center.radius
          });
          checks.valid = false;
        } else {
          checks.warnings.push({
            type: 'population_proximity',
            message: `Near ${center.name} - additional permits may be required`,
            distance_meters: distance
          });
        }
      }
    });
    
    return checks;
    
  } catch (error) {
    logger.warn('Regulatory boundary check failed', { lat, lon, error: error.message });
    return {
      valid: true,
      warnings: [{ type: 'check_failed', message: 'Could not verify regulatory boundaries' }],
      restrictions: []
    };
  }
}

async function analyzeLocationConflictPotential(lat, lon) {
  try {
    // Analyze historical conflicts in the area
    const nearbyConflicts = await query(`
      SELECT 
        bc.conflict_type,
        bc.severity_level,
        COUNT(*) as conflict_count,
        AVG(bc.distance_meters) as avg_conflict_distance
      FROM burn_conflicts bc
      JOIN burn_requests br1 ON bc.burn_request_1_id = br1.id
      JOIN burn_requests br2 ON bc.burn_request_2_id = br2.id
      JOIN farms f1 ON br1.farm_id = f1.farm_id
      JOIN farms f2 ON br2.farm_id = f2.farm_id
      WHERE (1000 <= 10000
             OR 1000 <= 10000)
      AND bc.created_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
      GROUP BY bc.conflict_type, bc.severity_level
      ORDER BY conflict_count DESC
    `, [lon, lat, lon, lat]);
    
    // Calculate conflict risk score
    let riskScore = 0;
    nearbyConflicts.forEach(conflict => {
      const severityMultiplier = {
        'critical': 4,
        'high': 3,
        'medium': 2,
        'low': 1
      }[conflict.severity_level] || 1;
      
      riskScore += conflict.conflict_count * severityMultiplier;
    });
    
    const riskLevel = riskScore > 20 ? 'high' : riskScore > 10 ? 'medium' : 'low';
    
    return {
      conflict_risk_level: riskLevel,
      risk_score: riskScore,
      historical_conflicts: nearbyConflicts,
      analysis_radius_km: 10,
      recommendations: this.generateLocationRecommendations(riskLevel, nearbyConflicts)
    };
    
  } catch (error) {
    logger.warn('Location conflict analysis failed', { lat, lon, error: error.message });
    return {
      conflict_risk_level: 'unknown',
      risk_score: 0,
      historical_conflicts: [],
      error: 'Analysis failed'
    };
  }
}

function generateLocationRecommendations(riskLevel, conflicts) {
  const recommendations = [];
  
  switch (riskLevel) {
    case 'high':
      recommendations.push('Consider location farther from existing farms');
      recommendations.push('Plan for extensive coordination with neighbors');
      recommendations.push('Implement enhanced smoke monitoring');
      break;
    case 'medium':
      recommendations.push('Coordinate burn schedules with nearby farms');
      recommendations.push('Monitor weather conditions carefully');
      break;
    case 'low':
      recommendations.push('Standard burn coordination protocols apply');
      break;
  }
  
  // Specific recommendations based on conflict types
  const conflictTypes = [...new Set(conflicts.map(c => c.conflict_type))];
  if (conflictTypes.includes('smoke_dispersion')) {
    recommendations.push('Pay special attention to wind direction during burns');
  }
  if (conflictTypes.includes('resource_conflict')) {
    recommendations.push('Consider staggered burn schedules to avoid resource conflicts');
  }
  
  return recommendations;
}

// Utility function for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;