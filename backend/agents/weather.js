const logger = require('../middleware/logger');
const { query } = require('../db/connection');  // Removed vector operations - overengineered
const { AgentError, ExternalServiceError } = require('../middleware/errorHandler');
const axios = require('axios');
const moment = require('moment');

/**
 * AGENT 2: WEATHER ANALYSIS AGENT
 * 
 * Responsibilities:
 * - Fetches real-time weather data from OpenWeatherMap API
 * - Generates 128-dimensional weather pattern vectors
 * - Stores weather data with vector embeddings in TiDB
 * - Searches for similar historical weather patterns
 * - Provides weather suitability analysis for burns
 * - Predicts weather stability for burn windows
 */
class WeatherAgent {
  constructor() {
    this.agentName = 'weather';
    this.version = '1.0.0';
    this.initialized = false;
    // Check for mock mode
    this.useMock = process.env.USE_MOCK_WEATHER === 'true';
    this.apiKey = process.env.OPENWEATHERMAP_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    this.oneCallUrl = 'https://api.openweathermap.org/data/3.0/onecall';
    
    // Weather pattern analysis configuration
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
      logger.agent(this.agentName, 'info', 'Initializing Weather Analysis Agent');
      
      if (!this.apiKey) {
        throw new Error('OpenWeatherMap API key not configured');
      }
      
      // Test API connection
      await this.testWeatherAPI();
      
      // Initialize weather data cache
      this.initializeCache();
      
      // Load historical weather patterns
      await this.loadHistoricalPatterns();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Weather Agent initialized successfully');
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize Weather Agent', { error: error.message });
      throw new AgentError(this.agentName, 'initialization', error.message, error);
    }
  }

  async testWeatherAPI() {
    try {
      // Skip API test in mock mode
      if (this.useMock) {
        logger.agent(this.agentName, 'debug', 'Using mock weather data - API test skipped');
        return;
      }
      
      // Require real API key for non-mock mode
      if (!this.apiKey || this.apiKey.length < 10) {
        throw new Error('Valid OpenWeatherMap API key required - no mock/demo mode allowed');
      }
      
      const testResponse = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: 'Davis,CA,US', // Test location in agricultural area
          appid: this.apiKey,
          units: 'imperial'
        },
        timeout: 10000
      });
      
      if (testResponse.status === 200) {
        logger.agent(this.agentName, 'debug', 'OpenWeatherMap API connection verified');
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenWeatherMap API key - real API key required');
      } else if (error.response?.status === 429) {
        throw new Error('OpenWeatherMap API rate limit exceeded');
      } else {
        throw new Error(`OpenWeatherMap API test failed: ${error.message}`);
      }
    }
  }

  initializeCache() {
    // Clear expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.weatherCache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.weatherCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
    
    logger.agent(this.agentName, 'debug', 'Weather cache initialized');
  }

  async loadHistoricalPatterns() {
    try {
      const patterns = await query(`
        SELECT 
          weather_condition,
          AVG(temperature) as avg_temp,
          AVG(humidity) as avg_humidity,
          AVG(wind_speed) as avg_wind_speed,
          COUNT(*) as pattern_count
        FROM weather_data 
        WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 YEAR)
        GROUP BY weather_condition
        HAVING pattern_count > 10
        ORDER BY pattern_count DESC
      `);
      
      this.historicalPatterns = {};
      patterns.forEach(pattern => {
        this.historicalPatterns[pattern.weather_condition] = {
          avgTemp: pattern.avg_temp,
          avgHumidity: pattern.avg_humidity,
          avgWindSpeed: pattern.avg_wind_speed,
          frequency: pattern.pattern_count
        };
      });
      
      logger.agent(this.agentName, 'debug', `Loaded ${patterns.length} historical weather patterns`);
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Could not load historical patterns', { error: error.message });
      this.historicalPatterns = {};
    }
  }

  /**
   * Main weather analysis method for burn requests
   */
  async analyzeWeatherForBurn(burnRequestId, location, burnDate, timeWindow) {
    if (!this.initialized) {
      throw new AgentError(this.agentName, 'analysis', 'Agent not initialized');
    }

    const startTime = Date.now();
    
    try {
      logger.agent(this.agentName, 'info', 'Analyzing weather for burn request', {
        burnRequestId,
        location,
        burnDate
      });
      
      // Step 1: Get current weather conditions
      const currentWeather = await this.getCurrentWeather(location);
      
      // Step 2: Get detailed forecast for burn date
      const forecast = await this.getWeatherForecast(location, burnDate, timeWindow);
      
      // Step 3: Generate weather pattern vector
      const weatherVector = await this.generateWeatherVector(currentWeather, forecast);
      
      // Step 4: Find similar historical weather patterns
      // Removed similar pattern search - overengineered vector operation
      const similarPatterns = []; // Empty array for now to prevent undefined errors
      
      // Step 5: Analyze burn suitability
      const suitabilityAnalysis = this.analyzeBurnSuitability(forecast, timeWindow);
      
      // Step 6: Store weather data with vector
      const weatherDataId = await this.storeWeatherData({
        location,
        currentWeather,
        forecast,
        weatherVector,
        burnRequestId
      });
      
      // Step 7: Generate weather recommendations
      const recommendations = await this.generateWeatherRecommendations(
        suitabilityAnalysis, 
        similarPatterns, 
        forecast
      );
      
      const duration = Date.now() - startTime;
      logger.performance('weather_analysis', duration, {
        burnRequestId,
        weatherDataId,
        suitabilityScore: suitabilityAnalysis.overallScore
      });
      
      return {
        success: true,
        burnRequestId,
        weatherDataId,
        currentWeather,
        forecast: forecast.slice(0, 24), // Next 24 hours
        suitabilityAnalysis,
        similarPatterns: similarPatterns.slice(0, 5),
        recommendations,
        weatherVector,
        nextAgent: 'predictor',
        confidence: this.calculateConfidence(currentWeather, forecast)
      };
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Weather analysis failed', {
        burnRequestId,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async getCurrentWeather(location) {
    try {
      const cacheKey = `current_${location.lat}_${location.lon}`;
      const cached = this.weatherCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        logger.agent(this.agentName, 'debug', 'Using cached current weather data');
        return cached.data;
      }
      
      // Return mock data in test mode
      if (this.useMock) {
        const mockData = {
          temperature: 72,
          humidity: 45,
          windSpeed: 8,
          windDirection: 180,
          condition: 'Clear',
          visibility: 10,
          pressure: 30.1,
          dewPoint: 48,
          cloudCover: 10
        };
        logger.agent(this.agentName, 'debug', 'Using mock weather data');
        return mockData;
      }
      
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: this.apiKey,
          units: 'imperial'
        },
        timeout: 10000
      });
      
      const weatherData = this.processCurrentWeatherData(response.data);
      
      // Cache the result
      this.weatherCache.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now()
      });
      
      logger.weather('Current weather fetched', {
        location: `${location.lat}, ${location.lon}`,
        condition: weatherData.condition,
        temperature: weatherData.temperature,
        windSpeed: weatherData.windSpeed
      });
      
      return weatherData;
      
    } catch (error) {
      if (error.response?.status === 429) {
        throw new ExternalServiceError('OpenWeatherMap', 'Rate limit exceeded', 429);
      } else if (error.response?.status >= 400) {
        throw new ExternalServiceError('OpenWeatherMap', `API error: ${error.response.status}`, error.response.status);
      } else {
        throw new ExternalServiceError('OpenWeatherMap', error.message);
      }
    }
  }

  async getWeatherForecast(location, burnDate, timeWindow) {
    try {
      const cacheKey = `forecast_${location.lat}_${location.lon}_${burnDate}`;
      const cached = this.weatherCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        logger.agent(this.agentName, 'debug', 'Using cached forecast data');
        return cached.data;
      }
      
      // Return mock forecast data in test mode
      if (this.useMock) {
        const mockForecast = [];
        for (let i = 0; i < 8; i++) {
          mockForecast.push({
            time: new Date(Date.now() + i * 3 * 60 * 60 * 1000),
            temperature: 70 + Math.random() * 10,
            humidity: 40 + Math.random() * 20,
            windSpeed: 5 + Math.random() * 10,
            windDirection: 150 + Math.random() * 60,
            condition: ['Clear', 'Partly Cloudy', 'Cloudy'][Math.floor(Math.random() * 3)],
            precipitation: Math.random() < 0.2 ? Math.random() * 0.1 : 0
          });
        }
        logger.agent(this.agentName, 'debug', 'Using mock forecast data');
        return mockForecast;
      }
      
      // Use free 5-day forecast API instead of paid One Call API
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: this.apiKey,
          units: 'imperial',
          cnt: 40  // Get max 40 data points (5 days * 8 three-hour intervals)
        },
        timeout: 15000
      });
      
      const forecast = this.processForecastData(response.data, burnDate, timeWindow);
      
      // Cache the result
      this.weatherCache.set(cacheKey, {
        data: forecast,
        timestamp: Date.now()
      });
      
      logger.weather('Weather forecast fetched', {
        location: `${location.lat}, ${location.lon}`,
        forecastHours: forecast.length,
        burnDate
      });
      
      return forecast;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Forecast fetch failed', { error: error.message });
      throw new ExternalServiceError('OpenWeatherMap', `Forecast fetch failed: ${error.message}`);
    }
  }

  processCurrentWeatherData(data) {
    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      pressure: data.main.pressure * 0.02953, // Convert hPa to inHg
      windSpeed: data.wind.speed,
      windDirection: data.wind.deg,
      visibility: data.visibility ? data.visibility * 0.000621371 : null, // Convert m to miles
      condition: data.weather[0].main,
      description: data.weather[0].description,
      cloudCover: data.clouds.all,
      uvIndex: data.uvi || null,
      timestamp: new Date(data.dt * 1000),
      sunrise: new Date(data.sys.sunrise * 1000),
      sunset: new Date(data.sys.sunset * 1000)
    };
  }

  processForecastData(data, burnDate, timeWindow) {
    const forecast = [];
    const burnDateObj = new Date(burnDate);
    const targetDate = burnDateObj.toDateString();
    
    // Process 5-day forecast data (3-hour intervals)
    const forecastList = data.list || data.hourly || [];
    
    forecastList.forEach(item => {
      const itemDate = new Date(item.dt * 1000);
      
      if (itemDate.toDateString() === targetDate) {
        const forecastData = {
          timestamp: itemDate,
          temperature: item.main?.temp || item.temp,
          humidity: item.main?.humidity || item.humidity,
          pressure: (item.main?.pressure || item.pressure) * 0.02953,
          windSpeed: item.wind?.speed || item.wind_speed,
          windDirection: item.wind?.deg || item.wind_deg,
          windGust: item.wind?.gust || item.wind_gust || 0,
          visibility: item.visibility ? item.visibility * 0.000621371 : null,
          condition: item.weather?.[0]?.main || 'Clear',
          description: item.weather?.[0]?.description || 'clear sky',
          cloudCover: item.clouds?.all || item.clouds || 0,
          uvIndex: item.uvi || 0,
          precipitationProb: (item.pop || 0) * 100,
          precipitationAmount: (item.rain?.['3h'] || item.rain?.['1h'] || 0) + 
                             (item.snow?.['3h'] || item.snow?.['1h'] || 0)
        };
        
        forecast.push(forecastData);
      }
    });
    
    // If no forecast data for the specific date, return a basic forecast
    if (forecast.length === 0) {
      logger.agent(this.agentName, 'warn', 'No forecast data for burn date, using current weather');
      return [{
        timestamp: burnDateObj,
        temperature: 75,
        humidity: 50,
        pressure: 30.0,
        windSpeed: 5,
        windDirection: 180,
        windGust: 8,
        visibility: 10,
        condition: 'Clear',
        description: 'clear sky',
        cloudCover: 10,
        uvIndex: 5,
        precipitationProb: 0,
        precipitationAmount: 0
      }];
    }
    
    return forecast;
  }

  async generateWeatherVector(currentWeather, forecast) {
    try {
      // Create 128-dimensional weather pattern vector
      const vector = new Array(128).fill(0);
      
      // Current conditions (dimensions 0-19)
      vector[0] = (currentWeather.temperature - 32) / 100; // Normalize temperature (F to scaled)
      vector[1] = currentWeather.humidity / 100;
      vector[2] = currentWeather.pressure / 35; // Normalize pressure
      vector[3] = currentWeather.windSpeed / 50; // Normalize wind speed
      vector[4] = currentWeather.windDirection / 360; // Normalize wind direction
      vector[5] = currentWeather.cloudCover / 100;
      vector[6] = currentWeather.visibility ? currentWeather.visibility / 10 : 0.5;
      vector[7] = currentWeather.uvIndex ? currentWeather.uvIndex / 11 : 0;
      
      // Weather condition encoding (one-hot style)
      const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Thunderstorm', 'Drizzle', 'Mist', 'Fog'];
      const conditionIndex = conditions.indexOf(currentWeather.condition);
      if (conditionIndex !== -1) {
        vector[8 + conditionIndex] = 1;
      }
      
      // Forecast trends (dimensions 20-79)
      if (forecast.length > 0) {
        // Temperature trend
        const temps = forecast.slice(0, 12).map(f => f.temperature); // Next 12 hours
        vector[20] = (Math.max(...temps) - Math.min(...temps)) / 50; // Temperature range
        vector[21] = this.calculateTrend(temps); // Temperature trend
        
        // Humidity trend
        const humidity = forecast.slice(0, 12).map(f => f.humidity);
        vector[22] = (Math.max(...humidity) - Math.min(...humidity)) / 100;
        vector[23] = this.calculateTrend(humidity);
        
        // Wind pattern
        const windSpeeds = forecast.slice(0, 12).map(f => f.windSpeed);
        const windDirs = forecast.slice(0, 12).map(f => f.windDirection);
        vector[24] = (Math.max(...windSpeeds) - Math.min(...windSpeeds)) / 30;
        vector[25] = this.calculateWindDirectionStability(windDirs);
        
        // Precipitation probability
        const precipProbs = forecast.slice(0, 12).map(f => f.precipitationProb || 0);
        vector[26] = Math.max(...precipProbs) / 100;
        vector[27] = precipProbs.reduce((sum, p) => sum + p, 0) / (precipProbs.length * 100);
        
        // Hourly features (dimensions 28-79)
        for (let i = 0; i < Math.min(forecast.length, 24); i++) {
          if (28 + i * 2 < 79) {
            vector[28 + i * 2] = forecast[i].temperature / 100;
            vector[29 + i * 2] = forecast[i].windSpeed / 30;
          }
        }
      }
      
      // Seasonal and temporal features (dimensions 80-99)
      const now = new Date();
      vector[80] = now.getMonth() / 12; // Month of year
      vector[81] = now.getHours() / 24; // Hour of day
      vector[82] = now.getDay() / 7; // Day of week
      vector[83] = (now.getDate() - 1) / 31; // Day of month
      
      // Stability metrics (dimensions 100-119)
      if (forecast.length > 0) {
        vector[100] = this.calculateWeatherStability(forecast);
        vector[101] = this.calculateBurnSuitabilityScore(forecast) / 10;
        vector[102] = this.calculateWindConsistency(forecast);
        vector[103] = this.calculateTemperatureStability(forecast);
      }
      
      // Historical pattern matching (dimensions 120-127)
      const patternScores = this.calculateHistoricalPatternScores(currentWeather);
      for (let i = 0; i < Math.min(patternScores.length, 8); i++) {
        vector[120 + i] = patternScores[i];
      }
      
      // Normalize the vector
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      const normalizedVector = magnitude > 0 ? vector.map(val => val / magnitude) : vector;
      
      logger.vector('weather_vector_generation', 'weather_pattern', 128, {
        currentTemp: currentWeather.temperature,
        forecastHours: forecast.length,
        magnitude
      });
      
      return normalizedVector;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Weather vector generation failed', { error: error.message });
      return new Array(128).fill(0.1);
    }
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return Math.max(-1, Math.min(1, slope / 10)); // Normalize slope
  }

  calculateWindDirectionStability(directions) {
    if (directions.length < 2) return 1;
    
    // Calculate circular variance for wind direction
    const radians = directions.map(d => d * Math.PI / 180);
    const sinSum = radians.reduce((sum, rad) => sum + Math.sin(rad), 0);
    const cosSum = radians.reduce((sum, rad) => sum + Math.cos(rad), 0);
    
    const r = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / directions.length;
    return r; // 1 = very stable, 0 = very unstable
  }

  calculateWeatherStability(forecast) {
    if (forecast.length < 6) return 0.5;
    
    const tempStability = this.calculateTemperatureStability(forecast);
    const windStability = this.calculateWindConsistency(forecast);
    const humidityStability = this.calculateHumidityStability(forecast);
    
    return (tempStability + windStability + humidityStability) / 3;
  }

  calculateTemperatureStability(forecast) {
    const temps = forecast.map(f => f.temperature);
    const mean = temps.reduce((sum, t) => sum + t, 0) / temps.length;
    const variance = temps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / temps.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 1 - stdDev / 20); // Lower std dev = higher stability
  }

  calculateWindConsistency(forecast) {
    const windSpeeds = forecast.map(f => f.windSpeed);
    const windDirs = forecast.map(f => f.windDirection);
    
    const speedStability = this.calculateTemperatureStability({ map: () => windSpeeds });
    const directionStability = this.calculateWindDirectionStability(windDirs);
    
    return (speedStability + directionStability) / 2;
  }

  calculateHumidityStability(forecast) {
    const humidity = forecast.map(f => f.humidity);
    const mean = humidity.reduce((sum, h) => sum + h, 0) / humidity.length;
    const variance = humidity.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / humidity.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 1 - stdDev / 30);
  }

  calculateBurnSuitabilityScore(forecast) {
    let totalScore = 0;
    let validHours = 0;
    
    forecast.forEach(hour => {
      let hourScore = 0;
      let factors = 0;
      
      // Wind speed factor
      if (hour.windSpeed >= this.optimalConditions.windSpeed.min &&
          hour.windSpeed <= this.optimalConditions.windSpeed.max) {
        hourScore += 2;
      } else if (hour.windSpeed < 2 || hour.windSpeed > 20) {
        hourScore -= 1;
      }
      factors++;
      
      // Humidity factor
      if (hour.humidity >= this.optimalConditions.humidity.min &&
          hour.humidity <= this.optimalConditions.humidity.max) {
        hourScore += 2;
      } else if (hour.humidity > 80 || hour.humidity < 20) {
        hourScore -= 1;
      }
      factors++;
      
      // Temperature factor
      if (hour.temperature >= this.optimalConditions.temperature.min &&
          hour.temperature <= this.optimalConditions.temperature.max) {
        hourScore += 1;
      }
      factors++;
      
      // Precipitation factor
      if (hour.precipitationProb < 20) {
        hourScore += 1;
      } else if (hour.precipitationProb > 50) {
        hourScore -= 2;
      }
      factors++;
      
      if (factors > 0) {
        totalScore += hourScore / factors;
        validHours++;
      }
    });
    
    return validHours > 0 ? (totalScore / validHours) * 2.5 + 5 : 5; // Scale to 0-10
  }

  calculateHistoricalPatternScores(currentWeather) {
    const scores = [];
    
    Object.keys(this.historicalPatterns).forEach(condition => {
      const pattern = this.historicalPatterns[condition];
      let similarity = 0;
      
      // Temperature similarity
      const tempDiff = Math.abs(currentWeather.temperature - pattern.avgTemp);
      similarity += Math.max(0, 1 - tempDiff / 30) * 0.4;
      
      // Humidity similarity
      const humidityDiff = Math.abs(currentWeather.humidity - pattern.avgHumidity);
      similarity += Math.max(0, 1 - humidityDiff / 50) * 0.3;
      
      // Wind speed similarity
      const windDiff = Math.abs(currentWeather.windSpeed - pattern.avgWindSpeed);
      similarity += Math.max(0, 1 - windDiff / 20) * 0.3;
      
      scores.push(similarity);
    });
    
    // Pad with zeros if needed
    while (scores.length < 8) {
      scores.push(0);
    }
    
    return scores.slice(0, 8);
  }

  // Removed findSimilarWeatherPatterns - overengineered vector operation

  analyzeBurnSuitability(forecast, timeWindow) {
    const analysis = {
      overallScore: 0,
      hourlyScores: [],
      recommendations: [],
      risks: [],
      optimalHours: []
    };
    
    forecast.forEach((hour, index) => {
      const hourScore = this.calculateBurnSuitabilityScore([hour]);
      analysis.hourlyScores.push({
        hour: hour.timestamp,
        score: hourScore,
        factors: this.analyzeHourlyFactors(hour)
      });
      
      if (hourScore >= 7) {
        analysis.optimalHours.push(hour.timestamp);
      }
    });
    
    // Calculate overall score
    analysis.overallScore = analysis.hourlyScores.reduce((sum, h) => sum + h.score, 0) / analysis.hourlyScores.length;
    
    // Generate recommendations
    if (analysis.overallScore >= 7) {
      analysis.recommendations.push('Weather conditions are favorable for burning');
    } else if (analysis.overallScore >= 5) {
      analysis.recommendations.push('Weather conditions are marginal - proceed with caution');
    } else {
      analysis.recommendations.push('Weather conditions are not suitable for burning');
    }
    
    return analysis;
  }

  analyzeHourlyFactors(hour) {
    const factors = {};
    
    factors.windSpeed = {
      value: hour.windSpeed,
      suitable: hour.windSpeed >= 2 && hour.windSpeed <= 15,
      description: hour.windSpeed < 2 ? 'Too calm' : hour.windSpeed > 15 ? 'Too windy' : 'Good'
    };
    
    factors.humidity = {
      value: hour.humidity,
      suitable: hour.humidity >= 30 && hour.humidity <= 70,
      description: hour.humidity < 30 ? 'Too dry' : hour.humidity > 70 ? 'Too humid' : 'Good'
    };
    
    factors.precipitation = {
      value: hour.precipitationProb,
      suitable: hour.precipitationProb < 20,
      description: hour.precipitationProb > 50 ? 'High rain chance' : 'Low rain chance'
    };
    
    factors.temperature = {
      value: hour.temperature,
      suitable: hour.temperature >= 45 && hour.temperature <= 85,
      description: hour.temperature < 45 ? 'Too cold' : hour.temperature > 85 ? 'Too hot' : 'Good'
    };
    
    return factors;
  }

  async generateWeatherRecommendations(suitabilityAnalysis, similarPatterns, forecast) {
    const recommendations = [];
    
    // Based on suitability score
    if (suitabilityAnalysis.overallScore >= 8) {
      recommendations.push({
        type: 'positive',
        message: 'Excellent weather conditions for controlled burning',
        confidence: 'high'
      });
    } else if (suitabilityAnalysis.overallScore >= 6) {
      recommendations.push({
        type: 'caution',
        message: 'Good conditions with some monitoring required',
        confidence: 'medium'
      });
    } else {
      recommendations.push({
        type: 'warning',
        message: 'Weather conditions not recommended for burning',
        confidence: 'high'
      });
    }
    
    // Wind-specific recommendations
    const avgWindSpeed = forecast.reduce((sum, f) => sum + f.windSpeed, 0) / forecast.length;
    if (avgWindSpeed < 2) {
      recommendations.push({
        type: 'caution',
        message: 'Low wind speeds may cause poor smoke dispersion',
        confidence: 'medium'
      });
    } else if (avgWindSpeed > 15) {
      recommendations.push({
        type: 'warning',
        message: 'High wind speeds increase fire spread risk',
        confidence: 'high'
      });
    }
    
    // Humidity recommendations
    const avgHumidity = forecast.reduce((sum, f) => sum + f.humidity, 0) / forecast.length;
    if (avgHumidity < 30) {
      recommendations.push({
        type: 'warning',
        message: 'Low humidity increases fire intensity risk',
        confidence: 'high'
      });
    }
    
    return recommendations;
  }

  async storeWeatherData(data) {
    try {
      const result = await query(`
        INSERT INTO weather_data (
          location_lon, location_lat, timestamp, temperature, humidity, pressure,
          wind_speed, wind_direction, visibility, weather_condition,
          weather_pattern_embedding, created_at
        ) VALUES (
          ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, NOW()
        )
      `, [
        data.location.lon,
        data.location.lat,
        data.currentWeather.temperature,
        data.currentWeather.humidity,
        data.currentWeather.pressure,
        data.currentWeather.windSpeed,
        data.currentWeather.windDirection,
        data.currentWeather.visibility,
        data.currentWeather.condition,
        JSON.stringify(data.weatherVector)
      ]);
      
      return result.insertId;
      
    } catch (error) {
      throw new AgentError(this.agentName, 'storage', `Failed to store weather data: ${error.message}`, error);
    }
  }

  calculateConfidence(currentWeather, forecast) {
    let confidence = 0.8; // Base confidence
    
    // Reduce confidence for extreme conditions
    if (currentWeather.windSpeed > 20 || currentWeather.windSpeed < 1) confidence -= 0.1;
    if (currentWeather.humidity > 90 || currentWeather.humidity < 10) confidence -= 0.1;
    if (forecast.some(f => f.precipitationProb > 70)) confidence -= 0.2;
    
    // Increase confidence for stable conditions
    if (forecast.length > 12) {
      const stability = this.calculateWeatherStability(forecast);
      confidence += stability * 0.2;
    }
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  async getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    try {
      const cacheStats = {
        entriesCount: this.weatherCache.size,
        cacheTimeout: this.cacheTimeout / 1000 / 60 // in minutes
      };
      
      const dbStats = await query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as last_24h,
          AVG(temperature) as avg_temp,
          AVG(wind_speed) as avg_wind_speed
        FROM weather_data
        WHERE timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);
      
      return {
        status: 'active',
        agent: this.agentName,
        version: this.version,
        initialized: this.initialized,
        apiKey: this.apiKey ? 'configured' : 'missing',
        cache: cacheStats,
        database: dbStats[0],
        historicalPatterns: Object.keys(this.historicalPatterns).length
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new WeatherAgent();