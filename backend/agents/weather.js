const logger = require('../middleware/logger');
const { query } = require('../db/connection');
const { AgentError, ExternalServiceError } = require('../middleware/errorHandler');
const axios = require('axios');
const moment = require('moment');

/**
 * AGENT 2: WEATHER ANALYSIS AGENT
 * 
 * Uses REAL weather data from OpenWeatherMap API
 * Then analyzes it with GPT-5 AI for intelligent insights
 * NO FAKE DATA - Real weather or fail
 */
class WeatherAgent {
  constructor() {
    this.agentName = 'weather';
    this.version = '2.0.0'; // Updated for real AI
    this.initialized = false;
    
    // REQUIRED: Real OpenWeatherMap API key (checked in initialize)
    this.apiKey = null;
    
    // OpenWeatherMap API endpoints
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    
    // Weather thresholds for burn safety
    this.optimalConditions = {
      windSpeed: { min: 2, max: 15 }, // mph
      humidity: { min: 30, max: 70 }, // percentage
      temperature: { min: 45, max: 85 }, // fahrenheit
      visibility: { min: 5 }, // miles
      pressure: { min: 29.5, max: 30.5 } // inches Hg
    };
    
    this.weatherCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  async initialize() {
    try {
      logger.agent(this.agentName, 'info', 'Initializing Weather Agent with REAL data');
      
      // Check for API key now that env is loaded
      this.apiKey = process.env.OPENWEATHERMAP_API_KEY;
      if (!this.apiKey) {
        throw new Error('OPENWEATHERMAP_API_KEY is REQUIRED for real weather data');
      }
      
      // Test that we can get REAL weather data
      await this.testWeatherAPI();
      
      // Verify GPT-5 is available for AI analysis
      await this.testAIConnection();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Weather Agent ready with REAL weather + AI');
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize', { error: error.message });
      throw new AgentError(this.agentName, 'initialization', error.message, error);
    }
  }

  async testWeatherAPI() {
    try {
      // Test with a real location to verify we get real weather
      const testResponse = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: 'Davis,CA,US', // Real agricultural area in California
          appid: this.apiKey,
          units: 'imperial' // Fahrenheit for US
        },
        timeout: 10000
      });
      
