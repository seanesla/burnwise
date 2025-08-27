const express = require('express');
const { query } = require('../db/connection');
const { asyncHandler, ValidationError, DatabaseError } = require('../middleware/errorHandler');
const optimizerAgent = require('../agents/optimizer');
const weatherAgent = require('../agents/weather');
// alertsAgent removed - stub functionality not needed
const logger = require('../middleware/logger');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const optimizationRequestSchema = Joi.object({
  date: Joi.date().iso().min('now').required(),
  constraints: Joi.object({
    max_concurrent_burns: Joi.number().integer().min(1).max(20).default(5),
    min_separation_distance: Joi.number().min(1000).default(5000),
    time_window_minutes: Joi.number().min(60).max(720).default(180),
    priority_weight: Joi.number().min(0).max(1).default(0.3),
    conflict_weight: Joi.number().min(0).max(1).default(0.4),
    weather_weight: Joi.number().min(0).max(1).default(0.3)
  }).default({}),
  force_reoptimization: Joi.boolean().default(false)
});

const scheduleUpdateSchema = Joi.object({
  burn_request_id: Joi.number().integer().positive().required(),
  new_time_slot: Joi.object({
    start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
  }).required(),
  reason: Joi.string().max(500).required()
});

/**
 * GET /api/schedule
 * Get current schedule or schedule for today
 */
router.get('/', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Get schedule for today
  const schedule = await query(`
    SELECT 
      s.id as schedule_id,
      s.date,
      s.optimization_score,
      s.total_conflicts,
      s.created_at,
      s.updated_at
    FROM schedules s
    WHERE DATE(s.date) = ?
    ORDER BY s.created_at DESC
    LIMIT 1
  `, [today]);
  
  if (schedule.length === 0) {
    return res.json({
      success: true,
      message: 'No schedule found for today',
      date: today,
      schedule: null,
      items: []
    });
  }
  
  // Get schedule items
  const items = await query(`
    SELECT 
      si.*,
      br.farm_id,
      br.field_id,
      br.acreage,
      br.crop_type,
      f.farm_name,
      f.owner_name
    FROM schedule_items si
    JOIN burn_requests br ON si.burn_request_id = br.request_id
    JOIN farms f ON br.farm_id = f.farm_id
    WHERE si.schedule_id = ?
    ORDER BY si.scheduled_start
  `, [schedule[0].schedule_id]);
  
  res.json({
    success: true,
    date: today,
    schedule: schedule[0],
    items
  });
}));

/**
 * GET /api/schedule/calendar
 * Get schedule data for calendar view with date range
 */
router.get('/calendar', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    // Validate date range
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required', 'query');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD', 'date');
    }
    
    if (start > end) {
      throw new ValidationError('Start date must be before end date', 'date_range');
    }
    
    // Get all schedules and burn requests in date range
    const scheduleData = await query(`
      SELECT 
        s.id as schedule_id,
        s.date as schedule_date,
        s.optimization_score,
        s.total_conflicts,
        si.burn_request_id,
        si.scheduled_start,
        si.scheduled_end,
        br.farm_id,
        br.field_id,
        br.acreage,
        br.crop_type,
        br.status,
        br.priority_score,
        f.farm_name,
        f.owner_name
      FROM schedules s
      LEFT JOIN schedule_items si ON s.id = si.schedule_id
      LEFT JOIN burn_requests br ON si.burn_request_id = br.request_id
      LEFT JOIN farms f ON br.farm_id = f.farm_id
      WHERE s.date BETWEEN ? AND ?
      ORDER BY s.date, si.scheduled_start
    `, [startDate, endDate]);
    
    // Get unscheduled burn requests in date range
    const unscheduledBurns = await query(`
      SELECT 
        br.request_id,
        br.farm_id,
        br.field_id,
        br.acreage,
        br.crop_type,
        br.requested_date,
        br.requested_window_start,
        br.requested_window_end,
        br.status,
        br.priority_score,
        f.farm_name,
        f.owner_name
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.requested_date BETWEEN ? AND ?
      AND br.request_id NOT IN (
        SELECT burn_request_id FROM schedule_items
      )
      AND br.status IN ('pending', 'approved')
      ORDER BY br.requested_date, br.priority_score DESC
    `, [startDate, endDate]);
    
    // Organize data by date for calendar display
    const calendarData = {};
    
    // Process scheduled burns
    scheduleData.forEach(item => {
      const dateKey = item.schedule_date ? new Date(item.schedule_date).toISOString().split('T')[0] : null;
      if (!dateKey) return;
      
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = {
          date: dateKey,
          schedule_id: item.schedule_id,
          optimization_score: item.optimization_score,
          total_conflicts: item.total_conflicts,
          scheduled_burns: [],
          unscheduled_burns: [],
          total_acres: 0,
          burn_count: 0
        };
      }
      
      if (item.burn_request_id) {
        calendarData[dateKey].scheduled_burns.push({
          burn_request_id: item.burn_request_id,
          farm_name: item.farm_name,
          field_id: item.field_id,
          acres: item.acreage,
          crop_type: item.crop_type,
          scheduled_time: `${item.scheduled_start} - ${item.scheduled_end}`,
          status: item.status,
          priority_score: item.priority_score
        });
        calendarData[dateKey].total_acres += item.acreage || 0;
        calendarData[dateKey].burn_count++;
      }
    });
    
    // Process unscheduled burns
    unscheduledBurns.forEach(burn => {
      const dateKey = new Date(burn.requested_date).toISOString().split('T')[0];
      
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = {
          date: dateKey,
          schedule_id: null,
          optimization_score: null,
          total_conflicts: 0,
          scheduled_burns: [],
          unscheduled_burns: [],
          total_acres: 0,
          burn_count: 0
        };
      }
      
      calendarData[dateKey].unscheduled_burns.push({
        burn_request_id: burn.request_id,
        farm_name: burn.farm_name,
        field_id: burn.field_id,
        acres: burn.acreage,
        crop_type: burn.crop_type,
        requested_time: `${burn.requested_window_start} - ${burn.requested_window_end}`,
        status: burn.status,
        priority_score: burn.priority_score
      });
    });
    
    // Convert to array and sort by date
    const calendarArray = Object.values(calendarData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    // Calculate summary statistics
    const summary = {
      total_days: calendarArray.length,
      total_scheduled_burns: scheduleData.filter(item => item.burn_request_id).length,
      total_unscheduled_burns: unscheduledBurns.length,
      days_with_schedules: calendarArray.filter(day => day.schedule_id).length,
      days_with_unscheduled: calendarArray.filter(day => day.unscheduled_burns.length > 0).length,
      total_acres_scheduled: calendarArray.reduce((sum, day) => sum + day.total_acres, 0)
    };
    
    res.json({
      success: true,
      data: {
        date_range: {
          start: startDate,
          end: endDate
        },
        calendar: calendarArray,
        summary
      }
    });
    
  } catch (error) {
    logger.error('Calendar schedule retrieval failed', { 
      startDate, 
      endDate, 
      error: error.message 
    });
    
    if (error instanceof ValidationError) {
      throw error;
    }
    
    throw new DatabaseError('Failed to retrieve calendar schedule', error);
  }
}));

