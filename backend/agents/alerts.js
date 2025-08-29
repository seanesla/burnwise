/**
 * Alerts Agent - Stub Implementation with Socket.io
 * As per CLAUDE.md: "alerts (stub only - no functionality)"
 * Emits Socket.io events for frontend notifications but no actual SMS/email
 */

const logger = require('../middleware/logger');

class AlertsAgent {
  constructor() {
    this.initialized = false;
    this.io = null;
    logger.info('[ALERTS] Stub alerts agent initialized (Socket.io only)');
  }

  /**
   * Initialize with Socket.io instance
   */
  initialize(io) {
    this.io = io;
    this.initialized = true;
    logger.info('[ALERTS] Alerts agent initialized with Socket.io');
  }

  /**
   * Emit alert via Socket.io (stub - no actual SMS/email)
   */
  async sendAlert(type, data) {
    logger.debug('[ALERTS] Sending alert via Socket.io', { type, data });
    
    // Emit to Socket.io if available
    if (this.io) {
      const alertData = {
        type,
        ...data,
        timestamp: new Date().toISOString()
      };
      
      // Emit to all connected clients
      this.io.emit('alert', alertData);
      
      // Emit to farm-specific room if farmId provided
      if (data.farmId || data.farm_id) {
        const farmId = data.farmId || data.farm_id;
        this.io.to(`farm-${farmId}`).emit('farm-alert', alertData);
        logger.info(`[ALERTS] Emitted alert to farm-${farmId}`, { type });
      }
    }
    
    return { 
      success: true, 
      message: 'Alert emitted via Socket.io (stub - no SMS/email)',
      stub: true 
    };
  }

  /**
   * Stub method - no real implementation
   */
  async checkAlertConditions(burnRequest) {
    logger.debug('[ALERTS] Stub checkAlertConditions called');
    return {
      shouldAlert: false,
      reason: 'Stub implementation - no alerts',
      stub: true
    };
  }

  /**
   * Stub method - no real implementation
   */
  async processWeatherAlert(weatherData) {
    logger.debug('[ALERTS] Stub processWeatherAlert called');
    return {
      processed: true,
      message: 'Weather alert stub - no action taken',
      stub: true
    };
  }

  /**
   * Stub method - no real implementation
   */
  async getAlertHistory(farmId) {
    logger.debug('[ALERTS] Stub getAlertHistory called', { farmId });
    return [];
  }
}

// Export singleton instance
module.exports = new AlertsAgent();