      if (testResponse.status === 200 && testResponse.data.main) {
        const temp = testResponse.data.main.temp;
        logger.agent(this.agentName, 'info', `Real weather API working - Current temp in Davis: ${temp}°F`);
      } else {
        throw new Error('Invalid weather response');
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenWeatherMap API key - need REAL key for real weather');
      }
      throw new Error(`OpenWeatherMap test failed: ${error.message}`);
    }
  }

  async testAIConnection() {
    try {
      // Test GPT-5-mini using the working client
      const { GPT5MiniClient } = require('../gpt5-mini-client');
      this.gpt5Client = new GPT5MiniClient();
      
      // Test the connection
      const response = await this.gpt5Client.complete('Respond with: AI ready', 20);
      
      if (response) {
        logger.agent(this.agentName, 'info', 'GPT-5-mini AI connection verified');
        logger.agent(this.agentName, 'info', 'Model: gpt-5-mini | Endpoint: /v1/responses');
      } else {
        throw new Error('GPT-5-mini test failed - no response');
      }
    } catch (error) {
      throw new Error(`GPT-5-mini REQUIRED - NO FALLBACKS: ${error.message}`);
    }
  }

  /**
   * Fetch REAL current weather data from OpenWeatherMap
   * This is ACTUAL weather happening right now, not fake data
   */
  async fetchCurrentWeather(location) {
    try {
      logger.agent(this.agentName, 'info', `Fetching REAL weather for ${location.city || location.lat + ',' + location.lng}`);
      
      // Build API request based on location type
      const params = {
        appid: this.apiKey,
        units: 'imperial' // Get temperature in Fahrenheit
      };
      
      if (location.city) {
        params.q = `${location.city},${location.state || ''},${location.country || 'US'}`;
      } else if (location.lat && location.lng) {
        params.lat = location.lat;
        params.lon = location.lng;
      } else {
        throw new Error('Invalid location format');
      }
      
      // Call REAL weather API
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params,
        timeout: 10000
      });
      
      if (!response.data || !response.data.main) {
        throw new Error('Invalid weather data received');
      }
      
      // Parse REAL weather data
      const weather = response.data;
      const currentWeather = {
        temperature: Math.round(weather.main.temp),
        feels_like: Math.round(weather.main.feels_like),
        humidity: weather.main.humidity,
        pressure: weather.main.pressure * 0.02953, // Convert to inHg
        windSpeed: Math.round(weather.wind.speed),
        windDirection: weather.wind.deg,
        windGust: weather.wind.gust || null,
        cloudCover: weather.clouds.all,
        visibility: weather.visibility ? weather.visibility / 1609.34 : null, // Convert to miles
        condition: weather.weather[0].main,
        description: weather.weather[0].description,
        uvIndex: null, // Will fetch separately if needed
        sunrise: weather.sys.sunrise,
        sunset: weather.sys.sunset,
        timestamp: new Date(),
        location: {
          name: weather.name,
          lat: weather.coord.lat,
          lng: weather.coord.lon
        }
      };
      
      logger.agent(this.agentName, 'info', `Got REAL weather: ${currentWeather.temperature}°F, ${currentWeather.humidity}% humidity, ${currentWeather.windSpeed}mph wind`);
      
      return currentWeather;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to fetch real weather', { error: error.message });
      throw new ExternalServiceError('OpenWeatherMap', `Failed to get real weather: ${error.message}`);
    }
  }

  /**
   * Fetch REAL weather forecast from OpenWeatherMap
   * This is the actual forecast from meteorologists, not made up
   */
  async fetchWeatherForecast(location) {
    try {
      const params = {
        appid: this.apiKey,
        units: 'imperial',
        cnt: 40 // Get 40 data points (5 days, every 3 hours)
      };
      
      if (location.city) {
        params.q = `${location.city},${location.state || ''},${location.country || 'US'}`;
      } else if (location.lat && location.lng) {
        params.lat = location.lat;
        params.lon = location.lng;
      }
      
      // Get REAL forecast data
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params,
        timeout: 10000
      });
      
      if (!response.data || !response.data.list) {
        throw new Error('Invalid forecast data');
      }
      
      // Parse REAL forecast
      const forecast = response.data.list.map(item => ({
        datetime: item.dt_txt,
        timestamp: item.dt * 1000,
        temperature: Math.round(item.main.temp),
        feels_like: Math.round(item.main.feels_like),
        humidity: item.main.humidity,
        pressure: item.main.pressure * 0.02953,
        windSpeed: Math.round(item.wind.speed),
        windDirection: item.wind.deg,
        windGust: item.wind.gust || null,
        cloudCover: item.clouds.all,
        precipitationProb: item.pop * 100, // Probability of precipitation
        rain: item.rain ? item.rain['3h'] : 0,
        condition: item.weather[0].main,
        description: item.weather[0].description
      }));
      
      logger.agent(this.agentName, 'info', `Got REAL forecast: ${forecast.length} data points over next 5 days`);
      
      return forecast;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to fetch real forecast', { error: error.message });
      throw new ExternalServiceError('OpenWeatherMap', `Failed to get real forecast: ${error.message}`);
    }
  }

  /**
   * Generate AI-powered weather vector using REAL weather data
   * Combines real weather with GPT-5 analysis for intelligent insights
   */
  async generateWeatherVector(currentWeather, forecast) {
    // Create comprehensive weather description from REAL data
    const weatherDescription = `
      REAL Current Weather Conditions (from OpenWeatherMap):
      Location: ${currentWeather.location?.name || 'Unknown'}
      Temperature: ${currentWeather.temperature}°F (feels like ${currentWeather.feels_like}°F)
      Humidity: ${currentWeather.humidity}%
      Wind: ${currentWeather.windSpeed}mph from ${currentWeather.windDirection}°
      Pressure: ${currentWeather.pressure.toFixed(2)} inHg
      Condition: ${currentWeather.condition} - ${currentWeather.description}
      Visibility: ${currentWeather.visibility ? currentWeather.visibility.toFixed(1) : 'N/A'} miles
      Cloud Cover: ${currentWeather.cloudCover}%
      
      REAL Weather Forecast (next 24 hours):
      ${forecast.slice(0, 8).map((f, i) => 
        `${moment(f.timestamp).format('HH:mm')}: ${f.temperature}°F, ${f.windSpeed}mph, ${f.humidity}%, ${f.precipitationProb.toFixed(0)}% rain chance`
      ).join('\n      ')}
      
      Agricultural Burn Safety Analysis Required:
      Evaluate these REAL conditions for safe agricultural burning.
      Consider smoke dispersion, fire spread risk, and air quality impact.
    `;
    
    try {
      // Use GPT-5-mini to analyze the REAL weather data - NO FALLBACKS
      if (!this.gpt5Client) {
        throw new Error('GPT-5-mini client not initialized - NO FALLBACKS');
      }
      
      const analysisPrompt = `You are an agricultural burn safety AI expert using GPT-5-mini. 
      
Analyze this REAL weather data for agricultural burn safety:
${weatherDescription}

CRITICAL REQUIREMENTS - Provide evidence-based analysis with specific sources:
1) Safety Assessment: SAFE/CAUTION/DANGER with justification
   - Include wind speed thresholds (EPA recommends 4-15 mph for burning)
   - Reference humidity levels (NFPA suggests 30-60% optimal)
   - Cite visibility requirements (minimum 3 miles per EPA guidelines)

2) Best Burn Window: Specific time range with meteorological reasoning
   - Include atmospheric stability class (Pasquill-Gifford A-F)
   - Reference mixing height data
   - Provide confidence percentage (e.g., "85% confidence based on...")

3) Risk Factors: Quantified risks with regulatory context
   - PM2.5 exposure levels vs EPA NAAQS (35 µg/m³ daily)
   - Fire spread risk based on Keetch-Byram Drought Index
   - Smoke dispersion radius estimate in meters

4) Regulatory Compliance:
   - EPA air quality standards applicable
   - NFPA 1 Fire Code sections relevant to agricultural burning
   - State/local burn permit requirements

Format: Use bullet points with specific data backing each claim.
End with "Sources: [list specific EPA documents, NFPA codes, NWS data, meteorological standards referenced]"`;
      
      const aiAnalysis = await this.gpt5Client.complete(analysisPrompt, 500);
      
      if (!aiAnalysis) {
        throw new Error('GPT-5-mini analysis failed - NO FALLBACKS');
      }
      
      // Generate semantic embedding from REAL weather + AI analysis
      const embeddingResponse = await axios.post('https://api.openai.com/v1/embeddings', {
        model: 'text-embedding-3-large',
        input: weatherDescription + '\n\nAI Safety Analysis: ' + aiAnalysis,
        dimensions: 128 // 128-dimensional weather vector
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const weatherVector = embeddingResponse.data.data[0].embedding;
      
      logger.agent(this.agentName, 'info', 'Generated AI weather vector from REAL data', {
        realTemp: currentWeather.temperature,
        realHumidity: currentWeather.humidity,
        realWind: currentWeather.windSpeed,
        aiInsights: aiAnalysis.substring(0, 100) + '...'
      });
      
      // Store the analysis for later use
      this.lastAnalysis = {
        weather: currentWeather,
        forecast: forecast.slice(0, 8),
        aiAnalysis: aiAnalysis,
        vector: weatherVector,
        timestamp: new Date()
      };
      
      return weatherVector;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to generate AI weather vector', { error: error.message });
      throw error; // NO FALLBACKS - Real AI or fail
    }
  }

  /**
   * Analyze burn conditions using REAL weather and AI
   */
  async analyzeBurnConditions(location, requestedDate) {
    try {
      // Get REAL current weather
      const currentWeather = await this.fetchCurrentWeather(location);
      
      // Get REAL forecast
      const forecast = await this.fetchWeatherForecast(location);
      
      // Generate AI-powered analysis
      const weatherVector = await this.generateWeatherVector(currentWeather, forecast);
      
      // Check against safety thresholds
      const isSafe = this.checkWeatherSafety(currentWeather);
      
      // Find optimal burn windows in forecast
      const burnWindows = this.findBurnWindows(forecast);
      
      // Create comprehensive analysis structure
      const analysisResult = {
        currentWeather,
        forecast: forecast.slice(0, 16), // Next 48 hours
        weatherVector,
        suitabilityAnalysis: {
          overallScore: isSafe.score,
          optimalHours: burnWindows.reduce((hours, window) => {
            return hours.concat(window.conditions.map(c => ({
              time: new Date(c.timestamp).toISOString(),
              score: 8 // Good conditions score
            })));
          }, []),
          issues: isSafe.issues,
          isSafe: isSafe.safe
        },
        confidence: isSafe.safe ? 0.85 : 0.5,
        similarPatterns: [], // Would need vector search to populate
        recommendations: isSafe.issues.map(issue => ({
          type: 'warning',
          message: issue
        })),
        aiAnalysis: this.lastAnalysis?.aiAnalysis,
        dataSource: 'REAL OpenWeatherMap + GPT-5 AI'
      };
      
      return analysisResult;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Burn condition analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if current REAL weather is safe for burning
   */
  checkWeatherSafety(weather) {
    const issues = [];
    
    if (weather.windSpeed < this.optimalConditions.windSpeed.min) {
      issues.push(`Wind too calm (${weather.windSpeed}mph) - smoke won't disperse`);
    }
    if (weather.windSpeed > this.optimalConditions.windSpeed.max) {
      issues.push(`Wind too strong (${weather.windSpeed}mph) - fire spread risk`);
    }
    if (weather.humidity < this.optimalConditions.humidity.min) {
      issues.push(`Humidity too low (${weather.humidity}%) - fire spread risk`);
    }
    if (weather.humidity > this.optimalConditions.humidity.max) {
      issues.push(`Humidity too high (${weather.humidity}%) - poor combustion`);
    }
    if (weather.temperature > this.optimalConditions.temperature.max) {
      issues.push(`Temperature too high (${weather.temperature}°F) - fire risk`);
    }
    
    return {
      safe: issues.length === 0,
      issues,
      score: Math.max(0, 10 - issues.length * 2)
    };
  }

  /**
   * Get agent status and health
   */
  async getStatus() {
    return {
      agentName: this.agentName,
      version: this.version,
      initialized: this.initialized,
      apiKeyConfigured: !!this.apiKey,
      cacheSize: this.weatherCache.size,
      lastAnalysis: this.lastAnalysis ? {
        timestamp: this.lastAnalysis.timestamp,
        location: this.lastAnalysis.weather.location,
        temperature: this.lastAnalysis.weather.temperature
      } : null,
      health: this.initialized ? 'healthy' : 'not initialized'
    };
  }

  /**
   * Find optimal burn windows in REAL forecast data
   */
  findBurnWindows(forecast) {
    const windows = [];
    let currentWindow = null;
    
    for (const period of forecast) {
      const isSuitable = 
        period.windSpeed >= this.optimalConditions.windSpeed.min &&
        period.windSpeed <= this.optimalConditions.windSpeed.max &&
        period.humidity >= this.optimalConditions.humidity.min &&
        period.humidity <= this.optimalConditions.humidity.max &&
        period.precipitationProb < 20;
      
      if (isSuitable) {
        if (!currentWindow) {
          currentWindow = {
            start: period.timestamp,
            end: period.timestamp,
            conditions: [period]
          };
        } else {
          currentWindow.end = period.timestamp;
          currentWindow.conditions.push(period);
        }
      } else if (currentWindow) {
        if (currentWindow.conditions.length >= 2) { // At least 6 hours
          windows.push(currentWindow);
        }
        currentWindow = null;
      }
    }
    
    if (currentWindow && currentWindow.conditions.length >= 2) {
      windows.push(currentWindow);
    }
    
    return windows;
  }
}

module.exports = new WeatherAgent();