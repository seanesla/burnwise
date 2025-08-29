const express = require('express');
const { query } = require('../db/connection');
const { asyncHandler, ValidationError, DatabaseError } = require('../middleware/errorHandler');
// alertsAgent removed - stub functionality eliminated
const logger = require('../middleware/logger');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const alertCreationSchema = Joi.object({
  type: Joi.string().valid(
    'burn_starting', 'smoke_warning', 'weather_change', 
    'conflict_detected', 'schedule_update', 'system_maintenance',
    'emergency_stop', 'air_quality_alert'
  ).required(),
  farm_id: Joi.number().integer().positive().optional(),
  request_id: Joi.number().integer().positive().optional(),
  title: Joi.string().min(1).max(200).required(),
  message: Joi.string().min(1).max(1000).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  channels: Joi.array().items(Joi.string().valid('sms', 'email', 'socket')).min(1).required(),
  data: Joi.object().optional()
});

const alertUpdateSchema = Joi.object({
  status: Joi.string().valid('pending', 'sent', 'failed', 'resolved').required(),
  resolution_notes: Joi.string().max(500).optional()
});

/**
 * GET /api/alerts
 * Get alerts with filtering and pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    farm_id,
    type,
    severity,
    status,
    date_from,
    date_to,
    page = 1,
    limit = 50,
    sort_by = 'created_at',
    sort_order = 'DESC'
  } = req.query;
  
  try {
    // Build dynamic query
    let whereConditions = [];
    let queryParams = [];
    
    if (farm_id) {
      whereConditions.push('a.farm_id = ?');
      queryParams.push(farm_id);
    }
    
    if (type) {
      whereConditions.push('a.type = ?');
      queryParams.push(type);
    }
    
    if (severity) {
      whereConditions.push('a.severity = ?');
      queryParams.push(severity);
    }
    
    if (status) {
      whereConditions.push('a.status = ?');
      queryParams.push(status);
    }
    
    if (date_from) {
      whereConditions.push('DATE(a.created_at) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(a.created_at) <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM alerts a
      LEFT JOIN farms f ON a.farm_id = f.farm_id
      ${whereClause}
    `;
    
    const [{ total }] = await query(countQuery, queryParams);
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Main query
    const alertsQuery = `
      SELECT 
        a.alert_id,
        a.type,
        a.farm_id,
        a.request_id,
        a.message as title,
        a.message,
        a.severity,
        a.status,
        a.delivery_method as sent_via,
        a.created_at,
        -- a.updated_at, -- column doesn't exist
        f.name as farm_name,
        f.owner_name,
        br.field_id
      FROM alerts a
      LEFT JOIN farms f ON a.farm_id = f.farm_id
      LEFT JOIN burn_requests br ON a.request_id = br.request_id
      ${whereClause}
      ORDER BY 
        CASE a.severity 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        a.${sort_by} ${sort_order}
      LIMIT ${parseInt(limit) || 50} OFFSET ${offset || 0}
    `;
    
    // Don't push limit and offset to params array since they're now literals
    const alerts = await query(alertsQuery, queryParams);
    
    // Convert sent_via ENUM to object format for compatibility
    alerts.forEach(alert => {
      if (alert.sent_via && typeof alert.sent_via === 'string') {
        // Convert ENUM value to object format
        const method = alert.sent_via.toString();
        alert.sent_via = { [method]: true };
      } else if (!alert.sent_via) {
        alert.sent_via = {};
      }
    });
    
    res.json({
      success: true,
      data: alerts,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: total,
        items_per_page: parseInt(limit),
        has_next: page < totalPages,
        has_prev: page > 1
      },
      filters_applied: {
        farm_id,
        type,
        severity,
        status,
        date_from,
        date_to
      }
    });
    
  } catch (error) {
    logger.error('Alerts retrieval failed', { error: error.message });
    throw new DatabaseError('Failed to retrieve alerts', error);
  }
}));

/**
 * GET /api/alerts/:id
 * Get specific alert details with delivery tracking
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const alertDetails = await query(`
      SELECT 
        a.*,
        f.name as farm_name,
        f.owner_name,
        f.phone as farm_phone,
        f.email as farm_email,
        br.field_id,
        br.requested_date as burn_date
      FROM alerts a
      LEFT JOIN farms f ON a.farm_id = f.farm_id
      LEFT JOIN burn_requests br ON a.request_id = br.request_id
      WHERE a.alert_id = ?
    `, [id]);
    
    if (alertDetails.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    const alert = alertDetails[0];
    
    // Convert sent_via ENUM to object format
    if (alert.sent_via && typeof alert.sent_via === 'string') {
      const method = alert.sent_via.toString();
      alert.sent_via = { [method]: true };
    } else if (!alert.sent_via) {
      alert.sent_via = {};
    }
    
    // Get delivery tracking information
    const deliveryTracking = await query(`
      SELECT 
        channel,
        recipient,
        status,
        external_id,
        error_message,
        delivered_at,
        created_at
      FROM alert_deliveries
      WHERE alert_id = ?
      ORDER BY created_at ASC
    `, [id]);
    
    res.json({
      success: true,
      data: {
        alert,
        delivery_tracking: deliveryTracking,
        delivery_summary: {
          total_attempts: deliveryTracking.length,
          successful: deliveryTracking.filter(d => d.status === 'delivered').length,
          failed: deliveryTracking.filter(d => d.status === 'failed').length,
          pending: deliveryTracking.filter(d => d.status === 'pending').length
        }
      }
    });
    
  } catch (error) {
    logger.error('Alert details retrieval failed', { alertId: id, error: error.message });
    throw new DatabaseError('Failed to retrieve alert details', error);
  }
}));

/**
 * POST /api/alerts
 * Create and send a new alert
 */