/**
 * GET /api/schedule/:date
 * Get optimized schedule for a specific date
 */
router.get('/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { include_metadata = 'true' } = req.query;
  
  try {
    // Validate date
    const scheduleDate = new Date(date);
    if (isNaN(scheduleDate.getTime())) {
      throw new ValidationError('Invalid date format', 'date');
    }
    
    // Get schedule for the date
    const scheduleQuery = `
      SELECT 
        s.id as schedule_id,
        s.optimization_score,
        s.total_conflicts,
        s.created_at as schedule_created,
        si.id as item_id,
        si.burn_request_id,
        si.scheduled_start,
        si.scheduled_end,
        bf.field_name,
        br.acreage as acres,
        br.crop_type,
        br.priority_score,
        br.status as burn_status,
        f.farm_name,
        f.owner_name,
        bf.field_geometry as field_boundary
      FROM schedules s
      JOIN schedule_items si ON s.id = si.schedule_id
      JOIN burn_requests br ON si.burn_request_id = br.request_id
      JOIN farms f ON br.farm_id = f.farm_id
      LEFT JOIN burn_fields bf ON br.field_id = bf.field_id
      WHERE s.date = ?
      ORDER BY s.created_at DESC, si.scheduled_start ASC
      LIMIT 1
    `;
    
    const scheduleData = await query(scheduleQuery, [date]);
    
    if (scheduleData.length === 0) {
      return res.json({
        success: true,
        data: {
          date,
          schedule: null,
          burn_items: [],
          message: 'No schedule found for this date'
        }
      });
    }
    
    // Group by schedule and extract items
    const schedule = {
      id: scheduleData[0].schedule_id,
      date,
      optimization_score: scheduleData[0].optimization_score,
      total_conflicts: scheduleData[0].total_conflicts,
      created_at: scheduleData[0].schedule_created
    };
    
    const burnItems = scheduleData.map(item => ({
      item_id: item.item_id,
      burn_request_id: item.burn_request_id,
      scheduled_start: item.scheduled_start,
      scheduled_end: item.scheduled_end,
      burn_details: {
        field_name: item.field_name,
        acres: item.acres,
        crop_type: item.crop_type,
        priority_score: item.priority_score,
        status: item.burn_status,
        farm_name: item.farm_name,
        owner_name: item.owner_name,
        field_boundary: item.field_boundary ? JSON.parse(item.field_boundary) : null
      }
    }));
    
    let responseData = {
      date,
      schedule,
      burn_items: burnItems,
      total_burns_scheduled: burnItems.length
    };
    
    // Add metadata if requested
    if (include_metadata === 'true') {
      // Get conflict information
      const conflicts = await query(`
        SELECT 
          bc.severity,
          bc.overlap_percentage,
          bf1.field_name as field1,
          bf2.field_name as field2,
          f1.name as farm1,
          f2.name as farm2
        FROM burn_conflicts bc
        JOIN burn_requests br1 ON bc.request1_id = br1.request_id
        JOIN burn_requests br2 ON bc.request2_id = br2.request_id
        LEFT JOIN burn_fields bf1 ON br1.field_id = bf1.field_id
        LEFT JOIN burn_fields bf2 ON br2.field_id = bf2.field_id
        JOIN farms f1 ON br1.farm_id = f1.farm_id
        JOIN farms f2 ON br2.farm_id = f2.farm_id
        WHERE bc.conflict_date = ?
        ORDER BY bc.severity DESC
      `, [date]);
      
      // Get weather analysis for the date
      const weatherSummary = await query(`
        SELECT 
          AVG(temperature) as avg_temperature,
          AVG(humidity) as avg_humidity,
          AVG(wind_speed) as avg_wind_speed,
          weather_condition,
          COUNT(*) as condition_count
        FROM weather_data
        WHERE DATE(timestamp) = ?
        GROUP BY weather_condition
        ORDER BY condition_count DESC
        LIMIT 1
      `, [date]);
      
      responseData.metadata = {
        conflicts: conflicts,
        weather_summary: weatherSummary[0] || null,
        optimization_metrics: {
          efficiency_score: schedule.optimization_score,
          conflicts_resolved: schedule.total_conflicts,
          time_utilization: this.calculateTimeUtilization(burnItems)
        }
      };
    }
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    logger.error('Schedule retrieval failed', { date, error: error.message });
    throw new DatabaseError('Failed to retrieve schedule', error);
  }
}));

