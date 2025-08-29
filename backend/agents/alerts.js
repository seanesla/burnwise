/**
 * Alerts Agent - Stub Implementation
 * As per CLAUDE.md: "alerts (stub only - no functionality)"
 * This module exists to satisfy test requirements but provides no actual functionality
 */

const logger = require('../middleware/logger');

class AlertsAgent {
  constructor() {
    this.initialized = false;
    logger.info('[ALERTS] Stub alerts agent initialized (no functionality)');
  }

  /**
   * Stub method - no real implementation
   */
  async sendAlert(type, data) {
    logger.debug('[ALERTS] Stub sendAlert called', { type, data });
    return { 
      success: true, 
      message: 'Alert stub - no actual alert sent',
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