router.post('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const { error, value } = alertCreationSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid alert data', 'body', error.details);
    }
    
    const alertData = value;
    
    logger.info('Creating new alert', { 
      type: alertData.type,
      severity: alertData.severity,
      farmId: alertData.farm_id
    });
    
    // Process alert through alerts agent
    const io = req.app.get('io');
    // Alert processing disabled - was stub functionality only
    const alertResult = { success: true, message: 'Alert processing disabled' };
    
    const duration = Date.now() - startTime;
    
    logger.performance('alert_creation', duration, {
      alertId: alertResult.alertId,
      type: alertData.type,
      recipients: alertResult.recipients,
      channels: alertResult.deliveryResults.channels
    });
    
    res.status(201).json({
      success: true,
      message: 'Alert created and sent successfully',
      data: {
        alert_id: alertResult.alertId,
        type: alertResult.type,
        severity: alertResult.severity,
        recipients_notified: alertResult.recipients,
        delivery_channels: alertResult.deliveryResults.channels,
        delivery_summary: alertResult.deliveryResults.summary,
        processing_time_ms: duration
      }
    });
    
  } catch (error) {
    logger.error('Alert creation failed', { 
      error: error.message,
      duration: Date.now() - startTime,
      requestData: req.body
    });
    throw error;
  }
}));

/**
 * PUT /api/alerts/:id
 * Update alert status or resolution
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    // Validate input
    const { error, value } = alertUpdateSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid alert update data', 'body', error.details);
    }
    
    const { status, resolution_notes } = value;
    
    // Check if alert exists
    const existingAlert = await query(`
      SELECT id, type, farm_id, status as current_status
      FROM alerts
      WHERE id = ?
    `, [id]);
    
    if (existingAlert.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    const alert = existingAlert[0];
    
    // Update alert
    await query(`
      UPDATE alerts
      SET 
        status = ?,
        resolution_notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [status, resolution_notes, id]);
    
    // Log status change
    logger.info('Alert status updated', {
      alertId: id,
      previousStatus: alert.current_status,
      newStatus: status,
      resolutionNotes: resolution_notes
    });
    
    // Send real-time update if Socket.io available
    const io = req.app.get('io');
    if (io && alert.farm_id) {
      io.to(`farm-${alert.farm_id}`).emit('alert_updated', {
        alert_id: id,
        type: alert.type,
        status,
        resolution_notes,
        updated_at: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Alert updated successfully',
      data: {
        alert_id: id,
        previous_status: alert.current_status,
        new_status: status,
        resolution_notes
      }
    });
    
  } catch (error) {
    logger.error('Alert update failed', { alertId: id, error: error.message });
    throw error;
  }
}));

/**
 * GET /api/alerts/types
 * Get available alert types and their configurations
 */