/**
 * POST /api/schedule/optimize
 * Trigger schedule optimization for a specific date
 */
router.post('/optimize', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { error, value } = optimizationRequestSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid optimization request', 'body', error.details);
    }
    
    const { date, constraints, force_reoptimization } = value;
    const scheduleDate = date.toISOString().split('T')[0];
    
    logger.info('Starting schedule optimization', { 
      date: scheduleDate, 
      constraints,
      forceReoptimization: force_reoptimization
    });
    
    // Check if schedule already exists
    const existingSchedule = await query(`
      SELECT id, optimization_score, created_at
      FROM schedules
      WHERE date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [scheduleDate]);
    
    if (existingSchedule.length > 0 && !force_reoptimization) {
      const schedule = existingSchedule[0];
      const ageHours = (Date.now() - new Date(schedule.created_at).getTime()) / (1000 * 60 * 60);
      
      if (ageHours < 1 && schedule.optimization_score > 7) {
        return res.json({
          success: true,
          message: 'Recent optimization exists with good score',
          data: {
            schedule_id: schedule.id,
            optimization_score: schedule.optimization_score,
            optimization_skipped: true,
            reason: 'Recent optimization with good score exists'
          }
        });
      }
    }
    
    // Get all burn requests for the date
    const burnRequests = await query(`
      SELECT 
        br.*,
        f.name as farm_name,
        f.owner_name,
        f.longitude as farm_lon,
        f.latitude as farm_lat,
        bf.field_geometry as field_boundary
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      LEFT JOIN burn_fields bf ON br.field_id = bf.field_id
      WHERE br.requested_date = ?
      AND br.status IN ('pending', 'approved')
      ORDER BY br.priority_score DESC
    `, [scheduleDate]);
    
    if (burnRequests.length === 0) {
      return res.json({
        success: true,
        message: 'No burn requests found for optimization',
        data: {
          date: scheduleDate,
          burns_to_schedule: 0,
          optimization_skipped: true
        }
      });
    }
    
    // Get weather data for the date
    const weatherData = await getWeatherForOptimization(scheduleDate);
    
    // Get smoke predictions for all burn requests
    const smokePredictions = await query(`
      SELECT 
        sp.*
      FROM burn_smoke_predictions sp
      WHERE sp.request_id IN (${burnRequests.map(() => '?').join(',')})
      ORDER BY sp.created_at DESC
    `, burnRequests.map(br => br.request_id));
    
    // Run optimization
    const optimizationResult = await optimizerAgent.optimizeSchedule(
      scheduleDate,
      burnRequests,
      weatherData,
      smokePredictions
    );
    
    // Send notifications about schedule changes
    if (optimizationResult.success && optimizationResult.scheduleCreated) {
      const io = req.app.get('io');
      await this.notifyScheduleUpdates(optimizationResult, io);
    }
    
    const duration = Date.now() - startTime;
    
    logger.performance('schedule_optimization', duration, {
      date: scheduleDate,
      burnsConsidered: burnRequests.length,
      optimizationScore: optimizationResult.metrics?.overallScore,
      conflictsResolved: optimizationResult.metrics?.conflictsResolved
    });
    
    res.json({
      success: true,
      message: 'Schedule optimization completed',
      data: {
        date: scheduleDate,
        burns_considered: burnRequests.length,
        schedule_id: optimizationResult.scheduleId,
        optimization_result: optimizationResult,
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Schedule optimization failed', { 
      error: error.message,
      duration: Date.now() - startTime,
      requestData: req.body
    });
    throw error;
  }
}));

/**
 * GET /api/schedule/conflicts/:date
 * Get schedule conflicts for a specific date
 */
router.get('/conflicts/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { severity, resolved = 'false' } = req.query;
  
  try {
    let whereConditions = ['bc.conflict_date = ?'];
    let queryParams = [date];
    
    if (severity) {
      whereConditions.push('bc.severity_level = ?');
      queryParams.push(severity);
    }
    
    if (resolved === 'false') {
      whereConditions.push("bc.resolution_status = 'pending'");
    } else if (resolved === 'true') {
      whereConditions.push("bc.resolution_status = 'resolved'");
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    const conflicts = await query(`
      SELECT 
        bc.conflict_id,
        bc.severity,
        bc.overlap_percentage,
        bc.resolution_status,
        bc.created_at,
        br1.request_id as burn1_id,
        bf1.field_name as field1,
        br1.requested_window_start as time1_start,
        br1.requested_window_end as time1_end,
        f1.name as farm1,
        f1.owner_name as owner1,
        br2.request_id as burn2_id,
        bf2.field_name as field2,
        br2.requested_window_start as time2_start,
        br2.requested_window_end as time2_end,
        f2.name as farm2,
        f2.owner_name as owner2
      FROM burn_conflicts bc
      JOIN burn_requests br1 ON bc.request1_id = br1.request_id
      JOIN burn_requests br2 ON bc.request2_id = br2.request_id
      LEFT JOIN burn_fields bf1 ON br1.field_id = bf1.field_id
      LEFT JOIN burn_fields bf2 ON br2.field_id = bf2.field_id
      JOIN farms f1 ON br1.farm_id = f1.farm_id
      JOIN farms f2 ON br2.farm_id = f2.farm_id
      ${whereClause}
      ORDER BY 
        CASE bc.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        bc.created_at DESC
    `, queryParams);
    
    // Group conflicts by type and severity
    const conflictSummary = {
      total: conflicts.length,
      by_severity: {},
      by_type: {},
      resolved: conflicts.filter(c => c.resolved).length,
      unresolved: conflicts.filter(c => !c.resolved).length
    };
    
    conflicts.forEach(conflict => {
      // By severity
      if (!conflictSummary.by_severity[conflict.severity_level]) {
        conflictSummary.by_severity[conflict.severity_level] = 0;
      }
      conflictSummary.by_severity[conflict.severity_level]++;
      
      // By type
      if (!conflictSummary.by_type[conflict.conflict_type]) {
        conflictSummary.by_type[conflict.conflict_type] = 0;
      }
      conflictSummary.by_type[conflict.conflict_type]++;
    });
    
    res.json({
      success: true,
      data: {
        date,
        conflicts,
        summary: conflictSummary,
        filters_applied: {
          severity,
          resolved
        }
      }
    });
    
  } catch (error) {
    logger.error('Conflicts retrieval failed', { date, error: error.message });
    throw new DatabaseError('Failed to retrieve conflicts', error);
  }
}));

/**
 * GET /api/schedule/timeline/:date
 * Get detailed timeline view of scheduled burns for a date
 */
router.get('/timeline/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  
  try {
    const timelineData = await query(`
      SELECT 
        COALESCE(DATE_FORMAT(br.requested_start_time, '%H:%i'), 'morning') as time_slot,
        br.requested_date as scheduled_start,
        br.requested_date as scheduled_end,
        br.request_id as burn_request_id,
        COALESCE(bf.field_name, 'Field') as field_name,
        COALESCE(br.acreage, 0) as acres,
        br.crop_type,
        br.priority_score,
        f.name as farm_name,
        f.owner_name,
        f.longitude as farm_lon,
        f.latitude as farm_lat,
        COALESCE(sp.max_dispersion_radius, 0) as max_dispersion_radius,
        COALESCE(sp.confidence_score, 0) as smoke_confidence
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      LEFT JOIN burn_fields bf ON br.field_id = bf.field_id
      LEFT JOIN burn_smoke_predictions sp ON br.request_id = sp.request_id
      WHERE DATE(br.requested_date) = ?
        AND br.status IN ('pending', 'approved', 'scheduled')
      ORDER BY br.requested_start_time ASC, br.priority_score DESC
    `, [date]);
    
    // Organize by time slots
    const timeline = {};
    const timeSlots = [];
    
    timelineData.forEach(item => {
      if (!timeline[item.time_slot]) {
        timeline[item.time_slot] = {
          slot: item.time_slot,
          start_time: item.scheduled_start,
          end_time: item.scheduled_end,
          burns: [],
          total_acres: 0,
          avg_priority: 0
        };
        timeSlots.push(item.time_slot);
      }
      
      timeline[item.time_slot].burns.push({
        burn_request_id: item.burn_request_id,
        field_name: item.field_name,
        acres: item.acres,
        crop_type: item.crop_type,
        priority_score: item.priority_score,
        farm: {
          name: item.farm_name,
          owner: item.owner_name,
          location: { lat: item.farm_lat, lon: item.farm_lon }
        },
        smoke_prediction: {
          max_dispersion_radius: item.max_dispersion_radius,
          confidence: item.smoke_confidence
        }
      });
      
      timeline[item.time_slot].total_acres += item.acres;
    });
    
    // Calculate averages
    Object.values(timeline).forEach(slot => {
      if (slot.burns.length > 0) {
        slot.avg_priority = slot.burns.reduce((sum, burn) => sum + burn.priority_score, 0) / slot.burns.length;
      }
    });
    
    res.json({
      success: true,
      data: {
        date,
        timeline: Object.values(timeline),
        total_time_slots: timeSlots.length,
        total_burns: timelineData.length,
        time_slots_used: Object.keys(timeline).length
      }
    });
    
  } catch (error) {
    logger.error('Timeline retrieval failed', { date, error: error.message });
    throw new DatabaseError('Failed to retrieve timeline', error);
  }
}));

/**
 * PUT /api/schedule/update
 * Update specific burn in schedule
 */
router.put('/update', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { error, value } = scheduleUpdateSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid schedule update request', 'body', error.details);
    }
    
    const { burn_request_id, new_time_slot, reason } = value;
    
    // Get current schedule item
    const currentSchedule = await query(`
      SELECT 
        si.*,
        s.schedule_date,
        br.field_name,
        br.farm_id,
        f.name as farm_name
      FROM schedule_items si
      JOIN schedules s ON si.schedule_id = s.id
      JOIN burn_requests br ON si.burn_request_id = br.request_id
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE si.burn_request_id = ?
      ORDER BY si.created_at DESC
      LIMIT 1
    `, [burn_request_id]);
    
    if (currentSchedule.length === 0) {
      throw new ValidationError('Burn request not found in any schedule', 'burn_request_id');
    }
    
    const scheduleItem = currentSchedule[0];
    
    // Check for conflicts with new time slot
    const conflictCheck = await this.checkTimeSlotConflicts(
      scheduleItem.schedule_date,
      new_time_slot,
      burn_request_id
    );
    
    if (conflictCheck.conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Time slot conflicts detected',
        conflicts: conflictCheck.conflicts,
        suggested_alternatives: conflictCheck.alternatives
      });
    }
    
    // Update schedule item
    await query(`
      UPDATE schedule_items
      SET 
        time_slot = ?,
        scheduled_start = ?,
        scheduled_end = ?,
        updated_at = NOW()
      WHERE burn_request_id = ?
      AND schedule_id = ?
    `, [
      conflictCheck.timeSlot,
      new_time_slot.start_time,
      new_time_slot.end_time,
      burn_request_id,
      scheduleItem.schedule_id
    ]);
    
    // Log the change
    await query(`
      INSERT INTO schedule_changes (
        schedule_id, burn_request_id, change_type, 
        old_value, new_value, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      scheduleItem.schedule_id,
      burn_request_id,
      'time_slot_update',
      JSON.stringify({
        old_slot: scheduleItem.time_slot,
        old_start: scheduleItem.scheduled_start,
        old_end: scheduleItem.scheduled_end
      }),
      JSON.stringify({
        new_slot: conflictCheck.timeSlot,
        new_start: new_time_slot.start_time,
        new_end: new_time_slot.end_time
      }),
      reason
    ]);
    
    // Send notifications
    const io = req.app.get('io');
    // Alert functionality removed - was stub only
    logger.info('Schedule updated - notifications disabled', {
      farm_id: scheduleItem.farm_id,
      burn_request_id: burn_request_id,
      field_name: scheduleItem.field_name,
      new_time: `${new_time_slot.start_time} - ${new_time_slot.end_time}`,
      reason
    });
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Schedule updated successfully',
      data: {
        burn_request_id,
        previous_time_slot: {
          slot: scheduleItem.time_slot,
          start: scheduleItem.scheduled_start,
          end: scheduleItem.scheduled_end
        },
        new_time_slot: {
          slot: conflictCheck.timeSlot,
          start: new_time_slot.start_time,
          end: new_time_slot.end_time
        },
        reason,
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Schedule update failed', { 
      error: error.message,
      duration: Date.now() - startTime,
      requestData: req.body
    });
    throw error;
  }
}));

