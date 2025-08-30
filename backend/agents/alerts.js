/**
 * Alerts Agent - GPT-5-mini AI Integration with Socket.io
 * Uses GPT-5-mini for intelligent alert generation and risk assessment
 * Emits Socket.io events for frontend notifications but no actual SMS/email
 */

const logger = require('../middleware/logger');
const { GPT5MiniClient } = require('../gpt5-mini-client');

class AlertsAgent {
  constructor() {
    this.initialized = false;
    this.io = null;
    this.gpt5Client = null;
    this.agentName = 'alerts';
    logger.agent(this.agentName, 'info', 'Initializing Alerts Agent with GPT-5-mini AI');
  }

  /**
   * Initialize with Socket.io instance and GPT-5-mini
   */
  async initialize(io) {
    try {
      logger.agent(this.agentName, 'info', 'Initializing Alerts Agent with GPT-5-mini + Socket.io');
      
      // Initialize Socket.io
      this.io = io;
      
      // Initialize GPT-5-mini client for intelligent alert generation
      this.gpt5Client = new GPT5MiniClient();
      await this.testGPT5Connection();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Alerts Agent initialized with GPT-5-mini + Socket.io');
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize Alerts Agent', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Test GPT-5-mini connection
   */
  async testGPT5Connection() {
    try {
      const testPrompt = 'Test GPT-5-mini connection for alerts agent. Return: SUCCESS';
      const response = await this.gpt5Client.analyze(testPrompt, 'gpt-5-mini');
      logger.agent(this.agentName, 'info', 'GPT-5-mini connection test successful');
      return true;
    } catch (error) {
      logger.agent(this.agentName, 'error', 'GPT-5-mini connection test failed', { error: error.message });
      throw new Error(`GPT-5-mini connection failed: ${error.message}`);
    }
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