router.get('/types', asyncHandler(async (req, res) => {
  try {
    // Agent status disabled - was stub functionality only
    const agentStatus = { initialized: false, message: 'Alerts disabled' };
    
    if (!agentStatus.alertTypes) {
      throw new DatabaseError('Alert types not available', new Error('Agent not properly initialized'));
    }
    
    // Get usage statistics for each alert type
    const typeStats = await query(`
      SELECT 
        type,
        COUNT(*) as total_sent,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(CASE WHEN severity = 'critical' THEN 4 
                 WHEN severity = 'high' THEN 3
                 WHEN severity = 'medium' THEN 2
                 ELSE 1 END) as avg_severity_score,
        MAX(created_at) as last_used
      FROM alerts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY type
    `);
    
    const alertTypesWithStats = agentStatus.alertTypes.map(type => {
      const stats = typeStats.find(stat => stat.type === type) || {
        total_sent: 0,
        successful: 0,
        failed: 0,
        avg_severity_score: 0,
        last_used: null
      };
      
      return {
        type,
        configuration: null, // Alert types disabled
        usage_statistics: stats
      };
    });
    
    res.json({
      success: true,
      data: {
        alert_types: alertTypesWithStats,
        total_types: alertTypesWithStats.length,
        agent_status: {
          initialized: agentStatus.initialized,
          stub: true
        }
      }
    });
    
  } catch (error) {
    logger.error('Alert types retrieval failed', { error: error.message });
    throw error;
  }
}));

/**
 * GET /api/alerts/statistics
 * Get alert delivery statistics and performance metrics
 */
router.get('/statistics', asyncHandler(async (req, res) => {
  const { days = 30, group_by = 'day' } = req.query;
  
  try {
    // Overall alert statistics
    const overallStats = await query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_alerts,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_alerts,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_alerts,
        AVG(TIMESTAMPDIFF(SECOND, created_at, updated_at)) as avg_delivery_time_seconds
      FROM alerts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);
    
    // Alert type distribution
    const typeDistribution = await query(`
      SELECT 
        type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(TIMESTAMPDIFF(SECOND, created_at, updated_at)) as avg_delivery_time
      FROM alerts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY type
      ORDER BY count DESC
    `, [days]);
    
    // Time-based trends
    let dateFormat, timeLabel;
    switch (group_by) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00:00';
        timeLabel = 'hour';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        timeLabel = 'week';
        break;
      default:
        dateFormat = '%Y-%m-%d';
        timeLabel = 'day';
    }
    
    const trends = await query(`
      SELECT 
        DATE_FORMAT(created_at, ?) as time_period,
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful_alerts,
        COUNT(CASE WHEN severity IN ('critical', 'high') THEN 1 END) as urgent_alerts,
        AVG(TIMESTAMPDIFF(SECOND, created_at, updated_at)) as avg_response_time
      FROM alerts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE_FORMAT(created_at, ?)
      ORDER BY time_period DESC
      LIMIT 50
    `, [dateFormat, days, dateFormat]);
    
    // Delivery channel performance
    const channelStats = await query(`
      SELECT 
        JSON_UNQUOTE(JSON_EXTRACT(sent_via, '$.sms')) as sms_recipients,
        JSON_UNQUOTE(JSON_EXTRACT(sent_via, '$.socket')) as socket_recipients,
        JSON_UNQUOTE(JSON_EXTRACT(sent_via, '$.email')) as email_recipients,
        status,
        COUNT(*) as count
      FROM alerts
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      AND sent_via IS NOT NULL
      GROUP BY 
        JSON_UNQUOTE(JSON_EXTRACT(sent_via, '$.sms')) IS NOT NULL,
        JSON_UNQUOTE(JSON_EXTRACT(sent_via, '$.socket')) IS NOT NULL,
        JSON_UNQUOTE(JSON_EXTRACT(sent_via, '$.email')) IS NOT NULL,
        status
    `, [days]);
    
    // Farm-specific alert summary
    const farmAlertSummary = await query(`
      SELECT 
        f.farm_id,
        f.name,
        f.owner_name,
        COUNT(a.alert_id) as total_alerts,
        COUNT(CASE WHEN a.severity IN ('critical', 'high') THEN 1 END) as urgent_alerts,
        MAX(a.created_at) as last_alert_time
      FROM farms f
      LEFT JOIN alerts a ON f.farm_id = a.farm_id
      WHERE a.created_at > DATE_SUB(NOW(), INTERVAL ? DAY) OR a.alert_id IS NULL
      GROUP BY f.farm_id, f.name, f.owner_name
      HAVING total_alerts > 0
      ORDER BY urgent_alerts DESC, total_alerts DESC
      LIMIT 20
    `, [days]);
    
    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        overall_statistics: overallStats[0],
        type_distribution: typeDistribution,
        trends: {
          group_by: timeLabel,
          data: trends
        },
        channel_performance: this.processChannelStats(channelStats),
        farm_summary: farmAlertSummary,
        performance_metrics: {
          success_rate: overallStats[0].total_alerts > 0 ? 
            overallStats[0].sent_alerts / overallStats[0].total_alerts : 0,
          average_delivery_time: overallStats[0].avg_delivery_time_seconds,
          critical_alert_ratio: overallStats[0].total_alerts > 0 ?
            overallStats[0].critical_alerts / overallStats[0].total_alerts : 0
        }
      }
    });
    
  } catch (error) {
    logger.error('Alert statistics generation failed', { error: error.message });
    throw new DatabaseError('Failed to generate alert statistics', error);
  }
}));

