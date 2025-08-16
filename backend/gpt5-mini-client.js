/**
 * GPT-5-mini Client for BURNWISE
 * ONLY uses gpt-5-mini - NO FALLBACKS
 * August 15, 2025 - TiDB AgentX Hackathon
 */

const axios = require('axios');
const logger = require('./middleware/logger');

class GPT5MiniClient {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('FATAL: OPENAI_API_KEY required for GPT-5-mini - NO FALLBACKS');
    }
    
    this.model = 'gpt-5-mini';
    this.endpoint = 'https://api.openai.com/v1/responses';
  }
  
  /**
   * Complete a prompt using GPT-5-mini
   * NO FALLBACKS - if this fails, system fails
   */
  async complete(input, maxTokens = 500) {
    try {
      const response = await axios.post(this.endpoint, {
        model: this.model,
        input: input,
        reasoning: {
          effort: 'minimal'  // GPT-5 fast response mode
        },
        max_output_tokens: Math.max(maxTokens, 100)  // Minimum 100 to avoid incomplete
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'v1'  // Required for v1/responses endpoint
        },
        timeout: 60000  // Increased timeout for GPT-5
      });
      
      // Extract output from GPT-5-mini response structure
      const data = response.data;
      
      // GPT-5-mini returns output in this exact structure:
      // output[].content[].text where type === 'message'
      if (data.output && Array.isArray(data.output)) {
        // Look for message type output (this contains the actual response)
        const messageOutput = data.output.find(o => o.type === 'message');
        if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
          const textContent = messageOutput.content.find(c => c.type === 'output_text');
          if (textContent && textContent.text) {
            // GPT-5-mini is working! Return the response text
            logger.info(`GPT-5-mini response received (${data.model}): ${textContent.text.substring(0, 100)}...`);
            return textContent.text;
          }
        }
      }
      
      // Check if status is incomplete
      if (data.status === 'incomplete') {
        const reason = data.incomplete_details?.reason || 'unknown';
        logger.warn(`GPT-5-mini incomplete response: ${reason} - increasing token limit might help`);
        
        // Try to find any partial output
        if (data.output && Array.isArray(data.output)) {
          for (const output of data.output) {
            if (output.type === 'message' && output.content) {
              for (const content of output.content) {
                if (content.text) {
                  return content.text;
                }
              }
            }
          }
        }
        
        throw new Error(`GPT-5-mini incomplete: ${reason} - try increasing max_output_tokens`);
      }
      
      // If we can't find output, log for debugging
      logger.error('GPT-5-mini unexpected response structure:', JSON.stringify(data, null, 2));
      throw new Error('GPT-5-mini response has no readable output - check response structure');
      
    } catch (error) {
      if (error.response?.data?.error) {
        const errorMsg = error.response.data.error.message || error.response.data.error;
        logger.error(`GPT-5-mini API error: ${errorMsg}`);
        throw new Error(`GPT-5-mini failed: ${errorMsg} - NO FALLBACKS`);
      }
      throw new Error(`GPT-5-mini request failed: ${error.message} - NO FALLBACKS`);
    }
  }
  
  /**
   * Analyze agricultural data using GPT-5-mini
   */
  async analyze(prompt) {
    const fullPrompt = `You are GPT-5-mini, an AI assistant for BURNWISE agricultural burn management system.
    
Task: ${prompt}

Provide a concise, intelligent response.`;
    
    return this.complete(fullPrompt, 1000);
  }
  
  /**
   * Generate burn safety recommendations
   */
  async analyzeBurnSafety(burnData) {
    const prompt = `Analyze this agricultural burn request for safety:
    
Acres: ${burnData.acres}
Crop Type: ${burnData.crop_type}
Date: ${burnData.burn_date}
Time Window: ${burnData.time_window_start} - ${burnData.time_window_end}

Provide:
1. Safety assessment (safe/caution/danger)
2. Key risks
3. Recommendations`;
    
    return this.complete(prompt, 500);
  }
  
  /**
   * Analyze weather conditions for burning
   */
  async analyzeWeather(weatherData) {
    const prompt = `Analyze weather conditions for agricultural burning:
    
Temperature: ${weatherData.temperature}°F
Humidity: ${weatherData.humidity}%
Wind Speed: ${weatherData.windSpeed}mph
Wind Direction: ${weatherData.windDirection}°
Conditions: ${weatherData.condition}

Assess burn safety and optimal timing.`;
    
    return this.complete(prompt, 500);
  }
  
  /**
   * Test if GPT-5-mini is working
   */
  async test() {
    try {
      const response = await this.complete('Say "GPT-5-MINI ACTIVE"', 20);
      if (response) {
        logger.info('✅ GPT-5-mini test successful');
        return true;
      }
      throw new Error('No response from GPT-5-mini');
    } catch (error) {
      logger.error('❌ GPT-5-mini test failed:', error.message);
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

function getGPT5MiniClient() {
  if (!instance) {
    instance = new GPT5MiniClient();
  }
  return instance;
}

module.exports = {
  GPT5MiniClient,
  getGPT5MiniClient
};