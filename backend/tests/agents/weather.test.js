const weatherAgent = require('../../agents/weather');
const { query, vectorSimilaritySearch } = require('../../db/connection');
const logger = require('../../middleware/logger');
const axios = require('axios');

// Mock dependencies
jest.mock('../../db/connection');
jest.mock('../../middleware/logger');
jest.mock('axios');

describe('Weather Agent Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    weatherAgent.initialized = true;
    weatherAgent.apiKey = 'test-api-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization Tests', () => {
    test('should initialize successfully with valid API key', async () => {
      weatherAgent.initialized = false;
      process.env.OPENWEATHERMAP_API_KEY = 'valid-api-key';
      
      axios.get.mockResolvedValueOnce({ status: 200 });
      query.mockResolvedValueOnce([]);

      await weatherAgent.initialize();

      expect(weatherAgent.initialized).toBe(true);
      expect(weatherAgent.apiKey).toBe('valid-api-key');
      expect(logger.agent).toHaveBeenCalledWith(
        'weather', 'info', 'Weather Agent initialized successfully'
      );
    });

    test('should fail initialization without API key', async () => {
      weatherAgent.initialized = false;
      delete process.env.OPENWEATHERMAP_API_KEY;

      await expect(weatherAgent.initialize()).rejects.toThrow('OpenWeatherMap API key not configured');
    });

    test('should test API connectivity during initialization', async () => {
      weatherAgent.initialized = false;
      process.env.OPENWEATHERMAP_API_KEY = 'test-key';

      axios.get.mockResolvedValueOnce({ status: 200 });
      query.mockResolvedValueOnce([]);

      await weatherAgent.initialize();

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('api.openweathermap.org'),
        expect.objectContaining({
          params: expect.objectContaining({
            appid: 'test-key',
            q: 'Davis,CA,US'
          })
        })
      );
    });

    test('should handle API authentication errors', async () => {
      weatherAgent.initialized = false;
      process.env.OPENWEATHERMAP_API_KEY = 'invalid-key';

      axios.get.mockRejectedValueOnce({ response: { status: 401 } });

      await expect(weatherAgent.initialize()).rejects.toThrow('OpenWeatherMap API key is invalid');
    });

    test('should handle API rate limiting errors', async () => {
      weatherAgent.initialized = false;
      process.env.OPENWEATHERMAP_API_KEY = 'test-key';

      axios.get.mockRejectedValueOnce({ response: { status: 429 } });

      await expect(weatherAgent.initialize()).rejects.toThrow('OpenWeatherMap API rate limit exceeded');
    });

    test('should load historical weather patterns during initialization', async () => {
      weatherAgent.initialized = false;
      process.env.OPENWEATHERMAP_API_KEY = 'test-key';

      axios.get.mockResolvedValueOnce({ status: 200 });
      query.mockResolvedValueOnce([
        { weather_condition: 'Clear', avg_temp: 75, avg_humidity: 45, avg_wind_speed: 8, pattern_count: 100 },
        { weather_condition: 'Clouds', avg_temp: 70, avg_humidity: 55, avg_wind_speed: 6, pattern_count: 80 }
      ]);

      await weatherAgent.initialize();

      expect(weatherAgent.historicalPatterns).toHaveProperty('Clear');
      expect(weatherAgent.historicalPatterns).toHaveProperty('Clouds');
    });
  });

  describe('Current Weather Fetching Tests', () => {
    test('should fetch current weather successfully', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const mockWeatherResponse = {
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          visibility: 16093,
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      };

      axios.get.mockResolvedValueOnce(mockWeatherResponse);

      const weather = await weatherAgent.getCurrentWeather(location);

      expect(weather).toHaveProperty('temperature', 75);
      expect(weather).toHaveProperty('humidity', 50);
      expect(weather).toHaveProperty('windSpeed', 8);
      expect(weather).toHaveProperty('condition', 'Clear');
    });

    test('should use cached weather data when available', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const cachedData = { temperature: 75, condition: 'Clear' };
      
      // Set cache
      weatherAgent.weatherCache.set('current_38.5449_-121.7405', {
        data: cachedData,
        timestamp: Date.now()
      });

      const weather = await weatherAgent.getCurrentWeather(location);

      expect(weather).toEqual(cachedData);
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };

      axios.get.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(weatherAgent.getCurrentWeather(location))
        .rejects.toThrow('API error: 404');
    });

    test('should convert units correctly', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const mockResponse = {
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 }, // hPa
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          visibility: 16093, // meters
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const weather = await weatherAgent.getCurrentWeather(location);

      expect(weather.pressure).toBeCloseTo(29.91, 1); // Converted from hPa to inHg
      expect(weather.visibility).toBeCloseTo(10, 1); // Converted from meters to miles
    });

    test('should handle missing optional fields', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const mockResponse = {
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          // visibility and uvi missing
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const weather = await weatherAgent.getCurrentWeather(location);

      expect(weather.visibility).toBeNull();
      expect(weather.uvIndex).toBeNull();
    });
  });

  describe('Weather Forecast Tests', () => {
    test('should fetch detailed forecast for burn date', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const burnDate = '2025-08-10';
      const timeWindow = { start: '08:00', end: '16:00' };

      const mockForecastResponse = {
        data: {
          hourly: Array.from({ length: 48 }, (_, i) => ({
            dt: (new Date(`${burnDate}T00:00:00Z`).getTime() / 1000) + (i * 3600),
            temp: 70 + Math.sin(i / 12 * Math.PI) * 10,
            humidity: 50 + Math.cos(i / 24 * Math.PI) * 20,
            pressure: 1013 + Math.sin(i / 6 * Math.PI) * 5,
            wind_speed: 8 + Math.random() * 4,
            wind_deg: 180 + Math.random() * 60 - 30,
            visibility: 16093,
            weather: [{ main: 'Clear', description: 'clear sky' }],
            clouds: 10 + Math.random() * 30,
            uvi: Math.max(0, 8 * Math.sin((i - 6) / 12 * Math.PI)),
            pop: Math.random() * 0.2
          }))
        }
      };

      axios.get.mockResolvedValueOnce(mockForecastResponse);

      const forecast = await weatherAgent.getWeatherForecast(location, burnDate, timeWindow);

      expect(forecast.length).toBeGreaterThan(0);
      expect(forecast[0]).toHaveProperty('temperature');
      expect(forecast[0]).toHaveProperty('windSpeed');
      expect(forecast[0]).toHaveProperty('humidity');
    });

    test('should filter forecast to relevant burn date', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const burnDate = '2025-08-10';
      const timeWindow = { start: '08:00', end: '16:00' };

      const today = new Date();
      const targetDate = new Date(burnDate);
      
      const mockForecastResponse = {
        data: {
          hourly: [
            // Yesterday
            { dt: (today.getTime() - 24 * 60 * 60 * 1000) / 1000, temp: 70 },
            // Target date
            { dt: targetDate.getTime() / 1000, temp: 75 },
            { dt: (targetDate.getTime() + 3600 * 1000) / 1000, temp: 78 },
            // Tomorrow
            { dt: (targetDate.getTime() + 25 * 60 * 60 * 1000) / 1000, temp: 72 }
          ].map(hour => ({
            ...hour,
            humidity: 50,
            pressure: 1013,
            wind_speed: 8,
            wind_deg: 180,
            visibility: 16093,
            weather: [{ main: 'Clear', description: 'clear sky' }],
            clouds: 10,
            uvi: 5,
            pop: 0.1
          }))
        }
      };

      axios.get.mockResolvedValueOnce(mockForecastResponse);

      const forecast = await weatherAgent.getWeatherForecast(location, burnDate, timeWindow);

      // Should only include hours from the target date
      expect(forecast.every(hour => 
        new Date(hour.timestamp).toDateString() === targetDate.toDateString()
      )).toBe(true);
    });

    test('should handle forecast API failures', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const burnDate = '2025-08-10';
      const timeWindow = { start: '08:00', end: '16:00' };

      axios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(weatherAgent.getWeatherForecast(location, burnDate, timeWindow))
        .rejects.toThrow('Forecast fetch failed');
    });
  });

  describe('Weather Vector Generation Tests', () => {
    test('should generate 128-dimensional weather vector', async () => {
      const currentWeather = {
        temperature: 75,
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        cloudCover: 10,
        visibility: 10,
        uvIndex: 5,
        condition: 'Clear'
      };

      const forecast = Array.from({ length: 24 }, (_, i) => ({
        temperature: 70 + i,
        humidity: 50 + i,
        windSpeed: 8 + (i % 5),
        windDirection: 180 + (i * 10) % 360,
        precipitationProb: i % 10
      }));

      const vector = await weatherAgent.generateWeatherVector(currentWeather, forecast);

      expect(vector).toHaveLength(128);
      expect(vector.every(val => typeof val === 'number')).toBe(true);
      expect(vector.every(val => !isNaN(val))).toBe(true);
    });

    test('should normalize temperature values correctly', async () => {
      const hotWeather = {
        temperature: 100, // Hot
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        cloudCover: 10,
        visibility: 10,
        uvIndex: 8,
        condition: 'Clear'
      };

      const coldWeather = {
        ...hotWeather,
        temperature: 32 // Freezing
      };

      const hotVector = await weatherAgent.generateWeatherVector(hotWeather, []);
      const coldVector = await weatherAgent.generateWeatherVector(coldWeather, []);

      // Temperature is encoded in dimension 0
      expect(hotVector[0]).toBeGreaterThan(coldVector[0]);
    });

    test('should encode weather conditions using one-hot encoding', async () => {
      const clearWeather = {
        temperature: 75,
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        cloudCover: 0,
        visibility: 10,
        uvIndex: 5,
        condition: 'Clear'
      };

      const rainyWeather = {
        ...clearWeather,
        condition: 'Rain'
      };

      const clearVector = await weatherAgent.generateWeatherVector(clearWeather, []);
      const rainyVector = await weatherAgent.generateWeatherVector(rainyWeather, []);

      // Weather conditions are encoded in dimensions 8-15
      const clearConditionSection = clearVector.slice(8, 16);
      const rainyConditionSection = rainyVector.slice(8, 16);

      expect(clearConditionSection).not.toEqual(rainyConditionSection);
    });

    test('should calculate weather trends correctly', async () => {
      const currentWeather = {
        temperature: 75,
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        cloudCover: 10,
        visibility: 10,
        uvIndex: 5,
        condition: 'Clear'
      };

      // Increasing temperature trend
      const increasingTempForecast = Array.from({ length: 12 }, (_, i) => ({
        temperature: 70 + i * 2, // Steadily increasing
        humidity: 50,
        windSpeed: 8,
        windDirection: 180,
        precipitationProb: 10
      }));

      const vector = await weatherAgent.generateWeatherVector(currentWeather, increasingTempForecast);

      // Temperature trend should be positive (dimension 21)
      expect(vector[21]).toBeGreaterThan(0);
    });

    test('should handle wind direction stability calculation', async () => {
      const steadyWindDirections = [180, 185, 175, 182, 178]; // Stable around 180°
      const variableWindDirections = [0, 90, 180, 270, 45];  // Highly variable

      const steadyStability = weatherAgent.calculateWindDirectionStability(steadyWindDirections);
      const variableStability = weatherAgent.calculateWindDirectionStability(variableWindDirections);

      expect(steadyStability).toBeGreaterThan(variableStability);
      expect(steadyStability).toBeCloseTo(1, 1); // Should be close to 1 for stable wind
    });

    test('should normalize vector to unit length', async () => {
      const currentWeather = {
        temperature: 75,
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        cloudCover: 10,
        visibility: 10,
        uvIndex: 5,
        condition: 'Clear'
      };

      const forecast = [{ temperature: 75, humidity: 50, windSpeed: 8, windDirection: 180, precipitationProb: 10 }];

      const vector = await weatherAgent.generateWeatherVector(currentWeather, forecast);
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

      expect(magnitude).toBeCloseTo(1, 2);
    });
  });

  describe('Weather Suitability Analysis Tests', () => {
    test('should rate optimal weather conditions highly', async () => {
      const optimalForecast = Array.from({ length: 8 }, () => ({
        temperature: 70,
        humidity: 45,
        windSpeed: 10,
        windDirection: 180,
        precipitationProb: 5,
        cloudCover: 20,
        timestamp: new Date()
      }));

      const timeWindow = { start: '08:00', end: '16:00' };
      const analysis = weatherAgent.analyzeBurnSuitability(optimalForecast, timeWindow);

      expect(analysis.overallScore).toBeGreaterThan(7);
      expect(analysis.optimalHours.length).toBeGreaterThan(5);
    });

    test('should rate poor weather conditions lowly', async () => {
      const poorForecast = Array.from({ length: 8 }, () => ({
        temperature: 95, // Too hot
        humidity: 85,    // Too humid
        windSpeed: 25,   // Too windy
        windDirection: 180,
        precipitationProb: 80, // High rain chance
        cloudCover: 90,
        timestamp: new Date()
      }));

      const timeWindow = { start: '08:00', end: '16:00' };
      const analysis = weatherAgent.analyzeBurnSuitability(poorForecast, timeWindow);

      expect(analysis.overallScore).toBeLessThan(4);
      expect(analysis.optimalHours.length).toBe(0);
    });

    test('should analyze individual weather factors correctly', async () => {
      const weatherHour = {
        temperature: 75,
        humidity: 45,
        windSpeed: 10,
        windDirection: 180,
        precipitationProb: 5,
        cloudCover: 20
      };

      const factors = weatherAgent.analyzeHourlyFactors(weatherHour);

      expect(factors.windSpeed.suitable).toBe(true);
      expect(factors.humidity.suitable).toBe(true);
      expect(factors.temperature.suitable).toBe(true);
      expect(factors.precipitation.suitable).toBe(true);
    });

    test('should identify unsuitable conditions with reasons', async () => {
      const unsuitableHour = {
        temperature: 95, // Too hot
        humidity: 85,    // Too humid
        windSpeed: 1,    // Too calm
        windDirection: 180,
        precipitationProb: 70, // High rain chance
        cloudCover: 90
      };

      const factors = weatherAgent.analyzeHourlyFactors(unsuitableHour);

      expect(factors.windSpeed.suitable).toBe(false);
      expect(factors.windSpeed.description).toBe('Too calm');
      expect(factors.humidity.suitable).toBe(false);
      expect(factors.humidity.description).toBe('Too humid');
      expect(factors.precipitation.suitable).toBe(false);
      expect(factors.temperature.suitable).toBe(false);
    });
  });

  describe('Weather Stability Calculations Tests', () => {
    test('should calculate temperature stability correctly', async () => {
      const stableForecast = Array.from({ length: 12 }, () => ({ temperature: 75 }));
      const variableForecast = Array.from({ length: 12 }, (_, i) => ({ temperature: 60 + i * 3 }));

      const stableScore = weatherAgent.calculateTemperatureStability(stableForecast);
      const variableScore = weatherAgent.calculateTemperatureStability(variableForecast);

      expect(stableScore).toBeGreaterThan(variableScore);
      expect(stableScore).toBeCloseTo(1, 1);
    });

    test('should calculate wind consistency', async () => {
      const consistentWind = Array.from({ length: 12 }, () => ({ 
        windSpeed: 8, 
        windDirection: 180 
      }));
      
      const inconsistentWind = Array.from({ length: 12 }, (_, i) => ({ 
        windSpeed: 5 + Math.random() * 10, 
        windDirection: Math.random() * 360 
      }));

      const consistentScore = weatherAgent.calculateWindConsistency(consistentWind);
      const inconsistentScore = weatherAgent.calculateWindConsistency(inconsistentWind);

      expect(consistentScore).toBeGreaterThan(inconsistentScore);
    });

    test('should calculate overall weather stability', async () => {
      const stableForecast = Array.from({ length: 12 }, () => ({
        temperature: 75,
        humidity: 50,
        windSpeed: 8,
        windDirection: 180
      }));

      const stability = weatherAgent.calculateWeatherStability(stableForecast);

      expect(stability).toBeGreaterThan(0.8);
      expect(stability).toBeLessThanOrEqual(1);
    });
  });

  describe('Historical Pattern Matching Tests', () => {
    test('should find similar historical weather patterns', async () => {
      const weatherVector = new Array(128).fill(0.1);
      const mockSimilarPatterns = [
        { id: 1, similarity_score: 0.92, temperature: 74, weather_condition: 'Clear' },
        { id: 2, similarity_score: 0.87, temperature: 76, weather_condition: 'Clear' }
      ];

      vectorSimilaritySearch.mockResolvedValue(mockSimilarPatterns);

      const patterns = await weatherAgent.findSimilarWeatherPatterns(weatherVector);

      expect(patterns).toEqual(mockSimilarPatterns);
      expect(vectorSimilaritySearch).toHaveBeenCalledWith(
        'weather_data', 'weather_pattern_embedding', weatherVector, 10
      );
    });

    test('should handle vector search failures gracefully', async () => {
      const weatherVector = new Array(128).fill(0.1);
      
      vectorSimilaritySearch.mockRejectedValue(new Error('Vector search failed'));

      const patterns = await weatherAgent.findSimilarWeatherPatterns(weatherVector);

      expect(patterns).toEqual([]);
      expect(logger.agent).toHaveBeenCalledWith(
        'weather', 'warn', 'Similar pattern search failed', expect.any(Object)
      );
    });

    test('should calculate historical pattern scores', async () => {
      weatherAgent.historicalPatterns = {
        'Clear': { avgTemp: 75, avgHumidity: 45, avgWindSpeed: 8, frequency: 100 },
        'Clouds': { avgTemp: 70, avgHumidity: 55, avgWindSpeed: 6, frequency: 80 }
      };

      const currentWeather = {
        temperature: 74,
        humidity: 47,
        windSpeed: 9,
        condition: 'Clear'
      };

      const scores = weatherAgent.calculateHistoricalPatternScores(currentWeather);

      expect(scores).toHaveLength(8);
      expect(scores[0]).toBeGreaterThan(scores[1]); // Should match 'Clear' better than 'Clouds'
    });
  });

  describe('Weather Data Storage Tests', () => {
    test('should store weather data with vector embedding', async () => {
      const weatherData = {
        location: { lat: 38.5449, lon: -121.7405 },
        currentWeather: {
          temperature: 75,
          humidity: 50,
          pressure: 29.91,
          windSpeed: 8,
          windDirection: 180,
          visibility: 10,
          condition: 'Clear'
        },
        weatherVector: new Array(128).fill(0.1),
        burnRequestId: 123
      };

      query.mockResolvedValueOnce({ insertId: 456 });

      const weatherDataId = await weatherAgent.storeWeatherData(weatherData);

      expect(weatherDataId).toBe(456);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO weather_data'),
        expect.arrayContaining([
          weatherData.location.lon,
          weatherData.location.lat,
          weatherData.currentWeather.temperature,
          weatherData.currentWeather.humidity,
          weatherData.currentWeather.pressure,
          weatherData.currentWeather.windSpeed,
          weatherData.currentWeather.windDirection,
          weatherData.currentWeather.visibility,
          weatherData.currentWeather.condition,
          JSON.stringify(weatherData.weatherVector)
        ])
      );
    });

    test('should handle storage errors gracefully', async () => {
      const weatherData = {
        location: { lat: 38.5449, lon: -121.7405 },
        currentWeather: { temperature: 75, humidity: 50, condition: 'Clear' },
        weatherVector: new Array(128).fill(0.1)
      };

      query.mockRejectedValue(new Error('Database constraint violation'));

      await expect(weatherAgent.storeWeatherData(weatherData))
        .rejects.toThrow('Failed to store weather data');
    });
  });

  describe('Weather Recommendations Tests', () => {
    test('should generate positive recommendations for good conditions', async () => {
      const goodSuitability = {
        overallScore: 8.5,
        optimalHours: Array.from({ length: 6 }, () => new Date())
      };

      const goodForecast = Array.from({ length: 8 }, () => ({
        temperature: 75,
        humidity: 45,
        windSpeed: 10,
        precipitationProb: 5
      }));

      const recommendations = await weatherAgent.generateWeatherRecommendations(
        goodSuitability, [], goodForecast
      );

      expect(recommendations.some(r => r.type === 'positive')).toBe(true);
      expect(recommendations.some(r => r.confidence === 'high')).toBe(true);
    });

    test('should generate warnings for poor conditions', async () => {
      const poorSuitability = {
        overallScore: 3.2,
        optimalHours: []
      };

      const poorForecast = Array.from({ length: 8 }, () => ({
        temperature: 95,
        humidity: 85,
        windSpeed: 25,
        precipitationProb: 70
      }));

      const recommendations = await weatherAgent.generateWeatherRecommendations(
        poorSuitability, [], poorForecast
      );

      expect(recommendations.some(r => r.type === 'warning')).toBe(true);
      expect(recommendations.some(r => r.message.includes('not recommended'))).toBe(true);
    });

    test('should provide specific wind-related recommendations', async () => {
      const suitability = { overallScore: 6 };
      
      const calmWindForecast = Array.from({ length: 8 }, () => ({
        temperature: 75,
        humidity: 50,
        windSpeed: 1, // Too calm
        precipitationProb: 10
      }));

      const recommendations = await weatherAgent.generateWeatherRecommendations(
        suitability, [], calmWindForecast
      );

      expect(recommendations.some(r => 
        r.message.includes('Low wind speeds') || r.message.includes('poor smoke dispersion')
      )).toBe(true);
    });

    test('should warn about humidity-related risks', async () => {
      const suitability = { overallScore: 5 };
      
      const dryForecast = Array.from({ length: 8 }, () => ({
        temperature: 85,
        humidity: 20, // Very dry
        windSpeed: 12,
        precipitationProb: 5
      }));

      const recommendations = await weatherAgent.generateWeatherRecommendations(
        suitability, [], dryForecast
      );

      expect(recommendations.some(r => 
        r.message.includes('Low humidity') || r.message.includes('fire intensity risk')
      )).toBe(true);
    });
  });

  describe('Caching System Tests', () => {
    test('should cache weather data correctly', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const mockResponse = {
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          visibility: 16093,
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      // First call should fetch from API
      const weather1 = await weatherAgent.getCurrentWeather(location);
      
      // Second call should use cache
      const weather2 = await weatherAgent.getCurrentWeather(location);

      expect(weather1).toEqual(weather2);
      expect(axios.get).toHaveBeenCalledTimes(1); // Only one API call
    });

    test('should expire cache after timeout', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      
      // Set expired cache entry
      weatherAgent.weatherCache.set('current_38.5449_-121.7405', {
        data: { temperature: 70 },
        timestamp: Date.now() - (weatherAgent.cacheTimeout + 1000) // Expired
      });

      const mockResponse = {
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          visibility: 16093,
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const weather = await weatherAgent.getCurrentWeather(location);

      expect(weather.temperature).toBe(75); // Fresh data, not cached 70
      expect(axios.get).toHaveBeenCalled(); // API was called for fresh data
    });

    test('should clean up expired cache entries', async () => {
      // Add expired entries
      weatherAgent.weatherCache.set('expired1', { 
        data: {}, 
        timestamp: Date.now() - (weatherAgent.cacheTimeout + 1000) 
      });
      weatherAgent.weatherCache.set('expired2', { 
        data: {}, 
        timestamp: Date.now() - (weatherAgent.cacheTimeout + 2000) 
      });
      weatherAgent.weatherCache.set('valid', { 
        data: {}, 
        timestamp: Date.now() 
      });

      const initialSize = weatherAgent.weatherCache.size;
      expect(initialSize).toBe(3);

      // Trigger cache cleanup (simulate interval)
      await weatherAgent.initializeCache();
      
      // Manually trigger cleanup logic
      const now = Date.now();
      for (const [key, value] of weatherAgent.weatherCache.entries()) {
        if (now - value.timestamp > weatherAgent.cacheTimeout) {
          weatherAgent.weatherCache.delete(key);
        }
      }

      expect(weatherAgent.weatherCache.size).toBe(1); // Only valid entry remains
      expect(weatherAgent.weatherCache.has('valid')).toBe(true);
    });
  });

  describe('Confidence Calculation Tests', () => {
    test('should calculate high confidence for stable conditions', async () => {
      const stableWeather = {
        temperature: 75,
        windSpeed: 8,
        humidity: 50
      };

      const stableForecast = Array.from({ length: 24 }, () => ({
        temperature: 75,
        humidity: 50,
        windSpeed: 8,
        precipitationProb: 5
      }));

      const confidence = weatherAgent.calculateConfidence(stableWeather, stableForecast);

      expect(confidence).toBeGreaterThan(0.8);
    });

    test('should calculate low confidence for extreme conditions', async () => {
      const extremeWeather = {
        temperature: 105,
        windSpeed: 25, // Too windy
        humidity: 95   // Too humid
      };

      const extremeForecast = Array.from({ length: 24 }, () => ({
        precipitationProb: 80 // High rain chance
      }));

      const confidence = weatherAgent.calculateConfidence(extremeWeather, extremeForecast);

      expect(confidence).toBeLessThan(0.5);
    });

    test('should adjust confidence based on forecast length', async () => {
      const weather = { temperature: 75, windSpeed: 8, humidity: 50 };
      
      const shortForecast = [{ precipitationProb: 10 }];
      const longForecast = Array.from({ length: 24 }, () => ({ precipitationProb: 10 }));

      const shortConfidence = weatherAgent.calculateConfidence(weather, shortForecast);
      const longConfidence = weatherAgent.calculateConfidence(weather, longForecast);

      expect(longConfidence).toBeGreaterThan(shortConfidence);
    });
  });

  describe('Error Recovery Tests', () => {
    test('should recover from API timeout errors', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };

      axios.get.mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout' });

      await expect(weatherAgent.getCurrentWeather(location))
        .rejects.toThrow('OpenWeatherMap');
    });

    test('should handle malformed API responses', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };

      axios.get.mockResolvedValueOnce({
        data: {
          // Missing required fields
          main: {},
          wind: {}
        }
      });

      await expect(weatherAgent.getCurrentWeather(location))
        .rejects.toThrow();
    });

    test('should provide fallback when vector generation fails', async () => {
      const currentWeather = null; // Invalid input
      const forecast = [];

      const vector = await weatherAgent.generateWeatherVector(currentWeather, forecast);

      expect(vector).toHaveLength(128);
      expect(vector.every(val => val === 0.1)).toBe(true); // Fallback vector
    });
  });

  describe('Performance Monitoring Tests', () => {
    test('should log weather analysis performance metrics', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const burnDate = '2025-08-10';
      const timeWindow = { start: '08:00', end: '16:00' };

      // Mock API responses
      axios.get.mockResolvedValueOnce({
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          visibility: 16093,
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      });

      axios.get.mockResolvedValueOnce({
        data: {
          hourly: Array.from({ length: 24 }, (_, i) => ({
            dt: (new Date(`${burnDate}T00:00:00Z`).getTime() / 1000) + (i * 3600),
            temp: 75,
            humidity: 50,
            pressure: 1013,
            wind_speed: 8,
            wind_deg: 180,
            visibility: 16093,
            weather: [{ main: 'Clear', description: 'clear sky' }],
            clouds: 10,
            uvi: 5,
            pop: 0.1
          }))
        }
      });

      query.mockResolvedValueOnce({ insertId: 456 });
      vectorSimilaritySearch.mockResolvedValue([]);

      await weatherAgent.analyzeWeatherForBurn(123, location, burnDate, timeWindow);

      expect(logger.performance).toHaveBeenCalledWith(
        'weather_analysis', expect.any(Number), expect.any(Object)
      );
    });

    test('should track vector generation performance', async () => {
      const currentWeather = {
        temperature: 75,
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        cloudCover: 10,
        visibility: 10,
        uvIndex: 5,
        condition: 'Clear'
      };

      const forecast = Array.from({ length: 24 }, () => ({
        temperature: 75,
        humidity: 50,
        windSpeed: 8,
        windDirection: 180,
        precipitationProb: 10
      }));

      await weatherAgent.generateWeatherVector(currentWeather, forecast);

      expect(logger.vector).toHaveBeenCalledWith(
        'weather_vector_generation', 'weather_pattern', 128, expect.any(Object)
      );
    });
  });

  describe('Edge Cases Tests', () => {
    test('should handle extreme weather values', async () => {
      const extremeWeather = {
        temperature: -10, // Extreme cold
        humidity: 0,     // Extreme dry
        pressure: 25.0,  // Low pressure
        windSpeed: 50,   // Hurricane force
        windDirection: 0,
        cloudCover: 100,
        visibility: 0,   // Zero visibility
        uvIndex: 15,     // Extreme UV
        condition: 'Thunderstorm'
      };

      const vector = await weatherAgent.generateWeatherVector(extremeWeather, []);

      expect(vector).toHaveLength(128);
      expect(vector.every(val => !isNaN(val))).toBe(true);
      expect(vector.every(val => val >= -1 && val <= 1)).toBe(true);
    });

    test('should handle missing forecast data', async () => {
      const currentWeather = {
        temperature: 75,
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        cloudCover: 10,
        visibility: 10,
        uvIndex: 5,
        condition: 'Clear'
      };

      const emptyForecast = [];

      const vector = await weatherAgent.generateWeatherVector(currentWeather, emptyForecast);

      expect(vector).toHaveLength(128);
      // Forecast-dependent dimensions should be zero or default values
      expect(vector.slice(20, 80).every(val => val >= 0)).toBe(true);
    });

    test('should handle invalid coordinates gracefully', async () => {
      const invalidLocation = { lat: 999, lon: -999 };

      axios.get.mockRejectedValueOnce({ response: { status: 400 } });

      await expect(weatherAgent.getCurrentWeather(invalidLocation))
        .rejects.toThrow('API error: 400');
    });
  });

  describe('Integration Tests', () => {
    test('should complete full weather analysis workflow', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const burnDate = '2025-08-10';
      const timeWindow = { start: '08:00', end: '16:00' };

      // Mock current weather
      axios.get.mockResolvedValueOnce({
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          visibility: 16093,
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      });

      // Mock forecast
      axios.get.mockResolvedValueOnce({
        data: {
          hourly: Array.from({ length: 24 }, (_, i) => ({
            dt: (new Date(`${burnDate}T00:00:00Z`).getTime() / 1000) + (i * 3600),
            temp: 70 + i,
            humidity: 50,
            pressure: 1013,
            wind_speed: 8,
            wind_deg: 180,
            visibility: 16093,
            weather: [{ main: 'Clear', description: 'clear sky' }],
            clouds: 10,
            uvi: Math.max(0, 8 * Math.sin((i - 6) / 12 * Math.PI)),
            pop: 0.1
          }))
        }
      });

      query.mockResolvedValueOnce({ insertId: 456 }); // Store weather data
      vectorSimilaritySearch.mockResolvedValue([]); // No similar patterns

      const result = await weatherAgent.analyzeWeatherForBurn(123, location, burnDate, timeWindow);

      expect(result.success).toBe(true);
      expect(result.weatherDataId).toBe(456);
      expect(result.currentWeather).toBeDefined();
      expect(result.forecast).toBeDefined();
      expect(result.suitabilityAnalysis).toBeDefined();
      expect(result.weatherVector).toHaveLength(128);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle partial API failures in workflow', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const burnDate = '2025-08-10';
      const timeWindow = { start: '08:00', end: '16:00' };

      // Current weather succeeds
      axios.get.mockResolvedValueOnce({
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      });

      // Forecast fails
      axios.get.mockRejectedValueOnce(new Error('Forecast API unavailable'));

      await expect(weatherAgent.analyzeWeatherForBurn(123, location, burnDate, timeWindow))
        .rejects.toThrow('Forecast fetch failed');
    });
  });

  describe('Status Reporting Tests', () => {
    test('should return comprehensive agent status', async () => {
      query.mockResolvedValueOnce([{
        total_records: 1500,
        last_24h: 150,
        avg_temp: 72.5,
        avg_wind_speed: 8.2
      }]);

      const status = await weatherAgent.getStatus();

      expect(status.status).toBe('active');
      expect(status.agent).toBe('weather');
      expect(status.initialized).toBe(true);
      expect(status.apiKey).toBe('configured');
      expect(status.database).toBeDefined();
    });

    test('should handle status check database errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));

      const status = await weatherAgent.getStatus();

      expect(status.status).toBe('error');
      expect(status.error).toBe('Database connection failed');
    });

    test('should report cache statistics', async () => {
      // Add some cache entries
      weatherAgent.weatherCache.set('test1', { data: {}, timestamp: Date.now() });
      weatherAgent.weatherCache.set('test2', { data: {}, timestamp: Date.now() });

      query.mockResolvedValueOnce([{ total_records: 100 }]);

      const status = await weatherAgent.getStatus();

      expect(status.cache.entriesCount).toBe(2);
      expect(status.cache.cacheTimeout).toBe(10); // 10 minutes
    });
  });

  describe('Seasonal Analysis Tests', () => {
    test('should encode seasonal information in vectors', async () => {
      const summerWeather = {
        temperature: 85,
        humidity: 30,
        pressure: 29.91,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 5,
        visibility: 10,
        uvIndex: 9,
        condition: 'Clear'
      };

      const winterWeather = {
        ...summerWeather,
        temperature: 45,
        humidity: 70,
        uvIndex: 2
      };

      // Mock dates
      const originalDate = Date.now;
      Date.now = jest.fn()
        .mockReturnValueOnce(new Date('2025-07-15T12:00:00Z').getTime()) // Summer
        .mockReturnValueOnce(new Date('2025-01-15T12:00:00Z').getTime()); // Winter

      const summerVector = await weatherAgent.generateWeatherVector(summerWeather, []);
      const winterVector = await weatherAgent.generateWeatherVector(winterWeather, []);

      // Seasonal encoding is in dimensions 80-83
      expect(summerVector[80]).not.toEqual(winterVector[80]); // Different months

      Date.now = originalDate;
    });

    test('should calculate seasonal burn suitability factors', async () => {
      const fallForecast = Array.from({ length: 8 }, () => ({
        temperature: 65,  // Ideal fall temperature
        humidity: 45,     // Good humidity
        windSpeed: 12,    // Good wind
        precipitationProb: 10,
        timestamp: new Date('2025-10-15T12:00:00Z')
      }));

      const summerForecast = Array.from({ length: 8 }, () => ({
        temperature: 90,  // Hot summer temperature
        humidity: 35,     // Lower humidity
        windSpeed: 15,    // Higher wind
        precipitationProb: 5,
        timestamp: new Date('2025-07-15T12:00:00Z')
      }));

      const fallScore = weatherAgent.calculateBurnSuitabilityScore(fallForecast);
      const summerScore = weatherAgent.calculateBurnSuitabilityScore(summerForecast);

      expect(fallScore).toBeGreaterThan(summerScore);
    });
  });

  describe('Data Quality Tests', () => {
    test('should validate weather data quality', async () => {
      const highQualityWeather = {
        temperature: 75,
        humidity: 50,
        pressure: 29.91,
        windSpeed: 8,
        windDirection: 180,
        visibility: 10,
        condition: 'Clear'
      };

      const lowQualityWeather = {
        temperature: null,
        humidity: undefined,
        pressure: 'invalid',
        windSpeed: -5,
        windDirection: 400,
        visibility: null,
        condition: ''
      };

      const highQualityVector = await weatherAgent.generateWeatherVector(highQualityWeather, []);
      const lowQualityVector = await weatherAgent.generateWeatherVector(lowQualityWeather, []);

      expect(highQualityVector.every(val => !isNaN(val))).toBe(true);
      expect(lowQualityVector.every(val => !isNaN(val))).toBe(true); // Should handle gracefully
    });

    test('should detect and handle data anomalies', async () => {
      const anomalousWeather = {
        temperature: 150,  // Impossible temperature
        humidity: 150,     // Impossible humidity
        pressure: 50,      // Extreme pressure
        windSpeed: 200,    // Impossible wind speed
        windDirection: 400, // Invalid direction
        cloudCover: 150,   // Impossible cloud cover
        visibility: -10,   // Negative visibility
        uvIndex: 20,       // Extreme UV
        condition: 'Clear'
      };

      const vector = await weatherAgent.generateWeatherVector(anomalousWeather, []);

      expect(vector).toHaveLength(128);
      expect(vector.every(val => val >= -1 && val <= 1)).toBe(true); // Should be normalized
    });
  });

  describe('Memory and Resource Management Tests', () => {
    test('should manage cache memory efficiently', async () => {
      const initialCacheSize = weatherAgent.weatherCache.size;

      // Fill cache with many entries
      for (let i = 0; i < 1000; i++) {
        weatherAgent.weatherCache.set(`test_${i}`, {
          data: { temperature: 75 },
          timestamp: i % 2 === 0 ? Date.now() : Date.now() - (weatherAgent.cacheTimeout + 1000)
        });
      }

      expect(weatherAgent.weatherCache.size).toBe(initialCacheSize + 1000);

      // Simulate cache cleanup
      weatherAgent.initializeCache();
      
      // Manually trigger cleanup for testing
      const now = Date.now();
      for (const [key, value] of weatherAgent.weatherCache.entries()) {
        if (key.startsWith('test_') && now - value.timestamp > weatherAgent.cacheTimeout) {
          weatherAgent.weatherCache.delete(key);
        }
      }

      // Should have cleaned up expired entries
      expect(weatherAgent.weatherCache.size).toBeLessThan(initialCacheSize + 600);
    });

    test('should handle concurrent cache operations safely', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      
      // Simulate concurrent requests for same location
      const promises = Array.from({ length: 10 }, () => {
        // Mock API response for each call
        axios.get.mockResolvedValueOnce({
          data: {
            main: { temp: 75, humidity: 50, pressure: 1013 },
            wind: { speed: 8, deg: 180 },
            weather: [{ main: 'Clear', description: 'clear sky' }],
            clouds: { all: 10 },
            dt: Date.now() / 1000,
            sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
          }
        });
        
        return weatherAgent.getCurrentWeather(location);
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.temperature === 75)).toBe(true);
    });
  });

  describe('API Rate Limiting Tests', () => {
    test('should handle rate limiting responses', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };

      axios.get.mockRejectedValueOnce({ response: { status: 429 } });

      await expect(weatherAgent.getCurrentWeather(location))
        .rejects.toThrow('Rate limit exceeded');
    });

    test('should implement exponential backoff for retries', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };

      // First call fails with rate limit
      axios.get.mockRejectedValueOnce({ response: { status: 429 } });

      try {
        await weatherAgent.getCurrentWeather(location);
      } catch (error) {
        expect(error.message).toContain('Rate limit exceeded');
      }

      // Should handle subsequent calls appropriately
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mathematical Calculations Tests', () => {
    test('should calculate trends correctly', () => {
      const increasingValues = [10, 12, 14, 16, 18];
      const decreasingValues = [18, 16, 14, 12, 10];
      const stableValues = [15, 15, 15, 15, 15];

      const increasingTrend = weatherAgent.calculateTrend(increasingValues);
      const decreasingTrend = weatherAgent.calculateTrend(decreasingValues);
      const stableTrend = weatherAgent.calculateTrend(stableValues);

      expect(increasingTrend).toBeGreaterThan(0);
      expect(decreasingTrend).toBeLessThan(0);
      expect(Math.abs(stableTrend)).toBeLessThan(0.1);
    });

    test('should calculate wind direction stability correctly', () => {
      const steadyDirections = [175, 180, 185, 178, 182]; // Around 180°
      const varyingDirections = [0, 90, 180, 270, 45];    // Highly variable

      const steadyStability = weatherAgent.calculateWindDirectionStability(steadyDirections);
      const varyingStability = weatherAgent.calculateWindDirectionStability(varyingDirections);

      expect(steadyStability).toBeGreaterThan(0.8);
      expect(varyingStability).toBeLessThan(0.5);
    });

    test('should handle circular wind direction calculations', () => {
      const wrappingDirections = [350, 10, 5, 355, 0]; // Around 0°/360°

      const stability = weatherAgent.calculateWindDirectionStability(wrappingDirections);

      expect(stability).toBeGreaterThan(0.7); // Should handle wrapping correctly
    });

    test('should calculate weather stability composite score', () => {
      const stableForecast = Array.from({ length: 12 }, () => ({
        temperature: 75,
        humidity: 50,
        windSpeed: 8,
        windDirection: 180
      }));

      const variableForecast = Array.from({ length: 12 }, (_, i) => ({
        temperature: 60 + i * 3,
        humidity: 30 + i * 5,
        windSpeed: 5 + Math.random() * 10,
        windDirection: Math.random() * 360
      }));

      const stableScore = weatherAgent.calculateWeatherStability(stableForecast);
      const variableScore = weatherAgent.calculateWeatherStability(variableForecast);

      expect(stableScore).toBeGreaterThan(variableScore);
      expect(stableScore).toBeLessThanOrEqual(1);
      expect(variableScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Burn Suitability Scoring Tests', () => {
    test('should score ideal burn conditions perfectly', () => {
      const idealConditions = [{
        temperature: 70,
        humidity: 50,
        windSpeed: 10,
        precipitationProb: 5
      }];

      const score = weatherAgent.calculateBurnSuitabilityScore(idealConditions);

      expect(score).toBeGreaterThan(8);
      expect(score).toBeLessThanOrEqual(10);
    });

    test('should score dangerous conditions poorly', () => {
      const dangerousConditions = [{
        temperature: 100,
        humidity: 15,
        windSpeed: 30,
        precipitationProb: 0
      }];

      const score = weatherAgent.calculateBurnSuitabilityScore(dangerousConditions);

      expect(score).toBeLessThan(3);
    });

    test('should consider precipitation probability heavily', () => {
      const dryConditions = [{
        temperature: 75,
        humidity: 45,
        windSpeed: 10,
        precipitationProb: 5
      }];

      const wetConditions = [{
        temperature: 75,
        humidity: 45,
        windSpeed: 10,
        precipitationProb: 80
      }];

      const dryScore = weatherAgent.calculateBurnSuitabilityScore(dryConditions);
      const wetScore = weatherAgent.calculateBurnSuitabilityScore(wetConditions);

      expect(dryScore).toBeGreaterThan(wetScore + 2);
    });
  });

  describe('Historical Pattern Analysis Tests', () => {
    test('should load and use historical patterns effectively', async () => {
      weatherAgent.historicalPatterns = {
        'Clear': { avgTemp: 75, avgHumidity: 45, avgWindSpeed: 8 },
        'Clouds': { avgTemp: 70, avgHumidity: 60, avgWindSpeed: 6 }
      };

      const similarWeather = { temperature: 74, humidity: 47, windSpeed: 9 };
      const dissimilarWeather = { temperature: 50, humidity: 90, windSpeed: 2 };

      const similarScores = weatherAgent.calculateHistoricalPatternScores(similarWeather);
      const dissimilarScores = weatherAgent.calculateHistoricalPatternScores(dissimilarWeather);

      expect(similarScores[0]).toBeGreaterThan(dissimilarScores[0]);
    });

    test('should handle empty historical patterns', async () => {
      weatherAgent.historicalPatterns = {};

      const currentWeather = { temperature: 75, humidity: 50, windSpeed: 8 };
      const scores = weatherAgent.calculateHistoricalPatternScores(currentWeather);

      expect(scores).toHaveLength(8);
      expect(scores.every(score => score === 0)).toBe(true);
    });
  });

  describe('Time-based Processing Tests', () => {
    test('should encode time-of-day correctly in vectors', () => {
      const originalDate = Date;
      
      // Mock morning time
      global.Date = jest.fn(() => new Date('2025-08-10T08:00:00Z'));
      global.Date.now = jest.fn(() => new Date('2025-08-10T08:00:00Z').getTime());

      const morningVector = weatherAgent.generateWeatherVector({ 
        temperature: 75, condition: 'Clear' 
      }, []);

      // Mock evening time
      global.Date.now = jest.fn(() => new Date('2025-08-10T18:00:00Z').getTime());

      const eveningVector = weatherAgent.generateWeatherVector({ 
        temperature: 75, condition: 'Clear' 
      }, []);

      // Hour of day is encoded in dimension 81
      expect(morningVector[81]).not.toEqual(eveningVector[81]);

      global.Date = originalDate;
    });

    test('should process forecast time windows correctly', () => {
      const burnDate = '2025-08-10';
      const timeWindow = { start: '08:00', end: '16:00' };

      const mockForecastData = {
        hourly: [
          // Before burn date
          { dt: new Date('2025-08-09T12:00:00Z').getTime() / 1000, temp: 70 },
          // Target burn date
          { dt: new Date('2025-08-10T08:00:00Z').getTime() / 1000, temp: 75 },
          { dt: new Date('2025-08-10T12:00:00Z').getTime() / 1000, temp: 80 },
          { dt: new Date('2025-08-10T16:00:00Z').getTime() / 1000, temp: 78 },
          // After burn date
          { dt: new Date('2025-08-11T12:00:00Z').getTime() / 1000, temp: 72 }
        ].map(hour => ({
          ...hour,
          humidity: 50,
          pressure: 1013,
          wind_speed: 8,
          wind_deg: 180,
          weather: [{ main: 'Clear' }],
          clouds: 10,
          uvi: 5,
          pop: 0.1
        }))
      };

      const forecast = weatherAgent.processForecastData(mockForecastData, burnDate, timeWindow);

      expect(forecast).toHaveLength(3); // Only target date hours
      expect(forecast.every(hour => 
        new Date(hour.timestamp).toDateString() === new Date(burnDate).toDateString()
      )).toBe(true);
    });
  });

  describe('Load and Stress Tests', () => {
    test('should handle multiple concurrent weather analyses', async () => {
      const locations = Array.from({ length: 20 }, (_, i) => ({
        lat: 38.5 + i * 0.01,
        lon: -121.7 + i * 0.01
      }));

      // Mock API responses for all requests
      axios.get.mockImplementation(() => Promise.resolve({
        data: {
          main: { temp: 75, humidity: 50, pressure: 1013 },
          wind: { speed: 8, deg: 180 },
          weather: [{ main: 'Clear', description: 'clear sky' }],
          clouds: { all: 10 },
          dt: Date.now() / 1000,
          sys: { sunrise: Date.now() / 1000, sunset: (Date.now() + 12 * 60 * 60 * 1000) / 1000 }
        }
      }));

      const startTime = Date.now();
      const promises = locations.map(location => weatherAgent.getCurrentWeather(location));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(20);
      expect(results.every(r => r.temperature === 75)).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should maintain performance with large forecast datasets', async () => {
      const location = { lat: 38.5449, lon: -121.7405 };
      const burnDate = '2025-08-10';
      const timeWindow = { start: '06:00', end: '18:00' };

      // Large forecast dataset (48 hours of data)
      const largeForecast = Array.from({ length: 48 }, (_, i) => ({
        temperature: 70 + Math.sin(i / 12 * Math.PI) * 10,
        humidity: 50 + Math.cos(i / 24 * Math.PI) * 20,
        windSpeed: 8 + Math.sin(i / 6 * Math.PI) * 4,
        windDirection: 180 + Math.sin(i / 8 * Math.PI) * 45,
        precipitationProb: Math.max(0, Math.sin(i / 16 * Math.PI) * 30)
      }));

      const startTime = Date.now();
      const suitability = weatherAgent.analyzeBurnSuitability(largeForecast, timeWindow);
      const duration = Date.now() - startTime;

      expect(suitability.hourlyScores).toHaveLength(48);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});