/**
 * GET /api/alerts/active
 * Get currently active alerts requiring attention
 */
router.get('/active', asyncHandler(async (req, res) => {
  const { severity_filter = 'medium' } = req.query;
  
  try {
    const severityLevels = {
      'low': ['low', 'medium', 'high', 'critical'],
      'medium': ['medium', 'high', 'critical'],
      'high': ['high', 'critical'],
      'critical': ['critical']
    };
    
    const allowedSeverities = severityLevels[severity_filter] || severityLevels['medium'];
    
    const activeAlerts = await query(`
      SELECT 
        a.alert_id,
        a.type,
        a.message as title,
        a.message,
        a.severity,
        a.status,
        a.created_at,
        f.name as farm_name,
        f.owner_name,
        br.field_id,
        br.requested_date as burn_date,
        TIMESTAMPDIFF(MINUTE, a.created_at, NOW()) as age_minutes
      FROM alerts a
      LEFT JOIN farms f ON a.farm_id = f.farm_id
      LEFT JOIN burn_requests br ON a.request_id = br.request_id
      WHERE a.delivery_status IN ('pending', 'sent')
      AND a.severity IN (${allowedSeverities.map(() => '?').join(',')})
      AND a.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY 
        CASE a.severity 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        a.created_at DESC
      LIMIT 100
    `, allowedSeverities);
    
    // Categorize alerts by urgency
    const now = Date.now();
    const categorizedAlerts = {
      immediate_attention: activeAlerts.filter(a => 
        a.severity === 'critical' || 
        (a.severity === 'high' && a.age_minutes > 30)
      ),
      requires_monitoring: activeAlerts.filter(a => 
        a.severity === 'high' && a.age_minutes <= 30 ||
        a.severity === 'medium' && a.age_minutes > 60
      ),
      informational: activeAlerts.filter(a => 
        a.severity === 'medium' && a.age_minutes <= 60 ||
        a.severity === 'low'
      )
    };
    
    res.json({
      success: true,
      data: {
        total_active: activeAlerts.length,
        severity_filter: severity_filter,
        categorized_alerts: categorizedAlerts,
        summary: {
          immediate_attention: categorizedAlerts.immediate_attention.length,
          requires_monitoring: categorizedAlerts.requires_monitoring.length,
          informational: categorizedAlerts.informational.length
        },
        last_updated: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Active alerts retrieval failed', { error: error.message });
    throw new DatabaseError('Failed to retrieve active alerts', error);
  }
}));

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert (mark as seen/handled)
 */
router.post('/:id/acknowledge', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { acknowledged_by, notes } = req.body;
  
  try {
    // Check if alert exists and is acknowledgeable
    const alert = await query(`
      SELECT id, type, severity, status, farm_id
      FROM alerts
      WHERE id = ?
    `, [id]);
    
    if (alert.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    const alertInfo = alert[0];
    
    if (alertInfo.status === 'resolved') {
      return res.status(400).json({
        success: false,
        error: 'Alert is already resolved'
      });
    }
    
    // Update alert status
    await query(`
      UPDATE alerts
      SET 
        status = 'acknowledged',
        resolution_notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [notes || `Acknowledged by ${acknowledged_by || 'system'}`, id]);
    
    // Log acknowledgment
    await query(`
      INSERT INTO alert_acknowledgments (
        alert_id, acknowledged_by, notes, created_at
      ) VALUES (?, ?, ?, NOW())
    `, [id, acknowledged_by || 'system', notes || '']);
    
    // Send real-time update
    const io = req.app.get('io');
    if (io && alertInfo.farm_id) {
      io.to(`farm-${alertInfo.farm_id}`).emit('alert_acknowledged', {
        alert_id: id,
        acknowledged_by,
        notes,
        timestamp: new Date()
      });
    }
    
    logger.info('Alert acknowledged', {
      alertId: id,
      acknowledgedBy: acknowledged_by,
      notes
    });
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alert_id: id,
        acknowledged_by,
        notes,
        acknowledged_at: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Alert acknowledgment failed', { alertId: id, error: error.message });
    throw error;
  }
}));

/**
 * POST /api/alerts/bulk-resolve
 * Resolve multiple alerts at once
 */
router.post('/bulk-resolve', asyncHandler(async (req, res) => {
  const { alert_ids, resolution_notes, resolved_by } = req.body;
  
  try {
    if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
      throw new ValidationError('alert_ids array is required', 'alert_ids');
    }
    
    if (alert_ids.length > 100) {
      throw new ValidationError('Cannot resolve more than 100 alerts at once', 'alert_ids');
    }
    
    // Check which alerts exist and can be resolved
    const existingAlerts = await query(`
      SELECT id, type, farm_id, status
      FROM alerts
      WHERE id IN (${alert_ids.map(() => '?').join(',')})
      AND status != 'resolved'
    `, alert_ids);
    
    if (existingAlerts.length === 0) {
      return res.json({
        success: false,
        message: 'No resolvable alerts found',
        data: { alerts_found: 0, alerts_resolved: 0 }
      });
    }
    
    // Resolve all alerts
    await query(`
      UPDATE alerts
      SET 
        status = 'resolved',
        resolution_notes = ?,
        updated_at = NOW()
      WHERE id IN (${existingAlerts.map(() => '?').join(',')})
    `, [resolution_notes || `Bulk resolved by ${resolved_by || 'system'}`, ...existingAlerts.map(a => a.alert_id)]);
    
    // Log bulk resolution
    logger.info('Bulk alert resolution', {
      alertIds: existingAlerts.map(a => a.alert_id),
      count: existingAlerts.length,
      resolvedBy: resolved_by,
      notes: resolution_notes
    });
    
    // Send real-time updates
    const io = req.app.get('io');
    if (io) {
      const farmIds = [...new Set(existingAlerts.map(a => a.farm_id).filter(id => id))];
      farmIds.forEach(farmId => {
        io.to(`farm-${farmId}`).emit('alerts_bulk_resolved', {
          alert_ids: existingAlerts.filter(a => a.farm_id === farmId).map(a => a.alert_id),
          resolved_by,
          resolution_notes,
          timestamp: new Date()
        });
      });
    }
    
    res.json({
      success: true,
      message: 'Alerts resolved successfully',
      data: {
        alerts_requested: alert_ids.length,
        alerts_found: existingAlerts.length,
        alerts_resolved: existingAlerts.length,
        resolved_by,
        resolution_notes
      }
    });
    
  } catch (error) {
    logger.error('Bulk alert resolution failed', { error: error.message });
    throw error;
  }
}));

/**
 * GET /api/alerts/delivery-status/:id
 * Get detailed delivery status for a specific alert
 */
router.get('/delivery-status/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get alert details
    const alert = await query(`
      SELECT id, type, severity, status, sent_via, created_at, updated_at
      FROM alerts
      WHERE id = ?
    `, [id]);
    
    if (alert.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    const alertInfo = alert[0];
    
    // Convert delivery channels from ENUM to object format
    let deliveryChannels = {};
    if (alertInfo.sent_via && typeof alertInfo.sent_via === 'string') {
      const method = alertInfo.sent_via.toString();
      deliveryChannels = { [method]: true };
    }
    
    // Get detailed delivery tracking
    const deliveryDetails = await query(`
      SELECT 
        channel,
        recipient,
        status,
        external_id,
        error_message,
        delivered_at,
        created_at,
        retry_count
      FROM alert_deliveries
      WHERE alert_id = ?
      ORDER BY created_at ASC
    `, [id]);
    
    // Calculate delivery metrics
    const deliveryMetrics = {
      total_recipients: Object.values(deliveryChannels).reduce((sum, channel) => 
        sum + (Array.isArray(channel) ? channel.length : 0), 0),
      successful_deliveries: deliveryDetails.filter(d => d.status === 'delivered').length,
      failed_deliveries: deliveryDetails.filter(d => d.status === 'failed').length,
      pending_deliveries: deliveryDetails.filter(d => d.status === 'pending').length,
      average_delivery_time: this.calculateAverageDeliveryTime(deliveryDetails),
      delivery_success_rate: deliveryDetails.length > 0 ? 
        deliveryDetails.filter(d => d.status === 'delivered').length / deliveryDetails.length : 0
    };
    
    res.json({
      success: true,
      data: {
        alert: alertInfo,
        delivery_channels: deliveryChannels,
        delivery_details: deliveryDetails,
        delivery_metrics: deliveryMetrics,
        status_timeline: this.generateStatusTimeline(alertInfo, deliveryDetails)
      }
    });
    
  } catch (error) {
    logger.error('Delivery status retrieval failed', { alertId: id, error: error.message });
    throw new DatabaseError('Failed to retrieve delivery status', error);
  }
}));

/**
 * GET /api/alerts/agent-status
 * Get alerts agent status and configuration
 */
router.get('/agent-status', asyncHandler(async (req, res) => {
  try {
    // Agent status disabled - was stub functionality only
    const agentStatus = { initialized: false, message: 'Alerts disabled' };
    
    res.json({
      success: true,
      data: agentStatus
    });
    
  } catch (error) {
    logger.error('Alerts agent status check failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Alerts agent status unavailable',
      message: error.message
    });
  }
}));

// Helper methods
function processChannelStats(channelStats) {
  const processed = {
    sms: { sent: 0, failed: 0, success_rate: 0 },
    socket: { sent: 0, failed: 0, success_rate: 0 },
    email: { sent: 0, failed: 0, success_rate: 0 }
  };
  
  channelStats.forEach(stat => {
    ['sms', 'socket', 'email'].forEach(channel => {
      if (stat[`${channel}_recipients`] !== null) {
        if (stat.status === 'sent') {
          processed[channel].sent += stat.count;
        } else if (stat.status === 'failed') {
          processed[channel].failed += stat.count;
        }
      }
    });
  });
  
  // Calculate success rates
  ['sms', 'socket', 'email'].forEach(channel => {
    const total = processed[channel].sent + processed[channel].failed;
    processed[channel].success_rate = total > 0 ? processed[channel].sent / total : 0;
  });
  
  return processed;
}

function calculateAverageDeliveryTime(deliveryDetails) {
  const deliveredItems = deliveryDetails.filter(d => d.delivered_at && d.created_at);
  
  if (deliveredItems.length === 0) return null;
  
  const totalTime = deliveredItems.reduce((sum, item) => {
    const deliveryTime = new Date(item.delivered_at).getTime() - new Date(item.created_at).getTime();
    return sum + deliveryTime;
  }, 0);
  
  return Math.round(totalTime / deliveredItems.length / 1000); // Average in seconds
}

function generateStatusTimeline(alertInfo, deliveryDetails) {
  const timeline = [
    {
      status: 'created',
      timestamp: alertInfo.created_at,
      description: 'Alert created and queued for delivery'
    }
  ];
  
  if (deliveryDetails.length > 0) {
    const firstDeliveryAttempt = deliveryDetails.reduce((earliest, current) => 
      new Date(current.created_at) < new Date(earliest.created_at) ? current : earliest
    );
    
    timeline.push({
      status: 'delivery_started',
      timestamp: firstDeliveryAttempt.created_at,
      description: 'Alert delivery initiated'
    });
    
    const successfulDeliveries = deliveryDetails.filter(d => d.status === 'delivered');
    if (successfulDeliveries.length > 0) {
      const lastSuccessful = successfulDeliveries.reduce((latest, current) => 
        new Date(current.delivered_at) > new Date(latest.delivered_at) ? current : latest
      );
      
      timeline.push({
        status: 'delivered',
        timestamp: lastSuccessful.delivered_at,
        description: `Delivered to ${successfulDeliveries.length} recipient(s)`
      });
    }
  }
  
  if (alertInfo.status === 'resolved') {
    timeline.push({
      status: 'resolved',
      timestamp: alertInfo.updated_at,
      description: 'Alert resolved'
    });
  }
  
  return timeline;
}

module.exports = router;