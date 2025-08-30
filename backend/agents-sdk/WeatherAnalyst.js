/**
 * WeatherAnalyst - Autonomous Weather Safety Decisions
 * Uses GPT-5-nano for text analysis (cost-optimized)
 * Real OpenWeatherMap API integration
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const axios = require('axios');
const { query, vectorSimilaritySearch } = require('../db/connection');
const logger = require('../middleware/logger');

// Tool to fetch real weather data from OpenWeatherMap
const fetchWeatherData = tool({
  name: 'fetch_weather',
  description: 'Fetch current weather data from OpenWeatherMap API',
  parameters: z.object({
    lat: z.number(),
    lon: z.number()
  }),
  execute: async (input) => {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      return { error: 'OpenWeatherMap API key not configured' };
    }
    
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            lat: input.lat,
            lon: input.lon,
            appid: apiKey,
            units: 'imperial'
          }
        }
      );
      
      const data = response.data;
      return {
        temperature: data.main.temp,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg,
        description: data.weather[0].description,
        visibility: data.visibility,
        pressure: data.main.pressure
      };
    } catch (error) {
      logger.error('Weather API failed', error);
      return { error: 'Failed to fetch weather data' };
    }
  }
});

// Tool to analyze burn safety based on weather
const analyzeBurnSafety = tool({
  name: 'analyze_burn_safety',
  description: 'Analyze if weather conditions are safe for burning',
  parameters: z.object({
    windSpeed: z.number(),
    humidity: z.number(),
    temperature: z.number(),
    visibility: z.number().nullable().optional()
  }),
  execute: async (input) => {
    const { windSpeed, humidity, temperature, visibility } = input;
    
    // Safety thresholds
    const issues = [];
    let decision = 'SAFE';
    
    // Wind speed analysis
    if (windSpeed > 15) {
      issues.push('Wind speed exceeds 15 mph - HIGH RISK');
      decision = 'UNSAFE';
    } else if (windSpeed > 10) {
      issues.push('Wind speed elevated - monitor closely');
      if (decision === 'SAFE') decision = 'MARGINAL';
    }
    
    // Humidity analysis
    if (humidity < 30) {
      issues.push('Low humidity increases fire spread risk');
      decision = 'UNSAFE';
    } else if (humidity < 40) {
      issues.push('Humidity borderline - increased vigilance needed');
      if (decision === 'SAFE') decision = 'MARGINAL';
    }
    
    // Temperature analysis
    if (temperature > 95) {
      issues.push('Extreme heat - postpone burn');
      decision = 'UNSAFE';
    } else if (temperature > 85) {
      issues.push('High temperature - burn early morning only');
      if (decision === 'SAFE') decision = 'MARGINAL';
    }
    
    // Visibility check
    if (visibility && visibility < 5000) {
      issues.push('Poor visibility - potential smoke hazard');
      if (decision === 'SAFE') decision = 'MARGINAL';
    }
    
    return {
      decision,
      issues,
      needsApproval: decision === 'MARGINAL',
      confidence: decision === 'UNSAFE' ? 95 : (decision === 'SAFE' ? 90 : 75)
    };
  }
});

// Tool to store weather analysis in TiDB with vectors
const storeWeatherAnalysis = tool({
  name: 'store_weather_analysis',
  description: 'Store weather analysis with vector embeddings in TiDB',
  parameters: z.object({
    burnRequestId: z.number(),
    decision: z.enum(['SAFE', 'UNSAFE', 'MARGINAL']),
    conditions: z.object({
      temperature: z.number(),
      humidity: z.number(),
      windSpeed: z.number()
    }),
    confidence: z.number()
  }),
  execute: async (input) => {
    try {
      // Generate 128-dimensional weather pattern vector
      const vector = new Array(128).fill(0).map((_, i) => {
        // Create meaningful vector based on weather conditions
        const base = i / 128;
        const temp = input.conditions.temperature / 100;
        const humid = input.conditions.humidity / 100;
        const wind = input.conditions.windSpeed / 30;
        return base * temp + (1 - base) * humid * wind;
      });
      
      const sql = `
        INSERT INTO weather_analyses 
        (burn_request_id, decision, temperature, humidity, wind_speed, 
         confidence, weather_vector, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      
      await query(sql, [
        input.burnRequestId,
        input.decision,
        input.conditions.temperature,
        input.conditions.humidity,
        input.conditions.windSpeed,
        input.confidence,
        JSON.stringify(vector)
      ]);
      
      logger.info('WeatherAnalyst stored analysis', { 
        burnRequestId: input.burnRequestId,
        decision: input.decision 
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to store weather analysis', error);
      return { success: false, error: error.message };
    }
  }
});

/**
 * WeatherAnalyst Agent - Makes autonomous SAFE/UNSAFE/MARGINAL decisions
 * Uses GPT-5-nano for cost-effective text analysis
 */
const weatherAnalyst = new Agent({
  name: 'WeatherAnalyst',
  handoffDescription: 'I analyze weather conditions for burn safety using real-time data',
  
  instructions: `You are the WeatherAnalyst, responsible for determining burn safety based on weather.
    
    Your process:
    1. Fetch real weather data using fetch_weather tool
    2. Analyze conditions using analyze_burn_safety tool
    3. Make autonomous decisions: SAFE, UNSAFE, or MARGINAL
    4. Store analysis with vector embeddings for pattern matching
    5. Flag MARGINAL conditions for human approval
    
    Decision criteria:
    - SAFE: Wind < 10mph, Humidity 40-70%, Temp < 85°F
    - MARGINAL: Borderline conditions requiring human judgment
    - UNSAFE: Any parameter exceeds safety thresholds
    
    Provide clear explanations for your decisions. When MARGINAL, explain specific concerns.
    Always err on the side of safety - when in doubt, flag for human review.`,
  
  model: 'gpt-5-mini', // Standardized model per CLAUDE.md
  
  tools: [fetchWeatherData, analyzeBurnSafety, storeWeatherAnalysis]
});

module.exports = weatherAnalyst;