/**
 * GET /api/schedule/efficiency/:date
 * Get schedule efficiency metrics for a date
 */
router.get('/efficiency/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  
  try {
    // Get schedule data
    const scheduleData = await query(`
      SELECT 
        s.id,
        s.optimization_score,
        s.total_conflicts,
        s.optimization_algorithm,
        COUNT(si.id) as total_burns,
        SUM(br.acres) as total_acres,
        AVG(br.priority_score) as avg_priority,
        MIN(si.time_slot) as first_slot,
        MAX(si.time_slot) as last_slot
      FROM schedules s
      JOIN schedule_items si ON s.id = si.schedule_id
      JOIN burn_requests br ON si.burn_request_id = br.request_id
      WHERE s.schedule_date = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [date]);
    
    if (scheduleData.length === 0) {
      return res.json({
        success: true,
        data: {
          date,
          efficiency_metrics: null,
          message: 'No schedule found for this date'
        }
      });
    }
    
    const schedule = scheduleData[0];
    
    // Calculate detailed efficiency metrics
    const timeSlotAnalysis = await query(`
      SELECT 
        si.time_slot,
        COUNT(*) as burns_in_slot,
        SUM(br.acres) as acres_in_slot,
        AVG(br.priority_score) as avg_priority_in_slot,
        MIN(sp.confidence_score) as min_confidence,
        MAX(sp.max_dispersion_radius) as max_dispersion
      FROM schedule_items si
      JOIN schedules s ON si.schedule_id = s.id
      JOIN burn_requests br ON si.burn_request_id = br.request_id
      LEFT JOIN burn_smoke_predictions sp ON br.request_id = sp.request_id
      WHERE s.schedule_date = ?
      AND s.id = ?
      GROUP BY si.time_slot
      ORDER BY si.time_slot
    `, [date, schedule.id]);
    
    // Calculate efficiency scores
    const totalTimeSlots = Math.max(1, schedule.last_slot - schedule.first_slot + 1);
    const timeUtilization = timeSlotAnalysis.length / totalTimeSlots;
    const acreEfficiency = schedule.total_acres / (timeSlotAnalysis.length * 50); // Assuming 50 acres per slot max
    const priorityDistribution = this.analyzePriorityDistribution(timeSlotAnalysis);
    
    const efficiencyMetrics = {
      overall_score: schedule.optimization_score,
      time_utilization: timeUtilization,
      acre_efficiency: Math.min(1, acreEfficiency),
      conflict_resolution_rate: schedule.total_conflicts > 0 ? 
        (schedule.total_conflicts - this.getUnresolvedConflicts(timeSlotAnalysis)) / schedule.total_conflicts : 1,
      priority_optimization: priorityDistribution.score,
      resource_utilization: this.calculateResourceUtilization(timeSlotAnalysis),
      algorithm_performance: {
        algorithm_used: schedule.optimization_algorithm,
        convergence_quality: schedule.optimization_score / 10,
        scalability_factor: this.calculateScalabilityFactor(schedule.total_burns)
      }
    };
    
    res.json({
      success: true,
      data: {
        date,
        schedule_id: schedule.id,
        efficiency_metrics: efficiencyMetrics,
        time_slot_analysis: timeSlotAnalysis,
        summary: {
          total_burns: schedule.total_burns,
          total_acres: schedule.total_acres,
          average_priority: schedule.avg_priority,
          time_slots_used: timeSlotAnalysis.length,
          conflicts_detected: schedule.total_conflicts
        }
      }
    });
    
  } catch (error) {
    logger.error('Efficiency analysis failed', { date, error: error.message });
    throw new DatabaseError('Failed to analyze schedule efficiency', error);
  }
}));

/**
 * POST /api/schedule/reoptimize/:date
 * Force re-optimization of schedule for a specific date
 */
router.post('/reoptimize/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { algorithm = 'simulated_annealing', constraints = {} } = req.body;
  const startTime = Date.now();
  
  try {
    // Archive current schedule
    await query(`
      UPDATE schedules
      SET status = 'archived', updated_at = NOW()
      WHERE date = ?
      AND status = 'active'
    `, [date]);
    
    // Force optimization with new parameters
    const optimizationRequest = {
      date: new Date(date),
      constraints: {
        ...constraints,
        algorithm_preference: algorithm
      },
      force_reoptimization: true
    };
    
    // Get all burn requests for re-optimization
    const burnRequests = await query(`
      SELECT 
        br.*,
        f.name as farm_name,
        ST_X(f.location) as farm_lon,
        ST_Y(f.location) as farm_lat
      FROM burn_requests br
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE br.requested_date = ?
      AND br.status IN ('pending', 'approved')
    `, [date]);
    
    if (burnRequests.length === 0) {
      return res.json({
        success: false,
        message: 'No burn requests available for re-optimization',
        data: { date, burns_found: 0 }
      });
    }
    
    // Get fresh weather data
    const weatherData = await getWeatherForOptimization(date);
    
    // Get current smoke predictions
    const smokePredictions = await query(`
      SELECT sp.*
      FROM burn_smoke_predictions sp
      WHERE sp.request_id IN (${burnRequests.map(() => '?').join(',')})
      ORDER BY sp.created_at DESC
    `, burnRequests.map(br => br.request_id));
    
    // Run re-optimization
    const optimizationResult = await optimizerAgent.optimizeSchedule(
      date,
      burnRequests,
      weatherData,
      smokePredictions
    );
    
    // Compare with previous schedule
    const previousSchedule = await query(`
      SELECT optimization_score, total_conflicts
      FROM schedules
      WHERE date = ?
      AND status = 'archived'
      ORDER BY created_at DESC
      LIMIT 1
    `, [date]);
    
    const improvement = previousSchedule.length > 0 ? {
      score_improvement: optimizationResult.metrics?.overallScore - previousSchedule[0].optimization_score,
      conflict_reduction: previousSchedule[0].total_conflicts - (optimizationResult.metrics?.conflictsResolved || 0)
    } : null;
    
    // Send notifications about re-optimization
    const io = req.app.get('io');
    // Alert functionality removed - was stub only
    logger.info('Schedule re-optimization complete - notifications disabled', {
      date,
      newScore: optimizationResult.metrics?.overallScore,
      improvement,
      algorithm: algorithm
    });
    
    const duration = Date.now() - startTime;
    
    logger.performance('schedule_reoptimization', duration, {
      date,
      algorithm,
      burnsReoptimized: burnRequests.length,
      newScore: optimizationResult.metrics?.overallScore,
      improvement
    });
    
    res.json({
      success: true,
      message: 'Schedule re-optimization completed',
      data: {
        date,
        algorithm_used: algorithm,
        optimization_result: optimizationResult,
        improvement_analysis: improvement,
        burns_rescheduled: burnRequests.length,
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Schedule re-optimization failed', { 
      date,
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}));

/**
 * GET /api/schedule/statistics
 * Get schedule optimization statistics and performance metrics
 */
router.get('/statistics', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  try {
    // Overall optimization statistics
    const overallStats = await query(`
      SELECT 
        COUNT(*) as total_schedules,
        AVG(optimization_score) as avg_optimization_score,
        AVG(total_conflicts) as avg_conflicts,
        MAX(optimization_score) as best_score,
        MIN(optimization_score) as worst_score,
        COUNT(DISTINCT schedule_date) as dates_scheduled
      FROM schedules
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      AND status = 'active'
    `, [days]);
    
    // Algorithm performance comparison
    const algorithmStats = await query(`
      SELECT 
        optimization_algorithm,
        COUNT(*) as usage_count,
        AVG(optimization_score) as avg_score,
        AVG(total_conflicts) as avg_conflicts,
        AVG(TIMESTAMPDIFF(SECOND, created_at, updated_at)) as avg_computation_time
      FROM schedules
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      AND status = 'active'
      GROUP BY optimization_algorithm
      ORDER BY avg_score DESC
    `, [days]);
    
    // Daily optimization trends
    const dailyTrends = await query(`
      SELECT 
        DATE(date) as schedule_date,
        COUNT(*) as schedules_created,
        AVG(optimization_score) as avg_score,
        SUM((SELECT COUNT(*) FROM schedule_items WHERE schedule_id = schedules.id)) as total_burns_scheduled,
        AVG(total_conflicts) as avg_conflicts
      FROM schedules
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      AND status = 'active'
      GROUP BY DATE(date)
      ORDER BY date DESC
    `, [days]);
    
    // Conflict resolution statistics
    const conflictStats = await query(`
      SELECT 
        conflict_type,
        severity_level,
        COUNT(*) as total_conflicts,
        COUNT(CASE WHEN resolved = TRUE THEN 1 END) as resolved_conflicts,
        AVG(CASE WHEN resolved = TRUE THEN TIMESTAMPDIFF(HOUR, created_at, updated_at) END) as avg_resolution_time_hours
      FROM burn_conflicts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY conflict_type, severity_level
      ORDER BY total_conflicts DESC
    `, [days]);
    
    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        overall_statistics: overallStats[0],
        algorithm_performance: algorithmStats,
        daily_trends: dailyTrends,
        conflict_resolution: conflictStats,
        performance_summary: {
          total_optimizations: overallStats[0].total_schedules,
          average_score: overallStats[0].avg_optimization_score,
          best_performing_algorithm: algorithmStats.length > 0 ? algorithmStats[0].optimization_algorithm : null,
          conflict_resolution_rate: this.calculateOverallConflictResolutionRate(conflictStats)
        }
      }
    });
    
  } catch (error) {
    logger.error('Schedule statistics generation failed', { error: error.message });
    throw new DatabaseError('Failed to generate schedule statistics', error);
  }
}));

/**
 * DELETE /api/schedule/:schedule_id
 * Delete/archive a schedule
 */
router.delete('/:schedule_id', asyncHandler(async (req, res) => {
  const { schedule_id } = req.params;
  const { reason } = req.body;
  
  try {
    // Check if schedule exists
    const schedule = await query(`
      SELECT s.*, COUNT(si.id) as burn_count
      FROM schedules s
      LEFT JOIN schedule_items si ON s.id = si.schedule_id
      WHERE s.id = ?
      GROUP BY s.id
    `, [schedule_id]);
    
    if (schedule.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }
    
    const scheduleInfo = schedule[0];
    
    // Archive the schedule instead of deleting
    await query(`
      UPDATE schedules
      SET status = 'deleted', updated_at = NOW()
      WHERE id = ?
    `, [schedule_id]);
    
    // Remove all schedule items
    await query(`
      DELETE FROM schedule_items
      WHERE schedule_id = ?
    `, [schedule_id]);
    
    // Update burn request statuses back to pending
    await query(`
      UPDATE burn_requests br
      SET status = 'pending'
      WHERE br.request_id IN (
        SELECT burn_request_id FROM schedule_items WHERE schedule_id = ?
      )
    `, [schedule_id]);
    
    // Log the deletion
    logger.info('Schedule deleted', {
      scheduleId: schedule_id,
      date: scheduleInfo.schedule_date,
      burnsAffected: scheduleInfo.burn_count,
      reason: reason || 'No reason provided'
    });
    
    res.json({
      success: true,
      message: 'Schedule deleted successfully',
      data: {
        schedule_id: parseInt(schedule_id),
        date: scheduleInfo.schedule_date,
        burns_unscheduled: scheduleInfo.burn_count,
        reason: reason || 'No reason provided'
      }
    });
    
  } catch (error) {
    logger.error('Schedule deletion failed', { 
      scheduleId: schedule_id,
      error: error.message
    });
    throw new DatabaseError('Failed to delete schedule', error);
  }
}));

// Helper methods
async function getWeatherForOptimization(date) {
  try {
    const weatherData = await query(`
      SELECT 
        temperature, humidity, pressure, wind_speed, wind_direction,
        visibility, weather_condition, timestamp
      FROM weather_data
      WHERE DATE(timestamp) = ?
      ORDER BY ABS(TIMESTAMPDIFF(HOUR, timestamp, CONCAT(?, ' 12:00:00')))
      LIMIT 1
    `, [date, date]);
    
    return weatherData[0] || null;
    
  } catch (error) {
    logger.warn('Weather data fetch for optimization failed', { date, error: error.message });
    return null;
  }
}

async function checkTimeSlotConflicts(scheduleDate, newTimeSlot, excludeBurnRequestId) {
  const conflicts = await query(`
    SELECT 
      si.burn_request_id,
      si.time_slot,
      si.scheduled_start,
      si.scheduled_end,
      br.field_name,
      f.name as farm_name
    FROM schedule_items si
    JOIN schedules s ON si.schedule_id = s.id
    JOIN burn_requests br ON si.burn_request_id = br.request_id
    JOIN farms f ON br.farm_id = f.id
    WHERE s.schedule_date = ?
    AND si.burn_request_id != ?
    AND s.status = 'active'
    AND (
      (si.scheduled_start <= ? AND si.scheduled_end > ?) OR
      (si.scheduled_start < ? AND si.scheduled_end >= ?) OR
      (si.scheduled_start >= ? AND si.scheduled_end <= ?)
    )
  `, [
    scheduleDate,
    excludeBurnRequestId,
    newTimeSlot.start_time, newTimeSlot.start_time,
    newTimeSlot.end_time, newTimeSlot.end_time,
    newTimeSlot.start_time, newTimeSlot.end_time
  ]);
  
  // Generate time slot number
  const startHour = parseInt(newTimeSlot.start_time.split(':')[0]);
  const timeSlot = Math.floor((startHour - 6) / 3) + 1; // Assuming 3-hour slots starting at 6 AM
  
  return {
    conflicts,
    timeSlot,
    alternatives: conflicts.length > 0 ? await this.generateAlternativeTimeSlots(scheduleDate, excludeBurnRequestId) : []
  };
}

async function generateAlternativeTimeSlots(scheduleDate, burnRequestId) {
  // Generate alternative time slots
  const occupiedSlots = await query(`
    SELECT DISTINCT time_slot
    FROM schedule_items si
    JOIN schedules s ON si.schedule_id = s.id
    WHERE s.schedule_date = ?
    AND s.status = 'active'
    AND si.burn_request_id != ?
  `, [scheduleDate, burnRequestId]);
  
  const occupied = new Set(occupiedSlots.map(slot => slot.time_slot));
  const alternatives = [];
  
  // Generate available slots (6 AM to 6 PM in 3-hour blocks)
  for (let slot = 1; slot <= 4; slot++) {
    if (!occupied.has(slot)) {
      const startHour = 6 + (slot - 1) * 3;
      const endHour = startHour + 3;
      
      alternatives.push({
        time_slot: slot,
        start_time: `${startHour.toString().padStart(2, '0')}:00`,
        end_time: `${endHour.toString().padStart(2, '0')}:00`,
        availability: 'available'
      });
    }
  }
  
  return alternatives;
}

function calculateTimeUtilization(burnItems) {
  if (!burnItems || burnItems.length === 0) return 0;
  
  const timeSlots = [...new Set(burnItems.map(item => item.time_slot))];
  const maxPossibleSlots = 4; // 6AM-6PM in 3-hour blocks
  
  return timeSlots.length / maxPossibleSlots;
}

function analyzePriorityDistribution(timeSlotAnalysis) {
  if (timeSlotAnalysis.length === 0) return { score: 0, distribution: 'even' };
  
  const priorities = timeSlotAnalysis.map(slot => slot.avg_priority_in_slot);
  const sortedPriorities = [...priorities].sort((a, b) => b - a);
  
  // Check if high priority burns are scheduled first
  let correctOrder = 0;
  for (let i = 0; i < priorities.length - 1; i++) {
    if (priorities[i] >= priorities[i + 1]) {
      correctOrder++;
    }
  }
  
  const score = priorities.length > 1 ? correctOrder / (priorities.length - 1) : 1;
  
  return {
    score,
    distribution: score > 0.8 ? 'optimal' : score > 0.5 ? 'good' : 'poor',
    priority_sequence: priorities
  };
}

function calculateResourceUtilization(timeSlotAnalysis) {
  if (timeSlotAnalysis.length === 0) return 0;
  
  const avgBurnsPerSlot = timeSlotAnalysis.reduce((sum, slot) => sum + slot.burns_in_slot, 0) / timeSlotAnalysis.length;
  const maxRecommendedPerSlot = 3; // Assuming max 3 concurrent burns per time slot
  
  return Math.min(1, avgBurnsPerSlot / maxRecommendedPerSlot);
}

function calculateScalabilityFactor(totalBurns) {
  // Measure how well the algorithm scales with burn count
  if (totalBurns <= 5) return 1.0;
  if (totalBurns <= 10) return 0.9;
  if (totalBurns <= 20) return 0.8;
  return 0.7;
}

function getUnresolvedConflicts(timeSlotAnalysis) {
  // Estimate unresolved conflicts based on overlapping dispersions
  let unresolved = 0;
  
  for (let i = 0; i < timeSlotAnalysis.length; i++) {
    const slot = timeSlotAnalysis[i];
    if (slot.burns_in_slot > 1 && slot.max_dispersion && slot.max_dispersion > 3000) {
      unresolved += Math.max(0, slot.burns_in_slot - 2);
    }
  }
  
  return unresolved;
}

function calculateOverallConflictResolutionRate(conflictStats) {
  if (conflictStats.length === 0) return 1;
  
  const totalConflicts = conflictStats.reduce((sum, stat) => sum + stat.total_conflicts, 0);
  const resolvedConflicts = conflictStats.reduce((sum, stat) => sum + stat.resolved_conflicts, 0);
  
  return totalConflicts > 0 ? resolvedConflicts / totalConflicts : 1;
}

async function notifyScheduleUpdates(optimizationResult, io) {
  try {
    if (io && optimizationResult.scheduleCreated) {
      // Send real-time updates about new schedule
      io.emit('schedule_optimized', {
        date: optimizationResult.date,
        schedule_id: optimizationResult.scheduleId,
        optimization_score: optimizationResult.metrics?.overallScore,
        burns_scheduled: optimizationResult.burnsScheduled,
        conflicts_resolved: optimizationResult.metrics?.conflictsResolved
      });
      
      logger.agent('optimizer', 'debug', 'Schedule update notifications sent', {
        scheduleId: optimizationResult.scheduleId,
        burnsNotified: optimizationResult.burnsScheduled
      });
    }
  } catch (error) {
    logger.agent('optimizer', 'warn', 'Schedule notification failed', { error: error.message });
  }
}

module.exports = router;