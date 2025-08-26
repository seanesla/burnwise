const logger = require('../middleware/logger');

/**
 * AGENT 5: STUB ALERTS AGENT
 * 
 * This is a stub agent that does nothing.
 * All notification functionality has been removed.
 */
class AlertsAgent {
  constructor() {
    this.agentName = 'alerts';
    this.version = '1.0.0';
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    logger.agent(this.agentName, 'info', 'Stub Alerts Agent initialized (no functionality)');
  }

  // Stub methods that do nothing
  async sendNotifications() {
    return { success: true, message: 'Stub - no notifications sent' };
  }

  async createAlert() {
    return { success: true, message: 'Stub - no alert created' };
  }

  async getAlerts() {
    return [];
  }

  async getDeliveryStatistics() {
    return {
      totalSent: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageDeliveryTime: 0
    };
  }

  async cleanupOldAlerts() {
    return { success: true, message: 'Stub - no cleanup needed' };
  }
}

module.exports = new AlertsAgent();
module.exports.AlertsAgent = AlertsAgent;